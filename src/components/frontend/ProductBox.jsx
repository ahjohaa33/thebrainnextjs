// components/frontend/ProductBox.jsx
//
// SERVER COMPONENT
//
// Product card markup is rendered on the server.
// Only AddToCartButton requires client-side state.

import Link from "next/link";
import styles from "./ProductBox.module.css";
import AddToCartButton from "./AddToCartButton";
import { withCacheBust } from "@/lib/image-cache-bust";

/**
 * Convert a value to a safe number.
 */
function toNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}

/**
 * Format a number as Bangladeshi Taka.
 */
function formatBDT(value) {
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 0,
  }).format(toNumber(value));
}

/**
 * Build an absolute image URL.
 *
 * If the API already returns an absolute URL, use it directly.
 * Otherwise prepend baseUrl.
 */
function absoluteUrl(path = "", baseUrl = "", version) {
  if (!path) {
    return "";
  }

  const resolved = /^https?:\/\//i.test(path)
    ? path
    : `${String(baseUrl).replace(/\/$/, "")}/${String(path).replace(
        /^\/+/,
        ""
      )}`;

  return withCacheBust(resolved, version);
}

/**
 * Common HTML entities that may come from CMS content.
 */
const NAMED_ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\u00a0",
  rsquo: "\u2019",
  lsquo: "\u2018",
  rdquo: "\u201d",
  ldquo: "\u201c",
  ndash: "\u2013",
  mdash: "\u2014",
  hellip: "\u2026",
  trade: "\u2122",
  reg: "\u00ae",
  copy: "\u00a9",
  deg: "\u00b0",
  middot: "\u00b7",
  bull: "\u2022",
  times: "\u00d7",
};

/**
 * Decode common HTML entities from API strings.
 */
function decodeEntities(input) {
  if (typeof input !== "string" || !input.includes("&")) {
    return input;
  }

  return input.replace(
    /&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g,
    (match, body) => {
      if (body[0] === "#") {
        const code =
          body[1] === "x" || body[1] === "X"
            ? parseInt(body.slice(2), 16)
            : parseInt(body.slice(1), 10);

        return Number.isFinite(code)
          ? String.fromCodePoint(code)
          : match;
      }

      const named = NAMED_ENTITIES[body.toLowerCase()];

      return named !== undefined ? named : match;
    }
  );
}

export default function ProductBox({
  product = {},
  baseUrl = "",
  listName,
  listId,
  listIndex,
}) {
  /*
   * ============================================================
   * PRICE
   * ============================================================
   *
   * Clean API contract:
   *
   * price       = normal product price
   * old_price   = optional historical price
   * offer_price = discounted selling price
   *
   * Product card behavior:
   *
   * If offer_price is a valid discount:
   *   offer_price = red
   *   price       = muted + struck through
   *
   * Otherwise:
   *   price       = normal price
   */

  const regularPrice = toNumber(product.price);
  const offerPrice = toNumber(product.offer_price);

  const hasOffer =
    regularPrice > 0 &&
    offerPrice > 0 &&
    offerPrice < regularPrice;

  const sellingPrice = hasOffer
    ? offerPrice
    : regularPrice;

  /*
   * ============================================================
   * STOCK
   * ============================================================
   */

  const stockQuantity = toNumber(
    product.current_stock ?? product.stock ?? 0
  );

  const isInStock =
    product.stock_status
      ? product.stock_status === "in_stock" &&
        stockQuantity > 0
      : stockQuantity > 0;

  /*
   * ============================================================
   * FEATURES
   * ============================================================
   */

  const features = Array.isArray(product.features)
    ? product.features
        .filter(Boolean)
        .map(decodeEntities)
    : [];

  /*
   * ============================================================
   * PRODUCT URL
   * ============================================================
   */

  const productUrl =
    product.url ||
    (product.slug
      ? `/${product.slug}`
      : "#");

  /*
   * ============================================================
   * IMAGE
   * ============================================================
   */

  const thumbnail = absoluteUrl(
    product.thumbnail ||
      product.thumbnail_url ||
      product.image ||
      product.webp ||
      "",
    baseUrl,
    product.thumbnail_updated_at ||
      product.updated_at
  );

  /*
   * ============================================================
   * TEXT
   * ============================================================
   */

  const productName =
    decodeEntities(product.name) ||
    "Product";

  const altText =
    decodeEntities(product.alt) ||
    productName;

  return (
    <div
      className={styles.card}
      itemScope
      itemType="https://schema.org/Product"
      data-list-index={listIndex ?? undefined}
    >
      {/* Product image */}
      <Link
        href={productUrl}
        className={styles.thumbWrap}
      >
        <img
          className={styles.image}
          src={thumbnail}
          alt={altText}
          itemProp="image"
          loading="lazy"
          decoding="async"
        />
      </Link>

      {/* Product content */}
      <div className={styles.contentWrap}>
        <Link
          href={productUrl}
          className={styles.titleLink}
          itemProp="url"
        >
          <h3
            className={styles.title}
            itemProp="name"
          >
            {productName}
          </h3>
        </Link>

        {features.length > 0 && (
          <ul className={styles.featureList}>
            {features.map(
              (feature, index) => (
                <li
                  key={`${
                    product.id ||
                    product.slug ||
                    "product"
                  }-${index}`}
                >
                  {feature}
                </li>
              )
            )}
          </ul>
        )}
      </div>

      {/* Product price */}
      <div
        className={styles.priceWrap}
        itemProp="offers"
        itemScope
        itemType="https://schema.org/Offer"
      >
        <meta
          itemProp="priceCurrency"
          content="BDT"
        />

        <meta
          itemProp="price"
          content={sellingPrice.toFixed(2)}
        />

        <link
          itemProp="availability"
          href={
            isInStock
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock"
          }
        />

        {hasOffer ? (
          <>
            {/* Current discounted selling price */}
            <span
              className={styles.offerPrice}
              style={{
                color: "#dc2626",
                fontWeight: 700,
              }}
            >
              {formatBDT(offerPrice)}
            </span>

            {/* Regular price - native strike-through */}
            <del
              className={styles.oldPrice}
              style={{
                color: "#9ca3af",
                fontSize: "14px",
                fontWeight: 500,
                textDecoration: "line-through",
                textDecorationThickness: "1.5px",
                textDecorationColor: "#9ca3af",
                opacity: 0.9,
              }}
            >
              {formatBDT(regularPrice)}
            </del>
          </>
        ) : (
          <span className={styles.price}>
            {formatBDT(regularPrice)}
          </span>
        )}
      </div>

      {/* Add to cart */}
      <div className={styles.btnWrap}>
        <AddToCartButton
          product={product}
          listName={listName}
          listId={listId}
        />
      </div>
    </div>
  );
}