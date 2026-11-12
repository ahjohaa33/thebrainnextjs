import { apiUrl } from '@/lib/config';
import { laravelFetch } from '@/lib/laravel';
import { buildShopQuery, isShopCatalogPayload, SHOP_QUERY_KEYS } from '@/app/shop/shop-query.mjs';

// The route handles public catalog GETs only. Never attach cookies/cart tokens.
export const dynamic = 'force-dynamic';
const CACHE_CONTROL = 'public, s-maxage=60, stale-while-revalidate=300';
const ACCEPTED = new Set([...SHOP_QUERY_KEYS, 'q', 'status', 'brands', 'brands[]', 'brand[]', 'brand_id']);
const SORTS = new Set(['low', 'high', 'latest', 'oldest', 'popularity']);

function normalizedQuery(source) {
  for (const [key, value] of source) {
    if (!ACCEPTED.has(key) || value.length > 250 || key.length > 40) return null;
  }
  if (source.getAll('brand').length > 30 || source.getAll('brands[]').length > 30) return null;
  const params = buildShopQuery(source);
  if (!SORTS.has(params.get('sort') || 'low')) return null;
  if ((params.get('query') || '').length > 120 || (params.get('brand') || '').length > 240) return null;
  for (const field of ['minPrice', 'maxPrice']) {
    const value = params.get(field);
    if (value && (!/^\d+(?:\.\d{1,2})?$/.test(value) || Number(value) > 100000000)) return null;
  }
  if ((params.get('category_id') || '').length > 60 || (params.get('availability') || '').length > 50) return null;
  return params;
}

export async function GET(request, context) {
  const { path } = await context.params;
  // /api/catalog/search shares Laravel's documented /shop?query=... contract.
  if (!Array.isArray(path) || path.length !== 1 || !['shop', 'search'].includes(path[0])) {
    return Response.json({ message: 'Unknown catalog resource.' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }
  const params = normalizedQuery(new URL(request.url).searchParams);
  if (!params) {
    return Response.json({ message: 'Invalid catalog parameters.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }
  if (path[0] === 'search' && !params.get('query')) {
    return Response.json({ message: 'Search query required.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }
  const upstream = apiUrl(`/shop${params.size ? `?${params}` : ''}`);
  try {
    const response = await laravelFetch(upstream, {
      headers: {
        Accept: 'application/json',
        ...(request.headers.get('x-forwarded-for') ? { 'X-Forwarded-For': request.headers.get('x-forwarded-for') } : {}),
      },
      next: { revalidate: 60, tags: ['shop', 'product', 'category'] },
    }, { public: true, memoryTtl: 60 });
    if (!response.ok) {
      return Response.json({ message: 'Catalog temporarily unavailable.' }, {
        status: response.status === 429 ? 429 : 502,
        headers: { 'Cache-Control': 'no-store', 'X-Cache': response.headers.get('x-cache') || 'MISS' },
      });
    }
    const json = await response.json();
    if (!isShopCatalogPayload(json)) throw new Error('Invalid Laravel shop payload');
    return Response.json(json, { headers: {
      'Cache-Control': CACHE_CONTROL,
      'X-Cache': response.headers.get('x-cache') || 'MISS',
    } });
  } catch (error) {
    console.error('[catalog]', error?.message || error);
    return Response.json({ message: 'Catalog temporarily unavailable.' }, {
      status: 502, headers: { 'Cache-Control': 'no-store', 'X-Cache': 'MISS' },
    });
  }
}
