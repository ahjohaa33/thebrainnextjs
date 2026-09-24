import styles from "./Header.module.css";
import HeaderMobileDrawer from "./HeaderMobileDrawer";
import HeaderCartIcon from "./HeaderCartIcon";
import { withCacheBust } from "@/lib/image-cache-bust";

const fallbackMenu = [
  {
    label: "Products",
    href: "/#",
    children: [
      {
        label: "Television",
        href: "/led-tv-price-in-bangladesh",
        children: [
          {
            label: "Pentanik TV",
            href: "/led-tv-price-in-bangladesh",
            children: [
              { label: "Smart Regular", href: "/regular-pentanik-tv" },
              { label: "Google Premium", href: "/pentanik-premium-tv" },
              { label: "Google QLED", href: "/pentanik-qled-tv-price-in-bangladesh" },
            ],
          },
          { label: "Sony TV", href: "/sony-tv-price-in-bangladesh" },
          { label: "Samsung TV", href: "/samsung-tv-price-in-bangladesh" },
          { label: "JPE TV", href: "/jpe-tv-price-in-bangladesh" },
          { label: "Discover TV", href: "/discover-tv-price-in-bangladesh" },
          { label: "TCL TV", href: "/tcl-tv-price-in-bangladesh" },
          { label: "LG TV", href: "/lg-tv-price-in-bangladesh" },
        ],
      },
      { label: "TV Remote", href: "/remote" },
      { label: "TV Speaker", href: "/speaker-price-in-bangladesh" },
      { label: "Air Conditioner", href: "/pentanik-ac-price-in-bangladesh" },
      { label: "Home Appliances", href: "/home-appliances" },
      { label: "Starlink", href: "/starlink-price-in-bangladesh" },
      { label: "Smartboard", href: "/pentanik-smartboard-price-in-bangladesh" },
      { label: "Others", href: "/accessories" },
    ],
  },
  { label: "Shop", href: "/shop" },
  {
    label: "TV",
    href: "/led-tv-price-in-bangladesh",
    children: [
      {
        label: "Pentanik TV",
        href: "/led-tv-price-in-bangladesh",
        children: [
          { label: "Smart Regular", href: "/regular-pentanik-tv" },
          { label: "Google Premium", href: "/pentanik-premium-tv" },
          { label: "Google QLED", href: "/pentanik-qled-tv-price-in-bangladesh" },
        ],
      },
      { label: "Sony TV", href: "/sony-tv-price-in-bangladesh" },
      { label: "Samsung TV", href: "/samsung-tv-price-in-bangladesh" },
      { label: "JPE TV", href: "/jpe-tv-price-in-bangladesh" },
      { label: "Discover TV", href: "/discover-tv-price-in-bangladesh" },
      { label: "TCL TV", href: "/tcl-tv-price-in-bangladesh" },
      { label: "LG TV", href: "/lg-tv-price-in-bangladesh" },
    ],
  },
  {
    label: "AC",
    href: "/pentanik-ac-price-in-bangladesh",
    children: [
      { label: "Pentanik AC", href: "/pentanik-ac-price-in-bangladesh" },
      { label: "Chigo AC", href: "/chigo-ac-price-in-bangladesh" },
      { label: "General AC", href: "/general-ac-price-in-bangladesh" },
      { label: "Gree AC", href: "/gree-ac-price-in-bangladesh" },
    ],
  },
  { label: "TV Remote", href: "/remote" },
  { label: "About Us", href: "/about-us" },
  { label: "Contact Us", href: "/contact-us" },
];

function absoluteUrl(path = "", baseUrl = "", version) {
  if (!path) return "";
  const resolved = /^https?:\/\//i.test(path)
    ? path
    : `${String(baseUrl).replace(/\/$/, "")}/${String(path).replace(/^\/+/, "")}`;
  // Cache-bust so a replaced logo (same filename, new bytes) isn't stuck
  // behind a stale browser/CDN cache. See lib/image-cache-bust.js.
  return withCacheBust(resolved, version);
}

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

/**
 * Static, server-rendered desktop menu. Hover-to-open is pure CSS.
 */
function DesktopMenu({ items = [], level = 0 }) {
  return (
    <ul className={level === 0 ? styles.navList : styles.submenu}>
      {items.map((item, index) => {
        const hasChildren = Array.isArray(item.children) && item.children.length > 0;

        const linkClassName = cx(level === 0 ? styles.navLink : styles.submenuLink);

        return (
          <li
            key={`${level}-${index}-${item.label || "item"}`}
            className={cx(styles.menuItem, hasChildren && styles.menuItemHasChildren)}
          >
            <a href={item.href || "#"} className={linkClassName}>
              {item.icon ? (
                <img
                  src={item.icon}
                  alt=""
                  width={20}
                  height={20}
                  loading="lazy"
                  decoding="async"
                  className={styles.menuItemIcon}
                />
              ) : null}

              <span>{item.label}</span>

              {hasChildren ? <span className={styles.caret}>▾</span> : null}
            </a>

            {hasChildren ? <DesktopMenu items={item.children} level={level + 1} /> : null}
          </li>
        );
      })}
    </ul>
  );
}

export default function Header({ site = {}, baseUrl = "" }) {
  const logo = absoluteUrl(
    site.header_logo || site.logo || "",
    baseUrl,
    site.updated_at
  );
  const searchAction = site.search_action || "/shop";
  const menu = Array.isArray(site.menu) && site.menu.length ? site.menu : fallbackMenu;

  return (
    <header className={styles.header} role="banner">
      <div className={styles.bar}>
        <HeaderMobileDrawer
          menu={menu}
          logo={logo}
          siteName={site.site_name || "Logo"}
          searchAction={searchAction}
        />

        <a href="/" className={styles.logo} aria-label="Home">
          {logo ? (
            <img src={logo} alt={site.site_name || "Logo"} width={140} height={40} />
          ) : (
            <span>Ponnobd</span>
          )}
        </a>

        <nav className={styles.nav} aria-label="Primary">
          <DesktopMenu items={menu} />
        </nav>

        <div className={styles.actions}>
          <form action={searchAction} method="GET" className={styles.search}>
            <input
              type="text"
              name="query"
              className={styles.searchInput}
              placeholder="Search"
            />
            <button type="submit" className={styles.searchBtn} aria-label="Search">
              🔍
            </button>
          </form>

          <HeaderCartIcon />
        </div>
      </div>
    </header>
  );
}