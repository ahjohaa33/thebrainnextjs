// src/lib/cache-tags.js
//
// Centralized cache-tag constants used by Next.js `fetch(... { next: { tags } })`
// and by the revalidation webhook (`/api/revalidate`).
//
// Keeping tag names in one place means:
//   1. The fetcher and the webhook can never drift out of sync.
//   2. Admin/CMS hooks have a single, discoverable surface to call.
//   3. Refactors only touch this file.

export const CACHE_TAGS = {
  // Whole-site / shell
  HOME: "home",
  SITE: "site",          // logo, menu, header data — revalidate when nav changes
  HEADER_MENU: "header-menu",
  FOOTER: "footer",

  // Catalog
  CATEGORY: "category",  // any category page
  PRODUCT: "product",    // any product page
  STOCK: "stock",        // price/stock — separate so it can be purged hourly
};

/**
 * Build a slug-scoped tag, e.g. `slug:led-tv-price-in-bangladesh`.
 * Used on the [slug] route so a single product/category can be revalidated
 * without nuking every other product page.
 */
export function slugTag(slug) {
  if (!slug) return null;
  return `slug:${String(slug).toLowerCase()}`;
}

/**
 * Build a product-scoped tag, e.g. `product:123`.
 */
export function productTag(productId) {
  if (productId == null || productId === "") return null;
  return `product:${productId}`;
}

/**
 * Build a category-scoped tag, e.g. `category:tv`.
 */
export function categoryTag(categorySlugOrId) {
  if (categorySlugOrId == null || categorySlugOrId === "") return null;
  return `category:${categorySlugOrId}`;
}
