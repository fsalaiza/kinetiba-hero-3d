import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { readFile, readdir } from 'node:fs/promises';
import react from '@vitejs/plugin-react';

// The research viewer reads the existing local screenshots. Emit those only in
// the laboratory artifact; the production scene never imports reference assets.
const referenceArchive = {
  name: 'kineti-local-reference-archive',
  apply: 'build',
  async generateBundle() {
    const files = Array.from({ length: 188 }, (_, index) => `screenshots/d2c_reference/frame_${String(index + 1).padStart(3, '0')}.jpg`);
    // Keep the linked analysis documents, without packaging the large QA tree.
    files.push(...(await readdir(resolve('docs'))).filter((name) => name.endsWith('.md')).map((name) => `docs/${name}`));
    for (const fileName of files) this.emitFile({ type: 'asset', fileName, source: await readFile(resolve(fileName)) });
  },
};

export default defineConfig({
  plugins: [react(), referenceArchive],
  resolve: { alias: [{ find: /^three$/, replacement: 'three/webgpu' }] },
  build: {
    target: 'es2022', outDir: 'dist-lab', chunkSizeWarningLimit: 2800,
    rollupOptions: { input: {
      website: resolve('index.html'),
      laboratory: resolve('research/ab.html'),
      three: resolve('research/three.html'),
      babylon: resolve('research/babylon.html'),
      playcanvas: resolve('research/playcanvas.html'),
      native_webgpu: resolve('research/native-webgpu.html'),
      native_webgl: resolve('research/native-webgl.html'),
      reference: resolve('research/reference.html'),
    } },
  },
  // host: true expone el preview en la tailnet (Tailscale IP) además de loopback;
  // allowedHosts admite el dominio público de Tailscale Funnel para visitas externas.
  preview: { host: true, port: 4174, strictPort: true, allowedHosts: ['alfred.tailfbd6cc.ts.net'] },
});
