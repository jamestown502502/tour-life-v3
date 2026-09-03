import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  // fs.strict off: the dev server is launched via an 8.3 short path, which the allowlist rejects
  server: { port: 5183, strictPort: true, fs: { strict: false } },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        // Phaser itself is the bulk of the single ~1.7MB bundle and changes far less often than
        // the game code sitting on top of it — splitting it into its own chunk lets a repeat
        // visit (or a second session) serve it from cache while only the game chunk re-downloads,
        // and lets the two chunks fetch in parallel on a cold load instead of one serial blob.
        manualChunks: { phaser: ['phaser'] },
      },
    },
  },
  // Scoped to src/tests/ (this project's convention) — without this, vitest's default glob also
  // picks up e2e/*.spec.ts (Playwright specs, added by the UX/QA fix pass), which use a
  // different `test`/`describe` and fail immediately under vitest's runner.
  test: { include: ['src/tests/**/*.test.ts'] },
});
