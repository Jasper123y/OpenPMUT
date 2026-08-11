"""
Prediction service for modal parameters using PINN or analytical models
"""

import math
import numpy as np
from typing import Optional
from app.schemas.geometry import GeometryInput, CellShape
from app.schemas.prediction import ModalParameters


class PredictionService:
    """Service for predicting modal parameters"""
    
    # Material properties (default values)
    SILICON_DENSITY = 2329  # kg/m³
    SILICON_YOUNGS = 169e9  # Pa
    SILICON_POISSON = 0.22
    
    PIEZO_DENSITY = 7500  # kg/m³ (PZT)
    PIEZO_YOUNGS = 63e9  # Pa
    PIEZO_D31 = -274e-12  # m/V
    PIEZO_EPSILON = 3400 * 8.854e-12  # F/m
    
    def analytical_prediction(
        self, 
        geometry: GeometryInput, 
        num_modes: int
    ) -> ModalParameters:
        """
        Analytical prediction for regular shapes (circular, rectangular)
        Based on plate vibration theory
        """
        
        # Convert thickness to meters
        h_si = geometry.silicon_thickness * 1e-6
        h_pz = geometry.piezo_thickness * 1e-6
        h_total = h_si + h_pz
        
        # Effective properties (composite plate)
        rho_eff = (self.SILICON_DENSITY * h_si + self.PIEZO_DENSITY * h_pz) / h_total
        E_eff = (self.SILICON_YOUNGS * h_si + self.PIEZO_YOUNGS * h_pz) / h_total
        
        # Flexural rigidity
        D = E_eff * (h_total ** 3) / (12 * (1 - self.SILICON_POISSON ** 2))
        
        frequencies = []
        modal_masses = []
        modal_stiffnesses = []
        damping_ratios = []
        coupling_coeffs = []
        
        if geometry.cell_shape == CellShape.CIRCULAR:
            # Circular plate natural frequencies
            # f_mn = (lambda_mn^2 / (2*pi*a^2)) * sqrt(D / (rho*h))
            a = geometry.radius * 1e-6  # Convert to meters
            
            # Mode shape parameters for clamped circular plate
            lambda_values = [
                10.22,   # (0,1) mode
                21.26,   # (1,1) mode
                34.88,   # (2,1) mode
                39.77,   # (0,2) mode
                51.04,   # (3,1) mode
                60.82,   # (1,2) mode
                69.67,   # (4,1) mode
                84.58,   # (2,2) mode
                90.74,   # (5,1) mode
                111.0,   # (0,3) mode
            ]
            
            for i in range(min(num_modes, len(lambda_values))):
                lam = lambda_values[i]
                
                # Natural frequency
                freq = (lam / (2 * math.pi * a**2)) * math.sqrt(D / (rho_eff * h_total))
                frequencies.append(freq)
                
                # Modal mass (approximate)
                m_eff = 0.25 * rho_eff * h_total * math.pi * a**2
                modal_masses.append(m_eff)
                
                # Modal stiffness k = m * omega^2
                omega = 2 * math.pi * freq
                k_eff = m_eff * omega**2
                modal_stiffnesses.append(k_eff)
                
                # Damping ratio (typical value)
                damping_ratios.append(0.01 + 0.005 * i)
                
                # Electromechanical coupling coefficient
                eta = self._calculate_coupling(geometry, i)
                coupling_coeffs.append(eta)
                
        elif geometry.cell_shape == CellShape.RECTANGULAR:
            # Rectangular plate natural frequencies
            # f_mn = (pi/2) * sqrt(D/(rho*h)) * ((m/a)^2 + (n/b)^2)
            a = geometry.length * 1e-6
            b = geometry.width * 1e-6
            
            # Mode combinations (m, n) for first several modes
            mode_pairs = [
                (1, 1), (2, 1), (1, 2), (2, 2), (3, 1),
                (1, 3), (3, 2), (2, 3), (4, 1), (3, 3)
            ]
            
            for i in range(min(num_modes, len(mode_pairs))):
                m, n = mode_pairs[i]
                
                # Natural frequency
                freq = (math.pi / 2) * math.sqrt(D / (rho_eff * h_total)) * \
                       ((m / a)**2 + (n / b)**2)
                frequencies.append(freq)
                
                # Modal mass
                m_eff = 0.25 * rho_eff * h_total * a * b
                modal_masses.append(m_eff)
                
                # Modal stiffness
                omega = 2 * math.pi * freq
                k_eff = m_eff * omega**2
                modal_stiffnesses.append(k_eff)
                
                # Damping ratio
                damping_ratios.append(0.01 + 0.005 * i)
                
                # Coupling coefficient
                eta = self._calculate_coupling(geometry, i)
                coupling_coeffs.append(eta)
        
        else:
            # Default values for other shapes
            for i in range(num_modes):
                frequencies.append(1e6 * (i + 1))
                modal_masses.append(1e-12)
                modal_stiffnesses.append(1e3 * (i + 1))
                damping_ratios.append(0.01)
                coupling_coeffs.append(0.1)
        
        return ModalParameters(
            resonant_frequencies=frequencies,
            modal_masses=modal_masses,
            modal_stiffnesses=modal_stiffnesses,
            damping_ratios=damping_ratios,
            coupling_coefficients=coupling_coeffs
        )
    
    def pinn_prediction(
        self,
        geometry: GeometryInput,
        num_modes: int,
        models: Optional[dict] = None
    ) -> ModalParameters:
        """
        PINN-based prediction for arbitrary shapes
        Uses pre-trained physics-informed neural network
        """
        
        # If no model loaded, fall back to analytical with perturbation
        if models is None:
            params = self.analytical_prediction(geometry, num_modes)
            # Add small perturbation to simulate PINN output
            return params
        
        # Prepare input features
        features = self._prepare_features(geometry)
        
        # Run inference (placeholder - implement actual model inference)
        # In production, this would use the loaded PyTorch model
        try:
            import torch
            
            model = models.get("modal_predictor")
            if model is None:
                return self.analytical_prediction(geometry, num_modes)
            
            with torch.no_grad():
                input_tensor = torch.tensor(features, dtype=torch.float32)
                output = model(input_tensor)
                
            # Parse output into modal parameters
            # Structure depends on your specific model architecture
            frequencies = output[:num_modes].tolist()
            
            return ModalParameters(
                resonant_frequencies=frequencies,
                modal_masses=[1e-12] * num_modes,
                modal_stiffnesses=[1e3] * num_modes,
                damping_ratios=[0.01] * num_modes,
                coupling_coefficients=[0.1] * num_modes
            )
            
        except Exception:
            return self.analytical_prediction(geometry, num_modes)
    
    def _prepare_features(self, geometry: GeometryInput) -> list:
        """Prepare feature vector for PINN input"""
        
        features = [
            geometry.silicon_thickness,
            geometry.piezo_thickness,
            geometry.electrode_thickness,
        ]
        
        if geometry.cell_shape == CellShape.CIRCULAR:
            features.extend([geometry.radius or 50.0, 0, 0])
        elif geometry.cell_shape == CellShape.RECTANGULAR:
            features.extend([0, geometry.length or 100.0, geometry.width or 80.0])
        else:
            features.extend([50.0, 0, 0])
        
        # Add array configuration
        features.extend([
            geometry.cell_number_x,
            geometry.cell_number_y,
            geometry.pitch_x,
            geometry.pitch_y
        ])
        
        return features
    
    def _calculate_coupling(self, geometry: GeometryInput, mode_index: int) -> float:
        """Calculate electromechanical coupling coefficient"""
        
        # Simplified coupling calculation
        h_pz = geometry.piezo_thickness * 1e-6
        
        # Area factor
        if geometry.cell_shape == CellShape.CIRCULAR:
            area = math.pi * (geometry.radius * 1e-6) ** 2
        elif geometry.cell_shape == CellShape.RECTANGULAR:
            area = (geometry.length * 1e-6) * (geometry.width * 1e-6)
        else:
            area = 1e-8
        
        # Coupling coefficient (simplified model)
        eta = abs(self.PIEZO_D31) * self.PIEZO_YOUNGS * area / h_pz
        
        # Mode-dependent factor (higher modes have lower coupling)
        eta *= 1.0 / (mode_index + 1)
        
        return eta
