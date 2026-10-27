/**
 * The Brain SEO feeds. Generated from the SAME Laravel JSON APIs used by the
 * storefront, not from optional Laravel XML/CSV exports.
 * Pure ESM so response/render logic can be regression-tested without Next.js.
 */
export const PRODUCT_PAGE_SIZE = 100;
export const PRODUCTS_PER_SITEMAP = 10_000; // safely below Google's 50k URL limit
const MAX_PRODUCT_PAGES = 2500;
const MAX_BLOG_PAGES = 2500;
const TIMEOUT_MS = 15_000;

export const STATIC_PATHS = [
  '/', '/shop', '/blog', '/about-us', '/contact-us', '/faq',
  '/privacy-policy', '/terms-and-conditions',
];
const HIDDEN_PATH = /^\/(?:api|system|cart|checkout|order-success|_next|uploads|meta|sitemaps|sitemap(?:-|\.)|robots\.txt)(?:\/|$|[.-])/i;

function origin(value, fallback) {
  try {
    const url = new URL(value || fallback);
    if (!['http:', 'https:'].includes(url.protocol)) throw Error('Invalid protocol');
    return url.origin;
  } catch { return fallback; }
}

export function publicOrigin() {
  return origin(process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL, 'https://thebrainbd.com');
}
function apiBase() {
  return (process.env.NEXT_PUBLIC_LARAVEL_APP_URL || process.env.LARAVEL_APP_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');
}
function assetOrigin() {
  const configured = process.env.LARAVEL_WEB_URL || apiBase();
  return origin(configured, 'https://backend.thebrainbd.com');
}

function asObject(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
function asArray(value) { return Array.isArray(value) ? value : []; }
export function publicUrl(value, base = publicOrigin()) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const raw = value.trim();
  if (raw.startsWith('//') || /[?#]/.test(raw) && !/^https?:\/\//i.test(raw)) {
    // Query, hash and protocol-relative links are not canonical feed URLs.
    return null;
  }
  let url;
  try { url = new URL(raw, `${base}/`); } catch { return null; }
  if (url.origin !== base || url.username || url.password) return null;
  const path = url.pathname.replace(/\/+$/, '') || '/';
  if (HIDDEN_PATH.test(path) || path.includes('/../')) return null;
  if (url.search || url.hash || /\.(?:js|css|xml|csv|txt|json|webp|png|jpg|jpeg|svg|pdf)$/i.test(path)) return null;
  return `${base}${path}`;
}
function itemUrl(item, prefix = '/') {
  const raw = item?.url || item?.link || item?.href || (item?.slug ? `${prefix}${String(item.slug).replace(/^\/+/, '')}` : '');
  return publicUrl(raw);
}
function itemDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  // Avoid guessing lastmod from the current run time.
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}
function xmlEscape(value) {
  return String(value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
export function renderUrlSet(items) {
  const seen = new Set();
  const rows = [];
  for (const item of items) {
    const location = typeof item === 'string' ? publicUrl(item) : publicUrl(item?.loc);
    if (!location || seen.has(location)) continue;
    seen.add(location);
    const lastmod = itemDate(item?.lastmod);
    rows.push(`  <url><loc>${xmlEscape(location)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`);
  }
  if (rows.length > 50_000) throw Error('Sitemap too large: split into additional files');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join('\n')}\n</urlset>\n`;
}
export function renderSitemapIndex(paths) {
  const root = publicOrigin();
  const unique = [...new Set(paths)];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${unique.map(path => `  <sitemap><loc>${xmlEscape(`${root}${path}`)}</loc></sitemap>`).join('\n')}\n</sitemapindex>\n`;
}

async function getJson(path) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${apiBase()}${path}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
      next: { revalidate: 900, tags: ['seo-feeds'] },
    });
    if (!response.ok) throw Error(`Laravel ${path.split('?')[0]} returned HTTP ${response.status}`);
    const json = await response.json();
    if (!json || typeof json !== 'object') throw Error(`Invalid JSON payload for ${path}`);
    return json;
  } finally { clearTimeout(timeout); }
}
function paginator(payload, field) {
  const top = asObject(payload);
  const envelope = asObject(top[field] || asObject(top.data)[field]);
  const data = Array.isArray(envelope.data) ? envelope.data
    : Array.isArray(top[field]) ? top[field]
    : Array.isArray(asObject(top.data)[field]) ? asObject(top.data)[field] : null;
  if (!data) throw Error(`Laravel ${field} list is unavailable or has an unexpected format`);
  const page = Number(envelope.current_page ?? 1);
  const last = Number(envelope.last_page ?? 1);
  const total = Number(envelope.total ?? data.length);
  if (!Number.isSafeInteger(last) || last < 1 || !Number.isSafeInteger(total) || total < 0 || !Number.isSafeInteger(page) || page < 1) {
    throw Error(`Invalid ${field} pagination metadata`);
  }
  return { data, page, last, total };
}
export async function shopPage(page = 1) {
  const response = await getJson(`/shop?page=${page}&limit=${PRODUCT_PAGE_SIZE}`);
  return { response, list: paginator(response, 'products') };
}
export async function blogPage(page = 1) {
  const response = await getJson(`/blog?page=${page}`);
  return { response, list: paginator(response, 'posts') };
}
async function gatherPages(fetchPage, startPage, endPage) {
  const output = [];
  for (let start = startPage; start <= endPage; start += 5) {
    const batch = await Promise.all(Array.from({ length: Math.min(5, endPage - start + 1) }, (_, i) => fetchPage(start + i)));
    for (let i = 0; i < batch.length; i++) {
      if (batch[i].list.page !== start + i) throw Error('Laravel returned incorrect pagination page');
      output.push(...batch[i].list.data);
    }
  }
  return output;
}
export async function productSegment(part = 1) {
  if (!Number.isSafeInteger(part) || part < 1) throw Error('Invalid product sitemap part');
  const first = await shopPage(1);
  if (first.list.last > MAX_PRODUCT_PAGES) throw Error('Product catalog exceeds configured safety limit');
  const segmentCount = Math.max(1, Math.ceil(first.list.total / PRODUCTS_PER_SITEMAP));
  if (part > segmentCount) return null;
  // The API may enforce a smaller page size; use its reported per_page.
  const perPage = Number(asObject(first.response.products).per_page || PRODUCT_PAGE_SIZE);
  const pageCountPerPart = Math.max(1, Math.floor(PRODUCTS_PER_SITEMAP / (perPage > 0 ? perPage : PRODUCT_PAGE_SIZE)));
  const startPage = (part - 1) * pageCountPerPart + 1;
  const endPage = Math.min(first.list.last, part * pageCountPerPart);
  const products = startPage === 1
    ? first.list.data.concat(await gatherPages(shopPage, 2, endPage))
    : await gatherPages(shopPage, startPage, endPage);
  // If the upstream silently changes its page size, never silently truncate.
  // A successful response must not turn an incomplete total into a 200 sitemap.
  if (part === segmentCount && startPage === 1 && products.length < first.list.total) {
    throw Error('Incomplete product sitemap due to Laravel pagination');
  }
  return products;
}
export async function allProducts() {
  const first = await shopPage(1);
  if (first.list.last > MAX_PRODUCT_PAGES) throw Error('Product catalog exceeds configured safety limit');
  const products = first.list.data.concat(await gatherPages(shopPage, 2, first.list.last));
  if (products.length < first.list.total) throw Error('Laravel product pagination returned fewer entries than declared');
  return { products, shop: first.response };
}
export async function allBlogPosts() {
  const first = await blogPage(1);
  if (first.list.last > MAX_BLOG_PAGES) throw Error('Blog catalog exceeds configured safety limit');
  const posts = first.list.data.concat(await gatherPages(blogPage, 2, first.list.last));
  if (posts.length < first.list.total) throw Error('Laravel blog pagination returned fewer posts than declared');
  return posts;
}
export function productUrls(products) {
  return asArray(products).map(product => ({
    loc: itemUrl(product),
    lastmod: product?.updated_at || product?.modified_at,
  })).filter(item => item.loc);
}
function addCategory(map, item) {
  if (!item || typeof item !== 'object') return;
  let loc = itemUrl(item);
  // Older CMS navigation links use /category/<slug>, while this Next.js
  // application resolves categories through /[slug]. Keep one canonical URL.
  if (loc) {
    const path = new URL(loc).pathname;
    const match = path.match(/^\/category\/([^/]+)\/?$/i);
    if (match) loc = publicUrl(`/${match[1]}`);
  }
  if (loc && !STATIC_PATHS.some(path => publicUrl(path) === loc)) {
    map.set(loc, { loc, lastmod: item.updated_at || item.modified_at });
  }
}
function traverseMenu(list, map) {
  for (const item of asArray(list)) {
    addCategory(map, item);
    traverseMenu(item?.children, map);
    traverseMenu(item?.subcategories, map);
  }
}
export async function categoryUrls() {
  // /shop advertises all filter categories. /home advertises public category
  // panels + the complete navigation tree. Scan product category associations
  // as an additional source; none of these require a Laravel XML export.
  const [{ products, shop }, home] = await Promise.all([allProducts(), getJson('/home')]);
  const map = new Map();
  traverseMenu(shop?.categories, map);
  traverseMenu(asObject(shop?.data).categories, map);
  traverseMenu(home?.categories, map);
  traverseMenu(asObject(home?.site).menu, map);
  for (const product of products) {
    traverseMenu(product?.categories, map);
    addCategory(map, product?.category);
    traverseMenu(product?.subcategories, map);
    addCategory(map, product?.subcategory);
  }
  return [...map.values()];
}
export function blogUrls(posts) {
  return asArray(posts).map(post => ({
    loc: post?.slug ? publicUrl(`/blog/${encodeURIComponent(String(post.slug))}`) : null,
    lastmod: post?.updated_at || post?.published_at,
  })).filter(item => item.loc);
}
export async function feedIndex() {
  const first = await shopPage(1);
  if (first.list.last > MAX_PRODUCT_PAGES) throw Error('Product catalog exceeds configured safety limit');
  const perPage = Number(asObject(first.response.products).per_page || PRODUCT_PAGE_SIZE);
  const pagesPerPart = Math.max(1, Math.floor(PRODUCTS_PER_SITEMAP / (perPage > 0 ? perPage : PRODUCT_PAGE_SIZE)));
  const segments = Math.max(1, Math.ceil(first.list.last / pagesPerPart));
  const products = Array.from({ length: segments }, (_, i) => i === 0 ? '/sitemap-products-1.xml' : `/sitemaps/products/${i + 1}.xml`);
  return renderSitemapIndex(['/sitemap-static.xml', '/sitemap-categories.xml', '/sitemap-blog.xml', ...products]);
}
export function robotsText() {
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /cart',
    'Disallow: /checkout',
    'Disallow: /order-success',
    'Disallow: /system/',
    '',
    `Sitemap: ${publicOrigin()}/sitemap.xml`,
    '',
  ].join('\n');
}
function plainText(input) {
  return String(input ?? '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ').trim();
}
function csvValue(value) {
  let text = String(value ?? '').replace(/\u0000/g, '');
  // CSV/formula injection protection for third-party spreadsheet imports.
  if (/^[\s]*[=+@\-]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
function amount(item) {
  // Match the frontend shop price logic exactly: offer_price only when
  // positive and lower than the regular price.
  const standard = Number(item?.price ?? 0);
  const offer = Number(item?.offer_price ?? 0);
  return {
    regular: standard > 0 ? standard : 0,
    current: offer > 0 && standard > offer ? offer : standard > 0 ? standard : 0,
  };
}
function imageUrl(item) {
  const raw = item?.thumbnail || item?.thumbnail_url || item?.image || item?.webp || '';
  if (typeof raw !== 'string' || !raw.trim()) return '';
  try {
    const candidate = new URL(raw.trim(), `${assetOrigin()}/`);
    return ['http:', 'https:'].includes(candidate.protocol) ? candidate.href : '';
  } catch { return ''; }
}
export function renderCatalogCsv(products) {
  const headings = ['id', 'title', 'description', 'availability', 'condition', 'price', 'sale_price', 'link', 'image_link', 'brand', 'product_type'];
  const rows = [headings.join(',')];
  for (const item of asArray(products)) {
    const link = itemUrl(item);
    if (!link || item?.id == null) continue;
    const price = amount(item);
    // Merchant feeds need valid positive prices. Skip incomplete products,
    // rather than publishing made-up zeros that lead to disapprovals.
    if (!Number.isFinite(price.current) || price.current <= 0) continue;
    const hasSale = price.current < price.regular;
    const stock = Number(item?.current_stock ?? item?.stock ?? 0);
    const brand = typeof item?.brand === 'object' ? item.brand?.name : item?.brand;
    const category = item?.categories?.[0]?.name || item?.category?.name || '';
    const data = [
      item.id, plainText(item.name), plainText(item.meta_description || item.short_description || item.description),
      stock > 0 ? 'in_stock' : 'out_of_stock', 'new',
      `${price.regular.toFixed(2)} BDT`,
      hasSale ? `${price.current.toFixed(2)} BDT` : '',
      link, imageUrl(item), plainText(brand || item.brand_name), plainText(category),
    ];
    rows.push(data.map(csvValue).join(','));
  }
  return `\uFEFF${rows.join('\r\n')}\r\n`;
}
