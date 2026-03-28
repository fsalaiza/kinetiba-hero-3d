import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.js',
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.js'),
      name: 'KinetibaHero',
      fileName: 'kinetiba-hero',
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        'three',
        '@react-three/fiber',
        '@react-three/drei',
        '@react-three/postprocessing',
        'gsap',
        'gsap/ScrollTrigger',
      ],
      output: {
        exports: 'named',
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'react/jsx-runtime': 'ReactJsxRuntime',
          three: 'THREE',
          '@react-three/fiber': 'ReactThreeFiber',
          '@react-three/drei': 'ReactThreeDrei',
          '@react-three/postprocessing': 'ReactThreePostprocessing',
          gsap: 'gsap',
          'gsap/ScrollTrigger': 'ScrollTrigger',
        },
      },
    },
    outDir: 'dist',
  },
});
