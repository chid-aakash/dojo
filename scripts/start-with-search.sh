#!/bin/bash

# Dojo startup script with SearxNG search
# This script ensures Docker and SearxNG are running before starting the dev server

echo "🚀 Starting Dojo with AI Search..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "📦 Starting Docker Desktop..."
    open -a Docker

    # Wait for Docker to be ready (max 60 seconds)
    echo "   Waiting for Docker to start..."
    for i in {1..60}; do
        if docker info > /dev/null 2>&1; then
            echo "   Docker is ready!"
            break
        fi
        sleep 1
    done

    if ! docker info > /dev/null 2>&1; then
        echo "❌ Docker failed to start. Please start Docker Desktop manually."
        exit 1
    fi
fi

# Check if SearxNG container exists
if ! docker ps -a | grep -q searxng; then
    echo "📥 Creating SearxNG container (first time setup)..."
    docker run -d \
        --name searxng \
        -p 8080:8080 \
        -v "$(dirname "$0")/searxng/settings.yml:/etc/searxng/settings.yml:ro" \
        --restart unless-stopped \
        searxng/searxng
else
    # Container exists, check if running
    if ! docker ps | grep -q searxng; then
        echo "🔍 Starting SearxNG..."
        docker start searxng
    else
        echo "🔍 SearxNG already running"
    fi
fi

# Wait for SearxNG to be ready
echo "   Waiting for SearxNG to be ready..."
for i in {1..30}; do
    if curl -s "http://localhost:8080/search?q=test&format=json" > /dev/null 2>&1; then
        echo "   SearxNG is ready!"
        break
    fi
    sleep 1
done

echo ""
echo "✅ All services running:"
echo "   - SearxNG: http://localhost:8080"
echo "   - LM Studio: http://localhost:1234 (make sure it's running)"
echo ""
echo "🎯 Starting Dojo dev server..."
echo ""

# Start the dev server
cd "$(dirname "$0")/.." && npm run dev
