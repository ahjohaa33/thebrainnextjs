/**
 * Schema.org JSON-LD builders.
 *
 * Each builder returns a plain object ready to be passed to <JsonLd />.
 * Builders never throw — they return null/undefined when there isn't
 * enough data to emit a valid schema, so callers can safely do:
 *
 *   <JsonLd data={buildProductSchema(product)} />
 *
 * without null-checking everywhere.
 *
 * REFERENCES:
 *   - Product:        https://developers.google.com/search/docs/appearance/structured-data/product
 *   - BreadcrumbList: https://developers.google.com/search/docs/appearance/structured-data/breadcrumb
 *   - ItemList:       https://developers.google.com/search/docs/appearance/structured-data/carousel
 *   - FAQPage:        https://developers.google.com/search/docs/appearance/structured-data/faqpage
 *   - Organization:   https://developers.google.com/search/docs/appearance/structured-data/logo
 */

import { stripMeta, siteUrl, SITE_URL, SITE_NAME } from "./seo";

const truthy = (v) => v !== undefined && v !== null && v !== "";

/* ─────────── Organization (emit once, in root layout) ─────────── */

export function buildOrganizationSchema({ logo, sameAs = [] } = {}) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: logo || `${SITE_URL}/favicon.ico`,
    sameAs: Array.isArray(sameAs) ? sameAs.filter(Boolean) : [],
  };
}

/* ─────────── LocalBusiness / ElectronicsStore ─────────── */

export function buildElectronicsStoreSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "ElectronicsStore",
    "@id": `${SITE_URL}/#electronics-store`,
    name: SITE_NAME,
    alternateName: ["Ponnobd", "PonnoBD Electronics", "Ponnobd Electronics Dhaka"],
    url: SITE_URL,
    logo: `${SITE_URL}/favicon.ico`,
    image: `${SITE_URL}/favicon.ico`,
    description:
      "Ponnobd Electronics is an electronics shop in Bangladesh offering LED TVs, Smart TVs, ACs, home appliances, kitchen appliances, smartboards and electronics products with delivery support across Bangladesh.",
    telephone: "+8801856-111313",
    priceRange: "BDT",
    currenciesAccepted: "BDT",
    paymentAccepted: [
      "Cash on Delivery",
      "Cash",
      "Bank Transfer",
      "Mobile Banking",
      "EMI"
    ],
    areaServed: {
      "@type": "Country",
      name: "Bangladesh"
    },
    address: {
      "@type": "PostalAddress",
      streetAddress: "Ponnobd Electronics, 48, Shewrapara (1st floor), Mirpur, Dhaka-1216",
      addressLocality: "Dhaka",
      addressRegion: "Dhaka",
      postalCode: "1216",
      addressCountry: "BD"
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: "23.795665",
      longitude: "90.372991"
    },
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: [
          "Saturday",
          "Sunday",
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday"
        ],
        opens: "10:00",
        closes: "21:00"
      }
    ],
    sameAs: [
      "https://www.facebook.com/ponnobdelectronics",
      "https://www.youtube.com/channel/UCQMdvHwn3rh11Q3ITYdjb-Q"
    ],
    makesOffer: [
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Product",
          name: "LED TV"
        }
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Product",
          name: "Smart TV"
        }
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Product",
          name: "Air Conditioner"
        }
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Product",
          name: "Home Appliances"
        }
      }
    ]
  };
}

/* ─────────── BreadcrumbList ─────────── */

/**
 * @param {{name: string, url?: string}[]} crumbs
 *   Pass crumbs in display order. The last crumb is usually the current page
 *   and may omit `url`.
 */
export function buildBreadcrumbSchema(crumbs = []) {
  const items = crumbs
    .filter((c) => c && c.name)
    .map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: stripMeta(c.name, 100),
      ...(c.url ? { item: siteUrl(c.url) } : {}),
    }));

  if (items.length === 0) return null;

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items,
  };
}

/* ─────────── Product (single product page) ─────────── */

