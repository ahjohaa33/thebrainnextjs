"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import styles from "./ProductPage.module.css";
import { sanitizeHtml } from "@/lib/sanitize";
import { withCacheBust } from "@/lib/image-cache-bust";
import { useRouter } from "next/navigation";
import { useCart } from "@/context/CartContext";
import {
  viewItem,
  addToCart as trackAddToCart,
  submitReview as trackSubmitReview,
  outOfStockView,
  viewSizeChart,
  videoEngagement,
} from "@/lib/analytics";
import {
  SALES_WHATSAPP_E164,
  SALES_WHATSAPP_DIGITS,
  buildWhatsAppUrl,
} from "@/lib/config";

function formatPrice(value) {
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatRelatedPrice(value) {
  const amount = Number(value || 0);

  return `৳${new Intl.NumberFormat("en-BD", {
    maximumFractionDigits: 0,
  }).format(amount)}`;
}

function getRelatedImage(product) {
  const raw =
    product?.thumbnail ||
    product?.image ||
    product?.featured_image ||
    product?.gallery?.[0] ||
    "";

  return raw ? withCacheBust(raw, product?.thumbnail_updated_at || product?.updated_at) : "";
}

function getRelatedHref(product) {
  const slug = product?.slug ? String(product.slug).replace(/^\/+/, "") : "";

  if (!slug) return "#";

  return `/${slug}`;
}

function normalizeHtml(value) {
  // Sanitise here so every consumer (shortDescription, description,
  // supportDescription, productVideo) is XSS-safe before it ever reaches
  // dangerouslySetInnerHTML. (VULN-002 / CWE-79)
  return sanitizeHtml(typeof value === "string" ? value : "");
}

function getAllImages(product) {
  const version = product?.thumbnail_updated_at || product?.updated_at;
  const gallery = Array.isArray(product?.gallery) ? product.gallery.filter(Boolean) : [];
  const thumbnail = product?.thumbnail ? [product.thumbnail] : [];
  const merged = [...thumbnail, ...gallery];
  return [...new Set(merged)].filter(Boolean).map((url) => withCacheBust(url, version));
}

function renderStars(rating) {
  const n = Math.max(0, Math.min(5, Number(rating) || 0));
  return "★".repeat(n) + "☆".repeat(5 - n);
}

function getProductBrand(product) {
  return (
    product?.brand?.name ||
    product?.brand_name ||
    product?.brand ||
    "Pentanik"
  );
}

function getProductCategory(product) {
  return (
    product?.categories?.[0]?.name ||
    product?.category?.name ||
    product?.category_name ||
    "N/A"
  );
}

function getProductWarranty(product) {
  return (
    product?.warranty ||
    product?.warranty_text ||
    product?.warranty_period ||
    product?.guarantee ||
    "N/A"
  );
}

function getProductSummaryPrice(product) {
  return (
    product?.discount_price ||
    product?.sale_price ||
    product?.regular_price ||
    product?.price ||
    0
  );
}

function FacebookIcon(props) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <path
        fill="currentColor"
        d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.84c0-2.52 1.49-3.91 3.77-3.91 1.09 0 2.23.2 2.23.2v2.47h-1.26c-1.24 0-1.63.78-1.63 1.57v1.89h2.78l-.44 2.91h-2.34V22C18.34 21.24 22 17.08 22 12.06Z"
      />
    </svg>
  );
}

function WhatsAppIcon(props) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <path
        fill="currentColor"
        d="M20.52 3.48A11.79 11.79 0 0 0 12.15 0C5.62 0 .31 5.31.31 11.84c0 2.09.55 4.13 1.59 5.93L.21 24l6.38-1.67a11.83 11.83 0 0 0 5.56 1.42h.01c6.53 0 11.84-5.31 11.84-11.84 0-3.16-1.23-6.14-3.48-8.43ZM12.16 21.75h-.01a9.82 9.82 0 0 1-5.01-1.37l-.36-.22-3.79.99 1.01-3.69-.24-.38a9.83 9.83 0 0 1-1.5-5.24C2.26 6.41 6.72 2 12.15 2a9.8 9.8 0 0 1 6.98 2.9 9.79 9.79 0 0 1 2.9 7.01c0 5.43-4.42 9.84-9.87 9.84Zm5.4-7.37c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.46-.88-.78-1.47-1.75-1.65-2.04-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35Z"
      />
    </svg>
  );
}

