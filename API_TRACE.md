# The Brain BD Next.js API Trace — 2026-11-12

This trace reflects the supplied Next.js application **after the public catalog / transport migration**. The developer API panel remains diagnostic only. All existing Laravel JSON response shapes are retained. The Laravel backend itself was not supplied or modified.

**Server transport:** all Laravel fetches in server components, route handlers, JSON SEO feeds and public XML/CSV/robots feeds now use `src/lib/laravel.js` (four-second public GET timeout per attempt; two GET retries; `p-limit`; circuit breaker; deduplicated GETs; public last-good fallback; 429/latency/`X-Cache` logs). Private cart/checkout GET/POST requests bypass shared caching, with non-retryable writes and 15-second mutation timeout. Asset image requests are browser-native and are not proxied through this transport.

**Caching:** tagged Next fetch caches use `home=7200s`, `footer=21600s`, `about=21600s`, unfiltered `shop/category/product/blog=3600s`, filtered listing=60s, JSON SEO feeds=3600s, public catalog route memory/Next cache=60s and CDN `s-maxage=60, stale-while-revalidate=300`. Laravel must call `/api/revalidate` on changes before long TTLs are safe. See `CHANGES.md` for the App Router search-param / Full Route Cache limitation.

## Runtime request graph

- **Homepage / shared header** → `GET {NEXT_PUBLIC_LARAVEL_APP_URL}/home`
- **Footer / contact showroom data** → `GET .../footer` (server-direct) and browser `GET /api/footer` → Laravel `/footer`
- **About page** → server `GET .../about` with `about` tag; legacy browser `GET /api/about` still works
- **Shop initial render** → server `GET .../shop?sort=low` (defaults remain Laravel-defined; tagged cache)
- **Shop filter/pagination refresh** → browser `GET /api/catalog/shop?...` → Laravel `/shop?...` (no cookies)
- **Product/category catch-all** → server `GET .../product-or-category/{slug}` plus forwarded search params
- **Blog list** → server `GET .../blog?search=&category=&page=`
- **Blog detail** → server `GET .../blog/{slug}`; may also fetch `/blog` for sidebar categories
- **Cart** → all browser calls go through `/api/cart-proxy/*`, forwarding `X-Cart-Token`, cookies and optional Authorization to Laravel
- **Checkout** → live `GET .../cart` preflight then `POST .../checkout` (non-retryable); frontend sends customer/shipping/payment fields only and expects Laravel to use the persisted cart; transactional stock checking must be done in Laravel
- **SEO feeds** → Next public routes proxy the Laravel **web origin** (not `/api/v1`) for sitemap XML, robots.txt and catalog CSV

## Laravel API endpoints required

| Method | Path | Purpose | Key request contract | Key response contract |
|---|---|---|---|---|
| GET | `/home` | Home, menu/header, homepage sections/videos | — | `meta`, `site`, `galleries[]`, `categories[]`, `sections[]`, `video_sections[]`, `footer_content` |
| GET | `/footer` | Footer/showrooms/contact | — | `{ success, data: { meta, widget_one, widget_two, showrooms, social_links } }` |
| GET | `/about` | CEO/about content | — | root / `data` / `about` object accepted |
| GET | `/shop` | Shop listing and filters | `page,limit,sort,availability,brand,minPrice,maxPrice,query,category_id` | `products` paginator + `brands[]` + `categories[]` |
| GET | `/product-or-category/{slug}` | Product/category resolver | category filter/search params forwarded | `{type:'product',product}` or `{type:'category',category}`, optional `seo`/`redirect_to` |
| GET | `/blog` | Blog list | `search,category,page` | `posts` paginator + `categories[]` |
| GET | `/blog/{slug}` | Blog detail | slug | flexible post wrapper; optional categories/related posts |
| GET | `/cart` | Load guest cart | guest token/cookie | `{data:{items,summary:{count,subtotal}}}` |
| POST | `/cart/add` | Add item | `{product_id,quantity}` | updated cart envelope |
| PATCH | `/cart/{cartId}` | Change quantity | `{quantity}` | updated cart envelope |
| DELETE | `/cart/{cartId}` | Remove item | — | updated cart envelope |
| DELETE | `/cart/clear` | Empty cart | — | updated cart envelope |
| POST | `/cart/shipping` | Shipping method | `{shipping_type}` | message optional; cart is re-fetched |
| POST | `/checkout` | Place order | `{name,address,phone,notes?,payment_type:'cash_on_delivery',shipping_type}` | order number/details in one of the tolerated wrappers |

The old commented-out wishlist handler and button markup were removed from the Shop view; the active shop UI is unchanged.

## Guest cart identity

