use anyhow::Result;
use redis::{AsyncCommands, Client, Connection};
use serde_json::Value;
use std::time::Duration;
use tokio::time::timeout;
use tracing::{debug, error, info, warn};

use crate::types::NormalizedTransaction;

pub struct RedisProducer {
    client: Client,
    queue_name: String,
    batch_size: usize,
    batch_timeout: Duration,
}

impl RedisProducer {
    pub fn new(
        redis_url: &str,
        queue_name: String,
        batch_size: usize,
        batch_timeout_ms: u64,
    ) -> Result<Self> {
        let client = Client::open(redis_url)?;
        
        Ok(Self {
            client,
            queue_name,
            batch_size,
            batch_timeout: Duration::from_millis(batch_timeout_ms),
        })
    }
    
    pub async fn publish_transaction(&self, transaction: NormalizedTransaction) -> Result<()> {
        let mut conn = self.client.get_async_connection().await?;
        
        let json = serde_json::to_string(&transaction)?;
        
        // Use Redis List as a queue
        let _: () = conn.rpush(&self.queue_name, &json).await?;
        
        debug!("Published transaction {} to Redis queue", transaction.tx_hash);
        Ok(())
    }
    
    pub async fn publish_batch(&self, transactions: Vec<NormalizedTransaction>) -> Result<()> {
        if transactions.is_empty() {
            return Ok(());
        }
        
        let mut conn = self.client.get_async_connection().await?;
        
        // Use pipeline for batch operations
        let mut pipe = redis::pipe();
        
        for transaction in &transactions {
            let json = serde_json::to_string(transaction)?;
            pipe.rpush(&self.queue_name, json);
        }
        
        let _: () = pipe.query_async(&mut conn).await?;
        
        info!("Published {} transactions in batch", transactions.len());
        Ok(())
    }
    
    pub async fn health_check(&self) -> Result<bool> {
        let mut conn = self.client.get_async_connection().await?;
        
        let _: String = conn.ping().await?;
        Ok(true)
    }
    
    pub async fn get_queue_length(&self) -> Result<u64> {
        let mut conn = self.client.get_async_connection().await?;
        
        let length: u64 = conn.llen(&self.queue_name).await?;
        Ok(length)
    }
}