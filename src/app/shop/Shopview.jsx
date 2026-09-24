'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiRequest, API_BASE_URL } from '@/lib/api';
import styles from './shopPage.module.css';

const LARAVEL_ASSET_BASE_URL = API_BASE_URL.replace(/\/api\/v\d+$/i, '').replace(/\/api$/i, '');

function money(value) {
  const amount = Number(value || 0);

  return new Intl.NumberFormat('en-BD', {
    style: 'currency',
    currency: 'BDT',
    maximumFractionDigits: 0,
  }).format(amount);
}

function buildImageUrl(image) {
  if (!image) return '/placeholder-product.webp';

  const cleanImage = String(image);

  if (cleanImage.startsWith('http')) {
    return cleanImage;
  }

  return `${LARAVEL_ASSET_BASE_URL}/${cleanImage.replace(/^\/+/, '')}`;
}

export default function ShopView({ initialData = null }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialParams = useMemo(() => {
    return {
      page: Number(searchParams.get('page') || 1),
      limit: Number(searchParams.get('limit') || 12),
      sort: searchParams.get('sort') || 'low',
      availability: searchParams.get('availability') || '',
      brand: searchParams.get('brand') || '',
      minPrice: searchParams.get('minPrice') || '',
      maxPrice: searchParams.get('maxPrice') || '',
      query: searchParams.get('query') || '',
      category_id: searchParams.get('category_id') || '',
    };
  }, [searchParams]);

  const [filters, setFilters] = useState(initialParams);

  const [priceInputs, setPriceInputs] = useState({
    minPrice: initialParams.minPrice || 10,
    maxPrice: initialParams.maxPrice || 100000,
  });

  const [products, setProducts] = useState(initialData?.products?.data || []);
  const [brands, setBrands] = useState(initialData?.brands || []);
  const [categories, setCategories] = useState(initialData?.categories || []);

  const [pagination, setPagination] = useState({
    current_page: initialData?.products?.current_page || 1,
    last_page: initialData?.products?.last_page || 1,
    per_page: initialData?.products?.per_page || 12,
    total: initialData?.products?.total || 0,
  });

  // Start without a loading spinner when server-rendered initial data is present.
  const [loading, setLoading] = useState(initialData === null);
  const [wishlistLoadingId, setWishlistLoadingId] = useState(null);
  const [message, setMessage] = useState(null);

  function updateUrl(nextFilters) {
    const params = new URLSearchParams();

    Object.entries(nextFilters).forEach(([key, value]) => {
      if (
        value !== null &&
        value !== undefined &&
        value !== '' &&
        !(key === 'page' && Number(value) === 1)
      ) {
        params.set(key, value);
      }
    });

    router.push(`/shop${params.toString() ? `?${params.toString()}` : ''}`, {
      scroll: false,
    });
  }

  function applyFilters(patch) {
    const nextFilters = {
      ...filters,
      ...patch,
      page: patch.page || 1,
    };

    setFilters(nextFilters);
    updateUrl(nextFilters);
  }

  function clearFilters() {
    const nextFilters = {
      page: 1,
      limit: filters.limit,
      sort: filters.sort,
      availability: '',
      brand: '',
      minPrice: '',
      maxPrice: '',
      query: '',
      category_id: '',
    };

    setFilters(nextFilters);

    setPriceInputs({
      minPrice: 10,
      maxPrice: 100000,
    });

    updateUrl(nextFilters);
  }

  async function fetchShopData(activeFilters) {
    setLoading(true);
    setMessage(null);

    try {
      const params = new URLSearchParams();

      Object.entries(activeFilters).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          params.set(key, value);
        }
      });

      const result = await apiRequest(`/shop?${params.toString()}`);

      setProducts(result.products?.data || []);
      setBrands(result.brands || []);
      setCategories(result.categories || []);

      setPagination({
        current_page: result.products?.current_page || 1,
        last_page: result.products?.last_page || 1,
        per_page: result.products?.per_page || activeFilters.limit,
        total: result.products?.total || 0,
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.message || 'Something went wrong while loading products.',
      });
    } finally {
      setLoading(false);
    }
  }

  async function addToWishlist(productId) {
    setWishlistLoadingId(productId);
    setMessage(null);

    try {
      const result = await apiRequest('/wishlist', {
        method: 'POST',
        body: JSON.stringify({
          product_id: productId,
        }),
      });

      setMessage({
        type: 'success',
        text: result.message || 'Product added to wishlist!',
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.message || 'Product already exists in wishlist.',
      });
    } finally {
      setWishlistLoadingId(null);
    }
  }

  // Track whether the initial server data has already been consumed so the
  // first client-side effect doesn't double-fetch on hydration.
  const initialDataConsumed = useRef(initialData !== null);

  useEffect(() => {
    setFilters(initialParams);

    setPriceInputs({
      minPrice: initialParams.minPrice || 10,
      maxPrice: initialParams.maxPrice || 100000,
    });
  }, [initialParams]);

  useEffect(() => {
    // Skip the very first run when the server already provided data.
    if (initialDataConsumed.current) {
      initialDataConsumed.current = false;
      return;
    }
    fetchShopData(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filters.page,
    filters.limit,
    filters.sort,
    filters.availability,
    filters.brand,
    filters.minPrice,
    filters.maxPrice,
    filters.query,
    filters.category_id,
  ]);

  const visiblePages = useMemo(() => {
    const current = Number(pagination.current_page || 1);
    const last = Number(pagination.last_page || 1);

    const pages = new Set([1, last, current, current - 1, current + 1]);

    return Array.from(pages)
      .filter((page) => page >= 1 && page <= last)
      .sort((a, b) => a - b);
  }, [pagination]);

  return (
    <main className={styles.shopPage}>
      <section className={styles.archiveSection}>
        <div className={styles.container}>
          <div className={styles.layout}>
            <aside className={styles.sidebar}>
              <div className={styles.filterWrap}>
                <div className={styles.filterGroup}>
                  <div className={styles.label}>
                    <span>Search Products</span>
                  </div>

                  <div className={styles.searchBox}>
                    <input
                      className={styles.input}
                      type="search"
                      value={filters.query}
                      placeholder="Search by name or tags"
                      onChange={(event) =>
                        setFilters((current) => ({
                          ...current,
                          query: event.target.value,
                        }))
                      }
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          applyFilters({
                            query: event.currentTarget.value,
                          });
                        }
                      }}
                    />

                    <button
                      type="button"
                      className={styles.button}
                      onClick={() =>
                        applyFilters({
                          query: filters.query,
                        })
                      }
                    >
                      Search
                    </button>
                  </div>
                </div>

                <div className={styles.filterGroup}>
                  <div className={styles.label}>
                    <span>Price Range</span>
                  </div>

                  <div className={styles.priceGrid}>
                    <input
                      className={styles.input}
                      type="number"
                      min="0"
                      value={priceInputs.minPrice}
                      onChange={(event) =>
                        setPriceInputs((current) => ({
                          ...current,
                          minPrice: event.target.value,
                        }))
                      }
                      placeholder="Min"
                    />

                    <input
                      className={styles.input}
                      type="number"
                      min="0"
                      value={priceInputs.maxPrice}
                      onChange={(event) =>
                        setPriceInputs((current) => ({
                          ...current,
                          maxPrice: event.target.value,
                        }))
                      }
                      placeholder="Max"
                    />
                  </div>

                  <button
                    type="button"
                    className={styles.button}
                    onClick={() =>
                      applyFilters({
                        minPrice: priceInputs.minPrice,
                        maxPrice: priceInputs.maxPrice,
                      })
                    }
                  >
                    Filter
                  </button>
                </div>

                <div className={styles.filterGroup}>
                  <div className={styles.label}>
                    <span>Availability</span>
                  </div>

                  <label className={styles.filterItem}>
                    <input
                      type="radio"
                      name="availability"
                      checked={filters.availability === 'in_stock'}
                      onChange={() =>
                        applyFilters({
                          availability: 'in_stock',
                        })
                      }
                    />
                    <span>In Stock</span>
                  </label>

                  <label className={styles.filterItem}>
                    <input
                      type="radio"
                      name="availability"
                      checked={filters.availability === 'out_stock'}
                      onChange={() =>
                        applyFilters({
                          availability: 'out_stock',
                        })
                      }
                    />
                    <span>Out Stock</span>
                  </label>
                </div>

                {/* <div className={styles.filterGroup}>
                  <div className={styles.label}>
                    <span>Brand</span>
                  </div>

                  {brands.length > 0 ? (
                    brands.map((brand) => (
                      <label className={styles.filterItem} key={brand.id}>
                        <input
                          type="radio"
                          name="brand"
                          value={brand.id}
                          checked={String(filters.brand) === String(brand.id)}
                          onChange={() =>
                            applyFilters({
                              brand: brand.id,
                            })
                          }
                        />
                        <span>{brand.name}</span>
                      </label>
                    ))
                  ) : (
                    <p className={styles.muted}>No brands found.</p>
                  )}
                </div> */}

                {categories.length > 0 && (
                  <div className={styles.filterGroup}>
                    <div className={styles.label}>
                      <span>Categories</span>
                    </div>

                  <div className={styles.categoryScroll}>
                    {categories.map((category) => (
                      <button
                        type="button"
                        key={category.id}
                        className={`${styles.categoryButton} ${
                          String(filters.category_id) === String(category.id)
                            ? styles.activeCategory
                            : ''
                        }`}
                        onClick={() =>
                          applyFilters({
                            category_id: category.id,
                          })
                        }
                      >
                        <span>{category.name}</span>
                        <small>{category.products_count || 0}</small>
                      </button>
                    ))}
                  </div>
                  </div>
                )}

                <button
                  type="button"
                  className={styles.clearButton}
                  onClick={clearFilters}
                >
                  Clear Filters
                </button>
              </div>
            </aside>

            <section className={styles.content}>
              <div className={styles.toolbar}>
                <div>
                  <h1 className={styles.title}>
                    {filters.query ? 'Searching' : 'Shop'}
                  </h1>

                  <p className={styles.count}>
                    {pagination.total} product
                    {pagination.total === 1 ? '' : 's'} found
                  </p>
                </div>

                <div className={styles.shortFilter}>
                  <div className={styles.selectGroup}>
                    <label>Show:</label>

                    <select
                      value={filters.limit}
                      onChange={(event) =>
                        applyFilters({
                          limit: Number(event.target.value),
                        })
                      }
                    >
                      <option value="12">12</option>
                      <option value="22">22</option>
                      <option value="33">33</option>
                    </select>
                  </div>

                  <div className={styles.selectGroup}>
                    <label>Sort by:</label>

                    <select
                      value={filters.sort}
                      onChange={(event) =>
                        applyFilters({
                          sort: event.target.value,
                        })
                      }
                    >
                      <option value="popularity">Popularity</option>
                      <option value="latest">Latest</option>
                      <option value="oldest">Oldest</option>
                      <option value="low">Price Low to High</option>
                      <option value="high">Price High to Low</option>
                    </select>
                  </div>
                </div>
              </div>

              {message && (
                <div
                  className={`${styles.alert} ${
                    message.type === 'success' ? styles.success : styles.error
                  }`}
                >
                  {message.text}
                </div>
              )}

              {loading ? (
                <div className={styles.loadingGrid}>
                  {Array.from({ length: Number(filters.limit || 12) }).map(
                    (_, index) => (
                      <div className={styles.skeletonCard} key={index} />
                    )
                  )}
                </div>
              ) : products.length > 0 ? (
                <div className={styles.productGrid}>
                  {products.map((product) => {
                    const productSlug = product.slug || product.url || '';
                    const productUrl = productSlug ? `/${productSlug}` : '#';

                    const price = product.discount_price || product.unit_price;

                    return (
                      <article className={styles.productCard} key={product.id}>
                        <a href={productUrl} className={styles.imageWrap}>
                          <img
                            src={buildImageUrl(product.thumbnail || product.image)}
                            alt={product.name || 'Product image'}
                            loading="lazy"
                          />
                        </a>

                        <div className={styles.productBody}>
                          {product.brand?.name && (
                            <p className={styles.brandName}>{product.brand.name}</p>
                          )}

                          <h2 className={styles.productName}>
                            <a href={productUrl}>{product.name}</a>
                          </h2>

                          <div className={styles.priceRow}>
                            <strong>{money(price)}</strong>

                            {product.discount_price && (
                              <del>{money(product.unit_price)}</del>
                            )}
                          </div>

                          <p
                            className={
                              Number(product.current_stock || 0) > 0
                                ? styles.inStock
                                : styles.outStock
                            }
                          >
                            {Number(product.current_stock || 0) > 0
                              ? 'In Stock'
                              : 'Out Stock'}
                          </p>

                          <div className={styles.cardActions}>
                            <a href={productUrl} className={styles.detailsButton}>
                              View Details
                            </a>

                            {/* <button
                              type="button"
                              className={styles.wishlistButton}
                              disabled={wishlistLoadingId === product.id}
                              onClick={() => addToWishlist(product.id)}
                              aria-label={`Add ${product.name} to wishlist`}
                            >
                              {wishlistLoadingId === product.id ? '...' : '♡'}
                            </button> */}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className={styles.emptyState}>
                  <strong>⚠ No Products Matched!</strong>
                </div>
              )}

              {pagination.last_page > 1 && (
                <nav className={styles.pagination} aria-label="Product pagination">
                  <button
                    type="button"
                    disabled={pagination.current_page <= 1}
                    onClick={() =>
                      applyFilters({
                        page: Number(pagination.current_page) - 1,
                      })
                    }
                  >
                    Previous
                  </button>

                  {visiblePages.map((page) => (
                    <button
                      type="button"
                      key={page}
                      className={
                        Number(pagination.current_page) === Number(page)
                          ? styles.activePage
                          : ''
                      }
                      onClick={() =>
                        applyFilters({
                          page,
                        })
                      }
                    >
                      {page}
                    </button>
                  ))}

                  <button
                    type="button"
                    disabled={pagination.current_page >= pagination.last_page}
                    onClick={() =>
                      applyFilters({
                        page: Number(pagination.current_page) + 1,
                      })
                    }
                  >
                    Next
                  </button>
                </nav>
              )}
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}