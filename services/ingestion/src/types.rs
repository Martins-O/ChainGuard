use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NormalizedTransaction {
    pub tx_hash: String,
    pub from: String,
    pub to: Option<String>,
    pub value: String,
    pub gas_used: String,
    pub gas_limit: String,
    pub gas_price: Option<String>,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub block_number: u64,
    pub transaction_index: u32,
    pub decoded_call: Option<DecodedCall>,
    pub logs: Vec<TransactionLog>,
    pub status: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecodedCall {
    pub function_signature: String,
    pub function_name: String,
    pub parameters: Vec<CallParameter>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CallParameter {
    pub name: String,
    pub value: String,
    pub param_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransactionLog {
    pub address: String,
    pub topics: Vec<String>,
    pub data: String,
    pub log_index: u32,
}

#[derive(Debug, Deserialize)]
pub struct AvalancheNewPendingTransaction {
    pub hash: String,
    pub from: String,
    pub to: Option<String>,
    pub value: String,
    pub gas: String,
    pub gasPrice: String,
    pub input: String,
    pub nonce: String,
}

#[derive(Debug, Deserialize)]
pub struct AvalancheTransactionReceipt {
    pub transactionHash: String,
    pub blockNumber: String,
    pub transactionIndex: String,
    pub from: String,
    pub to: Option<String>,
    pub gasUsed: String,
    pub cumulativeGasUsed: String,
    pub effectiveGasPrice: String,
    pub contractAddress: Option<String>,
    pub logs: Vec<AvalancheLog>,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AvalancheLog {
    pub address: String,
    pub topics: Vec<String>,
    pub data: String,
    pub logIndex: String,
}
