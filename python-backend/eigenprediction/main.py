"""
Eigenprediction Pipeline

Main orchestrator that runs all three DL models to generate the required
files for ECM simulation from shape.txt files:
1. Eigenvibration modes (mode shapes)
2. EMCR values (electromechanical coupling ratios)
3. Eigenfrequencies (resonant frequencies)

Input: shape.txt files containing X,Y boundary coordinates
Output: Files stored in folders that can be used by ECM/main.py
"""

import os
import numpy as np
from typing import Dict, List, Any, Optional, Union
from dataclasses import dataclass

from .eigenvibration_predictor import EigenvibrationPredictor
from .emcr_predictor import EMCRPredictor
from .eigenfreq_predictor import EigenfreqPredictor


@dataclass
class PredictionPaths:
    """Output folder paths for predictions"""
    eigenvibrationmodes_folder: str
    emcr_folder: str
    eigenfreqs_folder: str


class EigenpredictionPipeline:
    """
    Pipeline that orchestrates all three prediction models.
    
    Usage:
        pipeline = EigenpredictionPipeline(output_base_path="./predictions")
        pipeline.load_models()
        
        # Predict from shape.txt file
        pipeline.predict_from_shape("shape1.txt", shape_id=1)
        
        # Or predict from multiple shape files
        shape_files = {1: "shape1.txt", 2: "shape2.txt", 3: "shape3.txt"}
        pipeline.predict_batch(shape_files)
        
        # Get folder paths for ECM
        paths = pipeline.get_output_paths()
    """
    
    def __init__(
        self,
        output_base_path: str = "./predictions",
        eigenvibration_model_path: Optional[str] = None,
        emcr_model_path: Optional[str] = None,
        eigenfreq_model_path: Optional[str] = None
    ):
        """
        Initialize the prediction pipeline.
        
        Args:
            output_base_path: Base folder for all outputs
            eigenvibration_model_path: Path to eigenvibration model weights
            emcr_model_path: Path to EMCR model weights
            eigenfreq_model_path: Path to eigenfrequency model weights
        """
        self.output_base_path = output_base_path
        
        # Create output folder structure
        self.paths = PredictionPaths(
            eigenvibrationmodes_folder=os.path.join(output_base_path, "eigenvibration_modes"),
            emcr_folder=os.path.join(output_base_path, "emcr"),
            eigenfreqs_folder=os.path.join(output_base_path, "eigenfreqs")
        )
        
        # Initialize predictors
        self.eigenvibration_predictor = EigenvibrationPredictor(eigenvibration_model_path)
        self.emcr_predictor = EMCRPredictor(emcr_model_path)
        self.eigenfreq_predictor = EigenfreqPredictor(eigenfreq_model_path)
        
        # Create output directories
        self._create_output_dirs()
    
    def _create_output_dirs(self):
        """Create output directory structure"""
        os.makedirs(self.paths.eigenvibrationmodes_folder, exist_ok=True)
        os.makedirs(self.paths.emcr_folder, exist_ok=True)
        os.makedirs(self.paths.eigenfreqs_folder, exist_ok=True)
    
    def load_models(self):
        """Load all three models"""
        print("Loading eigenprediction models...")
        self.eigenvibration_predictor.load_model()
        self.emcr_predictor.load_model()
        self.eigenfreq_predictor.load_model()
        print("All models loaded.")
    
    def predict(
        self,
        shape_input: Union[str, np.ndarray],
        shape_id: int,
        save: bool = True
    ) -> Dict[str, Any]:
        """
        Run all three predictions from a shape.txt file.
        
        Args:
            shape_input: Path to shape.txt file or numpy array of X,Y coordinates
            shape_id: Unique identifier for this shape
            save: Whether to save outputs to files
            
        Returns:
            Dictionary containing all predictions
        """
        results = {}
        
        # 1. Predict eigenvibration modes
        if save:
            mode_shapes = self.eigenvibration_predictor.predict_and_save(
                shape_input, shape_id, self.paths.eigenvibrationmodes_folder
            )
        else:
            mode_shapes = self.eigenvibration_predictor.predict(shape_input, shape_id)
        results["mode_shapes"] = mode_shapes
        
        # 2. Predict EMCR values
        if save:
            emcr_values = self.emcr_predictor.predict_and_save(
                shape_input, shape_id, self.paths.emcr_folder
            )
        else:
            emcr_values = self.emcr_predictor.predict(shape_input, shape_id)
        results["emcr_values"] = emcr_values
        
        # 3. Predict eigenfrequencies
        if save:
            eigenfreqs = self.eigenfreq_predictor.predict_and_save(
                shape_input, shape_id, self.paths.eigenfreqs_folder
            )
        else:
            eigenfreqs = self.eigenfreq_predictor.predict(shape_input, shape_id)
        results["eigenfrequencies"] = eigenfreqs
        
        return results
    
    def predict_batch(
        self,
        shape_files: Dict[int, str],
        save: bool = True
    ) -> Dict[int, Dict[str, Any]]:
        """
        Run predictions for multiple shape files.
        
        Args:
            shape_files: Dictionary mapping shape_id to shape file path
            save: Whether to save outputs to files
            
        Returns:
            Dictionary mapping shape_id to prediction results
        """
        all_results = {}
        
        for shape_id, shape_file in shape_files.items():
            print(f"Predicting for shape {shape_id}...")
            all_results[shape_id] = self.predict(shape_file, shape_id, save)
        
        return all_results
    
    def get_output_paths(self) -> PredictionPaths:
        """Get the output folder paths for ECM"""
        return self.paths
    
    def get_ecm_folder_dict(self) -> Dict[str, str]:
        """
        Get folder paths as dictionary for ECM/main.py parameters.
        
        Returns:
            Dictionary with keys matching ECM main.py parameter names
        """
        return {
            "eigenvibrationmodes_folder_path": self.paths.eigenvibrationmodes_folder,
            "emcr_folder_path": self.paths.emcr_folder,
            "eigenfreqs_folder_path": self.paths.eigenfreqs_folder
        }


