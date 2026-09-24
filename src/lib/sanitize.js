// src/lib/sanitize.js
//
// Central HTML sanitiser for every place we inject CMS / product HTML via
// `dangerouslySetInnerHTML`. Closes the stored/reflected-XSS class (VULN-002,
// CWE-79): even if the backend stores `<script>`, `onerror=`, `javascript:`
// URLs, or a hostile <iframe>, this strips them before they reach the DOM.
//
// Uses `isomorphic-dompurify` so the SAME sanitiser runs in both the Node/SSR
// pass and the browser hydration pass (DOMPurify under the hood, jsdom on the
// server). Install it once:
//
//     npm install isomorphic-dompurify
//
// DOMPurify already removes <script>, all on* event handlers, and unsafe URL
// schemes (javascript:, data: on hrefs, etc.) by default. The extra config
// below keeps the rich content the store actually uses (formatting, tables,
// images, links, and video embeds) while keeping iframes locked to a small
// whitelist of trusted video providers.

import DOMPurify from "isomorphic-dompurify";

// Only these hosts may appear in an <iframe src>. Product "Video" tabs embed
// YouTube/Vimeo/Facebook players; anything else is dropped.
const ALLOWED_IFRAME_HOSTS = [
  "www.youtube.com",
  "youtube.com",
  "www.youtube-nocookie.com",
  "youtube-nocookie.com",
  "player.vimeo.com",
  "www.facebook.com",
  "web.facebook.com",
];

let hooksInstalled = false;

function installHooks() {
  if (hooksInstalled) return;
  hooksInstalled = true;

  // Drop any <iframe> whose src is not a trusted video host.
  DOMPurify.addHook("uponSanitizeElement", (node, data) => {
    if (data.tagName !== "iframe") return;
    const src = node.getAttribute && node.getAttribute("src");
    let ok = false;
    if (src) {
      try {
        const host = new URL(src, "https://invalid.example").hostname;
        ok = ALLOWED_IFRAME_HOSTS.includes(host);
      } catch {
        ok = false;
      }
    }
    if (!ok && node.parentNode) {
      node.parentNode.removeChild(node);
    }
  });

  // Force every link that opens a new tab to be safe against reverse-tabnabbing
  // and ensure no target stays without a hardened rel.
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node.tagName === "A" && node.getAttribute("target")) {
      node.setAttribute("rel", "noopener noreferrer");
    }
    // Sandbox allowed iframes as a second layer of defence.
    if (node.tagName === "IFRAME") {
      node.setAttribute(
        "sandbox",
        "allow-scripts allow-same-origin allow-presentation allow-popups"
      );
    }
  });
}

const CONFIG = {
  // Allow normal rich-text + media, plus iframe (gated by the hook above).
  ADD_TAGS: ["iframe"],
  ADD_ATTR: [
    "target",
    "allow",
    "allowfullscreen",
    "frameborder",
    "scrolling",
    "loading",
    "referrerpolicy",
  ],
  // Never allow these regardless of input.
  FORBID_TAGS: ["script", "style", "object", "embed", "form", "base", "link"],
  FORBID_ATTR: ["style", "srcdoc"],
  // Block javascript:, vbscript:, etc.; allow http(s), mailto, tel, and
  // protocol-relative + relative URLs.
  ALLOWED_URI_REGEXP:
    /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
};

/**
 * Sanitise an untrusted HTML string for safe use with dangerouslySetInnerHTML.
 * Returns "" for non-strings so callers can use it unconditionally.
 */
export function sanitizeHtml(value) {
  if (typeof value !== "string" || value === "") return "";
  installHooks();
  return DOMPurify.sanitize(value, CONFIG);
}

export default sanitizeHtml;
