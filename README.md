# 🛡️ ChainGuard AI

A real-time AI-powered security monitoring platform for Avalanche subnets that detects and alerts on potential threats using advanced machine learning models.

## 🎯 Overview

ChainGuard AI provides comprehensive security monitoring for Avalanche blockchain networks through:

- **Real-time Transaction Ingestion** (Rust) - High-performance WebSocket connections
- **AI Threat Analysis** (Python) - Multi-model security analysis  
- **Intelligent Alerting** (Node.js) - Smart notification routing
- **RESTful API** (Node.js) - Complete management interface
- **MongoDB Database** - Flexible and scalable data persistence

## 🏗️ Architecture

┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Avalanche      │    │                  │    │                 │
│  Subnet RPC/Web │────│ Rust Ingestion   │────│   Redis Queue   │
│  Sockets        │    │ Service          │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │                        │
                              ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│                 │────│   AI Engine     │────│                 │
│   MongoDB       │    │   (Python)      │    │ Alert Service  │
│   Database      │────│                  │────│  (Node.js)     │
│                 │    │  • Signature    │    │  • Slack       │
│                 │    │  • Anomaly      │    │  • Email       │
│                 │    │  • Behavioral  │    │  • SMS         │
└─────────────────┘    │  • Anomaly      │    │  • Email       │
                              │  • Behavioral  │    │  • SMS         │
                              └──────────────────┘    └─────────────────┘
                                      │                        │
                                      ▼                        ▼
                              ┌──────────────────┐    ┌─────────────────┐
                              │                 │    │                 │
                              │   API Server    │────│  Web Dashboard │
                              │  (Node.js)      │    │  (Vite/React)   │
                              │                 │    │                 │
                              └──────────────────┘    └─────────────────┘

## ⚡ Features

### 🔍 Real-time Monitoring
- High-throughput transaction ingestion (5k-10k TPS)
- WebSocket connections to Avalanche validators
- Automatic reconnection with exponential backoff
- Configurable batch processing

### 🧠 AI-Powered Threat Detection
- **Signature Detection**: Known exploit pattern recognition
- **Anomaly Detection**: Statistical outlier identification
- **Behavioral Analysis**: Transaction sequence analysis
- Combined threat scoring (0-100 scale)

### 🚨 Intelligent Alerting
- Multi-channel notifications (Slack, Discord, Email, SMS)
- Severity-based routing (CRITICAL → All, HIGH → Email+Slack, etc.)
- Duplicate alert prevention
- Alert acknowledgment and false-positive marking

### 📊 Comprehensive API
- Subnet management (CRUD operations)
- Transaction querying and filtering
- Alert management and statistics
- User authentication and authorization
- RESTful design with pagination

### 🗄️ Scalable Database
- **MongoDB** for flexible document storage (Users, subnets, transactions, alerts)
- Comprehensive indexing strategy
- Automated collection and index creation

## 🚀 Quick Start

### Prerequisites

Before starting, ensure you have the following installed:

- **Docker** (20.10+) and **Docker Compose** (2.0+)
- **Node.js** (18+) and **npm** (9+)
- **Python** (3.10+) with `pip` and `venv`
- **Rust** (1.70+) with `cargo` (for ingestion service)
- **Git**
- **4GB+ RAM** (for all services)
- **10GB+ free disk space**

Verify installations:
```bash
docker --version
docker-compose --version
node --version
python3 --version
cargo --version
```

### Complete Setup Guide

#### Step 1: Clone and Navigate

```bash
# Clone the repository
git clone <repository-url>
cd ChainGuard
```

#### Step 2: Environment Configuration

Create a `.env` file in the project root (or use the one created by `start-all.sh`):

```bash
# If .env doesn't exist, create it
cat > .env << 'EOF'
# Database Connection
MONGODB_URL=mongodb://chainguard:chainguard_password@localhost:27018/chainguard?authSource=admin
REDIS_URL=redis://localhost:6379

# JWT Secret (CHANGE IN PRODUCTION!)
JWT_SECRET=chainguard_dev_secret_change_in_production

# AI Engine Configuration
THREAT_THRESHOLD=70
MODEL_PATH=./models

# Service Ports
API_PORT=3000
AI_ENGINE_PORT=8000
ALERT_SERVICE_PORT=3001
INGESTION_PORT=9000

# Optional: Notification Services (leave empty if not using)
SLACK_WEBHOOK_URL=
DISCORD_WEBHOOK_URL=
SENDGRID_API_KEY=
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
ALERT_EMAIL_RECIPIENTS=
SMS_RECIPIENTS=
EMAIL_FROM=
EOF
```

