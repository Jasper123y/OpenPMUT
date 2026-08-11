"""
Prediction schemas for modal parameters
"""

from typing import List, Optional
from pydantic import BaseModel, Field


class ModalParameters(BaseModel):
    """Modal parameters predicted by the PINN model"""
    
    # Resonant frequencies for different modes
    resonant_frequencies: List[float] = Field(
        description="Resonant frequencies for each mode (Hz)"
    )
    
    # Modal masses
    modal_masses: List[float] = Field(
        description="Effective modal masses (kg)"
    )
    
    # Modal stiffnesses
    modal_stiffnesses: List[float] = Field(
        description="Modal stiffnesses (N/m)"
    )
    
    # Damping ratios
    damping_ratios: List[float] = Field(
        description="Damping ratios for each mode"
    )
    
    # Electromechanical coupling
    coupling_coefficients: List[float] = Field(
        description="Electromechanical coupling coefficients"
    )
    
    # Mode shapes (optional, for visualization)
    mode_shapes: Optional[List[dict]] = Field(
        default=None,
        description="Mode shape data for visualization"
    )


class PredictionRequest(BaseModel):
    """Request for modal parameter prediction"""
    
    geometry_id: str = Field(
        description="ID of the validated geometry"
    )
    num_modes: int = Field(
        default=5,
        ge=1,
        le=20,
        description="Number of modes to predict"
    )
    use_analytical: bool = Field(
        default=False,
        description="Use analytical model for regular shapes"
    )


class PredictionResponse(BaseModel):
    """Response containing predicted modal parameters"""
    
    success: bool
    message: str
    prediction_id: str
    method_used: str  # "PINN" or "analytical"
    computation_time: float  # seconds
    modal_parameters: ModalParameters