function LinkIcon(props) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <path
        fill="currentColor"
        d="M10.59 13.41a1 1 0 0 1 0-1.41l2.83-2.83a3 3 0 1 1 4.24 4.24l-2.12 2.12a3 3 0 0 1-4.24 0 1 1 0 1 1 1.41-1.41 1 1 0 0 0 1.41 0l2.12-2.12a1 1 0 0 0-1.41-1.41L12 13.41a1 1 0 0 1-1.41 0Zm2.82-2.82a1 1 0 0 1 0 1.41l-2.83 2.83a3 3 0 1 1-4.24-4.24l2.12-2.12a3 3 0 0 1 4.24 0 1 1 0 1 1-1.41 1.41 1 1 0 0 0-1.41 0L7.76 12a1 1 0 0 0 1.41 1.41L12 10.59a1 1 0 0 1 1.41 0Z"
      />
    </svg>
  );
}

function getBrowserShareUrl(fallbackUrl = "") {
  if (typeof window !== "undefined" && window.location?.href) {
    return window.location.href;
  }

  return fallbackUrl;
}

function openShareWindow(url) {
  if (typeof window === "undefined") return;

  window.open(
    url,
    "product-share",
    "noopener,noreferrer,width=720,height=620,top=80,left=120"
  );
}

async function copyShareLink(url) {
  if (!url || typeof window === "undefined") return false;

  if (navigator?.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(url);
    return true;
  }

  const textarea = document.createElement("textarea");
  textarea.value = url;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "-9999px";
  textarea.style.opacity = "0";

  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);

  return copied;
}