#### Step 3: Start All Backend Services

**Option A: Using the Helper Script (Recommended)**

The `start-all.sh` script automates the entire setup:

```bash
# Make script executable
chmod +x start-all.sh

# Start all services
./start-all.sh
```

This script will:
1. Check prerequisites
2. Create `.env` if missing
3. Start databases (MongoDB, Redis) via Docker
4. Initialize MongoDB indexes
5. Install dependencies for all services
6. Start API Server, AI Engine, and Alert Service
7. Verify all services are running

**Option B: Using Docker Compose (All Services)**

```bash
# Start all services with Docker Compose
docker-compose up -d

# Or start only core services first
docker-compose up -d mongodb redis

# Wait for databases to be ready (30 seconds)
sleep 30

# Start application services
docker-compose up -d api-server ai-engine alert-service
```

**Option C: Manual Service-by-Service Setup**

1. **Start Databases:**
```bash
docker-compose up -d mongodb redis
```

2. **Wait for databases to initialize:**
```bash
# Check MongoDB
docker-compose exec mongodb mongosh --eval "db.adminCommand('ping')"

# Check Redis
docker-compose exec redis redis-cli ping
```

3. **Install and Start API Server:**
```bash
cd services/api-server
npm install
npm run dev
# Runs on http://localhost:3000
```

4. **Install and Start AI Engine:**
```bash
cd services/ai-engine
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
# Runs on http://localhost:8000
```

5. **Install and Start Alert Service:**
```bash
cd services/alert-service
npm install
npm run dev
# Runs on http://localhost:3001
```

#### Step 4: Start Frontend Dashboard

In a new terminal:

```bash
cd frontend

# Install dependencies (first time only)
npm install

# Create .env file for frontend
echo "VITE_API_URL=http://localhost:3000" > .env

# Start development server
npm run dev
```

The frontend will be available at `http://localhost:5173`

#### Step 5: Start Ingestion Service (Optional)

The Rust ingestion service connects to Avalanche networks:

```bash
cd services/ingestion

# Install Rust dependencies (first time only)
cargo build

# Run the service
cargo run

# Or run in release mode for better performance
cargo run --release
```

The ingestion service will be available at `http://localhost:9000`

#### Step 6: Verify All Services

Check that all services are running:

```bash
# Check Docker containers
docker-compose ps

# Check service health endpoints
curl http://localhost:3000/health  # API Server
curl http://localhost:8000/health  # AI Engine
curl http://localhost:3001/health  # Alert Service
curl http://localhost:9000/health  # Ingestion Service
```

Expected output: All services should return `{"status": "healthy"}` or similar.

### Service URLs

Once all services are running, access them at:

- 🌐 **API Server**: `http://localhost:3000`
  - Health: `http://localhost:3000/health`
  - API Info: `http://localhost:3000/`
  
- 🧠 **AI Engine**: `http://localhost:8000`
  - Health: `http://localhost:8000/health`
  - API Docs: `http://localhost:8000/docs`
  - Metrics: `http://localhost:8000/metrics`
  
- 🚨 **Alert Service**: `http://localhost:3001`
  - Health: `http://localhost:3001/health`
  - Stats: `http://localhost:3001/stats`
  
- 📊 **Ingestion Service**: `http://localhost:9000`
  - Health: `http://localhost:9000/health`
  - Metrics: `http://localhost:9000/metrics`
  
- 🎨 **Frontend Dashboard**: `http://localhost:5173`
  - Login: `http://localhost:5173/login`
  - Dashboard: `http://localhost:5173/dashboard`

- 🗄️ **Databases**:
  - PostgreSQL: `localhost:5432`
  - MongoDB: `localhost:27018`
  - Redis: `localhost:6379`
  - Mongo Express (if monitoring profile): `http://localhost:8081`
  - Swagger UI: `http://localhost:3000/api-docs`

### Default Login Credentials

- **Username**: `admin`
- **Password**: `admin123`

⚠️ **SECURITY WARNING**: Change the default password immediately after first login!

### Stopping Services

**If using start-all.sh:**
```bash
./stop-all.sh
```

**If using Docker Compose:**
```bash
# Stop all services
docker-compose down

# Stop and remove volumes (WARNING: deletes data)
docker-compose down -v
```

**If running services manually:**
- Press `Ctrl+C` in each terminal
- Or find and kill processes:
```bash
lsof -ti:3000 | xargs kill -9  # API Server
lsof -ti:8000 | xargs kill -9  # AI Engine
lsof -ti:3001 | xargs kill -9  # Alert Service
lsof -ti:9000 | xargs kill -9  # Ingestion Service
lsof -ti:5173 | xargs kill -9  # Frontend
```

