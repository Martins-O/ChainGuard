# ChainGuard AI Engine

## Overview
AI-powered security analysis engine that analyzes Avalanche subnet transactions for potential threats using multiple ML models.

## Models

### 1. Signature Detection Model
- **Purpose**: Identify known exploit patterns
- **Technology**: Rule-based classifier (can be extended with DNN)
- **Patterns detected**:
  - Reentrancy attacks
  - Flash loan exploits
  - Oracle manipulation
  - Access control bypass
  - Honeypot patterns

### 2. Anomaly Detection Model
- **Purpose**: Detect unusual transaction patterns
- **Technology**: Isolation Forest + StandardScaler
- **Features**: Transaction value, gas usage, input data length, log count, etc.

### 3. Behavioral Sequence Model
- **Purpose**: Analyze transaction sequences and user behavior
- **Technology**: Rule-based behavioral analysis
- **Features**: Transaction frequency, value patterns, new function calls

## API Endpoints

### POST /analyze
Analyze a transaction for security threats.

**Request:**
```json
{
  "transaction": {
    "tx_hash": "0x...",
    "from_address": "0x...",
    "to_address": "0x...",
    "value": "1000000000000000000",
    "gas_used": "21000",
    "gas_limit": "21000",
    "gas_price": "25000000000",
    "timestamp": "2024-01-01T12:00:00Z",
    "block_number": 12345,
    "transaction_index": 0,
    "decoded_call": {...},
    "logs": [...],
    "status": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "analysis": {
    "tx_hash": "0x...",
    "model_scores": {
      "signature_detection": 75.0,
      "anomaly_detection": 30.0,
      "behavioral_sequence": 45.0
    },
    "final_score": 52.5,
    "threat_level": "MEDIUM",
    "explanation": "Transaction matches known exploit patterns; High value transaction: 1.00 AVAX"
  }
}
```

### GET /analysis/{tx_hash}
Retrieve existing analysis for a transaction.

### GET /health
Health check endpoint.

### GET /metrics
Basic metrics and queue information.

## Scoring

- **Final Score**: Weighted combination of all models (0-100)
  - Signature Detection: 40%
  - Anomaly Detection: 30%
  - Behavioral Sequence: 30%

- **Threat Levels**:
  - CRITICAL: 90+
  - HIGH: 70-89
  - MEDIUM: 40-69
  - LOW: 0-39

## Configuration

Environment variables:
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `THREAT_THRESHOLD`: Score threshold for triggering alerts (default: 70)
- `MODEL_PATH`: Path to pre-trained models

## Development

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Set environment variables:
```bash
export DATABASE_URL="postgresql://..."
export REDIS_URL="redis://localhost:6379"
```

3. Run the service:
```bash
python main.py
```