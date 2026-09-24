// src/middleware.js
//
// Adds the security response headers the scan flagged as missing
// (VULN-005 / CWE-693) and a Content-Security-Policy that backs up the
// DOMPurify sanitiser as defence-in-depth against XSS (VULN-002 / CWE-79).
//
// CSP strategy: per-request nonce + 'strict-dynamic'.
//   - Every page request gets a fresh nonce. Next.js automatically stamps it
//     onto its own framework/hydration scripts because we echo the CSP into
//     the *request* headers (see requestHeaders below). Our GTM <Script> tags
//     read the same nonce via headers() in layout.js.
//   - 'strict-dynamic' lets those nonced scripts load their own children
//     (e.g. GTM loading gtag) without us allow-listing every Google domain,
//     while injected inline <script> from an XSS payload has no valid nonce
//     and is refused.
//   - The trailing `https: 'unsafe-inline'` in script-src is a fallback for
//     legacy browsers that don't understand nonces/strict-dynamic; modern
//     browsers ignore it once a nonce is present. (Standard Google pattern.)
//
// In development the CSP is omitted (Next's HMR uses eval and would be noisy);
// all the other hardening headers still apply. Production gets the full set.

import { NextResponse } from "next/server";

const isProd = process.env.NODE_ENV === "production";

// Resolve the backend origin so images/XHR to Laravel (which may be plain
// http://127.0.0.1 in dev or https://backend.ponnobd.com in prod) are allowed.
const BACKEND_ORIGIN = (() => {
  try {
    return new URL(
      process.env.NEXT_PUBLIC_LARAVEL_APP_URL ||
        process.env.LARAVEL_APP_URL ||
        "https://backend.ponnobd.com"
    ).origin;
  } catch {
    return "";
  }
})();

function buildCsp(nonce) {
  const directives = [
    `default-src 'self'`,
    // Nonce + strict-dynamic is the real protection; the rest is legacy fallback.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https: 'unsafe-inline'`,
    // Inline style attributes (e.g. style={{...}}) + Next's injected styles.
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: https: ${BACKEND_ORIGIN}`.trim(),
    `font-src 'self' data:`,
    `connect-src 'self' https: ${BACKEND_ORIGIN}`.trim(),
    // GTM noscript/preview iframe + sanitiser-approved video embeds.
    `frame-src 'self' https://www.googletagmanager.com https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com https://www.facebook.com`,
    `frame-ancestors 'self'`,
    `form-action 'self'`,
    `base-uri 'self'`,
    `object-src 'none'`,
    // PWA: allow the same-origin service worker (/sw.js) and the web manifest
    // (/manifest.webmanifest) under an explicit directive rather than relying
    // on the default-src fallback.
    `worker-src 'self'`,
    `manifest-src 'self'`,
    `upgrade-insecure-requests`,
  ];
  return directives.join("; ");
}

function applySecurityHeaders(headers) {
  // Clickjacking — modern (frame-ancestors, in CSP) + legacy header.
  headers.set("X-Frame-Options", "SAMEORIGIN");
  // MIME sniffing.
  headers.set("X-Content-Type-Options", "nosniff");
  // Referrer leakage.
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  // Lock down powerful features the storefront never uses.
  headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()"
  );
  // HSTS — only honoured by browsers over HTTPS, harmless otherwise.
  headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  );
}

export function middleware(request) {
  // Per-request nonce (base64 of 16 random bytes).
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const nonce = btoa(String.fromCharCode(...bytes));

  const csp = isProd ? buildCsp(nonce) : "";

  // Forward the nonce + CSP on the *request* so Next.js can stamp its own
  // scripts and layout.js can read the nonce via headers().
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  if (csp) requestHeaders.set("content-security-policy", csp);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  applySecurityHeaders(response.headers);
  if (csp) response.headers.set("content-security-policy", csp);

  return response;
}

export const config = {
  // Run on documents/pages and JSON API routes; skip static assets, public feeds,
  // and the image optimiser. Feed routes do not need a CSP nonce.
  matcher: [
    {
      source:
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|map|txt|xml|csv|woff2?)$).*)",
    },
  ],
};
