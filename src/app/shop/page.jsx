import { Suspense } from "react";
import SiteHeader from "@/components/frontend/SiteHeader";
import Shopview from "./Shopview";
import { apiUrl } from "@/lib/config";

const SHOP_QUERY_KEYS = [
  "page",
  "limit",
  "sort",
  "availability",
  "brand",
  "minPrice",
  "maxPrice",
  "query",
  "category_id",
];

function firstSearchValue(value) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function buildShopQuery(searchParams = {}) {
  const params = new URLSearchParams();

  SHOP_QUERY_KEYS.forEach((key) => {
    const value = String(firstSearchValue(searchParams?.[key])).trim();
    if (value) params.set(key, value);
  });

  // Keep the original shop defaults when the URL does not override them.
  if (!params.has("page")) params.set("page", "1");
  if (!params.has("limit")) params.set("limit", "12");
  if (!params.has("sort")) params.set("sort", "low");

  return params;
}

// Server component wrapper.
//
// IMPORTANT: the initial Laravel request must use the same filters that are
// present in the public /shop URL. Otherwise a request such as
// /shop?query=television (including searches submitted from the header) would
// hydrate with the unfiltered first page. ShopView intentionally skips its
// first client request when server data exists, so mismatched server data made
// search and direct/reloaded price-filter URLs look broken.
async function getInitialShopData(searchParams = {}) {
  const params = buildShopQuery(searchParams);

  try {
    const res = await fetch(apiUrl(`/shop?${params.toString()}`), {
      headers: { Accept: "application/json" },
      next: { revalidate: 300, tags: ["shop"] },
    });

    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default async function ShopPage({ searchParams }) {
  const resolvedSearchParams = (await searchParams) || {};
  const initialData = await getInitialShopData(resolvedSearchParams);

  return (
    <>
      <SiteHeader />
      <Suspense fallback={null}>
        <Shopview initialData={initialData} />
      </Suspense>
    </>
  );
}
