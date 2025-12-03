#!/bin/bash

# Dojo - All-in-one startup script
# Just run this and everything works. Docker stays invisible.

DOJO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DOJO_DIR"

# Track if we started Docker (so we know to stop it)
DOCKER_WAS_RUNNING=false
if docker info > /dev/null 2>&1; then
    DOCKER_WAS_RUNNING=true
fi

# Cleanup function - runs when dojo exits
cleanup() {
    echo ""
    echo "Shutting down..."

    # Stop SearxNG and Chroma
    docker stop searxng > /dev/null 2>&1
    docker stop dojo-chroma > /dev/null 2>&1

    # If we started Docker ourselves, quit it too (keeps system clean)
    if [ "$DOCKER_WAS_RUNNING" = false ]; then
        osascript -e 'quit app "Docker"' > /dev/null 2>&1
    fi

    echo "Done!"
    exit 0
}

# Trap exit signals to run cleanup
trap cleanup EXIT INT TERM

# Start Docker silently in background (no GUI)
start_docker_silent() {
    if ! docker info > /dev/null 2>&1; then
        # Start Docker daemon without opening the app window
        open -gja Docker

        # Wait silently for Docker to be ready (max 60s)
        local i=0
        while ! docker info > /dev/null 2>&1; do
            sleep 1
            ((i++))
            if [ $i -ge 60 ]; then
                echo "Error: Docker failed to start"
                exit 1
            fi
        done
    fi
}

# Start SearxNG silently
start_searxng_silent() {
    # Check if container exists
    if ! docker ps -a --format '{{.Names}}' | grep -q '^searxng$'; then
        # Create container (first time)
        docker run -d \
            --name searxng \
            -p 8080:8080 \
            -v "$DOJO_DIR/scripts/searxng/settings.yml:/etc/searxng/settings.yml:ro" \
            searxng/searxng > /dev/null 2>&1
    elif ! docker ps --format '{{.Names}}' | grep -q '^searxng$'; then
        # Container exists but not running
        docker start searxng > /dev/null 2>&1
    fi

    # Wait for SearxNG to be ready (max 30s)
    local i=0
    while ! curl -s "http://localhost:8080/search?q=test&format=json" > /dev/null 2>&1; do
        sleep 1
        ((i++))
        if [ $i -ge 30 ]; then
            break
        fi
    done
}

# Start Chroma vector database
start_chroma() {
    # Create data directory for persistence
    mkdir -p "$DOJO_DIR/dojodata/chroma"

    # Check if container exists
    if ! docker ps -a --format '{{.Names}}' | grep -q '^dojo-chroma$'; then
        echo "📦 Starting Chroma (first time may pull image)..."
        docker run -d \
            --name dojo-chroma \
            -p 8100:8000 \
            -v "$DOJO_DIR/dojodata/chroma:/chroma/chroma" \
            chromadb/chroma:latest
    elif ! docker ps --format '{{.Names}}' | grep -q '^dojo-chroma$'; then
        # Container exists but not running
        echo "🔄 Starting Chroma..."
        docker start dojo-chroma > /dev/null 2>&1
    else
        echo "✓ Chroma already running"
    fi

    # Wait for Chroma to be ready (max 30s)
    echo "⏳ Waiting for Chroma..."
    local i=0
    while ! curl -s "http://localhost:8100/api/v2/heartbeat" > /dev/null 2>&1; do
        sleep 1
        ((i++))
        if [ $i -ge 30 ]; then
            echo "⚠️  Chroma taking longer than expected..."
            break
        fi
    done

    if curl -s "http://localhost:8100/api/v2/heartbeat" > /dev/null 2>&1; then
        echo "✅ Chroma ready!"
    fi
}

# Main startup sequence
echo "🚀 Starting Dojo..."
echo ""
start_docker_silent
start_searxng_silent
start_chroma

# Start backend server in background (show logs)
echo ""
echo "🖥️  Starting backend..."
node "$DOJO_DIR/backend/server.js" &
BACKEND_PID=$!

# Wait for backend + Milvus connection
sleep 3

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎯 Dojo is ready!"
echo "   Frontend: http://localhost:5173"
echo "   Backend:  http://localhost:3001"
echo "   Chroma:   http://localhost:8100"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   Press Ctrl+C to stop"
echo ""

npm run dev
