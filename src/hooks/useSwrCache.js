// hooks/useSwrCache.js
//
// Generic cache-first + background refresh hook for CLIENT-ONLY secondary data.
// Hydration-safe: starts with `null` to match SSR, hydrates from localStorage
// in useEffect.
//
// ─── When to use this hook ──────────────────────────────────────────────────
//
//   ✓ Recently viewed products
//   ✓ "You might also like" recommendations
//   ✓ Order history widget on the dashboard
//   ✓ Wishlist count badge
//   ✓ Personalized banners
//
// ─── When NOT to use this hook ──────────────────────────────────────────────
//
//   ✗ Product detail content (SEO — server-rendered, tagged in fetch)
//   ✗ Category listings (SEO — server-rendered, tagged in fetch)
//   ✗ Home page sections (SEO — server-rendered, tagged in fetch)
//   ✗ Header menu (SEO — comes from /home, server-rendered)
//   ✗ Cart contents (must be live — use apiRequest with no-store)
//   ✗ Stock / price on PDP (must be live — fetch with TTL.STOCK on server)
//
// ─── Behaviour ──────────────────────────────────────────────────────────────
//
//   1. First render: data=null, loading=true (matches SSR — no mismatch).
//   2. After mount: read cache. If usable, set data immediately and either
//      (a) skip refetch when fresh, or (b) refetch in background when stale.
//   3. If no cache: fetch normally and toggle loading off when done.
//   4. On focus / online: background refetch unless cache is still fresh.
//
// ─── Usage ─────────────────────────────────────────────────────────────────
//
//   const { data, loading, error, refresh } = useSwrCache({
//     key: `recommendations:${productId}`,
//     fetcher: () => apiRequest(`/recommendations/${productId}`),
//     freshMs: 5 * 60 * 1000,    // < 5 min: don't refetch
//     staleMs: 30 * 60 * 1000,   // < 30 min: show + refetch in bg
//                                // > 30 min: show loading + refetch
//   });

import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_PREFIX = "swr_cache:";

function storageKey(key) {
  return `${STORAGE_PREFIX}${key}`;
}

function readEntry(key) {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return {
      data: parsed.data,
      age: Date.now() - (parsed.cachedAt || 0),
    };
  } catch {
    return null;
  }
}

function writeEntry(key, data) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      storageKey(key),
      JSON.stringify({ data, cachedAt: Date.now() })
    );
  } catch {
    // quota exceeded — silent ignore
  }
}

export function useSwrCache({
  key,
  fetcher,
  freshMs = 5 * 60 * 1000,    // 5 min default
  staleMs = 30 * 60 * 1000,   // 30 min default
  refetchOnFocus = true,
  enabled = true,
}) {
  // Initial state matches the server render (no localStorage on server).
  // We hydrate from cache inside useEffect below.
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);

  // Avoid duplicate concurrent requests on the same hook instance.
  const inFlightRef = useRef(null);
  // Stable ref so callers can pass an inline fetcher without re-running effects.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const runFetch = useCallback(
    async ({ background }) => {
      if (!enabled) return;
      if (inFlightRef.current) return inFlightRef.current;

      const promise = (async () => {
        try {
          const fresh = await fetcherRef.current();
          writeEntry(key, fresh);
          setData(fresh);
          setError(null);
        } catch (err) {
          if (err?.name === "AbortError") return;
          // For background refreshes, swallow errors — we already showed
          // cached data and don't want to surface a transient failure.
          if (!background) setError(err?.message || String(err));
        } finally {
          if (!background) setLoading(false);
          inFlightRef.current = null;
        }
      })();

      inFlightRef.current = promise;
      return promise;
    },
    [key, enabled]
  );

  // Mount + key change: hydrate from cache, then decide whether to refetch.
  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    const entry = readEntry(key);

    if (entry && entry.age < staleMs) {
      // Usable cache — show it immediately.
      setData(entry.data);
      setLoading(false);

      // Inside fresh window: no network call needed.
      if (entry.age < freshMs) return;

      // Stale-but-usable: background refresh.
      runFetch({ background: true });
      return;
    }

    // Cache miss / hard-expired: clear any stale data and fetch normally.
    if (entry) setData(null); // expired entry — don't show
    setLoading(true);
    runFetch({ background: false });
  }, [key, enabled, freshMs, staleMs, runFetch]);

  // Refetch on window focus / reconnect — always background, never blocking.
  useEffect(() => {
    if (!enabled || !refetchOnFocus || typeof window === "undefined") return;

    const onActive = () => {
      const entry = readEntry(key);
      if (entry && entry.age < freshMs) return; // still fresh — skip
      runFetch({ background: true });
    };

    window.addEventListener("focus", onActive);
    window.addEventListener("online", onActive);
    return () => {
      window.removeEventListener("focus", onActive);
      window.removeEventListener("online", onActive);
    };
  }, [key, enabled, refetchOnFocus, freshMs, runFetch]);

  // Imperative refresh for use after mutations (e.g. add to wishlist).
  const refresh = useCallback(() => runFetch({ background: true }), [runFetch]);

  return { data, loading, error, refresh };
}