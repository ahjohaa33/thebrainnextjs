# `app/_styles/` — route-scoped CSS

This folder holds CSS that used to be loaded **globally** in
`app/layout.js` via `<link rel="stylesheet" href="/frontend/v2/css/...">`.

Loading those files globally meant every page (including the homepage,
which needs none of them) shipped the full bundle, hurting LCP on
mobile. They're now imported by the specific client components that
actually need them, so Next.js / webpack only includes them in the
route bundles for those pages.

## How to populate this folder

Copy the CSS files you currently have in
`public/frontend/v2/css/` into this folder under the same names:

```
app/_styles/bootstrap.min.css   ← from public/frontend/v2/css/bootstrap.min.css
app/_styles/main.css            ← from public/frontend/v2/css/main.css
```

That's it — once they live under `app/`, the `import "@/app/_styles/..."`
statements in `CartClient.jsx`, `CheckoutClient.jsx`, and
`OrderSuccessClient.jsx` resolve and get bundled per-route.

## What about slick / animate / splitting / magiczoom / line-awesome / fontawesome-all?

Those were **not used by anything** in the JSX:

- `slick.css`           — no slider component imports it
- `magiczoom.css`       — no zoom plugin
- `splitting.css`       — no `<Splitting>` usage
- `animate.min.css`     — no `animate__*` classes anywhere
- `line-awesome.min.css` — no `la la-*` classes anywhere

So they've been removed entirely. The homepage drops ~300 KB of CSS
and one external DNS lookup as a result.

The few FontAwesome `<i className="fa fa-*">` icons that *were* in
the JSX (cart, plus/minus, social links, the "no products matched"
warning) have been replaced with inline SVGs, so the FontAwesome CSS
+ font files are no longer needed at all.
