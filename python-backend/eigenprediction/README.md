# Eigenprediction Module

This module contains DL models for predicting the modal parameters required by the ECM simulation:

1. **Eigenvibration modes** (mode shapes) - `eigenvibration_predictor.py`
2. **EMCR values** (electromechanical coupling ratios) - `emcr_predictor.py`
3. **Eigenfrequencies** (resonant frequencies) - `eigenfreq_predictor.py`

## Purpose

The ECM (Equivalent Circuit Model) simulation in `ECM/main.py` requires pre-calculated data from COMSOL:
- `eigenvibrationmodes_folder_path` - mode shape files
- `emcr_folder_path` - EMCR value files
- `eigenfreqs_folder_path` - eigenfrequency files

This module provides DL models that can **predict** these values from geometry input, eliminating the need for COMSOL simulation for each new design.

## File Structure

```
eigenprediction/
├── __init__.py                    # Module exports
├── main.py                        # Pipeline orchestrator
├── eigenvibration_predictor.py    # Mode shape prediction
├── emcr_predictor.py              # EMCR prediction
├── eigenfreq_predictor.py         # Eigenfrequency prediction
├── models/                        # Trained model weights (add manually)
│   ├── eigenvibration_model.pth
│   ├── emcr_model.pth
│   └── eigenfreq_model.pth
└── README.md
```

## Output File Formats

### Eigenvibration Modes
- **Filename**: `ModeShape{mode}_{shape_id}_truth.txt`
- **Format**: CSV with columns `X, Y, w`
- **Grid**: 256×256 regular grid from -0.00025m to 0.00025m
- **Modes**: 1-6

### EMCR Values
- **Filename**: `EMCR_{shape_id}.txt`
- **Format**: Space-separated values, 6 EMCR values per shape
- **Example**: `1 1.23e-06 4.56e-07 2.34e-07 5.67e-07 1.23e-07 2.45e-07`

### Eigenfrequencies
- **Filename**: `Eigenfrequencies_{shape_id}.txt`
- **Format**: Space-separated values, 6 frequencies (Hz) per shape
- **Example**: `3.45e+06 7.89e+06 1.23e+07 1.56e+07 1.89e+07 2.12e+07`

## Usage

### Basic Usage

```python
from eigenprediction import predict_all

# Define geometries for each shape
geometries = {
    1: {"radius": 50e-6, "thickness": 2e-6, "piezo_thickness": 1e-6},
    2: {"radius": 75e-6, "thickness": 3e-6, "piezo_thickness": 1.5e-6},
}

# Run predictions
output = predict_all(geometries, output_base_path="./predictions")

# Get folder paths for ECM
ecm_paths = output["paths"]
print(ecm_paths)
# {
#     "eigenvibrationmodes_folder_path": "./predictions/eigenvibration_modes",
#     "emcr_folder_path": "./predictions/emcr",
#     "eigenfreqs_folder_path": "./predictions/eigenfreqs"
# }
```

### Using the Pipeline Class

```python
from eigenprediction import EigenpredictionPipeline

# Initialize pipeline
pipeline = EigenpredictionPipeline(output_base_path="./my_output")
pipeline.load_models()

# Predict for a single shape
geometry = {
    "radius": 50e-6,
    "thickness": 2e-6,
    "piezo_thickness": 1e-6,
    "density": 2330,
    "youngs_modulus": 170e9,
    "poissons_ratio": 0.28
}

results = pipeline.predict(geometry, shape_id=1)

# Access individual predictions
mode_shapes = results["mode_shapes"]  # Dict[int, np.ndarray]
emcr_values = results["emcr_values"]  # List[float]
eigenfreqs = results["eigenfrequencies"]  # List[float]
```

### Integration with ECM

```python
from eigenprediction import predict_all
import sys
sys.path.append("../ECM")
from main import main as ecm_main

# Step 1: Predict modal parameters
geometries = {1: {"radius": 50e-6, "thickness": 2e-6}}
output = predict_all(geometries)
paths = output["paths"]

# Step 2: Run ECM with predicted data
output_power = ecm_main(
    sequence=[1],
    eigenvibrationmodes_folder_path=paths["eigenvibrationmodes_folder_path"],
    emcr_folder_path=paths["emcr_folder_path"],
    eigenfreqs_folder_path=paths["eigenfreqs_folder_path"],
    dx=500e-6,
    dy=500e-6,
    n=10,
    threshold=0.01,
    nx=1,
    ny=1,
    n_cells=1,
    n_modes=5,
    total_area=1e-8,
    freq_range=np.arange(2.1e6, 10.1e6, 0.1e6),
    label_saving_folder_path="./output/labels",
    disp_saving_folder_path="./output/disp"
)
```

## Adding Your Trained Models

1. Place your trained model weights in the `models/` folder:
   - `models/eigenvibration_model.pth`
   - `models/emcr_model.pth`
   - `models/eigenfreq_model.pth`

2. Modify the `load_model()` method in each predictor class to load your specific model architecture:

```python
# Example in eigenvibration_predictor.py
def load_model(self):
    import torch
    from your_model_module import YourModelClass
    
    self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    self.model = YourModelClass()
    self.model.load_state_dict(torch.load(self.model_path, map_location=self.device))
    self.model.to(self.device)
    self.model.eval()
```

3. Implement the inference logic in the `predict()` method.

## Geometry Input Parameters

| Parameter | Description | Units | Typical Range |
|-----------|-------------|-------|---------------|
| `radius` | Membrane radius | m | 25-150 μm |
| `thickness` | Total membrane thickness | m | 1-10 μm |
| `piezo_thickness` | Piezoelectric layer thickness | m | 0.5-5 μm |
| `density` | Membrane density | kg/m³ | 2000-3500 |
| `youngs_modulus` | Young's modulus | Pa | 100-200 GPa |
| `poissons_ratio` | Poisson's ratio | - | 0.2-0.35 |

## Placeholder Predictions

Until trained models are added, the predictors use analytical approximations:

- **Eigenvibration modes**: Bessel function-like patterns for circular plates
- **EMCR**: Simplified coupling based on geometry ratios
- **Eigenfrequencies**: Clamped circular plate analytical solution

These placeholders provide reasonable estimates but should be replaced with trained DL models for accurate predictions.
