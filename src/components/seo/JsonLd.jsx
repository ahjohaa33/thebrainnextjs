/**
 * Server-rendered JSON-LD blocks.
 *
 * Why a dedicated component?
 *   - Next.js Metadata API has no first-class JSON-LD support. The
 *     officially-recommended pattern (per the Next docs) is to drop a
 *     <script type="application/ld+json"> inside the page body using
 *     dangerouslySetInnerHTML — exactly what this does.
 *   - We build the JSON on the server, so it ships in the initial HTML and
 *     Google sees it on first paint. No client JS, no impact on LCP/TBT.
 *   - We sanitise "</" → "<\/" inside the JSON string. Without this, a stray
 *     "</script>" inside any product description would close our script tag
 *     and break the page. (This is a known JSON-LD footgun.)
 *
 * USAGE:
 *   import JsonLd from "@/components/seo/JsonLd";
 *   ...
 *   <JsonLd data={{ "@context": "https://schema.org", "@type": "Product", ... }} />
 *
 * For lists of multiple schemas on one page, pass an array — we'll emit
 * separate <script> tags so Google's parser handles each cleanly.
 */

const escapeJsonForHtml = (json) =>
  json
    // Most important: prevent "</script>" inside text from closing our tag.
    .replace(/<\/script/gi, "<\\/script")
    // Defensive: stray HTML comment markers can confuse some parsers.
    .replace(/<!--/g, "<\\!--");

function Block({ data, id }) {
  if (!data) return null;
  const json = JSON.stringify(data);
  return (
    <script
      type="application/ld+json"
      id={id}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: escapeJsonForHtml(json) }}
    />
  );
}

export default function JsonLd({ data, id }) {
  if (!data) return null;
  if (Array.isArray(data)) {
    return (
      <>
        {data.map((item, i) => (
          <Block key={i} data={item} id={id ? `${id}-${i}` : undefined} />
        ))}
      </>
    );
  }
  return <Block data={data} id={id} />;
}
