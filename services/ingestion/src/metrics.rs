use anyhow::Result;
use prometheus::{Encoder, TextEncoder};
use serde_json::json;
use std::sync::Arc;
use tokio::sync::RwLock;
use axum::{
    extract::State,
    http::{HeaderValue, Method, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
    Router,
};
use tower_http::cors::{Any, CorsLayer};

#[derive(Clone)]
pub struct MetricsState {
    pub metrics: Arc<RwLock<Metrics>>,
}

#[derive(Default)]
pub struct Metrics {
    pub transactions_processed: u64,
    pub transactions_failed: u64,
    pub websocket_reconnections: u64,
    pub redis_publishes: u64,
    pub redis_publish_failures: u64,
    pub last_processed_block: Option<u64>,
    pub processing_rate_fpm: f64, // frames per minute
}

pub fn create_metrics_router() -> Router {
    let metrics_state = MetricsState {
        metrics: Arc::new(RwLock::new(Metrics::default())),
    };
    
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST])
        .allow_headers(Any);
    
    Router::new()
        .route("/metrics", get(metrics_handler))
        .route("/health", get(health_handler))
        .layer(cors)
        .with_state(metrics_state)
}

pub async fn metrics_handler(State(state): State<MetricsState>) -> Response {
    let metrics = state.metrics.read().await;
    
    let mut prometheus_metrics = prometheus::Registry::new();
    
    let counter = prometheus::CounterVec::new(
        prometheus::Opts::new("chainguard_transactions_total", "Total transactions processed"),
        &["status"]
    ).unwrap();
    
    counter.with_label_values(&["processed"]).inc_by(metrics.transactions_processed as f64);
    counter.with_label_values(&["failed"]).inc_by(metrics.transactions_failed as f64);
    
    let reconnection_counter = prometheus::Counter::new(
        "chainguard_websocket_reconnections_total",
        "Total WebSocket reconnections"
    ).unwrap();
    reconnection_counter.inc_by(metrics.websocket_reconnections as f64);
    
    let redis_counter = prometheus::CounterVec::new(
        prometheus::Opts::new("chainguard_redis_publishes_total", "Total Redis publishes"),
        &["status"]
    ).unwrap();
    
    redis_counter.with_label_values(&["success"]).inc_by(metrics.redis_publishes as f64);
    redis_counter.with_label_values(&["failed"]).inc_by(metrics.redis_publish_failures as f64);
    
    let gauge = prometheus::Gauge::new(
        "chainguard_last_processed_block",
        "Last processed block number"
    ).unwrap();
    
    if let Some(block) = metrics.last_processed_block {
        gauge.set(block as f64);
    }
    
    prometheus_metrics.register(Box::new(counter)).unwrap();
    prometheus_metrics.register(Box::new(reconnection_counter)).unwrap();
    prometheus_metrics.register(Box::new(redis_counter)).unwrap();
    prometheus_metrics.register(Box::new(gauge)).unwrap();
    
    let encoder = TextEncoder::new();
    let metric_families = prometheus_metrics.gather();
    let mut buffer = vec![];
    encoder.encode(&metric_families, &mut buffer).unwrap();
    
    Response::builder()
        .status(StatusCode::OK)
        .header("Content-Type", encoder.format_type())
        .body(buffer.into())
        .unwrap()
}

pub async fn health_handler(State(state): State<MetricsState>) -> Response {
    let metrics = state.metrics.read().await;
    
    let health = json!({
        "status": "healthy",
        "timestamp": chrono::Utc::now().to_rfc3339(),
        "metrics": {
            "transactions_processed": metrics.transactions_processed,
            "transactions_failed": metrics.transactions_failed,
            "websocket_reconnections": metrics.websocket_reconnections,
            "redis_publishes": metrics.redis_publishes,
            "redis_publish_failures": metrics.redis_publish_failures,
            "last_processed_block": metrics.last_processed_block,
            "processing_rate_fpm": metrics.processing_rate_fpm
        }
    });
    
    Response::builder()
        .status(StatusCode::OK)
        .header("Content-Type", "application/json")
        .body(health.to_string().into())
        .unwrap()
}