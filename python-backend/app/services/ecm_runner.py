"""
ECM Runner - Wrapper to execute ECM calculations from the ECM folder

This module provides a bridge between the web API and the ECM calculation scripts.
It handles the conversion of web parameters to ECM main.py parameters.
"""

import os
import sys
import numpy as np
from typing import List, Optional, Dict, Any
from dataclasses import dataclass

# python-backend/ is the root — __file__ is .../python-backend/app/services/ecm_runner.py
BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
ECM_PATH = os.path.join(BACKEND_ROOT, "ECM")
if ECM_PATH not in sys.path:
    sys.path.insert(0, ECM_PATH)
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)


@dataclass
class ECMConfig:
    """
    Configuration for ECM calculation matching main.py variables
    
    Variables:
    - sequence: [i]*N, shape sequence number, polygons in array from left-bottom to right-top
    - polygon_folder_path: where the original polygon files are saved
    - dx: cell gap in x direction (μm)
    - dy: cell gap in y direction (μm)
    - n: number of pistons for splitting one eigen mode per line
    - nx, ny: number of cells in x and y directions
    - n_cells: total number of cells (nx * ny)
    - h_piezo: piezoelectric layer thickness (μm)
    - h_stru: structural layer thickness (μm)
    - n_modes: number of modes in array calculation
    - threshold: threshold to filter out non-vibration pistons
    - freq_range: computation frequencies array
    """
    sequence: List[int]
    polygon_folder_path: str  # where polygon files are saved
    dx: float  # μm
    dy: float  # μm
    n: int  # pistons per line
    nx: int
    ny: int
    h_piezo: float  # μm - piezoelectric layer thickness
    h_stru: float  # μm - structural layer thickness
    n_modes: int
    threshold: float
    freq_range: np.ndarray  # Hz
    
    # Output folder paths
    label_saving_folder_path: Optional[str] = None
    disp_saving_folder_path: Optional[str] = None
    
    @property
    def n_cells(self) -> int:
        """Total number of cells"""
        return self.nx * self.ny
    
    def validate(self) -> bool:
        """Validate configuration"""
        if len(self.sequence) != self.n_cells:
            raise ValueError(f"Sequence length ({len(self.sequence)}) must equal nx * ny ({self.n_cells})")
        return True


def run_ecm_simulation(config: ECMConfig, progress_callback=None) -> Dict[str, Any]:
    """
    Run ECM simulation using the scripts in ECM folder
    
    Args:
        config: ECMConfig with all parameters
        progress_callback: Optional callback for progress updates
        
    Returns:
        Dictionary with simulation results
    """
    try:
        # Import main from ECM folder
        from main import main as ecm_main
        
        config.validate()
        
        if progress_callback:
            progress_callback(10, "Starting ECM calculation")
        
        # Run the ECM main function
        output_power = ecm_main(
            sequence=config.sequence,
            polygon_folder_path=config.polygon_folder_path,
            dx=config.dx * 1e-6,  # Convert μm to m
            dy=config.dy * 1e-6,  # Convert μm to m
            n=config.n,
            threshold=config.threshold,
            nx=config.nx,
            ny=config.ny,
            n_cells=config.n_cells,
            h_piezo=config.h_piezo * 1e-6,  # Convert μm to m
            h_stru=config.h_stru * 1e-6,  # Convert μm to m
            n_modes=config.n_modes,
            freq_range=config.freq_range,
            label_saving_folder_path=config.label_saving_folder_path,
            disp_saving_folder_path=config.disp_saving_folder_path
        )
        
        if progress_callback:
            progress_callback(90, "Processing results")
        
        # Convert output to standard format
        results = process_ecm_output(output_power, config.freq_range)
        
        return results
        
    except ImportError as e:
        print(f"Could not import ECM modules: {e}")
        # Fall back to simplified calculation
        return run_simplified_ecm(config, progress_callback)


