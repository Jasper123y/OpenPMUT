# Model Weights

Place your trained model weights here:

- `eigenvibration_model.pth` - Model for predicting eigenvibration mode shapes
- `emcr_model.pth` - Model for predicting EMCR (electromechanical coupling ratio) values
- `eigenfreq_model.pth` - Model for predicting eigenfrequencies

## Expected Model Outputs

### Eigenvibration Model
- **Input**: Geometry parameters (radius, thickness, etc.)
- **Output**: 6 mode shapes, each as 256×256 grid of displacement values

### EMCR Model
- **Input**: Geometry parameters
- **Output**: 6 EMCR values (one per mode)

### Eigenfrequency Model
- **Input**: Geometry parameters
- **Output**: 6 eigenfrequencies in Hz (one per mode)

## Model Architecture

Update the `load_model()` methods in the predictor classes to match your specific model architectures.
