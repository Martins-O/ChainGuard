# 🛡️ ChainGuard AI

<p align="center">
  <img src="https://img.shields.io/badge/Avalanche-Network-blue?style=for-the-badge&logo=avalanche" alt="Avalanche">
  <img src="https://img.shields.io/badge/Python-3.10+-green?style=for-the-badge&logo=python" alt="Python">
  <img src="https://img.shields.io/badge/Rust-1.70+-orange?style=for-the-badge&logo=rust" alt="Rust">
  <img src="https://img.shields.io/badge/React-18-blue?style=for-the-badge&logo=react" alt="React">
  <img src="https://img.shields.io/badge/MongoDB-Latest-green?style=for-the-badge&logo=mongodb" alt="MongoDB">
</p>

<p align="center">
  <b>Real-time AI-powered security monitoring platform for Avalanche subnets</b>
</p>

---

## 🚀 Overview

ChainGuard AI provides comprehensive security monitoring for Avalanche blockchain networks through:

- **Real-time Transaction Ingestion** (Rust) - High-performance WebSocket connections
- **AI Threat Analysis** (Python) - Multi-model security analysis  
- **Intelligent Alerting** (Node.js) - Smart notification routing
- **RESTful API** (Node.js) - Complete management interface
- **Web Dashboard** (React) - User-friendly interface

---

## 🏗️ System Architecture

```mermaid
flowchart TB
    subgraph Avalanche["🌐 Avalanche Network"]
        RPC[("RPC Endpoints")]
        WS[("WebSocket")]
    end

    subgraph Ingestion["📥 Ingestion Service (Rust)"]
        WSM[WebSocket Manager]
        TN[Transaction Normalizer]
        RP[Redis Producer]
    end

    subgraph AI["🧠 AI Engine (Python)"]
        QP[Queue Processor]
        SD[Signature Detection]
        AD[Anomaly Detection]
        BA[Behavioral Analysis]
    end

    subgraph Alert["🚨 Alert Service (Node.js)"]
        AP[Alert Processor]
        NC[Notification Channels]
    end

    subgraph Storage["💾 Data Layer"]
        Redis[(Redis Queue)]
        Mongo[(MongoDB)]
    end

    subgraph API["🌐 API Server (Node.js)"]
        Auth[JWT Auth]
        CRUD[CRUD Operations]
    end

    subgraph UI["🎨 Frontend (React)"]
        Dash[Dashboard]
        Subs[Subnet Manager]
        Alrt[Alert View]
    end

    RPC --> WSM
    WS --> WSM
    WSM --> TN
    TN --> RP
    RP --> Redis
    Redis --> QP
    QP --> SD
    QP --> AD
    QP --> BA
    SD --> Mongo
    AD --> Mongo
    BA --> Mongo
    Mongo --> AP
    AP --> NC
    NC --> Slack[("Slack")]
    NC --> Email[("Email")]
    NC --> SMS[("SMS")]
    Mongo <--> Auth
    Auth <--> CRUD
    CRUD --> Dash
    CRUD --> Subs
    Mongo --> Alrt
```

---

## 🔄 Data Flow Pipeline

```mermaid
sequenceDiagram
    participant Avalanche
    participant Ingestion
    participant Redis
    participant AI
    participant MongoDB
    participant Alert
    participant User

    Note over Ingestion,MongoDB: 1. Transaction Ingestion
    Avalanche->>Ingestion: New Transaction (WebSocket)
    Ingestion->>Ingestion: Normalize Transaction
    Ingestion->>Redis: Publish to Queue

    Note over Redis,AI: 2. Queue Processing  
    Redis->>AI: Pop Transaction
    AI->>AI: Extract Features (26 features)
    AI->>AI: Run ML Models
    
    Note over AI,MongoDB: 3. Analysis & Storage
    AI->>MongoDB: Save Threat Analysis
    
    alt Threat Score >= 70
        AI->>Alert: Trigger Alert
        Alert->>MongoDB: Create Alert
        Alert->>User: Send Notification
    end

    Note over User,MongoDB: 4. Dashboard View
    User->>API: Request Data
    API->>MongoDB: Query
    MongoDB-->>API: Results
    API-->>User: Display
```

---

## ⚡ Features

### 🔍 Real-time Monitoring
- High-throughput transaction ingestion (5k-10k TPS)
- WebSocket connections to Avalanche validators
- Automatic reconnection with exponential backoff
- Configurable batch processing

### 🧠 AI-Powered Threat Detection
| Model | Description |
|-------|-------------|
| **Signature Detection** | Known exploit pattern recognition (DNN) |
| **Anomaly Detection** | Statistical outlier identification (Ensemble) |
| **Behavioral Analysis** | Transaction sequence analysis (LSTM) |

Combined threat scoring: **0-100 scale**

