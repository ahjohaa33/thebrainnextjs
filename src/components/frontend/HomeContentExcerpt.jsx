"use client";

import { useMemo, useState } from "react";
import styles from "@/app/page.module.css";
import { sanitizeHtml } from "@/lib/sanitize";

const EXCERPT_LENGTH = 300;

const NAMED_ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  ndash: "–",
  mdash: "—",
  hellip: "…",
};

function decodeEntities(value = "") {
  return String(value).replace(
    /&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g,
    (match, body) => {
      if (body[0] === "#") {
        const code =
          body[1] === "x" || body[1] === "X"
            ? parseInt(body.slice(2), 16)
            : parseInt(body.slice(1), 10);

        return Number.isFinite(code) ? String.fromCodePoint(code) : match;
      }

      return NAMED_ENTITIES[body.toLowerCase()] ?? match;
    }
  );
}

function htmlToPlainText(safeHtml = "") {
  return decodeEntities(
    safeHtml
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<\/p\s*>/gi, " ")
      .replace(/<\/li\s*>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

function markdownToPlainText(markdown = "") {
  return decodeEntities(
    String(markdown)
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/[`*_>#~-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

export default function HomeContentExcerpt({ html = "", markdown = "" }) {
  const [expanded, setExpanded] = useState(false);

  const safeHtml = useMemo(() => sanitizeHtml(html), [html]);
  const plainText = useMemo(
    () => htmlToPlainText(safeHtml) || markdownToPlainText(markdown),
    [safeHtml, markdown]
  );

  if (!plainText && !safeHtml) return null;

  const isLong = plainText.length > EXCERPT_LENGTH;
  const excerpt = isLong
    ? `${plainText.slice(0, EXCERPT_LENGTH).trimEnd()}…`
    : plainText;

  return (
    <section className={styles.homeContentSection} aria-label="Home content">
      <div className={styles.container}>
        <div className={styles.homeContentCard}>
          {expanded ? (
            safeHtml ? (
              <div
                className={styles.homeContentRich}
                dangerouslySetInnerHTML={{ __html: safeHtml }}
              />
            ) : (
              <div className={styles.homeContentMarkdown}>{markdown}</div>
            )
          ) : (
            <p className={styles.homeContentExcerpt}>{excerpt}</p>
          )}

          {isLong ? (
            <button
              type="button"
              className={styles.homeContentToggle}
              onClick={() => setExpanded((value) => !value)}
              aria-expanded={expanded}
            >
              {expanded ? "See less" : "See more"}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
