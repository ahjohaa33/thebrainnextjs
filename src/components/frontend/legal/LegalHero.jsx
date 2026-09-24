import Link from "next/link";
import styles from "./LegalPage.module.css";

/**
 * Reusable hero + breadcrumb banner for static content pages
 * (FAQ, Terms & Conditions, Privacy Policy).
 *
 * Visually this intentionally echoes `about-us/aboutPage.css`'s hero
 * (gradient background, rounded bottom, centered title + breadcrumb) so
 * all of the site's "informational" pages feel like one family rather
 * than each shipping a bespoke look.
 */
export default function LegalHero({ eyebrow, title, description, crumbLabel }) {
  return (
    <header className={styles.hero}>
      <div className={styles.heroContent}>
        {eyebrow ? <span className={styles.heroBadge}>{eyebrow}</span> : null}

        <h1>{title}</h1>

        {description ? <p className={styles.heroSubtitle}>{description}</p> : null}

        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span aria-hidden="true">›</span>
          <span aria-current="page">{crumbLabel}</span>
        </nav>
      </div>
    </header>
  );
}
