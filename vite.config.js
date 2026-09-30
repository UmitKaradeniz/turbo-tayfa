import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(version) },
  build: { outDir: 'dist', target: 'es2022', chunkSizeWarningLimit: 1000 },
  optimizeDeps: { esbuildOptions: { target: 'es2022' } },
});
