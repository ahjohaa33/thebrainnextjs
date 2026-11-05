/**
 * Checkout shipping rates are configured in Laravel, not in Next.js.
 *
 * The existing API exposes the charge for ONE shipping method at a time in
 * POST /cart/shipping. Query the other method first, then restore the original
 * method so the customer's saved cart is left with their chosen selection.
 * No hardcoded delivery amounts or new backend endpoints are required.
 */

export const SHIPPING_METHODS = [
  { value: "inside_dhaka", label: "Inside Dhaka", icon: "🏙️" },
  { value: "outside_dhaka", label: "Outside Dhaka", icon: "🚚" },
];

export function normalizeShippingType(value) {
  return SHIPPING_METHODS.some((method) => method.value === value)
    ? value
    : "inside_dhaka";
}

export function numericAmount(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export function shippingCostFromResponse(payload) {
  return numericAmount(
    payload?.data?.summary?.shipping_cost ??
      payload?.data?.shipping_cost ??
      payload?.summary?.shipping_cost ??
      payload?.shipping_cost
  );
}

export async function setCartShipping(request, shippingType) {
  const payload = await request("/cart/shipping", {
    method: "POST",
    body: JSON.stringify({ shipping_type: shippingType }),
  });

  const cost = shippingCostFromResponse(payload);
  if (cost === null) {
    throw new Error("The shipping API did not return a valid delivery charge.");
  }
  return { cost, payload };
}

export async function loadShippingRates(request, selectedType) {
  const selected = normalizeShippingType(selectedType);
  const other = selected === "inside_dhaka" ? "outside_dhaka" : "inside_dhaka";

  let otherQuote = null;
  let otherError = null;
  try {
    otherQuote = await setCartShipping(request, other);
  } catch (error) {
    otherError = error;
  }

  // Always attempt to restore the selected method, including when the other
  // quote fails. This avoids leaving the cart on an unexpected shipping type.
  const selectedQuote = await setCartShipping(request, selected);
  if (otherError) throw otherError;

  return {
    selectedType: selected,
    selectedCost: selectedQuote.cost,
    rates: {
      [other]: otherQuote.cost,
      [selected]: selectedQuote.cost,
    },
  };
}
