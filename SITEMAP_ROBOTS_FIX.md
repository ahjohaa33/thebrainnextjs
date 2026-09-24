# Sitemap and robots proxy fix

## Root cause

The old feed helper converted `NEXT_PUBLIC_LARAVEL_APP_URL` to an origin and
used that origin for `/sitemap.xml`. If production configured the API as
`https://ponnobd.com/api/v1`, the Next.js `/sitemap.xml` route fetched
`https://ponnobd.com/sitemap.xml` — itself. The recursive requests eventually
failed at the Node/reverse-proxy layer and appeared as an upstream error.

There was also no Next.js route for `/robots.txt`, so the Laravel robots file
was never proxied by this frontend.

## Fixed files

- `src/lib/backend-feeds.js`
- `src/app/robots.txt/route.js` (new)
- every existing `src/app/sitemap*.xml/route.js`
- `src/app/meta/catalog.csv/route.js`
- `src/middleware.js`
- `.env.example`
- `.env.local`
- `next.config.js`
- removed duplicate `next.config.mjs`

## Required production environment

Set these values in the Node/Next.js hosting environment and rebuild/restart:

```env
NEXT_PUBLIC_LARAVEL_APP_URL=https://backend.ponnobd.com/api/v1
LARAVEL_WEB_URL=https://backend.ponnobd.com
NEXT_PUBLIC_SITE_URL=https://ponnobd.com
```

`LARAVEL_WEB_URL` is server-only and is now the authoritative public Laravel
origin for sitemap, robots and catalog requests. A loop guard rejects the
current Next.js request origin even if another environment variable is wrong.

## Verification

After deployment, these should return HTTP 200 with the indicated content type:

```text
/sitemap.xml               application/xml; charset=utf-8
/sitemap-products-1.xml    application/xml; charset=utf-8
/sitemap-categories.xml    application/xml; charset=utf-8
/sitemap-pages.xml         application/xml; charset=utf-8
/sitemap-static.xml        application/xml; charset=utf-8
/sitemap-blog.xml          application/xml; charset=utf-8
/robots.txt                text/plain; charset=utf-8
/meta/catalog.csv          text/csv; charset=utf-8
```
