/**
 * Next.js configuration.
 *
 * Caching strategy:
 *   - Next.js automatically serves /_next/static/* with
 *     `Cache-Control: public, max-age=31536000, immutable`. Built into
 *     the framework, can't be overridden — exactly what we want for
 *     hashed CSS/JS bundles.
 *   - Pages and API routes use `export const dynamic = "force-dynamic"`
 *     plus `cache: "no-store"` on every upstream fetch, so Next.js
 *     emits `Cache-Control: private, no-cache, no-store, max-age=0,
 *     must-revalidate` automatically. CMS updates appear on the next
 *     request.
 *   - Public assets under /public (favicons, logo.webp, fonts) get a
 *     moderate 1-day cache + 1-week stale-while-revalidate via the
 *     rule below.
 *
 * About the `source` syntax used here:
 *   Next.js uses path-to-regexp, NOT raw regex. Non-capturing groups
 *   `(?:...)` and `?` quantifiers are NOT allowed at the top level —
 *   that's what blew up the first attempt. The supported way to
 *   constrain a path parameter with a regex is `:name(pattern)`. We
 *   use one rule per extension, with the literal `.ext` escaped via
 *   `\\.`. Per the Next.js docs: characters `( ) { } [ ] | \ ^ . : * + - ? $`
 *   are reserved and must be escaped when used as literals.
 *
 * Images:
 *   - `unoptimized: true` disables the /_next/image optimization layer.
 *     The app uses plain <img> tags everywhere (so API URLs render
 *     without needing remotePatterns to be configured), and this also
 *     removes the on-disk optimized-image cache that would otherwise
 *     serve stale variants after the CMS replaces an image.
 */

const ASSET_CACHE = "public, max-age=86400, stale-while-revalidate=604800";

// Match any path ending in one of these extensions.
// Listed individually because path-to-regexp doesn't support `(a|b)`
// alternation at the source level the way regex does.
const STATIC_ASSET_EXTENSIONS = [
  "webp",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "svg",
  "ico",
  "woff",
  "woff2",
  "ttf",
  "eot",
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  reactCompiler: true,
  compress: true,
  poweredByHeader: false,
  allowedDevOrigins: ['192.168.56.1'],



  images: {
    unoptimized: true,
  },

  async headers() {
    return STATIC_ASSET_EXTENSIONS.map((ext) => ({
      // `:file(.*\\.ext)` — a single named parameter whose value is
      // constrained by the regex `.*\.ext`. Matches /foo/bar.webp,
      // /logo.webp, /assets/icons/x.svg etc.
      source: `/:file(.*\\.${ext})`,
      headers: [{ key: "Cache-Control", value: ASSET_CACHE }],
    }));
  },
};

module.exports = nextConfig;
