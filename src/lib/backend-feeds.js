// src/lib/backend-feeds.js
//
// Unified same-origin proxy for public Laravel-generated files:
//
// - sitemap XML files
// - robots.txt
// - /uploads/meta/catalog.csv
//
// Supported call signatures:
//
//   fetchFeed(request, "/sitemap.xml", "application/xml; charset=utf-8")
//
//   fetchFeed("/uploads/meta/catalog.csv", "text/csv; charset=utf-8")
//
// Both signatures are intentionally supported so existing sitemap, robots,
// and catalog route handlers continue working without modification.
//
// Large feeds are fetched with `cache: "no-store"` and streamed directly.
// This avoids Next.js Data Cache's per-entry size limitation while allowing
// browsers and CDNs to cache the final public response through Cache-Control.

const DEFAULT_LARAVEL_WEB_ORIGIN = "https://backend.ponnobd.com";
const FEED_TIMEOUT_MS = 30_000;

const PUBLIC_FEED_CACHE =
  "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400";

const FALLBACK_BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/150.0.0.0 Safari/537.36";

/**
 * Convert a configured URL such as:
 *
 *   https://backend.ponnobd.com/api/v1
 *
 * into:
 *
 *   https://backend.ponnobd.com
 */
function normalizeOrigin(value) {
  if (!value) return "";

  try {
    const url = new URL(String(value).trim());

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "";
    }

    return url.origin;
  } catch {
    return "";
  }
}

function getRequestOrigin(request) {
  try {
    return request?.url ? new URL(request.url).origin : "";
  } catch {
    return "";
  }
}

function safeHeaderValue(value, fallback = "", maxLength = 512) {
  const normalized = String(value || "")
    .replace(/[\r\n\0]/g, "")
    .trim()
    .slice(0, maxLength);

  return normalized || fallback;
}

function isRequestLike(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof value.url === "string" &&
      value.headers &&
      typeof value.headers.get === "function"
  );
}

/**
 * Supports both:
 *
 *   fetchFeed(request, path, contentType)
 *   fetchFeed(path, contentType)
 */
function normalizeFetchFeedArguments(arg1, arg2, arg3) {
  if (isRequestLike(arg1)) {
    return {
      request: arg1,
      path: arg2,
      contentType: arg3,
    };
  }

  return {
    request: null,
    path: arg1,
    contentType: arg2,
  };
}

/**
 * Resolve Laravel's public web origin, not its /api/v1 path.
 *
 * Priority:
 * 1. LARAVEL_WEB_URL
 * 2. NEXT_PUBLIC_LARAVEL_WEB_URL
 * 3. LARAVEL_APP_URL
 * 4. NEXT_PUBLIC_LARAVEL_APP_URL
 * 5. LARAVEL_BASE_URL
 * 6. NEXT_PUBLIC_LARAVEL_BASE_URL
 * 7. Default Ponnobd backend origin
 *
 * Origins matching the incoming Next.js request are skipped to prevent
 * recursive requests such as /sitemap.xml fetching itself.
 */
export function resolveLaravelWebOrigin(request = null) {
  const requestOrigin = getRequestOrigin(request);

  const knownFrontendOrigins = new Set(
    [
      requestOrigin,
      normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL),
      normalizeOrigin(process.env.SITE_URL),
      normalizeOrigin(process.env.APP_URL),
    ].filter(Boolean)
  );

  const candidates = [
    process.env.LARAVEL_WEB_URL,
    process.env.NEXT_PUBLIC_LARAVEL_WEB_URL,
    process.env.LARAVEL_APP_URL,
    process.env.NEXT_PUBLIC_LARAVEL_APP_URL,
    process.env.LARAVEL_BASE_URL,
    process.env.NEXT_PUBLIC_LARAVEL_BASE_URL,
    DEFAULT_LARAVEL_WEB_ORIGIN,
  ];

  for (const candidate of candidates) {
    const origin = normalizeOrigin(candidate);

    if (!origin) continue;
    if (knownFrontendOrigins.has(origin)) continue;

    return origin;
  }

  throw new Error(
    "Laravel web origin is missing or resolves to the Next.js frontend. " +
      "Set LARAVEL_WEB_URL=https://backend.ponnobd.com"
  );
}

