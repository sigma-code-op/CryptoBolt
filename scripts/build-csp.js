#!/usr/bin/env node
// ---------------------------------------------------------------------------
// CryptoBolt: Content-Security-Policy build step.
//
// The site is fully static (see scripts/build-js.js), so there's no server to
// hand-set a CSP HTTP header on every deployment target listed in README.md
// ("any static host"). A <meta http-equiv="Content-Security-Policy"> tag
// works the same everywhere with zero hosting-specific config, so that's
// what this script maintains.
//
// Every executable inline <script> has been extracted to its own file under
// js/ (see js/consent-default.js, js/footer-year.js, js/contact-form.js,
// js/terms-date.js, js/index-ticker-ribbon.js, js/index-ai-status.js,
// js/ramp-return.js) specifically so script-src does NOT need
// 'unsafe-inline' — an injected inline <script> or onXXX handler (the most
// common ways stored/reflected XSS runs) is simply refused by the browser,
// which matters here because a Groq API key and a Supabase session both live
// in localStorage (see js/10-ai-insight.js, js/17-auth.js).
//
// The only inline <script> blocks left in the HTML are static JSON-LD
// (application/ld+json) structured-data blocks. Those are allow-listed by
// exact SHA-256 hash (computed below from the committed HTML) rather than
// 'unsafe-inline', so injecting a new inline script still fails even though
// these specific, unchanging blocks are allowed to run. Editing a JSON-LD
// block's content changes its hash — re-run `npm run build:csp` and commit
// the result (the "CSP is up to date" CI check mirrors the existing
// Tailwind/JS-bundle staleness checks and will fail the build otherwise).
//
// style-src still needs 'unsafe-inline': the site uses one-off inline
// style="..." attributes throughout (fine — CSS alone can't read
// localStorage or make a cross-origin request) and js/cookie-consent.js
// injects a <style> element at runtime for the cookie banner. Locking that
// down too would mean rewriting every inline style into a class, which is a
// separate, much larger change.
//
// frame-ancestors and the Report-Only reporting endpoints aren't set here —
// meta-tag CSP can't express frame-ancestors at all (browsers ignore it in
// <meta>), so if this deployment ever moves to a host that lets you set
// custom HTTP response headers (an .htaccess Header directive, a Netlify
// _headers file, a Vercel vercel.json, etc.), add
// "X-Frame-Options: SAMEORIGIN" / "Content-Security-Policy: frame-ancestors 'self'"
// there as well — that's real defense-in-depth this script can't provide.
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Every third-party origin the frontend actually talks to (checked against
// js/*.js and the <script src>/<link href> tags in the HTML — see the
// comment above each group). Keep this in sync if a new integration is
// added; nothing here is guessed.
const SCRIPT_SRC = [
  "'self'",
  'https://www.googletagmanager.com', // gtag.js
  'https://pagead2.googlesyndication.com', // adsbygoogle.js
  'https://cdn.jsdelivr.net', // @supabase/supabase-js
  'https://unpkg.com', // lightweight-charts
];

const STYLE_SRC = [
  "'self'",
  "'unsafe-inline'", // inline style="" attributes + js/cookie-consent.js's injected <style> — see file header
  'https://fonts.googleapis.com',
];

const FONT_SRC = ["'self'", 'https://fonts.gstatic.com', 'data:'];

const IMG_SRC = ["'self'", 'data:', 'https://pagead2.googlesyndication.com', 'https://www.googletagmanager.com'];

// Live price/chart data (Binance REST + WS, CoinGecko, alternative.me Fear &
// Greed), our own backend (js/00-config.js apiBaseUrl), Supabase (accounts +
// cloud sync), and Google's analytics/ads beacons.
const CONNECT_SRC = [
  "'self'",
  'https://api.binance.com',
  'https://fapi.binance.com',
  'https://data-api.binance.vision',
  'https://stream.binance.com',
  'wss://stream.binance.com',
  'https://fstream.binance.com',
  'wss://fstream.binance.com',
  'https://api.coingecko.com',
  'https://api.alternative.me',
  'https://api.cryptobolt.io',
  'https://xdfkumkkfskdmlemelso.supabase.co',
  'wss://xdfkumkkfskdmlemelso.supabase.co',
  'https://www.google-analytics.com',
  'https://analytics.google.com',
  'https://pagead2.googlesyndication.com',
  'https://www.googletagmanager.com',
];

// AdSense creatives render inside iframes from these origins.
const FRAME_SRC = [
  'https://googleads.g.doubleclick.net',
  'https://tpc.googlesyndication.com',
  'https://www.google.com',
];

function sha256Base64(text) {
  return createHash('sha256').update(text, 'utf8').digest('base64');
}

// Finds inline <script>...</script> blocks that have no src="" attribute
// (i.e. ones the browser would actually try to run/parse inline), and
// returns their exact text content — the same bytes the browser hashes.
function findInlineScripts(html) {
  const out = [];
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    out.push(m[1]);
  }
  return out;
}

function buildCsp(html) {
  const hashes = findInlineScripts(html).map((s) => `'sha256-${sha256Base64(s)}'`);
  const scriptSrc = [...SCRIPT_SRC, ...hashes];

  const directives = [
    `default-src 'self'`,
    `script-src ${scriptSrc.join(' ')}`,
    `style-src ${STYLE_SRC.join(' ')}`,
    `font-src ${FONT_SRC.join(' ')}`,
    `img-src ${IMG_SRC.join(' ')}`,
    `connect-src ${CONNECT_SRC.join(' ')}`,
    `frame-src ${FRAME_SRC.join(' ')}`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
  ];

  return directives.join('; ') + ';';
}

function upsertCspMeta(html, cspContent) {
  const metaTag = `<meta http-equiv="Content-Security-Policy" content="${cspContent}">`;
  const existing = /<meta http-equiv="Content-Security-Policy"[^>]*>/;

  if (existing.test(html)) {
    return html.replace(existing, metaTag);
  }

  // No existing tag: insert as the first thing inside <head> so it governs
  // every script/style tag that follows it (including the very first
  // gtag/adsbygoogle <script> tags, which appear before <meta charset> on
  // this site).
  return html.replace(/<head>\r?\n/, (m) => `${m}    ${metaTag}\n`);
}

const PAGES = readdirSync(ROOT).filter((f) => f.endsWith('.html'));

for (const page of PAGES) {
  const filePath = path.join(ROOT, page);
  const original = readFileSync(filePath, 'utf8');
  const csp = buildCsp(original);
  const updated = upsertCspMeta(original, csp);
  writeFileSync(filePath, updated);
  console.log(`[build-csp] ${page}: ${findInlineScripts(original).length} inline script hash(es)`);
}

console.log('[build-csp] Done. Review the diff, then test every page in a browser (check the console for CSP violation reports) before deploying.');