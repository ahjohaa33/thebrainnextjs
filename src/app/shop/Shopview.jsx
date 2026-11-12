'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { API_BASE_URL } from '@/lib/api';
import styles from './shopPage.module.css';
import { buildShopQuery, isShopCatalogPayload, parseBrandList, readShopFilters } from './shop-query.mjs';

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

function initialPagination(data, limit = 12) {
  return {
    current_page: Number(data?.products?.current_page || 1),
    last_page: Number(data?.products?.last_page || 1),
    per_page: Number(data?.products?.per_page || limit),
    total: Number(data?.products?.total || 0),
  };
}

export default function ShopView({ initialData = null, initialDataQuery = '' }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // The URL is the sole committed source of shop filters. This fixes the
  // setFilters/router.push synchronization race on filter changes and Back.
  const queryKey = useMemo(() => buildShopQuery(searchParams).toString(), [searchParams]);
  const filters = useMemo(() => readShopFilters(searchParams), [queryKey]);
  const pendingFilters = useRef(null);

  const [searchInput, setSearchInput] = useState(filters.query);
  const [priceInputs, setPriceInputs] = useState({
    minPrice: filters.minPrice || 10,
    maxPrice: filters.maxPrice || 100000,
  });

  const [products, setProducts] = useState(initialData?.products?.data || []);
  const [brands, setBrands] = useState(initialData?.brands || []);
  const [categories, setCategories] = useState(initialData?.categories || []);
  const [pagination, setPagination] = useState(initialPagination(initialData, filters.limit));
  const [loading, setLoading] = useState(initialData === null);
  const [message, setMessage] = useState(null);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  function updateUrl(nextFilters) {
    const nextQuery = buildShopQuery(nextFilters).toString();
    if (nextQuery === queryKey && pendingFilters.current === null) return;

    pendingFilters.current = nextFilters;
    setLoading(true);
    setMessage(null);
    router.push(`/shop${nextQuery ? `?${nextQuery}` : ''}`, { scroll: false });
  }

  function applyFilters(patch) {
    // Until Next finishes a navigation, additional brand clicks must build on
    // the pending selection instead of overwriting each other.
    const previous = pendingFilters.current || filters;
    const next = readShopFilters({
      ...previous,
      ...patch,
      page: Object.prototype.hasOwnProperty.call(patch, 'page') ? patch.page : 1,
    });
    updateUrl(next);
  }

  function clearFilters() {
    const previous = pendingFilters.current || filters;
    setSearchInput('');
    setPriceInputs({ minPrice: 10, maxPrice: 100000 });
    updateUrl(readShopFilters({ limit: previous.limit, sort: previous.sort }));
  }

  // The server has already fetched this exact URL through the shared public catalog cache. Use
  // its result after each navigation instead of keeping the initial SSR data
  // forever or issuing a second identical browser request.
  // Only fall back to the browser proxy if the server fetch failed.
  useEffect(() => {
    const controller = new AbortController();
    // Do not discard a newer filter selection when an older navigation
    // commits first. Consecutive brand clicks must remain additive.
    if (!pendingFilters.current ||
        buildShopQuery(pendingFilters.current).toString() === queryKey) {
      pendingFilters.current = null;
    }
    setSearchInput(filters.query);
    setPriceInputs({
      minPrice: filters.minPrice || 10,
      maxPrice: filters.maxPrice || 100000,
    });

    const acceptResult = (result) => {
      if (!isShopCatalogPayload(result)) {
        throw new Error('Shop API returned an unexpected product response. Please retry.');
      }
      // Products still exist, but the requested page disappeared (e.g. stock
      // changed while the customer was on page 3). Return to the first page
      // instead of displaying a misleading "No Products Matched" message.
      if (result.products.data.length === 0 &&
          Number(result.products.total) > 0 &&
          Number(result.products.current_page) > Number(result.products.last_page) &&
          Number(result.products.current_page) > 1) {
        const firstPage = buildShopQuery({ ...filters, page: 1 }).toString();
        router.replace(`/shop${firstPage ? `?${firstPage}` : ''}`, { scroll: false });
        return;
      }
      setProducts(result.products.data);
      setBrands(Array.isArray(result?.brands) ? result.brands : []);
      setCategories(Array.isArray(result?.categories) ? result.categories : []);
      setPagination(initialPagination(result, filters.limit));
      setMessage(null);
      setLoading(false);
    };

    if (initialData && initialDataQuery === queryKey) {
      acceptResult(initialData);
      return () => controller.abort();
    }

    setLoading(true);
    setMessage(null);
    fetch(`/api/catalog/shop?${queryKey}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data?.message || `HTTP ${response.status}`);
        return data;
      })
      .then((result) => {
        if (!controller.signal.aborted) acceptResult(result);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        // Keep the last valid data; an API failure is NOT a zero-product match.
        setMessage({
          type: 'error',
          text: `Could not refresh products. ${error.message || 'Please try again.'} Previous results may still be shown.`,
        });
        setLoading(false);
      });

    return () => controller.abort();
  // Only the URL and matching server response trigger a new data application.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey, initialData, initialDataQuery]);

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

    const currentlySelected = parseBrandList((pendingFilters.current || filters).brand);
    const key = normalized.toLocaleLowerCase();
    const selected = currentlySelected.some((brand) => brand.toLocaleLowerCase() === key);
    const nextBrands = selected
      ? currentlySelected.filter((brand) => brand.toLocaleLowerCase() !== key)
      : [...currentlySelected, normalized];

    applyFilters({ brand: nextBrands.join(',') });
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
                        onClick={() => {
                          // A category selection starts a fresh category view;
                          // product facets are storewide and must not silently
                          // override the category the customer just selected.
                          setSearchInput('');
                          setPriceInputs({ minPrice: 10, maxPrice: 100000 });
                          applyFilters({
                            category_id: category.id,
                            brand: '',
                            minPrice: '',
                            maxPrice: '',
                            availability: '',
                            query: '',
                          });
                        }}
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
                      <option value="100">100</option>
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


                          <div className={styles.cardActions}>
                            <a href={productUrl} className={styles.detailsButton}>
                              View Details
                            </a>


                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : message?.type === 'error' ? null : (
                <div className={styles.emptyState}>
                  <strong>⚠ No Products Matched!</strong>
                </div>
              )}

              {message?.type !== 'error' && pagination.last_page > 1 && (
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