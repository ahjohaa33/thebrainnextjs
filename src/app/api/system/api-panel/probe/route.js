import { NextResponse } from "next/server";
import { getApiEndpoint, fillEndpointPath } from "@/lib/api-catalog";
import { resolveLaravelWebOrigin } from "@/lib/backend-feeds";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isPanelEnabled() {
  return (
    process.env.NODE_ENV !== "production" ||
    String(process.env.API_PANEL_ENABLED || "").toLowerCase() === "true"
  );
}

function apiBase() {
  return String(
    process.env.NEXT_PUBLIC_LARAVEL_APP_URL ||
      process.env.LARAVEL_APP_URL ||
      "http://127.0.0.1:8000/api/v1"
  ).replace(/\/+$/, "");
}

function queryAllowed(endpoint, key) {
  const allowed = endpoint.query || [];
  if (allowed.includes(key)) return true;
  if (allowed.includes("filters[*]") && /^filters\[[^\]]+\]$/.test(key)) return true;
  return false;
}

function missingRequiredPath(endpoint, pathParams) {
  return (endpoint.pathParams || []).some(
    (key) => !String(pathParams?.[key] || "").trim()
  );
}

function truncateText(value, max = 180000) {
  const text = String(value || "");
  return text.length > max ? `${text.slice(0, max)}\n…[truncated by API panel]` : text;
}

export async function POST(request) {
  if (!isPanelEnabled()) {
    return NextResponse.json({ ok: false, error: "API panel disabled." }, { status: 404 });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  const endpoint = getApiEndpoint(payload?.endpointId);
  if (!endpoint || endpoint.method !== "GET" || !endpoint.safeProbe) {
    return NextResponse.json({ ok: false, error: "Endpoint is not eligible for a read-only probe." }, { status: 400 });
  }

  if (!["laravel-api", "laravel-web"].includes(endpoint.layer)) {
    return NextResponse.json({ ok: false, error: "Unsupported probe layer." }, { status: 400 });
  }

  if (missingRequiredPath(endpoint, payload?.pathParams)) {
    return NextResponse.json({ ok: false, error: "Missing required path parameter." }, { status: 400 });
  }

  const resolvedPath = fillEndpointPath(endpoint, payload?.pathParams || {});
  const base = endpoint.layer === "laravel-api" ? apiBase() : resolveLaravelWebOrigin(request);
  const target = new URL(`${String(base).replace(/\/+$/, "")}/${resolvedPath.replace(/^\/+/, "")}`);

  Object.entries(payload?.query || {}).forEach(([key, value]) => {
    if (!queryAllowed(endpoint, key)) return;
    if (value === null || value === undefined || String(value).trim() === "") return;
    target.searchParams.set(key, String(value).trim());
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  try {
    const upstream = await fetch(target, {
      method: "GET",
      headers: { Accept: "application/json, application/xml, text/plain, text/csv;q=0.9, */*;q=0.8" },
      cache: "no-store",
      signal: controller.signal,
    });
    const contentType = upstream.headers.get("content-type") || "";
    const raw = truncateText(await upstream.text());
    let body = raw;
    if (/application\/json/i.test(contentType)) {
      try { body = JSON.parse(raw); } catch { body = raw; }
    }

    return NextResponse.json({
      ok: upstream.ok,
      upstreamStatus: upstream.status,
      contentType,
      target: target.toString(),
      body,
    }, { status: upstream.ok ? 200 : 502, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const aborted = error?.name === "AbortError";
    return NextResponse.json({
      ok: false,
      error: aborted ? "Probe timed out after 10 seconds." : (error?.message || "Unable to reach upstream."),
      target: target.toString(),
    }, { status: 502, headers: { "Cache-Control": "no-store" } });
  } finally {
    clearTimeout(timer);
  }
}
