"""
Output schemas for frequency response
"""

from typing import List, Optional
from pydantic import BaseModel, Field


class FrequencyResponse(BaseModel):
    """Frequency response data"""
    
    frequencies: List[float] = Field(
        description="Frequency points (Hz)"
    )
    power_db: List[float] = Field(
        description="Power in dB"
    )
    impedance_real: List[float] = Field(
        description="Real part of impedance (Ohm)"
    )
    impedance_imag: List[float] = Field(
        description="Imaginary part of impedance (Ohm)"
    )
    phase: List[float] = Field(
        description="Phase angle (degrees)"
    )
    displacement: Optional[List[float]] = Field(
        default=None,
        description="Surface displacement (nm)"
    )
    pressure: Optional[List[float]] = Field(
        default=None,
        description="Acoustic pressure (Pa)"
    )


class PeakInfo(BaseModel):
    """Information about resonance peaks"""
    
    mode_number: int
    frequency: float  # Hz
    power: float  # dB
    quality_factor: float
    bandwidth: float  # Hz


class OutputResponse(BaseModel):
    """Complete output response"""
    
    success: bool
    simulation_id: str
    
    # Frequency response data
    frequency_response: FrequencyResponse
    
    # Peak analysis
    peaks: List[PeakInfo]
    
    # Summary statistics
    primary_resonance: float  # Hz
    peak_power: float  # dB
    total_bandwidth: float  # Hz
    efficiency: Optional[float] = None
    
    # Export options
    csv_download_url: Optional[str] = None
    json_download_url: Optional[str] = None
    plot_download_url: Optional[str] = None
