import { robotsText } from '@/lib/seo-feeds.mjs';
import { textResponse } from '@/lib/seo-feed-responses';
export const dynamic = 'force-dynamic';
export function GET() { return textResponse(robotsText()); }
