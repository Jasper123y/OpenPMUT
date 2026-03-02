"""
Configuration settings for OpenPMUT Desktop
"""

import os
from pathlib import Path
from pydantic_settings import BaseSettings

# Try to import torch, but make it optional
try:
    import torch
    TORCH_AVAILABLE = True
    CUDA_AVAILABLE = torch.cuda.is_available()
except (ImportError, OSError):
    TORCH_AVAILABLE = False
    CUDA_AVAILABLE = False

# Desktop mode: paths are relative to the python-backend directory
BACKEND_DIR = Path(__file__).resolve().parent.parent
IS_DESKTOP = os.environ.get("OPENPMUT_DESKTOP", "0") == "1"


class Settings(BaseSettings):
    """Application settings"""
    
    # Server settings
    HOST: str = "127.0.0.1"
    PORT: int = int(os.environ.get("OPENPMUT_PORT", "18765"))
    DEBUG: bool = not IS_DESKTOP
    
    # Model paths (all relative to python-backend/)
    MODEL_DIR: str = str(BACKEND_DIR / "eigenprediction" / "models")
    
    # ECM folder paths
    ECM_BASE_DIR: str = str(BACKEND_DIR / "ECM")
    polygon_folder_path: str = str(BACKEND_DIR / "ECM" / "saving_folder")
    label_saving_folder_path: str = str(BACKEND_DIR / "output" / "labels")
    disp_saving_folder_path: str = str(BACKEND_DIR / "output" / "disp")
    
    # Upload directory
    UPLOAD_DIR: str = str(BACKEND_DIR / "uploads")
    
    # Computation settings
    USE_GPU: bool = CUDA_AVAILABLE
    DEVICE: str = "cuda" if CUDA_AVAILABLE else "cpu"
    
    # File upload settings
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024  # 10MB
    ALLOWED_EXTENSIONS: list = [".txt", ".csv"]
    
    # PMUT default parameters
    DEFAULT_SILICON_THICKNESS: float = 5.0  # μm
    DEFAULT_CELL_NUMBER: int = 1
    DEFAULT_PITCH_X: float = 100.0  # μm
    DEFAULT_PITCH_Y: float = 100.0  # μm
    
    class Config:
        env_file = ".env"


settings = Settings()
