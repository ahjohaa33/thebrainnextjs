"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import styles from "./CategoryPage.module.css";
import { sanitizeHtml } from "@/lib/sanitize";
import ProductBox from "../ProductBox";
import { getCategoryFaqItems } from "@/lib/schema";
import {
  viewItemList,
  outOfStockView,
  viewPromotion,
  selectPromotion,
} from "@/lib/analytics";

function formatPrice(value) {
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function getProductPrice(product) {
  return (
    product.price ??
    product.discount_price ??
    product.discount ??
    product.sale_price ??
    product.unit_price ??
    product.regular_price ??
    0
  );
}

function getOldPrice(product) {
  return (
    product.old_price ??
    product.regular_price ??
    product.unit_price ??
    product.price ??
    0
  );
}

function normalizeProductForBox(product = {}) {
  const price = Number(getProductPrice(product));
  const oldPrice = Number(getOldPrice(product));

  return {
    ...product,
    price,
    old_price: oldPrice > 0 ? oldPrice : price,
    features:
      product.features ||
      product.short_features ||
      product.shortFeatures ||
      [],
    url: product.url || (product.slug ? `/${product.slug}` : "#"),
    thumbnail:
      product.thumbnail ||
      product.thumbnail_img ||
      product.image ||
      "",
  };
}

function stripHtml(value = "") {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitDescription(html = "") {
  const cleanHtml = String(html || "").trim();
  if (!cleanHtml) return ["", ""];

  const chunks = cleanHtml
    .split(/<\/p>/i)
    .map((item) => item.trim())
    .filter((item) => item.replace(/<[^>]*>/g, "").trim() !== "")
    .map((item) => `${item}</p>`);

  if (chunks.length > 1) {
    const middle = Math.ceil(chunks.length / 2);
    return [chunks.slice(0, middle).join(""), chunks.slice(middle).join("")];
  }

  return [cleanHtml, ""];
}

function normalizeAttributeGroups(category) {
  const attributes = category?.attributes || {};
  const names = category?.attributeNames || category?.attribute_names || {};

  if (Array.isArray(attributes)) {
    return attributes.map((item) => ({
      key: String(item.key || item.slug || item.id || item.name),
      name: item.name || item.title || item.label || item.key,
      values: item.values || [],
    }));
  }

  return Object.entries(attributes).map(([key, values]) => ({
    key,
    name: names[key] || key,
    values: Array.isArray(values) ? values : [],
  }));
}

function normalizeFaqItems(items) {
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
      const question = stripHtml(q);
      const answer = stripHtml(a);

      if (!question || !answer) return null;

      return { q: question, a: answer };
    })
    .filter(Boolean);
}

function extractManualFaqItems(category) {
  const possibleSources = [
    category?.faqItems,
    category?.faq_items,
    category?.faqs,
    category?.faqs_json,
    category?.faq_json,
    category?.faq,
    category?.category_faq,
    category?.category_faqs,
    category?.meta_faq,
    category?.meta_faqs,
  ];

  for (const source of possibleSources) {
    const normalized = normalizeFaqItems(source);
    if (normalized.length > 0) return normalized;
  }

  return [];
}

