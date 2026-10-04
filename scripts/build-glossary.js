#!/usr/bin/env node
// ---------------------------------------------------------------------------
// CryptoBolt: glossary build step.
//
// glossary/terms.json is the single source of truth for glossary.html. Edit
// definitions there, then run:
//
//   node scripts/build-glossary.js        (or: npm run build:glossary)
//
// This regenerates glossary.html from templates/glossary-template.html,
// including the A-Z navigation, anchor ids for every term, and the
// DefinedTermSet JSON-LD. It also makes sure sitemap.xml lists the page, then
// re-runs scripts/build-csp.js because the JSON-LD block changed (its hash is
// allow-listed in the page's Content-Security-Policy).
//
// terms.json entry format:
//   {
//     "slug": "funding-rate",            // becomes the #anchor; keep it stable
//     "term": "Funding rate",            // heading shown on the page
//     "category": "Futures & leverage",  // small label next to the term
//     "definition": "Plain text. Link other terms with [[slug]] or [[slug|link text]].",
//     "aka": ["funding fee"],            // optional synonyms (searchable)
//     "read": [                          // optional "Read more" links
//       "funding-rate-explained",        //   a posts/<slug>.md article, or
//       { "href": "liquidation-price-calculator.html", "label": "Liquidation price calculator" }
//     ]
//   }
//
// The build fails on duplicate slugs, [[links]] to unknown terms, and "read"
// entries that point to a post or file that does not exist.
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ORIGIN = 'https://cryptobolt.io';

const data = JSON.parse(readFileSync(path.join(ROOT, 'glossary', 'terms.json'), 'utf8'));
const terms = [...data.terms].sort((a, b) => a.term.localeCompare(b.term, 'en', { sensitivity: 'base' }));
const bySlug = new Map();

for (const t of terms) {
  if (!/^[a-z0-9-]+$/.test(t.slug)) throw new Error(`Bad slug "${t.slug}" (use lowercase letters, digits, hyphens)`);
  if (bySlug.has(t.slug)) throw new Error(`Duplicate glossary slug "${t.slug}"`);
  bySlug.set(t.slug, t);
}

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttr = (s) => escapeHtml(s).replace(/"/g, '&quot;');

function postTitle(slug) {
  const file = path.join(ROOT, 'posts', `${slug}.md`);
  if (!existsSync(file)) return null;
  const m = readFileSync(file, 'utf8').match(/^title:\s*(.+)$/m);
  return m ? m[1].trim().replace(/^"|"$/g, '') : slug;
}

// [[slug]] / [[slug|text]] -> link (html) or plain text (for JSON-LD)
function renderDefinition(term, { html }) {
  return term.definition.replace(/\[\[([a-z0-9-]+)(?:\|([^\]]+))?\]\]/g, (_, slug, text) => {
    const target = bySlug.get(slug);
    if (!target) throw new Error(`"${term.slug}" links to unknown term [[${slug}]]`);
    const label = text || target.term;
    return html ? `<a href="#${slug}">${escapeHtml(label)}</a>` : label;
  });
}

function renderReadMore(term) {
  const links = (term.read || []).map((r) => {
    if (typeof r === 'string') {
      const title = postTitle(r);
      if (!title) throw new Error(`"${term.slug}" reads more at unknown post "${r}"`);
      return `<a href="${r}.html">${escapeHtml(title)}</a>`;
    }
    if (!existsSync(path.join(ROOT, r.href))) throw new Error(`"${term.slug}" links to missing file ${r.href}`);
    return `<a href="${r.href}">${escapeHtml(r.label)}</a>`;
  });
  return links.length ? `\n                <p class="mk-gloss-more">Read more: ${links.join(' · ')}</p>` : '';
}

function renderTerm(t) {
  const aka = t.aka && t.aka.length ? `<span class="mk-gloss-aka">Also: ${escapeHtml(t.aka.join(', '))}</span>` : '';
  const search = [t.term, ...(t.aka || []), t.category, renderDefinition(t, { html: false })].join(' ').toLowerCase();
  return [
    `            <div class="mk-gloss-item" id="${t.slug}" data-search="${escapeAttr(search)}">`,
    `                <dt><dfn>${escapeHtml(t.term)}</dfn> <span class="mk-gloss-cat">${escapeHtml(t.category)}</span> ${aka}</dt>`,
    `                <dd>`,
    `                <p>${renderDefinition(t, { html: true })}</p>${renderReadMore(t)}`,
    `                </dd>`,
    `            </div>`,
  ].join('\n');
}

