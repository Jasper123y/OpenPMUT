# OpenPMUT Desktop V2.0.2

## Tutorial Video

https://youtu.be/X6-YhKmTe_k

---

A standalone desktop application for PMUT (Piezoelectric Micromachined Ultrasonic Transducer) array simulation using Equivalent Circuit Modelling (ECM) with **multi-GPU acceleration** and an **optimized eigenmode solver**.

## What's New in V2.0.2

**Fix: works from a fresh download.** Previously, the app could only run from the
full release zip because the Electron runtime and the built app files were not
part of the GitHub source package. Now:

- The built app files (`dist-electron/`, `dist-renderer/`) ship in the repository,
  so a GitHub download is immediately runnable.
- On first run, `./openpmut` **automatically downloads the Electron runtime**
  (~170 MB, one-time) if it is not already bundled — no Node.js/npm needed.

## What's New in V2.0.1

| Component | V1.0.0 | V2.0.1 | Speedup |
|---|---|---|---|
| **a02** eigenmodes | `griddata` (rebuild Delaunay per mode) | `LinearNDInterpolator` + pre-built `Delaunay` | 3.4× |
| **a04** stacking | Nested Python loops | `RectBivariateSpline` vectorized | 270× |
| **a06** acoustic impedance | Single-GPU | Multi-GPU batched CuPy kernels | 12.7× |
| **a08** mechanical impedance | Python loops | Vectorized NumPy | 40× |
| **a09** power calculation | Sequential solves | Batch linear algebra | 4× |
| **Eigenmode solver** | `lil_matrix` loops | Vectorized COO sparse + cached Delaunay | 2–4× |
| **Overall pipeline** | ~47 s | ~3.7 s | **12.7×** |

All optimizations produce **bit-identical results** to V1.0.0 (verified across 10 frequency points, 1–10 MHz, 3×3 multi-polygon array).

**V2.0.1 physics change:** `a02` eigenmodes now use `fast_eigenmode_solver_biharmonic_only` and `a03` eigenfrequencies use `fast_eigenmode_solver_biharmonic_mindlin` (Mindlin shear correction). Frequency values therefore differ from V2.0.0's prestress-based model.

---

## Quick Start

**Option 1 — Release zip (recommended):** download `OpenPMUT-Desktop-V2.0.2.zip`,
extract it, and run:

```bash
cd OpenPMUT-Desktop-V2.0.2
./openpmut
```

The Electron runtime is already bundled in the zip.

**Option 2 — GitHub source download:** download the repository zip (or clone it),
extract, and run `./openpmut` in the folder. On **first run** it will:

1. Guide you through setting up a Python environment
2. Download the Electron runtime automatically (requires internet, one-time)

Then it launches normally. On **first run** `./openpmut` will guide you through setting up a Python environment:
- If you already have conda activated with the right packages → it just works
- If you have conda but no suitable env → it offers to create one (`openpmut`)
- If conda is not loaded → it detects Environment Modules (`module load`) or common paths
- If you don't have conda at all → it offers to install Miniconda for you

After the first run, `./openpmut` remembers your Python path (saved inside the installation folder as `.python_path`).
On subsequent runs it shows the saved environment and asks you to confirm — press Enter to reuse it instantly.
Closing the window kills the backend and exits cleanly — just run `./openpmut` again to relaunch.

---

## Requirements

| Requirement | Details |
|---|---|
| **Linux x86_64** | Tested on CentOS/RHEL/Ubuntu |
| **NVIDIA GPU + CUDA** | Required for simulation |
| **X11 display** | `echo $DISPLAY` should show `:0` or similar |

**No Node.js/npm required** — the Electron runtime is bundled in the release zip,
or downloaded automatically on first run from a source download.
Python and conda will be set up automatically by `./openpmut` if not already available.

---

## Usage

```bash
# Standard launch
./openpmut

# Specify Python explicitly (skip auto-detection)
./openpmut --python /path/to/python

# Custom port (if 18765 is taken)
./openpmut --port 19000

# Re-select conda/Python environment
./openpmut --reset

# Show version
./openpmut --version

# Stop all OpenPMUT processes
./stop.sh

# Help
./openpmut --help
```

---

## What's Inside the Zip

```
OpenPMUT-Desktop/
├── openpmut               # ← Main launcher script (V2.0.1)
├── stop.sh                # Stop all processes
├── README.md              # This file
├── package.json           # Node.js package metadata
├── dist-electron/         # Compiled Electron main process (JS)
│   ├── main.js            #   Electron entry point
│   └── preload.js         #   IPC bridge
├── dist-renderer/         # Built React frontend (HTML/JS/CSS)
│   ├── index.html
│   └── assets/
├── python-backend/        # FastAPI backend + simulation engine
│   ├── app/               #   FastAPI routes, services, schemas
│   ├── ECM/               #   ECM simulation pipeline (a02–a11)
│   ├── eigenmode_solver/  #   Eigenmode analysis
│   ├── eigenprediction/   #   PINN-based prediction + model weights
│   ├── models/            #   Pre-trained model files
│   ├── examples/          #   Example shape files
│   └── output/            #   Simulation output directory
├── assets/icons/          # App icon (SVG)
└── node_modules/electron/ # Bundled Electron runtime (~130MB)
```

