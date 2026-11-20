/**
 * Server-only Laravel transport. All public JSON requests pass through here.
 * - Timeout is per attempt (including redirects).
 * - Retries are GET/HEAD only: never replay cart mutations or checkout orders.
 * - A bounded, process-local last-good cache is solely a failure fallback;
 *   durable ISR is handled by Next's tagged fetch cache.
 * - X-Cache is the TRANSPORT memory cache state, not the CDN cache status.
 */
import 'server-only';

const TIMEOUT_MS = 4000;
const RETRIES = 2;
const MAX_ENTRIES = 250;
const MAX_BODY_BYTES = 1024 * 1024;
const DEFAULT_STALE_MS = 24 * 60 * 60 * 1000;
const MAX_CONCURRENCY = 64;
const DEFAULT_CONCURRENCY = 2;
const configuredConcurrency =
  process.env.UPSTREAM_MAX_CONCURRENT_REQUESTS ??
  process.env.LARAVEL_MAX_CONCURRENT_REQUESTS ??
  process.env.LARAVEL_CONCURRENCY;
const parsedConcurrency = configuredConcurrency === undefined || configuredConcurrency.trim() === ''
  ? DEFAULT_CONCURRENCY
  : Number(configuredConcurrency);
const UPSTREAM_CONCURRENCY = Number.isInteger(parsedConcurrency) &&
  parsedConcurrency >= 1 && parsedConcurrency <= MAX_CONCURRENCY
  ? parsedConcurrency
  : DEFAULT_CONCURRENCY;
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

// A process-local FIFO semaphore shared by every laravelFetch caller. Unlike
// a simple p-limit wrapper, permits can be transferred to a streaming response
// and released only when that response body completes or is cancelled.
let activeRequests = 0;
const permitQueue = [];

function abortError() {
  const error = new Error('The operation was aborted.');
  error.name = 'AbortError';
  return error;
}

function grantPermit(waiter) {
  if (waiter.signal && waiter.onAbort) {
    waiter.signal.removeEventListener('abort', waiter.onAbort);
  }
  activeRequests++;
  let released = false;
  waiter.resolve(() => {
    if (released) return;
    released = true;
    activeRequests = Math.max(0, activeRequests - 1);
    drainPermitQueue();
  });
}

function drainPermitQueue() {
  while (activeRequests < UPSTREAM_CONCURRENCY && permitQueue.length > 0) {
    const waiter = permitQueue.shift();
    if (waiter.signal?.aborted) {
      if (waiter.signal && waiter.onAbort) {
        waiter.signal.removeEventListener('abort', waiter.onAbort);
      }
      waiter.reject(abortError());
      continue;
    }
    grantPermit(waiter);
  }
}

function acquirePermit(signal) {
  if (signal?.aborted) return Promise.reject(abortError());

  return new Promise((resolve, reject) => {
    const waiter = { resolve, reject, signal, onAbort: null };
    if (activeRequests < UPSTREAM_CONCURRENCY && permitQueue.length === 0) {
      grantPermit(waiter);
      return;
    }

    if (signal) {
      waiter.onAbort = () => {
        const index = permitQueue.indexOf(waiter);
        if (index !== -1) permitQueue.splice(index, 1);
        signal.removeEventListener('abort', waiter.onAbort);
        reject(abortError());
      };
      signal.addEventListener('abort', waiter.onAbort, { once: true });
    }
    permitQueue.push(waiter);
  });
}

function holdPermitUntilBodyEnds(body, releasePermit) {
  if (!body) return null;

  const reader = body.getReader();
  let released = false;
  const releaseOnce = () => {
    if (released) return;
    released = true;
    try {
      reader.releaseLock();
    } catch {
      // The reader may already have been released during stream teardown.
    }
    releasePermit();
  };

  return new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          releaseOnce();
        } else {
          controller.enqueue(value);
        }
      } catch (error) {
        controller.error(error);
        releaseOnce();
      }
    },
    async cancel(reason) {
      try {
        await reader.cancel(reason);
      } finally {
        releaseOnce();
      }
    },
  });
}
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

  const job = (async () => {
    const releasePermit = await acquirePermit(options.signal);
    let permitTransferredToStream = false;
    try {
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
          if (response.ok || !RETRYABLE_STATUSES.has(response.status) || !safe || attempt === RETRIES) break;
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

      const failed = !response || RETRYABLE_STATUSES.has(response.status);
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
      const responseBody = policy.stream
        ? holdPermitUntilBodyEnds(response.body, releasePermit)
        : response.body;
      const outgoingResponse = new Response(responseBody, {
        status: response.status,
        statusText: response.statusText,
        headers: outHeaders,
      });
      if (policy.stream && response.body) permitTransferredToStream = true;
      return outgoingResponse;
    } finally {
      if (!permitTransferredToStream) releasePermit();
    }
  })();

  if (eligibleForFlight) inflight.set(key, job);
  try {
    const result = await job;
    return eligibleForFlight ? result.clone() : result;
  } finally {
    if (eligibleForFlight && inflight.get(key) === job) inflight.delete(key);
  }
}
