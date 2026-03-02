#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
#  OpenPMUT Desktop — Stop
#  Cleanly stops all OpenPMUT processes.
# ═══════════════════════════════════════════════════════════════════

echo "Stopping OpenPMUT..."

# Stop Electron
pkill -f "electron.*dist-electron/main.js" 2>/dev/null && echo "  ✓ Electron stopped" || echo "  · Electron not running"

# Stop backend
pkill -f "uvicorn app.main:app.*--port 18765" 2>/dev/null && echo "  ✓ Backend stopped" || echo "  · Backend not running"

# Wait and force-kill if needed
sleep 2
pkill -9 -f "electron.*dist-electron/main.js" 2>/dev/null || true
kill $(lsof -ti:18765) 2>/dev/null || true

echo "Done."
