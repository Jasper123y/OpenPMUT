#!/usr/bin/env bash
#
# OpenPMUT Desktop - Build & Package Script
# Creates distributable Linux packages (AppImage, .deb, .rpm)
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "╔══════════════════════════════════════════╗"
echo "║     OpenPMUT Desktop - Build Script      ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# Step 1: Install npm dependencies
echo "[1/4] Installing npm dependencies..."
if [ ! -d "node_modules" ]; then
    npm install --legacy-peer-deps
else
    echo "  → node_modules exists, skipping install"
fi

# Step 2: Build the renderer (React + Vite)
echo ""
echo "[2/4] Building frontend (React + Vite)..."
npx vite build

# Step 3: Build the Electron main process
echo ""
echo "[3/4] Compiling Electron main process..."
npx tsc -p tsconfig.electron.json

# Step 4: Package
echo ""
echo "[4/4] Packaging for Linux..."
FORMAT="${1:-AppImage}"  # Default: AppImage
echo "  → Target format: $FORMAT"

case "$FORMAT" in
    AppImage|appimage)
        npx electron-builder --linux AppImage
        ;;
    deb)
        npx electron-builder --linux deb
        ;;
    rpm)
        npx electron-builder --linux rpm
        ;;
    all)
        npx electron-builder --linux AppImage deb rpm
        ;;
    *)
        echo "Unknown format: $FORMAT"
        echo "Usage: $0 [AppImage|deb|rpm|all]"
        exit 1
        ;;
esac

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║          Build Complete!                 ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "Output files in: $SCRIPT_DIR/release/"
ls -lh "$SCRIPT_DIR/release/" 2>/dev/null || echo "(no release directory yet)"