function normalizeFeedPath(path) {
  const value = String(path || "").trim();

  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("..") ||
    /%2e/i.test(value) ||
    /[\r\n\0\\]/.test(value)
  ) {
    throw new Error(`Invalid backend feed path: ${value || "(empty)"}`);
  }

  return value;
}

function normalizeContentType(contentType) {
  const value = safeHeaderValue(
    contentType,
    "application/octet-stream",
    200
  );

  // Prevent malformed or injected response headers.
  if (!/^[a-z0-9!#$&^_.+\-]+\/[a-z0-9!#$&^_.+\-]+(?:\s*;.*)?$/i.test(value)) {
    return "application/octet-stream";
  }

  return value;
}

function errorResponse(message, status = 502, upstreamStatus = "") {
  const headers = new Headers({
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });

  if (upstreamStatus) {
    headers.set("X-Feed-Upstream-Status", upstreamStatus);
  }

  return new Response(message, {
    status,
    headers,
  });
}

function getIncomingUserAgent(request) {
  const configured = safeHeaderValue(
    process.env.LARAVEL_FEED_USER_AGENT
  );

  if (configured) {
    return configured;
  }

  return safeHeaderValue(
    request?.headers?.get("user-agent"),
    FALLBACK_BROWSER_USER_AGENT
  );
}

function buildAcceptHeader(request, contentType, retry) {
  if (retry) {
    return [
      "text/html",
      "application/xhtml+xml",
      "application/xml;q=0.9",
      "text/xml;q=0.9",
      "text/csv;q=0.9",
      "text/plain;q=0.8",
      "*/*;q=0.7",
    ].join(",");
  }

  const mimeType = contentType.split(";")[0].trim() || "*/*";

  const incomingAccept = safeHeaderValue(
    request?.headers?.get("accept")
  );

  if (!incomingAccept || incomingAccept === "*/*") {
    return [
      mimeType,
      "application/xml;q=0.9",
      "text/xml;q=0.9",
      "text/csv;q=0.9",
      "text/plain;q=0.8",
      "*/*;q=0.5",
    ].join(",");
  }

  // Always prioritize the expected feed MIME type. This matters when a
  // browser requests a CSV URL with a normal navigation Accept header that
  // primarily advertises HTML.
  return `${mimeType},${incomingAccept}`;
}

function buildUpstreamHeaders(
  request,
  backendOrigin,
  contentType,
  retry = false
) {
  const headers = new Headers({
    Accept: buildAcceptHeader(request, contentType, retry),

    "Accept-Language": safeHeaderValue(
      request?.headers?.get("accept-language"),
      "en-US,en;q=0.9"
    ),

    "User-Agent": retry
      ? FALLBACK_BROWSER_USER_AGENT
      : getIncomingUserAgent(request),

    Referer: `${backendOrigin}/`,
  });

  // Forward conditional validators when the incoming request contains them.
  // This allows Laravel to respond with 304 where supported.
  if (request) {
    const ifNoneMatch = safeHeaderValue(
      request.headers.get("if-none-match")
    );

    const ifModifiedSince = safeHeaderValue(
      request.headers.get("if-modified-since")
    );

    if (ifNoneMatch) {
      headers.set("If-None-Match", ifNoneMatch);
    }

    if (ifModifiedSince) {
      headers.set("If-Modified-Since", ifModifiedSince);
    }
  }

  // Do not manually set Accept-Encoding. Node/undici negotiates and
  // decompresses the upstream response safely.
  //
  // Do not forward cookies or authorization headers. Public sitemaps,
  // robots.txt and catalog feeds should remain publicly accessible.

  return headers;
}

async function requestUpstream({
  request,
  upstreamUrl,
  backendOrigin,
  contentType,
  retry,
}) {
  const controller = new AbortController();

  const timer = setTimeout(() => {
    controller.abort();
  }, FEED_TIMEOUT_MS);

  try {
    return await fetch(upstreamUrl, {
      method: "GET",
      signal: controller.signal,

      // Important for catalog.csv:
      // do not use Next.js Data Cache or next: { revalidate }.
      cache: "no-store",

      redirect: "follow",

      headers: buildUpstreamHeaders(
        request,
        backendOrigin,
        contentType,
        retry
      ),
    });
  } finally {
    clearTimeout(timer);
  }
}

async function safelyCancelBody(response) {
  if (!response?.body) return;

  try {
    await response.body.cancel();
  } catch {
    // Cancellation is best-effort only.
  }
}

/**
 * Fetch a Laravel public file and stream it through Next.js.
 *
 * Supported signatures:
 *
 *   fetchFeed(request, path, contentType)
 *   fetchFeed(path, contentType)
 *
 * @param {Request|string} arg1 Request object or feed path
 * @param {string} arg2 Feed path or response content type
 * @param {string} [arg3] Response content type
 */
export async function fetchFeed(arg1, arg2, arg3) {
  const {
    request,
    path,
    contentType: requestedContentType,
  } = normalizeFetchFeedArguments(arg1, arg2, arg3);

  let backendOrigin;
  let feedPath;
  let contentType;
  let upstreamUrl;

  try {
    feedPath = normalizeFeedPath(path);
    contentType = normalizeContentType(requestedContentType);
    backendOrigin = resolveLaravelWebOrigin(request);
    upstreamUrl = `${backendOrigin}${feedPath}`;
  } catch (error) {
    console.error(
      "[backend-feeds] configuration error:",
      error
    );

    return errorResponse(
      "Feed proxy is not configured correctly.",
      500
    );
  }

  let upstream;

  try {
    upstream = await requestUpstream({
      request,
      upstreamUrl,
      backendOrigin,
      contentType,
      retry: false,
    });

    // Some Apache, Laravel middleware, hosting-security systems, or anti-bot
    // rules reject server-side requests based on User-Agent or Accept headers.
    // Retry one time using a conventional browser request identity.
    if (upstream.status === 403) {
      await safelyCancelBody(upstream);

      upstream = await requestUpstream({
        request,
        upstreamUrl,
        backendOrigin,
        contentType,
        retry: true,
      });
    }
  } catch (error) {
    const reason =
      error?.name === "AbortError"
        ? `timed out after ${FEED_TIMEOUT_MS / 1000}s`
        : error?.message || "unknown network error";

    console.error(
      `[backend-feeds] request failed: ${upstreamUrl} (${reason})`
    );

    return errorResponse("Feed temporarily unavailable.");
  }

  // A 304 response has no body and must not be handled as an error.
  if (upstream.status === 304) {
    const headers = new Headers({
      "Cache-Control": PUBLIC_FEED_CACHE,
      "X-Content-Type-Options": "nosniff",
    });

    const etag = upstream.headers.get("etag");
    const lastModified = upstream.headers.get("last-modified");

    if (etag) {
      headers.set("ETag", etag);
    }

    if (lastModified) {
      headers.set("Last-Modified", lastModified);
    }

    return new Response(null, {
      status: 304,
      headers,
    });
  }

  if (!upstream.ok) {
    const preview = await upstream.text().catch(() => "");

    console.error(
      `[backend-feeds] upstream returned ${upstream.status}: ${upstreamUrl}`,
      preview.slice(0, 500)
    );

    // Preserve genuine missing-resource statuses.
    // Convert authentication, blocking, and server failures to 502 because
    // the public frontend route itself is available.
    const status = [404, 410].includes(upstream.status)
      ? upstream.status
      : 502;

    return errorResponse(
      `Feed unavailable (upstream ${upstream.status}).`,
      status,
      String(upstream.status)
    );
  }

  const headers = new Headers({
    "Content-Type": contentType,
    "Cache-Control": PUBLIC_FEED_CACHE,
    "X-Content-Type-Options": "nosniff",
  });

  // Preserve safe cache validators.
  const etag = upstream.headers.get("etag");
  const lastModified = upstream.headers.get("last-modified");

  if (etag) {
    headers.set("ETag", etag);
  }

  if (lastModified) {
    headers.set("Last-Modified", lastModified);
  }

  // Preserve download filename when Laravel explicitly supplies one.
  const contentDisposition = upstream.headers.get(
    "content-disposition"
  );

  if (contentDisposition) {
    headers.set("Content-Disposition", contentDisposition);
  }

  // Stream XML, text, or multi-megabyte CSV directly to the client.
  // Do not call upstream.text(), upstream.arrayBuffer(), or upstream.json().
  return new Response(upstream.body, {
    status: 200,
    headers,
  });
}