#!/usr/bin/env node
// ---------------------------------------------------------------------------
// CryptoBolt: blog build step.
//
// Write a post as plain text + light Markdown in posts/<slug>.md. This
// script turns every posts/*.md file into a full <slug>.html page (using
// templates/post-template.html for all the header/nav/footer/meta boilerplate
// every post shares), and regenerates the two auto-derived parts of
// blog.html: the card grid and the "Blog" JSON-LD schema block, marked with
// <!-- BUILD:...:START/END --> comments. Everything else in blog.html (nav,
// hero, footer) is left untouched.
//
// This is a FULL rebuild every run, same pattern as build-js.js/build-csp.js:
// every post's "Keep reading" related-posts section and blog.html's grid are
// regenerated from every posts/*.md file each time, so adding one new post
// automatically ripples into the older posts' related links and into
// blog.html — you never hand-edit those.
//
// Usage:
//   node scripts/build-blog.js
//   (or: npm run build:blog)
//
// This also re-runs scripts/build-csp.js at the end, since new/changed HTML
// pages need fresh CSP hashes. You don't need to run that separately.
//
// posts/*.md format:
//   title: Post title as it appears as the <h1>
//   meta_title: Shown in the browser tab, before " | CryptoBolt" (optional,
//               falls back to title)
//   og_title: Headline used for social previews + JSON-LD (optional, falls
//             back to title)
//   date: 2026-09-10                  (YYYY-MM-DD)
//   section: Sentiment                (shown as the small eyebrow label)
//   readtime: 4 min read
//   emoji: 📊                          (blog-card icon)
//   color: rgba(255,176,32,.08)       (optional, blog-card background tint)
//   summary: One or two sentences — used as the meta description, OG/Twitter
//            description, and JSON-LD description.
//   card_summary: Optional shorter blurb for the blog listing card. Falls
//                 back to `summary` if omitted.
//   keywords: comma, separated, seo, keywords   (optional)
//   ---
//   Article body in Markdown below the `---` line. Supported: ## / ###
//   headings, blank-line-separated paragraphs, **bold**, and [text](url)
//   links. Nothing fancier than that — it matches what the existing posts
//   actually use.
//
// The output filename is the .md filename: posts/btc-dominance.md becomes
// btc-dominance.html at the project root, linked as /btc-dominance.html.
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const POSTS_DIR = path.join(ROOT, 'posts');
const TEMPLATE_PATH = path.join(ROOT, 'templates', 'post-template.html');
const BLOG_HTML_PATH = path.join(ROOT, 'blog.html');

const DEFAULT_COLORS = [
  'rgba(255,176,32,.08)',
  'rgba(79,216,232,.08)',
  'rgba(168,85,247,.08)',
  'rgba(74,222,128,.08)',
  'rgba(248,113,113,.08)',
];

// ---- tiny frontmatter + Markdown parsing -----------------------------------

function parsePost(raw, slug) {
  const sep = raw.indexOf('\n---');
  if (sep === -1) {
    throw new Error(`${slug}.md is missing the "---" line separating frontmatter from the body`);
  }
  const frontRaw = raw.slice(0, sep);
  const body = raw.slice(sep + 4).replace(/^\r?\n/, '');

  const fields = {};
  for (const line of frontRaw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    fields[key] = value;
  }

  const required = ['title', 'date', 'section', 'readtime', 'summary'];
  for (const key of required) {
    if (!fields[key]) throw new Error(`${slug}.md is missing required field "${key}:"`);
  }

  return {
    slug,
    title: fields.title,
    metaTitle: fields.meta_title || fields.title,
    ogTitle: fields.og_title || fields.title,
    date: fields.date,
    section: fields.section,
    readtime: fields.readtime,
    emoji: fields.emoji || '📄',
    color: fields.color || DEFAULT_COLORS[hashSlug(slug) % DEFAULT_COLORS.length],
    summary: fields.summary,
    cardSummary: fields.card_summary || fields.summary,
    keywords: fields.keywords || '',
    body,
  };
}

