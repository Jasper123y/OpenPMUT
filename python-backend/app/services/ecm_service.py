"""
ECM (Equivalent Circuit Model) service for PMUT simulation — simplified.

1. Calls the real ECM/main.py pipeline.
2. ECM saves files to output/labels/ and output/disp/.
3. We just track which files were produced and return metadata.
   The output router serves the PNG files directly.
"""

import numpy as np
import os
import sys
import re
import shutil
import glob
import hashlib
from typing import Callable, List, Optional, Dict, Any
from app.config import settings

# python-backend/ is the root for ECM, eigenmode_solver, etc.
# __file__ is .../python-backend/app/services/ecm_service.py → go up 2 levels
BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

# Add ECM folder to path so its modules can be imported
ECM_PATH = os.path.join(BACKEND_ROOT, "ECM")
if ECM_PATH not in sys.path:
    sys.path.insert(0, ECM_PATH)

# Add project root to path so ECM can import eigenmode_solver package
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)


class ECMService:
    """
    Service for ECM-based PMUT simulation.
    Calls ECM/main.py → files are saved to disk → we return file metadata.
    """

    def run_simulation(
        self,
        shape_file_path: str,
        sequence: List[int],
        polygon_folder_path: str,
        dx: float,
        dy: float,
        n: int,
        nx: int,
        ny: int,
        n_cells: int,
        h_piezo: float,
        h_stru: float,
        n_modes: int,
        threshold: float,
        freq_range: np.ndarray,
        progress_callback: Optional[Callable] = None,
        array_arrangement: str = 'interlaced',
    ) -> dict:
        """
        Run the real ECM simulation.

        IMPORTANT: dx, dy, h_piezo, h_stru arrive in μm from the frontend.
        ECM/main.py expects meters, so we convert here.

        Returns a dict with:
          - sequence_str: e.g. "1x_abc123def456" (compact hash tag)
          - frequencies: list of float
          - output_power: list of float (raw)
          - power_db: list of float
          - peak_frequency, peak_power, bandwidth_3db
          - power_plot_png: absolute path to frequency response PNG
          - frame_pngs: list of absolute paths to vibration frame PNGs (ordered)
          - frame_frequencies: list of float per frame
        """
        _raw = "_".join(map(str, sequence))
        sequence_str = f"{len(sequence)}x_{hashlib.md5(_raw.encode()).hexdigest()[:12]}"
        unique_shapes = sorted(set(sequence))

        if progress_callback:
            progress_callback(2, "Cleaning old results")

        # ---- Clean output folders so old results don't persist ----
        label_dir = settings.label_saving_folder_path
        disp_dir = settings.disp_saving_folder_path
        for folder in [label_dir, disp_dir]:
            if os.path.isdir(folder):
                for fname in os.listdir(folder):
                    fpath = os.path.join(folder, fname)
                    try:
                        if os.path.isfile(fpath):
                            os.remove(fpath)
                    except OSError:
                        pass

        # ---- Clean ECM/saving_folder (intermediate data only, keep .py scripts) ----
        ecm_saving_dir = settings.polygon_folder_path  # ECM/saving_folder
        if os.path.isdir(ecm_saving_dir):
            for fname in os.listdir(ecm_saving_dir):
                # Keep Python scripts; remove data files (.txt, .png, .npy, etc.)
                if fname.endswith('.py'):
                    continue
                fpath = os.path.join(ecm_saving_dir, fname)
                try:
                    if os.path.isfile(fpath):
                        os.remove(fpath)
                except OSError:
                    pass

        if progress_callback:
            progress_callback(5, "Preparing polygon files")

        # Save shape file to polygon folder for ECM
        os.makedirs(polygon_folder_path, exist_ok=True)
        for shape_idx in unique_shapes:
            polygon_dest = os.path.join(polygon_folder_path, f"polygon{shape_idx}.txt")
            shutil.copy2(shape_file_path, polygon_dest)

        if progress_callback:
            progress_callback(10, "Loading ECM module")

        # Import ECM main
        try:
            from main import main as ecm_main
        except ImportError:
            import importlib.util
            ecm_main_path = os.path.join(ECM_PATH, "main.py")
            spec = importlib.util.spec_from_file_location("ecm_main", ecm_main_path)
            if spec and spec.loader:
                ecm_module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(ecm_module)
                ecm_main = ecm_module.main
            else:
                raise ImportError("Could not load ECM main module")

        # Output folders
        label_dir = settings.label_saving_folder_path
        disp_dir = settings.disp_saving_folder_path
        os.makedirs(label_dir, exist_ok=True)
        os.makedirs(disp_dir, exist_ok=True)

        if progress_callback:
            progress_callback(15, "Running ECM simulation (GPU)")

        # ---- Call ECM main.py ----
        output_power_raw = ecm_main(
            sequence=sequence,
            polygon_folder_path=polygon_folder_path,
            dx=dx * 1e-6,
            dy=dy * 1e-6,
            n=n,
            threshold=threshold,
            nx=nx,
            ny=ny,
            n_cells=n_cells,
            h_piezo=h_piezo * 1e-6,
            h_stru=h_stru * 1e-6,
            n_modes=n_modes,
            freq_range=freq_range,
            label_saving_folder_path=label_dir,
            disp_saving_folder_path=disp_dir,
            progress_callback=progress_callback,
            array_arrangement=array_arrangement,
        )

        if progress_callback:
            progress_callback(90, "Collecting output files")

        # ---- Gather results ----
        frequencies = freq_range.tolist() if isinstance(freq_range, np.ndarray) else list(freq_range)
        output_power = (
            output_power_raw.tolist()
            if isinstance(output_power_raw, np.ndarray)
            else list(output_power_raw)
        )

        # Power plot PNG saved by a11
        power_plot_png = os.path.join(label_dir, f"frequency_response_plot_{sequence_str}.png")

        # Vibration frame PNGs saved by a10 — collect & sort by frame index
        frame_pngs: List[str] = []
        frame_frequencies: List[float] = []
        pattern = re.compile(r"^frame_(\d+)_freq_(\d+)\.png$")
        if os.path.isdir(disp_dir):
            entries = []
            for fname in os.listdir(disp_dir):
                m = pattern.match(fname)
                if m:
                    entries.append((int(m.group(1)), int(m.group(2)), fname))
            entries.sort(key=lambda t: t[0])  # sort by frame index
            for idx, freq_int, fname in entries:
                frame_pngs.append(os.path.join(disp_dir, fname))
                frame_frequencies.append(float(freq_int))

        # Basic analysis
        power_arr = np.array(output_power)
        freq_arr = np.array(frequencies)
        power_db = (10 * np.log10(np.abs(power_arr) + 1e-20)).tolist()
        power_db_arr = np.array(power_db)
        peak_idx = int(np.argmax(power_db_arr))
        peak_frequency = float(freq_arr[peak_idx])
        peak_power = float(power_db_arr[peak_idx])

        threshold_3db = peak_power - 3
        above = power_db_arr >= threshold_3db
        try:
            first_above = int(np.argmax(above))
            last_above = len(above) - 1 - int(np.argmax(above[::-1]))
            bandwidth_3db = float(freq_arr[last_above] - freq_arr[first_above])
        except Exception:
            bandwidth_3db = 0.0

        if progress_callback:
            progress_callback(100, "Complete")

        return {
            "sequence_str": sequence_str,
            "frequencies": frequencies,
            "output_power": output_power,
            "power_db": power_db,
            "peak_frequency": peak_frequency,
            "peak_power": peak_power,
            "bandwidth_3db": bandwidth_3db,
            # File paths (absolute) for the output router to serve
            "power_plot_png": power_plot_png,
            "frame_pngs": frame_pngs,
            "frame_frequencies": frame_frequencies,
        }
