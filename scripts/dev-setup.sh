#!/bin/bash

# ChainGuard Development Setup Script
# This script sets up the development environment for ChainGuard

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Setting up ChainGuard Development Environment${NC}"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed. Please install Docker first.${NC}"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed. Please install Docker Compose first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Docker and Docker Compose are installed${NC}"

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}📝 Creating .env file from template...${NC}"
    cp .env.example .env
    echo -e "${GREEN}✅ .env file created. Please edit it with your configuration.${NC}"
else
    echo -e "${GREEN}✅ .env file already exists${NC}"
fi

# Create necessary directories
echo -e "${YELLOW}📁 Creating necessary directories...${NC}"
mkdir -p logs
mkdir -p data/mongodb
mkdir -p data/redis
mkdir -p data/models
mkdir -p monitoring/grafana/dashboards
mkdir -p monitoring/grafana/datasources
mkdir -p nginx/ssl

echo -e "${GREEN}✅ Directories created${NC}"

# Build all services
echo -e "${YELLOW}🔨 Building Docker images...${NC}"
docker-compose build

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Docker images built successfully${NC}"
else
    echo -e "${RED}❌ Failed to build Docker images${NC}"
    exit 1
fi

# Start core services
echo -e "${YELLOW}🚀 Starting core services (MongoDB, Redis)...${NC}"
docker-compose up -d mongodb redis

# Wait for database to be ready
echo -e "${YELLOW}⏳ Waiting for database to be ready...${NC}"
sleep 10

# Check database connectivity
for i in {1..30}; do
    if docker-compose exec -T mongodb mongosh --eval "db.adminCommand('ping')" --quiet > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Database is ready${NC}"
        break
    fi
    echo -e "${YELLOW}Waiting for database... ($i/30)${NC}"
    sleep 2
done

# Start remaining services
echo -e "${YELLOW}🚀 Starting remaining services...${NC}"
docker-compose up -d

# Wait for services to be ready
echo -e "${YELLOW}⏳ Waiting for services to be ready...${NC}"
sleep 30

# Service health checks
echo -e "${YELLOW}🔍 Checking service health...${NC}"

services=("api-server:3000" "ai-engine:8000" "alert-service:3001" "ingestion:9000")
all_healthy=true

for service in "${services[@]}"; do
    service_name=$(echo $service | cut -d: -f1)
    port=$(echo $service | cut -d: -f2)
    
    if curl -f -s http://localhost:$port/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ $service_name is healthy${NC}"
    else
        echo -e "${RED}❌ $service_name is not responding${NC}"
        all_healthy=false
    fi
done

# Display service URLs
echo ""
echo -e "${GREEN}🎉 ChainGuard Development Environment is ready!${NC}"
echo ""
echo -e "${BLUE}📋 Service URLs:${NC}"
echo -e "  🌐 API Server:        ${GREEN}http://localhost:3000${NC}"
echo -e "  🧠 AI Engine:         ${GREEN}http://localhost:8000${NC}"
echo -e "  🚨 Alert Service:     ${GREEN}http://localhost:3001${NC}"
echo -e "  📊 Ingestion Metrics: ${GREEN}http://localhost:9000${NC}"
echo -e "  🗄️  Database:          ${GREEN}mongodb://chainguard:chainguard_password@localhost:27017/chainguard?authSource=admin${NC}"
echo -e "  🔴 Redis:             ${GREEN}redis://localhost:6379${NC}"
echo ""
echo -e "${BLUE}🔑 Default Login:${NC}"
echo -e "  Username: ${YELLOW}admin${NC}"
echo -e "  Password: ${YELLOW}admin123${NC}"
echo ""
echo -e "${BLUE}📚 API Documentation:${NC}"
echo -e "  📖 API Server: ${GREEN}http://localhost:3000${NC}"
echo -e "  🧠 AI Engine:  ${GREEN}http://localhost:8000/docs${NC}"
echo ""
echo -e "${BLUE}🔧 Management Commands:${NC}"
echo -e "  📊 View logs:         ${YELLOW}docker-compose logs -f [service]${NC}"
echo -e "  🔄 Restart service:    ${YELLOW}docker-compose restart [service]${NC}"
echo -e "  🛑 Stop all:          ${YELLOW}docker-compose down${NC}"
echo -e "  🧹 Clean up:          ${YELLOW}docker-compose down -v --remove-orphans${NC}"
echo ""

if [ "$all_healthy" = true ]; then
    echo -e "${GREEN}✅ All services are running and healthy!${NC}"
else
    echo -e "${YELLOW}⚠️  Some services may still be starting. Check logs with: docker-compose logs${NC}"
fi

echo ""
echo -e "${YELLOW}⚠️  IMPORTANT:${NC}"
echo -e "  1. Edit the .env file with your actual API keys and endpoints"
echo -e "  2. Change the default admin password immediately after first login"
echo -e "  3. Configure notification channels (Slack, Email, SMS) for alerts"
echo -e "  4. Update Avalanche subnet RPC/WebSocket URLs as needed"
echo ""

echo -e "${GREEN}🎯 Next Steps:${NC}"
echo -e "  1. ${YELLOW}curl http://localhost:3000/health${NC} - Check API health"
echo -e "  2. ${YELLOW}curl -X POST http://localhost:3000/auth/login -d '{\"username\":\"admin\",\"password\":\"admin123\"}' -H 'Content-Type: application/json'${NC} - Get JWT token"
echo -e "  3. ${YELLOW}Open http://localhost:3000 in your browser${NC} - Access API"
echo -e "  4. ${YELLOW}docker-compose logs -f${NC} - Monitor real-time logs"