// Preserve older /about links after the page moved to /about-us.
import { permanentRedirect } from 'next/navigation';
export default function LegacyAboutRedirect() { permanentRedirect('/about-us'); }
