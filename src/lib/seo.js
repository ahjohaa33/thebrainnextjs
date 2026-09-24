/**
 * Centralised SEO helpers.
 *
 * Why this file exists:
 *   - We were emitting meta descriptions that still contained raw HTML tags
 *     ("<p>...</p>") because the CMS stores rich-text. Google truncates and
 *     surfaces this as garbage in SERPs.
 *   - Canonical URLs were missing entirely, so pages with query strings
 *     (?sort=, ?page=, ?brand_id=) duplicated themselves in the index.
 *   - <meta name="robots"> was implicit. We now make it explicit so cart /
 *     checkout / order-success / search-results pages can opt out of
 *     indexing without any guesswork on Google's side.
 *
 * All Next.js `generateMetadata` functions in the app should import from here
 * instead of hand-rolling these objects, so behaviour stays consistent.
 */

const FALLBACK_SITE_URL = "https://thebrainbd.com";

/**
 * Public site URL — used as the base for canonical + OG URLs.
 *
 * This is the BUILD-TIME default. At request time we prefer the actual
 * `Host` header (see resolveSiteUrl below) so the system keeps working if
 * you move the app to a new domain (or run dev on developer.ponnobd.com
 * and prod on ponnobd.com) without touching env vars.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.SITE_URL ||
  FALLBACK_SITE_URL
).replace(/\/+$/, "");

/**
 * Pick the right base URL for an outgoing response.
 *
 *   1. Caller-provided override (typically the live `Host` header read
 *      inside generateMetadata) — most accurate.
 *   2. NEXT_PUBLIC_SITE_URL / SITE_URL env var — fallback for tooling
 *      that runs without a request (sitemap generation, build-time RSC).
 *   3. Hard-coded FALLBACK_SITE_URL — last resort.
 *
 * Always returns a value with no trailing slash.
 */
export function resolveSiteUrl(override) {
  const value =
    (typeof override === "string" && override.trim()) || SITE_URL;
  return value.replace(/\/+$/, "");
}

export const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "TheBrainbd Lifestyle";

/**
 * Strip HTML tags + decode the handful of entities our CMS emits, then
 * collapse whitespace and clamp to ~160 chars (Google's snippet width).
 *
 * NOTE: This is deliberately not a full HTML parser — we don't want to pull
 * in `dompurify` or `html-entities` just for meta tags. The CMS only emits
 * a tiny subset of entities, listed below.
 */
export function stripMeta(value, maxLength = 160) {
  if (!value) return "";

  const text = String(value)
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&hellip;/g, "…")
    .replace(/\s+/g, " ")
    .trim();

  if (text.length <= maxLength) return text;

  // Clip at the last word boundary so we don't end mid-word.
  const clipped = text.slice(0, maxLength);
  const lastSpace = clipped.lastIndexOf(" ");
  return `${clipped.slice(0, lastSpace > 60 ? lastSpace : maxLength)}…`;
}

/**
 * Build an absolute URL given a path. Used for canonical + og:url +
 * `<link rel="alternate">` so paths from the CMS that come back as
 * "/product/foo" or "product/foo" are both handled.
 *
 * Pass `base` to override the default SITE_URL with a per-request value
 * (e.g. one derived from the live Host header).
 */
