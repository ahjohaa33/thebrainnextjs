/**
 * Product compare-at (MRP) amount.
 *
 * Supports either mrpCompareAt(product, sellingPrice) or
 * mrpCompareAt(compareAtPrice, sellingPrice). Returns zero when there is no
 * genuinely higher comparison price, so the UI won't show a false discount.
 * This helper never changes the amount charged at checkout.
 */
function amount(value) {
  if (value === null || value === undefined || value === "") return 0;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function mrpCompareAt(productOrPrice, selectedSellingPrice) {
  if (!productOrPrice || typeof productOrPrice !== "object") {
    const compareAt = amount(productOrPrice);
    const selling = amount(selectedSellingPrice);
    return compareAt > selling ? compareAt : 0;
  }

  const product = productOrPrice;
  const price = amount(product.price);
  const offer = amount(product.offer_price);
  const selling = amount(
    selectedSellingPrice ??
      (offer && price && offer < price ? offer : price || offer)
  );

  // Explicit MRP/compare-at values take precedence; regular price is only a
  // comparison value when the product is currently offered for less.
  const candidates = [
    product.mrp,
    product.mrp_price,
    product.compare_at_price,
    product.compare_at,
    product.old_price,
    product.regular_price,
    product.unit_price,
    price,
  ];

  for (const candidate of candidates) {
    const candidateAmount = amount(candidate);
    if (candidateAmount > selling) return candidateAmount;
  }
  return 0;
}