// group by first letter
const letters = new Map();
for (const t of terms) {
  const letter = t.term.replace(/[^A-Za-z0-9]/g, '').charAt(0).toUpperCase() || '#';
  if (!letters.has(letter)) letters.set(letter, []);
  letters.get(letter).push(t);
}

const azNav = [...letters.keys()].map((l) => `            <a href="#letter-${l.toLowerCase()}">${l}</a>`).join('\n');

const termsHtml = [...letters]
  .map(
    ([letter, list]) =>
      `        <section class="mk-gloss-letter" aria-labelledby="letter-${letter.toLowerCase()}">\n` +
      `            <h2 id="letter-${letter.toLowerCase()}">${letter}</h2>\n` +
      `            <dl class="mk-gloss-list">\n${list.map(renderTerm).join('\n')}\n            </dl>\n` +
      `        </section>`
  )
  .join('\n');

const jsonLd = JSON.stringify(
  {
    '@context': 'https://schema.org',
    '@type': 'DefinedTermSet',
    name: 'CryptoBolt Crypto Trading Glossary',
    url: `${ORIGIN}/glossary.html`,
    description: 'Plain-English definitions of crypto trading and market-data terms.',
    inLanguage: 'en',
    hasDefinedTerm: terms.map((t) => ({
      '@type': 'DefinedTerm',
      name: t.term,
      description: renderDefinition(t, { html: false }),
      url: `${ORIGIN}/glossary.html#${t.slug}`,
      ...(t.aka && t.aka.length ? { alternateName: t.aka } : {}),
      inDefinedTermSet: `${ORIGIN}/glossary.html`,
    })),
  },
  null,
  2
)
  .split('\n')
  .map((l) => `    ${l}`)
  .join('\n');

const ogImage = existsSync(path.join(ROOT, 'assets', 'og', 'glossary.png'))
  ? `${ORIGIN}/assets/og/glossary.png`
  : `${ORIGIN}/assets/og-image.png`;

const template = readFileSync(path.join(ROOT, 'templates', 'glossary-template.html'), 'utf8');
const out = template
  .split('{{TERMS_JSONLD}}').join(jsonLd)
  .split('{{TERMS_HTML}}').join(termsHtml)
  .split('{{AZ_NAV}}').join(azNav)
  .split('{{TERM_COUNT}}').join(String(terms.length))
  .split('{{OG_IMAGE}}').join(ogImage)
  .replace(/\r\n/g, '\n')
  .replace(/\n/g, '\r\n'); // the rest of the site's HTML uses CRLF

writeFileSync(path.join(ROOT, 'glossary.html'), out);
console.log(`[build-glossary] wrote glossary.html (${terms.length} terms, ${letters.size} letters)`);

// keep sitemap.xml in step
const sitemapPath = path.join(ROOT, 'sitemap.xml');
if (existsSync(sitemapPath)) {
  let xml = readFileSync(sitemapPath, 'utf8');
  const lastmod = data.updated || new Date().toISOString().slice(0, 10);
  const re = /(<loc>https:\/\/cryptobolt\.io\/glossary\.html<\/loc>\s*<lastmod>)[^<]*(<\/lastmod>)/;
  if (re.test(xml)) {
    xml = xml.replace(re, `$1${lastmod}$2`);
  } else {
    const nl = xml.includes('\r\n') ? '\r\n' : '\n';
    const entry = [
      '  <url>',
      `    <loc>${ORIGIN}/glossary.html</loc>`,
      `    <lastmod>${lastmod}</lastmod>`,
      '    <changefreq>monthly</changefreq>',
      '    <priority>0.7</priority>',
      '  </url>',
    ].join(nl);
    xml = xml.replace(/<\/urlset>/, `${entry}${nl}</urlset>`);
    console.log('[build-glossary] added glossary.html to sitemap.xml');
  }
  writeFileSync(sitemapPath, xml);
}

console.log('[build-glossary] refreshing CSP hashes...');
execFileSync(process.execPath, [path.join(__dirname, 'build-csp.js')], { stdio: 'inherit' });