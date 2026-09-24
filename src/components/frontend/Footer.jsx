import Link from "next/link";
import styles from "./Footerpage.module.css";
import { sanitizeHtml } from "@/lib/sanitize";
import { getFooterData, normalizePhoneForTel } from "@/lib/footer-data";

const INTERNAL_DOMAINS = new Set(["ponnobd.com"]);

const LEGACY_PAGE_SLUG_MAP = {
  "terms-and-conditions": "terms-and-conditions",
  "terms-conditions": "terms-and-conditions",
  terms: "terms-and-conditions",
  "privacy-policy": "privacy-policy",
  privacy: "privacy-policy",
  faq: "faq",
  faqs: "faq",
};

function isAbsoluteHttpUrl(url = "") {
  return /^https?:\/\//i.test(String(url));
}

function stripLegacyPagePrefix(pathname = "") {
  const match = pathname.match(/^\/page\/([^/?#]+)(.*)$/i);

  if (!match) {
    return pathname;
  }

  const [, slug, rest] = match;
  const normalizedSlug =
    LEGACY_PAGE_SLUG_MAP[slug.toLowerCase()] || slug;

  return `/${normalizedSlug}${rest}`;
}

function normalizeFooterLink(link = "") {
  if (!link) {
    return "#";
  }

  const value = String(link).trim();

  if (
    value.startsWith("#") ||
    value.startsWith("mailto:") ||
    value.startsWith("tel:")
  ) {
    return value;
  }

  if (isAbsoluteHttpUrl(value)) {
    try {
      const parsed = new URL(value);
      const hostname = parsed.hostname.replace(/^www\./, "");

      if (INTERNAL_DOMAINS.has(hostname)) {
        const internalPath = `${parsed.pathname}${parsed.search}${parsed.hash}`;

        return stripLegacyPagePrefix(internalPath || "/");
      }

      return value;
    } catch {
      return value;
    }
  }

  const internalPath = value.startsWith("/")
    ? value
    : `/${value}`;

  return stripLegacyPagePrefix(internalPath);
}

function isInternalRoute(href = "") {
  return href.startsWith("/");
}

function FooterLink({ href, children, className = "" }) {
  const normalizedHref = normalizeFooterLink(href);

  if (isInternalRoute(normalizedHref)) {
    return (
      <Link
        href={normalizedHref}
        className={`${styles.footerLink} ${className}`}
      >
        {children}
      </Link>
    );
  }

  return (
    <a
      href={normalizedHref}
      className={`${styles.footerLink} ${className}`}
      target={
        isAbsoluteHttpUrl(normalizedHref) ? "_blank" : undefined
      }
      rel={
        isAbsoluteHttpUrl(normalizedHref)
          ? "noopener noreferrer"
          : undefined
      }
    >
      {children}
    </a>
  );
}

function IconFacebook() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5 3.66 9.15 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.51 1.49-3.9 3.77-3.9 1.09 0 2.24.2 2.24.2v2.47h-1.26c-1.24 0-1.63.78-1.63 1.57v1.88h2.78l-.45 2.91h-2.33V22c4.78-.79 8.44-4.94 8.44-9.94z" />
    </svg>
  );
}

function IconYouTube() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M23.5 6.2a3 3 0 0 0-2.1-2.12C19.6 3.5 12 3.5 12 3.5s-7.6 0-9.4.58A3 3 0 0 0 .5 6.2 31.4 31.4 0 0 0 0 12a31.4 31.4 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.12c1.8.58 9.4.58 9.4.58s7.6 0 9.4-.58a3 3 0 0 0 2.1-2.12A31.4 31.4 0 0 0 24 12a31.4 31.4 0 0 0-.5-5.8zM9.6 15.57V8.43L15.82 12 9.6 15.57z" />
    </svg>
  );
}

function IconInstagram() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconLinkedIn() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.36V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zm1.78 13.02H3.56V9h3.56v11.45z" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1C10.61 21 3 13.39 3 4c0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.24.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

function LocationIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="19"
      height="19"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

