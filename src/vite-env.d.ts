/// <reference types="vite/client" />

/**
 * Type declarations for the Electron API exposed via preload.ts
 */
interface ElectronAPI {
  getBackendUrl: () => Promise<string>;
  backendHealth: () => Promise<{ status: string }>;
  openFileDialog: (options?: any) => Promise<string | null>;
  saveFileDialog: (options?: any) => Promise<string | null>;
  readFile: (filePath: string) => Promise<{ content?: string; name?: string; path?: string; error?: string }>;
  writeFile: (filePath: string, content: string) => Promise<{ success?: boolean; error?: string }>;
  getAppInfo: () => Promise<{
    version: string;
    name: string;
    electron: string;
    node: string;
    chrome: string;
    isDev: boolean;
    platform: string;
    arch: string;
    backendUrl: string;
  }>;
  onFileOpened: (callback: (filePath: string) => void) => () => void;
  onNewSimulation: (callback: () => void) => () => void;
  onRunSimulation: (callback: () => void) => () => void;
  onExportResults: (callback: () => void) => () => void;
  onShowGpuStatus: (callback: () => void) => () => void;
}

interface Window {
  electronAPI?: ElectronAPI;
}
