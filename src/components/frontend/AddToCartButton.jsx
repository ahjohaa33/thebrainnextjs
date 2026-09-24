"use client";

// Small client island for the per-card "Add to Cart" button.
// This is the ONLY interactive piece of ProductBox, so everything else
// stays server-rendered.

import { useState } from "react";
import { useCart } from "@/context/CartContext";
import { useToast } from "@/context/ToastContext";
import {
  addToCart as trackAddToCart,
  selectItem,
} from "@/lib/analytics";

export default function AddToCartButton({ product = {}, listName, listId }) {
  const { addToCart } = useCart();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState(false);

  async function handleAddToCart() {
    if (loading) return;
    try {
      setLoading(true);
      // Fire select_item alongside add_to_cart for richer GA reporting.
      selectItem(product, { listName, listId });
      await addToCart(product.id, 1);
      setAdded(true);
      addToast(`"${product.name || "Product"}" added to cart!`, "success");
      trackAddToCart(product, 1);
      setTimeout(() => setAdded(false), 2000);
    } catch (error) {
      addToast(error.message || "Unable to add product to cart.", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleAddToCart}
      disabled={loading}
      className="btn btn--base"
      style={{ display: "block", width: "100%" }}
      aria-label={`Add ${product.name || "product"} to cart`}
    >
      {loading ? "Adding..." : added ? "Added!" : "Add to Cart"}
    </button>
  );
}
