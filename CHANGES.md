# The Brain BD Next.js — production reliability update (2026-11-12)

This is a **changed-files-only patch**, based on the uploaded `thebrainnextjs.zip`. Existing Laravel JSON response structures and browser cart token behavior have been retained. Changes are intended for **Next.js 16.3.x / React 19**.

## Implemented in the Next.js archive

- Removed duplicate `next.config.mjs` and per-request nonce middleware (`src/middleware.js`). Security headers and a *static, compatible* CSP now live in `next.config.js`. `layout.js` no longer calls `headers()`.
- Added `src/lib/laravel.js` for **all current server-side Laravel fetches**: 4-second timeout **per GET attempt**, up to two GET retries with randomized backoff and capped `Retry-After`, a process-local concurrency cap via `p-limit`, a 15-second circuit breaker after five failures, in-flight request deduplication, last-good public JSON fallback, and `[laravel]` latency / status / 429 logs. Calls with `stream:true` do not buffer feed responses. Cart/checkout are private and never replayed; writes have a 15-second timeout to reduce duplicate-order hazards.
- Added `GET /api/catalog/shop` and `/api/catalog/search` using Laravel's existing `/shop` JSON contract, normalized allowlisted query parameters, `X-Cache: HIT|STALE|MISS`, a 60-second server cache, and public CDN `s-maxage=60, stale-while-revalidate=300`. Cookies and Authorization are never forwarded.
- Restricted `/api/cart-proxy/[...path]` to actual cart/checkout operations, retained no-store plus guest cookie/token forwarding, forwarded trusted-proxy `X-Forwarded-For` where requests cross the proxy, and made all mutating requests non-retryable.
- Search suggestions require 3 characters, cancel stale browser requests, debounce by 250ms, and keep a 60-second client cache (up to 100 terms). Shop filtering now requests the public catalog route.
- Updated server fetches: home, footer, About, product/category slug resolution, shop, both blog surfaces, JSON-generated SEO feeds, Laravel XML/CSV/robots proxy and the developer probe. About is server-rendered.
- Tagged fetch revalidation: homepage/home data 7200s; footer and About 21600s; product/category, unfiltered shop and blog 3600s; filtered shop/category/blog 60s; public catalog 60s; SEO feeds 3600s. See **critical rollout condition** below.
- Added build-time `generateStaticParams` seeds for up to 90 popular products/categories and 50 blog posts, tolerating temporarily unavailable Laravel APIs. `GET/POST /api/revalidate` now validates credentials and scope, calls `revalidateTag(tag, 'max')` and `revalidatePath`, clears local fallback snapshots and reports failures instead of claiming no-op success.
- On checkout, refreshes the Laravel cart immediately before posting the order and checks an exposed `current_stock`/`available_stock` quantity when present. Add-to-cart and checkout writes remain direct, uncached Laravel operations.
- Added `npm run warm:postdeploy`: warms home, shop, blog, About and top catalog slugs after the site is deployed. New dependency: `p-limit`.

## Important production boundaries

1. **Laravel code was not uploaded.** The webhook endpoint now works in Next.js, but the Laravel product, category, post and menu observers are **not installed** by this ZIP. Configure them (see `LARAVEL_INTEGRATION.md`) **before enabling hour-long TTLs in production**. Without observers, changes can remain stale for 1–6 hours. The public catalog's short TTL is a bounded fallback.
2. **Stock correctness must be enforced by Laravel** with transaction/row locks in both `/cart/add` and `/checkout`. The browser and this Next proxy cannot atomically guarantee stock when multiple customers order simultaneously. The new checkout GET only checks stock if Laravel includes stock values; it does not replace Laravel validation.
3. **Hash-only CSP is not production-safe in this Next.js App Router build.** Next's dynamic inline RSC/hydration scripts cannot be statically hashed. The new static CSP uses known GTM hosts and `'unsafe-inline'` to avoid breaking hydration. This preserves functionality but is less restrictive than nonce/hash-only CSP. Do not add `sha256-*` to `script-src` without validating generated hydration scripts on all pages. A strict hash-only CSP was **not** implemented.
4. `src/app/shop/page.jsx`, `src/app/blog/page.jsx` and `src/app/[slug]/page.jsx` consume `searchParams`, so Next.js may render the HTML dynamically even for unfiltered URLs; **tagged Data Cache/ISR works**, but Full Route Cache static HTML for these pages is not guaranteed. `/`, `/about-us`, and prerendered product/blog slugs without URL filters are the stronger ISR candidates.
5. Process-local memory caches and circuit state are per Node.js worker. In multi-instance production, use shared durable Next incremental cache and distribute webhook invalidations to every instance. The in-process stale fallback is limited to 250 responses and 1 MiB each (up to 24 hours on upstream error).
6. Build/runtime verification cannot substitute for staging with live Laravel. Require a successful `npm install`, `npm run build` and full checkout smoke test before promoting this patch.

## Apply patch

From your original project root, take a backup. Overwrite paths from this ZIP and run `sh apply-update.sh` from the project root to delete `next.config.mjs` and `src/middleware.js` (a ZIP overlay cannot delete old files). Do not replace your existing `.env`; the archive intentionally contains no secrets.

```bash
sh apply-update.sh
npm install
npm run build
npm run start
# Once the new site is reachable and Laravel webhook observers are installed:
WARM_SITE_URL=https://thebrainbd.com npm run warm:postdeploy
```

Required env: `REVALIDATE_SECRET` (same on Laravel); `NEXT_PUBLIC_LARAVEL_APP_URL` (full `/api/v1` base); `LARAVEL_WEB_URL`; `NEXT_PUBLIC_SITE_URL`; optional `LARAVEL_CONCURRENCY=12`, `WARM_URLS=/top-product,/top-category`.

## Smoke checks prior to traffic switch

- `GET /` and `GET /about-us`: header/footer/SEO render, no hydration errors, CSP allows GTM and app JS.
- `GET /api/catalog/shop?sort=low`, filter by brand and pagination: unchanged paginator + facets, public Cache-Control; repeated requests show `X-Cache: HIT`; requests with invalid keys return 400.
- Search suggestions appear after 3 characters; changing text cancels older suggestions.
- Category/product/blog pages resolve and structured data is present; no 404 for known slugs.
- `GET /api/cart-proxy/shop` returns 405. `GET /api/cart-proxy/cart`, `POST /api/cart-proxy/cart/add`, `POST /api/cart-proxy/cart/shipping`, `PATCH /api/cart-proxy/cart/{id}` and `POST /api/cart-proxy/checkout` keep user-specific token/cookies and `Cache-Control: no-store`.
- Try out-of-stock/insufficient-stock cases in Laravel, and verify a checkout rejection does **not** create an order or decrement inventory. Also test a normal order once.
- `POST /api/revalidate` with valid secret and `{ "resource":"product", "slug":"sample" }` returns 200 with explicit invalidated tags/paths; invalid secret returns 401. Check next request for updated content.
- XML, robots and CSV feed URLs remain streaming and parse correctly. Monitor `[laravel]` logs for 429 spikes, fallback `STALE`, upstream latency and circuit-open events.

## Files removed

`next.config.mjs`, `src/middleware.js`. An exact removal list is also supplied in `DELETE_FILES.txt`.
