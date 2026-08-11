"""
Prediction API endpoints for modal parameters
"""

import uuid
import time
from fastapi import APIRouter, HTTPException, Request
from app.schemas.prediction import PredictionRequest, PredictionResponse, ModalParameters
from app.services.prediction_service import PredictionService
from app.routers.geometry import geometry_store

router = APIRouter()
prediction_service = PredictionService()

# In-memory storage
prediction_store = {}


@router.post("/predict", response_model=PredictionResponse)
async def predict_modal_parameters(request: PredictionRequest, req: Request):
    """Predict modal parameters using PINN or analytical model"""
    
    # Get geometry
    if request.geometry_id not in geometry_store:
        raise HTTPException(status_code=404, detail="Geometry not found")
    
    geometry_data = geometry_store[request.geometry_id]
    geometry = geometry_data["geometry"]
    
    try:
        start_time = time.time()
        
        # Get models from app state
        models = getattr(req.app.state, 'models', None)
        
        # Determine method
        use_analytical = request.use_analytical or (
            geometry.cell_shape in ["circular", "rectangular"] and 
            geometry.shape_data is None
        )
        
        if use_analytical:
            # Use analytical model for regular shapes
            modal_params = prediction_service.analytical_prediction(
                geometry, 
                request.num_modes
            )
            method = "analytical"
        else:
            # Use PINN model
            modal_params = prediction_service.pinn_prediction(
                geometry,
                request.num_modes,
                models
            )
            method = "PINN"
        
        computation_time = time.time() - start_time
        
        # Generate prediction ID
        prediction_id = str(uuid.uuid4())[:8]
        
        # Store prediction
        prediction_store[prediction_id] = {
            "geometry_id": request.geometry_id,
            "modal_parameters": modal_params,
            "method": method
        }
        
        return PredictionResponse(
            success=True,
            message=f"Modal parameters predicted using {method} model",
            prediction_id=prediction_id,
            method_used=method,
            computation_time=computation_time,
            modal_parameters=modal_params
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{prediction_id}")
async def get_prediction(prediction_id: str):
    """Get stored prediction by ID"""
    
    if prediction_id not in prediction_store:
        raise HTTPException(status_code=404, detail="Prediction not found")
    
    return prediction_store[prediction_id]


@router.get("/methods/available")
async def get_available_methods():
    """Get available prediction methods"""
    
    return {
        "methods": [
            {
                "name": "PINN",
                "description": "Physics-Informed Neural Network for arbitrary shapes",
                "supported_shapes": ["circular", "rectangular", "hexagonal", "custom"],
                "accuracy": "high",
                "speed": "fast"
            },
            {
                "name": "analytical",
                "description": "Analytical solutions for regular shapes",
                "supported_shapes": ["circular", "rectangular"],
                "accuracy": "exact for ideal conditions",
                "speed": "instant"
            }
        ]
    }
