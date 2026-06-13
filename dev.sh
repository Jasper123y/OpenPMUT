#!/usr/bin/env bash
#
# OpenPMUT Desktop - Development Launcher
# Starts both the Python backend and Electron app in dev mode
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Cleanup function
cleanup() {
    echo ""
    echo "[OpenPMUT] Shutting down..."
    if [ -n "${BACKEND_PID:-}" ]; then
        kill "$BACKEND_PID" 2>/dev/null || true
        wait "$BACKEND_PID" 2>/dev/null || true
    fi
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

export OPENPMUT_DESKTOP=1
export OPENPMUT_PORT=18765

# Start the Python backend
echo "[OpenPMUT] Starting Python backend on port $OPENPMUT_PORT..."
cd python-backend
python -m uvicorn app.main:app --host 127.0.0.1 --port "$OPENPMUT_PORT" --reload &
BACKEND_PID=$!
cd "$SCRIPT_DIR"

# Wait for backend to be ready
echo "[OpenPMUT] Waiting for backend..."
for i in $(seq 1 30); do
    if curl -sf "http://127.0.0.1:$OPENPMUT_PORT/health" > /dev/null 2>&1; then
        echo "[OpenPMUT] Backend is ready!"
        break
    fi
    sleep 1
done

# Start Electron in dev mode (Vite dev server + Electron)
echo "[OpenPMUT] Starting Electron app..."
npx vite &
VITE_PID=$!

# Wait for Vite to start
sleep 3

# Compile and launch Electron main process
npx tsc -p tsconfig.electron.json
npx electron dist-electron/main.js

# If electron exits, cleanup
cleanup
