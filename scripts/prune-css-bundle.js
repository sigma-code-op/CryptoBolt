#!/usr/bin/env node
// ---------------------------------------------------------------------------
// CryptoBolt: per-bundle CSS pruning + minification (runs after build-css.js).
//
// build-css.js concatenates the shared stylesheets into css/dist/bundle-*.css, so every
// page in a bundle downloads every rule — including terminal-only rules on marketing
// pages that never contain a terminal. This step shrinks each bundle to what the pages
// that actually load it can use:
//
//   1. Finds which HTML pages link each css/dist/bundle-*.css.
//   2. Builds a "corpus" per bundle: those pages' HTML plus every local JS file they
//      load (script tags, js/dist bundles, and files those scripts lazy-load by name),
//      since JS adds classes/ids at runtime.
//   3. Removes any rule whose class / id / attribute selector never appears in that
//      corpus. This is deliberately conservative: a class counts as "used" if its name
//      appears ANYWHERE as a token in the corpus (HTML attribute, JS string, template
//      literal, classList call...), and a name built by concatenation ('status-' + x)
//      keeps every class that starts with that prefix.
//   4. Strips comments and whitespace.
//
// Source files in css/*.css are never modified — this only rewrites css/dist/*.css, so
// editing a source file and re-running `npm run build` always regenerates the full set.
// If you add a class from a place this script can't see (e.g. a string assembled from
// data fetched at runtime), add it to SAFELIST below.
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import postcss from 'postcss';
import selectorParser from 'postcss-selector-parser';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'css', 'dist');

// Class / id names (exact) that must always be kept.
const SAFELIST = new Set([]);

const read = (p) => readFileSync(p, 'utf8');

// ---- 1. pages per bundle ---------------------------------------------------
const pages = readdirSync(ROOT).filter((f) => f.endsWith('.html'));
const bundlePages = {};
for (const page of pages) {
  const html = read(path.join(ROOT, page));
  for (const m of html.matchAll(/css\/dist\/(bundle-[\w-]+\.css)/g)) {
    (bundlePages[m[1]] ||= new Set()).add(page);
  }
}

// ---- 2. corpus per bundle ---------------------------------------------------
function localJsRefs(text) {
  const out = [];
  for (const m of text.matchAll(/(?:^|[^\w./-])\/?(js\/(?:dist\/)?[\w.-]+\.js)/g)) out.push(m[1]);
  return out;
}

function corpusFor(pageList) {
  const seen = new Set();
  const parts = [];
  const queue = [];
  for (const page of pageList) {
    const html = read(path.join(ROOT, page));
    parts.push(html);
    queue.push(...localJsRefs(html));
  }
  while (queue.length) {
    const rel = queue.pop();
    if (seen.has(rel)) continue;
    seen.add(rel);
    const abs = path.join(ROOT, rel);
    if (!existsSync(abs)) continue;
    const text = read(abs);
    parts.push(text);
    queue.push(...localJsRefs(text));
  }
  return parts.join('\n');
}

