import { fetchFeed } from "@/lib/backend-feeds";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

// Backward-compatible alias:
//   /meta/catalog.csv
// proxies the actual Laravel file at:
//   /uploads/meta/catalog.csv
export async function GET() {
  return fetchFeed(
    "/uploads/meta/catalog.csv",
    "text/csv; charset=utf-8"
  );
}