const AVAILABILITY = {
  in_stock: "https://schema.org/InStock",
  out_of_stock: "https://schema.org/OutOfStock",
  preorder: "https://schema.org/PreOrder",
};

function pickPrice(product) {
  // Prefer discount_price if it differs from regular_price; otherwise either.
  const discount = Number(product.discount_price ?? product.price ?? 0);
  const regular = Number(product.regular_price ?? product.old_price ?? 0);
  if (discount > 0 && regular > 0 && discount < regular) return discount;
  return discount > 0 ? discount : regular;
}

export function buildProductSchema(product = {}) {
  if (!product || !product.name) return null;

  const price = pickPrice(product);
  if (!price) return null;

  const stock = Number(product.current_stock ?? product.stock ?? 0);
  const availability = stock > 0 ? AVAILABILITY.in_stock : AVAILABILITY.out_of_stock;

  const url = product.canonical_url || product.url || (product.slug ? siteUrl(`/${product.slug}`) : undefined);

  const images = []
    .concat(product.thumbnail || [])
    .concat(Array.isArray(product.gallery) ? product.gallery : [])
    .filter(truthy);

  const reviews = Array.isArray(product.reviews) ? product.reviews : [];
  const ratingCount = reviews.length;
  const ratingValue =
    ratingCount > 0
      ? (
          reviews.reduce((sum, r) => sum + Number(r.rating || 0), 0) / ratingCount
        ).toFixed(1)
      : null;

  const schema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: stripMeta(product.name, 200),
    description:
      stripMeta(product.meta_description, 5000) ||
      stripMeta(product.short_description, 5000) ||
      stripMeta(product.description, 5000) ||
      undefined,
    sku: product.sku || product.code || product.id ? String(product.sku || product.code || product.id) : undefined,
    brand: product.brand?.name
      ? { "@type": "Brand", name: product.brand.name }
      : undefined,
    image: images.length > 0 ? images : undefined,
    url,
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "BDT",
      price: Number(price).toFixed(2),
      availability,
      itemCondition: "https://schema.org/NewCondition",
      // Google requires either priceValidUntil OR shippingDetails+returnPolicy
      // for full eligibility. We provide a 30-day rolling validity, which is
      // safe even when Laravel doesn't send a real expiry.
      priceValidUntil: new Date(Date.now() + 30 * 86400 * 1000)
        .toISOString()
        .split("T")[0],
    },
  };

  if (ratingValue && ratingCount > 0) {
    schema.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue,
      reviewCount: ratingCount,
    };
  }

  return schema;
}

/* ─────────── ItemList (used on category & home product grids) ─────────── */

/* ─────────── ItemList (used on category & home product grids) ─────────── */

function getProductUrl(product = {}, fallbackPathname = "/") {
  if (product.url && typeof product.url === "string") {
    return product.url.startsWith("http")
      ? product.url
      : siteUrl(product.url);
  }

  if (product.slug) {
    return siteUrl(`/${String(product.slug).replace(/^\/+/, "")}`);
  }

  return siteUrl(fallbackPathname);
}

function getProductImage(product = {}) {
  const image =
    product.thumbnail ||
    product.thumbnail_img ||
    product.thumbnail_url ||
    product.image ||
    product.featured_image ||
    "";

  if (!image) return undefined;

  return String(image).startsWith("http") ? image : siteUrl(image);
}

function getListProductPrice(product = {}) {
  return (
    product.price ??
    product.discount_price ??
    product.sale_price ??
    product.unit_price ??
    product.regular_price ??
    product.old_price ??
    null
  );
}

