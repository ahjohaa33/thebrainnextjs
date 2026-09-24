"use client";

import { useEffect, useState, useCallback } from "react";
import styles from "./PwaInstaller.module.css";

/**
 * PWA install shortcut.
 *
 * Two responsibilities:
 *   1. Register the service worker (public/sw.js) on load. This + the
 *      manifest (app/manifest.js) is what makes the site installable.
 *   2. Render a custom "Install app" button.
 *        - Chrome / Edge / Android: we intercept the `beforeinstallprompt`
 *          event, stash it, and replay it when the user taps our button.
 *          This gives us a branded button instead of relying on the browser's
 *          hidden mini-infobar.
 *        - iOS Safari: there is no install event. We detect iOS + Safari and
 *          show a short "Add to Home Screen" hint instead.
 *
 * The button hides itself automatically when the app is already installed
 * (running in standalone display mode) or once installation completes.
 */
export default function PwaInstaller() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);
  const [isIos, setIsIos] = useState(false);

  // Register the service worker once, after the page is interactive.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((err) => console.error("[pwa] SW registration failed:", err));
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    return () => window.removeEventListener("load", register);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Already installed / launched from the home screen → never show the CTA.
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;
    if (standalone) return;

    // iOS detection (iPhone/iPad, including iPadOS that masquerades as Mac).
    const ua = window.navigator.userAgent || "";
    const iosDevice =
      /iphone|ipad|ipod/i.test(ua) ||
      (/Macintosh/.test(ua) && "ontouchend" in document);
    const isSafari = /^((?!chrome|crios|fxios|android).)*safari/i.test(ua);

    if (iosDevice && isSafari) {
      // iOS can't auto-prompt; surface the manual button immediately.
      setIsIos(true);
      setVisible(true);
    }

    // Chrome/Edge/Android: capture the install prompt for later replay.
    const onBeforeInstallPrompt = (e) => {
      e.preventDefault(); // stop the default mini-infobar
      setDeferredPrompt(e);
      setVisible(true);
    };

    // Hide + clean up once the app is installed.
    const onInstalled = () => {
      setVisible(false);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const handleClick = useCallback(async () => {
    // iOS: no programmatic prompt — toggle the Add-to-Home-Screen hint.
    if (isIos) {
      setShowIosHint((v) => !v);
      return;
    }
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    try {
      await deferredPrompt.userChoice;
    } finally {
      // The prompt can only be used once; drop it regardless of the outcome.
      setDeferredPrompt(null);
      setVisible(false);
    }
  }, [deferredPrompt, isIos]);

  if (!visible) return null;

  return (
    <div className={styles.wrap}>
      {showIosHint && (
        <div className={styles.iosHint} role="status">
          Tap the Share icon, then{" "}
          <strong>&ldquo;Add to Home Screen&rdquo;</strong> to install.
          <button
            type="button"
            className={styles.dismiss}
            aria-label="Dismiss"
            onClick={() => setVisible(false)}
          >
            ×
          </button>
        </div>
      )}

      <button
        type="button"
        className={styles.installBtn}
        onClick={handleClick}
        aria-label="Install Ponnobd app"
        data-location="pwa_install"
      >
        <img
          src="/favicon.ico"
          alt=""
          className={styles.icon}
          aria-hidden="true"
        />
        <span>Install app</span>
      </button>
    </div>
  );
}