export default function ProductPage({ product = {}, baseUrl = "" }) {
  const images = useMemo(() => getAllImages(product), [product]);
  const [activeImage, setActiveImage] = useState(images[0] || "");
 

  const [zoomStyle, setZoomStyle] = useState({
    backgroundImage: "",
    backgroundPosition: "center",
    opacity: 0,
  });

  const [addToCartLoading, setAddToCartLoading] = useState(false);
  const [orderNowLoading, setOrderNowLoading] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [copyLabel, setCopyLabel] = useState("Copy Link");

  const [reviewForm, setReviewForm] = useState({
    guest_name: "",
    rating: 5,
    comment: "",
  });

  const router = useRouter();
  const { addToCart } = useCart();

  const fallbackShareUrl = useMemo(() => {
    if (!product?.slug) return "";

    // We deliberately read window.location.origin instead of a baked-in
    // env var. This means: (a) the share URL always matches the host the
    // user is actually visiting, and (b) moving the app to a new domain
    // requires zero code or env changes. The server-side `og:url` meta
    // tag is set separately in `generateMetadata` from the request's
    // Host header, so social scrapers see the correct URL too.
    const origin =
      typeof window !== "undefined" && window.location?.origin
        ? window.location.origin
        : "";

    const slug = String(product.slug).replace(/^\/+/, "");
    return origin ? `${origin}/${slug}` : `/${slug}`;
  }, [product?.slug]);

  const encodedShareUrl = encodeURIComponent(shareUrl || fallbackShareUrl);
  const facebookShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedShareUrl}`;
  // "Share on WhatsApp" sends the product link straight to our sales rep so
  // shoppers can ask questions, confirm stock, or place an order in one tap —
  // instead of opening WhatsApp's generic contact picker.
  const whatsAppShareUrl = buildWhatsAppUrl(
    `Hi, I'm interested in this product: ${product?.name || "this product"} ${
      shareUrl || fallbackShareUrl
    }`
  );

  useEffect(() => {
    setShareUrl(getBrowserShareUrl(fallbackShareUrl));
  }, [fallbackShareUrl]);

  useEffect(() => {
    if (!product?.id) return;
    viewItem(product, product.categories?.[0]?.name);
    const stock = Number(product.current_stock || 0);
    if (stock <= 0) outOfStockView(product);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);



  async function handleAddToCart() {
    if (addToCartLoading || orderNowLoading) return;

    try {
      setAddToCartLoading(true);
      await addToCart(product.id, 1);
      trackAddToCart(product, 1);
    } catch (error) {
      alert(error.message || "Unable to add product to cart.");
    } finally {
      setAddToCartLoading(false);
    }
  }

  async function handleOrderNow() {
    if (addToCartLoading || orderNowLoading) return;

    try {
      setOrderNowLoading(true);
      await addToCart(product.id, 1);
      trackAddToCart(product, 1);
      router.push("/cart");
    } catch (error) {
      alert(error.message || "Unable to add product to cart.");
      setOrderNowLoading(false);
    }
  }

  function handleZoomMove(e) {
    if (!activeImage) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setZoomStyle({
      backgroundImage: `url(${activeImage})`,
      backgroundPosition: `${x}% ${y}%`,
      opacity: 1,
    });
  }

  function handleZoomLeave() {
    setZoomStyle((prev) => ({ ...prev, opacity: 0 }));
  }

  function handleSizeChartClick() {
    viewSizeChart(product?.id);
  }

  function handleFacebookShare() {
    const currentUrl = getBrowserShareUrl(fallbackShareUrl);
    setShareUrl(currentUrl);

    openShareWindow(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(currentUrl)}`
    );
  }

  function handleWhatsAppShare() {
    const currentUrl = getBrowserShareUrl(fallbackShareUrl);
    setShareUrl(currentUrl);

    openShareWindow(
      buildWhatsAppUrl(
        `Hi, I'm interested in this product: ${
          product?.name || "this product"
        } ${currentUrl}`
      )
    );
  }

  async function handleCopyShareLink() {
    const currentUrl = getBrowserShareUrl(fallbackShareUrl);
    setShareUrl(currentUrl);

    try {
      const copied = await copyShareLink(currentUrl);
      setCopyLabel(copied ? "Copied!" : "Copy Link");

      window.setTimeout(() => {
        setCopyLabel("Copy Link");
      }, 1600);
    } catch {
      setCopyLabel("Copy Link");
      alert("Unable to copy the product link. Please copy it from the address bar.");
    }
  }



  const shortDescription = normalizeHtml(product.short_description);





  const relatedProducts = Array.isArray(product.related_products)
    ? [...product.related_products]
        .sort((a, b) => Number(b.id || 0) - Number(a.id || 0))
        .slice(0, 4)
    : [];

  const quantity = Number(product.current_stock || 0);

  const summaryImage = activeImage || images[0] || "";
  const summaryBrand = getProductBrand(product);
  const summaryCategory = getProductCategory(product);
  const summaryWarranty = getProductWarranty(product);
  const summaryPrice = getProductSummaryPrice(product);
  const orderPhone = SALES_WHATSAPP_E164;

  const whatsAppOrderUrl = `https://wa.me/${SALES_WHATSAPP_DIGITS}?text=${encodeURIComponent(
    `Hello, I want to order: ${product?.name || "this product"} ${
      shareUrl || fallbackShareUrl
    }`
  )}`;

  return (
    <>
      <main className={styles.page}>
        <div className={styles.container}>
          <nav className={styles.breadcrumb} aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span aria-hidden="true">/</span>

            {product.categories?.[0] ? (
              <>
                <Link href={`/${product.categories[0].slug}`}>
                  {product.categories[0].name}
                </Link>
                <span aria-hidden="true">/</span>
              </>
            ) : null}

            <span>{product.name}</span>
          </nav>

        
<section className={styles.topSection}>
  <div className={styles.galleryArea}>
    <div className={styles.galleryLayout}>
      <div className={styles.thumbColumn}>
        {images.map((image, index) => (
          <button
            key={`${image}-${index}`}
            type="button"
            className={`${styles.thumbBtn} ${
              activeImage === image ? styles.thumbBtnActive : ""
            }`}
            onClick={() => setActiveImage(image)}
            aria-label={`View image ${index + 1}`}
          >
            <img
              src={image}
              alt={`${product.alt || product.name} view ${index + 1}`}
              className={styles.thumbImage}
              loading="lazy"
            />
          </button>
        ))}
      </div>

      <div className={styles.mainImageCol}>
        <div
          className={styles.mainImageWrap}
          onMouseMove={handleZoomMove}
          onMouseLeave={handleZoomLeave}
        >
          <img
            src={activeImage || images[0]}
            alt={product.alt || product.name}
            className={styles.mainImage}
            fetchPriority="high"
            decoding="async"
          />

          <div className={styles.zoomLens} style={zoomStyle} />
        </div>
      </div>
    </div>
  </div>

  <div className={styles.infoArea}>
    <div className={styles.titleWrap}>
      <h1 className={styles.title}>{product.name}</h1>
    </div>

    {shortDescription ? (
      <div
        className={styles.shortDescription}
        dangerouslySetInnerHTML={{ __html: shortDescription }}
      />
    ) : null}

    <div className={styles.supportNumber}>
      <p>
        <strong>Details :</strong>{" "}
        <a
          href={`tel:${SALES_WHATSAPP_E164}`}
          onClick={() =>
            import("@/lib/analytics").then((m) =>
              m.phoneCallClick({
                phone: SALES_WHATSAPP_E164,
                location: "product_detail",
              })
            )
          }
        >
          {SALES_WHATSAPP_E164}
        </a>
      </p>
    </div>

    <div className={styles.statusRow}>
      <div className={styles.priceBlock}>
        <p>
          Price:{" "}
          {Number(product.regular_price) !==
          Number(product.discount_price) ? (
            <>
              <span className={styles.discountPrice}>
                {formatPrice(product.discount_price)}
              </span>

              <span className={styles.oldPrice}>
                {formatPrice(product.regular_price)}
              </span>
            </>
          ) : (
            <span className={styles.discountPrice}>
              {formatPrice(product.discount_price)}
            </span>
          )}
        </p>
      </div>

      <div className={styles.stockBlock}>
        <p>
          Status:{" "}
          <span
            className={quantity > 0 ? styles.inStock : styles.outStock}
          >
            {quantity > 0 ? "In Stock" : "Out Of Stock"}
          </span>
        </p>
      </div>
    </div>

    <div className={styles.actions}>
      {quantity > 0 ? (
        <>
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={addToCartLoading || orderNowLoading}
            className="btn btn--base"
            style={{
              display: "block",
              width: "100%",
            }}
          >
            {addToCartLoading ? "Adding..." : "Add To Cart"}
          </button>

          <button
            type="button"
            onClick={handleOrderNow}
            disabled={addToCartLoading || orderNowLoading}
            className="btn btn--base"
            style={{
              display: "block",
              width: "100%",
            }}
          >
            {orderNowLoading ? "Processing..." : "Order Now"}
          </button>
        </>
      ) : null}
    </div>
  </div>
</section>



          <section className={styles.contentSection}>
            <div className={styles.leftContent}>
              <div className={styles.shareBox} aria-label="Share this product">
                <span className={styles.shareLabel}>SHARE</span>

                <a
                  href={facebookShareUrl}
                  className={`${styles.shareButton} ${styles.shareFacebook}`}
                  onClick={(event) => {
                    event.preventDefault();
                    handleFacebookShare();
                  }}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Share ${product?.name || "this product"} on Facebook`}
                >
                  <FacebookIcon className={styles.shareIcon} />
                  <span>Facebook</span>
                </a>

                <a
                  href={whatsAppShareUrl}
                  className={`${styles.shareButton} ${styles.shareWhatsApp}`}
                  onClick={(event) => {
                    event.preventDefault();
                    handleWhatsAppShare();
                  }}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Ask our sales team about ${
                    product?.name || "this product"
                  } on WhatsApp`}
                >
                  <WhatsAppIcon className={styles.shareIcon} />
                  <span>WhatsApp</span>
                </a>

                <button
                  type="button"
                  className={`${styles.shareButton} ${styles.shareCopy}`}
                  onClick={handleCopyShareLink}
                  aria-label="Copy product link"
                >
                  <LinkIcon className={styles.shareIcon} />
                  <span>{copyLabel}</span>
                </button>
              </div>

            <div className={styles.tabsCard}>
              <div className={styles.galleryGrid}>
                {images.map((image, index) => (
                  <div
                    key={`${image}-${index}`}
                    className={styles.galleryItem}
                  >
                    <img    
                      src={image}
                      alt={`${product.alt || product.name} view ${index + 1}`}
                      className={styles.galleryImage}
                      loading="lazy"
                    />
                  </div>
                ))}
              </div>
            </div>
            </div>

            <aside className={styles.relatedSidebar}>
              {relatedProducts.length > 0 ? (
                <div className={styles.relatedCard}>
                  <div className={styles.relatedHeader}>
                    <h2 className={styles.relatedHeading}>
                      <span className={styles.relatedHeadingIcon} aria-hidden="true">
                        🎁
                      </span>
                      You May Also Like
                    </h2>
                  </div>

                  <div className={styles.relatedList}>
                    {relatedProducts.map((related, index) => {
                      const relatedImage = getRelatedImage(related);
                      const relatedPrice =
                        related?.discount_price ||
                        related?.sale_price ||
                        related?.regular_price ||
                        related?.price;

                      return (
                        <Link
                          key={related.id || related.slug || index}
                          href={getRelatedHref(related)}
                          className={styles.relatedProductCard}
                        >
                          <div className={styles.relatedImageBox}>
                            {relatedImage ? (
                              <img
                                src={relatedImage}
                                alt={related?.alt || related?.name || "Related product"}
                                className={styles.relatedImage}
                                loading="lazy"
                              />
                            ) : (
                              <div className={styles.relatedImagePlaceholder}>No Image</div>
                            )}
                          </div>

                          <div className={styles.relatedProductInfo}>
                            <h3 className={styles.relatedProductName}>
                              {related?.name || related?.title || "Product"}
                            </h3>

                            <p className={styles.relatedProductPrice}>
                              {formatRelatedPrice(relatedPrice)}
                            </p>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div className={styles.quickSummaryCard}>
                <div className={styles.quickSummaryHeader}>
                  <h2 className={styles.quickSummaryTitle}>Quick Summary</h2>
                </div>

                {summaryImage ? (
                  <div className={styles.quickSummaryImageBox}>
                    <img
                      src={summaryImage}
                      alt={product?.alt || product?.name || "Product quick summary"}
                      className={styles.quickSummaryImage}
                      loading="lazy"
                    />
                  </div>
                ) : null}

                <div className={styles.quickSummaryRows}>
                  <div className={styles.quickSummaryRow}>
                    <span>Brand</span>
                    <strong>{summaryBrand}</strong>
                  </div>

                  <div className={styles.quickSummaryRow}>
                    <span>Category</span>
                    <strong>{summaryCategory}</strong>
                  </div>

                  <div className={styles.quickSummaryRow}>
                    <span>Price</span>
                    <strong className={styles.quickSummaryPrice}>
                      {formatRelatedPrice(summaryPrice)}
                    </strong>
                  </div>

                  <div className={styles.quickSummaryRow}>
                    <span>Stock</span>
                    <strong
                      className={
                        quantity > 0
                          ? styles.quickSummaryStockIn
                          : styles.quickSummaryStockOut
                      }
                    >
                      {quantity > 0 ? "In Stock" : "Out Of Stock"}
                    </strong>
                  </div>

                  <div className={styles.quickSummaryRow}>
                    <span>Warranty</span>
                    <strong>{summaryWarranty}</strong>
                  </div>
                </div>

                <div className={styles.quickSummaryActions}>
                  <a
                    href={whatsAppOrderUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.quickSummaryWhatsApp}
                  >
                    <span aria-hidden="true">💬</span>
                    WhatsApp Order
                  </a>

                  <a href={`tel:${orderPhone}`} className={styles.quickSummaryCall}>
                    <span aria-hidden="true">📞</span>
                    Call Now
                  </a>
                </div>
              </div>
            </aside>
          </section>
        </div>
      </main>
    </>
  );
}