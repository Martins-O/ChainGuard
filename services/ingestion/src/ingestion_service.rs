use anyhow::Result;
use serde_json::{json, Value};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use futures_util::{SinkExt, StreamExt};
use tokio_tungstenite::tungstenite::Message;
use tracing::{debug, error, info, warn};

use crate::config::Config;
use crate::redis_producer::RedisProducer;
use crate::transaction_normalizer::TransactionNormalizer;
use crate::websocket_manager::WebSocketManager;
use crate::metrics::{Metrics, MetricsState};

pub struct IngestionService {
    config: Config,
    redis_producer: RedisProducer,
    normalizer: TransactionNormalizer,
    metrics: Arc<RwLock<Metrics>>,
}

impl IngestionService {
    pub fn new(config: Config) -> Result<Self> {
        let redis_producer = RedisProducer::new(
            &config.redis.url,
            config.redis.queue_name.clone(),
            config.redis.batch_size,
            config.redis.batch_timeout_ms,
        )?;
        
        let normalizer = TransactionNormalizer::new();
        let metrics = Arc::new(RwLock::new(Metrics::default()));
        
        Ok(Self {
            config,
            redis_producer,
            normalizer,
            metrics,
        })
    }
    
    pub async fn run(&mut self) -> Result<()> {
        info!("Starting ChainGuard ingestion service");
        
        let mut ws_manager = WebSocketManager::new(
            self.config.avalanche.websocket_url.clone(),
            self.config.avalanche.fallback_urls.clone(),
            self.config.avalanche.connection_timeout_ms,
            self.config.avalanche.ping_interval_sec,
        );
        
        loop {
            match self.run_session(&mut ws_manager).await {
                Ok(_) => {
                    warn!("Ingestion session ended gracefully, restarting...");
                }
                Err(e) => {
                    error!("Ingestion session failed: {}, restarting...", e);
                }
            }
            
            // Wait before reconnecting
            tokio::time::sleep(Duration::from_millis(self.config.general.retry_delay_ms)).await;
        }
    }
    
    async fn run_session(&mut self, ws_manager: &mut WebSocketManager) -> Result<()> {
        let mut ws_stream = ws_manager.connect().await?;
        
        // Subscribe to pending transactions and new blocks
        WebSocketManager::subscribe_new_pending_transactions(&mut ws_stream).await?;
        WebSocketManager::subscribe_new_heads(&mut ws_stream).await?;
        
        let mut batch_buffer = Vec::new();
        let mut last_batch_time = Instant::now();
        let batch_timeout = Duration::from_millis(self.config.redis.batch_timeout_ms);
        
        loop {
            tokio::select! {
                Some(msg) = ws_stream.next() => {
                    match msg? {
                        Message::Text(text) => {
                            if let Err(e) = self.handle_message(&text, &mut batch_buffer, &mut last_batch_time, batch_timeout).await {
                                error!("Failed to handle message: {}", e);
                                self.update_metrics(|m| m.transactions_failed += 1).await;
                            }
                        }
                        Message::Ping(payload) => {
                            ws_stream.send(Message::Pong(payload)).await?;
                        }
                        Message::Close(_) => {
                            warn!("WebSocket connection closed by server");
                            break;
                        }
                        _ => {}
                    }
                }
                _ = tokio::time::sleep(batch_timeout) => {
                    if !batch_buffer.is_empty() && last_batch_time.elapsed() >= batch_timeout {
                        self.flush_batch(&mut batch_buffer).await?;
                    }
                }
            }
        }
        
        Ok(())
    }
    
    async fn handle_message(
        &mut self,
        text: &str,
        batch_buffer: &mut Vec<crate::types::NormalizedTransaction>,
        last_batch_time: &mut Instant,
        batch_timeout: Duration,
    ) -> Result<()> {
        let data: Value = serde_json::from_str(text)?;
        
        if let Some(params) = data.get("params") {
            if let Some(result) = params.get("result") {
                if let Some(tx_hash) = result.as_str() {
                    debug!("Received pending transaction: {}", tx_hash);
                    
                    // For pending transactions, we'll get basic info now
                    // In a production system, you'd want to get full transaction details
                    // This is a simplified version
                    return Ok(());
                }
                
                if let Some(block_header) = result.as_object() {
                    if let Some(block_number_str) = block_header.get("number") {
                        if let Some(block_number_str) = block_number_str.as_str() {
                            let block_number = u64::from_str_radix(&block_number_str[2..], 16)?;
                            debug!("Received new block: {}", block_number);
                            
                            self.update_metrics(|m| {
                                m.last_processed_block = Some(block_number);
                            }).await;
                        }
                    }
                }
            }
        }
        
        // Flush batch if it's full or timeout reached
        if batch_buffer.len() >= self.config.redis.batch_size || 
           last_batch_time.elapsed() >= batch_timeout {
            self.flush_batch(batch_buffer).await?;
            *last_batch_time = Instant::now();
        }
        
        Ok(())
    }
    
    async fn flush_batch(&mut self, batch: &mut Vec<crate::types::NormalizedTransaction>) -> Result<()> {
        if batch.is_empty() {
            return Ok(());
        }
        
        match self.redis_producer.publish_batch(batch.clone()).await {
            Ok(_) => {
                self.update_metrics(|m| {
                    m.redis_publishes += batch.len() as u64;
                    m.transactions_processed += batch.len() as u64;
                }).await;
                
                info!("Flushed batch of {} transactions", batch.len());
            }
            Err(e) => {
                error!("Failed to publish batch: {}", e);
                self.update_metrics(|m| {
                    m.redis_publish_failures += 1;
                    m.transactions_failed += batch.len() as u64;
                }).await;
            }
        }
        
        batch.clear();
        Ok(())
    }
    
    async fn update_metrics<F>(&self, update_fn: F)
    where
        F: FnOnce(&mut Metrics),
    {
        let mut metrics = self.metrics.write().await;
        update_fn(&mut metrics);
    }
    
    pub fn get_metrics(&self) -> Arc<RwLock<Metrics>> {
        self.metrics.clone()
    }
}