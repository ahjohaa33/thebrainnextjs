// Backward-compatible alias for the older pages feed URL.
import { STATIC_PATHS, renderUrlSet } from '@/lib/seo-feeds.mjs';
import { xmlResponse } from '@/lib/seo-feed-responses';
export const dynamic = 'force-dynamic';
export function GET() { return xmlResponse(renderUrlSet(STATIC_PATHS)); }
