use anyhow::{anyhow, Result};
use ethabi::{Function, ParamType, Token};
use hex::FromHex;
use serde_json::Value;
use std::collections::HashMap;

use crate::types::{
    AvalancheLog, CallParameter, DecodedCall, NormalizedTransaction, TransactionLog,
};

pub struct TransactionNormalizer {
    // Known function signatures for common contracts
    function_signatures: HashMap<String, String>,
}

impl TransactionNormalizer {
    pub fn new() -> Self {
        let mut signatures = HashMap::new();

        // ERC-20 functions
        signatures.insert("0xa9059cbb".to_string(), "transfer".to_string());
        signatures.insert("0x095ea7b3".to_string(), "approve".to_string());
        signatures.insert("0x70a08231".to_string(), "balanceOf".to_string());
        signatures.insert("0x18160ddd".to_string(), "totalSupply".to_string());
        signatures.insert("0x23b872dd".to_string(), "transferFrom".to_string());

        // ERC-721 functions
        signatures.insert("0x42842e0e".to_string(), "safeTransferFrom".to_string());
        signatures.insert("0x6352211e".to_string(), "ownerOf".to_string());
        signatures.insert("0xb88d4fde".to_string(), "safeTransferFrom".to_string());

        // DeFi common functions
        signatures.insert(
            "0xe8e33700".to_string(),
            "swapExactTokensForTokens".to_string(),
        );
        signatures.insert(
            "0x38ed1739".to_string(),
            "swapExactTokensForETH".to_string(),
        );
        signatures.insert("0x18cbafe5".to_string(), "addLiquidityETH".to_string());
        signatures.insert("0x2e1a7d4d".to_string(), "withdraw".to_string());
        signatures.insert("0xd0e30db0".to_string(), "deposit".to_string());

        // Uniswap V3
        signatures.insert("0xc04b8d59".to_string(), "exactInputSingle".to_string());
        signatures.insert("0x414bf389".to_string(), "exactInput".to_string());

        Self {
            function_signatures: signatures,
        }
    }

    pub fn normalize_transaction(
        &self,
        tx_hash: String,
        from: String,
        to: Option<String>,
        value: String,
        gas_used: String,
        gas_limit: String,
        gas_price: Option<String>,
        input: String,
        block_number: u64,
        transaction_index: u32,
        logs: Vec<AvalancheLog>,
        status: bool,
    ) -> Result<NormalizedTransaction> {
        let timestamp = chrono::Utc::now();

        let decoded_call = self.decode_input(&input)?;

        let normalized_logs = logs
            .into_iter()
            .map(|log| TransactionLog {
                address: log.address,
                topics: log.topics,
                data: log.data,
                log_index: log.logIndex.parse::<u32>().unwrap_or(0),
            })
            .collect();

        Ok(NormalizedTransaction {
            tx_hash,
            from,
            to,
            value,
            gas_used,
            gas_limit,
            gas_price,
            timestamp,
            block_number,
            transaction_index,
            decoded_call,
            logs: normalized_logs,
            status,
        })
    }

    fn decode_input(&self, input: &str) -> Result<Option<DecodedCall>> {
        if input.len() < 10 || input == "0x" {
            return Ok(None);
        }

        let signature = &input[0..10];

        if let Some(function_name) = self.function_signatures.get(signature) {
            // Try to decode parameters using ethabi
            if let Ok(decoded) = self.decode_with_ethabi(input, function_name) {
                return Ok(Some(decoded));
            }
        }

        // Fallback: return basic info
        Ok(Some(DecodedCall {
            function_signature: signature.to_string(),
            function_name: format!("unknown_{signature}"),
            parameters: vec![CallParameter {
                name: "data".to_string(),
                value: input.to_string(),
                param_type: "bytes".to_string(),
            }],
        }))
    }

    fn decode_with_ethabi(&self, input: &str, function_name: &str) -> Result<DecodedCall> {
        // This is a simplified decoder
        // In production, you'd want to load actual ABI definitions

        let signature = &input[0..10];
        let data = &input[10..];

        let mut parameters = Vec::new();

        match function_name {
            "transfer" | "transferFrom" => {
                // address + uint256
                if data.len() >= 128 {
                    let address = format!("0x{}", &data[24..64]);
                    let amount = format!("0x{}", &data[64..128]);

                    parameters.push(CallParameter {
                        name: "to".to_string(),
                        value: address,
                        param_type: "address".to_string(),
                    });

                    parameters.push(CallParameter {
                        name: "amount".to_string(),
                        value: amount,
                        param_type: "uint256".to_string(),
                    });
                }
            }
            "approve" => {
                // address + uint256
                if data.len() >= 128 {
                    let spender = format!("0x{}", &data[24..64]);
                    let amount = format!("0x{}", &data[64..128]);

                    parameters.push(CallParameter {
                        name: "spender".to_string(),
                        value: spender,
                        param_type: "address".to_string(),
                    });

                    parameters.push(CallParameter {
                        name: "amount".to_string(),
                        value: amount,
                        param_type: "uint256".to_string(),
                    });
                }
            }
            _ => {
                // Generic decoding
                parameters.push(CallParameter {
                    name: "data".to_string(),
                    value: format!("0x{data}"),
                    param_type: "bytes".to_string(),
                });
            }
        }

        Ok(DecodedCall {
            function_signature: signature.to_string(),
            function_name: function_name.to_string(),
            parameters,
        })
    }
}
