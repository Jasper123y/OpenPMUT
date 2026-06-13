"""
Output service for analyzing and exporting results
"""

import numpy as np
from scipy import signal
from typing import List, Dict


class OutputService:
    """Service for processing and exporting simulation output"""
    
    def find_peaks(self, results: dict, min_prominence: float = 3.0) -> List[Dict]:
        """Find resonance peaks in the frequency response"""
        
        frequencies = np.array(results["frequencies"])
        power_db = np.array(results["power_db"])
        
        # Find peaks using scipy
        try:
            peak_indices, properties = signal.find_peaks(
                power_db,
                prominence=min_prominence,
                distance=10
            )
        except Exception:
            # Fallback: simple peak finding
            peak_indices = self._simple_peak_find(power_db)
            properties = {}
        
        peaks = []
        for i, idx in enumerate(peak_indices[:10]):  # Limit to 10 peaks
            freq = frequencies[idx]
            power = power_db[idx]
            
            # Calculate Q factor
            q_factor = self._calculate_q_factor(frequencies, power_db, idx)
            
            # Calculate bandwidth
            bandwidth = freq / q_factor if q_factor > 0 else 0
            
            peaks.append({
                "frequency": float(freq),
                "power": float(power),
                "q_factor": float(q_factor),
                "bandwidth": float(bandwidth)
            })
        
        return peaks
    
    def _simple_peak_find(self, data: np.ndarray) -> List[int]:
        """Simple peak finding without scipy"""
        
        peaks = []
        for i in range(1, len(data) - 1):
            if data[i] > data[i-1] and data[i] > data[i+1]:
                peaks.append(i)
        return peaks
    
    def _calculate_q_factor(
        self, 
        frequencies: np.ndarray, 
        power_db: np.ndarray, 
        peak_idx: int
    ) -> float:
        """Calculate Q factor from -3dB bandwidth"""
        
        peak_power = power_db[peak_idx]
        peak_freq = frequencies[peak_idx]
        threshold = peak_power - 3
        
        # Find left -3dB point
        left_idx = peak_idx
        while left_idx > 0 and power_db[left_idx] > threshold:
            left_idx -= 1
        
        # Find right -3dB point
        right_idx = peak_idx
        while right_idx < len(power_db) - 1 and power_db[right_idx] > threshold:
            right_idx += 1
        
        # Calculate bandwidth
        if left_idx >= 0 and right_idx < len(frequencies):
            bandwidth = frequencies[right_idx] - frequencies[left_idx]
            if bandwidth > 0:
                return peak_freq / bandwidth
        
        return 100.0  # Default Q factor
    
    def calculate_efficiency(self, results: dict) -> float:
        """Calculate acoustic efficiency (output power / input power)"""
        
        # Simplified efficiency calculation
        # In a real implementation, this would integrate acoustic power output
        
        peak_power_db = results.get("peak_power", 0)
        
        # Convert from dB to linear scale
        peak_power_linear = 10 ** (peak_power_db / 10)
        
        # Assume input power of 1W for efficiency calculation
        input_power = 1.0
        
        # Efficiency (this is a placeholder - real calculation would be more complex)
        efficiency = min(1.0, peak_power_linear / 1e6)
        
        return efficiency
    
    def format_for_export(self, results: dict, format_type: str = "csv") -> str:
        """Format results for export"""
        
        if format_type == "csv":
            return self._format_csv(results)
        elif format_type == "json":
            import json
            return json.dumps(results, indent=2)
        else:
            raise ValueError(f"Unsupported format: {format_type}")
    
    def _format_csv(self, results: dict) -> str:
        """Format results as CSV string"""
        
        lines = ["Frequency (Hz),Power (dB),Impedance Real (Ohm),Impedance Imag (Ohm),Phase (deg)"]
        
        for i in range(len(results["frequencies"])):
            line = ",".join([
                str(results["frequencies"][i]),
                str(results["power_db"][i]),
                str(results["impedance_real"][i]),
                str(results["impedance_imag"][i]),
                str(results["phase"][i])
            ])
            lines.append(line)
        
        return "\n".join(lines)
