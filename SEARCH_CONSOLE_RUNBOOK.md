# Search Console runbook

What to check in Google Search Console (GSC) and how often. GSC data cannot be read from this repo, so this is a checklist for a person. Run `npm run check:seo` first; it catches the problems that are visible in the files themselves (see "What the local audit covers").

## One-time setup

1. Add the property as a **Domain property** for `cryptobolt.io` (DNS TXT verification). This covers `http`/`https` and `www`/non-`www` in one view, which makes canonical problems easier to spot.
2. Submit `https://cryptobolt.io/sitemap.xml` under **Sitemaps**. After the first fetch the status should read "Success" and the discovered-URL count should match the number of `<url>` entries in the file.
3. Open **Settings > Users and permissions** and add a second owner so the property is not tied to one person.
4. Turn on email notifications for the property (Settings > Preferences) so indexing and security issues arrive by email.

## Weekly (about 10 minutes)

| Report | What to look for | Likely cause and fix |
|---|---|---|
| **Pages** (Indexing) | A rising count under "Not indexed", or any new reason in the list | Open the reason, click **See examples**, then run **URL Inspection** on one example |
| **Pages > Duplicate, Google chose different canonical than user** | Any URL listed | The page's `<link rel="canonical">` disagrees with what Google picked. Compare "User-declared canonical" and "Google-selected canonical" in URL Inspection. Common causes: two URLs serving the same content (`/index.html` and `/`), mixed `http`/`https`, or near-identical pages |
| **Pages > Alternate page with proper canonical tag** | Only a problem if the URL is a page you want indexed | Expected for duplicate URLs you have canonicalised on purpose |
| **Pages > Crawled, currently not indexed** | New articles or the glossary stuck here for weeks | Usually a quality or duplication signal. Improve the page, add internal links to it, then request indexing |
| **Pages > Discovered, currently not indexed** | Many URLs | Crawl budget or low perceived value. Check internal linking and the sitemap |
| **Pages > Submitted URL marked noindex / blocked by robots.txt / not found (404)** | Any | `npm run check:seo` reports these as `sitemap-noindex`, `sitemap-dead-url` and `broken-link` |
| **Performance > Search results** | Queries with many impressions and low CTR; queries where the page ranks 8 to 20 | Rewrite the title or description for the first group (check `og_title`, `meta_title`, `summary` in the post front matter). Add a section or an example to the article for the second group |
| **Experience > Page experience / Core Web Vitals** | URLs listed as "Poor" or "Needs improvement" | Check image sizes and third-party scripts (ads, analytics) first |
| **Enhancements** (Breadcrumbs, Articles) | Any invalid items | `npm run check:seo` flags JSON-LD that does not parse (`json-ld`). Validate the rest with the Rich Results Test |
| **Security & Manual actions** | Anything at all | Treat as urgent |

## After publishing or changing a page

1. Run `npm run build` (and `npm run build:blog` / `npm run build:glossary` if you edited `posts/` or `glossary/terms.json`), then `npm run check:seo`.
2. Deploy.
3. In GSC, paste the URL into **URL Inspection**, confirm "URL is available to Google", and click **Request indexing**. Do this for new pages and for pages with significant changes; there is a daily quota, so do not do it for every page.
4. Make sure the page's `<lastmod>` in `sitemap.xml` changed. `build-blog.js` keeps article dates in sync with the `updated:` front-matter field; update it whenever you materially edit an article.

## Canonical mismatch checklist

When GSC reports a canonical mismatch, work through these in order:

1. Does the page have exactly one `<link rel="canonical">`, and is it the exact URL in `sitemap.xml`? (`canonical`, `canonical-mismatch`)
2. Do `og:url` and the canonical agree? (`og-url`)
3. Is the same content reachable at a second URL, for example `/index.html` and `/`, or with a trailing query string? Add a redirect in `.htaccess` or make sure all internal links use one form.
4. Are `http://` or `www.` URLs still answering without redirecting to `https://cryptobolt.io`? Check with `curl -I`.
5. Is there another page with nearly the same title, description and body? (`title-duplicate`, `description-duplicate`) Consolidate or differentiate them.

## Monthly

- Export the **Performance** report (last 3 months, Queries tab) and pick two to three queries that have impressions but no dedicated page. Those are candidates for new articles or glossary terms.
- Check **Links** for the pages that earn the most internal links and make sure the pages you care about most (terminal, AI research, paper trading) are among them.
- Re-run the social-preview checks below on any page whose title or image changed.

## Social preview checks

After changing titles, descriptions or images, re-scrape the page in each platform's debugger, because platforms cache previews:

- Facebook / LinkedIn: Sharing Debugger and Post Inspector.
- X: paste the URL into a draft post and look at the card preview.
- Slack and Discord: post the URL in a private channel.

Expected: the article's own title and image, the description under 160 characters, and the favicon in browser tabs.

## What the local audit covers (`npm run check:seo`)

Errors (exit code 1): missing or duplicate canonical, canonical not matching the sitemap URL, canonical and `og:url` disagreeing, noindex pages in the sitemap, sitemap URLs without a matching file, duplicate sitemap entries, missing title, description, `og:*` tags or `<h1>`, `og:image` files that do not exist, invalid JSON-LD, images without `alt`, duplicate element ids, and links to files that do not exist.

Warnings: titles over about 60 characters, descriptions outside 70 to 160, duplicate titles and descriptions, heading-level jumps, missing `twitter:*` tags or `og:image:alt`, `og:image` not 1200x630, buttons, links and form fields with no accessible name, missing `<main>` landmark or skip link, links to missing in-page anchors, and `target="_blank"` links without `rel="noopener"`.

It cannot tell you how Google actually crawled or indexed the site; that is what the reports above are for. Use `--strict` to make warnings fail the run and `--json` for machine-readable output.