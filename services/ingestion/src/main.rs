mod types;
mod config;
mod websocket_manager;
mod transaction_normalizer;
mod redis_producer;
mod metrics;
mod ingestion_service;
mod subnet_repository;

use anyhow::Result;
use clap::Parser;
use std::net::SocketAddr;
use tokio::signal;
use tokio::net::TcpListener;
use tracing::{error, info};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use crate::config::Config;
use crate::ingestion_service::IngestionService;
use crate::metrics::{create_metrics_router, MetricsState};

#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    #[arg(short, long)]
    config: Option<String>,
}

#[tokio::main]
async fn main() -> Result<()> {
    let args = Args::parse();
    
    // Load configuration
    let config = if let Some(config_path) = args.config {
        Config::from_file(&config_path)?
    } else {
        Config::from_env()?
    };
    
    // Initialize logging
    init_tracing(&config.general.log_level);
    
    info!("Starting ChainGuard Transaction Ingestion Service");
    
    // Create ingestion service
    let mut ingestion_service = IngestionService::new(config.clone())?;
    
    // Create metrics server
    let _metrics_state = MetricsState {
        metrics: ingestion_service.get_metrics(),
    };
    
    let metrics_router = create_metrics_router();
    let metrics_addr = SocketAddr::from(([0, 0, 0, 0], config.monitoring.metrics_port));
    
    // Spawn metrics server
    let metrics_handle = tokio::spawn(async move {
        let listener = TcpListener::bind(metrics_addr).await.unwrap();
        info!("Metrics server listening on {}", metrics_addr);
        axum::serve(listener, metrics_router.into_make_service())
            .await
    });
    
    // Spawn ingestion service
    let ingestion_handle = tokio::spawn(async move {
        if let Err(e) = ingestion_service.run().await {
            error!("Ingestion service failed: {}", e);
        }
    });
    
    // Wait for shutdown signal
    tokio::select! {
        _ = signal::ctrl_c() => {
            info!("Received Ctrl+C, shutting down...");
        }
        _ = ingestion_handle => {
            error!("Ingestion service stopped unexpectedly");
        }
        _ = metrics_handle => {
            error!("Metrics server stopped unexpectedly");
        }
    }
    
    info!("ChainGuard ingestion service stopped");
    Ok(())
}

fn init_tracing(log_level: &str) {
    let filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new(log_level));
    
    tracing_subscriber::registry()
        .with(filter)
        .with(tracing_subscriber::fmt::layer())
        .init();
}