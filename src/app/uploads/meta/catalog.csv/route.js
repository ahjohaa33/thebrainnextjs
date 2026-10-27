// Backward-compatible public merchant CSV URL.
import { allProducts, renderCatalogCsv } from '@/lib/seo-feeds.mjs';
import { textResponse, unavailable } from '@/lib/seo-feed-responses';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const { products } = await allProducts();
    return textResponse(renderCatalogCsv(products), 'text/csv; charset=utf-8');
  } catch (error) { return unavailable(error); }
}