function hashSlug(slug) {
  let h = 0;
  for (const ch of slug) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(text) {
  return escapeHtml(text).replace(/"/g, '&quot;');
}

function inlineMarkdown(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

// Converts the Markdown body into the same HTML shape the hand-written posts
// use: <p> paragraphs and <h2>/<h3> headings, plus <ul> for "- " bullet lists.
function markdownToHtml(markdown) {
  const escaped = escapeHtml(markdown);
  const blocks = escaped.trim().split(/\r?\n\s*\r?\n/);
  const html = blocks.map((block) => {
    const trimmed = block.trim();
    if (trimmed.startsWith('### ')) return `    <h3>${inlineMarkdown(trimmed.slice(4))}</h3>`;
    if (trimmed.startsWith('## ')) return `    <h2>${inlineMarkdown(trimmed.slice(3))}</h2>`;

    const lines = trimmed.split(/\r?\n/);
    const isList = lines.every((line) => line.trim().startsWith('- '));
    if (isList) {
      const items = lines
        .map((line) => `        <li>${inlineMarkdown(line.trim().slice(2))}</li>`)
        .join('\n');
      return `    <ul>\n${items}\n    </ul>`;
    }

    const joined = lines.join(' ');
    return `    <p>${inlineMarkdown(joined)}</p>`;
  });
  return html.join('\n');
}

// The rest of the site's .html files use CRLF line endings; match that so
// generated/updated files don't show up as an all-lines-changed diff.
function toCrlf(text) {
  return text.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
}

function wordCount(markdown) {
  return markdown.trim().split(/\s+/).filter(Boolean).length;
}

// ---- rendering --------------------------------------------------------------

function renderBlogCard(post, headingTag) {
  return [
    `        <a href="${post.slug}.html" class="mk-blog-card">`,
    `            <div class="mk-blog-cover" style="background:${post.color};">${post.emoji}</div>`,
    `            <div class="mk-blog-body">`,
    `                <span class="mk-blog-meta">${escapeHtml(post.section)} · ${escapeHtml(post.readtime)}</span>`,
    `                <${headingTag}>${escapeHtml(post.title)}</${headingTag}>`,
    `                <p>${escapeHtml(post.cardSummary)}</p>`,
    `                <span class="mk-blog-read">Read the post →</span>`,
    `            </div>`,
    `        </a>`,
  ].join('\n');
}

function renderPostPage(template, post, related) {
  const relatedHtml = related.map((p) => renderBlogCard(p, 'h3')).join('\n');
  return template
    .split('{{META_TITLE}}').join(escapeHtml(post.metaTitle))
    .split('{{SUMMARY}}').join(escapeAttr(post.summary))
    .split('{{KEYWORDS}}').join(escapeAttr(post.keywords))
    .split('{{SLUG}}').join(post.slug)
    .split('{{OG_TITLE}}').join(escapeAttr(post.ogTitle))
    .split('{{TITLE}}').join(escapeHtml(post.title))
    .split('{{SECTION}}').join(escapeAttr(post.section))
    .split('{{SECTION_UPPER}}').join(escapeHtml(post.section).toUpperCase())
    .split('{{READTIME_UPPER}}').join(escapeHtml(post.readtime).toUpperCase())
    .split('{{DATE}}').join(post.date)
    .split('{{WORD_COUNT}}').join(String(wordCount(post.body)))
    .split('{{BODY_HTML}}').join(markdownToHtml(post.body))
    .split('{{RELATED_HTML}}').join(relatedHtml);
}

function renderBlogGrid(posts) {
  const cards = posts.map((p) => renderBlogCard(p, 'h2')).join('\n');
  return `<div class="mk-blog-grid">\n${cards}\n</div>`;
}

function renderBlogSchema(posts) {
  const entries = posts.map((p) => [
    '        {',
    '          "@type": "BlogPosting",',
    `          "headline": "${escapeAttr(p.ogTitle)}",`,
    `          "url": "https://cryptobolt.io/${p.slug}.html",`,
    `          "datePublished": "${p.date}",`,
    '          "author": { "@type": "Organization", "name": "CryptoBolt" }',
    '        }',
  ].join('\n')).join(',\n');

  return [
    '<script type="application/ld+json">',
    '{',
    '  "@context": "https://schema.org",',
    '  "@type": "Blog",',
    '  "name": "CryptoBolt Blog",',
    '  "url": "https://cryptobolt.io/blog.html",',
    '  "description": "Short, practical notes from CryptoBolt on reading the Fear & Greed index, spot vs futures mechanics, and how the AI research pass stays grounded in real data.",',
    '  "blogPost": [',
    entries,
    '  ]',
    '}',
    '</script>',
  ].join('\n');
}

function replaceBetweenMarkers(html, marker, replacement) {
  const re = new RegExp(
    `(<!-- BUILD:${marker}:START[^>]*-->\\r?\\n)[\\s\\S]*?(\\r?\\n[ \\t]*<!-- BUILD:${marker}:END -->)`
  );
  if (!re.test(html)) {
    throw new Error(`Could not find BUILD:${marker} markers in blog.html — did someone remove them?`);
  }
  return html.replace(re, (_, start, end) => `${start}${replacement}${end}`);
}

// ---- main -------------------------------------------------------------------

function main() {
  if (!existsSync(POSTS_DIR)) {
    console.log('[build-blog] No posts/ directory found — nothing to do.');
    return;
  }

  const template = readFileSync(TEMPLATE_PATH, 'utf8');

  const files = readdirSync(POSTS_DIR).filter((f) => f.endsWith('.md'));
  if (files.length === 0) {
    console.log('[build-blog] No .md files in posts/ — nothing to do.');
    return;
  }

  const posts = files.map((file) => {
    const slug = file.replace(/\.md$/, '');
    const raw = readFileSync(path.join(POSTS_DIR, file), 'utf8');
    return parsePost(raw, slug);
  });

  // Newest first, everywhere (grid, schema, related lists).
  posts.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  for (const post of posts) {
    const related = posts.filter((p) => p.slug !== post.slug).slice(0, 2);
    const html = toCrlf(renderPostPage(template, post, related));
    const outPath = path.join(ROOT, `${post.slug}.html`);
    writeFileSync(outPath, html);
    console.log(`[build-blog] wrote ${post.slug}.html`);
  }

  let blogHtml = readFileSync(BLOG_HTML_PATH, 'utf8');
  blogHtml = replaceBetweenMarkers(blogHtml, 'BLOG_GRID', toCrlf(renderBlogGrid(posts)));
  blogHtml = replaceBetweenMarkers(blogHtml, 'BLOG_SCHEMA', toCrlf(renderBlogSchema(posts)));
  writeFileSync(BLOG_HTML_PATH, blogHtml);
  console.log(`[build-blog] updated blog.html (${posts.length} post${posts.length === 1 ? '' : 's'})`);

  console.log('[build-blog] refreshing CSP hashes for the pages we just wrote...');
  execFileSync(process.execPath, [path.join(__dirname, 'build-csp.js')], { stdio: 'inherit' });

  console.log('[build-blog] Done. Review the diff, then deploy as usual.');
}

main();