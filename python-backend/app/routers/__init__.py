from app.routers.geometry import router as geometry_router
from app.routers.prediction import router as prediction_router
from app.routers.simulation import router as simulation_router
from app.routers.output import router as output_router

__all__ = ["geometry_router", "prediction_router", "simulation_router", "output_router"]