def predict_all(
    shape_files: Dict[int, str],
    output_base_path: str = "./predictions",
    eigenvibration_model_path: Optional[str] = None,
    emcr_model_path: Optional[str] = None,
    eigenfreq_model_path: Optional[str] = None
) -> Dict[str, Any]:
    """
    Convenience function to run all predictions from shape files.
    
    Args:
        shape_files: Dictionary mapping shape_id to shape.txt file path
        output_base_path: Base folder for outputs
        eigenvibration_model_path: Optional custom model path
        emcr_model_path: Optional custom model path
        eigenfreq_model_path: Optional custom model path
        
    Returns:
        Dictionary with 'results' and 'paths' keys
        
    Example:
        shape_files = {
            1: "./shapes/shape1.txt",
            2: "./shapes/shape2.txt",
            3: "./shapes/shape3.txt"
        }
        
        output = predict_all(shape_files, output_base_path="./my_predictions")
        
        # Use with ECM
        ecm_paths = output["paths"]
        # Pass to ECM/main.py:
        # eigenvibrationmodes_folder_path = ecm_paths["eigenvibrationmodes_folder_path"]
        # emcr_folder_path = ecm_paths["emcr_folder_path"]
        # eigenfreqs_folder_path = ecm_paths["eigenfreqs_folder_path"]
    """
    pipeline = EigenpredictionPipeline(
        output_base_path=output_base_path,
        eigenvibration_model_path=eigenvibration_model_path,
        emcr_model_path=emcr_model_path,
        eigenfreq_model_path=eigenfreq_model_path
    )
    
    pipeline.load_models()
    results = pipeline.predict_batch(shape_files, save=True)
    
    return {
        "results": results,
        "paths": pipeline.get_ecm_folder_dict()
    }


# Example usage
if __name__ == "__main__":
    # Example: predict from shape.txt files
    # shape_files maps shape_id to file path
    shape_files = {
        1: "./examples/circular_50um.txt",
        2: "./examples/hexagonal_40um.txt",
        3: "./examples/rectangular_100x80um.txt"
    }
    
    output = predict_all(shape_files, output_base_path="./predictions")
    
    print("\n" + "="*50)
    print("Prediction complete!")
    print("="*50)
    print("\nECM folder paths:")
    for key, path in output["paths"].items():
        print(f"  {key}: {path}")
    
    print("\nPredicted eigenfrequencies:")
    for shape_id, results in output["results"].items():
        freqs = results["eigenfrequencies"]
        print(f"  Shape {shape_id}: {[f'{f/1e6:.2f} MHz' for f in freqs]}")
