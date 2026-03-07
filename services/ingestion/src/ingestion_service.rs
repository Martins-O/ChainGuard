use anyhow::Result;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;
use futures_util::{SinkExt, StreamExt};
use tokio_tungstenite::tungstenite::Message;
use tracing::{debug, error, info, warn};

use crate::config::Config;
use crate::redis_producer::RedisProducer;
use crate::transaction_normalizer::TransactionNormalizer;
use crate::websocket_manager::WebSocketManager;
use crate::metrics::{Metrics, MetricsState};

#[derive(Debug, Clone)]
pub struct SubnetInfo {
    pub id: String,
    pub name: String,
    pub chain_id: String,
    pub rpc_url: String,
    pub websocket_url: String,
}

pub struct IngestionService {
    config: Config,
    redis_producer: RedisProducer,
    normalizer: TransactionNormalizer,
    metrics: Arc<RwLock<Metrics>>,
    mongodb_url: Option<String>,
    mongodb_db: Option<String>,
    active_subnets: Arc<RwLock<HashMap<String, SubnetInfo>>>,
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
        let active_subnets = Arc::new(RwLock::new(HashMap::new()));
        
        let (mongodb_url, mongodb_db) = if let Some(ref mongo_config) = config.mongodb {
            (Some(mongo_config.url.clone()), Some(mongo_config.database.clone()))
        } else {
            (None, None)
        };
        
