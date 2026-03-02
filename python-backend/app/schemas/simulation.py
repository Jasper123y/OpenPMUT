"""
Simulation schemas for ECM model

Flow (from diagram):
1. User Interface → shape.txt → polygon folder
2. User Interface → ECM parameters (sequence, polygon_folder_path, dx, dy, n, nx, ny, h_piezo, h_stru, etc.)
3. Both inputs → ECM → output_power

ECM Variables from main.py:
- sequence: [i]*N, shape sequence number, i is shape index, N is cell count
- polygon_folder_path: where the original polygon files are saved
- dx, dy: cell gap in x and y directions (μm)
- n: number of pistons for splitting one eigen mode per line
- nx, ny: number of cells in x and y directions
- n_cells, n_modes: number of cells and modes in array calculation
- h_piezo: piezoelectric layer thickness (μm)
- h_stru: structural layer thickness (μm)
- threshold: threshold to filter out non-vibration pistons
- freq_range: computation frequencies, e.g., np.arange(2.1e6, 10.1e6, 0.1e6)
"""

from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field


class ComputeDevice(str, Enum):
    """Available compute devices"""
    CPU = "cpu"
    GPU = "gpu"
    COLAB = "colab"  # Google Colab integration


class MediumType(str, Enum):
    """Acoustic medium types"""
    AIR = "air"
    WATER = "water"
    TISSUE = "tissue"
    CUSTOM = "custom"


class ECMParameters(BaseModel):
    """ECM-specific parameters matching main.py variables"""
    
    # sequence: shape indices for each cell in the array
    sequence: List[int] = Field(
        default=[1],
        description="Shape sequence [i]*N, from left-bottom to right-top"
    )
    
    # Cell gap parameters
    dx: float = Field(
        default=460.0,
        ge=1.0,
        description="Cell gap in x direction (μm)"
    )
    dy: float = Field(
        default=250.0,
        ge=1.0,
        description="Cell gap in y direction (μm)"
    )
    
    # Piston splitting parameter
    n: int = Field(
        default=25,
        ge=2,
        le=50,
        description="Number of pistons for splitting one eigen mode per line"
    )
    
    # Array dimensions
    nx: int = Field(
        default=3,
        ge=1,
        description="Number of cells in x direction"
    )
    ny: int = Field(
        default=3,
        ge=1,
        description="Number of cells in y direction"
    )
    
    # Layer thicknesses
    h_piezo: float = Field(
        default=1.0,
        ge=0.1,
        le=20.0,
        description="Piezoelectric layer thickness (μm)"
    )
    h_stru: float = Field(
        default=5.0,
        ge=0.1,
        le=100.0,
        description="Structural layer thickness (μm)"
    )
    
    # Mode parameters
    n_modes: int = Field(
        default=6,
        ge=1,
        le=20,
        description="Number of modes in array calculation"
    )
    
    # Threshold for vibration filtering
    threshold: float = Field(
        default=0.05,
        ge=0.0,
        le=1.0,
        description="Threshold to filter out non-vibration pistons"
    )


class SimulationRequest(BaseModel):
    """Request for ECM simulation (JSON body version)"""
    
    # Shape file path (for when file is already uploaded)
    shape_file_path: Optional[str] = Field(
        default=None,
        description="Path to uploaded shape.txt file"
    )
    
    # ECM parameters (required)
    ecm_params: ECMParameters = Field(
        default_factory=ECMParameters,
        description="ECM-specific parameters (sequence, dx, dy, n, nx, ny, etc.)"
    )
    
    # Frequency range
    freq_start: float = Field(
        default=0.1e6,
        ge=1,
        description="Start frequency (Hz)"
    )
    freq_end: float = Field(
        default=5.0e6,
        ge=1,
        description="End frequency (Hz)"
    )
    freq_points: int = Field(
        default=50,
        ge=10,
        le=10000,
        description="Number of frequency points"
    )


class SimulationProgress(BaseModel):
    """Progress update during simulation"""
    
    status: str
    progress: float  # 0-100
    current_step: str
    estimated_remaining: Optional[float] = None  # seconds


class SimulationResponse(BaseModel):
    """Response after ECM simulation"""
    
    success: bool
    message: str
    simulation_id: str
    computation_time: float  # seconds
    device_used: str
    
    # Results summary
    peak_frequency: float  # Hz
    peak_power: float  # dB or W
    bandwidth_3db: float  # Hz
    
    # Full result arrays (so frontend can display directly)
    frequencies: Optional[List[float]] = None
    output_power: Optional[List[float]] = None
    power_db: Optional[List[float]] = None
    impedance_real: Optional[List[float]] = None
    impedance_imag: Optional[List[float]] = None
    phase: Optional[List[float]] = None
    
    # Whether vibration data is available (fetch separately via /output/{id}/vibration)
    has_vibration: bool = False
    n_vibration_frames: int = 0
