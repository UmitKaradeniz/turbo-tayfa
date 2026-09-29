import { defineConfig } from 'vite';

export default defineConfig({
  build: { outDir: 'dist', target: 'es2022', chunkSizeWarningLimit: 1000 },
  optimizeDeps: { esbuildOptions: { target: 'es2022' } },
});
