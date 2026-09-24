import { withCacheBust } from "@/lib/image-cache-bust";

export const LARAVEL_BASE_URL = (
  process.env.NEXT_PUBLIC_LARAVEL_APP_URL ||
  process.env.LARAVEL_APP_URL ||
  "http://127.0.0.1:8000"
).replace(/\/+$/, "");

export function apiUrl(path = "") {
  return `${LARAVEL_BASE_URL}/${String(path).replace(/^\/+/, "")}`;
}

export function absoluteUrl(path = "", version) {
  if (!path) return "";
  const resolved = /^https?:\/\//i.test(path) ? path : apiUrl(path);
  // Cache-bust: see lib/image-cache-bust.js for why this exists — it's
  // what stops CMS image replacements from getting stuck behind a stale
  // browser/CDN cache when the filename doesn't change.
  return withCacheBust(resolved, version);
}

/**
 * Sales representative WhatsApp number. Used by:
 *   - the product page "Share on WhatsApp" button (routes the share message
 *     directly to the sales rep, not to a generic contact-picker),
 *   - the site-wide floating WhatsApp button,
 *   - the product page "Order on WhatsApp" CTA and tel: link.
 *
 * SALES_WHATSAPP_E164 is the display form (with `+`); SALES_WHATSAPP_DIGITS
 * is what `wa.me/<number>` expects — digits only, no `+`, no spaces.
 */
export const SALES_WHATSAPP_E164 = "+8801856111313";
export const SALES_WHATSAPP_DIGITS = SALES_WHATSAPP_E164.replace(/\D/g, "");

export function buildWhatsAppUrl(message = "") {
  const base = `https://wa.me/${SALES_WHATSAPP_DIGITS}`;
  if (!message) return base;
  return `${base}?text=${encodeURIComponent(message)}`;
}
