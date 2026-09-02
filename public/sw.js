// Minimal offline/caching service worker — no build tooling, registered directly from
// src/main.ts. Two strategies only: network-first for navigation (so a redeploy's HTML/JS
// entry point is never stuck stale), cache-first for everything under /assets/ (Vite's
// content-hashed JS/CSS bundle and the game's own painted-art/font files, both effectively
// immutable per deploy — a cache-first miss just falls through to network and caches the
// result). CACHE_NAME is bumped whenever the caching *strategy* itself changes, not per
// content change — content changes are covered by cache-first's network fallback.
const CACHE_NAME = 'tourlife-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // never intercept cross-origin requests

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html').then((r) => r || caches.match('/'))),
    );
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request).then((res) => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          });
        }),
      ),
    );
  }
});
