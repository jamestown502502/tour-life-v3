import { defineConfig, devices } from '@playwright/test';

// The FULL device-matrix suite: runs nightly in CI (.github/workflows/nightly.yml), one job per
// device. The per-PR gate is a fast subset of it (playwright.gate.config.ts).
//
// It runs against a real build (`vite build --mode e2e`), not the dev server: the dev server
// re-optimizes dependencies on a cold start and reloads the page mid-test, which was measured as
// a false failure on 2026-10-08. The `e2e` mode is a production build that additionally exposes
// window.__game/__state (src/main.ts) and skips the service worker; the real production build
// does neither, and e2e/dist-smoke.spec.ts checks that build separately.
//
// retries: 0. A test that only passes on a retry is a coin flip, not a pass; fix it or mark it
// test.fixme with an issue link and a date.
export default defineConfig({
  testDir: './e2e',
  testMatch: ['smoke.spec.ts', 'fullrun.spec.ts', 'verification.spec.ts', 'text-fit-sweep.spec.ts', 'stuck-screen-hardening.spec.ts', 'critical-issues-followup.spec.ts', 'drag.spec.ts', 'rhythm-entry.spec.ts', 'no-leftover-overlay.spec.ts', 'texture-resilience.spec.ts', 'double-start.spec.ts', 'minigame-music.spec.ts', 'return-leg.spec.ts', 'no-barren-screens.spec.ts', 'text-legibility.spec.ts', 'first-run-title.spec.ts', 'themed-transitions.spec.ts', 'return-art-and-viewport.spec.ts', 'band-help-and-echo.spec.ts', 'text-under-ui.spec.ts', 'minigame-playthrough.spec.ts', 'qa-round3.spec.ts', 'depth-pass.spec.ts', 'audio-output.spec.ts', 'clock-timing.spec.ts', 'reentry.spec.ts', 'hud-clearance.spec.ts'],
  timeout: 60000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: 'http://localhost:5193',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run build:e2e && npm run preview:e2e',
    url: 'http://localhost:5193',
    reuseExistingServer: !process.env.CI,
    timeout: 180000,
  },
  projects: [
    { name: 'iPhone 12', use: { ...devices['iPhone 12'] } },
    { name: 'iPhone 14', use: { ...devices['iPhone 14'] } },
    { name: 'Pixel 7', use: { ...devices['Pixel 7'] } },
    {
      name: 'Android 360x740',
      use: {
        viewport: { width: 360, height: 740 },
        userAgent: devices['Pixel 7'].userAgent,
        hasTouch: true,
        isMobile: true,
        deviceScaleFactor: 2,
      },
    },
  ],
});
