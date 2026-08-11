"use strict";
/**
 * OpenPMUT Desktop — Electron Main Process
 *
 * This is the entry point for the desktop application.
 * It manages:
 *  1. The BrowserWindow (renderer / UI)
 *  2. The embedded Python FastAPI backend (child process)
 *  3. Native menus, file dialogs, and IPC bridges
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const http_1 = __importDefault(require("http"));
const fs_1 = __importDefault(require("fs"));
// ─── GPU workaround for remote X11 / headless environments ──────
electron_1.app.commandLine.appendSwitch('disable-gpu');
electron_1.app.commandLine.appendSwitch('no-sandbox');
// ─── Constants ────────────────────────────────────────────────────
const IS_DEV = !electron_1.app.isPackaged;
const APP_NAME = 'OpenPMUT';
const APP_VERSION = '1.0.0';
const BACKEND_PORT = 18765; // Internal port, not exposed to user
const BACKEND_HOST = '127.0.0.1';
const BACKEND_URL = `http://${BACKEND_HOST}:${BACKEND_PORT}`;
// ─── Globals ──────────────────────────────────────────────────────
let mainWindow = null;
let splashWindow = null;
let backendProcess = null;
let isQuitting = false;
// ─── Paths ────────────────────────────────────────────────────────
function getResourcePath(...segments) {
    if (IS_DEV) {
        return path_1.default.join(__dirname, '..', ...segments);
    }
    return path_1.default.join(process.resourcesPath, ...segments);
}
function getPythonBackendPath() {
    return getResourcePath('python-backend');
}
function getIconPath() {
    const iconName = process.platform === 'linux' ? 'icon.png' : 'icon.png';
    const devPath = path_1.default.join(__dirname, '..', 'assets', 'icons', iconName);
    const prodPath = path_1.default.join(process.resourcesPath, 'assets', 'icons', iconName);
    if (IS_DEV && fs_1.default.existsSync(devPath))
        return devPath;
    if (fs_1.default.existsSync(prodPath))
        return prodPath;
    return devPath; // fallback
}
// ─── Splash Screen ───────────────────────────────────────────────
function createSplashWindow() {
    splashWindow = new electron_1.BrowserWindow({
        width: 480,
        height: 360,
        frame: false,
        transparent: false,
        resizable: false,
        center: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
        },
    });
    const splashHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 50%, #3b82f6 100%);
          color: white;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
          overflow: hidden;
        }
        .logo { font-size: 56px; margin-bottom: 16px; }
        h1 { font-size: 32px; font-weight: 700; letter-spacing: -0.5px; }
        .subtitle { font-size: 13px; opacity: 0.8; margin-top: 6px; text-align: center; line-height: 1.5; }
        .loading {
          margin-top: 32px;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          opacity: 0.9;
        }
        .spinner {
          width: 18px; height: 18px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top: 2px solid white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .version { position: absolute; bottom: 16px; font-size: 11px; opacity: 0.5; }
      </style>
    </head>
    <body>
      <div class="logo">⚡</div>
      <h1>${APP_NAME}</h1>
      <div class="subtitle">
        Multimodal PMUT Array Simulation<br/>
        Equivalent Circuit Modelling
      </div>
      <div class="loading">
        <div class="spinner"></div>
        <span id="status">Starting backend server...</span>
      </div>
      <div class="version">v${APP_VERSION}</div>
    </body>
    </html>
  `;
    splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHtml)}`);
}
// ─── Python Backend ──────────────────────────────────────────────
function findPython() {
    // 1. Check OPENPMUT_PYTHON env var
    if (process.env.OPENPMUT_PYTHON && fs_1.default.existsSync(process.env.OPENPMUT_PYTHON)) {
        return process.env.OPENPMUT_PYTHON;
    }
    // 2. Check conda env
    const condaPrefix = process.env.CONDA_PREFIX;
    if (condaPrefix) {
        const condaPy = path_1.default.join(condaPrefix, 'bin', 'python');
        if (fs_1.default.existsSync(condaPy))
            return condaPy;
    }
    // 3. Bundled venv inside resources
    const bundledPy = getResourcePath('python-backend', 'venv', 'bin', 'python');
    if (fs_1.default.existsSync(bundledPy))
        return bundledPy;
    // 4. System python3
    return 'python3';
}
function startBackend() {
    return new Promise((resolve, reject) => {
        // First, check if a backend is already running (e.g. started by run.sh)
        http_1.default
            .get(`${BACKEND_URL}/health`, (res) => {
            if (res.statusCode === 200) {
                console.log('[Backend] Already running (started externally), reusing it.');
                resolve();
                return;
            }
            // Not healthy — start our own
            doStartBackend(resolve, reject);
        })
            .on('error', () => {
            // Not running — start our own
            doStartBackend(resolve, reject);
        });
    });
}
function doStartBackend(resolve, reject) {
    const python = findPython();
    const backendDir = getPythonBackendPath();
    const backendApp = path_1.default.join(backendDir, 'app', 'main.py');
    console.log(`[Backend] Python: ${python}`);
    console.log(`[Backend] Directory: ${backendDir}`);
    console.log(`[Backend] Port: ${BACKEND_PORT}`);
    // Verify backend directory exists
    if (!fs_1.default.existsSync(path_1.default.join(backendDir, 'app', 'main.py'))) {
        reject(new Error(`Backend not found at ${backendDir}`));
        return;
    }
    backendProcess = (0, child_process_1.spawn)(python, [
        '-m', 'uvicorn',
        'app.main:app',
        '--host', BACKEND_HOST,
        '--port', String(BACKEND_PORT),
        '--log-level', 'info',
    ], {
        cwd: backendDir,
        env: {
            ...process.env,
            PYTHONUNBUFFERED: '1',
            OPENPMUT_DESKTOP: '1',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    let started = false;
    backendProcess.stdout?.on('data', (data) => {
        const line = data.toString().trim();
        console.log(`[Backend] ${line}`);
        if (!started && line.includes('Uvicorn running')) {
            started = true;
            resolve();
        }
    });
    backendProcess.stderr?.on('data', (data) => {
        const line = data.toString().trim();
        console.error(`[Backend:err] ${line}`);
        // uvicorn sometimes logs startup to stderr
        if (!started && line.includes('Uvicorn running')) {
            started = true;
            resolve();
        }
    });
    backendProcess.on('error', (err) => {
        console.error('[Backend] Process error:', err);
        if (!started)
            reject(err);
    });
    backendProcess.on('exit', (code) => {
        console.log(`[Backend] Process exited with code ${code}`);
        backendProcess = null;
        if (!started)
            reject(new Error(`Backend exited with code ${code}`));
    });
    // Timeout: if backend doesn't start within 30s, resolve anyway (might still be loading models)
    setTimeout(() => {
        if (!started) {
            console.warn('[Backend] Timeout waiting for startup message, polling health...');
            pollBackendHealth(10, 2000).then(resolve).catch(reject);
        }
    }, 30000);
}
function pollBackendHealth(retries, delayMs) {
    return new Promise((resolve, reject) => {
        const attempt = (remaining) => {
            http_1.default
                .get(`${BACKEND_URL}/health`, (res) => {
                if (res.statusCode === 200) {
                    resolve();
                }
                else if (remaining > 0) {
                    setTimeout(() => attempt(remaining - 1), delayMs);
                }
                else {
                    reject(new Error('Backend health check failed'));
                }
            })
                .on('error', () => {
                if (remaining > 0) {
                    setTimeout(() => attempt(remaining - 1), delayMs);
                }
                else {
                    reject(new Error('Backend unreachable'));
                }
            });
        };
        attempt(retries);
    });
}
function stopBackend() {
    if (backendProcess) {
        console.log('[Backend] Stopping...');
        backendProcess.kill('SIGTERM');
        // Force kill after 2s if still alive
        const pid = backendProcess.pid;
        setTimeout(() => {
            try {
                if (pid)
                    process.kill(pid, 'SIGKILL');
            }
            catch { /* already dead */ }
            backendProcess = null;
        }, 2000);
    }
}
// ─── Main Window ─────────────────────────────────────────────────
function createMainWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 700,
        title: APP_NAME,
        show: false, // Show after load
        icon: getIconPath(),
        webPreferences: {
            preload: path_1.default.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            // webSecurity must be false for file:// → http://localhost requests
            // (React loaded from file:// needs to call the backend on 127.0.0.1)
            // This is safe because the app only connects to its own local backend.
            webSecurity: false,
        },
    });
    // Load renderer
    // Check for an explicit dev server (OPENPMUT_DEV_URL env or Vite on 15173)
    const devUrl = process.env.OPENPMUT_DEV_URL; // e.g. http://localhost:15173
    const rendererDir = path_1.default.join(__dirname, '..', 'dist-renderer');
    const rendererExists = require('fs').existsSync(path_1.default.join(rendererDir, 'index.html'));
    if (devUrl) {
        // Explicit dev URL — for development with Vite HMR
        mainWindow.loadURL(devUrl);
    }
    else if (rendererExists) {
        // Built renderer — normal production and "run from source" mode
        mainWindow.loadFile(path_1.default.join(rendererDir, 'index.html'));
    }
    else {
        // Fallback: try local Vite dev server on custom port
        mainWindow.loadURL('http://localhost:15173');
    }
    mainWindow.once('ready-to-show', () => {
        if (splashWindow) {
            splashWindow.close();
            splashWindow = null;
        }
        mainWindow?.show();
        mainWindow?.focus();
    });
    mainWindow.on('close', () => {
        // When the user clicks the X button, quit the entire app
        isQuitting = true;
        stopBackend();
    });
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
// ─── Application Menu ────────────────────────────────────────────
function createMenu() {
    const template = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'Open Shape File...',
                    accelerator: 'CmdOrCtrl+O',
                    click: async () => {
                        if (!mainWindow)
                            return;
                        const result = await electron_1.dialog.showOpenDialog(mainWindow, {
                            title: 'Open Shape File',
                            filters: [
                                { name: 'Shape Files', extensions: ['txt', 'csv'] },
                                { name: 'All Files', extensions: ['*'] },
                            ],
                            properties: ['openFile'],
                        });
                        if (!result.canceled && result.filePaths.length > 0) {
                            mainWindow.webContents.send('file-opened', result.filePaths[0]);
                        }
                    },
                },
                { type: 'separator' },
                {
                    label: 'Export Results...',
                    accelerator: 'CmdOrCtrl+E',
                    click: async () => {
                        if (!mainWindow)
                            return;
                        mainWindow.webContents.send('export-results');
                    },
                },
                { type: 'separator' },
                {
                    label: 'Quit',
                    accelerator: 'CmdOrCtrl+Q',
                    click: () => {
                        isQuitting = true;
                        electron_1.app.quit();
                    },
                },
            ],
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { type: 'separator' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { role: 'resetZoom' },
                { type: 'separator' },
                { role: 'togglefullscreen' },
            ],
        },
        {
            label: 'Simulation',
            submenu: [
                {
                    label: 'New Simulation',
                    accelerator: 'CmdOrCtrl+N',
                    click: () => {
                        mainWindow?.webContents.send('new-simulation');
                    },
                },
                {
                    label: 'Run Simulation',
                    accelerator: 'F5',
                    click: () => {
                        mainWindow?.webContents.send('run-simulation');
                    },
                },
                { type: 'separator' },
                {
                    label: 'GPU Status',
                    click: () => {
                        mainWindow?.webContents.send('show-gpu-status');
                    },
                },
            ],
        },
        {
            label: 'Help',
            submenu: [
                {
                    label: 'Documentation',
                    click: () => {
                        electron_1.shell.openExternal('https://github.com/openpmut/openpmut');
                    },
                },
                {
                    label: 'Report Issue',
                    click: () => {
                        electron_1.shell.openExternal('https://github.com/openpmut/openpmut/issues');
                    },
                },
                { type: 'separator' },
                {
                    label: `About ${APP_NAME}`,
                    click: () => {
                        if (!mainWindow)
                            return;
                        electron_1.dialog.showMessageBox(mainWindow, {
                            type: 'info',
                            title: `About ${APP_NAME}`,
                            message: `${APP_NAME} v${APP_VERSION}`,
                            detail: 'Standalone desktop application for Piezoelectric Micromachined ' +
                                'Ultrasonic Transducer (PMUT) simulation.\n\n' +
                                'Based on: "Physics-Informed Eigen-Solution Neural Networks ' +
                                'for Ultra-Fast Simulation and Optimization of Multimodal ' +
                                'MEMS Ultrasonic Arrays"\n\n' +
                                `Electron ${process.versions.electron}\n` +
                                `Node.js ${process.versions.node}\n` +
                                `Chromium ${process.versions.chrome}`,
                        });
                    },
                },
            ],
        },
    ];
    const menu = electron_1.Menu.buildFromTemplate(template);
    electron_1.Menu.setApplicationMenu(menu);
}
// ─── System Tray (disabled — app closes on window close) ─────────
// No tray needed: clicking X quits the app.
// ─── IPC Handlers ────────────────────────────────────────────────
function setupIPC() {
    // Return the backend URL to the renderer
    electron_1.ipcMain.handle('get-backend-url', () => BACKEND_URL);
    // Native file open dialog
    electron_1.ipcMain.handle('open-file-dialog', async (_event, options) => {
        if (!mainWindow)
            return null;
        const result = await electron_1.dialog.showOpenDialog(mainWindow, {
            title: options?.title || 'Open File',
            filters: options?.filters || [
                { name: 'Shape Files', extensions: ['txt', 'csv'] },
                { name: 'All Files', extensions: ['*'] },
            ],
            properties: ['openFile'],
        });
        if (result.canceled)
            return null;
        return result.filePaths[0];
    });
    // Native file save dialog
    electron_1.ipcMain.handle('save-file-dialog', async (_event, options) => {
        if (!mainWindow)
            return null;
        const result = await electron_1.dialog.showSaveDialog(mainWindow, {
            title: options?.title || 'Save File',
            filters: options?.filters || [
                { name: 'CSV Files', extensions: ['csv'] },
                { name: 'JSON Files', extensions: ['json'] },
                { name: 'All Files', extensions: ['*'] },
            ],
            defaultPath: options?.defaultPath,
        });
        if (result.canceled)
            return null;
        return result.filePath;
    });
    // Read file from disk (for native file dialogs)
    electron_1.ipcMain.handle('read-file', async (_event, filePath) => {
        try {
            const content = fs_1.default.readFileSync(filePath, 'utf-8');
            const name = path_1.default.basename(filePath);
            return { content, name, path: filePath };
        }
        catch (err) {
            return { error: err.message };
        }
    });
    // Write file to disk
    electron_1.ipcMain.handle('write-file', async (_event, filePath, content) => {
        try {
            fs_1.default.writeFileSync(filePath, content, 'utf-8');
            return { success: true };
        }
        catch (err) {
            return { error: err.message };
        }
    });
    // Backend health check
    electron_1.ipcMain.handle('backend-health', async () => {
        try {
            await pollBackendHealth(1, 0);
            return { status: 'healthy' };
        }
        catch {
            return { status: 'unhealthy' };
        }
    });
    // App info
    electron_1.ipcMain.handle('get-app-info', () => ({
        version: APP_VERSION,
        name: APP_NAME,
        electron: process.versions.electron,
        node: process.versions.node,
        chrome: process.versions.chrome,
        isDev: IS_DEV,
        platform: process.platform,
        arch: process.arch,
        backendUrl: BACKEND_URL,
    }));
}
// ─── App Lifecycle ───────────────────────────────────────────────
electron_1.app.on('ready', async () => {
    createSplashWindow();
    createMenu();
    setupIPC();
    try {
        await startBackend();
        console.log('[App] Backend started successfully');
    }
    catch (err) {
        console.error('[App] Failed to start backend:', err);
        // Still proceed — user may be using an external backend
        if (splashWindow) {
            splashWindow.webContents.executeJavaScript(`document.getElementById('status').textContent = 'Warning: Backend failed to start. Continuing...'`).catch(() => { });
        }
        await new Promise((r) => setTimeout(r, 2000));
    }
    createMainWindow();
});
electron_1.app.on('activate', () => {
    if (mainWindow === null) {
        createMainWindow();
    }
    else {
        mainWindow.show();
    }
});
electron_1.app.on('before-quit', () => {
    isQuitting = true;
    stopBackend();
});
electron_1.app.on('window-all-closed', () => {
    isQuitting = true;
    stopBackend();
    electron_1.app.quit();
});
// Prevent multiple instances
const gotTheLock = electron_1.app.requestSingleInstanceLock();
if (!gotTheLock) {
    electron_1.app.quit();
}
else {
    electron_1.app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized())
                mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
        }
    });
}
//# sourceMappingURL=main.js.map