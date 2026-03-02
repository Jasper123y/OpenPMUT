/**
 * OpenPMUT Desktop — Preload Script
 *
 * Bridges the Electron main process and the renderer (React app).
 * Exposes a safe API via contextBridge so the renderer can:
 *  - Get backend URL
 *  - Open native file dialogs
 *  - Read/write files via the OS
 *  - Listen for menu events
 */

import { contextBridge, ipcRenderer } from 'electron';

// ─── API exposed to the renderer as window.electronAPI ───────────
contextBridge.exposeInMainWorld('electronAPI', {
  // Backend
  getBackendUrl: (): Promise<string> => ipcRenderer.invoke('get-backend-url'),
  backendHealth: (): Promise<{ status: string }> => ipcRenderer.invoke('backend-health'),

  // Native file dialogs
  openFileDialog: (options?: any): Promise<string | null> =>
    ipcRenderer.invoke('open-file-dialog', options),
  saveFileDialog: (options?: any): Promise<string | null> =>
    ipcRenderer.invoke('save-file-dialog', options),

  // File I/O
  readFile: (filePath: string): Promise<{ content?: string; name?: string; path?: string; error?: string }> =>
    ipcRenderer.invoke('read-file', filePath),
  writeFile: (filePath: string, content: string): Promise<{ success?: boolean; error?: string }> =>
    ipcRenderer.invoke('write-file', filePath, content),

  // App info
  getAppInfo: (): Promise<{
    version: string;
    name: string;
    electron: string;
    node: string;
    chrome: string;
    isDev: boolean;
    platform: string;
    arch: string;
    backendUrl: string;
  }> => ipcRenderer.invoke('get-app-info'),

  // Menu event listeners
  onFileOpened: (callback: (filePath: string) => void) => {
    const handler = (_event: any, filePath: string) => callback(filePath);
    ipcRenderer.on('file-opened', handler);
    return () => ipcRenderer.removeListener('file-opened', handler);
  },
  onNewSimulation: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('new-simulation', handler);
    return () => ipcRenderer.removeListener('new-simulation', handler);
  },
  onRunSimulation: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('run-simulation', handler);
    return () => ipcRenderer.removeListener('run-simulation', handler);
  },
  onExportResults: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('export-results', handler);
    return () => ipcRenderer.removeListener('export-results', handler);
  },
  onShowGpuStatus: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('show-gpu-status', handler);
    return () => ipcRenderer.removeListener('show-gpu-status', handler);
  },
});
