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
  title: `Privacy Policy | ${SITE_NAME}`,
  description:
    "Learn how Ponnobd Electronics collects, uses, and protects your personal information when you browse the website or place an order.",
  path: "/privacy-policy",
});

const SECTIONS = [
  { id: "overview", title: "Overview" },
  { id: "information-we-collect", title: "Information We Collect" },
  { id: "how-we-use", title: "How We Use Your Information" },
  { id: "cookies", title: "Cookies & Tracking Technologies" },
  { id: "sharing", title: "How We Share Information" },
  { id: "security", title: "Data Security" },
  { id: "retention", title: "Data Retention" },
  { id: "your-rights", title: "Your Choices & Rights" },
  { id: "children", title: "Children's Privacy" },
  { id: "third-party-links", title: "Third-Party Links" },
  { id: "changes", title: "Changes to This Policy" },
  { id: "contact", title: "Contact Us" },
];

export default function PrivacyPolicyPage() {
  const jsonLd = [
    buildBreadcrumbSchema([
      { name: "Home", url: "/" },
      { name: "Privacy Policy" },
    ]),
  ];

  return (
    <>
      <JsonLd id="ld-privacy-breadcrumb" data={jsonLd} />
      <SiteHeader />

      <div className={styles.page}>
        <LegalHero
          eyebrow="Legal"
          title="Privacy Policy"
          description="How we collect, use, and protect your information when you shop with Ponnobd Electronics."
          crumbLabel="Privacy Policy"
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
              Ponnobd Electronics (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) respects your privacy. This
              Privacy Policy explains what information we collect when you visit our
              website or place an order, how we use it, and the choices you have. By
              using this website, you agree to the practices described below.
            </p>

            <section id="overview">
              <h2>
                <span className={styles.sectionNum}>1</span>Overview
              </h2>
              <p>
                This policy applies to information collected through the Ponnobd
                Electronics website, our order and delivery process, and any
                communication you have with our support team via phone or WhatsApp. It
                does not apply to third-party websites we may link to.
              </p>
            </section>

            <section id="information-we-collect">
              <h2>
                <span className={styles.sectionNum}>2</span>Information We Collect
              </h2>
              <p>We collect information in the following ways:</p>
              <ul>
                <li>
                  <strong>Information you provide directly</strong> — name, phone
                  number, delivery address, and any details you share when placing an
                  order, contacting support, or subscribing to updates.
                </li>
                <li>
                  <strong>Order information</strong> — products purchased, order value,
                  delivery zone, and order status, used to process and track your
                  order.
                </li>
                <li>
                  <strong>Automatically collected information</strong> — device type,
                  browser, approximate location, pages visited, and referring links,
                  collected via cookies and analytics tools to help us understand how
                  the website is used.
                </li>
              </ul>
              <p>
                We do not knowingly collect payment card details, since orders are
                currently fulfilled on a Cash on Delivery basis.
              </p>
            </section>

            <section id="how-we-use">
              <h2>
                <span className={styles.sectionNum}>3</span>How We Use Your Information
              </h2>
              <p>We use the information we collect to:</p>
              <ul>
                <li>Process, confirm, and deliver your orders.</li>
                <li>Contact you about order status, delivery updates, or support requests.</li>
                <li>Improve our website, product catalogue, and customer experience.</li>
                <li>
                  Send you promotional updates or offers, where you have opted in — you
                  can opt out at any time.
                </li>
                <li>Detect, prevent, and investigate fraud, abuse, or security issues.</li>
                <li>Comply with applicable legal and regulatory obligations.</li>
              </ul>
            </section>

            <section id="cookies">
              <h2>
                <span className={styles.sectionNum}>4</span>Cookies & Tracking
                Technologies
              </h2>
              <p>
                We use cookies and similar technologies (including analytics and
                advertising tags) to remember your preferences, keep your cart working
                correctly, and understand how visitors use our website. You can control
                or disable cookies through your browser settings; however, some parts
                of the website — such as the shopping cart — may not function properly
                without them.
              </p>
            </section>

            <section id="sharing">
              <h2>
                <span className={styles.sectionNum}>5</span>How We Share Information
              </h2>
              <p>
                We do not sell your personal information. We share it only in the
                following limited situations:
              </p>
              <ul>
                <li>
                  <strong>Delivery & courier partners</strong> — to deliver your order
                  to the address you provide.
                </li>
                <li>
                  <strong>Service providers</strong> — such as hosting, analytics, and
                  communication tools that help us operate the website, bound by
                  confidentiality obligations.
                </li>
                <li>
                  <strong>Legal requirements</strong> — where required to comply with
                  applicable law, regulation, or a valid legal request.
                </li>
                <li>
                  <strong>Business transfers</strong> — in connection with a merger,
                  acquisition, or sale of assets, subject to this policy continuing to
                  apply to your information.
                </li>
              </ul>
            </section>

            <section id="security">
              <h2>
                <span className={styles.sectionNum}>6</span>Data Security
              </h2>
              <p>
                We use reasonable technical and organizational measures — including
                secure connections (HTTPS) and access controls — to protect your
                information from unauthorized access, alteration, or disclosure.
                However, no method of transmission or storage is 100% secure, and we
                cannot guarantee absolute security.
              </p>
            </section>

            <section id="retention">
              <h2>
                <span className={styles.sectionNum}>7</span>Data Retention
              </h2>
              <p>
                We retain your order and account information for as long as needed to
                fulfil the purposes described in this policy, including maintaining
                order history, warranty records, and complying with our legal and
                accounting obligations, after which it is deleted or anonymized.
              </p>
            </section>

            <section id="your-rights">
              <h2>
                <span className={styles.sectionNum}>8</span>Your Choices & Rights
              </h2>
              <p>You can:</p>
              <ul>
                <li>Ask us what personal information we hold about you, and request a copy.</li>
                <li>Ask us to correct inaccurate or outdated information.</li>
                <li>
                  Ask us to delete your personal information, subject to any legal
                  obligation we have to retain it (for example, order records).
                </li>
                <li>Opt out of promotional messages at any time.</li>
              </ul>
              <p>
                To exercise any of these choices, contact us using the details in the{" "}
                <a href="#contact">Contact Us</a> section below.
              </p>
            </section>

            <section id="children">
              <h2>
                <span className={styles.sectionNum}>9</span>Children&apos;s Privacy
              </h2>
              <p>
                This website is not directed at children under 13, and we do not
                knowingly collect personal information from them. If you believe a
                child has provided us with personal information, please contact us so
                we can remove it.
              </p>
            </section>

            <section id="third-party-links">
              <h2>
                <span className={styles.sectionNum}>10</span>Third-Party Links
              </h2>
              <p>
                Our website may contain links to third-party sites (such as our social
                media pages or courier partners). We are not responsible for the
                privacy practices of those third parties, and we encourage you to
                review their privacy policies separately.
              </p>
            </section>

            <section id="changes">
              <h2>
                <span className={styles.sectionNum}>11</span>Changes to This Policy
              </h2>
              <p>
                We may update this Privacy Policy from time to time to reflect changes
                in our practices or legal requirements. The updated version will be
                posted here with a revised &quot;Last updated&quot; date. We encourage you to
                review this page periodically.
              </p>
            </section>

            <section id="contact">
              <h2>
                <span className={styles.sectionNum}>12</span>Contact Us
              </h2>
              <p>
                If you have questions about this Privacy Policy or how we handle your
                information, please contact us:
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
