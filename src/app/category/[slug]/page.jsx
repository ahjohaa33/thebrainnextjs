// Preserve indexed /category/<slug> links. Canonical category rendering
// remains the existing /[slug] storefront resolver.
import { permanentRedirect } from 'next/navigation';
export default async function LegacyCategoryRedirect({ params, searchParams }) {
  const { slug } = await params;
  const filters = (await searchParams) || {};
  const query = new URLSearchParams();
  for (const [name, value] of Object.entries(filters)) {
    if (typeof value === 'string') query.set(name, value);
  }
  permanentRedirect(`/${encodeURIComponent(slug)}${query.size ? `?${query.toString()}` : ''}`);
}
