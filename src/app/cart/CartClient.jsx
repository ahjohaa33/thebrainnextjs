"use client";

// Cart uses Bootstrap grid / utilities + the legacy theme styles.
// These were previously loaded globally in layout.js, which forced
// every page (including the homepage LCP) to ship them. Now they
// only load on the cart route.
import "@/app/_styles/bootstrap.min.css";
import "@/app/_styles/main.css";
import "./CartPage.module.css";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useCart } from "@/context/CartContext";
import {
  viewCart,
  removeFromCart as trackRemoveFromCart,
  beginCheckout,
} from "@/lib/analytics";

function formatPrice(value) {
  return `৳${Number(value || 0).toLocaleString("en-BD", {
    maximumFractionDigits: 2,
  })}`;
}

export default function CartPage() {
  const {
    cartItems,
    cartSubtotal,
    loading,
    cartActionLoading,
    error,
    increaseQuantity,
    decreaseQuantity,
    removeFromCart,
    refreshCart,
  } = useCart();

  // CartProvider no longer auto-fetches on every page mount (it would
  // hit /cart on every navigation, even from pages that don't need it).
  // This page DOES need a fresh cart, so trigger one explicit refresh
  // on mount.
  useEffect(() => {
    refreshCart().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fire view_cart once after the cart payload arrives. We use a ref to
  // avoid double-firing in React Strict Mode dev double-invoke.
  const viewCartFiredRef = useRef(false);
  useEffect(() => {
    if (loading) return;
    if (viewCartFiredRef.current) return;
    if (cartItems.length === 0) return;
    viewCart(cartItems, cartSubtotal);
    viewCartFiredRef.current = true;
  }, [loading, cartItems, cartSubtotal]);

  async function handleRemove(cart) {
    // Capture a copy before the cart updates, since GA needs the item info.
    const snapshot = {
      product: cart.product,
      price: cart.price,
      quantity: cart.quantity,
    };
    try {
      await removeFromCart(cart.id);
      trackRemoveFromCart(snapshot, Number(cart.quantity || 1));
    } catch {
      /* error already shown by context */
    }
  }

  function handleProceedToCheckout() {
    beginCheckout(cartItems, cartSubtotal);
    // The Link below performs the actual navigation; this only fires the
    // analytics event. (We can't put this on `onClick` of <Link> with
    // navigation cancellation, so the event is best-effort fire-and-go.)
  }

  return (
    <div>
      <section className="breadcrumb" style={{ padding: "80px" }} aria-label="Cart breadcrumb">
        <div className="container">
          <div className="row">
            <div className="col-lg-12">
              <div className="breadcrumb--wrapper">
                {/*
                  Was <h2> — every page should have a single H1, and "Cart"
                  is the most descriptive heading for this page. Visual size
                  stays the same (still uses .breadcrumb--title styling).
                */}
                <h1 className="breadcrumb--title fw--400">Cart</h1>

                <ul className="breadcrumb--list">
                  <li className="breadcrumb--item">
                    <Link href="/" className="breadcrumb--link">Home</Link>
                  </li>
                  <li className="breadcrumb--icon" aria-hidden="true">/</li>
                  <li className="breadcrumb--item">
                    <span className="breadcrumb--item--text">Cart</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="all-cart--list py-10">
        <div className="container">
          {error ? (
            <div className="alert alert-danger mb-4" role="alert">
              {error}
            </div>
          ) : null}

          <div className="row border-bottom--solid1 d-none d-md-flex">
            <div className="col-lg-6 col-md-6"><strong>Product</strong></div>
            <div className="col-lg-2 col-md-2"><strong>Price</strong></div>
            <div className="col-lg-2 col-md-2"><strong>Quantity</strong></div>
            <div className="col-lg-2 col-md-2"><strong>Total</strong></div>
          </div>

          <div className="row mb-5">
            <div className="col-lg-12">
              <div className="product-list border-bottom--solid1">
                {loading ? (
                  <div className="text-center py-5">Loading cart...</div>
                ) : cartItems.length > 0 ? (
                  cartItems.map((cart) => (
                    <div
                      className="row gy-3 align-items-center"
                      key={cart.id}
                      style={{ padding: "18px 0" }}
                    >
                      <div className="col-lg-6 col-md-6">
                        <div className="content--wrap d-flex align-items-baseline gap--20">
                          <div className="thumb--wrap">
                            <img
                              src={
                                cart.product?.thumbnail_url ||
                                cart.product?.thumbnail ||
                                "/placeholder.png"
                              }
                              height="100"
                              width="100"
                              alt={cart.product?.name || "Product"}
                              style={{ objectFit: "contain" }}
                              loading="lazy"
                            />
                          </div>

                          <div className="title--wrap">
                            <p className="fw--400" style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
                              {cart.product?.name || "Product"}
                            </p>

                            <button
                              type="button"
                              onClick={() => handleRemove(cart)}
                              disabled={cartActionLoading}
                              style={{
                                border: 0,
                                background: "transparent",
                                color: "#dc3545",
                                padding: "6px 0",
                                fontSize: "14px",
                                cursor: "pointer",
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="col-lg-2 col-md-2 d-none d-md-block">
                        <div className="price--wrap flex-shrink-0">
                          <span className="price fw--400">{formatPrice(cart.price)}</span>
                        </div>
                      </div>

                      <div className="col-lg-2 col-md-2 d-flex justify-content-lg-start justify-content-end">
                        <div className="quantity_box border--base d-flex justify-content-center align-items-center">
                          <button
                            type="button"
                            className="sub"
                            onClick={() => decreaseQuantity(cart.id)}
                            disabled={cartActionLoading || Number(cart.quantity) <= 1}
                            aria-label="Decrease quantity"
                          >
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                              <line x1="1" y1="7" x2="13" y2="7" />
                            </svg>
                          </button>

                          <input
                            className="count-input"
                            type="number"
                            value={cart.quantity}
                            readOnly
                            aria-label="Quantity"
                          />

                          <button
                            type="button"
                            className="add"
                            onClick={() => increaseQuantity(cart.id)}
                            disabled={cartActionLoading}
                            aria-label="Increase quantity"
                          >
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                              <line x1="7" y1="1" x2="7" y2="13" />
                              <line x1="1" y1="7" x2="13" y2="7" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      <div className="col-lg-2 col-md-2 d-flex justify-content-lg-start justify-content-end">
                        <div className="total-price--wrap flex-shrink-0">
                          <span className="price fs--20 fw--400">
                            {formatPrice(cart.total_price)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-5">No Data Found</div>
                )}
              </div>
            </div>
          </div>

          {cartItems.length > 0 ? (
            <div className="row justify-content-end">
              <div className="col-lg-4 col-md-8">
                <div className="cart--footer2 d-flex flex-column gap--20 justify-content-center align-items-center w--100 position-relative">
                  <div className="d-flex justify-content-between align-items-center w--100">
                    <strong style={{ fontSize: 16 }}>Subtotal:</strong>
                    <strong style={{ fontSize: 16 }}>{formatPrice(cartSubtotal)}</strong>
                  </div>

                  <div className="d-flex flex-column justify-content-center align-items-center gap--12 w--100">
                    <Link
                      href="/checkout"
                      className="btn btn--base w-100 btn--lg w--100"
                      onClick={handleProceedToCheckout}
                    >
                      Proceed To Checkout ({cartItems.length})
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
