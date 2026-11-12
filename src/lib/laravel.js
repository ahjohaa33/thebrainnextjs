/**
 * Server-only Laravel transport. All public JSON requests pass through here.
 * - Timeout is per attempt (including redirects).
 * - Retries are GET/HEAD only: never replay cart mutations or checkout orders.
 * - A bounded, process-local last-good cache is solely a failure fallback;
 *   durable ISR is handled by Next's tagged fetch cache.
 * - X-Cache is the TRANSPORT memory cache state, not the CDN cache status.
 */
import 'server-only';
import pLimit from 'p-limit';

const TIMEOUT_MS = 4000;
const RETRIES = 2;
const MAX_ENTRIES = 250;
const MAX_BODY_BYTES = 1024 * 1024;
const DEFAULT_STALE_MS = 24 * 60 * 60 * 1000;
const requestedLimit = Number(process.env.LARAVEL_CONCURRENCY || 12);
const limit = pLimit(Number.isInteger(requestedLimit) && requestedLimit > 0 ? Math.min(requestedLimit, 64) : 12);
const inflight = new Map();
const lastGood = new Map();
const breakers = new Map();
let total429 = 0;

function log(event) {
  console.info('[laravel]', JSON.stringify(event));
}

function cacheKey(url, options) {
  const h = new Headers(options.headers);
  // Request-header variations can change the response representation.
  return `${options.method || 'GET'}|${url}|${h.get('accept') || ''}|${h.get('accept-language') || ''}`;
}

function stateFor(url) {
  const origin = new URL(url).origin;
  if (!breakers.has(origin)) breakers.set(origin, { failures: 0, openUntil: 0, halfOpen: false });
  return breakers.get(origin);
}

function retryDelay(header, attempt) {
  if (header) {
    let ms = /^\d+(?:\.\d+)?$/.test(header.trim())
      ? Number(header) * 1000 : Date.parse(header) - Date.now();
    if (Number.isFinite(ms) && ms >= 0) return Math.min(ms, 8000);
  }
  return Math.min(1500, 180 * (2 ** attempt) + Math.floor(Math.random() * 250));
}

function saveGood(key, response, tags = []) {
  const size = Number(response.headers.get('content-length') || 0);
  if (size > MAX_BODY_BYTES || response.headers.has('set-cookie')) return;
  // Clone so callers still own the original body; never buffer CSV/feed streams.
  response.clone().arrayBuffer().then((body) => {
    if (body.byteLength > MAX_BODY_BYTES) return;
    lastGood.delete(key);
    lastGood.set(key, {
      body: Buffer.from(body), status: response.status,
      contentType: response.headers.get('content-type') || 'application/json',
      savedAt: Date.now(), tags,
    });
    while (lastGood.size > MAX_ENTRIES) lastGood.delete(lastGood.keys().next().value);
  }).catch(() => {});
}

function storedResponse(entry, cacheState) {
  return new Response(entry.body, {
    status: entry.status,
    headers: { 'content-type': entry.contentType, 'x-cache': cacheState },
  });
}

export function invalidateLaravelCache(tags = [], paths = []) {
  const values = new Set(tags.map(String));
  const urls = paths.map(String);
  for (const [key, entry] of lastGood) {
    if (entry.tags.some((tag) => values.has(tag)) ||
      urls.some((path) => path === '/' || key.includes(path))) lastGood.delete(key);
  }
}

/**
 * @param {string|URL} url absolute Laravel URL
 * @param {RequestInit & {next?: object}} options native fetch options
 * @param {{public?: boolean, memoryTtl?: number, staleMaxAge?: number, stream?: boolean, timeoutMs?: number}} policy
 */
