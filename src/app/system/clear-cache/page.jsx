import { notFound } from "next/navigation";
import ClearCacheClient from "./ClearCacheClient";

// /system/clear-cache?key=<REVALIDATE_SECRET>
//
// A hidden, unlinked utility page for clearing every layer of frontend
// caching this app has (browser localStorage, the Cache Storage API used
// by the service worker, the SW registration itself, and Next.js's
// server-side ISR data cache) — all from a URL, with zero deploys.
//
// Gated by the SAME secret the CMS webhook already uses
// (`REVALIDATE_SECRET` in .env), so there's nothing new to configure. If
// the key is missing/wrong, this renders as a plain 404 — it doesn't leak
// that the route exists.
//
// This intentionally is NOT linked from anywhere in the site nav.

export const dynamic = "force-dynamic";

export default async function ClearCachePage(props) {
  const searchParams = await props.searchParams;
  const providedKey = typeof searchParams?.key === "string" ? searchParams.key : "";
  const secret = process.env.REVALIDATE_SECRET || "";

  if (!secret || providedKey !== secret) {
    notFound();
  }

  return <ClearCacheClient secretKey={providedKey} />;
}
