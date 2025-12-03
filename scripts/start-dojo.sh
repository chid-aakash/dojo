#!/bin/bash
# Dojo startup script - runs backend and frontend in tmux split panes

DOJO_DIR="/Users/aakashchid/workshop/dojo"
SESSION_NAME="dojo"

# Kill any existing dojo processes
echo "Stopping any existing Dojo processes..."

# Kill by port
for port in 3001 5173; do
  pids=$(lsof -ti:$port 2>/dev/null)
  if [ -n "$pids" ]; then
    echo "  Killing processes on port $port: $pids"
    echo "$pids" | xargs kill -9 2>/dev/null
  fi
done

# Also kill any node processes running dojo
pkill -9 -f "dojo.*server.js" 2>/dev/null
pkill -9 -f "dojo.*vite" 2>/dev/null

# Kill existing tmux session if it exists
tmux kill-session -t $SESSION_NAME 2>/dev/null

# Small delay to ensure ports are freed
sleep 1

echo "Starting servers in tmux..."

cd "$DOJO_DIR"

# Create new tmux session with backend in first pane
tmux new-session -d -s $SESSION_NAME -n "dojo" "echo '=== BACKEND ===' && npm run server"

# Split horizontally and run frontend in second pane
tmux split-window -h -t $SESSION_NAME "echo '=== FRONTEND ===' && npm run dev"

# Make panes equal size
tmux select-layout -t $SESSION_NAME even-horizontal

# Wait a moment for servers to start before opening browser
sleep 3

# Open Chrome to localhost:5173
open -a "Google Chrome" "http://localhost:5173"

# Attach to the tmux session
tmux attach-session -t $SESSION_NAME
