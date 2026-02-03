# 🛡️ ChainGuard AI

A real-time AI-powered security monitoring platform for Avalanche subnets that detects and alerts on potential threats using advanced machine learning models.

## 🎯 Overview

ChainGuard AI provides comprehensive security monitoring for Avalanche blockchain networks through:

- **Real-time Transaction Ingestion** (Rust) - High-performance WebSocket connections
- **AI Threat Analysis** (Python) - Multi-model security analysis  
- **Intelligent Alerting** (Node.js) - Smart notification routing
- **RESTful API** (Node.js) - Complete management interface
- **PostgreSQL Database** - Scalable data persistence

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Avalanche      │    │                  │    │                 │
│  Subnet RPC/Web │────│ Rust Ingestion   │────│   Redis Queue   │
│  Sockets        │    │ Service          │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │                        │
                              ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│                 │────│   AI Engine     │────│                 │
│   PostgreSQL   │    │   (Python)      │    │ Alert Service  │
│   Database     │────│                  │────│  (Node.js)     │
│                 │    │  • Signature    │    │  • Slack       │
└─────────────────┘    │  • Anomaly      │    │  • Email       │
                              │  • Behavioral  │    │  • SMS         │
                              └──────────────────┘    └─────────────────┘
                                      │                        │
                                      ▼                        ▼
                              ┌──────────────────┐    ┌─────────────────┐
                              │                 │    │                 │
                              │   API Server    │────│  Web Dashboard │
                              │  (Node.js)      │    │  (Frontend)     │
                              │                 │    │                 │
                              └──────────────────┘    └─────────────────┘
```

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
- PostgreSQL with optimized schema
- Comprehensive indexing strategy
- JSONB for flexible data storage
- Automated migrations

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Git
- 4GB+ RAM (for all services)

### One-Command Setup

```bash
# Clone the repository
git clone <repository-url>
cd chainGuard

# Run development setup
chmod +x scripts/dev-setup.sh
./scripts/dev-setup.sh
```

### Manual Setup

1. **Environment Configuration**
```bash
cp .env.example .env
# Edit .env with your API keys and configurations
```

2. **Start Services**
```bash
# Start core services
docker-compose up -d

# Or with monitoring
docker-compose --profile monitoring up -d

# Or production setup
docker-compose --profile production up -d
```

3. **Access Services**
- 🌐 API Server: `http://localhost:3000`
- 🧠 AI Engine: `http://localhost:8000`
- 🚨 Alert Service: `http://localhost:3001`
- 📊 Ingestion Metrics: `http://localhost:9000`

### Default Login
- Username: `admin`
- Password: `admin123`

⚠️ **Change default password immediately after first login!**

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

### 5️⃣ PostgreSQL Database
- **Port**: 5432
- **Features**: Schema migrations, optimized indexing
- **Connection**: `postgresql://chainguard:chainguard_password@localhost:5432/chainguard`

## 🔧 Configuration

### Environment Variables

Key configuration options in `.env`:

```bash
# Database
DATABASE_URL=postgresql://chainguard:chainguard_password@localhost:5432/chainguard

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
docker-compose exec postgres psql -U chainguard -d chainguard

# Check migrations
docker-compose exec postgres \dt
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
- Adjust PostgreSQL configuration in production

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