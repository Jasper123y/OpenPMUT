import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  RefreshCw,
  FileJson,
  FileSpreadsheet,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Loader,
} from 'lucide-react';
import { useSimulation } from '../context/SimulationContext';
import { outputApi } from '../services/api';

interface FrameInfo {
  index: number;
  frequency: number;
  exists: boolean;
}

export default function OutputPage() {
  const navigate = useNavigate();
  const { state, resetState } = useSimulation();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Summary from simulation response (already in state)
  const sim = state.simulation;

  // Vibration frames metadata
  const [frames, setFrames] = useState<FrameInfo[]>([]);
  const [currentFrameIdx, setCurrentFrameIdx] = useState(0);
  const [framesLoading, setFramesLoading] = useState(false);
  const [frameImageLoaded, setFrameImageLoaded] = useState(false);

  const loadFrames = useCallback(async () => {
    if (!state.simulationId) return;
    setFramesLoading(true);
    try {
      const resp = await outputApi.getFrames(state.simulationId);
      const data = resp.data;
      if (data.frames && data.frames.length > 0) {
        setFrames(data.frames);
        setCurrentFrameIdx(0);
      }
    } catch {
      console.log('No vibration frames available yet');
    } finally {
      setFramesLoading(false);
    }
  }, [state.simulationId]);

  useEffect(() => {
    if (!state.simulationId) {
      navigate('/');
      return;
    }
    loadFrames().then(() => setLoading(false));
  }, [state.simulationId, navigate, loadFrames]);

  // Auto-retry loading frames if none found initially (results may still be writing)
  useEffect(() => {
    if (!loading && frames.length === 0 && state.simulationId) {
      const retryTimer = setTimeout(loadFrames, 1000); // check every 1s
      return () => clearTimeout(retryTimer);
    }
  }, [loading, frames.length, state.simulationId, loadFrames]);

  const formatFrequency = (freq: number) => {
    if (freq >= 1e6) return `${(freq / 1e6).toFixed(2)} MHz`;
    if (freq >= 1e3) return `${(freq / 1e3).toFixed(2)} kHz`;
    return `${freq.toFixed(0)} Hz`;
  };

  const handleNewSimulation = () => {
    resetState();
    navigate('/');
  };

  // Navigate frames via keyboard arrows
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (frames.length === 0) return;
      if (e.key === 'ArrowLeft') setCurrentFrameIdx((i) => Math.max(0, i - 1));
      if (e.key === 'ArrowRight') setCurrentFrameIdx((i) => Math.min(frames.length - 1, i + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [frames.length]);

  // Reset image loading state when frame changes
  useEffect(() => {
    setFrameImageLoaded(false);
  }, [currentFrameIdx]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading results...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-red-700">{error}</p>
        <button
          onClick={() => navigate('/')}
          className="mt-4 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
        >
          Go Back
        </button>
      </div>
    );
  }

  const currentFrame = frames[currentFrameIdx] || null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Simulation Results</h2>
          <p className="mt-1 text-gray-600">
            Frequency response and 2D vibration displacement plots.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <a
            href={outputApi.downloadCsv(state.simulationId!)}
            className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>CSV</span>
          </a>
          <a
            href={outputApi.downloadJson(state.simulationId!)}
            className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <FileJson className="w-4 h-4" />
            <span>JSON</span>
          </a>
        </div>
      </div>

      {/* Summary Cards */}
      {sim && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl p-4 text-white">
            <div className="text-sm opacity-80">Primary Resonance</div>
            <div className="text-2xl font-bold mt-1">{formatFrequency(sim.peakFrequency)}</div>
          </div>
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white">
            <div className="text-sm opacity-80">Peak Power</div>
            <div className="text-2xl font-bold mt-1">{sim.peakPower.toFixed(1)} dB</div>
          </div>
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white">
            <div className="text-sm opacity-80">-3dB Bandwidth</div>
            <div className="text-2xl font-bold mt-1">{formatFrequency(sim.bandwidth3db)}</div>
          </div>
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-4 text-white">
            <div className="text-sm opacity-80">Computation</div>
            <div className="text-2xl font-bold mt-1">
              {sim.computationTime ? `${sim.computationTime.toFixed(1)}s` : '—'}
            </div>
          </div>
        </div>
      )}

      {/* ===== 1D Output Power Plot (PNG from ECM) ===== */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h3 className="font-semibold text-gray-900">Output Power — Frequency Response</h3>
        </div>
        <div className="p-4 flex justify-center">
          <img
            src={outputApi.powerPlotUrl(state.simulationId!)}
            alt="Frequency Response Plot"
            className="max-w-full h-auto rounded"
            style={{ maxHeight: '500px' }}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              setError('Power plot image not available');
            }}
          />
        </div>
      </div>

      {/* ===== 2D Vibration Frames (PNGs from ECM) ===== */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">2D Vibration Displacement</h3>
          {frames.length > 0 && (
            <span className="text-xs text-gray-500">{frames.length} frames · Use ← → keys to navigate</span>
          )}
        </div>

        {framesLoading ? (
          <div className="p-8 text-center text-gray-500">
            <Loader className="w-8 h-8 mx-auto mb-2 animate-spin text-primary-500" />
            <p>Loading vibration frames...</p>
          </div>
        ) : frames.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p>No vibration frames available for this simulation.</p>
            <button
              onClick={loadFrames}
              className="mt-3 text-sm px-4 py-2 bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200 transition-colors"
            >
              <RefreshCw className="w-3 h-3 inline mr-1" /> Retry
            </button>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {/* Frequency Buttons — show all if ≤ 30, otherwise compact view with slider */}
            <div className="flex items-center justify-center space-x-2 flex-wrap">
              <button
                onClick={() => setCurrentFrameIdx((i) => Math.max(0, i - 1))}
                disabled={currentFrameIdx === 0}
                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Previous frame (← key)"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              {frames.length <= 30 ? (
                <div className="flex flex-wrap justify-center gap-1 max-w-4xl">
                  {frames.map((frame, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentFrameIdx(idx)}
                      className={`px-2 py-1 text-xs rounded font-mono transition-colors ${
                        idx === currentFrameIdx
                          ? 'bg-primary-600 text-white shadow-sm'
                          : 'bg-gray-100 text-gray-700 hover:bg-primary-100 hover:text-primary-700'
                      }`}
                      title={`Frame ${idx + 1}: ${formatFrequency(frame.frequency)}`}
                    >
                      {formatFrequency(frame.frequency)}
                    </button>
                  ))}
                </div>
              ) : (
                <span className="text-sm text-gray-700 font-medium min-w-[100px] text-center">
                  {currentFrame ? formatFrequency(currentFrame.frequency) : ''}
                </span>
              )}

              <button
                onClick={() => setCurrentFrameIdx((i) => Math.min(frames.length - 1, i + 1))}
                disabled={currentFrameIdx === frames.length - 1}
                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Next frame (→ key)"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Slider */}
            <div className="flex items-center space-x-3 px-2">
              <span className="text-xs text-gray-500 whitespace-nowrap">
                {formatFrequency(frames[0].frequency)}
              </span>
              <input
                type="range"
                min={0}
                max={frames.length - 1}
                value={currentFrameIdx}
                onChange={(e) => setCurrentFrameIdx(Number(e.target.value))}
                className="flex-1 accent-primary-600"
              />
              <span className="text-xs text-gray-500 whitespace-nowrap">
                {formatFrequency(frames[frames.length - 1].frequency)}
              </span>
            </div>

            {/* Frame info */}
            <div className="text-center text-sm text-gray-600">
              Frame {currentFrameIdx + 1} / {frames.length}
              {currentFrame && (
                <span className="ml-2 font-medium text-gray-800">
                  — {formatFrequency(currentFrame.frequency)}
                </span>
              )}
            </div>

            {/* The frame PNG with loading indicator */}
            <div className="flex justify-center relative" style={{ minHeight: '300px' }}>
              {!frameImageLoaded && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              )}
              <img
                key={currentFrameIdx}
                src={outputApi.framePngUrl(state.simulationId!, currentFrameIdx)}
                alt={`Vibration frame ${currentFrameIdx}`}
                className="max-w-full h-auto rounded"
                style={{ maxHeight: '500px' }}
                onLoad={() => setFrameImageLoaded(true)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Simulation Info */}
      {sim && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Simulation Info</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Computation Time:</span>
              <span className="ml-2 text-gray-900">
                {sim.computationTime.toFixed(2)}s
              </span>
            </div>
            <div>
              <span className="text-gray-500">Device:</span>
              <span className="ml-2 text-gray-900 uppercase">{sim.deviceUsed}</span>
            </div>
            <div>
              <span className="text-gray-500">Simulation ID:</span>
              <span className="ml-2 text-gray-900 font-mono">{state.simulationId}</span>
            </div>
            <div>
              <span className="text-gray-500">Vibration Frames:</span>
              <span className="ml-2 text-gray-900">{frames.length}</span>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-6 border-t border-gray-200">
        <button
          onClick={() => navigate('/simulate')}
          className="flex items-center space-x-2 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Simulation</span>
        </button>

        <button
          onClick={handleNewSimulation}
          className="flex items-center space-x-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          <span>New Simulation</span>
        </button>
      </div>
    </div>
  );
}
