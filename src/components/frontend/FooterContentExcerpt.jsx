"use client";

import { useMemo, useState } from "react";
import styles from "./Footerpage.module.css";
import { sanitizeHtml } from "@/lib/sanitize";

function normalizeFooterHtml(html = "") {
  return String(html)
    .replace(/<strong\b/gi, "<h1")
    .replace(/<\/strong>/gi, "</h1>");
}

function cleanFooterHtml(html = "") {
  const normalized = normalizeFooterHtml(html);

  if (typeof window === "undefined") {
    return normalized;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(normalized, "text/html");

  const allowedTags = new Set([
    "h1",
    "h2",
    "h3",
    "p",
    "a",
    "ul",
    "ol",
    "li",
    "br",
    "b",
    "em",
    "i",
  ]);

  function cleanNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent.replace(/\u00a0/g, " ").trim();

      if (!text) return null;

      return document.createTextNode(text);
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return null;
    }

    const tag = node.tagName.toLowerCase();

    const cleanedChildren = Array.from(node.childNodes)
      .map(cleanNode)
      .filter(Boolean);

    const textContent = cleanedChildren
      .map((child) => child.textContent || "")
      .join("")
      .trim();

    if (!textContent && tag !== "br") {
      return null;
    }

    if (!allowedTags.has(tag)) {
      const fragment = document.createDocumentFragment();

      cleanedChildren.forEach((child) => {
        fragment.appendChild(child);
      });

      return fragment;
    }

    const cleanEl = document.createElement(tag);

    if (tag === "a") {
      const href = node.getAttribute("href");

      if (href) {
        cleanEl.setAttribute("href", href);
        cleanEl.setAttribute("target", "_blank");
        cleanEl.setAttribute("rel", "noopener noreferrer");
      }
    }

    cleanedChildren.forEach((child) => {
      cleanEl.appendChild(child);
    });

    return cleanEl;
  }

  const container = document.createElement("div");

  Array.from(doc.body.childNodes).forEach((node) => {
    const cleaned = cleanNode(node);

    if (cleaned) {
      container.appendChild(cleaned);
    }
  });

  return container.innerHTML;
}

function splitFirstSection(html = "") {
  if (typeof window === "undefined") {
    return {
      firstHtml: normalizeFooterHtml(html),
      restHtml: "",
    };
  }

  const cleanedHtml = cleanFooterHtml(html);

  const parser = new DOMParser();
  const doc = parser.parseFromString(cleanedHtml, "text/html");
  const children = Array.from(doc.body.children);

  if (!children.length) {
    return {
      firstHtml: "",
      restHtml: "",
    };
  }

  const firstBlock = [];
  const restBlock = [];

  let h1Count = 0;
  let shouldSendToRest = false;

  for (const child of children) {
    const tag = child.tagName.toLowerCase();

    if (tag === "h1") {
      h1Count += 1;

      if (h1Count === 2) {
        shouldSendToRest = true;
      }
    }

    if (shouldSendToRest) {
      restBlock.push(child.outerHTML);
    } else {
      firstBlock.push(child.outerHTML);
    }
  }

  return {
    firstHtml: firstBlock.join(""),
    restHtml: restBlock.join(""),
  };
}

export default function FooterContentExcerpt({ html }) {
  const [expanded, setExpanded] = useState(false);

  const { firstHtml, restHtml } = useMemo(() => {
    return splitFirstSection(html);
  }, [html]);

  if (!html || !firstHtml) return null;

  return (
    <section className={styles.footerTop}>
      <div className={styles.container}>
        <div
          className={styles.footerContent}
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(firstHtml) }}
        />

        {restHtml ? (
          <>
            <button
              type="button"
              className={styles.seeMoreBtn}
              onClick={() => setExpanded((prev) => !prev)}
            >
              {expanded ? "See less" : "See more..."}
            </button>

            {expanded ? (
              <div
                className={styles.footerContent}
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(restHtml) }}
              />
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  );
}