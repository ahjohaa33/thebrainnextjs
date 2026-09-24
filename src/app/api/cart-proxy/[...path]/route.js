import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const RAW_LARAVEL_BASE_URL =
  process.env.NEXT_PUBLIC_LARAVEL_APP_URL ||
  process.env.LARAVEL_APP_URL ||
  "http://127.0.0.1:8000/api/v1/";

// Strip trailing slashes once. The value may be:
//   "http://127.0.0.1:8000/api/v1/"  → "http://127.0.0.1:8000/api/v1"
//   "http://127.0.0.1:8000/api/v1"   → "http://127.0.0.1:8000/api/v1"
//   "http://127.0.0.1:8000"           → "http://127.0.0.1:8000"
// All three are handled correctly below.
const LARAVEL_API_BASE_URL = RAW_LARAVEL_BASE_URL.replace(/\/+$/, "");

const GUEST_COOKIE_NAME = process.env.GUEST_COOKIE_NAME || "guest_id";

// Pre-computed base used for the containment check in buildLaravelUrl.
const LARAVEL_BASE_FOR_CHECK = new URL(`${LARAVEL_API_BASE_URL}/`);

// VULN-009 (CWE-22) / VULN-010 (CWE-918): a single catch-all path segment is
// only safe if it cannot be used to climb out of the cart API base or smuggle
// separators/control bytes into the upstream URL.
function isSafeSegment(seg) {
  if (typeof seg !== "string") return false;
  if (seg === "." || seg === "..") return false;
  if (/[\\/\x00-\x1f]/.test(seg)) return false; // separators / control chars
  if (/(?:%2e){2}|\.\./i.test(seg)) return false; // encoded or literal traversal
  return true;
}

function buildLaravelUrl(request, params = {}) {
  // Drop empty segments (stray slashes) before validation.
  const segments = (Array.isArray(params.path) ? params.path : []).filter(
    (s) => s !== ""
  );

  // Reject traversal before the segments are joined into the upstream URL.
  if (!segments.every(isSafeSegment)) return null;

  const pathSegments = segments.join("/");
  const incomingUrl = new URL(request.url);

  // KEY FIX: join with "/" then collapse any accidental double-slashes
  // in the path portion (the regex skips "://" so the protocol is safe).
  const raw = `${LARAVEL_API_BASE_URL}/${pathSegments}`;

  let targetUrl;
  try {
    targetUrl = new URL(raw.replace(/([^:])\/\/+/g, "$1/"));
  } catch {
    return null;
  }

  // Canonicalised containment check: the resolved URL must stay on the
  // configured Laravel origin AND under its API base path. This blocks any
  // attempt to reach another host or an endpoint outside the cart API.
  if (
    targetUrl.origin !== LARAVEL_BASE_FOR_CHECK.origin ||
    !targetUrl.pathname.startsWith(LARAVEL_BASE_FOR_CHECK.pathname)
  ) {
    return null;
  }

  incomingUrl.searchParams.forEach((value, key) => {
    targetUrl.searchParams.append(key, value);
  });

  return targetUrl.toString();
}

async function proxyCartRequest(request, context) {
  const params = await context.params;
  const method = request.method.toUpperCase();
  const targetUrl = buildLaravelUrl(request, params);

  // Rejected by the traversal / containment guard in buildLaravelUrl.
  if (!targetUrl) {
    return NextResponse.json(
      { message: "Invalid request path." },
      { status: 400 }
    );
  }

  const cartToken = request.headers.get("x-cart-token") || "";

  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();

  const cookieParts = allCookies
    .filter((c) => c.name !== GUEST_COOKIE_NAME)
    .map((c) => `${c.name}=${c.value}`);

  if (cartToken) {
    cookieParts.push(`${GUEST_COOKIE_NAME}=${cartToken}`);
  }

  const cookieHeader = cookieParts.join("; ");

  const headers = new Headers();
  const accept = request.headers.get("accept");
  const contentType = request.headers.get("content-type");
  const authorization = request.headers.get("authorization");

  headers.set("Accept", accept || "application/json");
  if (contentType) headers.set("Content-Type", contentType);
  if (authorization) headers.set("Authorization", authorization);
  if (cartToken) headers.set("X-Cart-Token", cartToken);
  if (cookieHeader) headers.set("Cookie", cookieHeader);

  const init = {
    method,
    headers,
    cache: "no-store",
    credentials: "include",
  };

  if (!["GET", "HEAD"].includes(method)) {
    const body = await request.text();
    if (body) init.body = body;
  }

  try {
    const laravelResponse = await fetch(targetUrl, init);
    const responseText = await laravelResponse.text();

    const responseHeaders = new Headers();
    const contentTypeRes = laravelResponse.headers.get("content-type");
    responseHeaders.set("Cache-Control", "no-store");
    responseHeaders.set("Content-Type", contentTypeRes || "application/json");

    laravelResponse.headers.forEach((value, key) => {
      if (key.toLowerCase() === "set-cookie") {
        responseHeaders.append("Set-Cookie", value);
      }
    });

    return new NextResponse(responseText, {
      status: laravelResponse.status,
      headers: responseHeaders,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: "Cart API proxy failed.",
        error: error?.message || "Unable to connect to Laravel API.",
        debug_target_url:
          process.env.NODE_ENV === "development" ? targetUrl : undefined,
      },
      { status: 502 }
    );
  }
}

export async function GET(request, context) {
  return proxyCartRequest(request, context);
}

export async function POST(request, context) {
  return proxyCartRequest(request, context);
}

export async function PATCH(request, context) {
  return proxyCartRequest(request, context);
}

export async function PUT(request, context) {
  return proxyCartRequest(request, context);
}

export async function DELETE(request, context) {
  return proxyCartRequest(request, context);
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}