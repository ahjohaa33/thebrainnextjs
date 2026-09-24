import SiteHeader from "@/components/frontend/SiteHeader";
import CartClient from "./CartClient";
import { buildMetadata } from "@/lib/seo";

/**
 * Cart is a transient, user-specific page — never indexable.
 * `noindex: true` here is what flips the global `index, follow` default
 * declared in `lib/seo.js` to `noindex, nofollow` for this route only.
 */
export function generateMetadata() {
  return buildMetadata({
    title: "Your Cart",
    description: "Review the items in your cart before checking out.",
    path: "/cart",
    noindex: true,
  });
}

export default function CartPage() {
  return (
    <>
      <SiteHeader />
      <CartClient />
    </>
  );
}
