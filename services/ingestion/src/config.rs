use anyhow::Result;
use serde::Deserialize;
use std::collections::HashMap;
use std::time::Duration;
use tokio::time::sleep;
use tracing::{error, info, warn};

#[derive(Debug, Deserialize)]
pub struct GeneralConfig {
    pub log_level: String,
    pub max_retries: u32,
    pub retry_delay_ms: u64,
}

#[derive(Debug, Deserialize)]
pub struct AvalancheConfig {
    pub websocket_url: String,
    pub fallback_urls: Vec<String>,
    pub connection_timeout_ms: u64,
    pub ping_interval_sec: u64,
}

#[derive(Debug, Deserialize)]
pub struct RedisConfig {
    pub url: String,
    pub connection_pool_size: u32,
    pub queue_name: String,
    pub batch_size: usize,
    pub batch_timeout_ms: u64,
}

#[derive(Debug, Deserialize)]
pub struct MonitoringConfig {
    pub metrics_port: u16,
    pub health_check_interval_sec: u64,
}

#[derive(Debug, Deserialize)]
pub struct Config {
    pub general: GeneralConfig,
    pub avalanche: AvalancheConfig,
    pub redis: RedisConfig,
    pub monitoring: MonitoringConfig,
}

impl Config {
    pub fn from_file(file_path: &str) -> Result<Self> {
        let content = std::fs::read_to_string(file_path)?;
        let config: Config = toml::from_str(&content)?;
        Ok(config)
    }

    pub fn from_env() -> Result<Self> {
        Ok(Config {
            general: GeneralConfig {
                log_level: std::env::var("LOG_LEVEL").unwrap_or_else(|_| "info".to_string()),
                max_retries: std::env::var("MAX_RETRIES")
                    .ok()
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(5),
                retry_delay_ms: std::env::var("RETRY_DELAY_MS")
                    .ok()
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(1000),
            },
            avalanche: AvalancheConfig {
                websocket_url: std::env::var("AVALANCHE_WS_URL")
                    .unwrap_or_else(|_| "wss://api.avax.network/ext/bc/C/ws".to_string()),
                fallback_urls: std::env::var("FALLBACK_WS_URLS")
                    .unwrap_or_else(|_| "wss://avalanche-c-chain.publicnode.com/ws,wss://avax.public-rpc.com/ext/bc/C/ws".to_string())
                    .split(',')
                    .map(|s| s.trim().to_string())
                    .collect(),
                connection_timeout_ms: std::env::var("CONNECTION_TIMEOUT_MS")
                    .ok()
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(5000),
                ping_interval_sec: std::env::var("PING_INTERVAL_SEC")
                    .ok()
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(30),
            },
            redis: RedisConfig {
                url: std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://localhost:6379".to_string()),
                connection_pool_size: std::env::var("REDIS_POOL_SIZE")
                    .ok()
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(10),
                queue_name: std::env::var("REDIS_QUEUE_NAME")
                    .unwrap_or_else(|_| "transactions".to_string()),
                batch_size: std::env::var("BATCH_SIZE")
                    .ok()
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(100),
                batch_timeout_ms: std::env::var("BATCH_TIMEOUT_MS")
                    .ok()
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(1000),
            },
            monitoring: MonitoringConfig {
                metrics_port: std::env::var("METRICS_PORT")
                    .ok()
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(9000),
                health_check_interval_sec: std::env::var("HEALTH_CHECK_INTERVAL_SEC")
                    .ok()
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(30),
            },
        })
    }
}