export async function laravelFetch(url, options = {}, policy = {}) {
  const target = String(url);
  const method = String(options.method || 'GET').toUpperCase();
  const safe = method === 'GET' || method === 'HEAD';
  const headers = new Headers(options.headers || {});
  const isPublic = safe && policy.public !== false && !headers.has('cookie') &&
    !headers.has('authorization') && !headers.has('x-cart-token');
  const memoryTtl = isPublic ? Math.max(0, Math.min(Number(policy.memoryTtl || 0), 120)) * 1000 : 0;
  const key = cacheKey(target, { method, headers });
  const previous = isPublic ? lastGood.get(key) : null;
  const now = Date.now();
  if (previous && memoryTtl && now - previous.savedAt <= memoryTtl) {
    log({ method, endpoint: new URL(target).pathname, cache: 'HIT', latencyMs: 0, status: 200 });
    return storedResponse(previous, 'HIT');
  }
  const tags = Array.isArray(options.next?.tags) ? options.next.tags : [];
  const eligibleForFlight = isPublic && !policy.stream && !options.signal;
  if (eligibleForFlight && inflight.has(key)) return (await inflight.get(key)).clone();

  const job = limit(async () => {
    const breaker = stateFor(target);
    const start = Date.now();
    if (isPublic && (breaker.openUntil > start || breaker.halfOpen)) {
      if (previous && start - previous.savedAt <= (policy.staleMaxAge ?? DEFAULT_STALE_MS)) {
        log({ method, endpoint: new URL(target).pathname, cache: 'STALE', status: 503, circuit: 'OPEN' });
        return storedResponse(previous, 'STALE');
      }
      return new Response('Laravel temporarily unavailable', { status: 503, headers: { 'x-cache': 'MISS' } });
    }
    if (isPublic && breaker.openUntil && breaker.openUntil <= start) breaker.halfOpen = true;

    let response;
    let failure;
    for (let attempt = 0; attempt <= (safe ? RETRIES : 0); attempt++) {
      const controller = new AbortController();
      const abort = () => controller.abort();
      options.signal?.addEventListener('abort', abort, { once: true });
      if (options.signal?.aborted) controller.abort();
      const timer = setTimeout(() => controller.abort(), policy.timeoutMs || TIMEOUT_MS);
      const started = Date.now();
      try {
        const upstream = await fetch(target, { ...options, method, headers, signal: controller.signal });
        // Keep the timeout active through the JSON body read. Streaming feeds
        // are deliberately excluded so multi-megabyte CSV files stay streamed.
        if (!policy.stream && method !== 'HEAD' && ![204, 205, 304].includes(upstream.status)) {
          const payload = await upstream.arrayBuffer();
          response = new Response(payload, {
            status: upstream.status, statusText: upstream.statusText,
            headers: upstream.headers,
          });
        } else {
          response = upstream;
        }
        const latencyMs = Date.now() - started;
        log({ method, endpoint: new URL(target).pathname, status: response.status,
          latencyMs, cache: 'MISS', attempt, ...(response.status === 429 ? { rateLimited: 1 } : {}) });
        if (response.status === 429) {
          total429++;
          console.warn('[laravel] ' + JSON.stringify({ endpoint: new URL(target).pathname, upstream429Total: total429 }));
        }
        if (response.ok || ![429, 502, 503, 504].includes(response.status) || !safe || attempt === RETRIES) break;
        const delay = retryDelay(response.headers.get('retry-after'), attempt);
        await response.body?.cancel().catch(() => {});
        await new Promise((resolve) => setTimeout(resolve, delay));
      } catch (error) {
        failure = error;
        log({ method, endpoint: new URL(target).pathname, error: error.message,
          latencyMs: Date.now() - started, cache: 'MISS', attempt });
        if (!safe || options.signal?.aborted || attempt === RETRIES) break;
        await new Promise((resolve) => setTimeout(resolve, retryDelay(null, attempt)));
      } finally {
        clearTimeout(timer);
        options.signal?.removeEventListener('abort', abort);
      }
    }

    const failed = !response || [429, 502, 503, 504].includes(response.status);
    if (failed && isPublic) {
      breaker.failures++;
      if (breaker.failures >= 5) breaker.openUntil = Date.now() + 15000;
    } else if (isPublic) {
      breaker.failures = 0;
      breaker.openUntil = 0;
    }
    if (isPublic) breaker.halfOpen = false;

    if (failed && previous && Date.now() - previous.savedAt <= (policy.staleMaxAge ?? DEFAULT_STALE_MS)) {
      if (response) await response.body?.cancel().catch(() => {});
      log({ method, endpoint: new URL(target).pathname, cache: 'STALE', latencyMs: Date.now() - start });
      return storedResponse(previous, 'STALE');
    }
    if (!response) throw failure || new Error('Laravel request failed');
    if (response.ok && isPublic && !policy.stream) saveGood(key, response, tags);
    // Leave upstream headers intact (including validators); add diagnostics.
    const outHeaders = new Headers(response.headers);
    outHeaders.set('x-cache', 'MISS');
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers: outHeaders });
  });

  if (eligibleForFlight) inflight.set(key, job);
  try {
    const result = await job;
    return eligibleForFlight ? result.clone() : result;
  } finally {
    if (eligibleForFlight && inflight.get(key) === job) inflight.delete(key);
  }
}
