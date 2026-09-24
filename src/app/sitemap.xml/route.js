import { fetchFeed } from "@/lib/backend-feeds";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;
export async function GET(request) {
  return fetchFeed(request, "/sitemap.xml", "application/xml; charset=utf-8");
}
