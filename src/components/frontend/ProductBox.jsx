// components/frontend/ProductBox.jsx
//
// SERVER COMPONENT — the card markup (image, name, features, price,
// microdata) is plain HTML emitted by the server.
//
// Only the "Add to Cart" button needs client-side state (loading/added
// toggle, cart context), so it lives in its own small client component:
// AddToCartButton.
//
// Why this matters: on the homepage we render 20-40 product cards. The
// old ProductBox was "use client", so each card contributed to the
// client bundle and the React tree. Now only ~1KB of button JS ships
// per page instead of the whole card component.

import Link from "next/link";
import styles from "./ProductBox.module.css";
import AddToCartButton from "./AddToCartButton";
import { withCacheBust } from "@/lib/image-cache-bust";

function formatBDT(value) {
  const number = Number(value || 0);
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 0,
  }).format(number);
}

function absoluteUrl(path = "", baseUrl = "", version) {
  if (!path) return "";
  const resolved = /^https?:\/\//i.test(path)
    ? path
    : `${String(baseUrl).replace(/\/$/, "")}/${String(path).replace(/^\/+/, "")}`;
  // Cache-bust so a replaced product image (same filename, new bytes)
  // never gets stuck behind a stale browser/CDN cache. See
  // lib/image-cache-bust.js for the full explanation.
  return withCacheBust(resolved, version);
}

/**
 * Decode HTML entities in plain-text strings coming from the CMS.
 *
 * Product feature strings are authored in a rich-text editor and stored
 * with HTML entities (e.g. "Driver&rsquo;s" instead of "Driver's"). When
 * we render them with `{feature}` in JSX, React treats the value as
 * text — not HTML — so the literal `&rsquo;` shows up in the browser.
 *
 * This helper resolves the common named entities and any numeric
 * entities (&#39;, &#x27;) to their actual characters. It does NOT
 * parse arbitrary HTML, so the output stays safe to render as text.  
 *
 * Runs server-side (this is a server component) — no DOMParser available,
 * which is why we use a small explicit map instead of a browser API.
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

function decodeEntities(input) {
  if (typeof input !== "string" || input.indexOf("&") === -1) return input;

  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, body) => {
    if (body[0] === "#") {
      const code =
        body[1] === "x" || body[1] === "X"
          ? parseInt(body.slice(2), 16)
          : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    const named = NAMED_ENTITIES[body.toLowerCase()];
    return named !== undefined ? named : match;
  });
}

export default function ProductBox({
  product = {},
  baseUrl = "",
  listName,
  listId,
  listIndex,
}) {
  const price = Number(product.price ?? product.discount_price ?? 0);
  const oldPrice = Number(product.old_price ?? product.regular_price ?? price);

  const features = Array.isArray(product.features)
    ? product.features.filter(Boolean).map(decodeEntities)
    : [];

  const productUrl = product.url || (product.slug ? `/${product.slug}` : "#");
  const thumbnail = absoluteUrl(
    product.thumbnail || product.thumbnail_img || product.image || "",
    baseUrl,
    product.thumbnail_updated_at || product.updated_at
  );

  return (
    <div
      className={styles.card}
      itemScope
      itemType="https://schema.org/Product"
      data-list-index={listIndex || undefined}
    >
      <Link href={productUrl}>
        <img
          className={styles.image}
          src={thumbnail}
          alt={product.name || "Product"}
          itemProp="image"
          loading="lazy"
          decoding="async"
        />
      </Link>

      <div className={styles.contentWrap}>
        <Link href={productUrl} className={styles.titleLink}>
          <h3 className={styles.title} itemProp="name">
            {product.name}
          </h3>
        </Link>

        {features.length > 0 ? (
          <ul className={styles.featureList}>
            {features.map((feature, index) => (
              <li key={`${product.id || product.slug || "product"}-${index}`}>
                {feature}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div
        className={styles.priceWrap}
        itemProp="offers"
        itemScope
        itemType="https://schema.org/Offer"
      >
        <meta itemProp="priceCurrency" content="BDT" />
        <meta itemProp="price" content={String(price.toFixed(2))} />
        <link
          itemProp="availability"
          href={
            Number(product.current_stock ?? product.stock ?? 1) > 0
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock"
          }
        />

        {oldPrice > price ? (
          <>
            <span className={styles.price}>{formatBDT(price)}</span>
            <span className={styles.oldPrice}>{formatBDT(oldPrice)}</span>
          </>
        ) : (
          <span className={styles.price}>{formatBDT(price)}</span>
        )}
      </div>

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