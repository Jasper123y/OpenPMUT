"""
Model loader for PINN models
"""

import os
from typing import Dict, Optional
from app.config import settings


def load_models() -> Dict:
    """
    Load pre-trained PINN models
    
    Returns a dictionary of loaded models:
    - modal_predictor: Predicts modal parameters from geometry
    - mode_shape_net: Predicts mode shapes (optional)
    """
    
    models = {}
    
    try:
        import torch
        
        model_dir = settings.MODEL_DIR
        device = settings.DEVICE
        
        # Modal parameter predictor
        modal_model_path = os.path.join(model_dir, "modal_predictor.pt")
        if os.path.exists(modal_model_path):
            print(f"Loading modal predictor from {modal_model_path}")
            models["modal_predictor"] = torch.load(
                modal_model_path, 
                map_location=device
            )
            models["modal_predictor"].eval()
            print("Modal predictor loaded successfully")
        else:
            print(f"Modal predictor not found at {modal_model_path}")
            print("Using analytical models as fallback")
        
        # Mode shape network (optional)
        mode_shape_path = os.path.join(model_dir, "mode_shape_net.pt")
        if os.path.exists(mode_shape_path):
            print(f"Loading mode shape network from {mode_shape_path}")
            models["mode_shape_net"] = torch.load(
                mode_shape_path,
                map_location=device
            )
            models["mode_shape_net"].eval()
            print("Mode shape network loaded successfully")
        
        print(f"Models loaded on device: {device}")
        
    except ImportError:
        print("PyTorch not available - using analytical models only")
    except Exception as e:
        print(f"Error loading models: {e}")
        print("Using analytical models as fallback")
    
    return models


class PINNModel:
    """
    Physics-Informed Neural Network model for PMUT simulation
    
    This is a placeholder class. In production, replace with your actual
    trained PINN model architecture from the paper.
    """
    
    def __init__(self, input_dim: int = 10, hidden_dim: int = 64, output_dim: int = 20):
        try:
            import torch
            import torch.nn as nn
            
            self.model = nn.Sequential(
                nn.Linear(input_dim, hidden_dim),
                nn.Tanh(),
                nn.Linear(hidden_dim, hidden_dim),
                nn.Tanh(),
                nn.Linear(hidden_dim, hidden_dim),
                nn.Tanh(),
                nn.Linear(hidden_dim, output_dim)
            )
            
        except ImportError:
            self.model = None
    
    def forward(self, x):
        if self.model is None:
            raise RuntimeError("PyTorch not available")
        return self.model(x)
    
    def predict(self, geometry_features: list) -> dict:
        """Predict modal parameters from geometry features"""
        
        import torch
        
        x = torch.tensor(geometry_features, dtype=torch.float32).unsqueeze(0)
        
        with torch.no_grad():
            output = self.forward(x)
        
        # Parse output (adjust based on your model's output format)
        output = output.squeeze().numpy()
        
        return {
            "frequencies": output[:5].tolist(),
            "modal_masses": output[5:10].tolist(),
            "modal_stiffnesses": output[10:15].tolist(),
            "damping_ratios": output[15:20].tolist() if len(output) >= 20 else [0.01] * 5,
            "coupling_coefficients": [0.1] * 5
        }
