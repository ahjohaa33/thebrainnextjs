"use client";

import { useEffect, useState } from "react";
import styles from "./Header.module.css";

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function isWorldCupMenuItem(item = {}) {
  const label = String(item.label || "").trim().toLowerCase();
  const href = String(item.href || "").trim().toLowerCase();

  return label === "world cup" || href === "/world-cup";
}

function IconPlus() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <line x1="7" y1="1" x2="7" y2="13" />
      <line x1="1" y1="7" x2="13" y2="7" />
    </svg>
  );
}

function IconMinus() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <line x1="1" y1="7" x2="13" y2="7" />
    </svg>
  );
}

function MobileMenuLabel({ item }) {
  const isWorldCup = isWorldCupMenuItem(item);

  return (
    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {isWorldCup ? (
        <span className={styles.worldCupIcon} aria-hidden="true">
          🏆
        </span>
      ) : item.icon ? (
        <img
          src={item.icon}
          alt=""
          width={18}
          height={18}
          loading="lazy"
          decoding="async"
          className={styles.menuItemIcon}
        />
      ) : null}

      <span className={isWorldCup ? styles.worldCupText : undefined}>
        {item.label}
      </span>

      {isWorldCup ? (
        <span className={styles.worldCupSpark} aria-hidden="true">
          ✦
        </span>
      ) : null}
    </span>
  );
}

function MobileNode({ item, nodeKey, openMap, toggleItem, closeDrawer }) {
  const hasChildren = Array.isArray(item.children) && item.children.length > 0;
  const isWorldCup = isWorldCupMenuItem(item);

  if (!hasChildren) {
    return (
      <a
        href={item.href || "#"}
        className={cx(
          styles.dmLink,
          isWorldCup && styles.worldCupMenuLink,
          isWorldCup && styles.worldCupMenuItem
        )}
        onClick={closeDrawer}
      >
        <MobileMenuLabel item={item} />
      </a>
    );
  }

  return (
    <div
      className={cx(
        styles.dmItem,
        isWorldCup && styles.worldCupMenuItem
      )}
    >
      <button
        type="button"
        className={cx(
          styles.dmToggle,
          isWorldCup && styles.worldCupMenuLink
        )}
        aria-expanded={!!openMap[nodeKey]}
        onClick={() => toggleItem(nodeKey)}
      >
        <MobileMenuLabel item={item} />

        <span className={styles.dmToggleIcon}>
          {openMap[nodeKey] ? <IconMinus /> : <IconPlus />}
        </span>
      </button>

      {openMap[nodeKey] ? (
        <div className={styles.dmPanel}>
          {item.children.map((child, index) => (
            <MobileNode
              key={`${nodeKey}-${index}`}
              item={child}
              nodeKey={`${nodeKey}-${index}`}
              openMap={openMap}
              toggleItem={toggleItem}
              closeDrawer={closeDrawer}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function HeaderMobileDrawer({
  menu = [],
  logo = "",
  siteName = "Logo",
  searchAction = "/shop",
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [openMap, setOpenMap] = useState({});

  const closeDrawer = () => {
    setDrawerOpen(false);
  };

  const toggleItem = (key) => {
    setOpenMap((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = drawerOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [drawerOpen]);

  return (
    <>
      <button
        className={styles.burger}
        aria-label="Open menu"
        aria-expanded={drawerOpen}
        aria-controls="nxDrawer"
        onClick={() => setDrawerOpen(true)}
        type="button"
      >
        ☰
      </button>

      <div
        className={`${styles.overlay} ${drawerOpen ? styles.overlayOpen : ""}`}
        onClick={closeDrawer}
      />

      <aside
        id="nxDrawer"
        className={`${styles.drawer} ${drawerOpen ? styles.drawerOpen : ""}`}
        aria-hidden={!drawerOpen}
      >
        <div className={styles.drawerHead}>
          <a href="/" className={styles.drawerLogo} onClick={closeDrawer}>
            {logo ? (
              <img src={logo} alt={siteName} width={120} height={36} />
            ) : (
              <span>Ponnobd</span>
            )}
          </a>

          <button
            type="button"
            className={styles.drawerClose}
            onClick={closeDrawer}
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        <div className={styles.drawerBody}>
          <form action={searchAction} method="GET" className={styles.mobsearch}>
            <input
              type="text"
              name="query"
              className={styles.mobsearchInput}
              placeholder="Search"
            />
            <button type="submit" className={styles.mobsearchBtn} aria-label="Search">
              🔍
            </button>
          </form>

          <div className={styles.drawerMenu}>
            {menu.map((item, index) => (
              <MobileNode
                key={`mobile-${index}`}
                item={item}
                nodeKey={`mobile-${index}`}
                openMap={openMap}
                toggleItem={toggleItem}
                closeDrawer={closeDrawer}
              />
            ))}
          </div>
        </div>
      </aside>
    </>
  );
}