import { createContext, useContext } from 'react';

export interface GeometryData {
  cellShape: 'circular' | 'rectangular' | 'hexagonal' | 'custom';
  radius?: number;
  length?: number;
  width?: number;
  siliconThickness: number;
  piezoThickness: number;
  electrodeThickness: number;
  cellNumberX: number;
  cellNumberY: number;
  pitchX: number;
  pitchY: number;
  shapeData?: string;
}

export interface ECMParameters {
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
}

export interface ShapeFile {
  file: File | null;
  filename: string;
  uploadedPath?: string;
}

export interface ModalParameters {
  resonantFrequencies: number[];
  modalMasses: number[];
  modalStiffnesses: number[];
  dampingRatios: number[];
  couplingCoefficients: number[];
}

export interface PredictionData {
  method: string;
  computationTime: number;
  modalParameters: ModalParameters;
}

export interface FrequencyRange {
  start: number;
  end: number;
  points: number;
}

export interface SimulationData {
  peakFrequency: number;
  peakPower: number;
  bandwidth3db: number;
  computationTime: number;
  deviceUsed: string;
  frequencies?: number[];
  outputPower?: number[];
  powerDb?: number[];
  impedanceReal?: number[];
  impedanceImag?: number[];
  phase?: number[];
  hasVibration?: boolean;
  nVibrationFrames?: number;
}

export interface SimulationState {
  shapeFile: ShapeFile | null;
  ecmParams: ECMParameters | null;
  freqRange: FrequencyRange;
  geometry: GeometryData | null;
  geometryId: string | null;
  prediction: PredictionData | null;
  predictionId: string | null;
  simulation: SimulationData | null;
  simulationId: string | null;
  currentStep: number;
}

export const defaultECMParams: ECMParameters = {
  sequence: [1],
  dx: 460.0,
  dy: 250.0,
  n: 25,
  nx: 3,
  ny: 3,
  hPiezo: 1.0,
  hStru: 5.0,
  nModes: 6,
  threshold: 0.05,
};

export const defaultFreqRange: FrequencyRange = {
  start: 0.1e6,
  end: 5.1e6,
  points: 50,
};

interface SimulationContextType {
  state: SimulationState;
  updateState: (updates: Partial<SimulationState>) => void;
  resetState: () => void;
}

export const SimulationContext = createContext<SimulationContextType | null>(null);

export function useSimulation() {
  const context = useContext(SimulationContext);
  if (!context) {
    throw new Error('useSimulation must be used within SimulationProvider');
  }
  return context;
}
