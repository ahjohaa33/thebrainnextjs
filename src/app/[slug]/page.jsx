import { cache } from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { apiUrl, LARAVEL_BASE_URL } from "@/lib/config";
import SiteHeader from "@/components/frontend/SiteHeader";
import ProductPage from "@/components/frontend/slug/ProductPage";
import CategoryPage from "@/components/frontend/slug/CategoryPage";
import JsonLd from "@/components/seo/JsonLd";
import { buildMetadata, shouldNoindex } from "@/lib/seo";
import {
  buildBreadcrumbSchema,
  buildProductSchema,
  buildItemListSchema,
  buildFaqSchema,
  getCategoryFaqItems,
} from "@/lib/schema";

// Cache product/category pages for 5 minutes; on-demand revalidation
// via revalidateTag("product") or revalidateTag("category") surfaces
// CMS changes immediately without waiting for the TTL.
export const revalidate = 300;

/**
 * Derive the public site URL from the incoming request's Host header.
 *
 * This is what makes domain moves zero-config: when the app runs on
 * developer.ponnobd.com today the response carries that host; when you
 * cut over to ponnobd.com later, the same code emits the new host with
 * no env change. Falls back to `null` if the header is absent (e.g.
 * during static generation), letting buildMetadata use its env default.
 */
async function getSiteUrlFromRequest() {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") || h.get("host");
    if (!host) return null;
    const proto =
      h.get("x-forwarded-proto") ||
      (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
    return `${proto}://${host}`;
  } catch {
    return null;
  }
}

function normalizeSearchParams(input) {
  if (!input || typeof input !== "object") return {};
  const output = {};
  Object.entries(input).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      if (value.length > 0) output[key] = String(value[0]);
      return;
    }
    if (typeof value === "string") output[key] = value;
  });
  return output;
}

function buildQueryString(searchParams = {}) {
  const params = new URLSearchParams();
  Object.entries(searchParams).forEach(([key, value]) => {
    if (typeof value === "string" && value.trim() !== "") params.set(key, value);
  });
  const query = params.toString();
  return query ? `?${query}` : "";
}

// React `cache()` here is per-request memoization only — it lets
// generateMetadata and the page body share one fetch within the same
// request without double-fetching. It does NOT persist across requests.
const getSlugData = cache(async function getSlugData(slug, searchParamsKey = "") {
  let parsedSearchParams = {};
  try {
    parsedSearchParams = searchParamsKey ? JSON.parse(searchParamsKey) : {};
  } catch {
    parsedSearchParams = {};
  }

  const qs = buildQueryString(parsedSearchParams);
  const url = apiUrl(`/product-or-category/${encodeURIComponent(slug)}${qs}`);

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 300, tags: ["product", "category", `slug:${slug}`] },
  });

  if (res.status === 404) return null;
  if (!res.ok) return { type: "error", status: res.status };
  return await res.json();
});

function stableKey(value) {
  return JSON.stringify(value || {});
}

export async function generateMetadata(props) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const slug = params?.slug;
  const currentSearchParams = normalizeSearchParams(searchParams);
  if (!slug) return {};

  const detectedSiteUrl = await getSiteUrlFromRequest();

  const data = await getSlugData(slug, stableKey(currentSearchParams));
  if (!data || data.redirect_to || data.type === "error") {
    return buildMetadata({
      path: `/${slug}`,
      noindex: true,
      siteUrl: detectedSiteUrl,
    });
  }

  const isProduct = data.type === "product";
  const subject = isProduct ? data.product : data.category;
  const path = `/${slug}`;

  const title =
    data.seo?.title || subject?.meta_title || subject?.name || "";

  const description =
    data.seo?.description ||
    subject?.meta_description ||
    subject?.short_description ||
    subject?.description ||
    "";

  const image =
    subject?.og_image ||
    subject?.thumbnail ||
    subject?.thumbnail_url ||
    "";

  const noindex = shouldNoindex({ pathname: path, searchParams: currentSearchParams });

  return buildMetadata({
    title,
    description,
    keywords: subject?.meta_keywords,
    image,
    path,
    searchParams: currentSearchParams,
    noindex,
    type: "website",
    siteUrl: detectedSiteUrl,
  });
}

export default async function SlugPage(props) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const slug = params?.slug;
  const currentSearchParams = normalizeSearchParams(searchParams);

  if (!slug) {
    return (
      <>
        <SiteHeader />
        <main style={{ padding: "40px 20px" }}>
          <h1>Page not found</h1>
        </main>
      </>
    );
  }

  const data = await getSlugData(slug, stableKey(currentSearchParams));

  if (!data) {
    return (
      <>
        <SiteHeader />
        <main style={{ padding: "40px 20px" }}>
          <h1>Page not found</h1>
          <p>No product or category matched this slug.</p>
        </main>
      </>
    );
  }

  if (data.type === "error") {
    return (
      <>
        <SiteHeader />
        <main style={{ padding: "40px 20px" }}>
          <h1>Something went wrong</h1>
          <p>Failed to load this page. Status: {data.status}</p>
        </main>
      </>
    );
  }

  if (data.redirect_to) redirect(data.redirect_to);

  const jsonLd = [];


  if (data.type === "product" && data.product) {
    const product = data.product;

    const crumbs = [{ name: "Home", url: "/" }];
    if (product.categories?.[0]) {
      crumbs.push({
        name: product.categories[0].name,
        url: `/${product.categories[0].slug}`,
      });
    }
    crumbs.push({ name: product.name });
    jsonLd.push(buildBreadcrumbSchema(crumbs));
    jsonLd.push(buildProductSchema(product));
  } else if (data.type === "category" && data.category) {
    const category = data.category;

    jsonLd.push(
      buildBreadcrumbSchema([
        { name: "Home", url: "/" },
        { name: category.name },
      ])
    );

    const productItems = category.products?.data || [];
    jsonLd.push(
      buildItemListSchema({
        name: category.name,
        products: productItems,
        pathname: `/${slug}`,
      })
    );

    const isSearchPage = Boolean(
      currentSearchParams.query ||
        currentSearchParams.q ||
        currentSearchParams.minPrice ||
        currentSearchParams.maxPrice ||
        currentSearchParams.brand ||
        currentSearchParams.brand_id ||
        currentSearchParams.sort ||
        currentSearchParams.availability ||
        currentSearchParams.status
    );

    const faqItems = getCategoryFaqItems(category, {
      isSearch: isSearchPage,
    });

    if (faqItems.length > 0) {
      jsonLd.push(buildFaqSchema(faqItems));
    }
  }

  return (
    <>
      <SiteHeader />

      {data.type === "product" && data.product ? (
       
  
        <ProductPage product={data.product} baseUrl={LARAVEL_BASE_URL} />
      ) : data.type === "category" && data.category ? (
        <CategoryPage
          category={data.category}
          baseUrl={LARAVEL_BASE_URL}
          slug={slug}
        />
      ) : (
        <main style={{ padding: "40px 20px" }}>
          <h1>Page not found</h1>
        </main>
      )}

      <JsonLd id="ld-page" data={jsonLd.filter(Boolean)} />
    </>
  );
}
