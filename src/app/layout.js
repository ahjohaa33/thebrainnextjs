import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import { LARAVEL_BASE_URL } from "@/lib/config";

import Providers from "./providers";
import Footer from "@/components/frontend/Footer";
import FloatingWhatsApp from "@/components/frontend/FloatingWhatsApp";
import PwaInstaller from "@/components/frontend/PwaInstaller";
import Analytics, { GtmNoscript } from "@/components/Analytics";
import EngagementTracker from "@/components/EngagementTracker";
import JsonLd from "@/components/seo/JsonLd";
import { buildMetadata, SITE_URL, SITE_NAME } from "@/lib/seo";
import {
  buildOrganizationSchema,
  buildWebsiteSchema,
  buildElectronicsStoreSchema,
} from "@/lib/schema";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata = {
  ...buildMetadata({
    title: SITE_NAME,
    description:
      "Ponnobd Electronics — buy LED TVs, ACs, smartboards, home appliances and more, with delivery across Bangladesh.",
    path: "/",
  }),
  // PWA: link the manifest (served by app/manifest.js at /manifest.webmanifest)
  // and declare the iOS home-screen icon + web-app behaviour through the
  // metadata API. These MUST go through metadata (not hand-written <meta>/<link>
  // in <head>) — Next.js hoists and dedupes metadata tags, and a manually
  // placed tag ends up in a different DOM position on the server vs. the client,
  // which triggers a hydration mismatch (React #418) on every page.
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Ponnobd",
    statusBarStyle: "default",
  },
  icons: {
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

// themeColor lives in the viewport export (the metadata.themeColor field is
// deprecated). Next renders this deterministically in <head> on both passes.
export const viewport = {
  themeColor: "#111827",
};

export default async function RootLayout({ children }) {
  // Per-request CSP nonce set by middleware.js; passed to GTM <Script> tags so
  // they remain allowed under the production Content-Security-Policy.
  const nonce = (await headers()).get("x-nonce") || undefined;

  return (
    <html lang="en">
      <head>
        {/*
          Preconnect to the Laravel API / image CDN origin so the browser
          resolves DNS + completes the TLS handshake before it needs the
          first resource. This shaves one full RTT off the LCP waterfall.
          crossOrigin="anonymous" is required for fonts / images that are
          fetched with CORS; it's a no-op for same-origin requests.
        */}
        <link rel="preconnect" href={LARAVEL_BASE_URL} crossOrigin="anonymous" />
        <link rel="dns-prefetch" href={LARAVEL_BASE_URL} />

        {/*
          Site-wide JSON-LD. Static, server-rendered, ~400 bytes total.
          Lives in <head> alongside the rest of the metadata.
        */}
        <JsonLd id="ld-organization" data={buildOrganizationSchema()} />
        <JsonLd id="ld-website" data={buildWebsiteSchema()} />
        <JsonLd id="ld-electronics-store" data={buildElectronicsStoreSchema()} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {/* GTM noscript iframe must be the first thing inside <body>. */}
        <GtmNoscript />

        <Providers>{children}</Providers>
        <Footer />

        {/*
          Site-wide floating WhatsApp button. Fixed to the bottom-right,
          links straight to the sales rep. Clicks are tracked by the
          delegated wa.me listener inside <EngagementTracker />.
        */}
        <FloatingWhatsApp />

        {/*
          PWA install shortcut. Registers the service worker and shows a
          custom "Install app" button when the browser reports the site is
          installable (or an Add-to-Home-Screen hint on iOS Safari). Hides
          itself when already installed.
        */}
        <PwaInstaller />

        {/*
          GTM + scroll-depth listeners. Mounted last so React hydrates
          interactive content first; next/script's afterInteractive
          strategy then loads gtm.js without blocking LCP.
        */}
        <Analytics nonce={nonce} />
        {/*
          Global click/submit listener for tel:, WhatsApp, and newsletter
          form events. Single delegated listener — keeps the Footer pure
          server-rendered with zero per-link JS overhead.
        */}
        <EngagementTracker />
      </body>
    </html>
  );
}
