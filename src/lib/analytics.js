/**
 * GA4 event layer (via Google Tag Manager dataLayer).
 *
 * DESIGN GOAL: zero impact on LCP / TBT.
 *   - This file ships **no** SDK code. Every event is a plain
 *     `window.dataLayer.push({...})`. GTM (loaded once via <Analytics />)
 *     handles delivery to GA4 / Ads / Meta / wherever.
 *   - All exported functions are SSR-safe — they no-op on the server, so you
 *     can call them from anywhere (event handlers, useEffect, etc.) without
 *     guarding `typeof window`.
 *   - Item payloads are normalised once in `toItem()` so callers don't need
 *     to remember GA4's parameter names (item_id, item_name, item_category,
 *     etc.) — they pass our internal product/cart shapes and we translate.
 *
 * ADDING NEW EVENTS:
 *   Add a thin wrapper at the bottom that calls `track()`. The 24 events
 *   spec'd by the audit are all wired below.
 */

const isBrowser = () => typeof window !== "undefined";

/**
 * Initialise dataLayer lazily — GTM does this too, but we want our pushes
 * to survive even if GTM hasn't loaded yet (it'll replay them).
 */
function ensureDataLayer() {
  if (!isBrowser()) return null;
  window.dataLayer = window.dataLayer || [];
  return window.dataLayer;
}

/**
 * Normalise our internal product / cart-item shape → GA4 item.
 *
 * Accepts:
 *   - product objects from /home and /product-or-category endpoints
 *   - cart items (which have `.product` + own `quantity`/`price`)
 *   - already-shaped items (passed through untouched)
 */
export function toItem(input = {}, overrides = {}) {
  const product = input.product || input;
  const id =
    input.item_id ||
    product.item_id ||
    product.sku ||
    product.code ||
    product.id ||
    product.product_id ||
    "";
  const name =
    input.item_name || product.item_name || product.name || product.title || "";
  const price = Number(
    input.price ??
      product.price ??
      product.discount_price ??
      product.unit_price ??
      product.regular_price ??
      0
  );
  const quantity = Number(input.quantity ?? input.qty ?? 1);

  const category = product.category?.name || product.categories?.[0]?.name;
  const brand = product.brand?.name || product.brand_name;

  return {
    item_id: String(id),
    item_name: String(name).slice(0, 200),
    price: Number(price.toFixed(2)),
    quantity,
    ...(category ? { item_category: category } : {}),
    ...(brand ? { item_brand: brand } : {}),
    ...overrides,
  };
}

/**
 * Low-level push. Most callers should use the named wrappers below;
 * this is exported for ad-hoc events not covered by the spec.
 */
// Fields that belong INSIDE `ecommerce`, per the GA4 dataLayer spec.
// Anything else in `params` stays at the top level of the event push.
const ECOMMERCE_KEYS = new Set([
  "currency",
  "value",
  "items",
  "transaction_id",
  "shipping",
  "tax",
  "coupon",
  "shipping_tier",
  "payment_type",
  "item_list_id",
  "item_list_name",
  "promotion_id",
  "promotion_name",
  "creative_name",
  "creative_slot",
]);

export function track(eventName, params = {}) {
  const dl = ensureDataLayer();
  if (!dl || !eventName) return;

  const ecommerce = {};
  const rest = {};
  for (const [key, val] of Object.entries(params)) {
    if (val === undefined) continue; // drop undefined keys either way
    if (ECOMMERCE_KEYS.has(key)) ecommerce[key] = val;
    else rest[key] = val;
  }

  const hasEcommerce = Object.keys(ecommerce).length > 0;

  if (hasEcommerce) {
    dl.push({ ecommerce: null });
  }

  dl.push({
    event: eventName,
    ...rest,
    ...(hasEcommerce ? { ecommerce } : {}),
  });
}

/* ─────────── E-COMMERCE EVENTS ─────────── */

const CURRENCY = "BDT";

export function viewItem(product, listName) {
  if (!product) return;
  const item = toItem(product, listName ? { item_list_name: listName } : {});
  track("view_item", {
    currency: CURRENCY,
    value: item.price * item.quantity,
    items: [item],
  });
}

export function viewItemList({ listName, listId, products = [] } = {}) {
  if (!products || products.length === 0) return;
  const items = products.map((p, i) =>
    toItem(p, {
      index: i + 1,
      ...(listName ? { item_list_name: listName } : {}),
      ...(listId ? { item_list_id: listId } : {}),
    })
  );
  track("view_item_list", {
    item_list_id: listId,
    item_list_name: listName,
    items,
  });
}

export function selectItem(product, { listName, listId } = {}) {
  if (!product) return;
  const item = toItem(product, {
    ...(listName ? { item_list_name: listName } : {}),
    ...(listId ? { item_list_id: listId } : {}),
  });
  track("select_item", {
    item_list_id: listId,
    item_list_name: listName,
    items: [item],
  });
}

export function addToCart(product, quantity = 1) {
  if (!product) return;
  const item = toItem(product, { quantity });
  track("add_to_cart", {
    currency: CURRENCY,
    value: item.price * item.quantity,
    items: [item],
  });
}

export function removeFromCart(item, quantity = 1) {
  if (!item) return;
  const normalised = toItem(item, { quantity });
  track("remove_from_cart", {
    currency: CURRENCY,
    value: normalised.price * normalised.quantity,
    items: [normalised],
  });
}

