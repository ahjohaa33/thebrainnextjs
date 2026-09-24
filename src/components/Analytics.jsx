"use client";

import Script from "next/script";
import { useEffect } from "react";
import { installScrollDepthTracking } from "@/lib/analytics";

/**
 * Single mount point for Google Tag Manager + global engagement listeners.
 *
 * Strategy:
 *   - Both Scripts use strategy="afterInteractive". This loads the
 *     dataLayer initializer + GTM bundle AFTER the page becomes
 *     interactive — completely off the LCP / FCP critical path.
 *   - Previously the dataLayer init used "beforeInteractive", which
 *     forces the script into the head and blocks render. Even at 80
 *     bytes inline, that promotes the loader to the critical path.
 *   - The dataLayer is initialised by the same one-liner inside GTM's
 *     own loader (`w[l]=w[l]||[]`), and we duplicate it as the first
 *     of two afterInteractive scripts so any `track()` calls that fire
 *     before the main GTM bundle arrives still have somewhere to queue.
 *
 * Configure with:
 *   NEXT_PUBLIC_GTM_ID=GTM-XXXXXXX
 * If not set, both scripts no-op so dev environments don't ship GTM.
 */
export default function Analytics({ nonce }) {
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID;

  useEffect(() => {
    // 75% / 90% scroll-depth events — fire once each, then auto-detach.
    const cleanup = installScrollDepthTracking();
    return cleanup;
  }, []);

  if (!gtmId) return null;

  return (
    <>
      {/* dataLayer init — afterInteractive, so it stays off the LCP path. */}
      <Script id="gtm-datalayer-init" strategy="afterInteractive" nonce={nonce}>
        {`window.dataLayer=window.dataLayer||[];`}
      </Script>

      {/* Main GTM loader — afterInteractive keeps it off the LCP path. */}
      <Script id="gtm-loader" strategy="afterInteractive" nonce={nonce}>
        {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;
j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;
f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');`}
      </Script>
    </>
  );
}

/**
 * <noscript> fallback iframe for GTM. Render this just inside <body>.
 * Required by GTM for non-JS environments (rare but spec'd).
 */
export function GtmNoscript() {
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID;
  if (!gtmId) return null;
  return (
    <noscript>
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
        height="0"
        width="0"
        style={{ display: "none", visibility: "hidden" }}
        title="gtm-fallback"
      />
    </noscript>
  );
}
