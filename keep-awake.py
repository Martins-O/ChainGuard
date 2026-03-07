#!/usr/bin/env python3
"""
ChainGuard Keep-Alive Script
Pings Render services periodically to prevent them from going to sleep.
"""

import time
import urllib.request
import urllib.error
import sys
from datetime import datetime

SERVICES = [
    ("API Server", "https://chainguard-api-server.onrender.com/health"),
    ("AI Engine", "https://chainguard-ai-engine.onrender.com/health"),
    ("Alert Service", "https://chainguard-alert-service.onrender.com/health"),
    ("Ingestion", "https://chainguard-ingestion.onrender.com/health"),
]

PING_INTERVAL = 40  # seconds


def ping_service(name: str, url: str) -> bool:
    """Ping a service and return True if successful."""
    try:
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, timeout=10) as response:
            status = response.getcode()
            if status == 200:
                print(f"  ✓ {name}: OK ({status})")
                return True
            else:
                print(f"  ⚠ {name}: Status {status}")
                return False
    except urllib.error.HTTPError as e:
        print(f"  ⚠ {name}: HTTP {e.code}")
        return e.code == 503  # 503 means sleeping, will wake up
    except urllib.error.URLError as e:
        print(f"  ✗ {name}: {e.reason}")
        return False
    except Exception as e:
        print(f"  ✗ {name}: {type(e).__name__}")
        return False


def main():
    print("=" * 50)
    print("ChainGuard Keep-Alive Script")
    print("=" * 50)
    print(f"Pinging {len(SERVICES)} services every {PING_INTERVAL} seconds")
    print("Press Ctrl+C to stop")
    print("=" * 50)
    
    while True:
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"\n[{timestamp}] Pinging services...")
        
        all_ok = True
        for name, url in SERVICES:
            if not ping_service(name, url):
                all_ok = False
        
        if all_ok:
            print("  All services online ✓")
        
        print(f"  Next ping in {PING_INTERVAL} seconds...")
        time.sleep(PING_INTERVAL)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nStopped.")
        sys.exit(0)
