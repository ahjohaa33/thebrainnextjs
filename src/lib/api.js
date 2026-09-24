// src/lib/api.js

const RAW_LARAVEL_BASE_URL =
  process.env.NEXT_PUBLIC_LARAVEL_APP_URL || "http://127.0.0.1:8000/api/v1/";

export const API_BASE_URL = RAW_LARAVEL_BASE_URL.replace(/\/+$/, "");

// Browser-safe same-origin proxy for cart APIs.
// This avoids browser CORS/preflight problems because the browser calls Next.js first,
// then Next.js calls Laravel server-to-server.
const CART_PROXY_BASE_URL = "/api/cart-proxy";

export function getCartToken() {
  if (typeof window === "undefined") return "";

  let token = localStorage.getItem("ponnobd_cart_token");

  if (!token) {
    token =
      "cart_" +
      Date.now().toString(36) +
      "_" +
      Math.random().toString(36).slice(2, 12);

    localStorage.setItem("ponnobd_cart_token", token);
  }

  return token;
}

export async function apiRequest(path, options = {}) {
  const token = getCartToken();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${CART_PROXY_BASE_URL}${normalizedPath}`;

  const headers = {
    Accept: "application/json",
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(token ? { "X-Cart-Token": token } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
    cache: "no-store",
    credentials: "include",
  });

  let data = null;

  try {
    data = await response.json();
  } catch (error) {
    data = null;
  }

  if (!response.ok) {
    const message =
      data?.message ||
      data?.error ||
      (typeof data === "string" ? data : "") ||
      `Request failed with status ${response.status}. Please try again.`;

    const error = new Error(message);
    error.status = response.status;
    error.payload = data;
    throw error;
  }

  return data;
}
