#!/bin/bash

# AI Engine Dependency Installer
# Handles Python 3.11, 3.12, and 3.13

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Detect Python version
PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}' | cut -d. -f1,2)

echo -e "${GREEN}Detected Python version: $PYTHON_VERSION${NC}"

# Remove old venv if exists
if [ -d "venv" ]; then
    echo -e "${YELLOW}Removing old virtual environment...${NC}"
    rm -rf venv
fi

# Create virtual environment
echo -e "${YELLOW}Creating virtual environment...${NC}"
python3 -m venv venv
source venv/bin/activate

# Upgrade pip
echo -e "${YELLOW}Upgrading pip...${NC}"
pip install --upgrade pip setuptools wheel

# Install dependencies based on Python version
case $PYTHON_VERSION in
    3.13)
        echo -e "${YELLOW}Python 3.13 detected - using compatible packages${NC}"
        echo -e "${YELLOW}Note: TensorFlow may not be available yet for Python 3.13${NC}"

        # Install core packages that work on 3.13
        pip install fastapi uvicorn[standard]
        pip install motor pymongo
        pip install redis[hiredis]
        pip install python-dotenv
        pip install httpx
        pip install python-jose[cryptography]
        pip install passlib[bcrypt]
        pip install web3

        # Install ML packages (newer versions support 3.13)
        echo -e "${YELLOW}Installing ML packages...${NC}"
        pip install numpy pandas
        pip install scikit-learn

        # Skip TensorFlow and Keras for now on 3.13
        echo -e "${YELLOW}Skipping TensorFlow (not yet available for Python 3.13)${NC}"
        echo -e "${YELLOW}Models will use fallback heuristics until TensorFlow is installed${NC}"
        ;;

    3.12|3.11)
        echo -e "${GREEN}Python $PYTHON_VERSION - using full requirements${NC}"
        pip install -r requirements.txt
        ;;

    *)
        echo -e "${RED}Warning: Python $PYTHON_VERSION may not be fully tested${NC}"
        echo -e "${YELLOW}Attempting to install with standard requirements...${NC}"
        pip install -r requirements.txt || {
            echo -e "${RED}Installation failed. Try Python 3.11 or 3.12${NC}"
            deactivate
            exit 1
        }
        ;;
esac

echo -e "${GREEN}✓ Dependencies installed successfully${NC}"
echo -e "${YELLOW}Python version: $PYTHON_VERSION${NC}"
echo ""
deactivate
