import SiteHeader from "@/components/frontend/SiteHeader";
import CheckoutClient from "./CheckoutClient";
import { buildMetadata } from "@/lib/seo";

export function generateMetadata() {
  return buildMetadata({
    title: "Checkout",
    description: "Complete your order securely.",
    path: "/checkout",
    noindex: true,
  });
}

export default function CheckoutPage() {
  return (
    <>
      <SiteHeader />
      <CheckoutClient />
    </>
  );
}
