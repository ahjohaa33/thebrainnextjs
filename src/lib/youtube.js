/**
 * Fallback video sourcing for the homepage media sections.
 *
 * When the admin hasn't configured any `video_sections` in the backend
 * yet (see page.jsx), instead of showing an empty section or a single
 * hardcoded playlist, we pull a random 10-15 video sample straight from
 * the Ponnobd YouTube channel: https://www.youtube.com/@PonnobdElectronics
 *
 * Production/caching notes:
 * - Every network call below goes through `fetch(..., { next: { revalidate } })`,
 *   which plugs into Next.js's Data Cache. That means the *first* request
 *   after the cache window expires pays the YouTube API round trip, and
 *   every other request/user within that window is served the cached
 *   result instantly — no per-request latency, no per-user API quota cost.
 * - The uploads-playlist ID (resolved from the channel's @handle) almost
 *   never changes, so on top of the Data Cache we keep it in a
 *   module-level variable to skip even the cached-fetch overhead for the
 *   life of the server process/lambda instance.
 * - Every external call has an explicit timeout and is wrapped in
 *   try/catch. Nothing here ever throws out to the caller — any failure
 *   (missing/invalid API key, quota exceeded, YouTube outage, slow
 *   response) just resolves to an empty array so page.jsx can drop back
 *   to the last-resort hardcoded playlist fallback. The homepage must
 *   never hang or 500 because of this.
 */

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";
const CHANNEL_HANDLE = "PonnobdElectronics"; // youtube.com/@PonnobdElectronics

// How many of the channel's most recent uploads we pull into the pool
// we then randomly sample from. 50 is the max playlistItems.list allows
// per page/request, which keeps this to a single API call.
const UPLOADS_POOL_SIZE = 50;

const FALLBACK_VIDEO_COUNT_MIN = 10;
const FALLBACK_VIDEO_COUNT_MAX = 15;

// Fallback videos don't need to be fresh-to-the-second, so we cache
// aggressively. This is the main lever for both "how fast does this
// serve" (always instant, except once per window) and "how much API
// quota does this cost" (near-zero, regardless of traffic).
const CACHE_REVALIDATE_SECONDS = 60 * 60 * 6; // 6 hours

// How long we'll wait on a single YouTube API call before giving up and
// falling back further. Keeps a slow/hanging YouTube response from ever
// blocking page render.
const FETCH_TIMEOUT_MS = 5000;

// In-memory cache for the resolved uploads playlist ID, scoped to the
// lifetime of the server process. Cheap, and avoids re-resolving the
// handle -> playlist ID mapping on every cache-miss.
let cachedUploadsPlaylistId = null;

function timeoutSignal() {
  // AbortSignal.timeout is available in the Node/Next runtime used for
  // Server Components; falls back to no signal if unavailable.
  return typeof AbortSignal !== "undefined" && AbortSignal.timeout
    ? AbortSignal.timeout(FETCH_TIMEOUT_MS)
    : undefined;
}

/**
 * Resolves the channel's "uploads" playlist ID from its @handle.
 */
async function getUploadsPlaylistId(apiKey) {
  if (cachedUploadsPlaylistId) return cachedUploadsPlaylistId;

  const url = new URL(`${YOUTUBE_API_BASE}/channels`);
  url.searchParams.set("part", "contentDetails");
  url.searchParams.set("forHandle", CHANNEL_HANDLE);
  url.searchParams.set("key", apiKey);

  const res = await fetch(url, {
    next: { revalidate: CACHE_REVALIDATE_SECONDS },
    signal: timeoutSignal(),
  });

  if (!res.ok) {
    throw new Error(`YouTube channels.list failed: ${res.status}`);
  }

  const data = await res.json();
  const uploadsPlaylistId =
    data?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;

  if (!uploadsPlaylistId) {
    throw new Error(
      `YouTube channel "@${CHANNEL_HANDLE}" has no resolvable uploads playlist`
    );
  }

  cachedUploadsPlaylistId = uploadsPlaylistId;
  return uploadsPlaylistId;
}

/**
 * Fetches (and lets Next.js cache) a pool of the channel's most recent
 * uploads, normalized into the same shape the homepage carousels expect
 * elsewhere (see normalizeVideos() in page.jsx).
 */
async function getUploadsPool(apiKey) {
  const uploadsPlaylistId = await getUploadsPlaylistId(apiKey);

  const url = new URL(`${YOUTUBE_API_BASE}/playlistItems`);
  url.searchParams.set("part", "snippet");
  url.searchParams.set("playlistId", uploadsPlaylistId);
  url.searchParams.set("maxResults", String(UPLOADS_POOL_SIZE));
  url.searchParams.set("key", apiKey);

  const res = await fetch(url, {
    next: { revalidate: CACHE_REVALIDATE_SECONDS },
    signal: timeoutSignal(),
  });

  if (!res.ok) {
    throw new Error(`YouTube playlistItems.list failed: ${res.status}`);
  }

  const data = await res.json();

  return (data?.items || [])
    .map((item) => {
      const videoId = item?.snippet?.resourceId?.videoId;
      // Occasionally a playlist item is a deleted/private video with no
      // resolvable videoId - skip those rather than rendering a dead embed.
      if (!videoId) return null;

      return {
        id: videoId,
        title: item?.snippet?.title || "Ponnobd video",
        embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1`,
        publishedAt: item?.snippet?.publishedAt || "",
        category: "latest",
        categoryLabel: "Latest",
      };
    })
    .filter(Boolean);
}

function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function randomSampleSize(poolSize) {
  const target =
    FALLBACK_VIDEO_COUNT_MIN +
    Math.floor(
      Math.random() * (FALLBACK_VIDEO_COUNT_MAX - FALLBACK_VIDEO_COUNT_MIN + 1)
    );
  return Math.min(target, poolSize);
}

/**
 * Public entry point used by page.jsx.
 *
 * Returns a random sample of 10-15 videos from the channel's cached
 * uploads pool, or an empty array if the API key isn't configured or
 * anything about the fetch fails - callers should treat an empty array
 * as "fall back further" (e.g. to a hardcoded playlist), never as an error.
 */
export async function getFallbackChannelVideos() {
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[youtube] YOUTUBE_API_KEY is not set - skipping channel video fallback."
      );
    }
    return [];
  }

  try {
    const pool = await getUploadsPool(apiKey);
    if (pool.length === 0) return [];

    return shuffle(pool).slice(0, randomSampleSize(pool.length));
  } catch (error) {
    console.error("[youtube] Failed to fetch fallback channel videos:", error);
    return [];
  }
}