import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/craftsniyukiiiv2/',
  build: { chunkSizeWarningLimit: 2500 } // TensorFlow.js loads lazily in its own chunk
});
