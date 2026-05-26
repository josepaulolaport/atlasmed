# Server Management Scripts

## Quick Start

### Option 1: Auto-cleanup Script (Recommended)
```bash
cd apps/api
bun run dev
```
This now uses `dev.sh` which automatically:
- Kills any processes on port 3000
- Cleans up stale bun server processes
- Handles cleanup on Ctrl+C

### Option 2: Manual Cleanup
```bash
cd apps/api
./kill-server.sh  # Kill all servers
bun run dev:direct  # Start without auto-cleanup
```

### Option 3: Direct Command
```bash
cd apps/api
bun --watch src/app/server.ts
```

## Available Scripts

### `bun run dev`
Starts server with automatic cleanup (uses dev.sh)
- Auto-kills old processes
- Cleans up on exit

### `bun run dev:direct`
Starts server without cleanup script

### `./kill-server.sh`
Manually kill all server processes
- Kills processes on port 3000
- Kills all bun server.ts processes

### `bun run predev`
Runs automatically before `bun run dev`
- Kills processes on port 3000

## Files Created

- **dev.sh** - Main startup script with auto-cleanup
- **kill-server.sh** - Manual cleanup script
- **package.json** - Updated with new scripts

## How It Works

1. **Automatic Port Cleanup**: Before starting, checks if port 3000 is in use and kills the process
2. **Process Cleanup**: Kills any stale `bun server.ts` processes
3. **Graceful Shutdown**: Traps Ctrl+C to clean up properly on exit

## Benefits

- ✅ No more "port already in use" errors
- ✅ No need to manually find and kill processes
- ✅ Clean restarts every time
- ✅ Proper cleanup on Ctrl+C

## Troubleshooting

If you still have port issues:
```bash
# Check what's using port 3000
lsof -i :3000

# Kill everything
./kill-server.sh

# Start fresh
bun run dev
```
