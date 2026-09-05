import { defineConfig, devices } from '@playwright/test';

// Workstream 3 of the UX/QA fix pass (docs/CROSS_PLATFORM_TESTING.md): a device-emulation matrix
// smoke suite, run in CI on every push/PR. The DEV server (not the built dist/) is used here
// because the suite leans on window.__game/__state (src/main.ts, DEV-only) for reliable
// scene-state assertions — Phaser draws to <canvas>, so there's no DOM text for a normal
// Playwright locator to read. e2e/dist-smoke.spec.ts runs a lighter, state-free check against
// the actual production build (vite preview) separately, matching the "test the built dist/
// before a Capacitor port" step from the cross-platform doc.
export default defineConfig({
  testDir: './e2e',
  testMatch: ['smoke.spec.ts', 'fullrun.spec.ts', 'verification.spec.ts', 'text-fit-sweep.spec.ts', 'stuck-screen-hardening.spec.ts'],
  timeout: 60000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: 'http://localhost:5183',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5183',
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
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
