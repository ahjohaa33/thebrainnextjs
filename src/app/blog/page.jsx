import Link from "next/link";
import { API_BASE_URL } from "@/lib/api";
import styles from "./blogPage.module.css";

// Change this import path based on your project structure
import SiteHeader from "@/components/frontend/SiteHeader";
import JsonLd from "@/components/seo/JsonLd";
import { buildBreadcrumbSchema } from "@/lib/schema";

// Always fetch fresh from the API; never cache.
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getBlogData({ search = "", category = "", page = "1" }) {
  const params = new URLSearchParams();

  if (search) params.set("search", search);
  if (category) params.set("category", category);
  if (page) params.set("page", page);

  const queryString = params.toString();
  const url = `${API_BASE_URL}/blog${queryString ? `?${queryString}` : ""}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch blog data. Status: ${response.status}`);
  }

  return response.json();
}

function buildBlogUrl({ search = "", category = "", page = "" }) {
  const params = new URLSearchParams();

  if (search) params.set("search", search);
  if (category) params.set("category", category);
  if (page && Number(page) > 1) params.set("page", page);

  const query = params.toString();

  return query ? `/blog?${query}` : "/blog";
}

export async function generateMetadata({ searchParams }) {
  const sp = await searchParams;

  const search = sp?.search || "";
  const category = sp?.category || "";
  const page = sp?.page || "";

  let title = "Blog Posts";
  let description = "Read latest blog posts, guides, updates, and helpful articles.";

  if (category) {
    title = `Blog Category: ${category}`;
    description = `Read blog posts from the ${category} category.`;
  }

  if (search) {
    title = `Search Blog: ${search}`;
    description = `Search results for ${search} in blog posts.`;
  }

  return {
    title,
    description,
    alternates: {
      canonical: buildBlogUrl({
        search,
        category,
        page,
      }),
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function BlogPage({ searchParams }) {
  const sp = await searchParams;

  const search = sp?.search || "";
  const category = sp?.category || "";
  const page = sp?.page || "1";

  let data = null;
  let errorMessage = "";

  try {
    data = await getBlogData({
      search,
      category,
      page,
    });
  } catch (error) {
    errorMessage = error?.message || "Failed to load blog posts.";
  }

  const posts = data?.posts?.data || [];
  const pagination = data?.posts || {};
  const categories = data?.categories || [];

  const currentPage = Number(pagination.current_page || 1);
  const lastPage = Number(pagination.last_page || 1);
  const breadcrumbLabel = search
  ? `Blog Search: ${search}`
  : category
    ? `Blog Category: ${category}`
    : "Blog";

const breadcrumbLd = buildBreadcrumbSchema([
  { name: "Home", url: "/" },
  { name: breadcrumbLabel },
]);

  return (
    <>
      <SiteHeader />
      <JsonLd id="ld-breadcrumb-blog" data={breadcrumbLd} />
      <div>
        <section className={styles.breadcrumb}>
          <div className={styles.container}>
            <div className={styles.bread}>
              <ul>
                <li>
                  <Link href="/">Home</Link>
                </li>
                <li>
                  <span>/ Blog</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section className={styles.blogmain}>
          <div className={styles.container}>
            <div className={styles.row}>
              <main className={styles.mainPosts}>
                {errorMessage ? (
                  <div className={styles.noPost}>{errorMessage}</div>
                ) : posts.length > 0 ? (
                  posts.map((post) => (
                    <article className={styles.postloop} key={post.id}>
                      <div className={styles.loopimg}>
                        <Link href={`/blog/${post.slug}`}>
                          <img
                            src={post.thumbnail_url}
                            className={styles.thumbnail}
                            alt={post.thumbnail_alt || post.title}
                          />
                        </Link>
                      </div>

                      <div className={styles.loopContent}>
                        {post.category?.slug ? (
                          <Link
                            className={styles.tagcat}
                            href={buildBlogUrl({
                              category: post.category.slug,
                            })}
                          >
                            {post.category.name}
                          </Link>
                        ) : post.category?.name ? (
                          <span className={styles.tagcat}>
                            {post.category.name}
                          </span>
                        ) : null}

                        <Link href={`/blog/${post.slug}`}>
                          <h2 className={styles.looptitile}>{post.title}</h2>
                        </Link>

                        <span className={styles.dateandtime}>
                          {post.created_at_formatted}
                        </span>

                        <p>{post.excerpt}</p>

                        <Link
                          href={`/blog/${post.slug}`}
                          className={styles.readmore}
                        >
                          Read More <span aria-hidden="true">→</span>
                        </Link>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className={styles.noPost}>No Post Found!</div>
                )}

                {!errorMessage && lastPage > 1 && (
                  <nav className={styles.pagination} aria-label="Page navigation">
                    {currentPage > 1 && (
                      <Link
                        href={buildBlogUrl({
                          search,
                          category,
                          page: currentPage - 1,
                        })}
                        className={styles.pageLink}
                      >
                        Previous
                      </Link>
                    )}

                    {Array.from({ length: lastPage }, (_, index) => {
                      const pageNumber = index + 1;

                      if (
                        pageNumber === 1 ||
                        pageNumber === lastPage ||
                        Math.abs(pageNumber - currentPage) <= 2
                      ) {
                        return (
                          <Link
                            key={pageNumber}
                            href={buildBlogUrl({
                              search,
                              category,
                              page: pageNumber,
                            })}
                            className={`${styles.pageLink} ${
                              currentPage === pageNumber
                                ? styles.activePage
                                : ""
                            }`}
                          >
                            {pageNumber}
                          </Link>
                        );
                      }

                      if (
                        pageNumber === currentPage - 3 ||
                        pageNumber === currentPage + 3
                      ) {
                        return (
                          <span key={pageNumber} className={styles.pageDots}>
                            ...
                          </span>
                        );
                      }

                      return null;
                    })}

                    {currentPage < lastPage && (
                      <Link
                        href={buildBlogUrl({
                          search,
                          category,
                          page: currentPage + 1,
                        })}
                        className={styles.pageLink}
                      >
                        Next
                      </Link>
                    )}
                  </nav>
                )}
              </main>

              <aside className={styles.sidebarCol}>
                <div className={styles.sidebarblog}>
                  <div className={`${styles.sidebar} ${styles.searchfrom}`}>
                    <h4 className={styles.sidebartitle}>Search</h4>

                    <form action="/blog" method="GET">
                      <input
                        type="text"
                        name="search"
                        className={styles.formControl}
                        placeholder="Search.."
                        defaultValue={search}
                      />

                      {category ? (
                        <input type="hidden" name="category" value={category} />
                      ) : null}

                      <button className={styles.searchButton} type="submit">
                        Search
                      </button>
                    </form>
                  </div>

                  <div className={`${styles.sidebar} ${styles.recentpost}`}>
                    <h4 className={styles.sidebartitle}>Categories</h4>

                    <div className={styles.categoryWrap}>
                      <Link
                        className={`${styles.tagcat} ${
                          !category ? styles.activeTag : ""
                        }`}
                        href="/blog"
                      >
                        All
                      </Link>

                      {categories.map((cat) => (
                        <Link
                          key={cat.id}
                          className={`${styles.tagcat} ${
                            category === cat.slug ? styles.activeTag : ""
                          }`}
                          href={buildBlogUrl({
                            category: cat.slug,
                          })}
                        >
                          {cat.name} ({cat.posts_count || 0})
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}