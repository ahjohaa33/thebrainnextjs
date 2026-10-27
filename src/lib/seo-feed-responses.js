const PUBLIC_CACHE = 'public, max-age=300, s-maxage=900, stale-while-revalidate=3600';

export function xmlResponse(xml) {
  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': PUBLIC_CACHE,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
export function textResponse(text, contentType = 'text/plain; charset=utf-8') {
  return new Response(text, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': PUBLIC_CACHE,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
export function unavailable(error) {
  console.error('[seo-feeds] generation failed:', error?.message || error);
  return new Response('SEO feed temporarily unavailable; retry later.', {
    status: 503,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
export function missing() {
  return new Response('Sitemap segment not found.', {
    status: 404,
    headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
