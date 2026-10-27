import { allBlogPosts, blogUrls, renderUrlSet } from '@/lib/seo-feeds.mjs';
import { xmlResponse, unavailable } from '@/lib/seo-feed-responses';
export const dynamic = 'force-dynamic';
export async function GET() {
  try { return xmlResponse(renderUrlSet(blogUrls(await allBlogPosts()))); }
  catch (error) { return unavailable(error); }
}