## 📋 Service Details

### 1️⃣ Rust Transaction Ingestion
- **Port**: 9000
- **Features**: WebSocket connections, transaction normalization, Redis queuing
- **Metrics**: `/metrics`, `/health`

### 2️⃣ AI Analysis Engine  
- **Port**: 8000
- **Features**: Multi-model threat analysis, FastAPI endpoints
- **Docs**: `http://localhost:8000/docs`

### 3️⃣ Alert Management Service
- **Port**: 3001  
- **Features**: Notification routing, alert deduplication
- **Endpoints**: `/health`, `/stats`, `/test-notification`

### 4️⃣ API Server
- **Port**: 3000
- **Features**: REST API, JWT auth, subnet management
- **Docs**: Built-in OpenAPI documentation

### 5️⃣ MongoDB Database
- **Port**: 27018 (remapped from 27017 to avoid conflicts)
- **Features**: Document storage for users, subnets, and alerts
- **Connection**: `mongodb://chainguard:chainguard_password@localhost:27018/chainguard?authSource=admin`

### 6️⃣ Frontend Dashboard
- **Port**: 5173 (default Vite port)
- **Features**: Real-time dashboard, user management
- **Tech Stack**: React, Vite, TailwindCSS

## 🔧 Configuration

### Environment Variables

Key configuration options in `.env`:

```bash
# Database
MONGODB_URL=mongodb://chainguard:chainguard_password@localhost:27018/chainguard?authSource=admin

# AI Engine
THREAT_THRESHOLD=70          # Alert trigger threshold
MODEL_PATH=./models           # ML model storage

# Notifications
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
SENDGRID_API_KEY=SG.your_key
TWILIO_ACCOUNT_SID=your_sid

# Security
JWT_SECRET=your_super_secret_key
```

### Avalanche Subnet Configuration

```bash
# Mainnet C-Chain
AVALANCHE_WS_URL=wss://api.avax.network/ext/bc/C/ws
AVALANCHE_RPC_URL=https://api.avax.network/ext/bc/C/rpc

# Testnet
TEST_WS_URL=wss://api.avax-test.network/ext/bc/C/ws
TEST_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
```

## 📖 API Usage

### Authentication

```bash
# Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Get JWT token from response and use:
curl -X GET http://localhost:3000/subnets \
  -H "Authorization: Bearer <your_jwt_token>"
```

### Subnet Management

```bash
# Create subnet
curl -X POST http://localhost:3000/subnets \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Avalanche C-Chain",
    "chainId": "43114",
    "rpcUrl": "https://api.avax.network/ext/bc/C/rpc",
    "websocketUrl": "wss://api.avax.network/ext/bc/C/ws"
  }'

# Get transactions
curl -X GET "http://localhost:3000/subnets/1/transactions?limit=50&status=true" \
  -H "Authorization: Bearer <token>"

# Get alerts
curl -X GET "http://localhost:3000/subnets/1/alerts?threatLevel=CRITICAL" \
  -H "Authorization: Bearer <token>"
```

### AI Analysis

```bash
# Analyze transaction
curl -X POST http://localhost:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "transaction": {
      "tx_hash": "0x...",
      "from_address": "0x...",
      "to_address": "0x...",
      "value": "1000000000000000000",
      "gas_used": "21000",
      "gas_limit": "21000"
    }
  }'
```

## 📊 Monitoring

### Built-in Metrics

All services expose Prometheus-compatible metrics at `/metrics`:

- Transaction ingestion rates
- AI model performance
- Alert generation rates
- Database query performance
- System resource usage

### Grafana Dashboard

Optional Grafana integration for visualization:

```bash
# Start with monitoring
docker-compose --profile monitoring up -d

# Access Grafana
http://localhost:3001  # Grafana dashboard
http://localhost:9090  # Prometheus
```

## 🔒 Security Features

- **JWT Authentication**: Secure API access
- **Rate Limiting**: Prevent API abuse
- **Input Validation**: Comprehensive request validation
- **HTTPS Support**: TLS termination (via nginx)
- **Database Security**: Encrypted connections, parameterized queries
- **Container Security**: Minimal base images, non-root users

## 📈 Performance

### Throughput Targets
- **Transaction Ingestion**: 5,000-10,000 TPS
- **AI Analysis**: <100ms per transaction
- **API Response**: <200ms average
- **Alert Latency**: <5 seconds from detection to notification

