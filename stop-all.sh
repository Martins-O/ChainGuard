#!/bin/bash

# ChainGuard - Stop All Services Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

echo -e "${YELLOW}Stopping ChainGuard services...${NC}"
echo ""

# Stop services using PID files
if [ -f logs/api-server.pid ]; then
    PID=$(cat logs/api-server.pid)
    if kill -0 $PID 2>/dev/null; then
        kill $PID
        echo -e "${GREEN}✓ Stopped API Server${NC}"
    fi
    rm logs/api-server.pid
fi

if [ -f logs/alert-service.pid ]; then
    PID=$(cat logs/alert-service.pid)
    if kill -0 $PID 2>/dev/null; then
        kill $PID
        echo -e "${GREEN}✓ Stopped Alert Service${NC}"
    fi
    rm logs/alert-service.pid
fi

if [ -f logs/ai-engine.pid ]; then
    PID=$(cat logs/ai-engine.pid)
    if kill -0 $PID 2>/dev/null; then
        kill $PID
        echo -e "${GREEN}✓ Stopped AI Engine${NC}"
    fi
    rm logs/ai-engine.pid
fi

# Force kill any remaining processes on the ports
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:3001 | xargs kill -9 2>/dev/null || true
lsof -ti:8000 | xargs kill -9 2>/dev/null || true

# Stop Redis
echo ""
echo -e "${YELLOW}Stopping Redis...${NC}"
docker-compose stop redis
echo -e "${GREEN}✓ Redis stopped${NC}"

echo ""
echo -e "${GREEN}All services stopped successfully!${NC}"
