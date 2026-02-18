#!/bin/bash

# ChainGuard - Start All Services Script
# This script starts all backend services for development

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   ChainGuard - Starting All Services${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo -e "${YELLOW}[1/7] Checking prerequisites...${NC}"

if ! command_exists docker; then
    echo -e "${RED}Error: Docker is not installed${NC}"
    exit 1
fi

if ! command_exists node; then
    echo -e "${RED}Error: Node.js is not installed${NC}"
    exit 1
fi

if ! command_exists python3; then
    echo -e "${RED}Error: Python 3 is not installed${NC}"
    exit 1
fi

if ! command_exists mongosh; then
    echo -e "${YELLOW}Warning: mongosh not found. Make sure MongoDB is running.${NC}"
fi

echo -e "${GREEN}✓ Prerequisites check passed${NC}"
echo ""

# Check if .env exists
echo -e "${YELLOW}[2/7] Checking environment configuration...${NC}"
if [ ! -f .env ]; then
    echo -e "${YELLOW}Creating .env file from defaults...${NC}"
    cat > .env << 'EOF'
# MongoDB (local instance)
MONGODB_URL=mongodb://localhost:27018/chainguard

# Redis
REDIS_URL=redis://localhost:6379

# JWT Secret
JWT_SECRET=chainguard_dev_secret_change_in_production

# AI Engine
THREAT_THRESHOLD=70
MODEL_PATH=./models/v1

# Service Ports
API_PORT=3000
AI_ENGINE_PORT=8000
ALERT_SERVICE_PORT=3001
EOF
    echo -e "${GREEN}✓ .env file created${NC}"
else
    echo -e "${GREEN}✓ .env file exists${NC}"
fi
echo ""

# Start databases
echo -e "${YELLOW}[3/7] Starting databases (Redis, MongoDB)...${NC}"
docker-compose up -d redis mongodb
sleep 5
echo -e "${GREEN}✓ Databases started${NC}"
echo ""

# Initialize MongoDB indexes (if MongoDB is running)
echo -e "${YELLOW}[4/7] Initializing MongoDB...${NC}"
if command_exists mongosh; then
    if mongosh --port 27018 --quiet --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
        echo "Initializing MongoDB indexes..."
        mongosh --port 27018 chainguard < database/mongodb/init.js > /dev/null 2>&1 || echo "Indexes may already exist"
        echo -e "${GREEN}✓ MongoDB initialized${NC}"
    else
        echo -e "${YELLOW}Warning: MongoDB is not running. Please start MongoDB first.${NC}"
        echo "Start MongoDB and run: mongosh --port 27018 chainguard < database/mongodb/init.js"
    fi
else
    echo -e "${YELLOW}Warning: mongosh not found. Skipping MongoDB initialization.${NC}"
fi
echo ""

# Install dependencies
echo -e "${YELLOW}[5/7] Installing dependencies...${NC}"

# API Server
cd services/api-server
if [ -d "node_modules" ]; then
    echo -e "${GREEN}✓ API Server dependencies already installed (skipping)${NC}"
else
    echo "Installing API Server dependencies (this may take a minute)..."
    if npm install; then
        echo -e "${GREEN}✓ API Server dependencies installed${NC}"
    else
        echo -e "${RED}✗ Failed to install API Server dependencies${NC}"
        echo "Try running: cd services/api-server && npm install"
        cd "$PROJECT_ROOT"
        exit 1
    fi
fi
cd "$PROJECT_ROOT"

# Alert Service
cd services/alert-service
if [ -d "node_modules" ]; then
    echo -e "${GREEN}✓ Alert Service dependencies already installed (skipping)${NC}"
else
    echo "Installing Alert Service dependencies (this may take a minute)..."
    if npm install; then
        echo -e "${GREEN}✓ Alert Service dependencies installed${NC}"
    else
        echo -e "${RED}✗ Failed to install Alert Service dependencies${NC}"
        echo "Try running: cd services/alert-service && npm install"
        cd "$PROJECT_ROOT"
        exit 1
    fi
fi
cd "$PROJECT_ROOT"

# AI Engine
cd services/ai-engine
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    if ! python3 -m venv venv; then
        echo -e "${RED}✗ Failed to create virtual environment${NC}"
        echo "Make sure python3-venv is installed: sudo apt install python3-venv"
        cd "$PROJECT_ROOT"
        exit 1
    fi
fi

echo "Installing Python packages (this may take 2-3 minutes)..."
source venv/bin/activate
if pip install -r requirements.txt; then
    echo -e "${GREEN}✓ AI Engine dependencies installed${NC}"
else
    echo -e "${RED}✗ Failed to install AI Engine dependencies${NC}"
    echo "Try running manually:"
    echo "  cd services/ai-engine"
    echo "  source venv/bin/activate"
    echo "  pip install -r requirements.txt"
    deactivate
    cd "$PROJECT_ROOT"
    exit 1
fi
deactivate
cd "$PROJECT_ROOT"
echo ""

# Create logs directory
mkdir -p logs

# Start services
echo -e "${YELLOW}[6/7] Starting services...${NC}"

# Kill any existing processes on these ports
echo "Cleaning up existing processes..."
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:3001 | xargs kill -9 2>/dev/null || true
lsof -ti:8000 | xargs kill -9 2>/dev/null || true
sleep 1

# Start API Server
echo "Starting API Server on port 3000..."
cd services/api-server
npm run dev > ../../logs/api-server.log 2>&1 &
API_PID=$!
echo $API_PID > ../../logs/api-server.pid
cd "$PROJECT_ROOT"
sleep 2

# Start Alert Service
echo "Starting Alert Service on port 3001..."
cd services/alert-service
npm run dev > ../../logs/alert-service.log 2>&1 &
ALERT_PID=$!
echo $ALERT_PID > ../../logs/alert-service.pid
cd "$PROJECT_ROOT"
sleep 2

# Start AI Engine
echo "Starting AI Engine on port 8000..."
cd services/ai-engine
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000 --reload > ../../logs/ai-engine.log 2>&1 &
AI_PID=$!
echo $AI_PID > ../../logs/ai-engine.pid
deactivate
cd "$PROJECT_ROOT"
sleep 3

echo -e "${GREEN}✓ All services started${NC}"
echo ""

# Verify services
echo -e "${YELLOW}[7/7] Verifying services...${NC}"

check_service() {
    local name=$1
    local url=$2
    local log_name=$3
    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if curl -s -f "$url" > /dev/null 2>&1; then
            echo -e "${GREEN}✓ $name is running${NC}"
            return 0
        fi
        sleep 1
        attempt=$((attempt + 1))
    done

    echo -e "${RED}✗ $name failed to start (check logs/$log_name.log)${NC}"
    return 1
}

check_service "API Server    " "http://localhost:3000/health" "api-server"
check_service "AI Engine     " "http://localhost:8000/health" "ai-engine"
check_service "Alert Service " "http://localhost:3001/health" "alert-service"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   All Services Running Successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Service URLs:"
echo "  • API Server:     http://localhost:3000"
echo "  • AI Engine:      http://localhost:8000"
echo "  • Alert Service:  http://localhost:3001"
echo ""
echo "Logs:"
echo "  • API Server:     tail -f logs/api-server.log"
echo "  • Alert Service:  tail -f logs/alert-service.log"
echo "  • AI Engine:      tail -f logs/ai-engine.log"
echo ""
echo "To stop all services, run:"
echo "  ./stop-all.sh"
echo ""
echo -e "${YELLOW}Press Ctrl+C to exit (services will continue running in background)${NC}"
echo ""

# Keep script running and tail all logs
trap 'echo ""; echo "Services are still running in background. Use ./stop-all.sh to stop them."; exit 0' INT

tail -f logs/api-server.log logs/alert-service.log logs/ai-engine.log
