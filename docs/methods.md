# OpenPMUT: An Open-access Simulation Software

## Methods

### 1. Overview

OpenPMUT is an open-access, standalone desktop application for the simulation of Piezoelectric Micromachined Ultrasonic Transducer (PMUT) arrays. The software integrates an Equivalent Circuit Model (ECM) simulation engine with deep learning (DL)-based modal parameter predictors, all accessible through an interactive graphical user interface (GUI). By combining GPU-accelerated physics-based modelling with pre-trained neural networks, OpenPMUT eliminates the need for commercial finite element analysis (FEA) tools such as COMSOL Multiphysics, enabling researchers and engineers to perform PMUT array simulations on standard Linux workstations equipped with NVIDIA GPUs.

The software is distributed as a self-contained package and is publicly available at [https://github.com/Jasper123y/OpenPMUT](https://github.com/Jasper123y/OpenPMUT).

### 2. Software Architecture

OpenPMUT adopts a three-tier architecture comprising a frontend GUI, a backend API server, and a computational engine (Fig. 1).

**Frontend (Electron + React).** The user interface is implemented using Electron as the desktop runtime and React with TypeScript as the UI framework. The frontend provides interactive components for geometry definition, simulation parameter configuration, real-time progress monitoring, and result visualisation. Styling is handled via Tailwind CSS. The frontend communicates with the backend through a RESTful API over HTTP on localhost.

**Backend (FastAPI).** A Python-based backend server built with FastAPI exposes a set of RESTful endpoints organised into five modules: (i) Geometry — handles polygon file upload and geometry validation; (ii) Prediction — invokes DL-based modal parameter predictors; (iii) Simulation — orchestrates the ECM pipeline execution; (iv) Output — serves simulation results including frequency response data, vibration frame images, and output power curves; and (v) System — provides health checks and device information. The backend manages inter-process communication, file I/O, and simulation state.

**Computational Engine.** The core simulation logic resides in three sub-modules:
- **ECM pipeline** (`ECM/`): a multi-stage equivalent circuit modelling pipeline (stages a02–a11);
- **Eigenmode solver** (`eigenmode_solver/`): solves the eigenvalue problem for membrane vibration modes;
- **Eigenprediction** (`eigenprediction/`): DL-based predictors for eigenfrequencies, eigenvibration mode shapes, and electromechanical coupling ratios (EMCRs).

All computationally intensive modules are compiled to platform-specific shared object (`.so`) binaries for both intellectual property protection and execution performance.

### 3. Simulation Methodology

#### 3.1 Equivalent Circuit Model (ECM)

The ECM simulation pipeline models each PMUT cell as a lumped-parameter electromechanical circuit and computes the acoustic output of the full array through the following sequential stages:

1. **Eigenmode calculation** (a02): The eigenvibration modes of each PMUT membrane are computed by solving the biharmonic plate equation on the user-defined polygon geometry. The membrane is discretised into $n$ pistons per line for modal decomposition.

2. **Eigenfrequency extraction** (a03): The resonant frequencies $f_i$ corresponding to each eigenmode $i$ are determined from the eigenvalue solutions. For a clamped circular membrane, the analytical solution follows:
$$f_{mn} = \frac{\lambda_{mn}^2}{2\pi a^2} \sqrt{\frac{D}{\rho h}}$$
where $\lambda_{mn}$ is the mode parameter, $a$ is the membrane radius, $D$ is the flexural rigidity, $\rho$ is the effective density, and $h$ is the total membrane thickness.

3. **Eigenvibration stacking** (a04): Mode shapes from multiple modes (up to $n_{\text{modes}}$) are stacked to form the complete vibration profile of each cell.

4. **Array generation** (a05): Individual PMUT cells are arranged into the specified $n_x \times n_y$ array configuration with pitches $d_x$ and $d_y$, supporting both regular and interlaced arrangements.

5. **Acoustic impedance matrix** (a06): The mutual and self-radiation impedances between all piston elements across the array are computed. This stage is GPU-accelerated using CuPy to exploit parallelism in the $N_{\text{piston}} \times N_{\text{piston}}$ impedance matrix evaluation, where:
$$Z_{ij}^{\text{rad}} = \rho_0 c_0 \iint \frac{e^{-jkr_{ij}}}{2\pi r_{ij}} \, dS_i \, dS_j$$

6. **Mechanical impedance matrix** (a08): The mechanical impedance contributions, including modal mass $m_i$, modal stiffness $k_i$, and modal damping, are assembled into the coupled system matrix.

7. **Output power and current** (a09): The coupled electromechanical-acoustic system is solved across the user-specified frequency range. The output acoustic power is computed at each frequency point as:
$$P(\omega) = \frac{1}{2} \text{Re} \left[ \mathbf{v}^H \mathbf{Z}_{\text{rad}} \mathbf{v} \right]$$
where $\mathbf{v}$ is the velocity vector of all piston elements.

8. **Vibration displacement field** (a10): The displacement field of the array surface is reconstructed at selected frequency points and rendered as spatial colour maps.

9. **Frequency response visualisation** (a11): The output power spectrum is plotted and saved, with automatic extraction of the peak frequency, peak power, and −3 dB bandwidth.

#### 3.2 Deep Learning-based Modal Parameter Prediction

To eliminate the dependency on FEA tools for computing modal parameters of arbitrary membrane geometries, OpenPMUT incorporates three pre-trained DL models:

- **Eigenfrequency predictor**: Predicts the first six resonant frequencies from the membrane geometry descriptor (polygon boundary coordinates, layer thicknesses, and material properties).
- **Eigenvibration mode shape predictor**: Generates 256 × 256 spatial mode shape fields $w(x, y)$ for each of the six modes.
- **EMCR predictor**: Estimates the electromechanical coupling ratios that quantify the conversion efficiency between electrical and mechanical energy for each mode.

These predictors are implemented as neural networks trained on datasets generated from COMSOL FEA simulations. At inference time, the DL models replace the eigenmode solver when trained weights are available, reducing the per-geometry computation time from minutes (FEA) to milliseconds (DL inference).

The predicted modal parameters are formatted as text files compatible with the ECM pipeline input specification:
- Mode shapes: CSV files with columns $(X, Y, w)$ on a regular grid
- EMCRs: space-separated values, six per shape
- Eigenfrequencies: space-separated values in Hz, six per shape

#### 3.3 Composite Plate Properties

The PMUT membrane is modelled as a composite plate consisting of a silicon structural layer and a piezoelectric (PZT) layer. The effective material properties are computed using rule-of-mixtures:

$$\rho_{\text{eff}} = \frac{\rho_{\text{Si}} h_{\text{Si}} + \rho_{\text{PZT}} h_{\text{PZT}}}{h_{\text{Si}} + h_{\text{PZT}}}$$

$$E_{\text{eff}} = \frac{E_{\text{Si}} h_{\text{Si}} + E_{\text{PZT}} h_{\text{PZT}}}{h_{\text{Si}} + h_{\text{PZT}}}$$

The flexural rigidity of the composite plate is:
$$D = \frac{E_{\text{eff}} \, h_{\text{total}}^3}{12(1 - \nu^2)}$$

Default material constants used are: $\rho_{\text{Si}} = 2329$ kg/m³, $E_{\text{Si}} = 169$ GPa, $\nu_{\text{Si}} = 0.22$, $\rho_{\text{PZT}} = 7500$ kg/m³, $E_{\text{PZT}} = 63$ GPa, and $d_{31} = -274 \times 10^{-12}$ m/V.

### 4. User Workflow

The simulation workflow consists of three steps, as illustrated in the application screenshots:

**Step 1 — Input geometry and array parameters.** The user defines the PMUT cell geometry by uploading a polygon boundary file (`.txt` format with vertex coordinates) or selecting a standard shape (circular or rectangular). Array parameters are configured through the GUI, including: array dimensions ($n_x$, $n_y$), cell pitch ($d_x$, $d_y$), structural layer thickness ($h_{\text{stru}}$), piezoelectric layer thickness ($h_{\text{piezo}}$), number of eigenmodes ($n_{\text{modes}}$), piston resolution ($n$), vibration threshold, frequency range, and array arrangement type.

**Step 2 — Run simulation.** Upon submission, the backend validates the inputs, invokes the DL predictors for modal parameters (if trained models are available), and executes the ECM pipeline. Progress is reported in real time to the frontend via a polling mechanism. GPU acceleration is automatically detected and utilised when available.

**Step 3 — View output results.** Upon completion, the results are displayed in the GUI, including: (i) the frequency response curve (output power in dB vs. frequency); (ii) spatial vibration displacement maps at selected frequency points; and (iii) key performance metrics (peak frequency, peak power, −3 dB bandwidth). All results can be exported as PNG images and text data files.

### 5. Implementation Details

| Component | Technology |
|---|---|
| Desktop runtime | Electron 28 |
| Frontend framework | React 18, TypeScript, Tailwind CSS |
| Build toolchain | Vite 5 |
| Backend framework | FastAPI 0.104, Uvicorn |
| Numerical computing | NumPy 1.26, SciPy 1.11 |
| GPU acceleration | CuPy (CUDA), PyTorch ≥ 2.0 |
| DL inference | PyTorch |
| Inter-process communication | RESTful HTTP API (localhost) |
| Operating system | Linux x86_64 |
| GPU requirement | NVIDIA GPU with CUDA support |

The application is packaged as a single distributable archive (~138 MB) containing the bundled Electron runtime, the compiled frontend, the FastAPI backend, the ECM engine, and the DL model weights. A launcher script (`openpmut`) automates Python environment detection, conda environment creation (if needed), dependency installation, backend server startup, and Electron window launch. No prior installation of Node.js, Python, or CUDA toolkits by the user is required beyond having an NVIDIA GPU driver installed.

### 6. Availability

OpenPMUT is released under the MIT licence. The source code, compiled binaries, pre-trained model weights, and a ready-to-run distributable package are available at:

> **Repository**: [https://github.com/Jasper123y/OpenPMUT](https://github.com/Jasper123y/OpenPMUT)
