/** Run AFTER deployment when Next.js is already serving traffic. */
const base = (process.env.WARM_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/+$/, '');
if (!/^https?:\/\/[^/]+$/i.test(base)) {
  console.error('Set WARM_SITE_URL=https://thebrainbd.com (or NEXT_PUBLIC_SITE_URL).');
  process.exitCode = 1;
} else {
  const paths = new Set(['/', '/shop', '/blog', '/about-us']);
  for (const item of (process.env.WARM_URLS || '').split(',').map((s) => s.trim())) {
    if (item.startsWith('/') && !item.startsWith('//')) paths.add(item);
  }
  // Discover popular/latest public slugs from the existing cached catalog response.
  try {
    const response = await fetch(`${base}/api/catalog/shop?limit=48&sort=popularity`, { signal: AbortSignal.timeout(5000) });
    if (response.ok) {
      const json = await response.json();
      for (const product of json?.products?.data || []) {
        if (/^[a-z0-9][a-z0-9_-]*$/i.test(product?.slug || '')) paths.add(`/${product.slug}`);
      }
      for (const category of json?.categories || []) {
        if (/^[a-z0-9][a-z0-9_-]*$/i.test(category?.slug || '')) paths.add(`/${category.slug}`);
      }
    }
  } catch (error) { console.warn('Catalog seeds unavailable:', error.message); }
  const queue = [...paths].slice(0, 100);
  let index = 0;
  let failures = 0;
  async function worker() {
    while (index < queue.length) {
      const path = queue[index++];
      try {
        const res = await fetch(new URL(path, base), { signal: AbortSignal.timeout(12000), redirect: 'follow' });
        console.log(`${res.status} ${path}`);
        if (!res.ok) failures++;
        await res.body?.cancel();
      } catch (error) { failures++; console.warn(`FAILED ${path}: ${error.message}`); }
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker));
  console.log(`Warmed ${queue.length - failures}/${queue.length} URLs`);
  if (failures) process.exitCode = 1;
}
