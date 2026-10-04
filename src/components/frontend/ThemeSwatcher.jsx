"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./ThemeSwatcher.module.css";

const THEME_STORAGE_KEY = "thebrainbd-theme-v1";
const SIDE_STORAGE_KEY = "thebrainbd-theme-swatcher-side-v1";
const COLLAPSED_STORAGE_KEY = "thebrainbd-theme-swatcher-collapsed-v2";

const DEFAULT_THEME = {
  h: 221,
  s: 39,
  l: 11,
  hex: "#111827",
  name: "Original",
  original: true,
};

const VARIANTS = [
  { s: 68, l: 32 },
  { s: 76, l: 38 },
  { s: 82, l: 44 },
  { s: 88, l: 50 },
  { s: 72, l: 56 },
  { s: 62, l: 62 },
];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function hslToRgb(h, s, l) {
  const saturation = s / 100;
  const lightness = l / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const hue = (((h % 360) + 360) % 360) / 60;
  const x = chroma * (1 - Math.abs((hue % 2) - 1));
  const m = lightness - chroma / 2;

  let rgb = [0, 0, 0];
  if (hue < 1) rgb = [chroma, x, 0];
  else if (hue < 2) rgb = [x, chroma, 0];
  else if (hue < 3) rgb = [0, chroma, x];
  else if (hue < 4) rgb = [0, x, chroma];
  else if (hue < 5) rgb = [x, 0, chroma];
  else rgb = [chroma, 0, x];

  return rgb.map((channel) => Math.round((channel + m) * 255));
}

function rgbToHex([r, g, b]) {
  return `#${[r, g, b]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`;
}

function hslToHex(h, s, l) {
  return rgbToHex(hslToRgb(h, s, l));
}

function hexToHsl(value) {
  const hex = String(value || "").replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;

  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === r) h = 60 * (((g - b) / delta) % 6);
    else if (max === g) h = 60 * ((b - r) / delta + 2);
    else h = 60 * ((r - g) / delta + 4);
  }

  if (h < 0) h += 360;

  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
    hex: `#${hex.toLowerCase()}`,
    name: "Custom",
    original: false,
  };
}

