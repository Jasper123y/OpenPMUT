import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  base: './',  // Relative paths for Electron file:// protocol
  build: {
    outDir: 'dist-renderer',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:18765',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (err, _req, res) => {
            console.error('Proxy error:', err.message);
            if ('writeHead' in res && typeof res.writeHead === 'function') {
              (res as any).writeHead(502, { 'Content-Type': 'application/json' });
              (res as any).end(JSON.stringify({ detail: 'Backend not ready: ' + err.message }));
            }
          });
        },
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    }
  }
})
