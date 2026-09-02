import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  // fs.strict off: the dev server is launched via an 8.3 short path, which the allowlist rejects
  server: { port: 5183, strictPort: true, fs: { strict: false } },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 2000,
  },
  // Scoped to src/tests/ (this project's convention) — without this, vitest's default glob also
  // picks up e2e/*.spec.ts (Playwright specs, added by the UX/QA fix pass), which use a
  // different `test`/`describe` and fail immediately under vitest's runner.
  test: { include: ['src/tests/**/*.test.ts'] },
});
