# OpenPMUT Desktop V2.0.0 — Protected Build

This is the **protected** variant of OpenPMUT-Desktop V2.0.0 (Multi-GPU + Optimized Eigenmode Solver).

## What's Protected

The ECM simulation engine and eigenmode solver contain proprietary algorithms.
In this build, they are compiled to **native binary extensions** (`.so`) using Cython:

| Folder | Status | Details |
|---|---|---|
| `python-backend/ECM/` | 🔒 Compiled | 10 `.so` binaries, zero `.py` source |
| `python-backend/ECM/saving_folder/` | Open | Polygon geometry files (runtime data) |
| `python-backend/eigenmode_solver/` | 🔒 Compiled | 8 `.so` binaries, only `__init__.py` (empty marker) |
| `python-backend/app/` | Open | FastAPI routes/services (no IP) |
| `dist-renderer/` | Open | Built React frontend (minified JS) |
| `dist-electron/` | Open | Electron main process (JS) |

## V2.0.0 Changes vs V1.0.0

- **Multi-GPU acoustic impedance** — `a06` uses fingerprint-based grouping + vectorized padding
- **Optimized eigenmode solver** — LinearNDInterpolator + Delaunay + COO sparse assembly
- **Vectorized pipeline** — a02, a04, a08, a09, a10 use NumPy/SciPy vectorized operations
- **~3× faster** overall pipeline execution (6× faster a06 alone)

## Protection Level

| Threat | Protection |
|---|---|
| **Reading source code** | ✅ All `.py` source removed — only native `.so` machine code |
| **`inspect.getsource()`** | ✅ Fails — Cython functions are `cython_function_or_method` type |
| **`dis.dis()` disassembly** | ✅ Shows only `CACHE` markers — no readable bytecodes |
| **`strings` command** | ✅ No algorithm code visible — only generic Cython runtime strings |
| **`.pyc` bytecode decompile** | ✅ No `.pyc` files exist — all `__pycache__` removed |
| **File permissions** | ✅ `.so` files are `chmod 500` (owner read+execute only) |
| **Reverse engineering** | ✅ Binary → assembly possible, but recovering readable Python is infeasible |
| **Tampering** | ✅ Modifying `.so` binary corrupts the shared object → import fails |

### What an attacker CAN see

- **Function signatures** (parameter names) — needed by Python's calling convention
- **Module names** (a02, a03, ...) — visible as filenames
- These reveal *what* the code does at a high level, but NOT *how* (the algorithms, formulas, constants)

## How to Rebuild (Developers Only)

From the source tree (not this folder):

```bash
cd /path/to/pmut_user_platform
bash OpenPMUT-Desktop-V2.0.0-Protected/build_protected_zip.sh
```

This creates `OpenPMUT-Desktop-V2.0.0.zip` with compiled ECM.

## Constraint

The `.so` files are compiled for **Linux x86_64, Python 3.11**.
If the target machine uses a different Python version, you must recompile with `seal_ecm.py`
using that Python version (e.g., Python 3.10 produces `*.cpython-310-x86_64-linux-gnu.so`).