export function viewCart(cartItems = [], subtotal = 0) {
  const items = cartItems.map((c) => toItem(c));
  track("view_cart", {
    currency: CURRENCY,
    value: Number(subtotal) || items.reduce((s, i) => s + i.price * i.quantity, 0),
    items,
  });
}

export function beginCheckout(cartItems = [], subtotal = 0) {
  const items = cartItems.map((c) => toItem(c));
  track("begin_checkout", {
    currency: CURRENCY,
    value: Number(subtotal) || items.reduce((s, i) => s + i.price * i.quantity, 0),
    items,
  });
}

export function addShippingInfo({ cartItems = [], subtotal = 0, shippingTier } = {}) {
  const items = cartItems.map((c) => toItem(c));
  track("add_shipping_info", {
    currency: CURRENCY,
    value: Number(subtotal) || items.reduce((s, i) => s + i.price * i.quantity, 0),
    shipping_tier: shippingTier,
    items,
  });
}

export function addPaymentInfo({ cartItems = [], subtotal = 0, paymentType } = {}) {
  const items = cartItems.map((c) => toItem(c));
  track("add_payment_info", {
    currency: CURRENCY,
    value: Number(subtotal) || items.reduce((s, i) => s + i.price * i.quantity, 0),
    payment_type: paymentType,
    items,
  });
}

export function purchase({
  transactionId,
  cartItems = [],
  subtotal = 0,
  shipping = 0,
  tax = 0,
  coupon,
} = {}) {
  const items = cartItems.map((c) => toItem(c));
  const value =
    Number(subtotal) +
    Number(shipping || 0) +
    Number(tax || 0);
  track("purchase", {
    transaction_id: String(transactionId || ""),
    currency: CURRENCY,
    value: Number(value.toFixed(2)),
    shipping: Number(shipping) || undefined,
    tax: Number(tax) || undefined,
    coupon: coupon || undefined,
    items,
  });
}

export function refund({ transactionId, cartItems = [], value } = {}) {
  const items = cartItems.map((c) => toItem(c));
  track("refund", {
    transaction_id: String(transactionId || ""),
    currency: CURRENCY,
    value: Number(value) || items.reduce((s, i) => s + i.price * i.quantity, 0),
    items,
  });
}

export function addToWishlist(product) {
  if (!product) return;
  const item = toItem(product);
  track("add_to_wishlist", {
    currency: CURRENCY,
    value: item.price * item.quantity,
    items: [item],
  });
}

/* ─────────── PROMOTIONS ─────────── */

export function viewPromotion({ promotionId, promotionName, creativeName, creativeSlot, items = [] } = {}) {
  track("view_promotion", {
    promotion_id: promotionId,
    promotion_name: promotionName,
    creative_name: creativeName,
    creative_slot: creativeSlot,
    items: items.map((p) => toItem(p)),
  });
}

export function selectPromotion({ promotionId, promotionName, creativeName, creativeSlot, items = [] } = {}) {
  track("select_promotion", {
    promotion_id: promotionId,
    promotion_name: promotionName,
    creative_name: creativeName,
    creative_slot: creativeSlot,
    items: items.map((p) => toItem(p)),
  });
}

/* ─────────── ENGAGEMENT ─────────── */

export function whatsappClick({ phone, location } = {}) {
  track("whatsapp_click", { phone, location });
}

export function phoneCallClick({ phone, location } = {}) {
  track("phone_call_click", { phone, location });
}

export function newsletterSignup({ method = "footer" } = {}) {
  track("newsletter_signup", { method });
}

export function outOfStockView(product) {
  if (!product) return;
  track("out_of_stock_view", { items: [toItem(product)] });
}

export function viewSizeChart(productId) {
  track("view_size_chart", { item_id: String(productId || "") });
}

export function compareProducts(productIds = []) {
  track("compare_products", {
    item_ids: productIds.map(String),
    item_count: productIds.length,
  });
}

export function submitReview({ productId, rating } = {}) {
  track("submit_review", {
    item_id: String(productId || ""),
    rating: Number(rating) || undefined,
  });
}

export function couponApplied({ coupon, value, success = true } = {}) {
  track("coupon_applied", {
    coupon: coupon || "",
    value: Number(value) || undefined,
    success,
  });
}

export function videoEngagement({ action, videoTitle, percent } = {}) {
  // action: "play" | "pause" | "complete" | "progress"
  track("video_engagement", {
    action,
    video_title: videoTitle,
    video_percent: Number(percent) || undefined,
  });
}

/* ─────────── SCROLL DEPTH (75% / 90%) ─────────── */

/**
 * Wire this once from a top-level client component (e.g. <Analytics />).
 * It listens lazily, fires each threshold once per page, and removes
 * itself when both have fired — so it stops costing scroll-handler time.
 */
export function installScrollDepthTracking() {
  if (!isBrowser()) return () => {};

  const thresholds = [75, 90];
  const fired = new Set();

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const docHeight =
        Math.max(
          document.body.scrollHeight,
          document.documentElement.scrollHeight,
          document.body.offsetHeight,
          document.documentElement.offsetHeight,
          document.body.clientHeight,
          document.documentElement.clientHeight
        ) - window.innerHeight;
      if (docHeight <= 0) return;

      const percent = (scrollTop / docHeight) * 100;
      thresholds.forEach((t) => {
        if (percent >= t && !fired.has(t)) {
          fired.add(t);
          track("scroll_depth", { percent_scrolled: t });
          if (fired.size === thresholds.length) {
            window.removeEventListener("scroll", onScroll);
          }
        }
      });
    });
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  return () => window.removeEventListener("scroll", onScroll);
}
