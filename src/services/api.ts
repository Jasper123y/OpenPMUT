import axios from 'axios';

/**
 * API service for OpenPMUT Desktop.
 *
 * When running inside Electron, the backend URL is provided by the main process
 * via the preload bridge (window.electronAPI.getBackendUrl()).
 * When running as a standalone web page (dev), we fall back to /api (proxied by Vite).
 */

let _backendUrl: string | null = null;

async function getBaseUrl(): Promise<string> {
  if (_backendUrl) return _backendUrl;

  // Try Electron bridge
  if (window.electronAPI) {
    try {
      const url = await window.electronAPI.getBackendUrl();
      _backendUrl = `${url}/api`;
      return _backendUrl;
    } catch {
      // fallthrough
    }
  }

  // Fallback for web dev mode
  _backendUrl = '/api';
  return _backendUrl;
}

// Eager initialization
getBaseUrl();

// Create axios instance with lazy base URL
export const api = axios.create({
  headers: { 'Content-Type': 'application/json' },
});

// Interceptor to inject base URL
api.interceptors.request.use(async (config) => {
  const base = await getBaseUrl();
  if (config.url && !config.url.startsWith('http')) {
    config.url = `${base}${config.url.startsWith('/') ? '' : '/'}${config.url}`;
  }
  return config;
});

// Helper: get the current base URL synchronously (after init)
export function getApiBase(): string {
  return _backendUrl || '/api';
}

// ECM Parameters type
export interface ECMParameters {
  sequence: number[];
  dx: number;
  dy: number;
  n: number;
  nx: number;
  ny: number;
  h_piezo: number;
  h_stru: number;
  n_modes: number;
  threshold: number;
}

// Geometry API
export const geometryApi = {
  validate: (geometry: any) => api.post('/geometry/validate', geometry),
  uploadShape: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/geometry/upload-shape', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getExamples: () => api.get('/geometry/shapes/examples'),
};

// Prediction API
export const predictionApi = {
  predict: (geometryId: string, numModes: number = 5, useAnalytical: boolean = false) =>
    api.post('/prediction/predict', {
      geometry_id: geometryId,
      num_modes: numModes,
      use_analytical: useAnalytical,
    }),
  getMethods: () => api.get('/prediction/methods/available'),
};

// Simulation API
export const simulationApi = {
  uploadShape: (file: File) => {
    const formData = new FormData();
    formData.append('shape_file', file);
    return api.post('/simulation/upload-shape', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  run: (params: {
    shapeFile: File;
    sequence: number[];
    dx: number;
    dy: number;
    n: number;
    nx: number;
    ny: number;
    hPiezo: number;
    hStru: number;
    nModes: number;
    threshold: number;
    freqStart: number;
    freqEnd: number;
    freqPoints: number;
    device?: 'cuda' | 'cpu';
    arrayArrangement?: 'interlaced' | 'normal';
  }) => {
    const formData = new FormData();
    formData.append('shape_file', params.shapeFile);
    formData.append('sequence', JSON.stringify(params.sequence));
    formData.append('dx', params.dx.toString());
    formData.append('dy', params.dy.toString());
    formData.append('n', params.n.toString());
    formData.append('nx', params.nx.toString());
    formData.append('ny', params.ny.toString());
    formData.append('h_piezo', params.hPiezo.toString());
    formData.append('h_stru', params.hStru.toString());
    formData.append('n_modes', params.nModes.toString());
    formData.append('threshold', params.threshold.toString());
    formData.append('freq_start', params.freqStart.toString());
    formData.append('freq_end', params.freqEnd.toString());
    formData.append('freq_points', params.freqPoints.toString());
    if (params.device) formData.append('device', params.device);
    if (params.arrayArrangement) formData.append('array_arrangement', params.arrayArrangement);

    return api.post('/simulation/run', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30000,
    });
  },
  runJson: (params: {
    shapeFilePath: string;
    ecmParams: ECMParameters;
    freqStart: number;
    freqEnd: number;
    freqPoints: number;
  }) =>
    api.post('/simulation/run-json', {
      shape_file_path: params.shapeFilePath,
      ecm_params: { ...params.ecmParams },
      freq_start: params.freqStart,
      freq_end: params.freqEnd,
      freq_points: params.freqPoints,
    }),
  getProgress: (simulationId: string) => api.get(`/simulation/progress/${simulationId}`),
  getResult: (simulationId: string) => api.get(`/simulation/result/${simulationId}`),
  getDevices: () => api.get('/simulation/devices/available'),
};

// Output API — serves PNG images + metadata
export const outputApi = {
  getOutput: (simulationId: string) => api.get(`/output/${simulationId}`),
  getFrames: (simulationId: string) => api.get(`/output/${simulationId}/frames`),
  powerPlotUrl: (simulationId: string) => `${getApiBase()}/output/${simulationId}/power-plot`,
  framePngUrl: (simulationId: string, frameIndex: number) =>
    `${getApiBase()}/output/${simulationId}/frame/${frameIndex}`,
  downloadCsv: (simulationId: string) => `${getApiBase()}/output/${simulationId}/download/csv`,
  downloadJson: (simulationId: string) => `${getApiBase()}/output/${simulationId}/download/json`,
};

export default api;
