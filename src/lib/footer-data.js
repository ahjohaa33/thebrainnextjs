// lib/footer-data.js
//
// Extracted from Footer.jsx so any page (e.g. /contact-us) can pull the
// same CMS-driven showroom/contact info without duplicating the fetch +
// ISR config, and without staying in sync by hand.

import { apiUrl } from "@/lib/config";

export async function getFooterData() {
  try {
    const res = await fetch(apiUrl("/footer"), {
      headers: {
        Accept: "application/json",
      },
      next: { revalidate: 3600, tags: ["footer"] },
    });

    if (!res.ok) return null;

    const json = await res.json();

    return json?.success && json?.data ? json.data : null;
  } catch (error) {
    console.error("[footer-data] Failed to load footer data", error);
    return null;
  }
}

export function normalizePhoneForTel(phone = "") {
  return String(phone).replace(/[^\d+]/g, "");
}