`src/lib/api.js` creates and persists a browser token under `ponnobd_cart_token`. The Next catch-all proxy sends it as `X-Cart-Token` and also maps it into the Laravel guest cookie name (`GUEST_COOKIE_NAME`, default `guest_id`). Laravel cart and checkout routes should resolve the same guest cart from this identity.

## Checkout compatibility

The frontend does **not** send cart line items to `/checkout`. The backend must load the saved guest cart and create the order from that state. For order-success rendering, the frontend is tolerant of several naming variants, but a clean response shape such as the following is recommended:

```json
{
  "success": true,
  "message": "Order placed successfully.",
  "data": {
    "order": {
      "id": 123,
      "order_number": "PN-2026-000123",
      "total": 45000,
      "order_details": [
        {
          "id": 1,
          "product": { "id": 10, "name": "Product" },
          "quantity": 1,
          "price": 45000,
          "total_price": 45000
        }
      ]
    }
  }
}
```

## Product response fields used

The product page consumes: `id`, `name`, `slug`, `thumbnail`, `gallery[]`, `thumbnail_updated_at`, `updated_at`, `brand`/`brand_name`, `categories[]`/`category`, `warranty` variants, `regular_price`, `discount_price`, `sale_price`, `price`, `current_stock`, `short_description`, `description`, `support_description`, `product_video`, `reviews[]`, `related_products[]`, and `alt`.

## Category response fields used

The category page expects `name`, `slug`, `description`, SEO fields, `products` paginator, `brands[]`, `attributes` plus optional `attributeNames`, optional FAQ variants, optional `priceTableProducts` variants, optional `promotion`, and filtering metadata such as `limit`/`sort`.

## Shop response product fields used

Shop cards use `id`, `name`, `slug`/`url`, `thumbnail`/`image`/`webp`, `discount_price`, `unit_price`, `brand`, and `current_stock`. Brand filters use `id`/`name`; category filters use `id`/`name`/`products_count`.

## Laravel public-web endpoints required

These are fetched from `LARAVEL_WEB_URL` (for example `https://backend.example.com`) rather than the API base:

- `/sitemap.xml`
- `/sitemap-products-1.xml`
- `/sitemap-categories.xml`
- `/sitemap-pages.xml`
- `/sitemap-static.xml`
- `/sitemap-blog.xml`
- `/robots.txt`
- `/uploads/meta/catalog.csv`

## Non-backend observations

- The contact form is presentation-only; it currently sends **no API request**.
- `src/lib/youtube.js` contains YouTube Data API fallback logic, but no current import/call site was found. Homepage video data comes from `/home.video_sections`.
- `/api/revalidate` executes real `revalidateTag(tag, 'max')` plus `revalidatePath` and accepts explicit `{tags,paths}` or event `{resource:'product|category|blog|menu|site|about|footer',slug,old_slug}`. It accepts a secret header and retains legacy secret query param/GET compatibility for `/system/clear-cache`.
- `/api/catalog/[...path]` accepts **only** `shop` or `search`, the same Laravel `/shop` paginator response, and normalized allowlisted query parameters (`page,limit,sort,availability,brand,minPrice,maxPrice,query,category_id` plus historical aliases such as `brands[]`, `q`, `status`). It forwards the trusted reverse-proxy `X-Forwarded-For`, not cookies or auth.
- `/api/cart-proxy/[...path]` now accepts only `GET /cart`, `POST /cart/add`, `POST /cart/shipping`, `PATCH|PUT|DELETE /cart/{id}`, `DELETE /cart/clear`, `POST /checkout`. It forwards guest token, cookies, Authorization and `X-Forwarded-For`; response `Cache-Control: no-store`.
- Public routes may respond with `X-Cache: HIT|MISS|STALE` describing the in-process Laravel fetch cache; a CDN may have its own separate hit/miss headers. 429 request-attempt events and upstream latency are logged as JSON in the Next.js process. Client suggestions also cache 60s, abort stale requests and require three characters.
- Laravel product/category/blog/menu observers were **not** present in this uploaded archive. Read `LARAVEL_INTEGRATION.md` before deploying with hour-long TTLs.

## Developer API panel

Run the app in development and open:

`/system/api-panel`

Features:

- filter/search the traced contract;
- build dynamic paths/query strings visually;
- copy generated Laravel route stubs;
- export the complete catalog as JSON;
- test only read-only, non-session Laravel endpoints through a constrained server-side probe;
- mutation/cart/checkout probing is deliberately disabled to prevent accidental state changes.

Production is disabled by default. Set `API_PANEL_ENABLED=true` only when you intentionally want the panel available, and protect it at your access-control/reverse-proxy layer.