export default async function Footer() {
  const data = await getFooterData();

  if (!data) {
    return null;
  }

  const meta = data.meta ?? {};

  const widgetOne = Array.isArray(data.widget_one)
    ? data.widget_one
    : [];

  const widgetTwo = Array.isArray(data.widget_two)
    ? data.widget_two
    : [];

  const showrooms = Array.isArray(data.showrooms)
    ? data.showrooms
    : [];

  const socialLinks =
    data.social_links ?? {};

  const contact =
    data.contact ?? {};

  const privacyPolicy =
    data.privacy_policy ?? {};

  const firstShowroom =
    showrooms[0] ?? {};

  const logo =
    data.brain_logo ||
    data.logo ||
    meta.logo ||
    "/frontend/assets/logo.webp";

  const siteName =
    data.site_name ||
    meta.app_name ||
    "The Brain";

  const address =
    data.address ||
    firstShowroom.description ||
    "";

  const phoneOne =
    contact.phone ||
    firstShowroom.phone_one ||
    "";

  const phoneTwo =
    contact.phone_two ||
    firstShowroom.phone_two ||
    "";

  const email =
    contact.email ||
    meta.email ||
    "";

  const privacyUrl =
    privacyPolicy.path ||
    privacyPolicy.url ||
    "/privacy-policy";

  const socials = [
    {
      href: socialLinks.facebook,
      label: "Facebook",
      Icon: IconFacebook,
    },
    {
      href: socialLinks.youtube,
      label: "YouTube",
      Icon: IconYouTube,
    },
    {
      href: socialLinks.instagram,
      label: "Instagram",
      Icon: IconInstagram,
    },
    {
      href: socialLinks.linkedin,
      label: "LinkedIn",
      Icon: IconLinkedIn,
    },
  ].filter((item) => item.href);

  const currentYear = new Date().getFullYear();

  return (
    <footer className={styles.footer} role="contentinfo">
      <div className={styles.container}>
        <div className={styles.topGrid}>
          <div className={styles.brandColumn}>
            <Link
              href="/"
              className={styles.logoLink}
              aria-label={`${siteName} Home`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logo}
                alt={siteName}
                className={styles.logo}
                loading="lazy"
                decoding="async"
              />
            </Link>

            <p className={styles.brandText}>
              Premium lifestyle products crafted for people
              who expect more from everyday essentials.
            </p>

            {socials.length > 0 ? (
              <div
                className={styles.socialList}
                aria-label="Social links"
              >
                {socials.map(({ href, label, Icon }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.socialButton}
                    aria-label={label}
                    title={label}
                  >
                    <Icon />
                  </a>
                ))}
              </div>
            ) : null}
          </div>

          <div className={styles.linksColumn}>
            <h3 className={styles.columnTitle}>
              {meta.widget_title_one || "Explore"}
            </h3>

            <ul className={styles.linkList}>
              {widgetOne
                .filter((item) => item?.title)
                .map((item, index) => (
                  <li key={`${item.title}-${index}`}>
                    <FooterLink href={item.link}>
                      {item.title}
                    </FooterLink>
                  </li>
                ))}
            </ul>
          </div>

          <div className={styles.linksColumn}>
            <h3 className={styles.columnTitle}>
              {meta.widget_title_two || "Customer Care"}
            </h3>

            <ul className={styles.linkList}>
              {widgetTwo
                .filter((item) => item?.title)
                .map((item, index) => (
                  <li key={`${item.title}-${index}`}>
                    <FooterLink href={item.link}>
                      {item.title}
                    </FooterLink>
                  </li>
                ))}

              <li>
                <FooterLink href={privacyUrl}>
                  {privacyPolicy.label || "Privacy Policy"}
                </FooterLink>
              </li>
            </ul>
          </div>

          <div className={styles.contactColumn}>
            <h3 className={styles.columnTitle}>
              Contact
            </h3>

            <div className={styles.contactList}>
              {address ? (
                <div className={styles.contactItem}>
                  <span className={styles.contactIcon}>
                    <LocationIcon />
                  </span>

                  <p>{address}</p>
                </div>
              ) : null}

              {phoneOne ? (
                <div className={styles.contactItem}>
                  <span className={styles.contactIcon}>
                    <PhoneIcon />
                  </span>

                  <a
                    href={`tel:${normalizePhoneForTel(phoneOne)}`}
                    className={styles.contactLink}
                  >
                    {phoneOne}
                  </a>
                </div>
              ) : null}

              {phoneTwo ? (
                <div className={styles.contactItem}>
                  <span className={styles.contactIcon}>
                    <PhoneIcon />
                  </span>

                  <a
                    href={`tel:${normalizePhoneForTel(phoneTwo)}`}
                    className={styles.contactLink}
                  >
                    {phoneTwo}
                  </a>
                </div>
              ) : null}

              {email ? (
                <div className={styles.contactItem}>
                  <span className={styles.contactIcon}>
                    <MailIcon />
                  </span>

                  <a
                    href={`mailto:${email}`}
                    className={styles.contactLink}
                  >
                    {email}
                  </a>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className={styles.bottomBar}>
          <div className={styles.copyright}>
            {meta.copyright_text ? (
              <div
                dangerouslySetInnerHTML={{
                  __html: sanitizeHtml(meta.copyright_text),
                }}
              />
            ) : (
              <p>
                © {currentYear} {siteName}. All rights reserved.
              </p>
            )}
          </div>

          <div className={styles.bottomLinks}>
            <FooterLink
              href={privacyUrl}
              className={styles.bottomLink}
            >
              {privacyPolicy.label || "Privacy Policy"}
            </FooterLink>

            <FooterLink
              href="/terms-and-conditions"
              className={styles.bottomLink}
            >
              Terms & Conditions
            </FooterLink>
          </div>
        </div>
      </div>
    </footer>
  );
}