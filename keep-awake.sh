#!/bin/bash

# Keep ChainGuard services awake by periodically pinging them
# Usage: ./keep-awake.sh [interval_in_seconds]
# Default interval: 300 seconds (5 minutes)

INTERVAL=${1:-300}

SERVICES=(
    "https://chainguard-api-server.onrender.com/health"
    "https://chainguard-ai-engine.onrender.com/health"
    "https://chainguard-alert-service.onrender.com/health"
)

echo "Starting ChainGuard keep-awake script..."
echo "Pinging services every ${INTERVAL} seconds"
echo "Press Ctrl+C to stop"
echo ""

while true; do
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$TIMESTAMP] Pinging services..."
    
    for url in "${SERVICES[@]}"; do
        STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null)
        if [ "$STATUS" = "200" ]; then
            echo "  ✓ $(basename $url .onrender.com) - OK"
        elif [ "$STATUS" = "503" ]; then
            echo "  ⚠ $(basename $url .onrender.com) - Waking up (503)"
        else
            echo "  ✗ $(basename $url .onrender.com) - Failed ($STATUS)"
        fi
    done
    
    echo "---"
    sleep $INTERVAL
done
