import OrderSuccessClient from "./OrderSuccessClient";
import SiteHeader from "@/components/frontend/SiteHeader";
import { buildMetadata } from "@/lib/seo";

export function generateMetadata() {
  return buildMetadata({
    title: "Order Confirmed",
    description: "Thank you — your order has been placed.",
    path: "/order-success",
    noindex: true,
  });
}

export default function OrderSuccessPage() {
  return (
    <>
      <SiteHeader />
      <OrderSuccessClient />
    </>
  );
}