### 🚨 Intelligent Alerting
- **Multi-channel**: Slack, Discord, Email, SMS
- **Severity routing**: CRITICAL → All, HIGH → Email+Slack, etc.
- Alert acknowledgment and false-positive marking

### 📊 Dashboard
- Real-time monitoring dashboard
- Subnet management (CRUD)
- Transaction browsing and filtering
- Alert management and statistics

---

## 🖥️ Services

| Service | Technology | Port | Purpose |
|---------|------------|------|---------|
| `api-server` | Node.js/Express | 3000 | REST API, JWT auth, subnet management |
| `ai-engine` | Python/FastAPI | 8000 | Multi-model threat analysis |
| `alert-service` | Node.js | 3001 | Notification routing |
| `ingestion` | Rust | 9000 | WebSocket transaction ingestion |
| `frontend` | React/Vite | 5173 | Web dashboard |

---

## 🚀 Quick Start

### Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Docker | 20.10+ | Container orchestration |
| Node.js | 18+ | API & Alert Service |
| Python | 3.10+ | AI Engine |
| Rust | 1.70+ | Ingestion Service |

### Using Docker Compose

```bash
# Clone and start
git clone https://github.com/your-repo/ChainGuard.git
cd ChainGuard
docker-compose up -d
```

### Manual Setup

```bash
# Start databases
docker-compose up -d mongodb redis

# API Server
cd services/api-server && npm install && npm run dev

# AI Engine  
cd services/ai-engine && pip install -r requirements.txt && uvicorn main:app --reload

# Alert Service
cd services/alert-service && npm install && npm run dev

# Ingestion (Rust)
cd services/ingestion && cargo build && cargo run

# Frontend
cd frontend && npm install && npm run dev
```

---

## 📡 API Endpoints

### Authentication
```http
POST /auth/login          # User login
POST /auth/register      # User registration
POST /auth/verify        # Token verification
```

### Subnets
```http
GET    /subnets                  # List all subnets
POST   /subnets                  # Create subnet (admin)
GET    /subnets/:id              # Get subnet details
PATCH  /subnets/:id              # Update subnet (admin)
DELETE /subnets/:id              # Delete subnet (admin)
```

### Transactions
```http
GET /subnets/:id/transactions   # Get subnet transactions
GET /transactions/:hash          # Get transaction by hash
```

### Alerts
```http
GET    /subnets/:id/alerts       # Get subnet alerts
PATCH  /alerts/:id/acknowledge   # Acknowledge alert
POST   /alerts/:id/false-positive # Mark false positive
```

---

## 🔧 Configuration

### Environment Variables

```bash
# Database
MONGODB_URL=mongodb://user:pass@host:27017/chainguard
REDIS_URL=redis://host:6379

# Security
JWT_SECRET=your-secret-key

# AI Engine
THREAT_THRESHOLD=70

# Notifications (optional)
SLACK_WEBHOOK_URL=
DISCORD_WEBHOOK_URL=
SENDGRID_API_KEY=
TWILIO_ACCOUNT_SID=
```

### Adding a Subnet

```bash
curl -X POST http://localhost:3000/subnets \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Avalanche C-Chain",
    "chainId": "43114",
    "rpcUrl": "https://api.avax.network/ext/bc/C/rpc",
    "websocketUrl": "wss://api.avax.network/ext/bc/C/ws"
  }'
```

---

## 📊 Monitoring

```mermaid
flowchart LR
    subgraph Metrics["📈 Exposed Metrics"]
        TP[Transactions/sec]
        AS[Alert Score]
        QR[Queue Rate]
    end
    
    subgraph Tools["🔍 Monitoring Tools"]
        Prom[Prometheus]
        Graf[Grafana]
    end
    
    TP --> Prom
    AS --> Prom
    QR --> Prom
    Prom --> Graf
```

All services expose Prometheus metrics at `/metrics`:
- Transaction ingestion rates
- AI model performance
- Alert generation rates
- System resource usage

---

## 🔒 Security

- **JWT Authentication** - Secure API access
- **Rate Limiting** - Prevent API abuse  
- **Input Validation** - Comprehensive request validation
- **Helmet.js** - HTTP security headers
- **CORS** - Cross-origin resource sharing

---

## 📁 Project Structure

```
ChainGuard/
├── services/
│   ├── api-server/          # REST API (Node.js)
│   ├── ai-engine/           # AI Analysis (Python)
│   ├── alert-service/       # Notifications (Node.js)
│   └── ingestion/           # Transaction Ingestion (Rust)
├── frontend/                # Web Dashboard (React)
├── database/                # MongoDB setup
├── configs/                 # Configuration files
├── docker-compose.yml       # Container orchestration
└── render.yaml             # Render.com deployment
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

---

## 📄 License

MIT License - See [LICENSE](LICENSE) for details.

---

<p align="center">
  <b>🛡️ Built with ❤️ for Avalanche Security</b>
</p>
