"""
Geometry API endpoints
"""

import uuid
from fastapi import APIRouter, UploadFile, File, HTTPException
from app.schemas.geometry import GeometryInput, GeometryResponse, CellShape, ShapeFileData
from app.services.geometry_service import GeometryService

router = APIRouter()
geometry_service = GeometryService()

# In-memory storage for demo (use database in production)
geometry_store = {}


@router.post("/validate", response_model=GeometryResponse)
async def validate_geometry(geometry: GeometryInput):
    """Validate PMUT geometry parameters"""
    
    try:
        # Validate geometry
        is_valid, message = geometry_service.validate(geometry)
        
        if not is_valid:
            raise HTTPException(status_code=400, detail=message)
        
        # Generate geometry ID
        geometry_id = str(uuid.uuid4())[:8]
        
        # Calculate properties
        total_cells = geometry.cell_number_x * geometry.cell_number_y
        area = geometry_service.calculate_area(geometry)
        
        # Generate visualization data
        viz_data = geometry_service.generate_visualization(geometry)
        
        # Store geometry
        geometry_store[geometry_id] = {
            "geometry": geometry,
            "area": area,
            "total_cells": total_cells
        }
        
        return GeometryResponse(
            success=True,
            message="Geometry validated successfully",
            geometry_id=geometry_id,
            cell_shape=geometry.cell_shape,
            total_cells=total_cells,
            estimated_area=area,
            visualization_data=viz_data
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upload-shape")
async def upload_shape_file(file: UploadFile = File(...)):
    """Upload custom shape file (shape.txt)"""
    
    if not file.filename.endswith(('.txt', '.csv')):
        raise HTTPException(
            status_code=400,
            detail="Only .txt and .csv files are supported"
        )
    
    try:
        content = await file.read()
        content_str = content.decode('utf-8')
        
        # Parse shape file
        shape_data = geometry_service.parse_shape_file(content_str)
        
        return {
            "success": True,
            "filename": file.filename,
            "shape_data": shape_data.model_dump()
        }
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error parsing file: {str(e)}")


@router.get("/{geometry_id}")
async def get_geometry(geometry_id: str):
    """Get stored geometry by ID"""
    
    if geometry_id not in geometry_store:
        raise HTTPException(status_code=404, detail="Geometry not found")
    
    return geometry_store[geometry_id]


@router.get("/shapes/examples")
async def get_example_shapes():
    """Get example shapes for different cell types"""
    
    return {
        "circular": {
            "description": "Circular PMUT cell",
            "default_radius": 50.0,
            "parameters": ["radius"]
        },
        "rectangular": {
            "description": "Rectangular PMUT cell",
            "default_length": 100.0,
            "default_width": 80.0,
            "parameters": ["length", "width"]
        },
        "hexagonal": {
            "description": "Hexagonal PMUT cell",
            "default_side": 40.0,
            "parameters": ["side_length"]
        }
    }
