import { LARAVEL_BASE_URL } from "./config";

/** Resolve catalog image paths against Laravel's web origin. */
export function shopAssetUrl(value, baseUrl = LARAVEL_BASE_URL) {
  const path =
    typeof value === "string"
      ? value
      : value && typeof value === "object"
        ? value.url ?? value.src ?? value.path ?? value.image ?? ""
        : "";
  if (typeof path !== "string" || !path.trim()) return "";

  const raw = path.trim();
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("//")) return `https:${raw}`;

  const origin = typeof baseUrl === "string" && baseUrl ? baseUrl : LARAVEL_BASE_URL;
  try {
    return new URL(raw.replace(/^\/+/, ""), `${new URL(origin).origin}/`).href;
  } catch {
    return raw;
  }
}
