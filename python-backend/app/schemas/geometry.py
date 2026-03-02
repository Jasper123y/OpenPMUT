"""
Geometry input schemas for PMUT simulation
"""

from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field


class CellShape(str, Enum):
    """Supported PMUT cell shapes"""
    CIRCULAR = "circular"
    RECTANGULAR = "rectangular"
    HEXAGONAL = "hexagonal"
    CUSTOM = "custom"


class GeometryInput(BaseModel):
    """Input parameters for PMUT geometry"""
    
    # Shape definition
    cell_shape: CellShape = Field(
        default=CellShape.CIRCULAR,
        description="Shape of individual PMUT cells"
    )
    
    # For circular shapes
    radius: Optional[float] = Field(
        default=None,
        description="Radius for circular cells (μm)"
    )
    
    # For rectangular shapes
    length: Optional[float] = Field(
        default=None,
        description="Length for rectangular cells (μm)"
    )
    width: Optional[float] = Field(
        default=None,
        description="Width for rectangular cells (μm)"
    )
    
    # Layer thicknesses
    silicon_thickness: float = Field(
        default=5.0,
        ge=0.1,
        le=100.0,
        description="Silicon layer thickness (μm)"
    )
    piezo_thickness: float = Field(
        default=1.0,
        ge=0.1,
        le=20.0,
        description="Piezoelectric layer thickness (μm)"
    )
    electrode_thickness: float = Field(
        default=0.2,
        ge=0.01,
        le=5.0,
        description="Electrode thickness (μm)"
    )
    
    # Array configuration
    cell_number_x: int = Field(
        default=1,
        ge=1,
        le=100,
        description="Number of cells in X direction"
    )
    cell_number_y: int = Field(
        default=1,
        ge=1,
        le=100,
        description="Number of cells in Y direction"
    )
    pitch_x: float = Field(
        default=100.0,
        ge=1.0,
        description="Cell pitch in X direction (μm)"
    )
    pitch_y: float = Field(
        default=100.0,
        ge=1.0,
        description="Cell pitch in Y direction (μm)"
    )
    
    # Custom shape file content (for irregular shapes)
    shape_data: Optional[str] = Field(
        default=None,
        description="Custom shape data from uploaded file"
    )


class GeometryResponse(BaseModel):
    """Response after geometry validation"""
    
    success: bool
    message: str
    geometry_id: str
    cell_shape: CellShape
    total_cells: int
    estimated_area: float  # μm²
    visualization_data: Optional[dict] = None


class ShapeFileData(BaseModel):
    """Parsed shape file data"""
    
    vertices: List[List[float]]
    num_points: int
    bounding_box: dict
    centroid: List[float]
