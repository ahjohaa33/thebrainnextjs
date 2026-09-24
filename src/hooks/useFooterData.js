// hooks/useFooterData.js
//
// Cache-first with background refresh (SWR pattern), hydration-safe.
//
// Hydration constraint: the FIRST client render must produce identical HTML
// to the server. The server has no localStorage, so it renders the loading
// skeleton. We must do the same on first client render — even if cached
// data exists — and only swap to cached data after mount inside useEffect.
//
//   1. First render (matches SSR): no data, loading=true → skeleton.
//   2. After mount: synchronously read cache. If hit, set data immediately
//      → user sees cached footer on the very next paint (effectively instant).
//   3. If cached data is past its "fresh" window, kick off a background
//      refetch. The cached UI keeps showing while the network call runs.
//   4. If there's no cache at all, fetch normally.
//
// Net effect: no hydration mismatch, and on repeat visits the footer
// appears within one frame of mount (~16 ms) instead of waiting on a
// network round-trip.

import { useEffect, useRef, useState } from "react";
import { TTL_MS } from "@/lib/ttl";

const CACHE_KEY = "footer_data_cache";

// Hard cap. Past this, the cached entry is too old to even show while we
// refetch — fall back to the loading skeleton instead.
const HARD_TTL_MS = TTL_MS.FOOTER;

// "Fresh" window. Inside this, the cache is treated as up-to-date and we
// SKIP the background refresh entirely (saves an HTTP request on quick
// repeat navigations within the same session).
const FRESH_TTL_MS = 60 * 60 * 1000; // 1 hour

// ── Cache helpers ─────────────────────────────────────────────────────────────

function readCache() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;

    const entry = JSON.parse(raw);
    if (!entry || typeof entry !== "object") return null;

    const age = Date.now() - (entry.cachedAt || 0);

    if (age > HARD_TTL_MS) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }

    return { data: entry.data, age };
  } catch {
    return null;
  }
}

function writeCache(data) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ data, cachedAt: Date.now() })
    );
  } catch {
    // localStorage quota exceeded — silently ignore
  }
}

async function fetchFromProxy(signal) {
  const res = await fetch("/api/footer", { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (!json?.success || !json?.data) throw new Error("Unexpected response shape");
  return json.data;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useFooterData() {
  // IMPORTANT: initial state must match the server render. The server has
  // no localStorage, so we always start with `null` / `loading: true`.
  // The cache is hydrated in useEffect below, AFTER React commits the
  // first client render that matches the SSR output.
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Track whether we've already kicked off the refresh for this mount,
  // so React StrictMode's double-mount in dev doesn't fire two requests.
  const didRunRef = useRef(false);

  useEffect(() => {
    if (didRunRef.current) return;
    didRunRef.current = true;

    const cached = readCache();

    // Show cached data immediately (post-hydration, so no mismatch).
    if (cached) {
      setData(cached.data);
      setLoading(false);
    }

    const isFresh = cached != null && cached.age < FRESH_TTL_MS;

    // If cache is fresh enough, skip the network call entirely.
    if (isFresh) return;

    // Otherwise: revalidate in the background. We DO NOT toggle `loading`
    // back on if we already showed cached data — that's the SWR contract.
    const controller = new AbortController();

    fetchFromProxy(controller.signal)
      .then((fresh) => {
        writeCache(fresh);
        setData(fresh);
        setError(null);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        // Only surface the error if we have nothing cached to fall back on.
        if (cached == null) setError(err.message);
      })
      .finally(() => {
        if (cached == null) setLoading(false);
      });

    return () => controller.abort();
  }, []);

  return { data, loading, error };
}