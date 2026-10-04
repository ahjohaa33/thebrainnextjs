"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, API_BASE_URL } from "@/lib/api";
import styles from "./Header.module.css";

const ASSET_BASE_URL = API_BASE_URL.replace(/\/api\/v\d+$/i, "").replace(/\/api$/i, "");
const MIN_QUERY_LENGTH = 2;
const SUGGESTION_LIMIT = 6;

function productHref(product = {}) {
  const raw = String(product.url || product.slug || "").trim();
  if (!raw) return "#";
  if (/^https?:\/\//i.test(raw)) return raw;
  return raw.startsWith("/") ? raw : `/${raw}`;
}

function productImage(product = {}) {
  const raw = String(
    product.thumbnail ||
      product.thumbnail_url ||
      product.image ||
      product.webp ||
      ""
  ).trim();

  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${ASSET_BASE_URL}/${raw.replace(/^\/+/, "")}`;
}

function sellingPrice(product = {}) {
  const regular = Number(product.price ?? 0);
  const offer = Number(product.offer_price ?? 0);
  return offer > 0 && regular > 0 && offer < regular ? offer : regular || offer;
}

function formatPrice(value) {
  const amount = Number(value || 0);
  if (!amount) return "";

  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 0,
  }).format(amount);
}

function searchResultsHref(searchAction, term) {
  const base = String(searchAction || "/shop").trim() || "/shop";
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}query=${encodeURIComponent(term)}`;
}

function SearchIcon() {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

function SuggestionList({
  query,
  suggestions,
  loading,
  onNavigate,
  searchAction,
  mobile = false,
}) {
  const term = query.trim();
  if (term.length < MIN_QUERY_LENGTH) return null;

  return (
    <div
      className={`${styles.searchSuggestions} ${mobile ? styles.mobileSuggestions : ""}`}
      role="listbox"
      aria-label="Product suggestions"
    >
      {loading ? (
        <div className={styles.searchStatus}>Searching products…</div>
      ) : suggestions.length > 0 ? (
        <>
          {suggestions.map((product) => {
            const href = productHref(product);
            const image = productImage(product);
            const price = formatPrice(sellingPrice(product));

            return (
              <Link
                key={product.id || product.slug || href}
                href={href}
                className={styles.searchSuggestionItem}
                onClick={onNavigate}
                role="option"
              >
                <span className={styles.searchSuggestionThumb} aria-hidden="true">
                  {image ? <img src={image} alt="" loading="lazy" decoding="async" /> : null}
                </span>

                <span className={styles.searchSuggestionText}>
                  <strong>{product.name || "Product"}</strong>
                  {product.brand_name ? <small>{product.brand_name}</small> : null}
                </span>

                {price ? <span className={styles.searchSuggestionPrice}>{price}</span> : null}
              </Link>
            );
          })}
        </>
      ) : (
        <div className={styles.searchStatus}>No matching products found.</div>
      )}

      <Link
        href={searchResultsHref(searchAction, term)}
        className={styles.searchAllResults}
        onClick={onNavigate}
      >
        See all results for “{term}”
      </Link>
    </div>
  );
}

export default function HeaderSearch({ searchAction = "/shop" }) {
  const router = useRouter();
  const rootRef = useRef(null);
  const requestSequence = useRef(0);

  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeSearch = () => {
    setDesktopOpen(false);
    setMobileOpen(false);
  };

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setDesktopOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") closeSearch();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    const term = query.trim();

    if (term.length < MIN_QUERY_LENGTH) {
      requestSequence.current += 1;
      setSuggestions([]);
      setLoading(false);
      return;
    }

    const timer = window.setTimeout(async () => {
      const requestId = ++requestSequence.current;
      setLoading(true);

      try {
        const params = new URLSearchParams({
          query: term,
          limit: String(SUGGESTION_LIMIT),
          page: "1",
          sort: "popularity",
        });

        const result = await apiRequest(`/shop?${params.toString()}`);
        if (requestId !== requestSequence.current) return;

        setSuggestions(Array.isArray(result?.products?.data) ? result.products.data : []);
      } catch {
        if (requestId !== requestSequence.current) return;
        setSuggestions([]);
      } finally {
        if (requestId === requestSequence.current) setLoading(false);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [query]);

  function submitSearch(event) {
    event.preventDefault();
    const term = query.trim();
    if (!term) return;

    closeSearch();
    router.push(searchResultsHref(searchAction, term));
  }

  return (
    <div className={styles.searchShell} ref={rootRef}>
      <form className={styles.search} onSubmit={submitSearch} role="search">
        <input
          type="search"
          value={query}
          className={styles.searchInput}
          placeholder="Search products"
          autoComplete="off"
          aria-label="Search products"
          onChange={(event) => {
            setQuery(event.target.value);
            setDesktopOpen(true);
          }}
          onFocus={() => setDesktopOpen(true)}
        />
        <button type="submit" className={styles.searchBtn} aria-label="Search">
          <SearchIcon />
        </button>
      </form>

      <button
        type="button"
        className={styles.mobileSearchToggle}
        aria-label={mobileOpen ? "Close product search" : "Search products"}
        aria-expanded={mobileOpen}
        onClick={() => {
          setMobileOpen((open) => !open);
          setDesktopOpen(false);
        }}
      >
        <SearchIcon />
      </button>

      {desktopOpen && !mobileOpen ? (
        <SuggestionList
          query={query}
          suggestions={suggestions}
          loading={loading}
          onNavigate={closeSearch}
          searchAction={searchAction}
        />
      ) : null}

      {mobileOpen ? (
        <div className={styles.mobileSearchPanel}>
          <form className={styles.mobileSearchForm} onSubmit={submitSearch} role="search">
            <input
              type="search"
              value={query}
              className={styles.mobileSearchInput}
              placeholder="Search products"
              autoComplete="off"
              autoFocus
              aria-label="Search products"
              onChange={(event) => setQuery(event.target.value)}
            />
            <button type="submit" className={styles.mobileSearchSubmit} aria-label="Search">
              <SearchIcon />
            </button>
          </form>

          <SuggestionList
            query={query}
            suggestions={suggestions}
            loading={loading}
            onNavigate={closeSearch}
            searchAction={searchAction}
            mobile
          />
        </div>
      ) : null}
    </div>
  );
}
