// Production-build smoke check — see playwright.dist.config.ts's header for why this is separate
// from smoke.spec.ts. Boots the actual built dist/ (via vite preview), and checks the pieces
// that only exist in a production build: the PWA manifest link, service worker registration, and
// a cached offline reload.
import { test, expect } from '@playwright/test';

test('the production build boots with no console errors and renders a canvas', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto('/');
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(1000); // boot-time async tail (font swap, ambience, fireflies)
  expect(errors, errors.join('\n')).toEqual([]);
});

test('the PWA manifest is linked and valid', async ({ page }) => {
  await page.goto('/');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();
  const manifestUrl = new URL(href!, page.url()).toString();
  const res = await page.request.get(manifestUrl);
  expect(res.ok()).toBe(true);
  const manifest = await res.json();
  expect(manifest.name || manifest.short_name).toBeTruthy();
  expect(Array.isArray(manifest.icons) && manifest.icons.length).toBeTruthy();
});

test('the service worker registers in a production build (DEV skips it — see src/main.ts)', async ({ page }) => {
  await page.goto('/');
  const registered = await page.waitForFunction(async () => {
    if (!('serviceWorker' in navigator)) return false;
    const reg = await navigator.serviceWorker.getRegistration();
    return !!reg && reg.active !== null;
  }, { timeout: 15000 }).catch(() => null);
  expect(registered, 'service worker did not reach an active registration within 15s').toBeTruthy();
});

// This does NOT use context.setOffline() + reload — confirmed live (via a standalone diagnostic
// script, not kept in the repo) that Playwright's CDP-based offline emulation blocks a page's
// fetch() from ever reaching the service worker's fetch handler at all ("Failed to fetch" with
// no request even visible in the SW), even once the shell is provably cached. That's a
// Playwright/Chromium quirk in how offline emulation interacts with SW interception, not a bug
// in public/sw.js — the same diagnostic confirmed the shell (both '/' and '/index.html') really
// is in the cache by this point. So this checks the thing that's actually deterministic and
// provable here — the cache is populated — and leaves the "does a real offline reload work" call
// to the manual real-device checklist (docs/CROSS_PLATFORM_TESTING.md's Airplane Mode step),
// which isn't subject to this tooling limitation.
test('the service worker has cached the app shell (both "/" and "/index.html") after activating', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    return !!reg && reg.active !== null;
  }, { timeout: 15000 });
  await page.waitForTimeout(1000); // install-time cache.addAll settling

  const cached = await page.evaluate(async () => {
    const names = await caches.keys();
    const urls = new Set<string>();
    for (const name of names) {
      const cache = await caches.open(name);
      for (const req of await cache.keys()) urls.add(new URL(req.url).pathname);
    }
    return Array.from(urls);
  });
  expect(cached, `cached paths: ${cached.join(', ')}`).toEqual(expect.arrayContaining(['/', '/index.html']));
});