        Ok(Self {
            config,
            redis_producer,
            normalizer,
            metrics,
            mongodb_url,
            mongodb_db,
            active_subnets,
        })
    }
    
    pub async fn run(&mut self) -> Result<()> {
        info!("Starting ChainGuard ingestion service");
        
        loop {
            // Try to fetch subnets from MongoDB
            self.refresh_subnets_from_db().await;
            
            // Monitor each active subnet
            let subnets = self.active_subnets.read().await.clone();
            
            if subnets.is_empty() {
                info!("No active subnets to monitor. Using default Avalanche C-Chain.");
                self.monitor_default_subnet().await;
            } else {
                for (chain_id, subnet) in &subnets {
                    info!("Monitoring subnet: {} ({})", subnet.name, chain_id);
                    self.monitor_subnet(subnet).await;
                }
            }
            
            // Wait before refreshing subnets
            tokio::time::sleep(Duration::from_secs(30)).await;
        }
    }
    
    async fn refresh_subnets_from_db(&mut self) {
        if let (Some(url), Some(db)) = (&self.mongodb_url, &self.mongodb_db) {
            match crate::subnet_repository::fetch_subnets(url, db).await {
                Ok(subnets) => {
                    let mut active = self.active_subnets.write().await;
                    active.clear();
                    for subnet in subnets {
                        if subnet.monitoring_enabled {
                            info!("Found subnet to monitor: {} ({})", subnet.name, subnet.chain_id);
                            active.insert(subnet.chain_id.clone(), SubnetInfo {
                                id: subnet.id,
                                name: subnet.name,
                                chain_id: subnet.chain_id,
                                rpc_url: subnet.rpc_url,
                                websocket_url: subnet.websocket_url,
                            });
                        }
                    }
                }
                Err(e) => {
                    error!("Failed to fetch subnets from MongoDB: {}", e);
                }
            }
        }
    }
    
    async fn monitor_default_subnet(&mut self) {
        let mut ws_manager = WebSocketManager::new(
            self.config.avalanche.websocket_url.clone(),
            self.config.avalanche.fallback_urls.clone(),
            self.config.avalanche.connection_timeout_ms,
            self.config.avalanche.ping_interval_sec,
        );
        
        loop {
            match self.run_session(&mut ws_manager, "avalanche-c-chain").await {
                Ok(_) => {
                    warn!("Ingestion session ended gracefully, restarting...");
                }
                Err(e) => {
                    error!("Ingestion session failed: {}, restarting...", e);
                }
            }
            
            tokio::time::sleep(Duration::from_millis(self.config.general.retry_delay_ms)).await;
        }
    }
    
    async fn monitor_subnet(&mut self, subnet: &SubnetInfo) {
        let mut ws_manager = WebSocketManager::new(
            subnet.websocket_url.clone(),
            vec![],
            self.config.avalanche.connection_timeout_ms,
            self.config.avalanche.ping_interval_sec,
        );
        
        let chain_id = subnet.chain_id.clone();
        
        loop {
            match self.run_session(&mut ws_manager, &chain_id).await {
                Ok(_) => {
                    warn!("Session for {} ended, restarting...", subnet.name);
                }
                Err(e) => {
                    error!("Session failed for {}: {}", subnet.name, e);
                }
            }
            
            // Check if subnet is still active
            let active = self.active_subnets.read().await;
            if !active.contains_key(&chain_id) {
                info!("Subnet {} no longer active, stopping monitoring", subnet.name);
                break;
            }
            
            tokio::time::sleep(Duration::from_millis(self.config.general.retry_delay_ms)).await;
        }
    }
    
    async fn run_session(&mut self, ws_manager: &mut WebSocketManager, chain_id: &str) -> Result<()> {
        let mut ws_stream = ws_manager.connect().await?;
        
        // Subscribe to pending transactions and new blocks
        WebSocketManager::subscribe_new_pending_transactions(&mut ws_stream).await?;
        WebSocketManager::subscribe_new_heads(&mut ws_stream).await?;
        
        info!("Connected to WebSocket for chain: {}", chain_id);
        
        let mut batch_buffer = Vec::new();
        
        loop {
            tokio::select! {
                Some(msg) = ws_stream.next() => {
                    match msg? {
                        Message::Text(text) => {
                            if let Err(e) = self.handle_message(chain_id, &text, &mut batch_buffer).await {
                                error!("Failed to handle message: {}", e);
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
                _ = tokio::time::sleep(Duration::from_millis(self.config.redis.batch_timeout_ms)) => {
                    if !batch_buffer.is_empty() {
                        self.flush_batch(&mut batch_buffer).await?;
                    }
                }
            }
        }
        
        Ok(())
    }
    
    async fn handle_message(
        &mut self,
        chain_id: &str,
        text: &str,
        batch_buffer: &mut Vec<crate::types::NormalizedTransaction>,
    ) -> Result<()> {
        let data: Value = serde_json::from_str(text)?;
        
        if let Some(params) = data.get("params") {
            if let Some(result) = params.get("result") {
                // Handle pending transaction
                if let Some(tx_hash) = result.get("hash").and_then(|v| v.as_str()) {
                    debug!("Received pending transaction: {}", tx_hash);
                    
                    let tx = crate::types::NormalizedTransaction {
                        tx_hash: tx_hash.to_string(),
                        from: result.get("from").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                        to: result.get("to").and_then(|v| v.as_str()).map(|s| s.to_string()),
                        value: result.get("value").and_then(|v| v.as_str()).unwrap_or("0").to_string(),
                        gas_used: String::new(),
                        gas_limit: result.get("gas").and_then(|v| v.as_str()).unwrap_or("0").to_string(),
                        gas_price: result.get("gasPrice").and_then(|v| v.as_str()).map(|s| s.to_string()),
                        timestamp: chrono::Utc::now(),
                        block_number: None,
                        transaction_index: None,
                        decoded_call: None,
                        logs: vec![],
                        status: false,
                        chain_id: chain_id.to_string(),
                        nonce: result.get("nonce").and_then(|v| v.as_u64()),
                        raw: Some(text.to_string()),
                    };
                    
                    batch_buffer.push(tx);
                    
                    self.update_metrics(|m| m.transactions_processed += 1).await;
                    
                    // Flush if batch is full
                    if batch_buffer.len() >= self.config.redis.batch_size {
                        self.flush_batch(batch_buffer).await?;
                    }
                    
                    return Ok(());
                }
                
                // Handle new block header
                if let Some(block_header) = result.as_object() {
                    if let Some(block_number_str) = block_header.get("number").and_then(|v| v.as_str()) {
                        if block_number_str.starts_with("0x") && block_number_str.len() > 2 {
                            if let Ok(block_number) = u64::from_str_radix(&block_number_str[2..], 16) {
                                debug!("Received new block: {} for chain {}", block_number, chain_id);
                                
                                self.update_metrics(|m| {
                                    m.last_processed_block = Some(block_number);
                                }).await;
                            }
                        }
                    }
                }
            }
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
