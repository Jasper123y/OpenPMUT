# Pre-trained Model Weights

Place your trained PINN model weights here:

- `modal_predictor.pt` - Main model for predicting modal parameters
- `mode_shape_net.pt` - (Optional) Network for predicting mode shapes

## Model Architecture

The modal predictor expects input features:
1. Silicon thickness (μm)
2. Piezo thickness (μm)
3. Electrode thickness (μm)
4. Cell dimension 1 (radius or length, μm)
5. Cell dimension 2 (0 or width, μm)
6. Cell dimension 3 (reserved)
7. Number of cells X
8. Number of cells Y
9. Pitch X (μm)
10. Pitch Y (μm)

Output: Modal parameters for each mode (frequencies, masses, stiffnesses, damping ratios, coupling coefficients)

## Training

See the paper: "Physics-Informed Eigen-Solution Neural Networks for Ultra-Fast 
Simulation and Optimization of Multimodal MEMS Ultrasonic Arrays" for training details.
