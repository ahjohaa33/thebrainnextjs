"use client";

// Checkout uses Bootstrap grid + the legacy theme styles.
// Loaded only on this route, not globally.
import "@/app/_styles/bootstrap.min.css";
import "@/app/_styles/main.css";
import "./checkoutPage.module.css";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiRequest } from "@/lib/api";
import { absoluteUrl } from "@/lib/config";
import { useCart } from "@/context/CartContext";
import { useToast } from "@/context/ToastContext";
import styles from "./checkoutPage.module.css";

/* ─── helpers ────────────────────────────────────────────────────────── */

const SHIPPING_METHODS = [
  {
    value: "inside_dhaka",
    label: "Inside Dhaka",
    icon: "🏙️",
  },
  {
    value: "outside_dhaka",
    label: "Outside Dhaka",
    icon: "🚚",
  },
];

function formatPrice(value) {
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function onlyDefined(payload) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined && value !== null)
  );
}

function resolveMessage(payload, fallback) {
  return (
    payload?.message ||
    payload?.data?.message ||
    payload?.success_message ||
    payload?.data?.success_message ||
    fallback
  );
}

function resolveOrderNumber(payload) {
  return (
    payload?.order_number ||
    payload?.order_no ||
    payload?.invoice_no ||
    payload?.data?.order_number ||
    payload?.data?.order_no ||
    payload?.data?.invoice_no ||
    payload?.order?.order_number ||
    payload?.order?.order_no ||
    payload?.order?.code ||
    payload?.data?.order?.order_number ||
    payload?.data?.order?.order_no ||
    payload?.data?.order?.code ||
    payload?.order_id ||
    payload?.id ||
    payload?.data?.order_id ||
    payload?.data?.id ||
    payload?.order?.id ||
    payload?.data?.order?.id ||
    ""
  );
}

function resolveOrderDetails(payload) {
  return (
    payload?.order ||
    payload?.data?.order ||
    payload?.data ||
    payload ||
    {}
  );
}

/**
 * Resolve a product image URL.
 * Cart items from the API can have the image as a bare path ("products/abc.jpg"),
 * a storage-relative path ("/storage/products/abc.jpg"), or a full URL.
 * absoluteUrl() from lib/config handles all three cases correctly.
 */
function productImageUrl(item) {
  const product = item.product || {};
  const raw =
    product.thumbnail_url ||
    product.thumbnail_img ||
    product.thumbnail ||
    product.image ||
    item.thumbnail_url ||
    item.thumbnail_img ||
    item.thumbnail ||
    item.image ||
    "";
  const version =
    product.thumbnail_updated_at ||
    product.updated_at ||
    item.thumbnail_updated_at ||
    item.updated_at;
  return raw ? absoluteUrl(raw, version) : "/placeholder.png";
}

/* ─── component ──────────────────────────────────────────────────────── */

