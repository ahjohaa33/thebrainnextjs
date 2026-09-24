"use client";

import styles from "./FloatingWhatsApp.module.css";
import { SALES_WHATSAPP_DIGITS, SALES_WHATSAPP_E164 } from "@/lib/config";

/**
 * Site-wide floating WhatsApp button.
 *
 * Always-on, fixed to the bottom-right of the viewport. Clicking it opens
 * a WhatsApp chat with our sales representative pre-filled with a short
 * intro message. Rendered once from the root layout so it appears on
 * every page.
 *
 * The site already has a delegated click listener in <EngagementTracker />
 * that fires the `whatsapp_click` analytics event for any `wa.me` link,
 * so this button gets tracked automatically — no per-component wiring
 * needed here.
 */
export default function FloatingWhatsApp() {
  const greeting = "Hi! I have a question about a product on Ponnobd.";
  const href = `https://wa.me/${SALES_WHATSAPP_DIGITS}?text=${encodeURIComponent(
    greeting
  )}`;

  return (
    <a
      href={href}
      className={styles.fab}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Chat with our sales team on WhatsApp at ${SALES_WHATSAPP_E164}`}
      data-location="floating_fab"
    >
      <span className={styles.pulse} aria-hidden="true" />
      <svg
        className={styles.icon}
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        <path
          fill="currentColor"
          d="M20.52 3.48A11.79 11.79 0 0 0 12.15 0C5.62 0 .31 5.31.31 11.84c0 2.09.55 4.13 1.59 5.93L.21 24l6.38-1.67a11.83 11.83 0 0 0 5.56 1.42h.01c6.53 0 11.84-5.31 11.84-11.84 0-3.16-1.23-6.14-3.48-8.43ZM12.16 21.75h-.01a9.82 9.82 0 0 1-5.01-1.37l-.36-.22-3.79.99 1.01-3.69-.24-.38a9.83 9.83 0 0 1-1.5-5.24C2.26 6.41 6.72 2 12.15 2a9.8 9.8 0 0 1 6.98 2.9 9.79 9.79 0 0 1 2.9 7.01c0 5.43-4.42 9.84-9.87 9.84Zm5.4-7.37c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.46-.88-.78-1.47-1.75-1.65-2.04-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35Z"
        />
      </svg>
      <span className={styles.srOnly}>Chat on WhatsApp</span>
    </a>
  );
}
