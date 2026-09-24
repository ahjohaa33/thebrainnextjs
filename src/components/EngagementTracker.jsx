"use client";

import { useEffect } from "react";
import {
  phoneCallClick,
  whatsappClick,
  newsletterSignup,
  addToWishlist,
  compareProducts,
} from "@/lib/analytics";

/**
 * Lightweight global engagement tracker.
 *
 * Why event delegation instead of per-element handlers?
 *   - The Footer is server-rendered (zero JS) and we want to keep it that
 *     way. Adding `onClick` to every <a href="tel:..."> would force the
 *     Footer to become a client component — ~3KB more JS shipped on every
 *     page that includes the footer (i.e. all of them).
 *   - This component mounts once globally (from layout.js, alongside
 *     <Analytics />), attaches a single capture-phase click listener to
 *     `document`, and routes events by their `href` / element type.
 *
 * What it tracks:
 *   - `tel:` link clicks → phone_call_click
 *   - WhatsApp links (wa.me / api.whatsapp.com / whatsapp.com) → whatsapp_click
 *   - <form data-newsletter> submissions → newsletter_signup
 *
 * The listener uses { passive: true, capture: true } so it never interferes
 * with link navigation or form submission.
 */
export default function EngagementTracker() {
  useEffect(() => {
    function findAncestor(el, predicate) {
      let cur = el;
      while (cur && cur !== document.body) {
        if (predicate(cur)) return cur;
        cur = cur.parentElement;
      }
      return null;
    }

    function onClick(event) {
      const target = event.target;
      if (!target || !target.closest) return;

      // Markup-driven actions: any element with data-track-action="..." +
      // optional data-* payload fires the matching analytics call. Lets
      // server-rendered components opt in to tracking without becoming
      // client components.
      const actionEl = target.closest("[data-track-action]");
      if (actionEl) {
        const action = actionEl.dataset.trackAction;
        if (action === "add_to_wishlist") {
          addToWishlist({
            id: actionEl.dataset.itemId || actionEl.dataset.productId,
            name: actionEl.dataset.itemName,
            price: Number(actionEl.dataset.price || 0),
            category: { name: actionEl.dataset.itemCategory },
          });
        } else if (action === "compare_products") {
          const ids = (actionEl.dataset.itemIds || "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
          compareProducts(ids);
        }
      }

      const anchor = target.closest("a[href]");
      if (anchor) {
        const href = anchor.getAttribute("href") || "";
        // Identify the page region for richer GA reporting (e.g. `footer`,
        // `header`, `product_detail`). Falls back to `unknown` if the
        // anchor isn't inside a clearly-tagged ancestor.
        const region =
          findAncestor(anchor, (el) => el.dataset?.trackRegion)?.dataset
            ?.trackRegion ||
          (findAncestor(anchor, (el) => el.tagName === "FOOTER")
            ? "footer"
            : findAncestor(anchor, (el) => el.tagName === "HEADER")
            ? "header"
            : "body");

        if (href.startsWith("tel:")) {
          phoneCallClick({ phone: href.replace(/^tel:/, ""), location: region });
          return;
        }
        if (
          /(?:^|\.)(wa\.me|whatsapp\.com|api\.whatsapp\.com)/i.test(href) ||
          href.startsWith("whatsapp:")
        ) {
          whatsappClick({
            phone: anchor.dataset?.phone || "",
            location: region,
          });
          return;
        }
      }
    }

    function onSubmit(event) {
      const form = event.target;
      if (!form || form.tagName !== "FORM") return;
      // Opt-in marker — any newsletter form should add `data-newsletter` to
      // its <form> tag so we don't mistake search forms for signups.
      if (!form.matches("[data-newsletter]")) return;

      const method = form.dataset?.newsletterMethod || "footer";
      newsletterSignup({ method });
    }

    document.addEventListener("click", onClick, { capture: true, passive: true });
    document.addEventListener("submit", onSubmit, { capture: true });

    return () => {
      document.removeEventListener("click", onClick, { capture: true });
      document.removeEventListener("submit", onSubmit, { capture: true });
    };
  }, []);

  return null;
}
