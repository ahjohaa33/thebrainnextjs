/** @type {import('next').NextConfig} */
// Static CSP removes per-request nonces, so eligible pages can use ISR.
// Next App Router emits dynamic inline RSC hydration scripts; a hash-only
// policy would block those scripts. Keep unsafe-inline until the framework
// supplies a supported per-build hash mechanism (documented in CHANGES.md).
const STATIC_EXTENSIONS = ['webp', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'woff', 'woff2', 'ttf', 'eot'];
const ASSET_CACHE = 'public, max-age=86400, stale-while-revalidate=604800';
const laravelOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_LARAVEL_APP_URL || process.env.LARAVEL_APP_URL || 'https://backend.thebrainbd.com').origin;
  } catch { return 'https://backend.thebrainbd.com'; }
})();
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com https://www.googleadservices.com https://www.google.com https://www.gstatic.com",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https: ${laravelOrigin}`,
  "font-src 'self' data:",
  `connect-src 'self' https: ${laravelOrigin}`,
  "frame-src 'self' https://www.googletagmanager.com https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com https://www.facebook.com",
  "frame-ancestors 'self'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "worker-src 'self'",
  "manifest-src 'self'",
  'upgrade-insecure-requests',
].join('; ');

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  ...(process.env.NODE_ENV === 'production' ? [{ key: 'Content-Security-Policy', value: CSP }] : []),
];

const nextConfig = {
  reactStrictMode: true,
  reactCompiler: true,
  compress: true,
  poweredByHeader: false,
  allowedDevOrigins: ['192.168.56.1'],
  images: { unoptimized: true },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      ...STATIC_EXTENSIONS.map((ext) => ({
        source: `/:file(.*\\.${ext})`,
        headers: [{ key: 'Cache-Control', value: ASSET_CACHE }],
      })),
    ];
  },
};
module.exports = nextConfig;
