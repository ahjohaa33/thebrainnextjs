#!/usr/bin/env sh
# Run from the deployed Next.js project root AFTER extracting the update ZIP.
set -eu
if [ ! -f package.json ] || [ ! -d src/app ]; then
  echo 'Run this script from the Next.js project root after extracting the ZIP.' >&2
  exit 1
fi
rm -f next.config.mjs src/middleware.js
echo 'Removed obsolete next.config.mjs and src/middleware.js (if present).'
echo 'Next: npm install; npm run build; staging smoke tests; deploy; warm URLs.'