function relativeLuminance([r, g, b]) {
  const channels = [r, g, b].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : Math.pow((normalized + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function getReadableForeground(h, s, l) {
  const luminance = relativeLuminance(hslToRgb(h, s, l));
  const whiteContrast = 1.05 / (luminance + 0.05);
  const darkContrast = (luminance + 0.05) / 0.057;
  return whiteContrast >= darkContrast ? "#ffffff" : "#0f172a";
}

function isValidStoredTheme(value) {
  return (
    value &&
    Number.isFinite(value.h) &&
    Number.isFinite(value.s) &&
    Number.isFinite(value.l) &&
    value.h >= 0 &&
    value.h <= 360 &&
    value.s >= 0 &&
    value.s <= 100 &&
    value.l >= 0 &&
    value.l <= 100
  );
}

function applyTheme(theme) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  const h = clamp(Math.round(theme.h), 0, 360);
  const s = clamp(Math.round(theme.s), 0, 100);
  const l = clamp(Math.round(theme.l), 5, 90);
  const hex = /^[#][0-9a-fA-F]{6}$/.test(String(theme.hex || ""))
    ? String(theme.hex).toLowerCase()
    : hslToHex(h, s, l);
  const foreground = getReadableForeground(h, s, l);

  if (theme.original) {
    root.style.setProperty("--theme-hue", "221");
    root.style.setProperty("--theme-saturation", "39%");
    root.style.setProperty("--theme-lightness", "11%");
    root.style.setProperty("--theme-primary", "#111827");
    root.style.setProperty("--theme-primary-hover", "#1f2937");
    root.style.setProperty("--theme-primary-soft", "#eef2f7");
    root.style.setProperty("--theme-primary-faint", "#f8fafc");
    root.style.setProperty("--theme-page-bg", "#f7f9fc");
    root.style.setProperty("--theme-home-bg", "#ffffff");
    root.style.setProperty("--theme-content-bg", "#ffffff");
    root.style.setProperty("--theme-section-bg", "#ffffff");
    root.style.setProperty("--theme-section-alt", "#f3f4f6");
    root.style.setProperty("--theme-footer-bg", "#050505");
    root.style.setProperty("--theme-footer-panel", "#1c1c1c");
    root.style.setProperty("--theme-border", "#e5e7eb");
    root.style.setProperty("--theme-on-primary", "#ffffff");
    root.style.setProperty("--theme-header-bg", "#ffffff");
    root.style.setProperty("--theme-header-fg", "#0f172a");
    root.style.setProperty("--theme-logo-filter", "none");
    root.style.setProperty("--theme-nav-dropdown-bg", "#ffffff");
    root.style.setProperty("--theme-nav-dropdown-fg", "#111827");
    root.style.setProperty("--theme-nav-dropdown-hover", "#f3f4f6");
    root.style.setProperty("--theme-nav-dropdown-border", "#e5e7eb");
    root.style.setProperty("--theme-current-hex", "#111827");
    root.style.setProperty("--theme-base-hsl", "221 39% 11%");
    root.style.setProperty("--theme-footer-hsl", "0 0% 2%");
    root.dataset.siteTheme = "original";

    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.setAttribute("content", "#111827");
    return;
  }

  root.style.setProperty("--theme-hue", String(h));
  root.style.setProperty("--theme-saturation", `${s}%`);
  root.style.setProperty("--theme-lightness", `${l}%`);
  root.style.setProperty("--theme-primary", `hsl(${h} ${s}% ${l}%)`);
  root.style.setProperty(
    "--theme-primary-hover",
    `hsl(${h} ${Math.min(100, s + 2)}% ${Math.max(8, l - 8)}%)`
  );
  root.style.setProperty(
    "--theme-primary-soft",
    `hsl(${h} ${Math.min(72, Math.max(24, s * 0.72))}% 93%)`
  );
  root.style.setProperty(
    "--theme-primary-faint",
    `hsl(${h} ${Math.min(58, Math.max(18, s * 0.55))}% 97%)`
  );
  root.style.setProperty(
    "--theme-page-bg",
    `hsl(${h} ${Math.min(42, Math.max(10, s * 0.34))}% 97%)`
  );
  root.style.setProperty(
    "--theme-home-bg",
    `hsl(${h} ${Math.min(38, Math.max(8, s * 0.3))}% 98%)`
  );
  root.style.setProperty(
    "--theme-content-bg",
    `hsl(${h} ${Math.min(38, Math.max(8, s * 0.3))}% 98%)`
  );
  root.style.setProperty(
    "--theme-section-bg",
    `hsl(${h} ${Math.min(50, Math.max(14, s * 0.42))}% 96%)`
  );
  root.style.setProperty(
    "--theme-section-alt",
    `hsl(${h} ${Math.min(58, Math.max(18, s * 0.5))}% 93%)`
  );
  root.style.setProperty(
    "--theme-footer-bg",
    `hsl(${h} ${Math.min(72, Math.max(28, s * 0.72))}% 9%)`
  );
  root.style.setProperty(
    "--theme-footer-panel",
    `hsl(${h} ${Math.min(68, Math.max(24, s * 0.66))}% 13%)`
  );
  root.style.setProperty(
    "--theme-border",
    `hsl(${h} ${Math.min(34, Math.max(10, s * 0.26))}% 84%)`
  );
  root.style.setProperty("--theme-on-primary", foreground);
  root.style.setProperty("--theme-header-bg", `hsl(${h} ${s}% ${l}%)`);
  root.style.setProperty("--theme-header-fg", foreground);
  root.style.setProperty(
    "--theme-logo-filter",
    foreground === "#ffffff" ? "brightness(0) invert(1)" : "none"
  );
  root.style.setProperty("--theme-nav-dropdown-bg", `hsl(${h} ${s}% ${l}%)`);
  root.style.setProperty("--theme-nav-dropdown-fg", foreground);
  root.style.setProperty(
    "--theme-nav-dropdown-hover",
    `hsl(${h} ${Math.min(100, s + 2)}% ${foreground === "#ffffff" ? Math.min(88, l + 8) : Math.max(8, l - 8)}%)`
  );
  root.style.setProperty(
    "--theme-nav-dropdown-border",
    `hsl(${h} ${Math.min(48, Math.max(12, s * 0.38))}% ${foreground === "#ffffff" ? Math.min(82, l + 18) : Math.max(22, l - 18)}%)`
  );
  root.style.setProperty("--theme-current-hex", hex);
  root.style.setProperty("--theme-base-hsl", `${h} ${s}% ${l}%`);
  root.style.setProperty(
    "--theme-footer-hsl",
    `${h} ${Math.min(72, Math.max(28, s * 0.72))}% 9%`
  );
  root.dataset.siteTheme = "custom";

  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) themeMeta.setAttribute("content", hex);
}

function buildPalette() {
  const colors = [];
  for (let hue = 0; hue < 360; hue += 15) {
    VARIANTS.forEach((variant, variantIndex) => {
      colors.push({
        h: hue,
        s: variant.s,
        l: variant.l,
        hex: hslToHex(hue, variant.s, variant.l),
        name: `Color ${colors.length + 1}`,
        original: false,
        id: `${hue}-${variantIndex}`,
      });
    });
  }
  return colors;
}

export default function ThemeSwatcher() {
  const palette = useMemo(buildPalette, []);
  const panelRef = useRef(null);
  const dragState = useRef(null);
  const [theme, setTheme] = useState(DEFAULT_THEME);
  const [side, setSide] = useState("right");
  const [collapsed, setCollapsed] = useState(true);
  const [dragX, setDragX] = useState(null);

  useEffect(() => {
    try {
      const savedTheme = JSON.parse(localStorage.getItem(THEME_STORAGE_KEY));
      if (isValidStoredTheme(savedTheme)) {
        const normalized = {
          ...savedTheme,
          hex: /^[#][0-9a-fA-F]{6}$/.test(String(savedTheme.hex || ""))
            ? String(savedTheme.hex).toLowerCase()
            : hslToHex(savedTheme.h, savedTheme.s, savedTheme.l),
        };
        setTheme(normalized);
        applyTheme(normalized);
      } else {
        applyTheme(DEFAULT_THEME);
      }

      const savedSide = localStorage.getItem(SIDE_STORAGE_KEY);
      if (savedSide === "left" || savedSide === "right") setSide(savedSide);

      const savedCollapsed = localStorage.getItem(COLLAPSED_STORAGE_KEY);
      if (savedCollapsed === "true") setCollapsed(true);
      if (savedCollapsed === "false") setCollapsed(false);
    } catch {
      applyTheme(DEFAULT_THEME);
    }
  }, []);

  const chooseTheme = (nextTheme) => {
    const normalized = {
      ...nextTheme,
      h: clamp(Math.round(nextTheme.h), 0, 360),
      s: clamp(Math.round(nextTheme.s), 0, 100),
      l: clamp(Math.round(nextTheme.l), 5, 90),
      hex: /^[#][0-9a-fA-F]{6}$/.test(String(nextTheme.hex || ""))
        ? String(nextTheme.hex).toLowerCase()
        : hslToHex(nextTheme.h, nextTheme.s, nextTheme.l),
      original: nextTheme.original === true,
    };

    setTheme(normalized);
    applyTheme(normalized);

    try {
      localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(normalized));
    } catch {
      // Theme still works for the current page if storage is unavailable.
    }
  };

  const resetTheme = () => chooseTheme(DEFAULT_THEME);

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;
      try {
        localStorage.setItem(COLLAPSED_STORAGE_KEY, String(next));
      } catch {
        // Ignore storage failures.
      }
      return next;
    });
  };

  const handleCustomColor = (event) => {
    const parsed = hexToHsl(event.target.value);
    if (parsed) chooseTheme(parsed);
  };

  const handlePointerDown = (event) => {
    if (event.button !== 0 && event.pointerType !== "touch") return;
    const panel = panelRef.current;
    if (!panel) return;

    const rect = panel.getBoundingClientRect();
    dragState.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      width: rect.width,
    };

    setDragX(rect.left);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  };

  const handlePointerMove = (event) => {
    const drag = dragState.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const gutter = 8;
    const maxX = Math.max(gutter, window.innerWidth - drag.width - gutter);
    setDragX(clamp(event.clientX - drag.offsetX, gutter, maxX));
  };

  const finishDrag = (event) => {
    const drag = dragState.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const panel = panelRef.current;
    const rect = panel?.getBoundingClientRect();
    const midpoint = (rect?.left || 0) + (rect?.width || drag.width) / 2;
    const nextSide = midpoint < window.innerWidth / 2 ? "left" : "right";

    dragState.current = null;
    setDragX(null);
    setSide(nextSide);

    try {
      localStorage.setItem(SIDE_STORAGE_KEY, nextSide);
    } catch {
      // Ignore storage failures.
    }

    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const panelStyle =
    dragX === null
      ? undefined
      : {
          left: `${dragX}px`,
          right: "auto",
        };

  return (
    <aside
      ref={panelRef}
      className={`${styles.panel} ${collapsed ? styles.collapsed : ""} ${dragX !== null ? styles.dragging : ""}`}
      data-side={side}
      style={panelStyle}
      aria-label="Website color theme picker"
    >
      <div
        className={styles.dragHandle}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        title="Drag to move the theme picker to the other side"
      >
        <span className={styles.dragDots} aria-hidden="true">•••</span>
        <strong>Theme</strong>
        <span className={styles.currentDot} style={{ backgroundColor: theme.hex }} />
      </div>

      <button
        type="button"
        className={styles.collapseButton}
        onClick={toggleCollapsed}
        aria-expanded={!collapsed}
        aria-label={collapsed ? "Open theme colors" : "Collapse theme colors"}
      >
        {collapsed ? (
          <svg
            className={styles.themeIcon}
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 3a9 9 0 0 0 0 18c1.1 0 1.8-.9 1.8-1.9 0-.5-.2-.9-.5-1.3-.3-.4-.1-1 .5-1h1.7A5.5 5.5 0 0 0 21 11.3 8.3 8.3 0 0 0 12 3Z" />
            <circle cx="7.8" cy="10" r=".7" fill="currentColor" stroke="none" />
            <circle cx="10" cy="6.8" r=".7" fill="currentColor" stroke="none" />
            <circle cx="14" cy="6.8" r=".7" fill="currentColor" stroke="none" />
            <circle cx="16.4" cy="9.8" r=".7" fill="currentColor" stroke="none" />
          </svg>
        ) : (
          "×"
        )}
      </button>

      {!collapsed ? (
        <div className={styles.content}>
          <div className={styles.headingRow}>
            <div>
              <span className={styles.eyebrow}>144 presets</span>
              <p>Choose a website theme</p>
            </div>
            <button type="button" className={styles.resetButton} onClick={resetTheme}>
              Reset
            </button>
          </div>

          <div className={styles.palette} role="group" aria-label="Theme colors">
            {palette.map((color) => {
              const selected =
                Math.abs(theme.h - color.h) < 1 &&
                Math.abs(theme.s - color.s) < 1 &&
                Math.abs(theme.l - color.l) < 1;

              return (
                <button
                  key={color.id}
                  type="button"
                  className={`${styles.swatch} ${selected ? styles.selected : ""}`}
                  style={{ backgroundColor: color.hex }}
                  onClick={() => chooseTheme(color)}
                  aria-label={`Use ${color.hex} theme`}
                  aria-pressed={selected}
                  title={color.hex}
                />
              );
            })}
          </div>

          <label className={styles.customRow}>
            <span>Custom color</span>
            <span className={styles.customControl}>
              <input
                type="color"
                value={theme.hex}
                onChange={handleCustomColor}
                aria-label="Choose a custom theme color"
              />
              <code>{theme.hex.toUpperCase()}</code>
            </span>
          </label>
        </div>
      ) : null}
    </aside>
  );
}
