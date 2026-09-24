// app/api/revalidate/route.js
//
// Cache revalidation webhook.
//
// NOTE: with the new no-cache setup, every page fetch uses
// `cache: "no-store"` and `export const dynamic = "force-dynamic"`. So
// there is nothing in the Next.js Data Cache to invalidate — fresh
// data is loaded on every request automatically.
//
// This endpoint is retained for backward compatibility: if your
// Laravel CMS still POSTs here on content changes, it will succeed
// (200 OK) without doing anything destructive. You can remove the
// webhook from the CMS at your leisure.
//
// Auth: requires REVALIDATE_SECRET env var (header `x-revalidate-secret`
// or `?secret=` query string).

import { revalidatePath, revalidateTag } from "next/cache";

const SECRET = process.env.REVALIDATE_SECRET || "";

function unauthorized(message = "Unauthorized") {
  return Response.json({ ok: false, error: message }, { status: 401 });
}

function getSecretFromRequest(request, urlObject) {
  return (
    request.headers.get("x-revalidate-secret") ||
    urlObject.searchParams.get("secret") ||
    ""
  );
}

function toArray(value) {
  if (value == null || value === "") return [];
  return Array.isArray(value) ? value : [value];
}

async function handle(request) {
  if (!SECRET) {
    return unauthorized("REVALIDATE_SECRET is not configured on the server.");
  }

  const url = new URL(request.url);
  const provided = getSecretFromRequest(request, url);

  if (provided !== SECRET) {
    return unauthorized();
  }

  let body = {};
  if (request.method === "POST") {
    try {
      body = await request.json();
    } catch {
      body = {};
    }
  }

  const tags = [
    ...url.searchParams.getAll("tag"),
    ...toArray(body?.tag),
    ...toArray(body?.tags),
  ].filter(Boolean);

  const paths = [
    ...url.searchParams.getAll("path"),
    ...toArray(body?.path),
    ...toArray(body?.paths),
  ].filter(Boolean);

  // Even though our fetches are no-store, calling these is safe and
  // a no-op for non-existent cache entries. We do the work so CMS
  // webhooks continue to look successful.
  for (const tag of tags) {
    try {
      revalidateTag(String(tag));
    } catch {
      /* no-op */
    }
  }

  for (const path of paths) {
    try {
      revalidatePath(String(path));
    } catch {
      /* no-op */
    }
  }

  return Response.json(
    {
      ok: true,
      revalidated: { tags, paths },
      note:
        "App runs in no-cache mode; this endpoint is a no-op kept for backward compatibility.",
      now: Date.now(),
    },
    { status: 200 }
  );
}

export async function POST(request) {
  return handle(request);
}

export async function GET(request) {
  return handle(request);
}

export const dynamic = "force-dynamic";
