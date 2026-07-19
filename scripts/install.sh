#!/bin/bash
set -e

echo -e "\033[1;36m=========================================\033[0m"
echo -e "\033[1;36m      Bluz Linux Bootstrapper          \033[0m"
echo -e "\033[1;36m=========================================\033[0m"

# Validate Prerequisites
if ! command -v docker &> /dev/null; then
    echo -e "\033[1;31m[ERROR] Docker is not installed or not in PATH.\033[0m"
    exit 1
fi

if ! command -v python3 &> /dev/null || ! command -v pip3 &> /dev/null; then
    echo -e "\033[1;31m[ERROR] python3 and pip3 are required to run the setup wizard.\033[0m"
    exit 1
fi

# Environment Configuration (setup.py)
if [ ! -f ".env" ]; then
    echo -e "\n\033[1;33m[WAIT] Initializing environment configuration wizard...\033[0m"
    python3 -m venv .venv
    source .venv/bin/activate
    pip install -r requirements.txt --quiet
    python3 setup.py
    deactivate
    echo -e "\033[1;32m[OK] Environment configured.\033[0m"
else
    echo -e "\n\033[1;32m[OK] Existing .env found. Skipping configuration wizard.\033[0m"
fi

# Image Resolution & Versioning (Offline vs Online)
if [ -f "VERSION" ]; then
    DETECTED_TAG=$(cat VERSION)
else
    DETECTED_TAG="latest"
fi
IS_OFFLINE=false

echo -e "\n\033[1;33m[WAIT] Resolving Docker images...\033[0m"
if ls images/*.tar 1> /dev/null 2>&1; then
    IS_OFFLINE=true
    echo -e "\033[1;34m>> Offline bundle detected. Loading local image archives...\033[0m"
    
    for img in images/*.tar; do
        echo "   Loading $img..."
        LOAD_OUT=$(docker load -i "$img")
        
        # Extract the version tag from the docker load output (e.g., "Loaded image: ...:v1.0.0")
        if [[ "$LOAD_OUT" =~ :(v[0-9]+\.[0-9]+\.[0-9]+)$ ]]; then
            DETECTED_TAG="${BASH_REMATCH[1]}"
        fi
    done
    echo -e "\033[1;32m[OK] Successfully loaded offline images (Tag: $DETECTED_TAG).\033[0m"
else
    echo -e "\033[1;34m>> No local images found. Assuming Online Mode.\033[0m"
fi

# Inject Version Tag into .env
if grep -q "^BLUZ_VERSION=" .env; then
    sed -i "s/^BLUZ_VERSION=.*/BLUZ_VERSION=$DETECTED_TAG/" .env
else
    echo "BLUZ_VERSION=$DETECTED_TAG" >> .env
fi

# Boot Application
if [ "$IS_OFFLINE" = false ]; then
    echo -e "\n\033[1;33m[WAIT] Pulling latest containers from GHCR...\033[0m"
    docker compose pull
fi

echo -e "\n\033[1;33m[WAIT] Starting Bluz services...\033[0m"
docker compose up -d

echo -e "\n\033[1;32m=========================================\033[0m"
echo -e "\033[1;32m 🎉 Bluz Installation Complete! 🎉 \033[0m"
echo -e "\033[1;32m=========================================\033[0m"
echo -e "To stop the system, run: docker compose down"