#!/bin/bash

# Kill all API server processes
echo "🧹 Killing all API server processes..."

# Kill processes on port 3000
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "  → Killing process on port 3000..."
    lsof -Pi :3000 -sTCP:LISTEN -t | xargs kill -9 2>/dev/null || true
fi

# Kill any bun server.ts processes
if pgrep -f "bun.*server.ts" >/dev/null 2>&1 ; then
    echo "  → Killing bun server processes..."
    pkill -9 -f "bun.*server.ts" 2>/dev/null || true
fi

echo "✅ All server processes killed"
