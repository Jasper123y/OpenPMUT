"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// ─── API exposed to the renderer as window.electronAPI ───────────
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    // Backend
    getBackendUrl: () => electron_1.ipcRenderer.invoke('get-backend-url'),
    backendHealth: () => electron_1.ipcRenderer.invoke('backend-health'),
    // Native file dialogs
    openFileDialog: (options) => electron_1.ipcRenderer.invoke('open-file-dialog', options),
    saveFileDialog: (options) => electron_1.ipcRenderer.invoke('save-file-dialog', options),
    // File I/O
    readFile: (filePath) => electron_1.ipcRenderer.invoke('read-file', filePath),
    writeFile: (filePath, content) => electron_1.ipcRenderer.invoke('write-file', filePath, content),
    // App info
    getAppInfo: () => electron_1.ipcRenderer.invoke('get-app-info'),
    // Menu event listeners
    onFileOpened: (callback) => {
        const handler = (_event, filePath) => callback(filePath);
        electron_1.ipcRenderer.on('file-opened', handler);
        return () => electron_1.ipcRenderer.removeListener('file-opened', handler);
    },
    onNewSimulation: (callback) => {
        const handler = () => callback();
        electron_1.ipcRenderer.on('new-simulation', handler);
        return () => electron_1.ipcRenderer.removeListener('new-simulation', handler);
    },
    onRunSimulation: (callback) => {
        const handler = () => callback();
        electron_1.ipcRenderer.on('run-simulation', handler);
        return () => electron_1.ipcRenderer.removeListener('run-simulation', handler);
    },
    onExportResults: (callback) => {
        const handler = () => callback();
        electron_1.ipcRenderer.on('export-results', handler);
        return () => electron_1.ipcRenderer.removeListener('export-results', handler);
    },
    onShowGpuStatus: (callback) => {
        const handler = () => callback();
        electron_1.ipcRenderer.on('show-gpu-status', handler);
        return () => electron_1.ipcRenderer.removeListener('show-gpu-status', handler);
    },
});
//# sourceMappingURL=preload.js.map