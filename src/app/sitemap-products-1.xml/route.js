import { productSegment, productUrls, renderUrlSet } from '@/lib/seo-feeds.mjs';
import { xmlResponse, unavailable } from '@/lib/seo-feed-responses';
export const dynamic = 'force-dynamic';
export async function GET() {
  try { return xmlResponse(renderUrlSet(productUrls(await productSegment(1)))); }
  catch (error) { return unavailable(error); }
}
