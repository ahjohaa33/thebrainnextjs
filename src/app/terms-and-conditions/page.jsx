import Link from "next/link";
import SiteHeader from "@/components/frontend/SiteHeader";
import LegalHero from "@/components/frontend/legal/LegalHero";
import JsonLd from "@/components/seo/JsonLd";
import styles from "@/components/frontend/legal/LegalPage.module.css";
import { buildMetadata, SITE_NAME } from "@/lib/seo";
import { buildBreadcrumbSchema } from "@/lib/schema";
import { SALES_WHATSAPP_E164, buildWhatsAppUrl } from "@/lib/config";

const LAST_UPDATED = "July 1, 2026";

export const metadata = buildMetadata({
  title: `Terms & Conditions | ${SITE_NAME}`,
  description:
    "Read the terms and conditions for shopping on Ponnobd Electronics — orders, pricing, delivery, payment, warranty, returns, and your rights as a customer.",
  path: "/terms-and-conditions",
});

const SECTIONS = [
  { id: "acceptance", title: "Acceptance of Terms" },
  { id: "eligibility", title: "Eligibility & Accounts" },
  { id: "products-pricing", title: "Products & Pricing" },
  { id: "orders", title: "Orders & Order Confirmation" },
  { id: "payment", title: "Payment" },
  { id: "delivery", title: "Delivery & Shipping" },
  { id: "warranty", title: "Warranty & After-Sales Service" },
  { id: "returns", title: "Returns, Exchange & Cancellation" },
  { id: "ip", title: "Intellectual Property" },
  { id: "acceptable-use", title: "Acceptable Use" },
  { id: "liability", title: "Limitation of Liability" },
  { id: "changes", title: "Changes to These Terms" },
  { id: "law", title: "Governing Law" },
  { id: "contact", title: "Contact Us" },
];

