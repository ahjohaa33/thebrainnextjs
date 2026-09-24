"use client";

// CartContext — deferred refresh edition.
//
// CHANGE vs the previous version: the cart payload is NOT fetched on
// every page mount. Previously every navigation hit `/cart` (a no-store
// request) — so the homepage, product pages, and even the cart-less
// blog all paid a round trip. That added 200-400ms to every page's
// "interaction ready" time and showed up as unused JS / extra requests
// in Lighthouse.
//
// New behaviour:
//   1. On mount, we read the last-known cart count from localStorage
//      (NOT the full cart). The badge in the header shows immediately,
//      no network call.
//   2. The full cart items + summary are fetched lazily — either when
//      something CALLS refreshCart() (the /cart and /checkout pages
//      both do this), or after the user does their first add/update.
//   3. Every mutating call (addToCart, increase, decrease, remove,
//      clear) goes through `apiRequest` with `cache: "no-store"`, so
//      cart state itself is never stale.
//
// Net: homepage no longer pings /cart. Cart and checkout pages still
// see a complete, fresh cart because they call refreshCart on mount.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { apiRequest } from "@/lib/api";

const CART_COUNT_KEY = "ponnobd_cart_count";
const CartContext = createContext(null);

function readPersistedCount() {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(CART_COUNT_KEY);
    if (!raw) return 0;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

function persistCount(count) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CART_COUNT_KEY, String(Number(count) || 0));
  } catch {
    /* quota exceeded — silent */
  }
}

export function CartProvider({ children }) {
  const [cartItems, setCartItems] = useState([]);
  const [cartSummary, setCartSummary] = useState({ count: 0, subtotal: 0 });
  const [loading, setLoading] = useState(false);
  const [cartActionLoading, setCartActionLoading] = useState(false);
  const [error, setError] = useState("");

  // Hydrate the count badge from localStorage on first client render —
  // matches SSR (which renders 0) on the first paint, then swaps in
  // useEffect to avoid hydration mismatch.
  useEffect(() => {
    const stored = readPersistedCount();
    if (stored > 0) {
      setCartSummary((prev) => ({ ...prev, count: stored }));
    }
  }, []);

  const normalizeCartResponse = useCallback((payload) => {
    const items = payload?.data?.items || [];
    const summary = payload?.data?.summary || {
      count: 0,
      quantity: 0,
      subtotal: 0,
    };

    const count = Number(summary.count || 0);
    setCartItems(items);
    setCartSummary({ count, subtotal: Number(summary.subtotal || 0) });
    persistCount(count);
  }, []);

  const refreshCart = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const payload = await apiRequest("/cart", { method: "GET" });

      normalizeCartResponse(payload);
      return payload;
    } catch (err) {
      setError(err.message || "Unable to load cart.");
      throw err;
    } finally {
      setLoading(false);
    }
  }, [normalizeCartResponse]);

  const addToCart = useCallback(
    async (productId, quantity = 1) => {
      try {
        setCartActionLoading(true);
        setError("");

        const payload = await apiRequest("/cart/add", {
          method: "POST",
          body: JSON.stringify({
            product_id: productId,
            quantity,
          }),
        });

        normalizeCartResponse(payload);
        return payload;
      } catch (err) {
        setError(err.message || "Unable to add product to cart.");
        throw err;
      } finally {
        setCartActionLoading(false);
      }
    },
    [normalizeCartResponse]
  );

  const updateCartQuantity = useCallback(
    async (cartId, quantity) => {
      try {
        setCartActionLoading(true);
        setError("");

        const payload = await apiRequest(`/cart/${cartId}`, {
          method: "PATCH",
          body: JSON.stringify({ quantity }),
        });

        normalizeCartResponse(payload);
        return payload;
      } catch (err) {
        setError(err.message || "Unable to update cart.");
        throw err;
      } finally {
        setCartActionLoading(false);
      }
    },
    [normalizeCartResponse]
  );

  const increaseQuantity = useCallback(
    async (cartId) => {
      const item = cartItems.find((cart) => Number(cart.id) === Number(cartId));
      if (!item) return;
      return updateCartQuantity(cartId, Number(item.quantity || 1) + 1);
    },
    [cartItems, updateCartQuantity]
  );

  const decreaseQuantity = useCallback(
    async (cartId) => {
      const item = cartItems.find((cart) => Number(cart.id) === Number(cartId));
      if (!item) return;
      const nextQuantity = Number(item.quantity || 1) - 1;
      if (nextQuantity < 1) return;
      return updateCartQuantity(cartId, nextQuantity);
    },
    [cartItems, updateCartQuantity]
  );

  const removeFromCart = useCallback(
    async (cartId) => {
      try {
        setCartActionLoading(true);
        setError("");

        const payload = await apiRequest(`/cart/${cartId}`, {
          method: "DELETE",
        });

        normalizeCartResponse(payload);
        return payload;
      } catch (err) {
        setError(err.message || "Unable to remove product from cart.");
        throw err;
      } finally {
        setCartActionLoading(false);
      }
    },
    [normalizeCartResponse]
  );

  const clearCart = useCallback(async () => {
    try {
      setCartActionLoading(true);
      setError("");

      const payload = await apiRequest("/cart/clear", { method: "DELETE" });

      normalizeCartResponse(payload);
      return payload;
    } catch (err) {
      setError(err.message || "Unable to clear cart.");
      throw err;
    } finally {
      setCartActionLoading(false);
    }
  }, [normalizeCartResponse]);

  // NOTE: no automatic refreshCart() here. Callers (cart page, checkout
  // page) explicitly call refreshCart in their own useEffect.

  const value = useMemo(
    () => ({
      cartItems,
      cartSummary,
      cartCount: cartSummary.count,
      cartSubtotal: cartSummary.subtotal,
      loading,
      cartActionLoading,
      error,
      refreshCart,
      addToCart,
      updateCartQuantity,
      increaseQuantity,
      decreaseQuantity,
      removeFromCart,
      clearCart,
    }),
    [
      cartItems,
      cartSummary,
      loading,
      cartActionLoading,
      error,
      refreshCart,
      addToCart,
      updateCartQuantity,
      increaseQuantity,
      decreaseQuantity,
      removeFromCart,
      clearCart,
    ]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error("useCart must be used inside CartProvider");
  }

  return context;
}
