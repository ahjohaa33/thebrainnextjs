import { Suspense } from "react";
import SiteHeader from "@/components/frontend/SiteHeader";
import Shopview from "./Shopview";
import { apiUrl } from "@/lib/config";
import { buildShopQuery } from "./shop-query.mjs";
import { buildMetadata, shouldNoindex } from "@/lib/seo";

// Shop inventory and brand filters must not be served from a five-minute cache.
export const dynamic = "force-dynamic";

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


// The first Laravel request must reflect the public /shop URL, including
// selected brands and price/search filters. Every navigation receives fresh
// server data, and ShopView applies only data for that exact URL.
async function getInitialShopData(searchParams = {}) {
  const params = buildShopQuery(searchParams);

  try {
    const res = await fetch(apiUrl(`/shop?${params.toString()}`), {
      headers: { Accept: "application/json" },
      cache: "no-store",
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
        <Shopview initialData={initialData} initialDataQuery={buildShopQuery(resolvedSearchParams).toString()} />
      </Suspense>
    </>
  );
}
