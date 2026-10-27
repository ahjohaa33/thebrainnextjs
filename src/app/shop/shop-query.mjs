// Shared by the server page and client view so a URL always represents the
// same request. Laravel applies brand/category/price filters before pagination.
export const SHOP_QUERY_KEYS = [
  'page', 'limit', 'sort', 'availability', 'brand', 'minPrice', 'maxPrice',
  'query', 'category_id',
];

const DEFAULTS = Object.freeze({
  page: 1,
  limit: 12,
  sort: 'low',
  availability: '',
  brand: '',
  minPrice: '',
  maxPrice: '',
  query: '',
  category_id: '',
});

function firstValue(value) {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

function readValue(source, key) {
  return source && typeof source.get === 'function'
    ? source.get(key)
    : source?.[key];
}

function positiveInt(value, fallback, maximum) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1
    ? Math.min(parsed, maximum)
    : fallback;
}

export function readShopFilters(source = {}) {
  const text = (key) => String(firstValue(readValue(source, key)) ?? '').trim();

  return {
    page: positiveInt(text('page'), DEFAULTS.page, 1000000),
    limit: positiveInt(text('limit'), DEFAULTS.limit, 100),
    sort: text('sort') || DEFAULTS.sort,
    availability: text('availability'),
    brand: text('brand'),
    minPrice: text('minPrice'),
    maxPrice: text('maxPrice'),
    query: text('query'),
    category_id: text('category_id'),
  };
}

export function buildShopQuery(source = {}) {
  const filters = readShopFilters(source);
  const params = new URLSearchParams();

  for (const key of SHOP_QUERY_KEYS) {
    const value = String(filters[key] ?? '').trim();
    if (!value || (key === 'page' && Number(value) === 1)) continue;
    params.set(key, value);
  }

  // Laravel also defaults to 12 products and a low-to-high price order.
  return params;
}

export function parseBrandList(value) {
  const names = new Map();
  for (const entry of String(value || '').split(',')) {
    const name = entry.trim().replace(/\s+/g, ' ');
    const key = name.toLocaleLowerCase();
    if (key && !names.has(key)) names.set(key, name);
  }
  return Array.from(names.values());
}
