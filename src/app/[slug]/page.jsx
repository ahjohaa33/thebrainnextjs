import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { apiUrl, LARAVEL_BASE_URL } from "@/lib/config";
import { laravelFetch } from "@/lib/laravel";
import { getHomePageData } from "@/lib/home-data";
import SiteHeader from "@/components/frontend/SiteHeader";
import ProductPage from "@/components/frontend/slug/ProductPage";
import CategoryPage from "@/components/frontend/slug/CategoryPage";
import JsonLd from "@/components/seo/JsonLd";
import { buildMetadata, shouldNoindex, SITE_URL } from "@/lib/seo";
import {
  buildCategoryGlobalShopQuery,
  hasGlobalProductFilters,
  isShopCatalogPayload,
} from "@/app/shop/shop-query.mjs";
import {
  buildBreadcrumbSchema,
  buildProductSchema,
  buildItemListSchema,
  buildFaqSchema,
  getCategoryFaqItems,
} from "@/lib/schema";

// Cache unfiltered product/category data for one hour; filtered data for one minute.
// Laravel CMS should call /api/revalidate on product or category changes.
export const revalidate = 3600;

export async function generateStaticParams() {
  try {
    const [shop, home] = await Promise.all([
      laravelFetch(apiUrl('/shop?limit=48'), {
        headers: { Accept: 'application/json' },
        next: { revalidate: 3600, tags: ['shop', 'product'] },
      }).then((r) => r.ok ? r.json() : null).catch(() => null),
      getHomePageData().catch(() => null),
    ]);
    const slugs = new Set();
    for (const product of shop?.products?.data || []) {
      if (typeof product?.slug === 'string' && product.slug) slugs.add(product.slug);
    }
    for (const category of shop?.categories || []) {
      if (typeof category?.slug === 'string' && category.slug) slugs.add(category.slug);
    }
    // A home category may expose a /category-link rather than a raw slug.
    for (const item of home?.categories || []) {
      const slug = String(item?.link || '').replace(/^\/+|\/+$/g, '');
      if (slug && !slug.includes('/') && !slug.includes('?') && !slug.includes('#')) slugs.add(slug);
    }
    return [...slugs].filter((slug) => /^[a-z0-9][a-z0-9_-]*$/i.test(slug))
      .slice(0, 90).map((slug) => ({ slug }));
  } catch (error) {
    console.warn('[slug] Pre-render seed unavailable:', error?.message);
    return [];
  }
}

function normalizeSearchParams(input) {
  if (!input || typeof input !== "object") return {};
  const output = {};
  Object.entries(input).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      const items = value.filter((item) => typeof item === "string" && item.trim() !== "");
      if (items.length > 0) output[key] = items;
      return;
    }
    if (typeof value === "string") output[key] = value;
  });
  return output;
}

function buildQueryString(searchParams = {}) {
  const params = new URLSearchParams();
  Object.entries(searchParams).forEach(([key, value]) => {
    // Next.js represents repeated URL parameters as arrays. Laravel accepts
    // specification brands as brand[]=... or brands[]=..., not an arbitrary
    // last-wins scalar value. Preserve every brand on the request.
    const values = Array.isArray(value) ? value : [value];
    const parameter = Array.isArray(value) && values.length > 1 &&
      (key === "brand" || key === "brands") ? `${key}[]` : key;
    values.forEach((item) => {
      if (typeof item === "string" && item.trim() !== "") {
        params.append(parameter, item);
      }
    });
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
  const globalProductFilters = hasGlobalProductFilters(parsedSearchParams);

  // The slug resolver provides category identity, metadata and brand facets.
  // When a product filter is active, fetch that context without its original
  // category-scoped filters, then fetch the actual result grid from /shop.
  // Product-detail slugs always retain their existing resolver behavior.
  const contextQuery = globalProductFilters ? "" : qs;
  const url = apiUrl(`/product-or-category/${encodeURIComponent(slug)}${contextQuery}`);

  // Filtered listing URLs need fresh data. Unfiltered product/category URLs
  // retain the existing five-minute cache and revalidation tags.
  const isFiltered = qs !== "";
  try {
    const res = await laravelFetch(url, {
      headers: { Accept: 'application/json' },
      next: { revalidate: isFiltered ? 60 : 3600,
        tags: ['product', 'category', `slug:${slug.toLowerCase()}`] },
    });

    if (res.status === 404) return null;
    if (!res.ok) return { type: "error", status: res.status };
    const data = await res.json();
    if (!data || typeof data !== "object" ||
        (data.type === "category" && !Array.isArray(data.category?.products?.data))) {
      return { type: "error", status: "invalid catalog response" };
    }

    if (data.type !== "category" || !globalProductFilters) return data;

    const shopQuery = buildCategoryGlobalShopQuery(parsedSearchParams).toString();
    const shopResponse = await laravelFetch(apiUrl(`/shop?${shopQuery}`), {
      headers: { Accept: 'application/json' },
      next: { revalidate: 60, tags: ['shop', 'product', 'category'] },
    });
    if (!shopResponse.ok) return { type: "error", status: shopResponse.status };

    const shopData = await shopResponse.json();
    if (!isShopCatalogPayload(shopData)) {
      return { type: "error", status: "invalid shop catalog response" };
    }

    return {
      ...data,
      globalCatalog: true,
      category: {
        ...data.category,
        products: shopData.products,
        // The category price table previously mirrored the paginated product
        // grid; keep it in sync when the grid is replaced with global results.
        priceTableProducts: shopData.products.data,
      },
    };
  } catch {
    return { type: "error", status: "unavailable" };
  }
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

  const detectedSiteUrl = SITE_URL;

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

  if (!slug) notFound();

  const data = await getSlugData(slug, stableKey(currentSearchParams));

  if (!data) notFound();

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

  // A once-valid pagination link can become out of range after inventory
  // changes. There are still matching products; show page 1, not an empty grid.
  if (data.type === "category" && data.category?.products &&
      Number(data.category.products.total) > 0 &&
      Array.isArray(data.category.products.data) &&
      data.category.products.data.length === 0 &&
      Number(data.category.products.current_page) > Number(data.category.products.last_page) &&
      Number(data.category.products.current_page) > 1) {
    const correctedParams = { ...currentSearchParams };
    delete correctedParams.page;
    redirect(`/${encodeURIComponent(slug)}${buildQueryString(correctedParams)}`);
  }

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

    // Do not describe storewide filtered products as members of this category.
    if (!data.globalCatalog) {
      const productItems = category.products?.data || [];
      jsonLd.push(
        buildItemListSchema({
          name: category.name,
          products: productItems,
          pathname: `/${slug}`,
        })
      );
    }

    const isSearchPage = Boolean(
      currentSearchParams.query ||
        currentSearchParams.q ||
        currentSearchParams.minPrice ||
        currentSearchParams.maxPrice ||
        currentSearchParams.brand ||
        currentSearchParams.brand_id ||
        currentSearchParams.brands ||
        currentSearchParams["brands[]"] ||
        currentSearchParams["brand[]"] ||
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
          globalCatalog={Boolean(data.globalCatalog)}
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
