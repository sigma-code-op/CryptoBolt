#!/usr/bin/env node
// ---------------------------------------------------------------------------
// CryptoBolt: static SEO / social-sharing / accessibility audit.
//
// Reads every root-level *.html page plus sitemap.xml and reports problems
// that commonly show up later in Google Search Console ("Duplicate, Google
// chose different canonical", "Alternate page with proper canonical tag",
// "Submitted URL marked noindex") or in link-preview debuggers, plus a handful
// of cheap accessibility checks. No dependencies and no network access: it
// only inspects the files committed in this repo, so it is safe to run in CI.
//
// Usage:
//   node scripts/check-seo.js            # human-readable report
//   node scripts/check-seo.js --json     # machine-readable report
//   node scripts/check-seo.js --strict   # warnings also fail the run
//
// Exit code: 1 if any ERROR is found (or any warning with --strict), else 0.
//
// What it cannot see: how Google actually crawled/indexed the live site. Use
// SEARCH_CONSOLE_RUNBOOK.md for the Search Console half of the job.
// ---------------------------------------------------------------------------

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ORIGIN = 'https://cryptobolt.io';
const args = new Set(process.argv.slice(2));

const issues = []; // { level: 'error' | 'warn', page, rule, message }
const add = (level, page, rule, message) => issues.push({ level, page, rule, message });

// ---- tiny HTML helpers (regex based: fine for this repo's static pages) -----

const read = (file) => readFileSync(path.join(ROOT, file), 'utf8').replace(/\r\n/g, '\n');

