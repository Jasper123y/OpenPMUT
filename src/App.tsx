import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Stepper from './components/Stepper';
import SimulatePage from './pages/SimulatePage';
import OutputPage from './pages/OutputPage';
import {
  SimulationContext,
  SimulationState,
  defaultECMParams,
  defaultFreqRange,
} from './context/SimulationContext';

const initialState: SimulationState = {
  shapeFile: null,
  ecmParams: defaultECMParams,
  freqRange: defaultFreqRange,
  geometry: null,
  geometryId: null,
  prediction: null,
  predictionId: null,
  simulation: null,
  simulationId: null,
  currentStep: 0,
};

function App() {
  const [state, setState] = useState<SimulationState>(initialState);

  const updateState = (updates: Partial<SimulationState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  };

  const resetState = () => {
    setState(initialState);
  };

  // Listen for Electron menu events
  useEffect(() => {
    if (!window.electronAPI) return;

    const unsubs = [
      window.electronAPI.onNewSimulation(() => {
        resetState();
        window.location.hash = '#/';
      }),
    ];

    return () => {
      unsubs.forEach((fn) => fn());
    };
  }, []);

  return (
    <SimulationContext.Provider value={{ state, updateState, resetState }}>
      {/* Use HashRouter for Electron file:// protocol compatibility */}
      <HashRouter>
        <Layout>
          <div className="max-w-6xl mx-auto">
            <Stepper currentStep={state.currentStep} />
            <div className="mt-8 bg-white rounded-xl shadow-lg p-6 md:p-8 fade-in">
              <Routes>
                <Route path="/" element={<SimulatePage />} />
                <Route path="/simulate" element={<SimulatePage />} />
                <Route path="/output" element={<OutputPage />} />
                <Route path="/input" element={<Navigate to="/" replace />} />
                <Route path="/predict" element={<Navigate to="/" replace />} />
              </Routes>
            </div>
          </div>
        </Layout>
      </HashRouter>
    </SimulationContext.Provider>
  );
}

export default App;
