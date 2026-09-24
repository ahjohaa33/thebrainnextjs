// lib/image-cache-bust.js
//
// THE BUG: product images are plain <img src="https://backend.ponnobd.com/...">
// tags pointing straight at the Laravel origin. Nothing in this repo controls
// the Cache-Control/ETag headers that origin (or any CDN in front of it)
// sends for those files. When the admin panel replaces an image but keeps
// the exact same filename (the overwhelmingly common case — "upload a new
// photo for product #123" just overwrites storage/products/123.webp), the
// URL string never changes, so the browser (and any intermediate cache) has
// no signal that the bytes behind it are different. It keeps serving the
// old file straight out of cache, sometimes indefinitely — completely
// independent of Next.js's own data revalidation (the product's name/price
// update fine because those come from a fresh JSON fetch; the *image byte
// request* is a separate, uncontrolled HTTP cache entry).
//
// THE FIX: make the URL itself change whenever the image might have
// changed, by appending a version query parameter. A changed URL is a
// guaranteed cache miss everywhere (browser, CDN, service worker) — no
// coordination with the backend's headers required.
//
//   - Best case: the API includes a per-record timestamp (`updated_at`,
//     `thumbnail_updated_at`, etc.). Pass it as `version` and the image URL
//     only changes exactly when the record actually changes — precise,
//     no wasted refetches.
//   - Fallback: if no version is available, we bucket by wall-clock time
//     so the URL still rotates on a fixed cadence. This bounds staleness to
//     that window instead of "forever" without requiring any backend
//     change. It's tuned to match this app's ISR revalidate windows
//     (5–10 min) so it doesn't invalidate more often than the page data
//     itself refreshes.
//
// Recommended follow-up (backend): return an `updated_at` (or dedicated
// image version/hash) alongside every image field so every call site can
// pass an exact version instead of relying on the time-bucket fallback.

const FALLBACK_BUCKET_MS = 10 * 60 * 1000; // 10 minutes

function fallbackBucket() {
  return Math.floor(Date.now() / FALLBACK_BUCKET_MS);
}

/**
 * Append a cache-busting query parameter to a (full) URL.
 *
 * @param {string} url - absolute or relative URL to bust.
 * @param {string|number|null|undefined} version - a value that changes
 *   whenever the underlying file changes (e.g. `product.updated_at`).
 *   When omitted, falls back to a coarse time bucket.
 */
export function withCacheBust(url, version) {
  if (!url) return url;

  const v =
    version !== undefined && version !== null && version !== ""
      ? version
      : fallbackBucket();

  const separator = String(url).includes("?") ? "&" : "?";
  return `${url}${separator}_v=${encodeURIComponent(v)}`;
}
