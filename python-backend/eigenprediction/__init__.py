"""
Eigenprediction Module

This module contains DL models for predicting:
1. Eigenvibration modes (mode shapes)
2. EMCR (Electromechanical Coupling Ratio) values
3. Eigenfrequencies

These predictions replace the need for COMSOL pre-calculated data,
enabling real-time PMUT simulation from geometry input alone.
"""

from .eigenvibration_predictor import EigenvibrationPredictor
from .emcr_predictor import EMCRPredictor
from .eigenfreq_predictor import EigenfreqPredictor
from .main import predict_all, EigenpredictionPipeline

__all__ = [
    "EigenvibrationPredictor",
    "EMCRPredictor", 
    "EigenfreqPredictor",
    "predict_all",
    "EigenpredictionPipeline",
]
