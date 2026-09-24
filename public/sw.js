// public/sw.js
//
// Minimal service worker — its primary job is to satisfy the PWA
// installability requirement (the browser only offers "Install app" when a
// SW with a fetch handler is registered alongside a valid manifest).
//
// Caching policy is deliberately conservative so it can NEVER serve stale
// product data, prices, or CMS content:
//   - Navigations + same-origin API/dynamic requests: network-first. We only
//     fall back to a cached copy if the network is unavailable (offline).
//   - Static, immutable build assets (/_next/static, icons, fonts): cache-first
//     because they are content-hashed and safe to cache forever.
//
// Bump CACHE_VERSION to invalidate old caches on the next SW activation.

const CACHE_VERSION = "ponnobd-v1";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const OFFLINE_URL = "/";

self.addEventListener("install", (event) => {
  // Activate this SW as soon as it's finished installing.
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll([OFFLINE_URL]))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Clean up caches from older versions.
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !key.startsWith(CACHE_VERSION))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Treat content-hashed build output as immutable.
function isImmutableAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    /\.(?:js|css|woff2?|png|jpg|jpeg|gif|svg|webp|ico)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET; let the browser deal with everything else (POST, etc.).
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never touch cross-origin requests (analytics, CDN images on the backend
  // origin, GTM, etc.) — pass them straight through.
  if (url.origin !== self.location.origin) return;

  // Cache-first for immutable static assets.
  if (isImmutableAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            return response;
          })
      )
    );
    return;
  }

  // Network-first for navigations and dynamic content so data stays fresh.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached || caches.match(OFFLINE_URL))
        )
    );
    return;
  }
  // Everything else: default browser behaviour (no SW interception).
});
