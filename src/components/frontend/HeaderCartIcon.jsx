"use client";

// Tiny client island for the cart icon + live count badge.
// The badge needs the CartContext (client-only), so this lives in its
// own ~1KB file instead of forcing the whole Header to be a client
// component.

import Link from "next/link";
import styles from "./Header.module.css";
import { useCart } from "@/context/CartContext";

export default function HeaderCartIcon() {
  const { cartCount } = useCart();

  return (
    <Link
      href="/cart"
      className={styles.cartIcon}
      aria-label={`Cart ${cartCount > 0 ? `(${cartCount} items)` : ""}`}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </svg>

      {cartCount > 0 && (
        <span className={styles.cartBadge}>
          <span>{cartCount}</span>
        </span>
      )}
    </Link>
  );
}