function indexCorpus(corpus) {
  const tokens = new Set(corpus.split(/[^A-Za-z0-9_-]+/).filter(Boolean));
  // Tailwind-style tokens keep brackets, colons, slashes, dots, hashes, percent signs.
  for (const t of corpus.split(/[\s"'`<>=]+/)) if (t) tokens.add(t);
  for (const t of corpus.split(/[\s"'`<>=(),;{}]+/)) if (t) tokens.add(t);
  const prefixes = new Set();
  for (const m of corpus.matchAll(/['"`]([A-Za-z][A-Za-z0-9_]*-+)['"`]\s*\+/g)) prefixes.add(m[1]);
  for (const m of corpus.matchAll(/([A-Za-z][A-Za-z0-9_-]*-)\$\{/g)) prefixes.add(m[1]);
  const prefixList = [...prefixes].filter((p) => p.length >= 3);
  return { tokens, prefixList };
}

// ---- 3. selector test ---------------------------------------------------------
const ALWAYS_ATTRS =
  /^(type|href|src|role|rel|disabled|checked|open|hidden|lang|dir|name|for|value|class|id|style|aria-.*)$/;

function makeSelectorTest({ tokens, prefixList }) {
  const used = (t) =>
    SAFELIST.has(t) || tokens.has(t) || prefixList.some((p) => t.startsWith(p));
  return function selectorUsed(sel) {
    let tree;
    try {
      tree = selectorParser().astSync(sel);
    } catch {
      return true; // can't parse -> keep
    }
    let ok = true;
    tree.walk((n) => {
      if (!ok) return;
      for (let p = n.parent; p; p = p.parent) {
        if (p.type === 'pseudo' && p.value === ':not') return; // :not(.x) matches without .x
      }
      if ((n.type === 'class' || n.type === 'id') && !used(n.value)) ok = false;
      else if (
        n.type === 'attribute' &&
        n.attribute &&
        !ALWAYS_ATTRS.test(n.attribute) &&
        !tokens.has(n.attribute)
      ) ok = false;
    });
    return ok;
  };
}

// ---- 4. minify (postcss raws) -------------------------------------------------
function collapseValue(v) {
  // collapse whitespace runs outside quoted strings
  return v.replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|\s+/g, (m, str) => (str ? str : ' ')).trim();
}

function minify(root) {
  root.walkComments((c) => c.remove());
  root.walk((n) => {
    n.raws.before = '';
    if (n.type === 'decl') {
      n.raws.between = ':';
      n.value = collapseValue(n.value);
      if (n.important) n.raws.important = '!important';
    } else if (n.type === 'rule') {
      n.selector = collapseValue(n.selector).replace(/\s*([>+~,])\s*/g, '$1');
      n.raws.between = '';
      n.raws.after = '';
      n.raws.semicolon = false;
    } else if (n.type === 'atrule') {
      n.params = collapseValue(n.params || '');
      n.raws.afterName = n.params ? ' ' : '';
      n.raws.between = '';
      n.raws.after = '';
      n.raws.semicolon = false;
    }
  });
  root.raws.after = '';
}

// ---- run -----------------------------------------------------------------------
let totalBefore = 0;
let totalAfter = 0;
for (const [bundle, pageSet] of Object.entries(bundlePages)) {
  const file = path.join(DIST, bundle);
  if (!existsSync(file)) continue;
  const src = read(file);
  const selectorUsed = makeSelectorTest(indexCorpus(corpusFor([...pageSet])));
  const root = postcss.parse(src);

  let dropped = 0;
  root.walkRules((rule) => {
    const parent = rule.parent;
    if (parent && parent.type === 'atrule' && /keyframes$/i.test(parent.name)) return;
    const keep = rule.selectors.filter(selectorUsed);
    if (keep.length === rule.selectors.length) return;
    dropped++;
    if (keep.length === 0) rule.remove();
    else rule.selectors = keep;
  });
  // empty containers left behind
  for (let again = true; again; ) {
    again = false;
    root.walkAtRules((a) => {
      if (a.nodes && a.nodes.length === 0 && /^(media|supports|layer|container)$/i.test(a.name)) {
        a.remove();
        again = true;
      }
    });
  }

  minify(root);
  const out =
    `/* AUTO-GENERATED by scripts/build-css.js + scripts/prune-css-bundle.js — do not edit. */\n` +
    root.toString();
  writeFileSync(file, out);
  const b = Buffer.byteLength(src);
  const a = Buffer.byteLength(out);
  totalBefore += b;
  totalAfter += a;
  console.log(
    `Pruned css/dist/${bundle} (${pageSet.size} pages): ${(b / 1024).toFixed(1)}KB -> ` +
      `${(a / 1024).toFixed(1)}KB, ${dropped} rule(s) dropped`
  );
}
console.log(`Total ${(totalBefore / 1024).toFixed(1)}KB -> ${(totalAfter / 1024).toFixed(1)}KB`);