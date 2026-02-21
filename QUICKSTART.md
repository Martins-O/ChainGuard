# ChainGuard Quick Start Guide

## Prerequisites

Before starting, ensure you have:
- **MongoDB** running locally on port 27017
- **Docker** installed and running
- **Node.js** v18+ installed
- **Python** 3.9+ installed

## Start All Services

Run this single command to start everything:

```bash
./start-all.sh
```

This script will:
1. ✓ Check prerequisites
2. ✓ Create `.env` file if missing
3. ✓ Start Redis via Docker
4. ✓ Initialize MongoDB indexes
5. ✓ Install all dependencies
6. ✓ Start all 3 services (API Server, AI Engine, Alert Service)
7. ✓ Verify services are running
8. ✓ Show live logs

## Stop All Services

```bash
./stop-all.sh
```

## Service URLs

Once started, services are available at:

- **API Server**: http://localhost:3000
  - Health: http://localhost:3000/health
  - Docs: See API documentation

- **AI Engine**: http://localhost:8000
  - Health: http://localhost:8000/health
  - Docs: http://localhost:8000/docs (FastAPI Swagger)

- **Alert Service**: http://localhost:3001
  - Health: http://localhost:3001/health

## View Logs

```bash
# All logs together
tail -f logs/*.log

# Individual service logs
tail -f logs/api-server.log
tail -f logs/alert-service.log
tail -f logs/ai-engine.log
```

## Quick Test

Create a test user:
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "SecurePass123!"
  }'
```

Test transaction analysis:
```bash
curl -X POST http://localhost:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "transaction": {
      "hash": "0x123...",
      "from": "0xFrom...",
      "to": "0xTo...",
      "value": "1000000000000000000",
      "gas": "21000",
      "gasLimit": "21000",
      "gasPrice": "1000000000",
      "input": "0x",
      "logs": [],
      "timestamp": 1234567890,
      "blockNumber": 12345,
      "status": true
    }
  }'
```

## Troubleshooting

### MongoDB not running
```bash
# Start MongoDB (if using systemd)
sudo systemctl start mongod

# Or if using brew
brew services start mongodb-community
```

### Ports already in use
```bash
# Check what's using the ports
lsof -i :3000
lsof -i :3001
lsof -i :8000

# Stop all services and try again
./stop-all.sh
./start-all.sh
```

### Dependencies issues
```bash
# Clean install for Node.js services
cd services/api-server && rm -rf node_modules && npm install
cd services/alert-service && rm -rf node_modules && npm install

# Clean install for Python service
cd services/ai-engine && rm -rf venv && python3 -m venv venv
source venv/bin/activate && pip install -r requirements.txt
```

## What's Next?

1. **Train AI Models** (optional, requires historical data):
   ```bash
   cd services/ai-engine
   source venv/bin/activate
   python -m app.training.train_models --days-back 30
   ```

2. **View Database**:
   - MongoDB: Use mongosh or MongoDB Compass
   - Connect to: `mongodb://localhost:27017/chainguard`

3. **Integrate Frontend** (when ready):
   - Frontend should connect to API Server at http://localhost:3000

## Notes

- Services run in **background** after starting
- Logs are saved in `logs/` directory
- PID files are saved in `logs/` for process management
- Press **Ctrl+C** in start script to stop tailing logs (services keep running)
- Use `./stop-all.sh` to stop all services completely
