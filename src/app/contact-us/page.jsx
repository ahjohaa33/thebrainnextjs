import SiteHeader from "@/components/frontend/SiteHeader";
import LegalHero from "@/components/frontend/legal/LegalHero";
import ShowroomList from "@/components/frontend/contact/ShowroomList";
import ContactForm from "@/components/frontend/contact/ContactForm";
import JsonLd from "@/components/seo/JsonLd";
import legalStyles from "@/components/frontend/legal/LegalPage.module.css";
import styles from "./ContactPage.module.css";
import { buildMetadata, SITE_NAME } from "@/lib/seo";
import { buildBreadcrumbSchema } from "@/lib/schema";
import { SALES_WHATSAPP_E164, buildWhatsAppUrl } from "@/lib/config";
import { getFooterData } from "@/lib/footer-data";

export const metadata = buildMetadata({
  title: `Contact Us | ${SITE_NAME}`,
  description:
    "Get in touch with Ponnobd Electronics — call or WhatsApp our support team, or send us a message. Find our official Pentanik showroom addresses here.",
  path: "/contact-us",
});

export default async function ContactUsPage() {
  const footerData = await getFooterData();
  const showrooms = Array.isArray(footerData?.showrooms) ? footerData.showrooms : [];

  const jsonLd = buildBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Contact Us" },
  ]);

  return (
    <>
      {jsonLd ? <JsonLd id="ld-contact-breadcrumb" data={jsonLd} /> : null}
      <SiteHeader />

      <div className={legalStyles.page}>
        <LegalHero
          eyebrow="Get In Touch"
          title="Contact Us"
          description="Questions about an order, warranty, or a product? Reach our support team directly or visit one of our showrooms."
          crumbLabel="Contact Us"
        />

        <div className={styles.layout}>
          <section className={styles.quickContact}>
            <h2>Talk to us directly</h2>
            <p>
              For the fastest response — especially for order or delivery
              questions — call or message us on WhatsApp.
            </p>

            <div className={styles.quickContactActions}>
              <a href={`tel:${SALES_WHATSAPP_E164}`} className={styles.callBtn}>
                Call {SALES_WHATSAPP_E164}
              </a>
              <a
                href={buildWhatsAppUrl("Hello, I have a question about Ponnobd Electronics.")}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.whatsappBtn}
              >
                Message on WhatsApp
              </a>
            </div>

            <h2 className={styles.showroomHeading}>Our Showrooms</h2>
            <ShowroomList showrooms={showrooms} />
          </section>

          <section className={styles.formSection}>
            <h2>Send us a message</h2>
            <p className={styles.formIntro}>
              Fill out the form below and our team will get back to you.
              This form doesn&apos;t place an order — for purchases, please
              use the product page or checkout.
            </p>
            <ContactForm />
          </section>
        </div>
      </div>
    </>
  );
}
