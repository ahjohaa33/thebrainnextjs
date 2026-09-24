import { Suspense } from "react";
import SiteHeader from "@/components/frontend/SiteHeader";
import Shopview from "./Shopview";
import { apiUrl } from "@/lib/config";

// Server component wrapper.
//
// SiteHeader is an async Server Component (it awaits getHomePageData()),
// so the page that renders it must itself be a Server Component.
// All the interactive shop logic lives in ShopView (a client component).
//
// ShopView uses useSearchParams() which must be wrapped in <Suspense> when
// rendered from a Server Component, otherwise Next.js will bail out of
// static rendering for the whole page and log a warning.
//
// Initial products are fetched server-side and passed as props so the
// page arrives with content already rendered — no client-side loading
// spinner on first paint.
async function getInitialShopData() {
  try {
    const res = await fetch(apiUrl("/shop?page=1&limit=12&sort=low"), {
      headers: { Accept: "application/json" },
      next: { revalidate: 300, tags: ["shop"] },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default async function ShopPage() {
  const initialData = await getInitialShopData();

  return (
    <>
      <SiteHeader />
      <Suspense fallback={null}>
        <Shopview initialData={initialData} />
      </Suspense>
    </>
  );
}