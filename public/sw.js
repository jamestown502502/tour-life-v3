// Minimal offline/caching service worker — no build tooling, registered directly from
// src/main.ts. Two strategies only: network-first for navigation (so a redeploy's HTML/JS
// entry point is never stuck stale), cache-first for everything under /assets/ (Vite's
// content-hashed JS/CSS bundle and the game's own painted-art/font files, both effectively
// immutable per deploy — a cache-first miss just falls through to network and caches the
// result). CACHE_NAME is bumped whenever the caching *strategy* itself changes, not per
// content change — content changes are covered by cache-first's network fallback.
const CACHE_NAME = 'tourlife-v4'; // v3 -> v4: manifest.json becomes network-first (a strategy change), AND the bump evicts every stale manifest a v3 client is pinned to
// The navigation document itself was never actually cached anywhere — the fetch handler below
// only ever READ from caches.match('/index.html') as an offline fallback, so "offline reload"
// could never work (confirmed live: e2e/dist-smoke.spec.ts's offline test failed with
// net::ERR_INTERNET_DISCONNECTED). Pre-caching the shell here, plus opportunistically caching
// whatever the real deployed navigate request resolves to (below), fixes that.
const SHELL_URLS = ['./', './index.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)).catch(() => {}));
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
      fetch(request)
        .then((res) => {
          if (res.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, res.clone()));
          return res;
        })
        .catch(() =>
          caches.match(request)
            .then((r) => r || caches.match('./index.html'))
            .then((r) => r || caches.match('./')),
        ),
    );
    return;
  }

  // THE ASSET INDEX IS NEVER SERVED STALE. manifest.json lists every painted asset the game
  // loads; BootScene queues exactly what it names and nothing else. Served stale-while-revalidate
  // like the art it indexes, a client boots against the PREVIOUS deploy's manifest, never requests
  // the new assets at all, and every scene that gained art silently renders its code-drawn
  // fallback instead — reported live as "most backgrounds are jacked up" one deploy after five new
  // backdrops shipped, with the files themselves returning 200 the whole time. Note the app asking
  // for `cache: 'no-cache'` cannot fix this: once a service worker handles a request, its
  // respondWith decides, and the fetch's own cache hint is ignored.
  //
  // Network-first with a cache fallback: current whenever online, still offline-capable.
  if (url.pathname.endsWith('/assets/manifest.json')) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, res.clone()));
          return res;
        })
        .catch(() => caches.match(request)),
    );
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    // Cache-first is only safe for files whose NAME changes when their CONTENT changes. Vite's
    // bundle output is content-hashed (name.<hash>.js) and qualifies. Everything copied verbatim
    // from public/ does NOT: /assets/manifest.json and the painted art keep the same URL forever,
    // so cache-first pinned a returning player to the manifest they happened to cache first —
    // through every subsequent redeploy, permanently, because CACHE_NAME only changes when the
    // caching STRATEGY changes. New code then ran against an old asset manifest, and a texture
    // key the manifest never loaded can throw out of a scene's create().
    //
    // Hashed files stay cache-first (they can never be stale). Everything else is
    // stale-while-revalidate: instant from cache, but always refetched in the background so the
    // next load is current, and still fully offline-capable.
    const isContentHashed = /\.[0-9a-f]{8,}\.[a-z0-9]+$/i.test(url.pathname);
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(request).then((cached) => {
          const network = fetch(request)
            .then((res) => {
              if (res.ok) cache.put(request, res.clone());
              return res;
            })
            .catch(() => cached);
          if (cached && isContentHashed) return cached;
          if (cached) { network.catch(() => {}); return cached; }
          return network;
        }),
      ),
    );
  }
});
