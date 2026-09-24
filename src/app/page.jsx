import Header from "@/components/frontend/Header";
import ProductBox from "@/components/frontend/ProductBox";
import FooterContentExcerpt from "@/components/frontend/FooterContentExcerpt";
import JsonLd from "@/components/seo/JsonLd";
import HomeMediaSections from "@/components/frontend/HomeMediaSections";
import CapHero from "@/components/frontend/CapHero";
import styles from "./page.module.css";
import { LARAVEL_BASE_URL } from "@/lib/config";
import { generateHomeMetadata, getHomePageData } from "@/lib/home-data";
import {
  buildBreadcrumbSchema,
  buildItemListSchema,
} from "@/lib/schema";

// Home page data is cached by getHomePageData() for 10 minutes.
export async function generateMetadata() {
  return generateHomeMetadata();
}

const HERO_LEFT = { width: 654, height: 580 };
const HERO_RIGHT_TOP = { width: 800, height: 290 };
const HERO_SMALL = { width: 400, height: 290 };

const MEDIA_VIDEO_LIMIT = 12;

/**
 * Converts a YouTube video id / watch URL / share URL / embed URL into a
 * privacy-friendly youtube-nocookie.com embed URL. If the value is already
 * some other provider's embed URL, it's returned unchanged.
 *
 * `enablejsapi=1` is kept for compatibility but is no longer required for
 * the pause-on-switch behaviour (we now unmount the previous iframe).
 * `playsinline=1` is still required for true inline playback on iOS Safari.
 */
function toYoutubeEmbed(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  // Plain YouTube video ID (11 chars, base64url-ish alphabet).
  if (/^[A-Za-z0-9_-]{11}$/.test(raw)) {
    return `https://www.youtube-nocookie.com/embed/${raw}?rel=0&modestbranding=1&playsinline=1&enablejsapi=1`;
  }

  try {
    const url = new URL(raw);
    let videoId = "";

    if (url.hostname === "youtu.be") {
      videoId = url.pathname.replace(/^\//, "").split("/")[0];
    } else if (url.pathname.startsWith("/embed/")) {
      videoId = url.pathname.split("/embed/")[1]?.split("/")[0] || "";
    } else {
      videoId = url.searchParams.get("v") || "";
    }

    if (/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
      return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1&enablejsapi=1`;
    }
  } catch {
    // Not a valid absolute URL — fall through and return as-is.
  }

  return raw;
}

/**
 * Normalizes the `video_sections` array from the Laravel API into the
 * shape the carousel components expect. Entries that fail to resolve to
 * a playable embed URL are dropped. Sorted defensively by `order`.
 */
function normalizeVideos(value) {
  if (!Array.isArray(value) || value.length === 0) return [];

  return [...value]
    .sort((a, b) => (a?.order ?? 0) - (b?.order ?? 0))
    .map((item, index) => {
      const embedUrl = toYoutubeEmbed(
        item?.embed_url ||
          item?.video_id ||
          item?.youtube_id ||
          item?.youtube_url ||
          item?.url
      );

      return {
        id: item?.id ?? `video-${index}`,
        title: item?.title || `Ponnobd video ${index + 1}`,
        embedUrl,
        publishedAt: item?.published_at || item?.date || "",
        category: item?.category || "latest",
        categoryLabel: item?.category_label || item?.category || "Latest",
      };
    })
    .filter((item) => item.embedUrl);
}

function HeroImage({ item, dimensions, priority = false, sizes }) {
  if (!item?.image) return null;

  const image = (
    <img
      src={item.image}
      alt={item.alt || ""}
      width={dimensions.width}
      height={dimensions.height}
      sizes={sizes}
      className={styles.fitImage}
      // eslint-disable-next-line react/no-unknown-property
      fetchPriority={priority ? "high" : "auto"}
      loading={priority ? "eager" : "lazy"}
      decoding={priority ? "sync" : "async"}
    />
  );

  if (item.link) {
    return (
      <a
        href={item.link}
        className={styles.galleryLink}
        aria-label={item.alt || undefined}
      >
        {image}
      </a>
    );
  }

  return image;
}

export default async function Page() {
  const home = await getHomePageData();

  // Single source of truth: the admin-managed video list from the
  // Laravel API, already included in the cached home payload above.
  const backendVideos = normalizeVideos(home?.video_sections);
  const mediaVideos = backendVideos.slice(0, MEDIA_VIDEO_LIMIT);

  const breadcrumbLd = buildBreadcrumbSchema([{ name: "Home", url: "/" }]);

  const itemListLds = home.sections
    .map((section) =>
      buildItemListSchema({
        name: section.name,
        products: section.products,
        pathname: "/",
      })
    )
    .filter(Boolean);

  return (
    <>
      {home.hero_slides[0]?.image || home.galleries[0]?.image ? (
        <link
          rel="preload"
          as="image"
          href={home.hero_slides[0]?.image || home.galleries[0].image}
          // eslint-disable-next-line react/no-unknown-property
          fetchPriority="high"
        />
      ) : null}

      <Header site={home.site} baseUrl={LARAVEL_BASE_URL} />

      <main className={styles.pageRoot}>
        {home.hero_slides.length > 0 ? (
          <CapHero slides={home.hero_slides} />
        ) : (
          <section className={styles.hero} aria-label="Featured banners">
            <div className={styles.container}>
              <div className={styles.heroGrid}>
                <div className={styles.heroLeft}>
                  <HeroImage
                    item={home.galleries[0]}
                    dimensions={HERO_LEFT}
                    priority
                    sizes="(max-width: 991px) 100vw, 50vw"
                  />
                </div>

                <div className={styles.heroRight}>
                  <div className={styles.heroRightTop}>
                    <HeroImage
                      item={home.galleries[1]}
                      dimensions={HERO_RIGHT_TOP}
                      sizes="(max-width: 991px) 100vw, 50vw"
                    />
                  </div>

                  <div className={styles.heroRightBottom}>
                    <div className={styles.heroSmall}>
                      <HeroImage
                        item={home.galleries[2]}
                        dimensions={HERO_SMALL}
                        sizes="(max-width: 991px) 50vw, 25vw"
                      />
                    </div>
                    <div className={styles.heroSmall}>
                      <HeroImage
                        item={home.galleries[3]}
                        dimensions={HERO_SMALL}
                        sizes="(max-width: 991px) 50vw, 25vw"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Client component: lite thumbnails + single real iframe (gallery only) */}
        <HomeMediaSections
          mediaVideos={mediaVideos}
          categories={home?.categories}
        />

        {home.sections.map((section, sectionIndex) => (
          <section
            className={styles.section}
            key={section.id || `section-${sectionIndex}`}
          >
            <div className={styles.container}>
              <div className={styles.sectionHeader}>
                <h2>{section.name}</h2>
                {section.short_description ? (
                  <p>{section.short_description}</p>
                ) : null}
              </div>

              <div className={styles.productGrid}>
                {section.products.map((product, productIndex) => (
                  <ProductBox
                    key={product.id || `${sectionIndex}-${productIndex}`}
                    product={product}
                    baseUrl={LARAVEL_BASE_URL}
                    listName={section.name}
                    listIndex={productIndex + 1}
                  />
                ))}
              </div>
            </div>
          </section>
        ))}

        {home.footer_content ? (
          <FooterContentExcerpt html={home.footer_content} />
        ) : null}
      </main>

      <JsonLd id="ld-breadcrumb" data={breadcrumbLd} />
      <JsonLd id="ld-itemlist" data={itemListLds} />
    </>
  );
}
