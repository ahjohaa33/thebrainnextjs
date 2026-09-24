# LCP / mobile-performance changes

Drop-in replacement for the `src/` folder. Below is what changed and one
small manual step you need to do before building.

---

## 1. Manual step (required before `next build`)

Copy two CSS files from `public/` into `app/_styles/`:

```bash
cp public/frontend/v2/css/bootstrap.min.css  src/app/_styles/bootstrap.min.css
cp public/frontend/v2/css/main.css           src/app/_styles/main.css
```

These were previously loaded globally in `<head>` for every page.
The new `CartClient.jsx`, `CheckoutClient.jsx`, and
`OrderSuccessClient.jsx` import them directly, so they only ship in
those route bundles.

`app/_styles/` already contains stub files explaining this — overwrite
them with the real CSS.

---

## 2. Files modified

| File | Change |
|------|--------|
| `app/layout.js` | Removed 9 global `<link rel="stylesheet">` tags. Only `globals.css` remains global. |
| `app/globals.css` | Was empty (0 B). Now contains a tiny reset + the `.btn` / `.btn--base` / `.btn--lg` rules that ProductBox needs. |
| `app/page.jsx` | `HeroImage` → `next/image` with `priority`, `fetchPriority="high"`, `loading="eager"`, fixed width/height, and `sizes` on the LCP image. Other 3 hero tiles use lazy. Category icons also use `next/image`. |
| `app/page.module.css` | Added `aspect-ratio` to `.heroLeft`, `.heroRightTop`, `.heroSmall` so the layout box reserves space → no CLS while the image streams in. |
| `next.config.js` | **New file.** `images.remotePatterns` for `ponnobd.com` + Laravel origin, AVIF/WebP, `deviceSizes`, plus `Cache-Control: public, max-age=31536000, immutable` headers for `/_next/static`, `/frontend`, `/images`, `/fonts`, `/_next/image`. |
| `components/frontend/Header.jsx` | Cart icon → inline SVG. |
| `components/frontend/Footer.jsx` | Facebook / YouTube / LinkedIn / Instagram → inline SVG. |
| `components/frontend/slug/CategoryPage.jsx` | "No products matched" warning icon → inline SVG. |
| `app/cart/CartClient.jsx` | `+` / `−` icons → inline SVG. Scoped imports of `bootstrap.min.css` + `main.css`. |
| `app/checkout/CheckoutClient.jsx` | Scoped imports of `bootstrap.min.css` + `main.css`. |
| `app/order-success/OrderSuccessClient.jsx` | Scoped import of `main.css`. |
| `app/_styles/` | **New folder.** Stubs for `bootstrap.min.css` + `main.css` + a README. |

---

## 3. CSS files removed entirely (not used anywhere in the JSX)

These had **zero references** in any component, so they're gone:

- `slick.css` — no slider
- `magiczoom.css` — no zoom plugin
- `splitting.css` — no `<Splitting>`
- `animate.min.css` — no `animate__*` classes
- `line-awesome.min.css` — no `la la-*` classes
- `fontawesome-all.min.css` — replaced by inline SVG
- `https://cdnjs.cloudflare.com/.../font-awesome` — replaced by inline SVG (also kills one DNS + TLS round-trip on cold load)

If you don't need them, delete them from `public/frontend/v2/css/` too.

---

## 4. Expected impact on mobile LCP

The homepage cold-load on mobile previously fetched, render-blocking:

```
line-awesome.min.css     ~36 KB
bootstrap.min.css       ~163 KB
fontawesome-all.min.css  ~80 KB
slick.css                 ~3 KB
animate.min.css          ~75 KB
splitting.css             ~2 KB
magiczoom.css             ~6 KB
main.css                  ~?? KB
+ cdnjs FontAwesome (DNS + TLS to a 3rd-party origin)
```

After: only `globals.css` (~1 KB) is render-blocking. The hero image gets:

- `<link rel="preload" as="image">` injected automatically by `next/image priority`
- `fetchpriority="high"` + `loading="eager"`
- AVIF/WebP via the Next image optimizer
- An explicit `sizes` so mobile pulls a smaller variant
- Stable layout box from `aspect-ratio` so the image doesn't push other content around when it lands

Mobile LCP should drop meaningfully — most of the gain comes from
removing the render-blocking CSS chain, not from the image swap alone.

---

## 5. Quick verification

After dropping in the new `src/`:

```bash
# 1. Install (no new deps needed — next/image is already in Next.js)
npm install

# 2. Copy the two CSS files (see step 1 above)
cp public/frontend/v2/css/bootstrap.min.css  src/app/_styles/bootstrap.min.css
cp public/frontend/v2/css/main.css           src/app/_styles/main.css

# 3. Build & inspect
npm run build
npm start
```

Open the homepage, view source, and you should see:

- No `<link rel="stylesheet" href="/frontend/v2/css/...">` in `<head>`
- An auto-injected `<link rel="preload" as="image" href="/_next/image?url=...">` for the hero
- The hero `<img>` has `fetchpriority="high"` and `loading="eager"`
- The cart, checkout, and order-success routes still render correctly with Bootstrap layout intact (because they `import` it directly).

If you also ship the API behind a CDN (Cloudflare in front of Laravel), the hero image fetch itself becomes ~one round-trip from the user, which is the real LCP floor on mobile.
