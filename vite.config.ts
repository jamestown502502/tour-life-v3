import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  // fs.strict off: the dev server is launched via an 8.3 short path, which the allowlist rejects
  server: { port: 5183, strictPort: true, fs: { strict: false } },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 2000,
  },
  test: {},
});
