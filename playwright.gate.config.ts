import { defineConfig, devices } from '@playwright/test';
import full from './playwright.config';

// The per-PR GATE (required to merge, and a Vercel Deployment Check before production goes live).
// Target: under 15 minutes. One CI job per device, in parallel (.github/workflows/ci.yml).
//
// Chosen for signal per minute: boot, the screens testers see first, the bug classes that have
// actually shipped (overlay draw order, double starts, leftover overlays, barren screens, text
// under buttons, audio output) and the visual baselines. Long playthroughs and the full device
// sweep run nightly instead (playwright.config.ts, .github/workflows/nightly.yml).
export default defineConfig({
  ...full,
  testMatch: [
    'smoke.spec.ts',
    'first-run-title.spec.ts',
    'double-start.spec.ts',
    'no-barren-screens.spec.ts',
    'no-leftover-overlay.spec.ts',
    'text-under-ui.spec.ts',
    'themed-transitions.spec.ts',
    'texture-resilience.spec.ts',
    'qa-round3.spec.ts',
    'qa-round4.spec.ts',
    'return-leg.spec.ts',
    'minigame-music.spec.ts',
    'audio-output.spec.ts',
    'clock-timing.spec.ts',
    'visual.spec.ts',
    'reentry.spec.ts',
    'hud-clearance.spec.ts',
  ],
  retries: 0,
  // One WebKit phone and one Chromium phone: the two engines testers actually play on.
  projects: [
    { name: 'iPhone 12', use: { ...devices['iPhone 12'] } },
    { name: 'Pixel 7', use: { ...devices['Pixel 7'] } },
  ],
});
