import { productSegment, productUrls, renderUrlSet } from '@/lib/seo-feeds.mjs';
import { xmlResponse, unavailable, missing } from '@/lib/seo-feed-responses';
export const dynamic = 'force-dynamic';
export async function GET(request, { params }) {
  const { part } = await params;
  if (!/^[1-9]\d*\.xml$/.test(part)) return missing();
  try {
    const products = await productSegment(Number(part.slice(0, -4)));
    return products === null ? missing() : xmlResponse(renderUrlSet(productUrls(products)));
  } catch (error) { return unavailable(error); }
}