def run_simplified_ecm(config: ECMConfig, progress_callback=None) -> Dict[str, Any]:
    """
    Simplified ECM calculation when full ECM scripts are not available
    Uses basic lumped element model
    """
    if progress_callback:
        progress_callback(20, "Running simplified ECM model")
    
    freq_range = config.freq_range
    n_freq = len(freq_range)
    
    # Simplified resonant frequency based on geometry
    # f_res ≈ sqrt(k/m) / (2*pi) 
    # For a typical PMUT: f_res ≈ 1-10 MHz
    f_res_base = 3e6  # Base resonant frequency
    
    # Calculate impedance and power response
    impedance_real = np.zeros(n_freq)
    impedance_imag = np.zeros(n_freq)
    power_db = np.zeros(n_freq)
    
    for mode in range(config.n_modes):
        f_res = f_res_base * (mode + 1) * 0.7  # Mode frequencies
        Q = 50 / (mode + 1)  # Quality factor decreases with mode
        
        for i, f in enumerate(freq_range):
            omega = 2 * np.pi * f
            omega_res = 2 * np.pi * f_res
            
            # Lorentzian response
            response = 1 / np.sqrt((1 - (f/f_res)**2)**2 + (f/(Q*f_res))**2)
            power_db[i] += 20 * np.log10(response + 1e-10)
            
            # Impedance contribution
            impedance_real[i] += response * 100 / (mode + 1)
            impedance_imag[i] += response * 50 * (f/f_res - f_res/f) / (mode + 1)
    
    if progress_callback:
        progress_callback(80, "Calculating phase response")
    
    # Calculate phase
    phase = np.arctan2(impedance_imag, impedance_real) * 180 / np.pi
    
    return {
        "frequencies": freq_range.tolist(),
        "power_db": power_db.tolist(),
        "impedance_real": impedance_real.tolist(),
        "impedance_imag": impedance_imag.tolist(),
        "phase": phase.tolist(),
        "displacement": [0.0] * n_freq,
        "pressure": [0.0] * n_freq,
    }


def process_ecm_output(output_power, freq_range) -> Dict[str, Any]:
    """Process ECM output into standard format"""
    
    # Convert output_power to the expected format
    if isinstance(output_power, np.ndarray):
        power_db = 10 * np.log10(np.abs(output_power) + 1e-20)
    else:
        power_db = np.zeros(len(freq_range))
    
    return {
        "frequencies": freq_range.tolist(),
        "power_db": power_db.tolist(),
        "impedance_real": [0.0] * len(freq_range),
        "impedance_imag": [0.0] * len(freq_range),
        "phase": [0.0] * len(freq_range),
        "displacement": [0.0] * len(freq_range),
        "pressure": [0.0] * len(freq_range),
    }


def create_config_from_request(
    sequence: List[int],
    polygon_folder_path: str,
    dx: float,
    dy: float,
    n: int,
    nx: int,
    ny: int,
    h_piezo: float,
    h_stru: float,
    n_modes: int,
    threshold: float,
    freq_start: float,
    freq_end: float,
    freq_points: int,
    data_folder: Optional[str] = None
) -> ECMConfig:
    """
    Create ECMConfig from API request parameters
    """
    # Generate frequency range
    freq_range = np.linspace(freq_start, freq_end, freq_points)
    
    # Set up folder paths
    base_path = data_folder or os.path.join(ECM_PATH, "data")
    
    return ECMConfig(
        sequence=sequence,
        polygon_folder_path=polygon_folder_path,
        dx=dx,
        dy=dy,
        n=n,
        nx=nx,
        ny=ny,
        h_piezo=h_piezo,
        h_stru=h_stru,
        n_modes=n_modes,
        threshold=threshold,
        freq_range=freq_range,
        label_saving_folder_path=os.path.join(base_path, "temp"),
        disp_saving_folder_path=os.path.join(base_path, "displacement"),
    )