function autoGenerateFaqItems(category) {
  const catName = String(category?.name || "Shop").trim() || "Shop";

  let rawText = stripHtml(category?.meta_description || "");
  if (!rawText) rawText = stripHtml(category?.description || "");

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

function getFinalFaqItems(category, isSearch) {
  if (isSearch) return [];

  const manualFaqItems = extractManualFaqItems(category);

  const sourceFaqItems =
    manualFaqItems.length > 0 ? manualFaqItems : autoGenerateFaqItems(category);

  const seen = new Set();
  const cleanItems = [];

  sourceFaqItems.forEach((item) => {
    const question = stripHtml(item.q || item.question || "");
    const answer = stripHtml(item.a || item.answer || "");

    if (!question || !answer) return;

    const key = question.toLowerCase();

    if (seen.has(key)) return;

    seen.add(key);
    cleanItems.push({ q: question, a: answer });
  });

  return cleanItems.slice(0, 8);
}

export default function CategoryPage({
  category = {},
  baseUrl = "",
  slug = "",
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  const products = category.products || {};
  const productItems = products.data || [];
  const brands = category.brands || [];
  const attributeGroups = normalizeAttributeGroups(category);

  const query = searchParams.get("query") || searchParams.get("q") || "";
  const isSearch = Boolean(query);

  const currentMinPrice = searchParams.get("minPrice") || "10";
  const currentMaxPrice = searchParams.get("maxPrice") || "700000";

  const currentAvailability =
    searchParams.get("availability") || searchParams.get("status") || "";

  const currentBrand =
    searchParams.get("brand_id") || searchParams.get("brand") || "";

  const currentLimit =
    searchParams.get("limit") || String(category.limit || products.per_page || 30);

  const currentSort = searchParams.get("sort") || category.sort || "low";

  const [priceForm, setPriceForm] = useState({
    minPrice: currentMinPrice,
    maxPrice: currentMaxPrice,
  });

  const descParts = useMemo(
    () => splitDescription(category.description || ""),
    [category.description]
  );

  const priceTableProducts =
    category.priceTableProducts ||
    category.price_table_products ||
    category.price_table ||
    [];

  const faqItems = useMemo(
    () => getCategoryFaqItems(category, { isSearch }),
    [category, isSearch]
  );

  const hasPriceTable =
    !isSearch &&
    Array.isArray(priceTableProducts) &&
    priceTableProducts.length > 0;

  useEffect(() => {
    if (productItems.length > 0) {
      viewItemList({
        listName: category.name || "Category",
        listId: category.slug || slug,
        products: productItems.map(normalizeProductForBox),
      });

      const oos = productItems
        .filter((p) => Number(p.current_stock ?? p.stock ?? 0) <= 0)
        .slice(0, 10);

      oos.forEach((p) => outOfStockView(normalizeProductForBox(p)));
    }

    if (category?.promotion?.id) {
      viewPromotion({
        promotionId: category.promotion.id,
        promotionName: category.promotion.name || category.name,
        creativeName: category.promotion.creative_name,
        creativeSlot: category.promotion.creative_slot || "category_hero",
      });
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category?.slug || slug]);

  function updateParams(updates = {}, resetPage = true) {
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(updates).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") {
        params.delete(key);
      } else {
        params.set(key, String(value));
      }
    });

    if (resetPage) params.delete("page");

    const queryString = params.toString();

    router.push(queryString ? `${pathname}?${queryString}` : pathname);
  }

  function submitPriceFilter(event) {
    event.preventDefault();

    updateParams({
      minPrice: priceForm.minPrice || "10",
      maxPrice: priceForm.maxPrice || "700000",
    });
  }

  function clearFilters() {
    const keep = new URLSearchParams();

    if (query) keep.set("query", query);

    router.push(keep.toString() ? `${pathname}?${keep.toString()}` : pathname);
  }

  function getPaginationUrl(pageNumber) {
    const params = new URLSearchParams(searchParams.toString());

    if (!pageNumber || pageNumber <= 1) {
      params.delete("page");
    } else {
      params.set("page", String(pageNumber));
    }

    const queryString = params.toString();

    return queryString ? `${pathname}?${queryString}` : pathname;
  }

  function handlePromoClick() {
    if (!category?.promotion?.id) return;

    selectPromotion({
      promotionId: category.promotion.id,
      promotionName: category.promotion.name || category.name,
      creativeName: category.promotion.creative_name,
      creativeSlot: category.promotion.creative_slot || "category_hero",
    });
  }

  const currentPage = Number(products.current_page || 1);
  const lastPage = Number(products.last_page || 1);

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <div className={styles.layout}>
          <aside
            className={`${styles.sidebar} ${
              mobileFilterOpen ? styles.sidebarOpen : ""
            }`}
          >
            <div className={styles.filterWrap}>
              <div className={styles.filterTop}>
                <h3>Filters</h3>

                <button
                  type="button"
                  className={styles.closeFilter}
                  onClick={() => setMobileFilterOpen(false)}
                  aria-label="Close filters"
                >
                  ×
                </button>
              </div>

              <form className={styles.filterGroup} onSubmit={submitPriceFilter}>
                <div className={styles.filterLabel}>Price Range</div>

                <div className={styles.rangeBox}>
                  <input
                    type="range"
                    min="0"
                    max="700000"
                    value={priceForm.minPrice}
                    onChange={(event) =>
                      setPriceForm((prev) => ({
                        ...prev,
                        minPrice: event.target.value,
                      }))
                    }
                    aria-label="Minimum price"
                  />

                  <input
                    type="range"
                    min="0"
                    max="700000"
                    value={priceForm.maxPrice}
                    onChange={(event) =>
                      setPriceForm((prev) => ({
                        ...prev,
                        maxPrice: event.target.value,
                      }))
                    }
                    aria-label="Maximum price"
                  />
                </div>

                <div className={styles.priceInputs}>
                  <input
                    type="number"
                    value={priceForm.minPrice}
                    onChange={(event) =>
                      setPriceForm((prev) => ({
                        ...prev,
                        minPrice: event.target.value,
                      }))
                    }
                    aria-label="Minimum price"
                  />

                  <input
                    type="number"
                    value={priceForm.maxPrice}
                    onChange={(event) =>
                      setPriceForm((prev) => ({
                        ...prev,
                        maxPrice: event.target.value,
                      }))
                    }
                    aria-label="Maximum price"
                  />
                </div>

                <button type="submit" className={styles.filterButton}>
                  Filter
                </button>
              </form>

              <div className={styles.filterGroup}>
                <div className={styles.filterLabel}>Availability</div>

                <label className={styles.filterOption}>
                  <input
                    type="radio"
                    name="availability"
                    checked={currentAvailability === "in_stock"}
                    onChange={() =>
                      updateParams({
                        availability: "in_stock",
                        status: "",
                      })
                    }
                  />
                  <span>In Stock</span>
                </label>

                <label className={styles.filterOption}>
                  <input
                    type="radio"
                    name="availability"
                    checked={currentAvailability === "out_stock"}
                    onChange={() =>
                      updateParams({
                        availability: "out_stock",
                        status: "",
                      })
                    }
                  />
                  <span>Out of Stock</span>
                </label>
              </div>

              {brands.length > 0 ? (
                <div className={styles.filterGroup}>
                  <div className={styles.filterLabel}>Brand</div>

                  {brands.map((brand) => (
                    <label className={styles.filterOption} key={brand.id}>
                      <input
                        type="radio"
                        name="brand_id"
                        value={brand.id}
                        checked={String(currentBrand) === String(brand.id)}
                        onChange={() =>
                          updateParams({
                            brand_id: brand.id,
                            brand: "",
                          })
                        }
                      />

                      <span>{brand.name}</span>
                    </label>
                  ))}
                </div>
              ) : null}

              {attributeGroups.map((attribute) => {
                const currentValue = searchParams.get(
                  `filters[${attribute.key}]`
                );

                return (
                  <div className={styles.filterGroup} key={attribute.key}>
                    <div className={styles.filterLabel}>{attribute.name}</div>

                    {attribute.values.map((value) => (
                      <label
                        className={styles.filterOption}
                        key={`${attribute.key}-${value}`}
                      >
                        <input
                          type="radio"
                          name={`filters[${attribute.key}]`}
                          value={value}
                          checked={String(currentValue) === String(value)}
                          onChange={() =>
                            updateParams({
                              [`filters[${attribute.key}]`]: value,
                            })
                          }
                        />

                        <span>{value}</span>
                      </label>
                    ))}
                  </div>
                );
              })}

              <button
                type="button"
                className={styles.clearButton}
                onClick={clearFilters}
              >
                Clear Filters
              </button>
            </div>
          </aside>

          <section className={styles.content} onClick={handlePromoClick}>
            <div className={styles.topCard}>
              <div>
                <nav className={styles.breadcrumb} aria-label="Breadcrumb">
                  <Link href="/">Home</Link>
                  <span aria-hidden="true">/</span>
                  <span>{isSearch ? "Search" : category.name || "Shop"}</span>
                </nav>

                <h1 className={styles.title}>
                  {isSearch
                    ? `Search Results for “${query}”`
                    : category.name || "Shop"}
                </h1>

                {category.updatedOn || category.updated_on ? (
                  <small className={styles.updated}>
                    Updated on: {category.updatedOn || category.updated_on}
                  </small>
                ) : null}

                <button
                  type="button"
                  className={styles.mobileFilterButton}
                  onClick={() => setMobileFilterOpen(true)}
                >
                  Filter
                </button>
              </div>

              <div className={styles.sortArea}>
                <label className={styles.selectWrap}>
                  <span>Show:</span>

                  <select
                    value={currentLimit}
                    onChange={(event) =>
                      updateParams({
                        limit: event.target.value,
                      })
                    }
                    aria-label="Items per page"
                  >
                    
                    <option value="30">30</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                  </select>
                </label>

                <label className={styles.selectWrap}>
                  <span>Sort by:</span>

                  <select
                    value={currentSort}
                    onChange={(event) =>
                      updateParams({
                        sort: event.target.value,
                      })
                    }
                    aria-label="Sort products"
                  >
                    <option value="popularity">Popularity</option>
                    <option value="latest">Latest</option>
                    <option value="oldest">Oldest</option>
                    <option value="low">Price Low to High</option>
                    <option value="high">Price High to Low</option>
                  </select>
                </label>
              </div>
            </div>

            <div className={styles.resultBar}>
              Showing {productItems.length} of {products.total || 0} products
            </div>

            {productItems.length > 0 ? (
              <div className={styles.grid}>
                {productItems.map((product, index) => (
                  <ProductBox
                    key={product.id || product.slug}
                    product={normalizeProductForBox(product)}
                    baseUrl={baseUrl}
                    listName={category.name || "Category"}
                    listId={category.slug || slug}
                    listIndex={index + 1}
                  />
                ))}
              </div>
            ) : (
              <div className={styles.empty}>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  style={{
                    verticalAlign: "-2px",
                    marginRight: 6,
                  }}
                >
                  <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>

                No Products Matched!
              </div>
            )}

            {lastPage > 1 ? (
              <nav className={styles.pagination} aria-label="Pagination">
                <Link
                  href={getPaginationUrl(currentPage - 1)}
                  className={`${styles.pageLink} ${
                    currentPage <= 1 ? styles.disabled : ""
                  }`}
                  rel={currentPage > 1 ? "prev" : undefined}
                >
                  Previous
                </Link>

                {Array.from({ length: lastPage }, (_, index) => index + 1)
                  .filter(
                    (page) =>
                      page === 1 ||
                      page === lastPage ||
                      Math.abs(page - currentPage) <= 1
                  )
                  .map((page, index, pages) => {
                    const previousPage = pages[index - 1];
                    const showDots = previousPage && page - previousPage > 1;

                    return (
                      <span key={page} className={styles.pageGroup}>
                        {showDots ? (
                          <span className={styles.dots}>...</span>
                        ) : null}

                        <Link
                          href={getPaginationUrl(page)}
                          className={`${styles.pageLink} ${
                            page === currentPage ? styles.activePage : ""
                          }`}
                          aria-current={page === currentPage ? "page" : undefined}
                        >
                          {page}
                        </Link>
                      </span>
                    );
                  })}

                <Link
                  href={getPaginationUrl(currentPage + 1)}
                  className={`${styles.pageLink} ${
                    currentPage >= lastPage ? styles.disabled : ""
                  }`}
                  rel={currentPage < lastPage ? "next" : undefined}
                >
                  Next
                </Link>
              </nav>
            ) : null}
          </section>
        </div>

        {!isSearch && (descParts[0] || descParts[1] || hasPriceTable) ? (
          <section className={styles.contentWrap}>
            {descParts[0] ? (
              <div
                dangerouslySetInnerHTML={{
                  __html: sanitizeHtml(descParts[0]),
                }}
              />
            ) : null}

            {hasPriceTable ? (
              <div className={styles.priceTableBox}>
                <div className={styles.priceTableHeader}>
                  <h2>{category.name || "Price"} Price Table (BD)</h2>
                  <small>Prices auto-update from product pages.</small>
                </div>

                <div className={styles.tableResponsive}>
                  <table className={styles.priceTable}>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Product</th>
                        <th>Price</th>
                        <th>Availability</th>
                        <th>Action</th>
                      </tr>
                    </thead>

                    <tbody>
                      {priceTableProducts.map((product, index) => {
                        const normalizedProduct =
                          normalizeProductForBox(product);

                        const productUrl = normalizedProduct.url || "#";
                        const price = getProductPrice(normalizedProduct);

                        const stock = Number(
                          normalizedProduct.current_stock ??
                            normalizedProduct.stock ??
                            0
                        );

                        const inStock = stock > 0;

                        const finalName =
                          normalizedProduct.pt_label_override ||
                          normalizedProduct.name ||
                          "Product";

                        return (
                          <tr key={normalizedProduct.id || index}>
                            <td>{index + 1}</td>

                            <td>
                              <Link href={productUrl}>{finalName}</Link>
                            </td>

                            <td className={styles.tablePrice}>
                              {formatPrice(price)}
                            </td>

                            <td>
                              <span
                                className={
                                  inStock
                                    ? styles.stockSuccess
                                    : styles.stockDanger
                                }
                              >
                                {inStock ? "In Stock" : "Out of Stock"}
                              </span>
                            </td>

                            <td>
                              <Link href={productUrl} className={styles.viewBtn}>
                                View
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <p className={styles.note}>
                  Note: Price & stock may change. Always confirm on the product
                  page before ordering.
                </p>
              </div>
            ) : null}

            {descParts[1] ? (
              <div
                dangerouslySetInnerHTML={{
                  __html: sanitizeHtml(descParts[1]),
                }}
              />
            ) : null}
          </section>
        ) : null}

        {!isSearch && faqItems.length > 0 ? (
          <section className={styles.faqWrap} aria-labelledby="faq-heading">
            <h2 id="faq-heading">Frequently Asked Questions</h2>

            <div className={styles.accordion}>
              {faqItems.map((item, index) => (
                <details
                  className={styles.accordionItem}
                  key={index}
                  open={index === 0}
                >
                  <summary className={styles.accordionButton}>
                    <span>{item.q}</span>
                    <strong
                      aria-hidden="true"
                      className={styles.accordionIcon}
                    >
                      +
                    </strong>
                  </summary>

                  <div className={styles.accordionBody}>{item.a}</div>
                </details>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}