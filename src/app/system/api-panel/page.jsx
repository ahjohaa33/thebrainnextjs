import { notFound } from "next/navigation";
import { API_ENDPOINTS } from "@/lib/api-catalog";
import ApiPanelClient from "./ApiPanelClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isPanelEnabled() {
  return (
    process.env.NODE_ENV !== "production" ||
    String(process.env.API_PANEL_ENABLED || "").toLowerCase() === "true"
  );
}

function normalize(value = "") {
  return String(value || "").replace(/\/+$/, "");
}

export default function ApiPanelPage() {
  if (!isPanelEnabled()) notFound();

  const apiBaseUrl = normalize(
    process.env.NEXT_PUBLIC_LARAVEL_APP_URL ||
      process.env.LARAVEL_APP_URL ||
      "http://127.0.0.1:8000/api/v1"
  );

  const webBaseUrl = normalize(
    process.env.LARAVEL_WEB_URL ||
      process.env.NEXT_PUBLIC_LARAVEL_WEB_URL ||
      apiBaseUrl.replace(/\/api\/v\d+$/i, "").replace(/\/api$/i, "")
  );

  return (
    <ApiPanelClient
      endpoints={API_ENDPOINTS}
      apiBaseUrl={apiBaseUrl}
      webBaseUrl={webBaseUrl}
      production={process.env.NODE_ENV === "production"}
    />
  );
}