function parseAttrs(tag) {
  const attrs = {};
  const re = /([a-zA-Z_:][\w:.-]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'))?/g;
  let m;
  // skip the tag name itself
  const body = tag.replace(/^<\s*[a-zA-Z0-9-]+/, '').replace(/\/?>$/, '');
  while ((m = re.exec(body))) attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? '';
  return attrs;
}

function tagsOf(html, name) {
  const re = new RegExp(`<${name}\\b[^>]*>`, 'gi');
  return (html.match(re) || []).map((t) => ({ raw: t, attrs: parseAttrs(t) }));
}

function meta(html, key, value) {
  for (const t of tagsOf(html, 'meta')) {
    if ((t.attrs[key] || '').toLowerCase() === value) return t.attrs.content ?? '';
  }
  return null;
}

const stripTags = (s) =>
  s.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

function pngSize(file) {
  try {
    const buf = readFileSync(path.join(ROOT, file));
    if (buf.toString('ascii', 1, 4) !== 'PNG') return null;
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  } catch {
    return null;
  }
}

// ---- load pages ------------------------------------------------------------

const files = readdirSync(ROOT).filter((f) => f.endsWith('.html')).sort();
const pages = new Map();
for (const f of files) pages.set(f, read(f));

const idsByPage = new Map();
for (const [f, html] of pages) {
  const ids = new Set();
  for (const m of html.matchAll(/\sid\s*=\s*"([^"]+)"/g)) ids.add(m[1]);
  idsByPage.set(f, ids);
}

// ---- sitemap ---------------------------------------------------------------

const sitemapLocs = [];
if (existsSync(path.join(ROOT, 'sitemap.xml'))) {
  for (const m of read('sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)) sitemapLocs.push(m[1].trim());
} else {
  add('error', 'sitemap.xml', 'sitemap-missing', 'sitemap.xml not found');
}

const fileForUrl = (url) => {
  if (!url.startsWith(ORIGIN)) return null;
  const p = url.slice(ORIGIN.length).split('#')[0].split('?')[0];
  return p === '/' || p === '' ? 'index.html' : p.replace(/^\//, '');
};

// ---- per-page checks -------------------------------------------------------

const titles = new Map();
const descriptions = new Map();
const indexable = new Set();

for (const [file, html] of pages) {
  const robots = meta(html, 'name', 'robots') || '';
  const noindex = /noindex/i.test(robots);
  if (!noindex) indexable.add(file);

  const expectedCanonical = file === 'index.html' ? `${ORIGIN}/` : `${ORIGIN}/${file}`;

  // lang / viewport
  if (!/<html[^>]*\slang="[a-z-]+"/i.test(html)) add('error', file, 'html-lang', '<html> has no lang attribute');
  if (meta(html, 'name', 'viewport') === null) add('error', file, 'viewport', 'missing viewport meta tag');

  // title
  const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
  const decode = (x) => x.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  const title = titleMatch ? decode(titleMatch[1].trim()) : '';
  if (!title) add('error', file, 'title', 'missing <title>');
  else {
    if (title.length > 60) add('warn', file, 'title-length', `title is ${title.length} chars (Google usually truncates past ~60): "${title}"`);
    if (title.length < 20) add('warn', file, 'title-length', `title is only ${title.length} chars: "${title}"`);
    if (!noindex) {
      if (titles.has(title)) add('warn', file, 'title-duplicate', `same <title> as ${titles.get(title)}`);
      else titles.set(title, file);
    }
  }

  // description
  const desc = decode(meta(html, 'name', 'description') || '') || null;
  if (!desc) add('error', file, 'description', 'missing meta description');
  else {
    if (desc.length < 70 || desc.length > 160) add('warn', file, 'description-length', `description is ${desc.length} chars (aim for 70–160)`);
    if (!noindex) {
      if (descriptions.has(desc)) add('warn', file, 'description-duplicate', `same description as ${descriptions.get(desc)}`);
      else descriptions.set(desc, file);
    }
  }

  // canonical
  const canonicalTag = tagsOf(html, 'link').filter((t) => (t.attrs.rel || '').toLowerCase() === 'canonical');
  if (canonicalTag.length !== 1) add('error', file, 'canonical', `expected exactly one canonical link, found ${canonicalTag.length}`);
  else if (canonicalTag[0].attrs.href !== expectedCanonical && !noindex) {
    add('error', file, 'canonical-mismatch', `canonical is ${canonicalTag[0].attrs.href}, expected ${expectedCanonical}`);
  }
  const canonical = canonicalTag[0]?.attrs.href;

  // headings
  const h1Count = (html.match(/<h1[\s>]/gi) || []).length;
  if (h1Count !== 1) add(file.startsWith('app') || file === 'trade.html' ? 'warn' : 'error', file, 'h1', `expected exactly one <h1>, found ${h1Count}`);
  let prev = 0;
  for (const m of html.matchAll(/<h([1-6])[\s>]/gi)) {
    const level = Number(m[1]);
    if (prev && level > prev + 1) add('warn', file, 'heading-order', `heading jumps from h${prev} to h${level}`);
    prev = level;
  }

  // social sharing
  if (!noindex) {
    for (const prop of ['og:title', 'og:description', 'og:image', 'og:url', 'og:type']) {
      if (!meta(html, 'property', prop)) add('error', file, 'og-missing', `missing ${prop}`);
    }
    for (const name of ['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image']) {
      if (!meta(html, 'name', name)) add('warn', file, 'twitter-missing', `missing ${name}`);
    }
    if (!meta(html, 'property', 'og:image:alt')) add('warn', file, 'og-image-alt', 'missing og:image:alt');
    const ogUrl = meta(html, 'property', 'og:url');
    if (ogUrl && canonical && ogUrl !== canonical) add('error', file, 'og-url', `og:url (${ogUrl}) differs from canonical (${canonical})`);
    const ogImage = meta(html, 'property', 'og:image');
    if (ogImage) {
      const local = fileForUrl(ogImage);
      if (!local || !existsSync(path.join(ROOT, local))) add('error', file, 'og-image-file', `og:image does not exist locally: ${ogImage}`);
      else {
        const size = pngSize(local);
        if (size && (size.w !== 1200 || size.h !== 630)) add('warn', file, 'og-image-size', `${local} is ${size.w}x${size.h}, recommended 1200x630`);
      }
      const tw = meta(html, 'name', 'twitter:image');
      if (tw && tw !== ogImage) add('warn', file, 'twitter-image', 'twitter:image differs from og:image');
    }
    if (!tagsOf(html, 'link').some((t) => (t.attrs.rel || '').includes('icon'))) add('warn', file, 'favicon', 'no <link rel="icon">');
  }

  // sitemap consistency
  const url = file === 'index.html' ? `${ORIGIN}/` : `${ORIGIN}/${file}`;
  const inSitemap = sitemapLocs.includes(url);
  if (noindex && inSitemap) add('error', file, 'sitemap-noindex', 'page is noindex but listed in sitemap.xml');
  if (!noindex && !inSitemap) add('warn', file, 'sitemap-missing-page', 'indexable page is not listed in sitemap.xml');

  // JSON-LD
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      JSON.parse(m[1]);
    } catch (e) {
      add('error', file, 'json-ld', `invalid JSON-LD block: ${e.message}`);
    }
  }

  // --- accessibility -------------------------------------------------------
  if (!/<main[\s>]/i.test(html) && !/role="main"/i.test(html)) add('warn', file, 'a11y-main', 'no <main> landmark');
  if (!/href="#(main|main-content|content)"/i.test(html)) add('warn', file, 'a11y-skip-link', 'no "skip to main content" link');

  for (const t of tagsOf(html, 'img')) {
    if (!('alt' in t.attrs)) add('error', file, 'a11y-img-alt', `<img src="${t.attrs.src || ''}"> has no alt attribute (use alt="" if decorative)`);
  }

  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const a = parseAttrs(`<a ${m[1]}>`);
    const inner = m[2];
    const hasName = stripTags(inner) || a['aria-label'] || a['aria-labelledby'] || a.title || /<img[^>]+alt="[^"]+"/i.test(inner);
    if (!hasName) add('warn', file, 'a11y-link-name', `link with no accessible name: href="${a.href || ''}"`);
    if (a.target === '_blank' && !/noopener/.test(a.rel || '')) add('warn', file, 'link-noopener', `target=_blank without rel=noopener: ${a.href}`);
  }

  for (const m of html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)) {
    const b = parseAttrs(`<button ${m[1]}>`);
    const hasName = stripTags(m[2]) || b['aria-label'] || b['aria-labelledby'] || b.title;
    if (!hasName) add('warn', file, 'a11y-button-name', `button with no accessible name${b.id ? ` (#${b.id})` : ''}`);
  }

  const labelFor = new Set([...html.matchAll(/<label\b[^>]*\sfor="([^"]+)"/gi)].map((m) => m[1]));
  const wrapped = [...html.matchAll(/<label\b[^>]*>([\s\S]*?)<\/label>/gi)].map((m) => m[1]).join('\n');
  for (const name of ['input', 'select', 'textarea']) {
    for (const t of tagsOf(html, name)) {
      const type = (t.attrs.type || '').toLowerCase();
      if (['hidden', 'submit', 'button', 'reset', 'image'].includes(type)) continue;
      if (t.attrs['aria-hidden'] === 'true' || t.attrs.tabindex === '-1') continue; // honeypots etc.
      const named = t.attrs['aria-label'] || t.attrs['aria-labelledby'] || t.attrs.title || (t.attrs.id && (labelFor.has(t.attrs.id) || wrapped.includes(`id="${t.attrs.id}"`)));
      if (!named) add('warn', file, 'a11y-form-label', `<${name}${t.attrs.id ? ` id="${t.attrs.id}"` : ''}> has no label`);
    }
  }

  const seen = new Set();
  for (const m of html.matchAll(/\sid\s*=\s*"([^"]+)"/g)) {
    if (seen.has(m[1])) add('error', file, 'duplicate-id', `duplicate id "${m[1]}"`);
    seen.add(m[1]);
  }

  // internal links (pages only; runtime-rendered links are out of scope)
  for (const m of html.matchAll(/<a\b[^>]*\shref="([^"]+)"/gi)) {
    const href = m[1];
    if (/^(https?:|mailto:|tel:|javascript:|data:|\/\/)/i.test(href)) continue;
    const [p, hash] = href.split('#');
    const target = p === '' ? file : p.replace(/^\//, '').split('?')[0];
    if (target && !existsSync(path.join(ROOT, target))) {
      add('error', file, 'broken-link', `link to missing file: ${href}`);
      continue;
    }
    if (hash && target.endsWith('.html') && pages.has(target) && !idsByPage.get(target).has(hash)) {
      add('warn', file, 'broken-anchor', `link to missing anchor: ${href}`);
    }
  }
}

// sitemap entries must resolve to real files
for (const loc of sitemapLocs) {
  const f = fileForUrl(loc);
  if (!f || !existsSync(path.join(ROOT, f))) add('error', 'sitemap.xml', 'sitemap-dead-url', `sitemap lists a URL with no matching file: ${loc}`);
}
const dupLocs = sitemapLocs.filter((l, i) => sitemapLocs.indexOf(l) !== i);
for (const l of new Set(dupLocs)) add('error', 'sitemap.xml', 'sitemap-duplicate', `duplicate sitemap entry: ${l}`);

// robots.txt should point at the sitemap
if (existsSync(path.join(ROOT, 'robots.txt')) && !/^Sitemap:\s*https:\/\/cryptobolt\.io\/sitemap\.xml/im.test(read('robots.txt'))) {
  add('warn', 'robots.txt', 'robots-sitemap', 'robots.txt has no Sitemap: line for sitemap.xml');
}

// ---- report ----------------------------------------------------------------

const errors = issues.filter((i) => i.level === 'error');
const warnings = issues.filter((i) => i.level === 'warn');

if (args.has('--json')) {
  console.log(JSON.stringify({ pages: files.length, errors, warnings }, null, 2));
} else {
  const byPage = new Map();
  for (const i of issues) {
    if (!byPage.has(i.page)) byPage.set(i.page, []);
    byPage.get(i.page).push(i);
  }
  for (const [page, list] of [...byPage].sort(([a], [b]) => a.localeCompare(b))) {
    console.log(`\n${page}`);
    for (const i of list) console.log(`  ${i.level === 'error' ? 'ERROR' : 'warn '}  [${i.rule}] ${i.message}`);
  }
  console.log(`\nChecked ${files.length} pages, ${sitemapLocs.length} sitemap URLs: ${errors.length} error(s), ${warnings.length} warning(s).`);
}

process.exit(errors.length || (args.has('--strict') && warnings.length) ? 1 : 0);