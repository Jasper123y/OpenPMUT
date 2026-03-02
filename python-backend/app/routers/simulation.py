"""
Simulation API endpoints for ECM model

Flow (from diagram):
1. User uploads shape.txt → saved as polygon file
2. User provides ECM parameters → sequence, polygon_folder_path, dx, dy, n, nx, ny, h_piezo, h_stru, n_modes, threshold, freq_range
3. ECM computation (internally calculates eigenmodes & eigenfreqs) → output_power
"""

import uuid
import time
import os
import traceback
import threading
import numpy as np
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import Optional, List
from app.schemas.simulation import (
    SimulationRequest, 
    SimulationResponse, 
    SimulationProgress,
    ECMParameters
)
from app.services.ecm_service import ECMService

router = APIRouter()
ecm_service = ECMService()

# In-memory storage
simulation_store = {}
simulation_progress = {}

# Temporary upload folder
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), "..", "..", "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


def _run_simulation_background(
    simulation_id: str,
    shape_file_path: str,
    seq_list: list,
    polygon_folder_path: str,
    dx: float, dy: float, n: int,
    nx: int, ny: int, n_cells: int,
    h_piezo: float, h_stru: float,
    n_modes: int, threshold: float,
    freq_range: np.ndarray,
    shape_filename: str,
    array_arrangement: str = 'interlaced',
):
    """Run ECM simulation in a background thread."""
    try:
        start_time = time.time()
        results = ecm_service.run_simulation(
            shape_file_path=shape_file_path,
            sequence=seq_list,
            polygon_folder_path=polygon_folder_path,
            dx=dx, dy=dy, n=n,
            nx=nx, ny=ny, n_cells=n_cells,
            h_piezo=h_piezo, h_stru=h_stru,
            n_modes=n_modes, threshold=threshold,
            freq_range=freq_range,
            progress_callback=lambda p, s: update_progress(simulation_id, p, s),
            array_arrangement=array_arrangement,
        )

        computation_time = time.time() - start_time

        try:
            import torch
            device_used = "gpu" if torch.cuda.is_available() else "cpu"
        except ImportError:
            device_used = "cpu"

        simulation_store[simulation_id] = {
            "results": results,
            "shape_file": shape_filename,
            "computation_time": computation_time,
            "device_used": device_used,
        }

        simulation_progress[simulation_id] = {
            "status": "completed",
            "progress": 100,
            "current_step": "Done",
        }

        # Cleanup uploaded shape file
        try:
            os.remove(shape_file_path)
        except OSError:
            pass

    except Exception as e:
        traceback.print_exc()
        simulation_progress[simulation_id] = {
            "status": "failed",
            "progress": 0,
            "current_step": f"Error: {str(e)}",
        }


