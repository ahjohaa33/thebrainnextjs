import { cache } from "react";
import { absoluteUrl, apiUrl } from "@/lib/config";
import { buildMetadata, stripMeta } from "@/lib/seo";

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeProduct(product = {}, index = 0) {
  return {
    id: product.id ?? `product-${index}`,
    name: product.name || "",
    slug: product.slug || "",
    thumbnail: absoluteUrl(
      product.thumbnail || product.thumbnail_img || product.image || "",
      product.thumbnail_updated_at || product.updated_at
    ),
    url:
      typeof product.url === "string" && product.url.trim() !== ""
        ? product.url.trim()
        : product.slug
        ? `/${String(product.slug).replace(/^\/+/, "")}`
        : "#",
    features: normalizeArray(product.features || product.short_features),
    price: product.price ?? product.discount_price ?? 0,
    old_price: product.old_price ?? product.regular_price ?? 0,
    discount_percentage: product.discount_percentage ?? 0,
  };
}

/**
 * Recursively walk the menu tree from the Laravel API and convert every
 * `icon` field into an absolute URL. The API returns paths like
 * `/uploads/menu-icons/tv.png` which, if rendered as-is in <img src=...>,
 * would resolve against the Next.js origin and 404. Categories already
 * get this treatment a few lines down; the menu was missing it, which
 * is why nav icons render broken.
 */
function normalizeMenu(items) {
  if (!Array.isArray(items)) return [];

  return items.map((item = {}) => ({
    ...item,
    icon: item?.icon ? absoluteUrl(item.icon) : "",
    children: normalizeMenu(item?.children),
  }));
}

function normalizeHeroSlide(item = {}, index = 0) {
  const price = Number(item?.price ?? 0);

  return {
    id: item?.id ?? `hero-slide-${index}`,
    sort_order: Number(item?.sort_order ?? index),
    image: absoluteUrl(item?.image || item?.image_path || ""),
    name: stripMeta(item?.name, 160) || "Featured product",
    model: stripMeta(item?.model || item?.sku, 120) || "The Brain Cap",
    sku: stripMeta(item?.sku, 120),
    price: Number.isFinite(price) ? price : 0,
    price_formatted:
      typeof item?.price_formatted === "string" && item.price_formatted.trim()
        ? item.price_formatted.trim()
        : `৳ ${Number.isFinite(price) ? price.toLocaleString("en-BD") : "0"}`,
    product_id: item?.product_id ?? null,
    product_slug: item?.product_slug || "",
    url: normalizeCategoryLink(
      item?.url || (item?.product_slug ? `/${item.product_slug}` : "/shop")
    ),
  };
}

function normalizeCategoryLink(link = "") {
  if (!link) return "#";

  const value = String(link).trim();

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  if (
    value.startsWith("#") ||
    value.startsWith("mailto:") ||
    value.startsWith("tel:")
  ) {
    return value;
  }

  return value.startsWith("/") ? value : `/${value}`;
}

export function normalizeHomePayload(data = {}) {
  const siteName = data?.site?.site_name || "Ponnobd";

  return {
    meta: {
      title: stripMeta(data?.meta?.title, 70) || "Home",
      description: stripMeta(data?.meta?.description, 160),
      keywords: stripMeta(data?.meta?.keywords, 250),
      image: absoluteUrl(data?.meta?.image || ""),
    },
    site: {
      header_logo: absoluteUrl(data?.site?.header_logo || data?.site?.logo || ""),
      site_name: siteName,
      cart_count: data?.site?.cart_count || 0,
      menu: normalizeMenu(data?.site?.menu),
      wishlist_url: data?.site?.wishlist_url || "/wishlist",
      cart_url: data?.site?.cart_url || "/cart",
      account_url: data?.site?.account_url || "/customer/dashboard",
      search_action: data?.site?.search_action || "/shop",
    },
    hero_slides: normalizeArray(data?.hero_slides)
      .map((item, index) => normalizeHeroSlide(item, index))
      .filter((item) => item.image)
      .sort((a, b) => a.sort_order - b.sort_order),
    galleries: normalizeArray(data?.galleries).map((item, index) => ({
      image: absoluteUrl(item?.image || item?.src || ""),
      link: item?.link ? item.link : null,
      alt:
        stripMeta(item?.alt || item?.title || item?.caption, 120) ||
        deriveAltFromLink(item?.link, siteName, index),
    })),
    categories: normalizeArray(data?.categories).map((item) => ({
      title: stripMeta(item?.title, 100) || "",
      link: normalizeCategoryLink(item?.link),
      icon: absoluteUrl(item?.icon || item?.image || ""),
    })),
    sections: normalizeArray(data?.sections).map((section, sectionIndex) => ({
      id: section?.id ?? `section-${sectionIndex}`,
      name: section?.name || "",
      short_description: stripMeta(section?.short_description, 200),
      products: normalizeArray(section?.products).map((product, productIndex) =>
        normalizeProduct(product, productIndex)
      ),
    })),
    // Passed through as-is (raw shape from the Laravel API: id, title,
    // video_id, embed_url, watch_url, thumbnail, type, order, ...).
    // page.jsx's normalizeVideos() is what maps this into the shape the
    // carousel components expect, so no field-shaping happens here.
    video_sections: normalizeArray(data?.video_sections),
    footer_content: data?.footer_content || "",
  };
}

function deriveAltFromLink(link, siteName, index) {
  if (!link) return `${siteName} featured banner ${index + 1}`;
  const path = String(link).replace(/^https?:\/\/[^/]+/, "");
  const slug = path.split("?")[0].split("#")[0].replace(/^\/+|\/+$/g, "");
  if (!slug) return `${siteName} featured banner ${index + 1}`;
  const words = slug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return `${words} — ${siteName}`;
}

/**
 * Fetch the home payload from the Laravel API.
 *
 * Caching policy:
 *   - next: { revalidate: 600, tags: ["home", "site-header"] }
 *     → Next.js Data Cache stores the response for up to 10 minutes.
 *     On-demand revalidation via revalidateTag("home") or
 *     revalidateTag("site-header") from /api/revalidate lets CMS
 *     updates surface immediately without waiting for the TTL.
 *   - React `cache()` wrapper → de-duplicates calls within a SINGLE
 *     request only. This is in-memory per-request memoization, not a
 *     cross-request cache. It exists so `page.jsx` and `SiteHeader`
 *     (rendered on the same page tree) don't both make the network
 *     call independently.
 */
export const getHomePageData = cache(async function getHomePageData() {
  try {
    const response = await fetch(apiUrl("/home"), {
      headers: { Accept: "application/json" },
      next: { revalidate: 600, tags: ["home", "site-header"] },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch home data: ${response.status}`);
    }

    const json = await response.json();
    return normalizeHomePayload(json);
  } catch (error) {
    console.error("getHomePageData failed:", error?.message || error);
    return normalizeHomePayload({
      meta: { title: "Home", description: "", keywords: "", image: "" },
      site: {},
      hero_slides: [],
      galleries: [],
      categories: [],
      sections: [],
      video_sections: [],
      footer_content: "",
    });
  }
});

export async function generateHomeMetadata() {
  const home = await getHomePageData();

  return buildMetadata({
    title: home.meta.title || "Home",
    description: home.meta.description,
    keywords: home.meta.keywords,
    image: home.meta.image,
    path: "/",
  });
}