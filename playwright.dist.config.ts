import { defineConfig, devices } from '@playwright/test';

// The production-build leg of Workstream 3's testing workflow (docs/CROSS_PLATFORM_TESTING.md,
// step "run the same smoke suite against built dist/ before a Capacitor port"). Separate from
// playwright.config.ts because this one serves the actual `dist/` output (vite preview) rather
// than the dev server — window.__game/__state aren't exposed in a production build (src/main.ts
// gates them on import.meta.env.DEV), so this checks what a production build CAN prove: it
// boots, the PWA manifest/service worker are wired up, and a cached reload works offline. It
// does not repeat the resume-state matrix — that needs the DEV-only state hooks and lives in
// smoke.spec.ts instead.
export default defineConfig({
  testDir: './e2e',
  testMatch: 'dist-smoke.spec.ts',
  timeout: 30000,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: 'http://localhost:4174',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4174 --strictPort',
    url: 'http://localhost:4174',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
  projects: [
    { name: 'Pixel 7 (production build)', use: { ...devices['Pixel 7'] } },
  ],
});
