"use client";

import { useMemo, useState } from "react";
import {
  buildLaravelRouteStub,
  fillEndpointPath,
} from "@/lib/api-catalog";
import styles from "./apiPanel.module.css";

const LAYER_LABELS = {
  "laravel-api": "Laravel API",
  "laravel-web": "Laravel Web",
  "next-internal": "Next Internal",
  "external-unused": "Dormant / External",
};

function endpointBase(endpoint, apiBaseUrl, webBaseUrl) {
  if (endpoint.layer === "laravel-api") return apiBaseUrl;
  if (endpoint.layer === "laravel-web") return webBaseUrl;
  if (endpoint.layer === "next-internal") return "";
  return "";
}

function buildDisplayUrl(endpoint, apiBaseUrl, webBaseUrl, values, queryValues) {
  const path = fillEndpointPath(endpoint, values);
  const base = endpointBase(endpoint, apiBaseUrl, webBaseUrl);
  const raw = /^https?:\/\//i.test(path) ? path : `${base}${path}`;
  const params = new URLSearchParams();
  Object.entries(queryValues || {}).forEach(([key, value]) => {
    if (String(value || "").trim()) params.set(key, String(value).trim());
  });
  const qs = params.toString();
  return qs ? `${raw}?${qs}` : raw;
}

function CopyButton({ text, children = "Copy" }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text || "");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }
  return (
    <button type="button" className={styles.ghostButton} onClick={copy} disabled={!text}>
      {copied ? "Copied" : children}
    </button>
  );
}