---

## Building the Zip (For Developers)

### Prerequisites

Build must be done from the **source tree** (not from an extracted zip):

```
/path/to/pmut_user_platform/OpenPMUT-Desktop/   # source directory
```

You need Node.js (≥18) and npm installed for building.

### Step 1 — Install dependencies and build

```bash
cd /path/to/OpenPMUT-Desktop

# Install Node.js dependencies (only needed once)
npm install --legacy-peer-deps

# Build the frontend (React → dist-renderer/)
npm run build

# Build the Electron main process (TypeScript → dist-electron/)
npx tsc -p tsconfig.electron.json
```

### Step 2 — Create the zip

From the **parent directory** of `OpenPMUT-Desktop/`:

```bash
cd /path/to/parent-of-OpenPMUT-Desktop/

zip -r OpenPMUT-Desktop.zip OpenPMUT-Desktop/ \
  -x "OpenPMUT-Desktop/node_modules/*" \
     "OpenPMUT-Desktop/src/*" \
     "OpenPMUT-Desktop/electron/*" \
     "OpenPMUT-Desktop/tsconfig*" \
     "OpenPMUT-Desktop/postcss*" \
     "OpenPMUT-Desktop/tailwind*" \
     "OpenPMUT-Desktop/vite*" \
     "OpenPMUT-Desktop/index.html" \
     "OpenPMUT-Desktop/dev.sh" \
     "OpenPMUT-Desktop/build.sh" \
     "OpenPMUT-Desktop/.gitignore" \
     "OpenPMUT-Desktop/.python_path" \
  --symlinks

# Then add ONLY the electron runtime back (from node_modules)
zip -r OpenPMUT-Desktop.zip OpenPMUT-Desktop/node_modules/electron/ --symlinks
```

### What's INCLUDED in the zip

| Path | Why |
|---|---|
| `openpmut` | Main launcher script |
| `stop.sh` | Process cleanup script |
| `README.md` | Documentation |
| `package.json` | App metadata (version, name) |
| `dist-electron/` | Compiled Electron JS (main.js, preload.js) |
| `dist-renderer/` | Built React frontend (index.html, assets/) |
| `python-backend/` | Full backend: FastAPI app, ECM, eigenmode_solver, eigenprediction, models, examples, output |
| `assets/` | App icons |
| `node_modules/electron/` | **Only** the Electron runtime binary (~130MB) |

### What's EXCLUDED from the zip

| Path | Why |
|---|---|
| `node_modules/*` (except `electron/`) | Not needed at runtime — only Electron binary is required |
| `src/` | React/TypeScript source — already compiled to `dist-renderer/` |
| `electron/` | Electron TypeScript source — already compiled to `dist-electron/` |
| `tsconfig*.json` | TypeScript config — build-time only |
| `postcss.config.js` | PostCSS config — build-time only |
| `tailwind.config.js` | Tailwind CSS config — build-time only |
| `vite.config.ts` | Vite bundler config — build-time only |
| `index.html` | Vite entry point — `dist-renderer/index.html` is used instead |
| `dev.sh`, `build.sh` | Developer scripts — not needed by users |
| `.gitignore` | Git config |
| `.python_path` | Per-installation saved Python path — must NOT ship in zip (created on first run) |

### Expected zip size

~138MB (mostly the bundled Electron binary).

### Verifying the zip

```bash
# Extract to a test directory
mkdir /tmp/test-openpmut && cd /tmp/test-openpmut
unzip OpenPMUT-Desktop.zip

# Set permissions
chmod +x OpenPMUT-Desktop/openpmut
chmod +x OpenPMUT-Desktop/stop.sh
chmod +x OpenPMUT-Desktop/node_modules/electron/dist/electron

# Verify syntax
bash -n OpenPMUT-Desktop/openpmut

# Verify no .python_path shipped
ls OpenPMUT-Desktop/.python_path 2>/dev/null && echo "ERROR: .python_path should not be in zip" || echo "OK"

# Launch
cd OpenPMUT-Desktop
./openpmut
```

---

## Troubleshooting

| Problem | Solution |
|---|---|
| App doesn't start | Check `~/.openpmut/launch.log` |
| "Missing packages" | `./openpmut` will offer to create a new env for you |
| No display / blank | Need X11: use `ssh -X` or set `DISPLAY` |
| Port already in use | `./openpmut --port 19000` or `./stop.sh` first |
| GPU not detected | Install CuPy: `pip install cupy-cuda12x` (CPU still works) |
| Want to re-select env | `./openpmut --reset` |
| Window close didn't kill backend | Run `./stop.sh` to clean up |

Logs: `~/.openpmut/launch.log`
