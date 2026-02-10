#!/bin/bash

# ChainGuard - Quick Start (Skip Dependencies Installation)
# Use this after running start-all.sh at least once

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   ChainGuard - Quick Start${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Start databases
echo -e "${YELLOW}Starting databases (Redis, Postgres, MongoDB)...${NC}"
docker-compose up -d redis postgres mongodb
sleep 5
echo -e "${GREEN}✓ Databases started${NC}"
echo ""

# Create logs directory
mkdir -p logs

# Clean up existing processes
echo -e "${YELLOW}Cleaning up existing processes...${NC}"
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:3001 | xargs kill -9 2>/dev/null || true
lsof -ti:8000 | xargs kill -9 2>/dev/null || true
sleep 1
echo ""

# Start services
echo -e "${YELLOW}Starting services...${NC}"

# API Server
echo "Starting API Server..."
cd services/api-server
npm run dev > ../../logs/api-server.log 2>&1 &
echo $! > ../../logs/api-server.pid
cd "$PROJECT_ROOT"
sleep 2

# Alert Service
echo "Starting Alert Service..."
cd services/alert-service
npm run dev > ../../logs/alert-service.log 2>&1 &
echo $! > ../../logs/alert-service.pid
cd "$PROJECT_ROOT"
sleep 2

# AI Engine
echo "Starting AI Engine..."
cd services/ai-engine
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000 --reload > ../../logs/ai-engine.log 2>&1 &
echo $! > ../../logs/ai-engine.pid
deactivate
cd "$PROJECT_ROOT"
sleep 3

echo -e "${GREEN}✓ All services started${NC}"
echo ""

# Verify
echo -e "${YELLOW}Verifying services...${NC}"

check_service() {
    local name=$1
    local url=$2
    local log_name=$3
    local attempts=15
    local count=0

    while [ $count -lt $attempts ]; do
        if curl -s -f "$url" > /dev/null 2>&1; then
            echo -e "${GREEN}✓ $name${NC}"
            return 0
        fi
        sleep 1
        count=$((count + 1))
    done

    echo -e "${RED}✗ $name (check logs/$log_name.log)${NC}"
    return 1
}

check_service "API Server    " "http://localhost:3000/health" "api-server"
check_service "AI Engine     " "http://localhost:8000/health" "ai-engine"
check_service "Alert Service " "http://localhost:3001/health" "alert-service"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   Services Running!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "URLs:"
echo "  • API Server:     http://localhost:3000"
echo "  • AI Engine:      http://localhost:8000"
echo "  • Alert Service:  http://localhost:3001"
echo ""
echo "Logs: tail -f logs/*.log"
echo "Stop: ./stop-all.sh"
echo ""

# Tail logs
trap 'echo ""; echo "Services running in background. Use ./stop-all.sh to stop."; exit 0' INT
tail -f logs/api-server.log logs/alert-service.log logs/ai-engine.log