export function buildItemListSchema({ name, products = [], pathname = "/" }) {
  const itemListElement = products
    .filter((p) => p && (p.name || p.title))
    .slice(0, 30)
    .map((p, i) => {
      const productName = stripMeta(p.name || p.title, 200);
      const productUrl = getProductUrl(p, pathname);
      const productImage = getProductImage(p);
      const price = getListProductPrice(p);

      const productItem = {
        "@type": "Product",
        name: productName,
        url: productUrl,
        ...(productImage ? { image: productImage } : {}),
        ...(p.brand?.name
          ? {
              brand: {
                "@type": "Brand",
                name: stripMeta(p.brand.name, 100),
              },
            }
          : {}),
        ...(price && Number(price) > 0
          ? {
              offers: {
                "@type": "Offer",
                url: productUrl,
                priceCurrency: "BDT",
                price: Number(price).toFixed(2),
                availability:
                  Number(p.current_stock ?? p.stock ?? 1) > 0
                    ? "https://schema.org/InStock"
                    : "https://schema.org/OutOfStock",
                itemCondition: "https://schema.org/NewCondition",
              },
            }
          : {}),
      };

      return {
        "@type": "ListItem",
        position: i + 1,
        item: productItem,
      };
    });

  if (itemListElement.length === 0) return null;

  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: stripMeta(name || "Products", 200),
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    numberOfItems: itemListElement.length,
    itemListElement,
  };
}

/* ─────────── FAQPage ─────────── */

/* ─────────── FAQ helpers ─────────── */

