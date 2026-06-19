#!/bin/bash

# API Development Server Startup Script
# Automatically cleans up old processes before starting

set -e

echo "🧹 Cleaning up old server processes..."

# Kill any processes using port 3000
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "  → Killing process on port 3000..."
    lsof -Pi :3000 -sTCP:LISTEN -t | xargs kill -9 2>/dev/null || true
fi

# Kill any bun server.ts processes
if pgrep -f "bun.*server.ts" >/dev/null 2>&1 ; then
    echo "  → Killing stale bun server processes..."
    pkill -9 -f "bun.*server.ts" 2>/dev/null || true
fi

# Wait a moment for ports to be released
sleep 1

echo "✨ Starting API server..."
echo ""

# Trap to cleanup on exit (Ctrl+C)
cleanup() {
    echo ""
    echo "🛑 Shutting down server..."
    # Kill the bun process
    if [ ! -z "$BUN_PID" ]; then
        kill -TERM $BUN_PID 2>/dev/null || true
    fi
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start the server and capture its PID
bun --watch src/app/server.ts &
BUN_PID=$!

# Wait for the process
wait $BUN_PID