export default function TermsAndConditionsPage() {
  const jsonLd = [
    buildBreadcrumbSchema([
      { name: "Home", url: "/" },
      { name: "Terms & Conditions" },
    ]),
  ];

  return (
    <>
      <JsonLd id="ld-terms-breadcrumb" data={jsonLd} />
      <SiteHeader />

      <div className={styles.page}>
        <LegalHero
          eyebrow="Legal"
          title="Terms & Conditions"
          description="The rules that govern your use of Ponnobd Electronics and any order you place with us."
          crumbLabel="Terms & Conditions"
        />

        <div className={styles.layout}>
          <aside className={styles.toc}>
            <h2>On this page</h2>
            <ol>
              {SECTIONS.map((section, index) => (
                <li key={section.id}>
                  <a href={`#${section.id}`}>
                    {index + 1}. {section.title}
                  </a>
                </li>
              ))}
            </ol>
            <p className={styles.updated}>Last updated: {LAST_UPDATED}</p>
          </aside>

          <main className={styles.content}>
            <p className={styles.intro}>
              These Terms & Conditions (&quot;Terms&quot;) govern your access to and use of the
              Ponnobd Electronics website and the purchase of any product listed on it.
              By browsing this website or placing an order, you agree to be bound by
              these Terms. Please read them carefully before shopping with us.
            </p>

            <section id="acceptance">
              <h2>
                <span className={styles.sectionNum}>1</span>Acceptance of Terms
              </h2>
              <p>
                By accessing this website, creating an order, or otherwise using any of
                our services, you confirm that you have read, understood, and agree to
                these Terms, along with our{" "}
                <Link href="/privacy-policy">Privacy Policy</Link>. If you do not agree with
                any part of these Terms, please do not use this website.
              </p>
            </section>

            <section id="eligibility">
              <h2>
                <span className={styles.sectionNum}>2</span>Eligibility & Accounts
              </h2>
              <p>
                You must be at least 18 years old, or placing an order under the
                supervision of a parent or guardian, to order from Ponnobd Electronics.
                You are responsible for providing accurate delivery and contact
                information, and for keeping any account or order credentials you use
                on this website confidential.
              </p>
            </section>

            <section id="products-pricing">
              <h2>
                <span className={styles.sectionNum}>3</span>Products & Pricing
              </h2>
              <p>
                We make every effort to display product details, images, and prices
                accurately. However:
              </p>
              <ul>
                <li>
                  Product colors, packaging, or minor specifications may vary slightly
                  from what is shown due to manufacturer updates or photography
                  limitations.
                </li>
                <li>
                  Prices are listed in Bangladeshi Taka (BDT) and may change without
                  prior notice to reflect supplier or market price changes.
                </li>
                <li>
                  In the rare event of a pricing or listing error, we reserve the right
                  to cancel or correct the affected order and will inform you before
                  processing it further.
                </li>
                <li>Availability of any product is not guaranteed until an order is confirmed.</li>
              </ul>
            </section>

            <section id="orders">
              <h2>
                <span className={styles.sectionNum}>4</span>Orders & Order Confirmation
              </h2>
              <p>
                Placing an order through the website or via our sales team is an offer
                to purchase, which we may accept or decline. An order is considered
                confirmed only after we contact you (by phone, SMS, or WhatsApp) to
                verify the details. We may decline or cancel an order in cases of
                suspected fraud, incorrect pricing, stock unavailability, or delivery
                outside our serviceable areas.
              </p>
            </section>

            <section id="payment">
              <h2>
                <span className={styles.sectionNum}>5</span>Payment
              </h2>
              <p>
                Orders placed on this website are currently fulfilled on a{" "}
                <strong>Cash on Delivery (COD)</strong> basis — you pay in cash when
                your order is delivered or collected. Additional payment methods, where
                offered for specific campaigns or in-store purchases, will be clearly
                communicated at the time of order.
              </p>
            </section>

            <section id="delivery">
              <h2>
                <span className={styles.sectionNum}>6</span>Delivery & Shipping
              </h2>
              <p>
                We currently deliver <strong>inside and outside Dhaka</strong> across
                Bangladesh. Estimated delivery timelines and delivery charges are shown
                at checkout and may vary based on your location, product size, and
                courier availability. Delays caused by courier partners, weather, public
                holidays, or circumstances beyond our control are outside our direct
                control, though we will keep you informed of any significant delay.
              </p>
            </section>

            <section id="warranty">
              <h2>
                <span className={styles.sectionNum}>7</span>Warranty & After-Sales
                Service
              </h2>
              <p>
                Warranty coverage and duration depend on the specific product and its
                manufacturer/brand, and are listed on the individual product page.
                Warranty typically covers manufacturing defects only and does not cover
                damage from misuse, unauthorized repair, power surges, liquid damage,
                or normal wear and tear. To claim warranty service, please keep your
                invoice/order confirmation and contact our support team.
              </p>
            </section>

            <section id="returns">
              <h2>
                <span className={styles.sectionNum}>8</span>Returns, Exchange &
                Cancellation
              </h2>
              <p>
                Please inspect your product at the time of delivery. If an item arrives
                damaged, defective, or different from what you ordered, contact us
                within <strong>48 hours of delivery</strong> with photos/video of the
                product and packaging so we can arrange a replacement, repair, or
                refund as applicable. Products that are not defective and have been
                used, installed, or had seals/packaging removed may not be eligible for
                return. You may cancel an order any time before it is dispatched by
                contacting our support team.
              </p>
            </section>

            <section id="ip">
              <h2>
                <span className={styles.sectionNum}>9</span>Intellectual Property
              </h2>
              <p>
                All content on this website — including the Ponnobd Electronics name,
                logo, product photography, text, and design — is owned by or licensed
                to us and is protected by applicable intellectual property laws. You
                may not copy, reproduce, or use this content commercially without our
                prior written permission.
              </p>
            </section>

            <section id="acceptable-use">
              <h2>
                <span className={styles.sectionNum}>10</span>Acceptable Use
              </h2>
              <p>You agree not to use this website to:</p>
              <ul>
                <li>Place fraudulent or false orders, or impersonate another person.</li>
                <li>
                  Attempt to gain unauthorized access to our systems, data, or another
                  user&apos;s account.
                </li>
                <li>
                  Upload or transmit malicious code, or interfere with the normal
                  operation of the website.
                </li>
                <li>Scrape, resell, or republish our content or pricing without permission.</li>
              </ul>
            </section>

            <section id="liability">
              <h2>
                <span className={styles.sectionNum}>11</span>Limitation of Liability
              </h2>
              <p>
                To the maximum extent permitted by law, Ponnobd Electronics shall not be
                liable for any indirect, incidental, or consequential damages arising
                from the use of this website or a purchased product, beyond the value
                of the order itself. Nothing in these Terms limits any right you have
                under applicable Bangladeshi consumer protection law.
              </p>
            </section>

            <section id="changes">
              <h2>
                <span className={styles.sectionNum}>12</span>Changes to These Terms
              </h2>
              <p>
                We may update these Terms from time to time to reflect changes in our
                services or legal requirements. The updated version will be posted on
                this page with a revised &quot;Last updated&quot; date. Continued use of the
                website after changes are posted constitutes acceptance of the revised
                Terms.
              </p>
            </section>

            <section id="law">
              <h2>
                <span className={styles.sectionNum}>13</span>Governing Law
              </h2>
              <p>
                These Terms are governed by the laws of the People&apos;s Republic of
                Bangladesh. Any disputes arising from these Terms or your use of this
                website will be subject to the exclusive jurisdiction of the courts of
                Bangladesh.
              </p>
            </section>

            <section id="contact">
              <h2>
                <span className={styles.sectionNum}>14</span>Contact Us
              </h2>
              <p>
                If you have any questions about these Terms & Conditions, please reach
                out to our support team:
              </p>
              <div className={styles.contactCard}>
                <div className={styles.contactRow}>
                  <strong>WhatsApp / Phone:</strong>
                  <a href={buildWhatsAppUrl()}>{SALES_WHATSAPP_E164}</a>
                </div>
                <div className={styles.contactRow}>
                  <strong>Website:</strong> <Link href="/">ponnobd.com</Link>
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
    </>
  );
}
