import Link from "next/link";
import { API_BASE_URL } from "@/lib/api";
import { sanitizeHtml } from "@/lib/sanitize";
import { buildMetadata, stripMeta, siteUrl, SITE_NAME, SITE_URL } from "@/lib/seo";
import { buildBreadcrumbSchema } from "@/lib/schema";
import SiteHeader from "@/components/frontend/SiteHeader";
import JsonLd from "@/components/seo/JsonLd";
import blogStyles from "../blogPage.module.css";
import styles from "./blogPostPage.module.css";

// Always fetch fresh from the API; never cache — matches /blog listing page.
export const dynamic = "force-dynamic";
export const revalidate = 0;

// BlogPosting JSON-LD for the single post. Built here (rather than adding a
// new export to lib/schema.js) so this feature is a self-contained drop-in
// that doesn't require touching any shared/existing file.
function buildArticleSchema(post = {}, { path = "/" } = {}) {
  if (!post || !post.title) return null;

  const image = post.og_image || post.thumbnail_url || post.thumbnail || "";

  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": siteUrl(path),
    mainEntityOfPage: siteUrl(path),
    headline: stripMeta(post.title, 110),
    description: stripMeta(
      post.meta_description || post.excerpt || post.description,
      300
    ),
    ...(image ? { image: [siteUrl(image)] } : {}),
    datePublished: post.published_at || post.created_at || undefined,
    dateModified:
      post.updated_at || post.published_at || post.created_at || undefined,
    author: {
      "@type": "Organization",
      name: post.author_name || SITE_NAME,
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/favicon.ico`,
      },
    },
  };
}

/**
 * Extracting the post from the API response.
 *
 * Different Laravel setups wrap a single-resource response differently —
 * `{ post: {...} }`, `{ data: {...} }`, `{ data: { post: {...} } }`,
 * `{ status, data: { blog: {...} } }`, or just the post object itself. Rather
 * than hard-coding one guess (which is what caused every post to 404
 * previously), we walk the response tree looking for the object that
 * actually IS the post: something with a real `slug` string, coming straight
 * from the database column, plus a body field.
 *
 * Pass 1 requires slug + full content/body, so we don't accidentally grab a
 * related-posts list card (which only has slug + title + excerpt).
 * Pass 2 relaxes to slug + title/name if pass 1 finds nothing, in case the
 * content field is named something we didn't anticipate.
 */
function isFullPostShape(value) {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof value.slug === "string" &&
    value.slug.trim() !== "" &&
    (typeof value.content === "string" ||
      typeof value.body === "string" ||
      typeof value.description === "string")
  );
}

function isPostShape(value) {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof value.slug === "string" &&
    value.slug.trim() !== "" &&
    (value.title || value.name)
  );
}

function findPost(node, matcher, depth = 0, maxDepth = 5) {
  if (!node || typeof node !== "object" || Array.isArray(node)) return null;
  if (matcher(node)) return node;
  if (depth >= maxDepth) return null;

  for (const key of Object.keys(node)) {
    const value = node[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const found = findPost(value, matcher, depth + 1, maxDepth);
      if (found) return found;
    }
  }
  return null;
}

function extractPost(payload) {
  if (!payload || typeof payload !== "object") return null;
  return findPost(payload, isFullPostShape) || findPost(payload, isPostShape);
}

function extractCategories(payload) {
  if (!payload || typeof payload !== "object") return [];
  return (
    payload.categories ||
    payload.data?.categories ||
    payload.data?.data?.categories ||
    []
  );
}

function extractRelated(payload) {
  if (!payload || typeof payload !== "object") return [];
  return (
    payload.related_posts ||
    payload.related ||
    payload.recent_posts ||
    payload.data?.related_posts ||
    payload.data?.related ||
    payload.data?.recent_posts ||
    []
  );
}

async function getPostData(slug) {
  const url = `${API_BASE_URL}/blog/${encodeURIComponent(slug)}`;

  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (response.status === 404) return null;

  if (!response.ok) {
    throw new Error(`Failed to fetch blog post. Status: ${response.status}`);
  }

  return response.json();
}

// Best-effort fetch for the sidebar category list, mirroring /blog. Never
// throws — the page still renders fine without it.
async function getCategories() {
  try {
    const response = await fetch(`${API_BASE_URL}/blog`, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) return [];
    const data = await response.json();
    return data?.categories || [];
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }) {
  const { slug } = await params;

  let payload = null;
  try {
    payload = await getPostData(slug);
  } catch {
    payload = null;
  }

  const post = extractPost(payload);

  if (!post) {
    return buildMetadata({
      title: "Post not found",
      path: `/blog/${slug}`,
      noindex: true,
    });
  }

  const title = post.meta_title || post.title || "";
  const description =
    post.meta_description || post.excerpt || post.short_description || "";
  const image = post.og_image || post.thumbnail_url || "";

  return buildMetadata({
    title,
    description,
    keywords: post.meta_keywords,
    image,
    path: `/blog/${post.slug || slug}`,
    type: "article",
  });
}

export default async function BlogPostPage({ params }) {
  const { slug } = await params;

  let payload = null;
  let errorMessage = "";

  try {
    payload = await getPostData(slug);
  } catch (error) {
    errorMessage = error?.message || "Failed to load this blog post.";
  }

  const post = extractPost(payload);
  const categories = extractCategories(payload);
  const related = extractRelated(payload);

  if (!post && payload && !errorMessage) {
    // Server-log only (never shown to visitors) — if this ever fires again,
    // the printed keys tell you exactly how the API wrapped the response so
    // extractPost() can be taught that shape too.
    console.warn(
      `[blog/[slug]] Fetched /blog/${slug} but could not locate a post object. Top-level response keys: ${Object.keys(
        payload
      ).join(", ")}`
    );
  }

  if (!post) {
    return (
      <>
        <SiteHeader />
        <div>
          <section className={blogStyles.breadcrumb}>
            <div className={blogStyles.container}>
              <div className={blogStyles.bread}>
                <ul>
                  <li>
                    <Link href="/">Home</Link>
                  </li>
                  <li>
                    <Link href="/blog">Blog</Link>
                  </li>
                  <li>
                    <span>/ Not Found</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          <section className={blogStyles.blogmain}>
            <div className={blogStyles.container}>
              <div className={styles.notFoundWrap}>
                <h1>Post not found</h1>
                <p>
                  {errorMessage ||
                    "The blog post you're looking for doesn't exist or may have been removed."}
                </p>
                <p>
                  <Link href="/blog" className={styles.backLink}>
                    ← Back to Blog
                  </Link>
                </p>
              </div>
            </div>
          </section>
        </div>
      </>
    );
  }

  const sidebarCategories =
    categories.length > 0 ? categories : await getCategories();

  const breadcrumbLd = buildBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Blog", url: "/blog" },
    { name: post.title },
  ]);

  const articleLd = buildArticleSchema(post, { path: `/blog/${post.slug}` });

  return (
    <>
      <SiteHeader />
      <JsonLd id="ld-breadcrumb-blog-post" data={breadcrumbLd} />
      <JsonLd id="ld-article-blog-post" data={articleLd} />

      <div>
        <section className={blogStyles.breadcrumb}>
          <div className={blogStyles.container}>
            <div className={blogStyles.bread}>
              <ul>
                <li>
                  <Link href="/">Home</Link>
                </li>
                <li>
                  <Link href="/blog">Blog</Link>
                </li>
                <li>
                  <span>/ {post.title}</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section className={blogStyles.blogmain}>
          <div className={blogStyles.container}>
            <div className={blogStyles.row}>
              <main className={blogStyles.mainPosts}>
                <article className={styles.postArticle}>
                  {post.thumbnail_url ? (
                    <div className={styles.featuredImageWrap}>
                      <img
                        src={post.thumbnail_url}
                        className={styles.featuredImage}
                        alt={post.thumbnail_alt || post.title}
                      />
                    </div>
                  ) : null}

                  <div className={styles.metaRow}>
                    {post.category?.slug ? (
                      <Link
                        className={blogStyles.tagcat}
                        href={`/blog?category=${encodeURIComponent(
                          post.category.slug
                        )}`}
                      >
                        {post.category.name}
                      </Link>
                    ) : post.category?.name ? (
                      <span className={blogStyles.tagcat}>
                        {post.category.name}
                      </span>
                    ) : null}

                    {post.created_at_formatted ? (
                      <span className={blogStyles.dateandtime}>
                        {post.created_at_formatted}
                      </span>
                    ) : null}
                  </div>

                  <h1 className={styles.postTitle}>{post.title}</h1>

                  <div
                    className={styles.postContent}
                    dangerouslySetInnerHTML={{
                      __html: sanitizeHtml(
                        post.content || post.body || post.description || ""
                      ),
                    }}
                  />

                  {Array.isArray(post.tags) && post.tags.length > 0 ? (
                    <div className={styles.tagsRow}>
                      {post.tags.map((tag, index) => (
                        <span
                          key={tag.id || tag.slug || index}
                          className={blogStyles.tagcat}
                        >
                          {tag.name || tag}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <div className={styles.backLinkWrap}>
                    <Link href="/blog" className={styles.backLink}>
                      ← Back to Blog
                    </Link>
                  </div>
                </article>

                {related.length > 0 ? (
                  <div className={styles.relatedSection}>
                    <h2 className={styles.relatedTitle}>Related Posts</h2>
                    <div className={styles.relatedGrid}>
                      {related.map((item) => (
                        <Link
                          key={item.id || item.slug}
                          href={`/blog/${item.slug}`}
                          className={styles.relatedCard}
                        >
                          {item.thumbnail_url ? (
                            <img
                              src={item.thumbnail_url}
                              alt={item.thumbnail_alt || item.title}
                              className={styles.relatedThumb}
                            />
                          ) : null}
                          <h3 className={styles.relatedCardTitle}>
                            {item.title}
                          </h3>
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : null}
              </main>

              <aside className={blogStyles.sidebarCol}>
                <div className={blogStyles.sidebarblog}>
                  <div
                    className={`${blogStyles.sidebar} ${blogStyles.searchfrom}`}
                  >
                    <h4 className={blogStyles.sidebartitle}>Search</h4>

                    <form action="/blog" method="GET">
                      <input
                        type="text"
                        name="search"
                        className={blogStyles.formControl}
                        placeholder="Search.."
                      />

                      <button
                        className={blogStyles.searchButton}
                        type="submit"
                      >
                        Search
                      </button>
                    </form>
                  </div>

                  {sidebarCategories.length > 0 ? (
                    <div
                      className={`${blogStyles.sidebar} ${blogStyles.recentpost}`}
                    >
                      <h4 className={blogStyles.sidebartitle}>Categories</h4>

                      <div className={blogStyles.categoryWrap}>
                        <Link className={blogStyles.tagcat} href="/blog">
                          All
                        </Link>

                        {sidebarCategories.map((cat) => (
                          <Link
                            key={cat.id}
                            className={`${blogStyles.tagcat} ${
                              post.category?.slug === cat.slug
                                ? blogStyles.activeTag
                                : ""
                            }`}
                            href={`/blog?category=${encodeURIComponent(
                              cat.slug
                            )}`}
                          >
                            {cat.name} ({cat.posts_count || 0})
                          </Link>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </aside>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
