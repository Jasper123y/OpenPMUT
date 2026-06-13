#!/usr/bin/env bash
#
# build_protected_zip.sh — Build a distributable zip of OpenPMUT-Desktop V2.0.0
# with ECM and eigenmode_solver compiled to native .so binaries.
#
# This script:
#   1. Copies OpenPMUT-Desktop-V2.0.0 → a temp staging dir
#   2. Builds frontend (React → dist-renderer/) if not already built
#   3. Builds Electron (TS → dist-electron/) if not already built
#   4. Runs seal_ecm.py to compile ECM + eigenmode_solver → .so
#   5. Removes all dev-only / source files from the staging dir
#   6. Creates OpenPMUT-Desktop-V2.0.0.zip
#
# Usage:
#   cd /path/to/pmut_user_platform
#   bash OpenPMUT-Desktop-V2.0.0-Protected/build_protected_zip.sh
#
# Output:
#   ./OpenPMUT-Desktop-V2.0.0.zip  (ready to distribute)
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SOURCE_DIR="$PROJECT_ROOT/OpenPMUT-Desktop-V2.0.0"
STAGE_DIR="/tmp/openpmut-v2-build-$$"
OUTPUT_ZIP="$PROJECT_ROOT/OpenPMUT-Desktop-V2.0.0.zip"

echo "========================================"
echo "  OpenPMUT V2.0.0 Protected Build"
echo "========================================"
echo "  Source:  $SOURCE_DIR"
echo "  Stage:   $STAGE_DIR"
echo "  Output:  $OUTPUT_ZIP"
echo ""

# ── Cleanup on exit ──────────────────────────────────────────────────
cleanup() { rm -rf "$STAGE_DIR"; }
trap cleanup EXIT

# ── Step 1: Ensure source is built ──────────────────────────────────
echo "▶ Step 1: Checking builds..."
if [[ ! -d "$SOURCE_DIR/dist-renderer" ]]; then
    echo "  Building frontend (npm run build)..."
    (cd "$SOURCE_DIR" && npm run build 2>&1 | tail -3)
fi
if [[ ! -f "$SOURCE_DIR/dist-electron/main.js" ]]; then
    echo "  Building Electron (tsc)..."
    (cd "$SOURCE_DIR" && npx tsc -p tsconfig.electron.json 2>&1 | tail -3)
fi
echo "  ✓ Builds OK"

# ── Step 2: Stage a clean copy ──────────────────────────────────────
echo ""
echo "▶ Step 2: Staging clean copy..."
mkdir -p "$STAGE_DIR/OpenPMUT-Desktop-V2.0.0"

# Copy only what ships in the zip (skip node_modules for now)
for item in openpmut stop.sh README.md package.json \
            dist-electron dist-renderer python-backend assets; do
    if [[ -e "$SOURCE_DIR/$item" ]]; then
        cp -a "$SOURCE_DIR/$item" "$STAGE_DIR/OpenPMUT-Desktop-V2.0.0/$item"
    fi
done

# Remove backup/old a06 files that should NOT ship
rm -f "$STAGE_DIR/OpenPMUT-Desktop-V2.0.0/python-backend/ECM/a06_accoustic_impedance_matrix_multi_GPU_acceleration_backup.py"
rm -f "$STAGE_DIR/OpenPMUT-Desktop-V2.0.0/python-backend/ECM/a06_accoustic_impedance_matrix_multi_GPU_acceleration_old.py"

# Copy ONLY the electron runtime from node_modules
if [[ -d "$SOURCE_DIR/node_modules/electron" ]]; then
    mkdir -p "$STAGE_DIR/OpenPMUT-Desktop-V2.0.0/node_modules"
    cp -a "$SOURCE_DIR/node_modules/electron" "$STAGE_DIR/OpenPMUT-Desktop-V2.0.0/node_modules/electron"
fi
echo "  ✓ Staged"

