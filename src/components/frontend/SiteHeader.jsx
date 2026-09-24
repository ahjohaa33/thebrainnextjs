import Header from "@/components/frontend/Header";
import { LARAVEL_BASE_URL } from "@/lib/config";
import { getHomePageData } from "@/lib/home-data";

export default async function SiteHeader() {
  const home = await getHomePageData();
  return <Header site={home.site} baseUrl={LARAVEL_BASE_URL} />;
}