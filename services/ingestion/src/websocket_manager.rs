use anyhow::{anyhow, Result};
use futures_util::{SinkExt, StreamExt};
use serde_json::{json, Value};
use std::time::Duration;
use tokio::time::{timeout, interval, sleep};
use tokio_tungstenite::{connect_async, tungstenite::Message, WebSocketStream};
use tracing::{debug, error, info, warn};

use crate::types::{AvalancheTransactionReceipt, AvalancheNewPendingTransaction};

pub struct WebSocketManager {
    url: String,
    fallback_urls: Vec<String>,
    current_url_index: usize,
    connection_timeout: Duration,
    ping_interval: Duration,
}

impl WebSocketManager {
    pub fn new(
        url: String,
        fallback_urls: Vec<String>,
        connection_timeout_ms: u64,
        ping_interval_sec: u64,
    ) -> Self {
        Self {
            url,
            fallback_urls,
            current_url_index: 0,
            connection_timeout: Duration::from_millis(connection_timeout_ms),
            ping_interval: Duration::from_secs(ping_interval_sec),
        }
    }
    
    pub async fn connect(&mut self) -> Result<WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>> {
        let max_retries = 5;
        let mut retry_count = 0;
        
        loop {
            let url = self.get_current_url();
            info!("Attempting to connect to {}", url);
            
            match timeout(self.connection_timeout, connect_async(&url)).await {
                Ok(Ok((ws_stream, _))) => {
                    info!("Successfully connected to {}", url);
                    return Ok(ws_stream);
                }
                Ok(Err(e)) => {
                    error!("Failed to connect to {}: {}", url, e);
                    self.try_next_url();
                }
                Err(_) => {
                    error!("Connection timeout to {}", url);
                    self.try_next_url();
                }
            }
            
            retry_count += 1;
            if retry_count >= max_retries {
                return Err(anyhow!("Max retries ({}) reached for WebSocket connection", max_retries));
            }
            
            let delay = Duration::from_millis(1000 * (2_u64.pow(retry_count.min(5) as u32)));
            info!("Retrying in {}ms...", delay.as_millis());
            sleep(delay).await;
        }
    }
    
    pub async fn subscribe_new_pending_transactions(
        ws_stream: &mut WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>,
    ) -> Result<()> {
        let subscription = json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "eth_subscribe",
            "params": ["newPendingTransactions"]
        });
        
        ws_stream.send(Message::Text(subscription.to_string())).await?;
        
        // Wait for subscription confirmation
        if let Some(msg) = ws_stream.next().await {
            match msg? {
                Message::Text(text) => {
                    let response: Value = serde_json::from_str(&text)?;
                    if let Some(result) = response.get("result") {
                        info!("Subscribed to new pending transactions: {}", result);
                        return Ok(());
                    }
                }
                _ => {}
            }
        }
        
        Err(anyhow!("Failed to subscribe to new pending transactions"))
    }
    
    pub async fn subscribe_new_heads(
        ws_stream: &mut WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>,
    ) -> Result<()> {
        let subscription = json!({
            "jsonrpc": "2.0",
            "id": 2,
            "method": "eth_subscribe",
            "params": ["newHeads"]
        });
        
        ws_stream.send(Message::Text(subscription.to_string())).await?;
        
        // Wait for subscription confirmation
        if let Some(msg) = ws_stream.next().await {
            match msg? {
                Message::Text(text) => {
                    let response: Value = serde_json::from_str(&text)?;
                    if let Some(result) = response.get("result") {
                        info!("Subscribed to new block headers: {}", result);
                        return Ok(());
                    }
                }
                _ => {}
            }
        }
        
        Err(anyhow!("Failed to subscribe to new block headers"))
    }
    
    pub async fn start_ping_task(
        mut ws_stream: WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>,
        ping_interval: Duration,
    ) -> Result<WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>> {
        let mut interval = interval(ping_interval);
        
        loop {
            tokio::select! {
                _ = interval.tick() => {
                    if let Err(e) = ws_stream.send(Message::Ping(vec![])).await {
                        error!("Failed to send ping: {}", e);
                        break;
                    }
                }
                msg = ws_stream.next() => {
                    match msg {
                        Some(Ok(Message::Pong(_))) => {
                            debug!("Received pong");
                        }
                        Some(Ok(Message::Close(_))) => {
                            warn!("WebSocket connection closed");
                            break;
                        }
                        Some(Ok(_)) => {}
                        Some(Err(e)) => {
                            error!("WebSocket error: {}", e);
                            break;
                        }
                        None => {
                            warn!("WebSocket stream ended");
                            break;
                        }
                    }
                }
            }
        }
        
        Ok(ws_stream)
    }
    
    fn get_current_url(&self) -> String {
        if self.current_url_index == 0 {
            self.url.clone()
        } else {
            self.fallback_urls[self.current_url_index - 1].clone()
        }
    }
    
    fn try_next_url(&mut self) {
        if self.current_url_index < self.fallback_urls.len() {
            self.current_url_index += 1;
        } else {
            self.current_url_index = 0; // Back to primary
        }
    }
}