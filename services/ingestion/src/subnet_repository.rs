use anyhow::Result;
use mongodb::{Client, Collection};
use mongodb::bson::Document;
use serde::{Deserialize, Serialize};
use futures_util::TryStreamExt;
use tracing::info;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Subnet {
    pub id: String,
    pub name: String,
    pub chain_id: String,
    pub rpc_url: String,
    pub websocket_url: String,
    pub is_active: bool,
    pub monitoring_enabled: bool,
}

pub async fn fetch_subnets(connection_string: &str, database_name: &str) -> Result<Vec<Subnet>> {
    let client = Client::with_uri_str(connection_string).await?;
    let db = client.database(database_name);
    let collection: Collection<Document> = db.collection("subnets");
    
    info!("Connected to MongoDB: {}/{}", database_name, "subnets");
    
    let filter = mongodb::bson::doc! {
        "isActive": true,
        "monitoringEnabled": true
    };
    
    let cursor = collection.find(filter, None).await?;
    let mut subnets = Vec::new();
    
    // Collect all documents
    let docs: Vec<Document> = cursor.try_collect().await?;
    
    for doc in docs {
        let subnet = Subnet {
            id: doc.get("_id")
                .and_then(|v| v.as_object_id())
                .map(|id| id.to_string())
                .unwrap_or_default(),
            name: doc.get("name")
                .and_then(|v| v.as_str())
                .unwrap_or("Unknown")
                .to_string(),
            chain_id: doc.get("chainId")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            rpc_url: doc.get("rpcUrl")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            websocket_url: doc.get("websocketUrl")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            is_active: doc.get("isActive")
                .and_then(|v| v.as_bool())
                .unwrap_or(false),
            monitoring_enabled: doc.get("monitoringEnabled")
                .and_then(|v| v.as_bool())
                .unwrap_or(false),
        };
        
        subnets.push(subnet);
    }
    
    info!("Found {} active subnets", subnets.len());
    
    Ok(subnets)
}