# ── Step 3: Copy seal script & run it ───────────────────────────────
echo ""
echo "▶ Step 3: Sealing ECM + eigenmode_solver..."
cp "$SCRIPT_DIR/seal_ecm.py" "$STAGE_DIR/OpenPMUT-Desktop-V2.0.0/seal_ecm.py"
(cd "$STAGE_DIR/OpenPMUT-Desktop-V2.0.0" && python3 seal_ecm.py 2>&1)
echo ""

# ── Step 4: Remove seal script + dev artifacts from staging ─────────
echo "▶ Step 4: Cleaning dev artifacts from staging..."
rm -f  "$STAGE_DIR/OpenPMUT-Desktop-V2.0.0/seal_ecm.py"
rm -f  "$STAGE_DIR/OpenPMUT-Desktop-V2.0.0/.python_path"
rm -rf "$STAGE_DIR/OpenPMUT-Desktop-V2.0.0/python-backend/__pycache__"
rm -rf "$STAGE_DIR/OpenPMUT-Desktop-V2.0.0/python-backend/app/__pycache__"
rm -rf "$STAGE_DIR/OpenPMUT-Desktop-V2.0.0/python-backend/app/services/__pycache__"
rm -rf "$STAGE_DIR/OpenPMUT-Desktop-V2.0.0/python-backend/app/routers/__pycache__"
rm -rf "$STAGE_DIR/OpenPMUT-Desktop-V2.0.0/python-backend/app/schemas/__pycache__"
rm -rf "$STAGE_DIR/OpenPMUT-Desktop-V2.0.0/python-backend/uploads"
# Remove any leftover .pyc
find "$STAGE_DIR" -name "*.pyc" -delete
find "$STAGE_DIR" -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true
echo "  ✓ Clean"

# ── Step 5: Set permissions ─────────────────────────────────────────
echo ""
echo "▶ Step 5: Setting permissions..."
chmod +x "$STAGE_DIR/OpenPMUT-Desktop-V2.0.0/openpmut"
chmod +x "$STAGE_DIR/OpenPMUT-Desktop-V2.0.0/stop.sh"
if [[ -f "$STAGE_DIR/OpenPMUT-Desktop-V2.0.0/node_modules/electron/dist/electron" ]]; then
    chmod +x "$STAGE_DIR/OpenPMUT-Desktop-V2.0.0/node_modules/electron/dist/electron"
fi
echo "  ✓ Permissions set"

# ── Step 6: Create zip ──────────────────────────────────────────────
echo ""
echo "▶ Step 6: Creating zip..."
rm -f "$OUTPUT_ZIP"
(cd "$STAGE_DIR" && zip -r "$OUTPUT_ZIP" OpenPMUT-Desktop-V2.0.0/ --symlinks -q)
ZIP_SIZE=$(du -sh "$OUTPUT_ZIP" | cut -f1)
echo "  ✓ $OUTPUT_ZIP ($ZIP_SIZE)"

# ── Step 7: Verify ──────────────────────────────────────────────────
echo ""
echo "▶ Step 7: Verifying zip contents..."
PY_IN_ECM=$(zipinfo -1 "$OUTPUT_ZIP" | grep -c "ECM/.*\.py$" || true)
SO_IN_ECM=$(zipinfo -1 "$OUTPUT_ZIP" | grep -c "ECM/.*\.so$" || true)
PY_IN_EIGEN=$(zipinfo -1 "$OUTPUT_ZIP" | grep -c "eigenmode_solver/.*\.py$" || true)
SO_IN_EIGEN=$(zipinfo -1 "$OUTPUT_ZIP" | grep -c "eigenmode_solver/.*\.so$" || true)
SEAL_SCRIPT=$(zipinfo -1 "$OUTPUT_ZIP" | grep -c "seal_ecm" || true)

echo "  ECM:              $SO_IN_ECM .so files, $PY_IN_ECM .py files"
echo "  eigenmode_solver: $SO_IN_EIGEN .so files, $PY_IN_EIGEN .py files"
echo "  seal_ecm.py:      $([ "$SEAL_SCRIPT" -eq 0 ] && echo 'NOT included ✓' || echo 'INCLUDED ✗')"

echo ""
echo "========================================"
echo "  BUILD COMPLETE — V2.0.0"
echo "  $OUTPUT_ZIP"
echo "========================================"