function EndpointCard({ endpoint, apiBaseUrl, webBaseUrl }) {
  const initialQuery = endpoint.exampleQuery || {};
  const [pathValues, setPathValues] = useState({});
  const [queryValues, setQueryValues] = useState(initialQuery);
  const [probe, setProbe] = useState(null);
  const [probing, setProbing] = useState(false);

  const displayUrl = buildDisplayUrl(
    endpoint,
    apiBaseUrl,
    webBaseUrl,
    pathValues,
    queryValues
  );
  const routeStub = buildLaravelRouteStub(endpoint);
  const missingPath = (endpoint.pathParams || []).some(
    (key) => !String(pathValues[key] || "").trim()
  );

  async function runProbe() {
    if (!endpoint.safeProbe || endpoint.method !== "GET" || missingPath) return;
    setProbing(true);
    setProbe(null);
    const started = performance.now();
    try {
      const res = await fetch("/api/system/api-panel/probe", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          endpointId: endpoint.id,
          pathParams: pathValues,
          query: queryValues,
        }),
      });
      const data = await res.json();
      setProbe({ ...data, panelStatus: res.status, elapsedMs: Math.round(performance.now() - started) });
    } catch (error) {
      setProbe({ ok: false, error: error?.message || "Probe failed" });
    } finally {
      setProbing(false);
    }
  }

  return (
    <article className={styles.card} id={`endpoint-${endpoint.id}`}>
      <div className={styles.cardTop}>
        <div className={styles.methodRow}>
          <span className={`${styles.method} ${styles[`method${endpoint.method.replace(/\W/g, "")}`] || ""}`}>
            {endpoint.method}
          </span>
          <span className={styles.layer}>{LAYER_LABELS[endpoint.layer] || endpoint.layer}</span>
          <span className={styles.status}>{endpoint.status}</span>
        </div>
        <h2>{endpoint.path}</h2>
        <p className={styles.transport}>{endpoint.transport}</p>
      </div>

      <div className={styles.urlBar}>
        <code>{displayUrl || endpoint.path}</code>
        <CopyButton text={displayUrl}>Copy URL</CopyButton>
      </div>

      {(endpoint.pathParams?.length || endpoint.query?.length) ? (
        <div className={styles.builder}>
          {endpoint.pathParams?.length ? (
            <div className={styles.builderSection}>
              <h3>Path parameters</h3>
              <div className={styles.inputGrid}>
                {endpoint.pathParams.map((key) => (
                  <label key={key}>
                    <span>{key}</span>
                    <input
                      value={pathValues[key] || ""}
                      onChange={(event) =>
                        setPathValues((prev) => ({ ...prev, [key]: event.target.value }))
                      }
                      placeholder={`Enter ${key}`}
                    />
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          {endpoint.query?.length ? (
            <div className={styles.builderSection}>
              <h3>Query parameters</h3>
              <div className={styles.inputGrid}>
                {endpoint.query.map((key) => (
                  <label key={key}>
                    <span>{key}</span>
                    <input
                      value={queryValues[key] || ""}
                      onChange={(event) =>
                        setQueryValues((prev) => ({ ...prev, [key]: event.target.value }))
                      }
                      placeholder="optional"
                      disabled={key.includes("*")}
                      title={key.includes("*") ? "Dynamic attribute filters are forwarded by the storefront; use the real category page to exercise them." : undefined}
                    />
                  </label>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className={styles.contractGrid}>
        <div><span>Used by</span><strong>{(endpoint.usedBy || []).join(" · ") || "—"}</strong></div>
        <div><span>Request</span><strong>{endpoint.request || "—"}</strong></div>
        <div><span>Expected response</span><strong>{endpoint.response || "—"}</strong></div>
        <div><span>Cache/session</span><strong>{[endpoint.cache, endpoint.session].filter(Boolean).join(" · ") || "—"}</strong></div>
      </div>

      {endpoint.body ? (
        <details className={styles.details}>
          <summary>Request body contract</summary>
          <pre>{JSON.stringify(endpoint.body, null, 2)}</pre>
        </details>
      ) : null}

      {endpoint.notes ? <p className={styles.notes}>{endpoint.notes}</p> : null}

      <div className={styles.actions}>
        {endpoint.safeProbe && endpoint.method === "GET" ? (
          <button
            type="button"
            className={styles.primaryButton}
            onClick={runProbe}
            disabled={probing || missingPath}
          >
            {probing ? "Testing…" : missingPath ? "Fill path params to test" : "Test read-only endpoint"}
          </button>
        ) : (
          <span className={styles.mutationNote}>Live mutation/session probing disabled by design.</span>
        )}
        {routeStub ? <CopyButton text={routeStub}>Copy Laravel route stub</CopyButton> : null}
      </div>

      {probe ? (
        <div className={`${styles.probe} ${probe.ok ? styles.probeOk : styles.probeError}`}>
          <div className={styles.probeHeader}>
            <strong>{probe.ok ? "Reachable" : "Probe failed"}</strong>
            <span>{probe.upstreamStatus ? `HTTP ${probe.upstreamStatus}` : ""} {probe.elapsedMs ? `· ${probe.elapsedMs} ms` : ""}</span>
          </div>
          <pre>{JSON.stringify(probe.body ?? probe.error ?? probe, null, 2)}</pre>
        </div>
      ) : null}
    </article>
  );
}

export default function ApiPanelClient({ endpoints, apiBaseUrl, webBaseUrl, production }) {
  const [search, setSearch] = useState("");
  const [layer, setLayer] = useState("all");
  const [group, setGroup] = useState("all");

  const groups = useMemo(
    () => [...new Set(endpoints.map((endpoint) => endpoint.group))].sort(),
    [endpoints]
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return endpoints.filter((endpoint) => {
      if (layer !== "all" && endpoint.layer !== layer) return false;
      if (group !== "all" && endpoint.group !== group) return false;
      if (!needle) return true;
      return JSON.stringify(endpoint).toLowerCase().includes(needle);
    });
  }, [endpoints, search, layer, group]);

  const activeLaravel = endpoints.filter((e) => e.layer === "laravel-api" && e.status.startsWith("active")).length;
  const mutations = endpoints.filter((e) => e.layer === "laravel-api" && !["GET", "HEAD"].includes(e.method)).length;
  const feeds = endpoints.filter((e) => e.layer === "laravel-web").length;

  function exportContract() {
    const payload = {
      generatedAt: new Date().toISOString(),
      apiBaseUrl,
      webBaseUrl,
      endpoints,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ponnobd-api-contract.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.hero}>
          <div>
            <span className={styles.eyebrow}>Ponnobd developer workbench</span>
            <h1>API Integration Panel</h1>
            <p>
              Traced from the current Next.js codebase. This panel is additive: it documents,
              builds and safely tests endpoints without changing storefront request routing.
            </p>
          </div>
          <button type="button" className={styles.exportButton} onClick={exportContract}>
            Export JSON contract
          </button>
        </header>

        {production ? (
          <div className={styles.warning}>
            Production panel is enabled. Disable <code>API_PANEL_ENABLED</code> after integration work unless this route is protected upstream.
          </div>
        ) : null}

        <section className={styles.baseGrid}>
          <div><span>Laravel API base</span><code>{apiBaseUrl}</code></div>
          <div><span>Laravel web/feed base</span><code>{webBaseUrl}</code></div>
        </section>

        <section className={styles.stats}>
          <div><strong>{activeLaravel}</strong><span>active Laravel API endpoints</span></div>
          <div><strong>{mutations}</strong><span>Laravel mutations</span></div>
          <div><strong>{feeds}</strong><span>Laravel public feeds</span></div>
          <div><strong>{endpoints.length}</strong><span>total traced nodes</span></div>
        </section>

        <section className={styles.filters}>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search path, component, request field, response field…"
            aria-label="Search API endpoints"
          />
          <select value={layer} onChange={(event) => setLayer(event.target.value)} aria-label="Filter by layer">
            <option value="all">All layers</option>
            {Object.entries(LAYER_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select>
          <select value={group} onChange={(event) => setGroup(event.target.value)} aria-label="Filter by group">
            <option value="all">All groups</option>
            {groups.map((value) => <option value={value} key={value}>{value}</option>)}
          </select>
        </section>

        <div className={styles.resultCount}>{filtered.length} endpoint nodes shown</div>
        <section className={styles.cards}>
          {filtered.map((endpoint) => (
            <EndpointCard key={endpoint.id} endpoint={endpoint} apiBaseUrl={apiBaseUrl} webBaseUrl={webBaseUrl} />
          ))}
        </section>
      </div>
    </main>
  );
}