@router.post("/run")
async def run_simulation(
    shape_file: UploadFile = File(..., description="PMUT shape.txt file"),
    sequence: str = Form(default="[1]", description="Shape sequence as JSON array"),
    dx: float = Form(default=460.0, description="Cell gap in x direction (μm)"),
    dy: float = Form(default=250.0, description="Cell gap in y direction (μm)"),
    n: int = Form(default=25, description="Number of pistons per line"),
    nx: int = Form(default=3, description="Number of cells in x direction"),
    ny: int = Form(default=3, description="Number of cells in y direction"),
    h_piezo: float = Form(default=1.0, description="Piezoelectric layer thickness (μm)"),
    h_stru: float = Form(default=5.0, description="Structural layer thickness (μm)"),
    n_modes: int = Form(default=6, description="Number of modes"),
    threshold: float = Form(default=0.05, description="Vibration threshold"),
    freq_start: float = Form(default=0.1e6, description="Start frequency (Hz)"),
    freq_end: float = Form(default=5.1e6, description="End frequency (Hz)"),
    freq_points: int = Form(default=50, description="Number of frequency points"),
    array_arrangement: str = Form(default="interlaced", description="Array arrangement: 'interlaced' or 'normal'"),
):
    """
    Launch ECM simulation in the background.

    Returns a simulation_id immediately.  The frontend should poll
    /progress/{simulation_id} until status == "completed", then fetch
    full results from /result/{simulation_id}.
    """
    try:
        simulation_id = str(uuid.uuid4())[:8]

        # Parse sequence
        import json
        try:
            seq_list = json.loads(sequence)
        except json.JSONDecodeError:
            seq_list = [1]

        # Save uploaded shape file
        shape_file_path = os.path.join(UPLOAD_FOLDER, f"{simulation_id}_{shape_file.filename}")
        with open(shape_file_path, "wb") as f:
            content = await shape_file.read()
            f.write(content)

        n_cells = len(seq_list) if seq_list else nx * ny
        freq_range = np.linspace(freq_start, freq_end, freq_points)

        # Create polygon folder
        polygon_folder_path = os.path.join(UPLOAD_FOLDER, f"{simulation_id}_polygons")
        os.makedirs(polygon_folder_path, exist_ok=True)
        import shutil
        for shape_idx in sorted(set(seq_list)):
            shutil.copy2(shape_file_path, os.path.join(polygon_folder_path, f"polygon{shape_idx}.txt"))

        # Initialize progress
        simulation_progress[simulation_id] = {
            "status": "running",
            "progress": 0,
            "current_step": "Queued",
        }

        # Launch simulation in a background thread
        thread = threading.Thread(
            target=_run_simulation_background,
            kwargs=dict(
                simulation_id=simulation_id,
                shape_file_path=shape_file_path,
                seq_list=seq_list,
                polygon_folder_path=polygon_folder_path,
                dx=dx, dy=dy, n=n,
                nx=nx, ny=ny, n_cells=n_cells,
                h_piezo=h_piezo, h_stru=h_stru,
                n_modes=n_modes, threshold=threshold,
                freq_range=freq_range,
                shape_filename=shape_file.filename,
                array_arrangement=array_arrangement,
            ),
            daemon=True,
        )
        thread.start()

        return {
            "success": True,
            "message": "Simulation started. Poll /progress/{simulation_id} for status.",
            "simulation_id": simulation_id,
        }

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upload-shape")
async def upload_shape_file(shape_file: UploadFile = File(...)):
    """
    Upload a shape.txt file and return the path for use with /run-json endpoint.
    """
    try:
        file_id = str(uuid.uuid4())[:8]
        shape_file_path = os.path.join(UPLOAD_FOLDER, f"{file_id}_{shape_file.filename}")
        
        with open(shape_file_path, "wb") as f:
            content = await shape_file.read()
            f.write(content)
        
        return {
            "success": True,
            "shape_file_path": shape_file_path,
            "filename": shape_file.filename
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/run-json", response_model=SimulationResponse)
async def run_simulation_json(request: SimulationRequest):
    """
    Alternative endpoint using JSON body (requires shape_file_path in request).
    For when shape file is already uploaded via /upload-shape endpoint.
    """
    
    try:
        start_time = time.time()
        simulation_id = str(uuid.uuid4())[:8]
        
        # Validate shape_file_path
        if not request.shape_file_path:
            raise HTTPException(
                status_code=400, 
                detail="shape_file_path is required. Use /upload-shape first."
            )
        
        if not os.path.exists(request.shape_file_path):
            raise HTTPException(
                status_code=404, 
                detail=f"Shape file not found: {request.shape_file_path}"
            )
        
        # Get ECM parameters from request
        ecm_params = request.ecm_params
        
        # Calculate n_cells from sequence or nx*ny
        n_cells = len(ecm_params.sequence) if ecm_params.sequence else ecm_params.nx * ecm_params.ny
        
        # Generate frequency range
        freq_range = np.linspace(
            request.freq_start,
            request.freq_end,
            request.freq_points
        )
        
        # Create polygon folder and save shape file there
        polygon_folder_path = os.path.join(UPLOAD_FOLDER, f"{simulation_id}_polygons")
        os.makedirs(polygon_folder_path, exist_ok=True)
        import shutil
        for shape_idx in sorted(set(ecm_params.sequence)):
            shutil.copy2(request.shape_file_path, os.path.join(polygon_folder_path, f"polygon{shape_idx}.txt"))
        
        # Initialize progress
        simulation_progress[simulation_id] = {
            "status": "running",
            "progress": 0,
            "current_step": "Initializing"
        }
        
        # Run simulation: shape.txt → ECM → output_power
        results = ecm_service.run_simulation(
            shape_file_path=request.shape_file_path,
            sequence=ecm_params.sequence,
            polygon_folder_path=polygon_folder_path,
            dx=ecm_params.dx,
            dy=ecm_params.dy,
            n=ecm_params.n,
            nx=ecm_params.nx,
            ny=ecm_params.ny,
            n_cells=n_cells,
            h_piezo=ecm_params.h_piezo,
            h_stru=ecm_params.h_stru,
            n_modes=ecm_params.n_modes,
            threshold=ecm_params.threshold,
            freq_range=freq_range,
            progress_callback=lambda p, s: update_progress(simulation_id, p, s)
        )
        
        computation_time = time.time() - start_time
        
        # Store simulation results (includes file paths for PNG serving)
        simulation_store[simulation_id] = {
            "results": results,
            "shape_file": request.shape_file_path,
        }
        
        # Update progress to complete
        simulation_progress[simulation_id] = {
            "status": "completed",
            "progress": 100,
            "current_step": "Done"
        }
        
        # Cleanup uploaded file
        try:
            os.remove(request.shape_file_path)
        except:
            pass
        
        try:
            import torch
            device_used = "gpu" if torch.cuda.is_available() else "cpu"
        except ImportError:
            device_used = "cpu"
        
        return SimulationResponse(
            success=True,
            message="ECM simulation completed successfully",
            simulation_id=simulation_id,
            computation_time=computation_time,
            device_used=device_used,
            peak_frequency=results.get("peak_frequency", 0),
            peak_power=results.get("peak_power", 0),
            bandwidth_3db=results.get("bandwidth_3db", 0),
            frequencies=results.get("frequencies"),
            output_power=results.get("output_power"),
            power_db=results.get("power_db"),
            impedance_real=results.get("impedance_real"),
            impedance_imag=results.get("impedance_imag"),
            phase=results.get("phase"),
            has_vibration=len(results.get("frame_pngs", [])) > 0,
            n_vibration_frames=len(results.get("frame_pngs", [])),
        )
        
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


def update_progress(simulation_id: str, progress: float, step: str):
    """Update simulation progress"""
    simulation_progress[simulation_id] = {
        "status": "running",
        "progress": progress,
        "current_step": step
    }


@router.get("/progress/{simulation_id}", response_model=SimulationProgress)
async def get_simulation_progress(simulation_id: str):
    """Get simulation progress"""
    
    if simulation_id not in simulation_progress:
        raise HTTPException(status_code=404, detail="Simulation not found")
    
    prog = simulation_progress[simulation_id]
    return SimulationProgress(
        status=prog["status"],
        progress=prog["progress"],
        current_step=prog["current_step"]
    )


@router.get("/result/{simulation_id}")
async def get_simulation_result(simulation_id: str):
    """
    Fetch full simulation results after background run completes.
    The frontend calls this once progress.status == 'completed'.
    """
    if simulation_id not in simulation_progress:
        raise HTTPException(status_code=404, detail="Simulation not found")

    prog = simulation_progress[simulation_id]
    if prog["status"] == "failed":
        raise HTTPException(status_code=500, detail=prog.get("current_step", "Simulation failed"))
    if prog["status"] != "completed":
        raise HTTPException(status_code=202, detail="Simulation still running")

    if simulation_id not in simulation_store:
        raise HTTPException(status_code=404, detail="Results not found")

    stored = simulation_store[simulation_id]
    results = stored["results"]

    return {
        "success": True,
        "message": "ECM simulation completed successfully",
        "simulation_id": simulation_id,
        "computation_time": stored.get("computation_time", 0),
        "device_used": stored.get("device_used", "cpu"),
        "peak_frequency": results.get("peak_frequency", 0),
        "peak_power": results.get("peak_power", 0),
        "bandwidth_3db": results.get("bandwidth_3db", 0),
        "frequencies": results.get("frequencies"),
        "output_power": results.get("output_power"),
        "power_db": results.get("power_db"),
        "impedance_real": results.get("impedance_real"),
        "impedance_imag": results.get("impedance_imag"),
        "phase": results.get("phase"),
        "has_vibration": len(results.get("frame_pngs", [])) > 0,
        "n_vibration_frames": len(results.get("frame_pngs", [])),
    }


@router.get("/{simulation_id}")
async def get_simulation(simulation_id: str):
    """Get simulation results by ID"""
    
    if simulation_id not in simulation_store:
        raise HTTPException(status_code=404, detail="Simulation not found")
    
    return simulation_store[simulation_id]


@router.get("/devices/available")
async def get_available_devices():
    """Get available compute devices"""
    
    devices = [
        {
            "id": "cpu",
            "name": "CPU",
            "available": True,
            "description": "Multi-core CPU computation"
        }
    ]
    
    # Try to detect GPU
    try:
        import torch
        if torch.cuda.is_available():
            devices.append({
                "id": "gpu",
                "name": f"GPU ({torch.cuda.get_device_name(0)})",
                "available": True,
                "description": "NVIDIA GPU acceleration"
            })
        else:
            devices.append({
                "id": "gpu",
                "name": "GPU",
                "available": False,
                "description": "No GPU detected"
            })
    except (ImportError, OSError):
        devices.append({
            "id": "gpu",
            "name": "GPU",
            "available": False,
            "description": "PyTorch not available"
        })
    
    devices.append({
        "id": "colab",
        "name": "Google Colab",
        "available": True,
        "description": "Free GPU access via Google Colab"
    })
    
    return {"devices": devices}
