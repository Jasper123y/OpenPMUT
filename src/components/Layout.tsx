import React, { useState, useEffect } from 'react';
import { Cpu, Zap, Activity } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [backendStatus, setBackendStatus] = useState<'checking' | 'healthy' | 'error'>('checking');
  const [appInfo, setAppInfo] = useState<any>(null);

  useEffect(() => {
    // Check backend health
    const checkHealth = async () => {
      if (window.electronAPI) {
        try {
          const result = await window.electronAPI.backendHealth();
          setBackendStatus(result.status === 'healthy' ? 'healthy' : 'error');
        } catch {
          setBackendStatus('error');
        }
      } else {
        // Web mode — assume backend is healthy
        setBackendStatus('healthy');
      }
    };

    const loadAppInfo = async () => {
      if (window.electronAPI) {
        try {
          const info = await window.electronAPI.getAppInfo();
          setAppInfo(info);
        } catch {
          // ignore
        }
      }
    };

    checkHealth();
    loadAppInfo();
    const interval = setInterval(checkHealth, 15000); // check every 15s
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-primary-100 rounded-lg">
                <Zap className="w-6 h-6 text-primary-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  OpenPMUT
                </h1>
                <p className="text-sm text-gray-500">
                  Multimodal PMUT Array Equivalent Circuit Modelling
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4 text-sm text-gray-500">
              {/* Backend status indicator */}
              <div className="flex items-center space-x-1.5">
                <Activity className={`w-3.5 h-3.5 ${
                  backendStatus === 'healthy' ? 'text-green-500' :
                  backendStatus === 'checking' ? 'text-amber-500 animate-pulse' :
                  'text-red-500'
                }`} />
                <span className="text-xs">
                  {backendStatus === 'healthy' ? 'Backend Ready' :
                   backendStatus === 'checking' ? 'Connecting...' : 'Backend Error'}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <Cpu className="w-4 h-4" />
                <span>GPU Accelerated</span>
              </div>
              {appInfo && (
                <span className="text-xs text-gray-400">v{appInfo.version}</span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <p className="text-sm text-gray-500">
              Based on: "Physics-Informed Eigen-Solution Neural Networks for Ultra-Fast
              Simulation and Optimization of Multimodal MEMS Ultrasonic Arrays"
            </p>
            <div className="flex items-center space-x-4 text-xs text-gray-400">
              {appInfo ? (
                <span>Electron {appInfo.electron} · Node {appInfo.node}</span>
              ) : (
                <span>Desktop Application</span>
              )}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
