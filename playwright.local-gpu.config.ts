// Local-only: the gate config with real GPU flags. Headless software WebGL starves Tour Life on
// the dev laptop (boot alone outlasts the 60 s test budget); these flags let it run at full speed.
// CI keeps using playwright.gate.config.ts unchanged.
import { defineConfig } from '@playwright/test';
import gate from './playwright.gate.config';

export default defineConfig({
  ...gate,
  workers: 1,
  projects: (gate.projects ?? []).map((p) => ({
    ...p,
    use: { ...p.use, launchOptions: { args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] } },
  })),
});
