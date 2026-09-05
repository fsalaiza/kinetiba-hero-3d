import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
 plugins: [react()],
 // Independent renderer experiments must not reload each other while recording.
 server: { host: '127.0.0.1', port: 5173, strictPort: true, hmr: process.env.KINETI_HMR === 'true' },
 preview: { host: '127.0.0.1', port: 4173, strictPort: true },
 resolve: { alias: [{ find: /^three$/, replacement: 'three/webgpu' }] },
 build: { target: 'es2022', outDir: 'dist', chunkSizeWarningLimit: 1800 },
 test: { environment: 'jsdom', globals: true, setupFiles: './src/setupTests.js' },
});
