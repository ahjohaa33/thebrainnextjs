import SiteHeader from "@/components/frontend/SiteHeader";
import LegalHero from "@/components/frontend/legal/LegalHero";
import JsonLd from "@/components/seo/JsonLd";
import styles from "@/components/frontend/legal/LegalPage.module.css";
import { buildMetadata, SITE_NAME } from "@/lib/seo";
import { buildBreadcrumbSchema, buildFaqSchema } from "@/lib/schema";
import { SALES_WHATSAPP_E164, buildWhatsAppUrl } from "@/lib/config";

export const metadata = buildMetadata({
  title: `Frequently Asked Questions | ${SITE_NAME}`,
  description:
    "Answers to common questions about ordering, payment, delivery, warranty, and returns at Ponnobd Electronics.",
  path: "/faq",
});

const FAQ_GROUPS = [
  {
    title: "Ordering & Payment",
    items: [
      {
        q: "How do I place an order on Ponnobd Electronics?",
        a: "Browse any category or use search to find a product, then tap \u201cOrder Now\u201d or add it to your cart and proceed to checkout. Fill in your name, phone number, and delivery address, and confirm the order. Our team will call to confirm the details before it's dispatched.",
      },
      {
        q: "What payment methods do you accept?",
        a: "Orders are currently fulfilled on a Cash on Delivery (COD) basis \u2014 you pay in cash when your order is delivered or picked up. Any additional payment options for specific offers will be shown clearly at checkout.",
      },
      {
        q: "Can I change or cancel my order after placing it?",
        a: "Yes, as long as the order hasn't been dispatched yet. Contact our support team over phone or WhatsApp as soon as possible with your order details and we'll update or cancel it for you.",
      },
      {
        q: "Is it safe to order from Ponnobd Electronics?",
        a: "Yes. We are an official Pentanik brand showroom, and every order is confirmed by phone before dispatch. Since payment is collected as Cash on Delivery, you only pay once you've received your product.",
      },
    ],
  },
  {
    title: "Delivery",
    items: [
      {
        q: "Which areas do you deliver to?",
        a: "We deliver both inside and outside Dhaka, across Bangladesh, through our courier partners. Exact delivery charges and estimated timelines for your address are shown at checkout.",
      },
      {
        q: "How long does delivery take?",
        a: "Delivery time depends on your location and the product. Orders inside Dhaka are typically delivered faster than orders outside Dhaka. You'll receive a call to confirm the expected delivery date after your order is placed.",
      },
      {
        q: "How can I track my order?",
        a: "Our support team will keep you updated on your order status by phone or WhatsApp. You can also contact us anytime with your order details to check the latest status.",
      },
    ],
  },
  {
    title: "Warranty, Returns & Support",
    items: [
      {
        q: "Do products come with a warranty?",
        a: "Most products come with a manufacturer or brand warranty, with the exact duration and terms listed on the individual product page, since coverage varies by product and brand.",
      },
      {
        q: "What if my product arrives damaged or defective?",
        a: "Please inspect your product at delivery. If it arrives damaged, defective, or different from what you ordered, contact us within 48 hours with photos or video of the product and packaging, and we'll arrange a replacement, repair, or refund.",
      },
      {
        q: "How do I contact customer support?",
        a: "You can reach our support team over phone or WhatsApp, or through the contact details listed in the site footer. We're happy to help with orders, warranty claims, or product questions.",
      },
    ],
  },
];

export default function FaqPage() {
  const jsonLd = [
    buildBreadcrumbSchema([{ name: "Home", url: "/" }, { name: "FAQ" }]),
    buildFaqSchema(FAQ_GROUPS.flatMap((group) => group.items)),
  ];

  return (
    <>
      <JsonLd id="ld-faq" data={jsonLd} />
      <SiteHeader />

      <div className={styles.page}>
        <LegalHero
          eyebrow="Help Center"
          title="Frequently Asked Questions"
          description="Everything you need to know about ordering, delivery, warranty, and support at Ponnobd Electronics."
          crumbLabel="FAQ"
        />

        <div className={`${styles.layout} ${styles.layoutSingle}`}>
          <main className={styles.content}>
            <p className={styles.faqIntro}>
              Can&apos;t find what you&apos;re looking for? Message our support
              team on WhatsApp and we&apos;ll get back to you right away.
            </p>

            {FAQ_GROUPS.map((group) => (
              <div className={styles.faqGroup} key={group.title}>
                <h2 className={styles.faqGroupTitle}>{group.title}</h2>

                <div className={styles.accordion}>
                  {group.items.map((item, index) => (
                    <details
                      className={styles.accordionItem}
                      key={item.q}
                      open={group.title === FAQ_GROUPS[0].title && index === 0}
                    >
                      <summary className={styles.accordionButton}>
                        <span>{item.q}</span>
                        <strong aria-hidden="true" className={styles.accordionIcon}>
                          +
                        </strong>
                      </summary>
                      <div className={styles.accordionBody}>{item.a}</div>
                    </details>
                  ))}
                </div>
              </div>
            ))}

            <div className={styles.faqCta}>
              <p>Still have questions? Our team is happy to help.</p>
              <a
                className={styles.faqCtaBtn}
                href={buildWhatsAppUrl("Hi, I have a question about Ponnobd Electronics.")}
                target="_blank"
                rel="noopener noreferrer"
              >
                Chat on WhatsApp ({SALES_WHATSAPP_E164})
              </a>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