function stripHtmlForFaq(value = "") {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeFaqItems(items) {
  let rawItems = items;
  if (!rawItems) return [];

  if (typeof rawItems === "string") {
    try {
      rawItems = JSON.parse(rawItems);
    } catch {
      const lines = rawItems.split(/\r\n|\r|\n/);
      const output = [];
      let currentQuestion = null;

      lines.forEach((line) => {
        const cleanLine = line.trim();
        if (!cleanLine) return;

        const questionMatch = cleanLine.match(/^(q|question)\s*[:\-]\s*(.+)$/i);
        const answerMatch = cleanLine.match(/^(a|answer)\s*[:\-]\s*(.+)$/i);

        if (questionMatch) {
          currentQuestion = questionMatch[2]?.trim();
          return;
        }

        if (answerMatch && currentQuestion) {
          const answer = answerMatch[2]?.trim();
          if (answer) output.push({ q: currentQuestion, a: answer });
          currentQuestion = null;
        }
      });

      return output;
    }
  }

  if (!Array.isArray(rawItems)) return [];

  return rawItems
    .map((item) => {
      if (!item || typeof item === "string") return null;

      const q = item.q ?? item.question ?? item.title ?? item.name ?? "";
      const a = item.a ?? item.answer ?? item.description ?? item.text ?? "";

      const question = stripHtmlForFaq(q);
      const answer = stripHtmlForFaq(a);

      if (!question || !answer) return null;

      return { q: question, a: answer };
    })
    .filter(Boolean);
}

function extractManualFaqItems(source = {}) {
  const possibleSources = [
    source?.faqItems,
    source?.faq_items,
    source?.faqs,
    source?.faqs_json,
    source?.faq_json,
    source?.faq,
    source?.category_faq,
    source?.category_faqs,
    source?.meta_faq,
    source?.meta_faqs,
  ];

  for (const item of possibleSources) {
    const normalized = normalizeFaqItems(item);
    if (normalized.length > 0) return normalized;
  }

  return [];
}

function autoGenerateCategoryFaqItems(category = {}) {
  const catName = String(category?.name || "Shop").trim() || "Shop";

  let rawText = stripHtmlForFaq(category?.meta_description || "");
  if (!rawText) rawText = stripHtmlForFaq(category?.description || "");

  const featurePool = [];

  const patterns = [
    { rx: /\b(4k|uhd)\b/i, label: "4K/UHD" },
    { rx: /\b(full\s*hd|fhd)\b/i, label: "Full HD" },
    { rx: /\b(hdr10\+?|hdr)\b/i, label: "HDR" },
    { rx: /\b(android\s*tv)\b/i, label: "Android TV" },
    { rx: /\bgoogle\s*tv\b/i, label: "Google TV" },
    { rx: /\bsmart\s*tv\b/i, label: "Smart TV" },
    { rx: /\b(wifi|wi-fi)\b/i, label: "Wi-Fi" },
    { rx: /\bbluetooth\b/i, label: "Bluetooth" },
    { rx: /\b(ips|va)\b/i, label: "Panel type" },
    { rx: /\b(led|oled|qled|mini\s*led)\b/i, label: "Display type" },
    { rx: /\b(\d{2}\s*inch|\d{2}")\b/i, label: "Screen size" },
    { rx: /\b(energy\s*saving|inverter)\b/i, label: "Energy saving" },
    { rx: /\b(warranty)\b/i, label: "Warranty" },
    { rx: /\b(delivery)\b/i, label: "Delivery" },
  ];

  patterns.forEach((item) => {
    if (item.rx.test(rawText)) featurePool.push(item.label);
  });

  const uniqueFeatures = [...new Set(featurePool)].slice(0, 5);

  const featureLine =
    uniqueFeatures.length > 0
      ? `Common features you may find here include ${uniqueFeatures.join(", ")}.`
      : "";

  return [
    {
      q: `Are the ${catName} prices updated?`,
      a: "Prices can change over time. This page shows the latest available updates on the site. For the most accurate current price, open the product page before ordering.",
    },
    {
      q: `How do I choose the right ${catName}?`,
      a: `Use filters like brand, price range, and key specifications to compare multiple products. ${featureLine}`.trim(),
    },
    {
      q: `Do ${catName} products come with warranty?`,
      a: "Warranty terms depend on the product and brand. Please check the individual product page for warranty and service details.",
    },
    {
      q: "Is delivery available across Bangladesh?",
      a: "Delivery availability can vary by location and product. You can confirm delivery options during checkout or by contacting support.",
    },
    {
      q: "What if a product is out of stock?",
      a: "If a product is out of stock, you can browse similar alternatives on this page or check again later as stock updates may change.",
    },
  ];
}

export function getCategoryFaqItems(category = {}, { isSearch = false } = {}) {
  if (isSearch) return [];

  const manualFaqItems = extractManualFaqItems(category);
  const sourceFaqItems =
    manualFaqItems.length > 0 ? manualFaqItems : autoGenerateCategoryFaqItems(category);

  const seen = new Set();
  const cleanItems = [];

  sourceFaqItems.forEach((item) => {
    const question = stripHtmlForFaq(item.q || item.question || "");
    const answer = stripHtmlForFaq(item.a || item.answer || "");

    if (!question || !answer) return;

    const key = question.toLowerCase();
    if (seen.has(key)) return;

    seen.add(key);
    cleanItems.push({ q: question, a: answer });
  });

  return cleanItems.slice(0, 8);
}

export function buildFaqSchema(items = []) {
  const mainEntity = items
    .filter((it) => it && it.q && it.a)
    .map((it) => ({
      "@type": "Question",
      name: stripMeta(it.q, 300),
      acceptedAnswer: {
        "@type": "Answer",
        text: stripMeta(it.a, 5000),
      },
    }));

  if (mainEntity.length === 0) return null;

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity,
  };
}

/* ─────────── WebSite (sitelinks search box) ─────────── */

export function buildWebsiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_URL}/shop?query={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

/* ─────────── BlogPosting (single blog post page) ─────────── */

export function buildArticleSchema(post = {}, { path = "/" } = {}) {
  if (!post || !post.title) return null;

  const image =
    post.og_image || post.thumbnail_url || post.thumbnail || "";

  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": siteUrl(path),
    mainEntityOfPage: siteUrl(path),
    headline: stripMeta(post.title, 110),
    description: stripMeta(
      post.meta_description || post.excerpt || post.description,
      300
    ),
    ...(image ? { image: [siteUrl(image)] } : {}),
    datePublished: post.published_at || post.created_at || undefined,
    dateModified: post.updated_at || post.published_at || post.created_at || undefined,
    author: {
      "@type": "Organization",
      name: post.author_name || SITE_NAME,
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/favicon.ico`,
      },
    },
  };
}
