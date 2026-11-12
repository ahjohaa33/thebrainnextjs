import { Suspense } from "react";
import SiteHeader from "@/components/frontend/SiteHeader";
import Shopview from "./Shopview";
import { apiUrl } from "@/lib/config";
import { laravelFetch } from "@/lib/laravel";
import { buildShopQuery, isShopCatalogPayload } from "./shop-query.mjs";
import { buildMetadata, shouldNoindex } from "@/lib/seo";

// Unfiltered shop data uses tagged ISR. Filtered URLs use the separate short TTL.
export const revalidate = 3600;

export async function generateMetadata({ searchParams }) {
  const filters = (await searchParams) || {};
  return buildMetadata({
    title: 'Shop Premium Caps & Headwear | The Brain BD',
    description: 'Explore premium caps, adjustable baseball caps, and fashion headwear online in Bangladesh at The Brain BD.',
    path: '/shop',
    searchParams: filters,
    noindex: shouldNoindex({ pathname: '/shop', searchParams: filters }),
  });
}


// Server data always uses the exact normalized URL and preserves Laravel response shape.
async function getInitialShopData(searchParams = {}) {
  const params = buildShopQuery(searchParams);

  try {
    const filtered = [...params].some(([key, value]) => !(key === 'sort' && value === 'low'));
    const res = await laravelFetch(apiUrl(`/shop?${params.toString()}`), {
      headers: { Accept: "application/json" },
      next: { revalidate: filtered ? 60 : 3600, tags: ['shop', 'product', 'category'] },
    });

    if (!res.ok) return null;
    const data = await res.json();
    return isShopCatalogPayload(data) ? data : null;
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
        <Shopview initialData={initialData} initialDataQuery={buildShopQuery(resolvedSearchParams).toString()} />
      </Suspense>
    </>
  );
}
