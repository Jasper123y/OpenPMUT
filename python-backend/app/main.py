"""
OpenPMUT Desktop - Backend Server

Physics-Informed Neural Networks for MEMS Ultrasonic Arrays
Adapted for standalone desktop application (Electron).
"""

import os
import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager

from app.routers import geometry, prediction, simulation, output, system
from app.services.model_loader import load_models

# Desktop mode detection
IS_DESKTOP = os.environ.get("OPENPMUT_DESKTOP", "0") == "1"
BACKEND_PORT = int(os.environ.get("OPENPMUT_PORT", "18765"))

# Resolve paths - in desktop mode, resources may be in app.asar.unpacked
BACKEND_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BACKEND_DIR.parent


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load ML models on startup"""
    print(f"[OpenPMUT] Starting backend (desktop={IS_DESKTOP}, port={BACKEND_PORT})")
    print(f"[OpenPMUT] Backend dir: {BACKEND_DIR}")
    print("[OpenPMUT] Loading PINN models...")
    app.state.models = load_models()
    print("[OpenPMUT] Models loaded successfully!")
    yield
    print("[OpenPMUT] Shutting down backend...")


app = FastAPI(
    title="OpenPMUT Desktop Backend",
    description="Physics-Informed Neural Networks for Ultra-Fast PMUT Simulation",
    version="1.0.0",
    lifespan=lifespan
)

# CORS - allow Electron renderer (file:// sends null origin) and local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Desktop app: allow all origins (Electron file:// + dev)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(geometry.router, prefix="/api/geometry", tags=["Geometry"])
app.include_router(prediction.router, prefix="/api/prediction", tags=["Prediction"])
app.include_router(simulation.router, prefix="/api/simulation", tags=["Simulation"])
app.include_router(output.router, prefix="/api/output", tags=["Output"])
app.include_router(system.router, prefix="/api/system", tags=["System"])


@app.get("/")
async def root():
    return {
        "message": "OpenPMUT Desktop Backend API",
        "version": "1.0.0",
        "desktop": IS_DESKTOP,
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy", "desktop": IS_DESKTOP}


# In production desktop mode, serve the built frontend AFTER all API routes
if IS_DESKTOP:
    frontend_dir = PROJECT_ROOT / "dist-renderer"
    if frontend_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(frontend_dir / "assets")), name="assets")

        @app.get("/{full_path:path}")
        async def serve_spa(full_path: str):
            """Serve SPA - any non-API route returns index.html"""
            # Don't serve SPA for API or health/docs routes
            if full_path.startswith("api/") or full_path in ("health", "docs", "openapi.json", "redoc"):
                return None  # Will 404 correctly
            file_path = frontend_dir / full_path
            if file_path.exists() and file_path.is_file():
                return FileResponse(str(file_path))
            return FileResponse(str(frontend_dir / "index.html"))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=BACKEND_PORT,
        log_level="info",
        reload=not IS_DESKTOP,  # Reload only in dev mode
    )
