#!/bin/bash

# ChainGuard Production Deployment Script
# This script deploys ChainGuard to production environment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-production}
BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"
LOG_FILE="./logs/deployment_$(date +%Y%m%d_%H%M%S).log"

echo -e "${GREEN}🚀 Deploying ChainGuard to $ENVIRONMENT${NC}"

# Create directories
mkdir -p logs
mkdir -p backups

# Logging function
log() {
    echo "$1" | tee -a "$LOG_FILE"
}

log "🚀 Starting deployment to $ENVIRONMENT at $(date)"

# Pre-deployment checks
log "🔍 Running pre-deployment checks..."

# Check environment variables
if [ ! -f .env ]; then
    log -e "${RED}❌ .env file not found${NC}"
    exit 1
fi

# Check Docker
if ! command -v docker &> /dev/null; then
    log -e "${RED}❌ Docker is not installed${NC}"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    log -e "${RED}❌ Docker Compose is not installed${NC}"
    exit 1
fi

log "✅ Pre-deployment checks passed"

# Backup current data
log "📦 Creating backup of current data..."

# Backup database
if docker-compose ps postgres | grep -q "Up"; then
    log "📊 Backing up PostgreSQL database..."
    mkdir -p "$BACKUP_DIR"
    docker-compose exec -T postgres pg_dump -U chainguard chainguard > "$BACKUP_DIR/database_backup.sql"
    log "✅ Database backup completed"
fi

# Backup Redis data
if docker-compose ps redis | grep -q "Up"; then
    log "🔴 Backing up Redis data..."
    docker-compose exec -T redis redis-cli BGSAVE
    sleep 5
    docker cp $(docker-compose ps -q redis):/data/dump.rdb "$BACKUP_DIR/redis_backup.rdb"
    log "✅ Redis backup completed"
fi

# Pull latest images
log "📥 Pulling latest Docker images..."
docker-compose pull

if [ $? -ne 0 ]; then
    log -e "${RED}❌ Failed to pull Docker images${NC}"
    exit 1
fi

log "✅ Docker images pulled successfully"

# Build custom images
log "🔨 Building custom Docker images..."
docker-compose build --no-cache

if [ $? -ne 0 ]; then
    log -e "${RED}❌ Failed to build Docker images${NC}"
    exit 1
fi

log "✅ Custom Docker images built successfully"

# Stop services gracefully
log "🛑 Stopping current services..."
docker-compose down

# Wait for services to stop
sleep 10

# Start services in production mode
log "🚀 Starting services in production mode..."

# Start core services first
log "📊 Starting database and Redis..."
docker-compose up -d postgres redis

# Wait for database
log "⏳ Waiting for database to be ready..."
for i in {1..60}; do
    if docker-compose exec -T postgres pg_isready -U chainguard -d chainguard; then
        log "✅ Database is ready"
        break
    fi
    log "Waiting for database... ($i/60)"
    sleep 2
done

# Start application services
log "🚀 Starting application services..."
docker-compose up -d api-server ai-engine alert-service ingestion

# Wait for services to be ready
log "⏳ Waiting for services to be ready..."
sleep 30

# Health checks
log "🔍 Performing health checks..."

services=("api-server:3000" "ai-engine:8000" "alert-service:3001")
all_healthy=true

for service in "${services[@]}"; do
    service_name=$(echo $service | cut -d: -f1)
    port=$(echo $service | cut -d: -f2)
    
    for i in {1..30}; do
        if curl -f -s http://localhost:$port/health > /dev/null 2>&1; then
            log "✅ $service_name is healthy"
            break
        fi
        
        if [ $i -eq 30 ]; then
            log -e "${RED}❌ $service_name health check failed${NC}"
            all_healthy=false
        fi
        
        log "Waiting for $service_name... ($i/30)"
        sleep 2
    done
done

# Start optional services
if [ "$ENVIRONMENT" = "production" ]; then
    log "🌐 Starting production services..."
    docker-compose --profile production up -d nginx
fi

# Enable monitoring if requested
if [ "$2" = "--with-monitoring" ]; then
    log "📊 Starting monitoring services..."
    docker-compose --profile monitoring up -d prometheus grafana
fi

# Post-deployment verification
log "🔍 Running post-deployment verification..."

# Test API connectivity
if curl -f -s http://localhost:3000/health > /dev/null 2>&1; then
    log "✅ API server is responding"
else
    log -e "${RED}❌ API server is not responding${NC}"
    all_healthy=false
fi

# Test AI Engine
if curl -f -s http://localhost:8000/health > /dev/null 2>&1; then
    log "✅ AI engine is responding"
else
    log -e "${RED}❌ AI engine is not responding${NC}"
    all_healthy=false
fi

# Test Alert Service
if curl -f -s http://localhost:3001/health > /dev/null 2>&1; then
    log "✅ Alert service is responding"
else
    log -e "${RED}❌ Alert service is not responding${NC}"
    all_healthy=false
fi

# Cleanup old images
log "🧹 Cleaning up old Docker images..."
docker image prune -f

# Display deployment summary
echo ""
log "📋 Deployment Summary:"
log "  Environment: $ENVIRONMENT"
log "  Backup Directory: $BACKUP_DIR"
log "  Log File: $LOG_FILE"
log "  Deployed At: $(date)"

echo ""
log "🌐 Service URLs:"
log "  API Server: http://localhost:3000"
log "  AI Engine: http://localhost:8000"
log "  Alert Service: http://localhost:3001"

if [ "$2" = "--with-monitoring" ]; then
    log "  Prometheus: http://localhost:9090"
    log "  Grafana: http://localhost:3001"  # Note: Grafana port 3000 conflicts with API
fi

echo ""
log "📊 Resource Usage:"
docker-compose ps

echo ""

if [ "$all_healthy" = true ]; then
    log -e "${GREEN}🎉 Deployment completed successfully!${NC}"
    log "✅ All services are healthy and responding"
    exit 0
else
    log -e "${RED}❌ Deployment completed with issues${NC}"
    log "⚠️  Some services may not be responding properly"
    log "📋 Check the logs: docker-compose logs"
    exit 1
fi