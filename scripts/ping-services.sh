#!/bin/bash

# Ping ChainGuard services to keep them awake
# This script is meant to be run via cron

SERVICES=(
    "https://chainguard-api-server.onrender.com/health"
    "https://chainguard-ai-engine.onrender.com/health"
    "https://chainguard-alert-service.onrender.com/health"
)

LOG_FILE="/home/martins/hacks/chainGuard/logs/keep-awake.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

for url in "${SERVICES[@]}"; do
    SERVICE_NAME=$(basename "$url" | sed 's/\/health//')
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url" 2>/dev/null)
    
    if [ "$STATUS" = "200" ]; then
        log "$SERVICE_NAME: OK"
    elif [ "$STATUS" = "503" ]; then
        log "$SERVICE_NAME: Waking up (503)"
    else
        log "$SERVICE_NAME: Failed ($STATUS)"
    fi
done
