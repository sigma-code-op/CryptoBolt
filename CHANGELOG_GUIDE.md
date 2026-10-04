# Keeping the changelog

The public changelog is `releases.html` (linked from the site footer). Add an entry whenever a release changes something a visitor could notice.

## Entry template

Copy the newest `<article class="mkx-rel-entry">` block in `releases.html`, put it at the top, and update:

- the `id` (`rel-1-15-0` style) and the matching link at the top of the left-hand list,
- the version tag and the date,
- a one-line headline (`<h2>`),
- the three sections below. Leave a section out only if it truly has nothing; for **Data sources** write "No data sources changed in this release." so readers know it was considered.

| Section label | What goes in it |
|---|---|
| `What's new` | Features, pages, tools, new articles |
| `Fixes` | Bugs fixed, wrong figures corrected, accessibility fixes, broken links or markup repaired |
| `Data sources` | A source added, removed or swapped, or a calculation that uses one changed in a way a reader could notice (for example a different funding-rate interval, a new price feed, a new rounding rule) |

Then:

1. Set the page's `<lastmod>` in `sitemap.xml` to the release date.
2. If a source was added or removed, update the "Where CryptoBolt's data comes from" entry at the bottom of `releases.html` and the connect-src list in `scripts/build-csp.js`.
3. Run `npm run build:csp` and `npm run check:seo`.

## Style

Say what changed for the reader, in plain words. Correct mistakes openly: if an earlier article or page had a wrong number, list it under **Fixes** with the corrected figure.