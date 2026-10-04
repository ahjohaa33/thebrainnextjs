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

function productHref(product = {}) {
  const raw = String(product.url || product.slug || '').trim();
  if (!raw) return '#';
  if (/^https?:\/\//i.test(raw)) return raw;
  return raw.startsWith('/') ? raw : `/${raw}`;
}

function parseBrandList(value) {
  const unique = new Map();

  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((item) => {
      const key = item.toLocaleLowerCase();
      if (!unique.has(key)) unique.set(key, item);
    });

  return Array.from(unique.values());
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
  const [searchInput, setSearchInput] = useState(initialParams.query);

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
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

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
    setSearchInput('');

    setPriceInputs({
      minPrice: 10,
      maxPrice: 100000,
    });

    updateUrl(nextFilters);
  }

  const requestSequence = useRef(0);

  async function fetchShopData(activeFilters) {
    const requestId = ++requestSequence.current;

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

      // A quick sequence of filter/search changes can leave multiple requests
      // in flight. Only the newest response is allowed to update the grid.
      if (requestId !== requestSequence.current) return;

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
      if (requestId !== requestSequence.current) return;

      setMessage({
        type: 'error',
        text: error.message || 'Something went wrong while loading products.',
      });
    } finally {
      if (requestId === requestSequence.current) {
        setLoading(false);
      }
    }
  }

  // async function addToWishlist(productId) {
  //   setWishlistLoadingId(productId);
  //   setMessage(null);

  //   try {
  //     const result = await apiRequest('/wishlist', {
  //       method: 'POST',
  //       body: JSON.stringify({
  //         product_id: productId,
  //       }),
  //     });

  //     setMessage({
  //       type: 'success',
  //       text: result.message || 'Product added to wishlist!',
  //     });
  //   } catch (error) {
  //     setMessage({
  //       type: 'error',
  //       text: error.message || 'Product already exists in wishlist.',
  //     });
  //   } finally {
  //     setWishlistLoadingId(null);
  //   }
  // }

  // Track whether the initial server data has already been consumed so the
  // first client-side effect doesn't double-fetch on hydration.
  const initialDataConsumed = useRef(initialData !== null);

  useEffect(() => {
    if (!mobileFilterOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setMobileFilterOpen(false);
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [mobileFilterOpen]);

  useEffect(() => {
    setFilters(initialParams);
    setSearchInput(initialParams.query);

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

  const selectedBrands = useMemo(
    () => parseBrandList(filters.brand),
    [filters.brand]
  );

  const selectedBrandKeys = useMemo(
    () => new Set(selectedBrands.map((brand) => brand.toLocaleLowerCase())),
    [selectedBrands]
  );

  const displayBrands = useMemo(() => {
    const unique = new Map();

    brands.forEach((brand) => {
      const name = String(brand?.name ?? brand?.id ?? brand ?? '').trim();
      if (!name) return;

      unique.set(name.toLocaleLowerCase(), {
        id: brand?.id ?? name,
        name,
      });
    });

    selectedBrands.forEach((name) => {
      const key = name.toLocaleLowerCase();
      if (!unique.has(key)) unique.set(key, { id: name, name });
    });

    return Array.from(unique.values()).sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    );
  }, [brands, selectedBrands]);

  function toggleBrand(brandName) {
    const normalized = String(brandName || '').trim();
    if (!normalized) return;

    const key = normalized.toLocaleLowerCase();
    const nextBrands = selectedBrandKeys.has(key)
      ? selectedBrands.filter((brand) => brand.toLocaleLowerCase() !== key)
      : [...selectedBrands, normalized];

    applyFilters({
      brand: nextBrands.join(','),
    });
  }

  function clearBrandFilter() {
    applyFilters({ brand: '' });
  }

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
            <aside
              className={`${styles.sidebar} ${
                mobileFilterOpen ? styles.sidebarOpen : ''
              }`}
              onClick={() => {
                if (mobileFilterOpen) setMobileFilterOpen(false);
              }}
            >
              <div
                className={styles.filterWrap}
                onClick={(event) => event.stopPropagation()}
              >
                <div className={styles.filterTop}>
                  <h2>Filters</h2>
                  <button
                    type="button"
                    className={styles.closeFilter}
                    onClick={() => setMobileFilterOpen(false)}
                    aria-label="Close filters"
                  >
                    ×
                  </button>
                </div>

                <div className={styles.filterGroup}>
                  <div className={styles.label}>
                    <span>Search Products</span>
                  </div>

                  <div className={styles.searchBox}>
                    <input
                      className={styles.input}
                      type="search"
                      value={searchInput}
                      placeholder="Search by name or tags"
                      onChange={(event) => setSearchInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          applyFilters({
                            query: searchInput.trim(),
                          });
                        }
                      }}
                    />

                    <button
                      type="button"
                      className={styles.button}
                      onClick={() =>
                        applyFilters({
                          query: searchInput.trim(),
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

                  <button
                    type="button"
                    className={styles.mobileFilterButton}
                    onClick={() => setMobileFilterOpen(true)}
                  >
                    Filters
                  </button>
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

              {displayBrands.length > 0 ? (
                <div className={styles.brandBar} aria-label="Filter products by brand">
                  <div className={styles.brandPills}>
                    <span className={styles.brandLabel}>Brand</span>

                    <button
                      type="button"
                      className={`${styles.brandPill} ${
                        selectedBrands.length === 0 ? styles.brandPillActive : ''
                      }`}
                      aria-pressed={selectedBrands.length === 0}
                      onClick={clearBrandFilter}
                    >
                      All
                    </button>

                    {displayBrands.map((brand) => {
                      const brandName = String(brand.name || brand.id || '').trim();
                      const selected = selectedBrandKeys.has(brandName.toLocaleLowerCase());

                      return (
                        <button
                          type="button"
                          key={String(brand.id || brandName)}
                          className={`${styles.brandPill} ${
                            selected ? styles.brandPillActive : ''
                          }`}
                          aria-pressed={selected}
                          onClick={() => toggleBrand(brandName)}
                          title={brandName}
                        >
                          {selected ? '✓ ' : ''}
                          {brandName}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

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
                    const productUrl = productHref(product);

                    const regularPrice = Number(product.price ?? 0);
                    const offerPrice = Number(product.offer_price ?? 0);
                    const hasOffer =
                      regularPrice > 0 &&
                      offerPrice > 0 &&
                      offerPrice < regularPrice;
                    const price = hasOffer ? offerPrice : regularPrice;

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


                          <h2 className={styles.productName}>
                            <a href={productUrl}>{product.name}</a>
                          </h2>

                          <div className={styles.priceRow}>
                            <strong>{money(price)}</strong>

                            {hasOffer && (
                              <del>{money(regularPrice)}</del>
                            )}
                          </div>
{/* 
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
                          </p> */}

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