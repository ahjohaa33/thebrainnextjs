/**
 * Read API-provided product FAQ entries without generating invented content.
 * Result is compatible with both UI FAQ lists and schema.org FAQ builders.
 */
export function getProductFaqItems(product = {}) {
  const data = product && typeof product === "object" ? product : {};
  const raw =
    data.faqs ?? data.faq_items ?? data.faqItems ?? data.product_faqs ?? data.faq ?? [];

  let entries = raw;
  if (typeof entries === "string") {
    try {
      entries = JSON.parse(entries);
    } catch {
      return [];
    }
  }
  if (entries && !Array.isArray(entries) && typeof entries === "object") {
    entries = entries.items ?? entries.faqs ?? entries.data ?? [];
  }
  if (!Array.isArray(entries)) return [];

  return entries.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const question = entry.question ?? entry.q ?? entry.title ?? "";
    const answer = entry.answer ?? entry.a ?? entry.content ?? "";
    if (typeof question !== "string" || typeof answer !== "string") return [];
    if (!question.trim() || !answer.trim()) return [];
    return [{ question: question.trim(), answer: answer.trim() }];
  });
}
