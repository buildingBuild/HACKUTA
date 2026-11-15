// TEMPORARY sandbox web: renders Yao's feature components from web/src/features.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: here,
  plugins: [react()],
  resolve: {
    alias: { '@features': path.resolve(here, '../../web/src/features') },
    dedupe: ['react', 'react-dom'],
  },
  server: {
    port: 5173,
    fs: { allow: [path.resolve(here, '../..')] },
    proxy: { '/api': 'http://localhost:3001', '/demo-clips': 'http://localhost:3001' },
  },
});
