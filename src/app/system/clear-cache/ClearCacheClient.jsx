"use client";

import { useState } from "react";

// Keys/prefixes this app is known to write to localStorage for caching
// purposes (see useFooterData.js and useSwrCache.js). We deliberately do
// NOT do a blanket localStorage.clear() — this browser could also be
// logged into a real cart (ponnobd_cart_token / ponnobd_cart_count in
// src/lib/api.js and CartContext.jsx), and wiping that out would delete
// someone's cart as a side effect of "clearing the cache".
const KNOWN_CACHE_KEYS = ["footer_data_cache"];
const KNOWN_CACHE_PREFIXES = ["swr_cache:"];

// Tags used across the app's ISR fetches (see home-data.js, [slug]/page.jsx,
// Footer.jsx) — revalidating these forces the next request to hit Laravel
// fresh instead of serving the cached Data Cache entry.
const REVALIDATE_TAGS = ["home", "site-header", "footer", "product", "category"];

function useLog() {
  const [lines, setLines] = useState([]);
  const push = (line) => setLines((prev) => [...prev, line]);
  return [lines, push];
}

export default function ClearCacheClient({ secretKey }) {
  const [lines, push] = useLog();
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);

  async function clearEverything() {
    setRunning(true);
    setDone(false);

    try {
      // 1. Known localStorage cache entries.
      let removed = 0;
      KNOWN_CACHE_KEYS.forEach((key) => {
        if (window.localStorage.getItem(key) !== null) {
          window.localStorage.removeItem(key);
          removed += 1;
        }
      });
      Object.keys(window.localStorage).forEach((key) => {
        if (KNOWN_CACHE_PREFIXES.some((prefix) => key.startsWith(prefix))) {
          window.localStorage.removeItem(key);
          removed += 1;
        }
      });
      push(`✓ Cleared ${removed} localStorage cache entr${removed === 1 ? "y" : "ies"}.`);

      // 2. Cache Storage API (used by the service worker's static/runtime caches).
      if ("caches" in window) {
        const keys = await window.caches.keys();
        await Promise.all(keys.map((key) => window.caches.delete(key)));
        push(`✓ Deleted ${keys.length} Cache Storage bucket${keys.length === 1 ? "" : "s"}.`);
      } else {
        push("– Cache Storage API not available in this browser.");
      }

      // 3. Unregister the service worker so it re-installs fresh next visit.
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((reg) => reg.unregister()));
        push(
          `✓ Unregistered ${registrations.length} service worker${
            registrations.length === 1 ? "" : "s"
          }.`
        );
      } else {
        push("– Service workers not supported in this browser.");
      }

      // 4. Server-side: force Next.js's ISR Data Cache to refetch from
      // Laravel on the next request, via the existing revalidate webhook.
      try {
        const qs = REVALIDATE_TAGS.map((tag) => `tag=${encodeURIComponent(tag)}`).join("&");
        const res = await fetch(
          `/api/revalidate?secret=${encodeURIComponent(secretKey)}&${qs}`
        );
        if (res.ok) {
          push(`✓ Revalidated server cache tags: ${REVALIDATE_TAGS.join(", ")}.`);
        } else {
          push(`⚠ Server revalidation responded with status ${res.status}.`);
        }
      } catch {
        push("⚠ Could not reach /api/revalidate (server cache tags left untouched).");
      }

      push("Done. A hard refresh will now load everything fresh.");
      setDone(true);
    } finally {
      setRunning(false);
    }
  }

  return (
    <main
      style={{
        maxWidth: 640,
        margin: "60px auto",
        padding: "0 20px",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>
        Clear Frontend Caches
      </h1>
      <p style={{ color: "#4b5563", fontSize: 14.5, lineHeight: 1.7, marginBottom: 24 }}>
        This clears this browser&apos;s local cache storage (footer/data
        caches, Cache Storage, the service worker) and asks the server to
        refetch product/category/home/footer data from the CMS on the next
        request. It does not touch your cart.
      </p>

      <button
        type="button"
        onClick={clearEverything}
        disabled={running}
        style={{
          padding: "12px 22px",
          borderRadius: 999,
          border: 0,
          background: running ? "#9ca3af" : "#e95b08",
          color: "#fff",
          fontWeight: 800,
          fontSize: 14.5,
          cursor: running ? "not-allowed" : "pointer",
        }}
      >
        {running ? "Clearing…" : "Clear all frontend caches"}
      </button>

      {lines.length > 0 && (
        <ul
          style={{
            marginTop: 24,
            padding: 16,
            background: "#f9fafb",
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            fontSize: 13.5,
            color: "#111827",
            lineHeight: 1.9,
            listStyle: "none",
          }}
        >
          {lines.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      )}

      {done && (
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            marginTop: 16,
            padding: "10px 18px",
            borderRadius: 999,
            border: "1px solid #e5e7eb",
            background: "#fff",
            fontWeight: 700,
            fontSize: 13.5,
            cursor: "pointer",
          }}
        >
          Reload this page
        </button>
      )}
    </main>
  );
}
