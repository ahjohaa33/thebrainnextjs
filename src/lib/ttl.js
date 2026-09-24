// src/lib/ttl.js
//
// Centralized cache TTLs (in seconds), per the cache-architecture plan.
//
//   Home page sections     : 5–15 minutes   →  600s (10 min)
//   Header menu            : 1–6 hours      →  3600s (1 hour)
//   Footer                 : 6–24 hours     →  43200s (12 hours)
//   Category listing       : 2–10 minutes   →  300s (5 min)
//   Product detail         : 1–5 minutes    →  180s (3 min)
//   Product stock / price  : ~1 hour        →  3600s
//   Cart / checkout        : no-store       →  0
//
// One file, one source of truth. If the business decides home should be 7
// minutes instead of 10, change it once here and every fetcher + every
// `export const revalidate` import picks it up.

export const TTL = {
  HOME: 600,           // 10 min
  HEADER_MENU: 3600,   // 1 hour
  FOOTER: 43200,       // 12 hours
  CATEGORY: 300,       // 5 min
  PRODUCT: 180,        // 3 min
  STOCK: 3600,         // 1 hour
  NO_STORE: 0,         // cart, checkout, account
};

/**
 * Convenience: client-side TTL in milliseconds for browser caches
 * (localStorage, in-memory SWR caches, etc.).
 */
export const TTL_MS = {
  HOME: TTL.HOME * 1000,
  HEADER_MENU: TTL.HEADER_MENU * 1000,
  FOOTER: TTL.FOOTER * 1000,
  CATEGORY: TTL.CATEGORY * 1000,
  PRODUCT: TTL.PRODUCT * 1000,
  STOCK: TTL.STOCK * 1000,
};