export function siteUrl(path = "/", base) {
  const root = resolveSiteUrl(base);
  if (!path) return root;
  if (/^https?:\/\//i.test(path)) return path;
  return `${root}/${String(path).replace(/^\/+/, "")}`;
}

/**
 * Pages whose canonical should drop query strings (filters, pagination,
 * tracking params). Anything not in this list keeps the path as-is.
 *
 *   - Listing/category pages: ?sort, ?page, ?brand_id, etc → canonical is the
 *     bare path. We *do* keep ?page=2+ on listing pages though, so deep pages
 *     are still indexable as separate pages.
 *   - Search results (?query / ?q): we noindex these instead (handled below).
 */
const PRESERVE_PAGE_PARAM_PATHS = [/.*/]; // applies to all listing-ish paths

export function canonicalFor(pathname, searchParams = {}, base) {
  const path = pathname || "/";

  const sp =
    searchParams && typeof searchParams === "object" ? searchParams : {};
  const page = sp.page || sp.p || "";

  // Preserve only ?page=N (N>1) — drop everything else.
  if (page && Number(page) > 1) {
    return siteUrl(`${path}${path.includes("?") ? "&" : "?"}page=${page}`, base);
  }
  return siteUrl(path, base);
}

/**
 * The exhaustive list of type strings that Next.js (and the OG protocol)
 * accepts for openGraph.type. Anything outside this set causes Next.js to
 * throw "Invalid OpenGraph type: <value>" at build / request time.
 *
 * Source: https://ogp.me/#types + Next.js metadata validation.
 */
const VALID_OG_TYPES = new Set([
  "website",
  "article",
  "book",
  "profile",
  "music.song",
  "music.album",
  "music.playlist",
  "music.radio_station",
  "video.movie",
  "video.episode",
  "video.tv_show",
  "video.other",
]);

/**
 * Build a Next.js Metadata object with sensible defaults.
 *
 * Anything truthy you pass in overrides the defaults. The defaults are:
 *   - title:        SITE_NAME
 *   - description:  empty (skip the tag rather than emit a useless one)
 *   - canonical:    SITE_URL + path
 *   - robots:       index, follow  (override per-page for cart/checkout)
 *   - og + twitter: derived from title/description/image
 *
 * IMPORTANT: title and description are run through stripMeta() so the CMS
 * can store rich HTML safely without leaking tags into <meta>.
 *
 * NOTE: `type` is validated against the OG protocol spec. Unrecognised values
 * (e.g. "product") are silently coerced to "website" so callers never cause
 * a Next.js "Invalid OpenGraph type" error regardless of what the CMS sends.
 */
export function buildMetadata({
  title,
  description,
  path = "/",
  searchParams,
  image,
  type = "website",
  noindex = false,
  keywords,
  siteUrl: siteUrlOverride,
} = {}) {
  const cleanTitle = stripMeta(title, 70) || SITE_NAME;
  const cleanDescription = stripMeta(description, 160);
  const baseUrl = resolveSiteUrl(siteUrlOverride);
  const canonical = canonicalFor(path, searchParams, baseUrl);

  // Make the image URL absolute (Facebook ignores relative URLs) and emit
  // both `url` and `secureUrl`. We deliberately DO NOT declare width/height
  // because the CMS uploads vary in size and a wrong declaration causes
  // Facebook to silently drop the image. Facebook will read the real
  // dimensions when it fetches the file.
  const absImage = image
    ? (/^https?:\/\//i.test(image) ? image : siteUrl(image, baseUrl))
    : "";

  const ogImages = absImage
    ? [
        {
          url: absImage,
          secureUrl: absImage,
          alt: cleanTitle,
        },
      ]
    : [];

  // Guard: coerce any unrecognised OG type to "website" so Next.js never
  // throws "Invalid OpenGraph type: <value>".
  const ogType = VALID_OG_TYPES.has(type) ? type : "website";

  return {
    title: cleanTitle,
    description: cleanDescription || undefined,
    keywords: keywords ? stripMeta(keywords, 250) : undefined,
    metadataBase: new URL(baseUrl),
    alternates: {
      canonical,
    },
    robots: noindex
      ? {
          index: false,
          follow: false,
          googleBot: { index: false, follow: false },
        }
      : {
          index: true,
          follow: true,
          googleBot: { index: true, follow: true, "max-image-preview": "large" },
        },
    openGraph: {
      type: ogType,
      url: canonical,
      siteName: SITE_NAME,
      title: cleanTitle,
      description: cleanDescription || undefined,
      images: ogImages,
      locale: "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title: cleanTitle,
      description: cleanDescription || undefined,
      images: absImage ? [absImage] : [],
    },
  };
}

/**
 * Convenience: returns whether a given pathname/searchParams combo should be
 * deindexed. Used by the [slug] route to flip noindex on search-results.
 */
export function shouldNoindex({ pathname, searchParams } = {}) {
  const sp = searchParams || {};
  if (sp.query || sp.q) return true;          // internal search
  if (sp.utm_source || sp.utm_campaign) return true;
  if (pathname && /^\/(cart|checkout|order-success)(\/|$)/.test(pathname))
    return true;
  return false;
}