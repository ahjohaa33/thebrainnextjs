'use client';

import { useEffect } from 'react';

/**
 * A lightweight deterrent against casual browser inspection.
 * It runs on production hosts and on local/private development hosts so the
 * same interaction can be checked locally. This is not a security boundary;
 * API authorization and server-side controls must protect application data.
 */
function isLocalDevelopmentHost(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');

  if (host === 'localhost' || host.endsWith('.localhost') || host === '::1') {
    return true;
  }

  // Also cover loopback and RFC1918 IPv4 addresses used for local/LAN testing.
  const octets = host.split('.');
  if (octets.length !== 4 || octets.some((part) => !/^\d{1,3}$/.test(part))) {
    return false;
  }

  const numbers = octets.map(Number);
  if (numbers.some((part) => part < 0 || part > 255)) return false;

  const [first, second] = numbers;
  return first === 10 ||
    first === 127 ||
    (first === 192 && second === 168) ||
    (first === 172 && second >= 16 && second <= 31);
}

export default function DisableInspection() {
  useEffect(() => {
    const isProduction = process.env.NODE_ENV === 'production';
    const isLocalHost = isLocalDevelopmentHost(window.location.hostname);

    // Do not interfere with remote preview/dev hosts, but allow localhost and
    // private-LAN development testing as well as all production deployments.
    if (!isProduction && !isLocalHost) return undefined;

    const preventContextMenu = (event) => {
      event.preventDefault();
    };

    const preventInspectionShortcuts = (event) => {
      const key = String(event.key || '').toLowerCase();
      const modifier = event.ctrlKey || event.metaKey;
      const shift = event.shiftKey;

      const blocked =
        key === 'f12' ||
        (modifier && !shift && key === 'u') ||
        (modifier && shift && ['i', 'j', 'c', 'k', 'm'].includes(key));

      if (blocked) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    document.addEventListener('contextmenu', preventContextMenu, true);
    window.addEventListener('keydown', preventInspectionShortcuts, true);

    return () => {
      document.removeEventListener('contextmenu', preventContextMenu, true);
      window.removeEventListener('keydown', preventInspectionShortcuts, true);
    };
  }, []);

  return null;
}