export default function CheckoutClient() {
  const router = useRouter();
  const { addToast } = useToast();

  // Reuse cart data already fetched by CartContext — correct shape guaranteed
  const {
    cartItems,
    cartSubtotal,
    loading,
    removeFromCart,
    refreshCart,
  } = useCart();

  const [removingId, setRemovingId] = useState(null);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [updatingShipping, setUpdatingShipping] = useState(false);

  const [form, setForm] = useState({
    name: "",
    address: "",
    phone: "",
    notes: "",
    create_account: false,
    password: "",
    check_terms: false,
    shipping_type: "inside_dhaka",
  });

  const [errors, setErrors] = useState({});
  const [pageError, setPageError] = useState("");
  const [pageSuccess, setPageSuccess] = useState("");

  // Seed shipping_type from first cart item once loaded, but keep only the two allowed methods.
  useEffect(() => {
    if (cartItems.length > 0) {
      const firstShipping = cartItems[0]?.shipping_type || "inside_dhaka";
      const normalizedShipping = SHIPPING_METHODS.some(
        (method) => method.value === firstShipping
      )
        ? firstShipping
        : "inside_dhaka";
      setForm((prev) => ({ ...prev, shipping_type: normalizedShipping }));
    }
  }, [cartItems.length]);

  // Analytics
  useEffect(() => {
    if (!loading && cartItems.length > 0) {
      if (
        typeof window !== "undefined" &&
        window.Analytics &&
        typeof window.Analytics.beginCheckout === "function"
      ) {
        window.Analytics.beginCheckout({
          total: cartSubtotal,
          items: cartItems.map((item) => ({
            id: item.product?.id || item.product_id,
            name: item.product?.name || item.name || "Unavailable",
            price: Number(item.price || 0),
            qty: Number(item.quantity || 1),
          })),
        });
      }
    }
  }, [loading, cartItems, cartSubtotal]);

  const isPlaceOrderReady = useMemo(() => {
    const hasRequiredBilling =
      form.name.trim() && form.address.trim() && form.phone.trim();
    const accountPasswordOk =
      !form.create_account || form.password.trim().length >= 6;

    return Boolean(
      hasRequiredBilling &&
        form.check_terms &&
        accountPasswordOk &&
        cartItems.length > 0 &&
        !placingOrder &&
        !updatingShipping
    );
  }, [form, cartItems.length, placingOrder, updatingShipping]);

  function updateField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
    setPageError("");
    setPageSuccess("");
  }

  function validateForm() {
    const nextErrors = {};
    if (!form.name.trim()) nextErrors.name = "The name field is required.";
    if (!form.address.trim()) nextErrors.address = "The address field is required.";
    if (!form.phone.trim()) nextErrors.phone = "The phone field is required.";
    if (!form.check_terms)
      nextErrors.check_terms = "You must accept the terms and conditions.";
    if (form.create_account && !form.password.trim())
      nextErrors.password = "The password field is required.";
    if (form.create_account && form.password.trim().length < 6)
      nextErrors.password = "The password must be at least 6 characters.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleRemoveItem(cartId) {
    setRemovingId(cartId);
    try {
      await removeFromCart(cartId);
    } catch (err) {
      console.error("Remove item error:", err);
      setPageSuccess("");
      setPageError("Could not remove item. Please try again.");
    } finally {
      setRemovingId(null);
    }
  }

  async function updateShipping(value) {
    const previousShippingType = form.shipping_type;

    setUpdatingShipping(true);
    setPageError("");
    setPageSuccess("");
    setForm((prev) => ({ ...prev, shipping_type: value }));

    try {
      const payload = await apiRequest("/cart/shipping", {
        method: "POST",
        body: JSON.stringify({ shipping_type: value }),
      });

      setPageSuccess(
        resolveMessage(payload, "Shipping method updated successfully.")
      );

      // If Laravel recalculates shipping/totals, pull the latest cart state.
      refreshCart().catch(() => {});
    } catch (error) {
      console.error("Shipping update error:", error);
      setForm((prev) => ({ ...prev, shipping_type: previousShippingType }));
      setPageError(
        error?.message || "Shipping method could not be updated."
      );
    } finally {
      setUpdatingShipping(false);
    }
  }

  async function placeOrder(e) {
    e.preventDefault();
    if (!validateForm() || !isPlaceOrderReady) return;

    setPlacingOrder(true);
    setPageError("");
    setPageSuccess("");

    const customer = {
      name: form.name.trim(),
      address: form.address.trim(),
      phone: form.phone.trim(),
      notes: form.notes.trim(),
    };

    // Keep this payload aligned with the Laravel placeOrder() validator.
    // The backend reads products from the saved cart, so do not send
    // frontend-calculated cart items here.
    const payload = onlyDefined({
      name: customer.name,
      address: customer.address,
      phone: customer.phone,
      notes: customer.notes || undefined,
      payment_type: "cash_on_delivery",
      shipping_type: form.shipping_type,
    });

    try {
      // Laravel endpoint: POST /api/v1/checkout through the Next proxy.
      const data = await apiRequest("/checkout", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const orderDetails = resolveOrderDetails(data);
      const orderNumber = resolveOrderNumber(data);

      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(
          "ponnobd_last_order",
          JSON.stringify({
            orderNumber,
            orderDetails,
            customer,
            shippingType: form.shipping_type,
            paymentType: "cash_on_delivery",
            subtotal: cartSubtotal,
            items: cartItems,
            response: data,
            placedAt: new Date().toISOString(),
          })
        );
      }

      addToast("Order placed successfully! 🎉", "success", 4000);
      router.push("/order-success");
    } catch (error) {
      console.error("Checkout submit error:", error);

      const message = error?.message || "Order failed. Please try again.";

      if (typeof window !== "undefined") {
        window.sessionStorage.setItem("ponnobd_checkout_error", message);
      }

      setPageSuccess("");
      setPageError(message);
    } finally {
      setPlacingOrder(false);
    }
  }

  /* ─── loading state ─── */
  if (loading) {
    return (
      <div className={styles.checkoutPage}>
        <nav className={styles.breadcrumb}>
          <div className="container">
            <div className={styles.breadcrumbInner}>
              <Link href="/">Home</Link>
              <span className={styles.breadcrumbSep}>/</span>
              <span>Checkout</span>
            </div>
          </div>
        </nav>
        <div className="container">
          <div className={styles.loadingWrapper}>
            <div className={styles.spinner} />
            Loading checkout…
          </div>
        </div>
      </div>
    );
  }

  /* ─── main render ─── */
  return (
    <div className={styles.checkoutPage}>
      {/* Breadcrumb */}
      <nav className={styles.breadcrumb}>
        <div className="container">
          <div className={styles.breadcrumbInner}>
            <Link href="/">Home</Link>
            <span className={styles.breadcrumbSep}>/</span>
            <span>Checkout</span>
          </div>
        </div>
      </nav>

      <div className={`container ${styles.pageContent}`}>
        <form onSubmit={placeOrder}>
          <div className="row g-4">

            {/* ── Left: Billing form ── */}
            <div className={`col-12 col-md-7 col-lg-8 ${styles.formCol}`}>

              {/* Checkout banner — text fallback if image missing */}
              <div className={styles.checkoutBanner}>
                <div className={styles.checkoutBannerInner}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                  </svg>
                  <span>Secure Checkout</span>
                </div>
              </div>

              {pageError && <div className={styles.alertError}>{pageError}</div>}
              {pageSuccess && <div className={styles.alertSuccess}>{pageSuccess}</div>}

              {/* Billing card */}
              <div className={styles.card}>
                <h4 className={styles.sectionTitle}>Billing Details</h4>

                <div className={styles.formGroup}>
                  <label className={styles.label}>
                    Full Name <span className={styles.required}>*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    className={`${styles.input} ${errors.name ? styles.invalid : ""}`}
                    placeholder="Enter your full name"
                  />
                  {errors.name && <p className={styles.fieldError}>{errors.name}</p>}
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>
                    Address <span className={styles.required}>*</span>
                  </label>
                  <input
                    type="text"
                    value={form.address}
                    onChange={(e) => updateField("address", e.target.value)}
                    className={`${styles.input} ${errors.address ? styles.invalid : ""}`}
                    placeholder="Enter your full address"
                  />
                  {errors.address && <p className={styles.fieldError}>{errors.address}</p>}
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>
                    Phone <span className={styles.required}>*</span>
                  </label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => updateField("phone", e.target.value)}
                    className={`${styles.input} ${errors.phone ? styles.invalid : ""}`}
                    placeholder="01XXXXXXXXX"
                  />
                  {errors.phone && <p className={styles.fieldError}>{errors.phone}</p>}
                </div>

                <div className={styles.formGroup}>
                  <div className={styles.checkRow}>
                    <input
                      type="checkbox"
                      checked={form.create_account}
                      onChange={(e) => updateField("create_account", e.target.checked)}
                      id="create-account"
                    />
                    <label className={styles.checkLabel} htmlFor="create-account">
                      Create an account?
                    </label>
                  </div>

                  {form.create_account && (
                    <div className={styles.passwordBox}>
                      <label className={styles.label} htmlFor="checkout-password">
                        Password <span className={styles.required}>*</span>
                      </label>
                      <input
                        id="checkout-password"
                        type="password"
                        value={form.password}
                        onChange={(e) => updateField("password", e.target.value)}
                        className={`${styles.input} ${errors.password ? styles.invalid : ""}`}
                        placeholder="Minimum 6 characters"
                      />
                      {errors.password && (
                        <p className={styles.fieldError}>{errors.password}</p>
                      )}
                    </div>
                  )}
                </div>

                <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                  <label className={styles.label}>Order Notes (optional)</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => updateField("notes", e.target.value)}
                    className={styles.textarea}
                    rows={3}
                    placeholder="Special notes for delivery, etc."
                  />
                </div>
              </div>
            </div>

            {/* ── Right: Order summary ── */}
            <div className={`col-12 col-md-5 col-lg-4 ${styles.summaryCol}`}>

              <div className={styles.card}>
                <h4 className={styles.sectionTitle}>Order Summary</h4>

                {/* Product list */}
                {cartItems.length === 0 ? (
                  <div className={styles.emptyCart}>
                    Your cart is empty.{" "}
                    <Link href="/">Shop now</Link>
                  </div>
                ) : (
                  <div className={styles.itemList}>
                    {cartItems.map((cart) => {
                      const product = cart.product || {};
                      const lineTotal =
                        Number(cart.price || 0) * Number(cart.quantity || 0);
                      const isRemoving = removingId === cart.id;

                      return (
                        <div
                          key={cart.id || `${cart.product_id}-${cart.variation}`}
                          className={`${styles.itemRow} ${isRemoving ? styles.rowRemoving : ""}`}
                        >
                          <img
                            src={productImageUrl(cart)}
                            alt={product.name || "Product"}
                            className={styles.productThumb}
                            onError={(e) => { e.currentTarget.src = "/placeholder.png"; }}
                          />
                          <div className={styles.itemInfo}>
                            <div className={styles.productName}>
                              {product.name || cart.name || "Product"}
                            </div>
                            <div className={styles.itemMeta}>
                              {cart.quantity > 1 && (
                                <span className={styles.qty}>Qty: {cart.quantity}</span>
                              )}
                              <span className={styles.linePrice}>{formatPrice(lineTotal)}</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            className={styles.removeBtn}
                            onClick={() => handleRemoveItem(cart.id)}
                            disabled={isRemoving}
                            title="Remove item"
                            aria-label="Remove item"
                          >
                            {isRemoving ? (
                              <span className={styles.removingDot} />
                            ) : (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                <line x1="18" y1="6" x2="6" y2="18"/>
                                <line x1="6" y1="6" x2="18" y2="18"/>
                              </svg>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Shipping method */}
                <div className={styles.shippingSection}>
                  <div className={styles.shippingSectionTitle}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
                    </svg>
                    Shipping Method
                  </div>
                  <div className={styles.shippingOptions}>
                    {SHIPPING_METHODS.map((method) => (
                      <label
                        key={method.value}
                        className={`${styles.shippingOption} ${
                          form.shipping_type === method.value ? styles.selected : ""
                        }`}
                      >
                        <input
                          type="radio"
                          name="shipping_type"
                          value={method.value}
                          checked={form.shipping_type === method.value}
                          onChange={(e) => updateShipping(e.target.value)}
                          disabled={updatingShipping}
                        />
                        <div className={styles.shippingOptionContent}>
                          <span className={styles.shippingIcon}>{method.icon}</span>
                          <span className={styles.shippingLabel}>{method.label}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Totals */}
                <div className={styles.totalsBlock}>
                  <div className={styles.totalLine}>
                    <span>Subtotal</span>
                    <span>{formatPrice(cartSubtotal)}</span>
                  </div>
                  <div className={`${styles.totalLine} ${styles.grandTotal}`}>
                    <span>Total</span>
                    <span>{formatPrice(cartSubtotal)}</span>
                  </div>
                </div>
              </div>

              {/* Payment + T&C + Submit */}
              <div className={styles.paymentBox}>
                <h5 className={styles.paymentTitle}>ক্যাশ অন ডেলিভারি</h5>
                <p className={`${styles.paymentNote} kalpurush`}>
                  ঢাকার মধ্যে পণ্য বুঝে পাওয়ার পর ক্যাশ টাকার মাধ্যমে পে করতে
                  হবে। পাঠাও বা ( Uber ) ভাড়া অনুযায়ী ডেলিভারি চার্জ প্রযোজ্য হবে। ঢাকার বাইরে কুরিয়ারের মাধ্যমে পণ্য নিতে হলে পণ্যের
                  মূল্যের ৫%-১০% বিকাশ/রকেটের মাধ্যমে অগ্রীম প্রদান করতে হবে।
                </p>

                <p className={styles.privacyNote}>
                  Your personal data will be used to process your order and
                  support your experience as described in our{" "}
                  <Link href="/privacy-policy" target="_blank">privacy policy</Link>.
                </p>

                {errors.check_terms && (
                  <div className={styles.alertError}>{errors.check_terms}</div>
                )}

                <div className={styles.checkRow} style={{ marginTop: 14 }}>
                  <input
                    type="checkbox"
                    checked={form.check_terms}
                    onChange={(e) => updateField("check_terms", e.target.checked)}
                    id="terms"
                  />
                  <label className={styles.checkLabel} htmlFor="terms">
                    I have read and agree to the{" "}
                    <Link href="/terms-and-conditions" target="_blank">Terms &amp; Conditions</Link>{" "}
                    of {process.env.NEXT_PUBLIC_SITE_NAME || "Ponnobd"}.
                  </label>
                </div>

                <button
                  type="submit"
                  className={styles.submitBtn}
                  disabled={!isPlaceOrderReady}
                >
                  {placingOrder ? "Placing Order…" : "Place Order"}
                </button>
              </div>
            </div>

          </div>
        </form>
      </div>
    </div>
  );
}
