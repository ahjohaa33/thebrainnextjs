import { timingSafeEqual } from 'node:crypto';
import { revalidatePath, revalidateTag } from 'next/cache';
import { invalidateLaravelCache } from '@/lib/laravel';

export const dynamic = 'force-dynamic';
const SECRET = process.env.REVALIDATE_SECRET || '';
const NO_STORE = { 'Cache-Control': 'no-store' };

function authorized(secret) {
  if (!SECRET || !secret) return false;
  const a = Buffer.from(secret);
  const b = Buffer.from(SECRET);
  return a.length === b.length && timingSafeEqual(a, b);
}
function entries(value) {
  return (Array.isArray(value) ? value : value ? [value] : []).map(String);
}
function validTag(value) {
  return value.length <= 256 && /^[a-z0-9:_-]+$/i.test(value);
}
function validPath(value) {
  return value.length <= 400 && value.startsWith('/') && !value.startsWith('//') &&
    !value.includes('?') && !value.includes('#') && !value.includes('..') &&
    !/[^\x20-\x7e]/.test(value);
}

function eventTargets(body) {
  const tags = [];
  const paths = [];
  const resource = String(body.resource || body.type || '').toLowerCase();
  const slugs = [...entries(body.slug), ...entries(body.old_slug), ...entries(body.oldSlug)]
    .map((slug) => slug.trim().toLowerCase()).filter((slug) => /^[a-z0-9_-]{1,180}$/.test(slug));
  const slugTag = (prefix) => slugs.forEach((slug) => {
    tags.push(`${prefix}:${slug}`);
    paths.push(`${prefix === 'blog' ? '/blog/' : '/'}${slug}`);
  });
  switch (resource) {
    case 'product':
    case 'category':
      tags.push('product', 'category', 'shop', 'home', 'seo-feeds');
      slugTag('slug');
      paths.push('/', '/shop');
      break;
    case 'blog':
      tags.push('blog', 'seo-feeds');
      slugTag('blog');
      paths.push('/blog');
      break;
    case 'menu':
    case 'site':
      tags.push('home', 'site', 'site-header', 'header-menu', 'footer');
      paths.push('/');
      break;
    case 'about':
      tags.push('about'); paths.push('/about-us');
      break;
    case 'footer':
      tags.push('footer');
      break;
  }
  return { tags, paths };
}

async function handle(request) {
  const url = new URL(request.url);
  const provided = request.headers.get('x-revalidate-secret') || url.searchParams.get('secret') || '';
  if (!authorized(provided)) {
    return Response.json({ ok: false, error: 'Unauthorized or missing revalidation secret.' },
      { status: 401, headers: NO_STORE });
  }
  let body = {};
  if (request.method === 'POST') {
    try { body = await request.json() || {}; }
    catch { return Response.json({ ok: false, error: 'Invalid JSON.' }, { status: 400, headers: NO_STORE }); }
  }
  const event = eventTargets(body);
  const tags = [...new Set([...url.searchParams.getAll('tag'), ...entries(body.tag), ...entries(body.tags), ...event.tags])];
  const paths = [...new Set([...url.searchParams.getAll('path'), ...entries(body.path), ...entries(body.paths), ...event.paths])];
  if (tags.length + paths.length > 100 || tags.some((tag) => !validTag(tag)) || paths.some((path) => !validPath(path))) {
    return Response.json({ ok: false, error: 'Invalid revalidation scope.' }, { status: 400, headers: NO_STORE });
  }
  if (!tags.length && !paths.length) {
    return Response.json({ ok: false, error: 'No tags, paths, or recognized resource.' }, { status: 400, headers: NO_STORE });
  }
  try {
    for (const tag of tags) revalidateTag(tag, 'max');
    for (const path of paths) revalidatePath(path);
    // Process-local stale snapshots are also cleared on the instance receiving this hook.
    invalidateLaravelCache(tags, paths);
    console.info('[revalidate]', JSON.stringify({ tags, paths }));
    return Response.json({ ok: true, revalidated: { tags, paths } }, { headers: NO_STORE });
  } catch (error) {
    console.error('[revalidate] failed:', error);
    return Response.json({ ok: false, error: 'Revalidation failed.' }, { status: 500, headers: NO_STORE });
  }
}

export async function POST(request) { return handle(request); }
// Kept for the existing /system/clear-cache page and older CMS integrations.
export async function GET(request) { return handle(request); }
