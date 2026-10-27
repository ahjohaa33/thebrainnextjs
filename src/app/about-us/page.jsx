import { buildMetadata, SITE_NAME } from "@/lib/seo";

export const metadata = buildMetadata({
  title: `About Us | ${SITE_NAME}`,
  description: "Learn about The Brain BD, our approach to quality caps, contemporary fashion, and customer service in Bangladesh.",
  path: "/about-us",
});

import SiteHeader from "@/components/frontend/SiteHeader";
import About from "./About";
import "./aboutPage.css";

export default function AboutPage() {
  return (
    <>
      <SiteHeader />
      <About />
    </>
  );
}