### Scaling Options
- **Horizontal**: Multiple ingestion workers
- **Database**: Read replicas, partitioning
- **Caching**: Redis clusters
- **Load Balancing**: Multiple API instances

## 🧪 Development

### Local Development

```bash
# Install dependencies
cd services/ingestion && cargo build
cd ../ai-engine && pip install -r requirements.txt
cd ../alert-service && npm install
cd ../api-server && npm install

# Run database migrations
cd ../../database
./setup.sh

# Start services individually
cd ../services/ingestion && cargo run
cd ../ai-engine && python main.py
cd ../alert-service && npm start
cd ../api-server && npm start
```

### Testing

```bash
# Run tests
cd services/ingestion && cargo test
cd ../ai-engine && python -m pytest
cd ../alert-service && npm test
cd ../api-server && npm test

# Integration tests
docker-compose -f docker-compose.test.yml up --abort-on-container-exit
```

### Code Quality

```bash
# Linting and formatting
cd services/ingestion && cargo fmt && cargo clippy
cd ../ai-engine && black . && flake8 .
cd ../alert-service && npm run lint && npm run format
cd ../api-server && npm run lint && npm run format
```

## 🚀 Deployment

### Development
```bash
./scripts/dev-setup.sh
```

### Production
```bash
./scripts/deploy.sh production
./scripts/deploy.sh production --with-monitoring
```

### Docker Production

```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Deploy
docker-compose -f docker-compose.prod.yml up -d
```

### Environment Configuration

| Environment | Usage |
|-------------|--------|
| `development` | Local development with hot reload |
| `staging` | Pre-production testing |
| `production` | Production deployment with security hardening |

## 📋 API Reference

### Authentication Endpoints
- `POST /auth/login` - User authentication
- `POST /auth/register` - User registration  
- `POST /auth/verify` - Token verification

### Subnet Endpoints
- `GET /subnets` - List subnets
- `POST /subnets` - Create subnet (admin)
- `GET /subnets/:id` - Get subnet details
- `PATCH /subnets/:id` - Update subnet (admin)
- `DELETE /subnets/:id` - Delete subnet (admin)

### Transaction Endpoints  
- `GET /subnets/:id/transactions` - Get subnet transactions
- `GET /transactions/:hash` - Get transaction by hash

### Alert Endpoints
- `GET /subnets/:id/alerts` - Get subnet alerts
- `PATCH /alerts/:id/acknowledge` - Acknowledge alert
- `POST /alerts/:id/false-positive` - Mark false positive

### Statistics Endpoints
- `GET /subnets/:id/stats` - Subnet statistics

### System Endpoints
- `GET /health` - Health check
- `GET /metrics` - Prometheus metrics

## 🔍 Troubleshooting

### Common Issues

**MongoDB Connection Issues**
```bash
# Check if MongoDB is running on the custom port (27018)
docker ps | grep mongo

# Test connection manually
mongosh "mongodb://chainguard:chainguard_password@localhost:27018/chainguard?authSource=admin"
```

**Services not starting**
```bash
# Check logs
docker-compose logs [service_name]

# Check ports
netstat -tulpn | grep :3000
```

**Database connection issues**
```bash
# Test database connection
# Check collections
mongosh "mongodb://chainguard:chainguard_password@localhost:27018/chainguard?authSource=admin"

# Check collections
# (inside mongosh) show collections
```

**High memory usage**
```bash
# Monitor resource usage
docker stats

# Clean up unused images
docker system prune -a
```

### Performance Tuning

**Database Optimization**
- Analyze query patterns with `EXPLAIN ANALYZE`
- Monitor slow queries with `pg_stat_statements`
- Adjust MongoDB configuration in production

**Memory Management**
- Limit Rust ingestion service workers
- Tune AI Engine batch processing
- Implement Redis memory limits

### Getting Help

- 📖 Check service documentation in `/services/*/README.md`
- 🔍 Review logs: `docker-compose logs -f [service]`
- 📊 Monitor metrics at `/metrics` endpoints
- 🐛 File issues with detailed error logs

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow language-specific style guides
- Add tests for new features
- Update documentation
- Ensure all services pass CI/CD
- Use conventional commit messages

## 📞 Support

For support and questions:

- 📧 Email: support@chainguard.ai
- 💬 Discord: [ChainGuard Community](https://discord.gg/chainguard)
- 🐛 Issues: [GitHub Issues](https://github.com/chainguard-ai/chainguard/issues)
- 📖 Documentation: [docs.chainguard.ai](https://docs.chainguard.ai)

---

**⚡ Built with ❤️ by the ChainGuard AI team**

*Securing the future of DeFi, one transaction at a time.*