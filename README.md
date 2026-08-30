# CryptoBolt

🔗 **Live site:** [cryptobolt.io](https://cryptobolt.io/) · [Launch the terminal](https://cryptobolt.io/app.html) · [AI research](https://cryptobolt.io/ai.html) · [Features](https://cryptobolt.io/features.html) · [Blog](https://cryptobolt.io/blog.html)

A free, real-time **crypto terminal** — live Binance spot & futures prices, pro-grade charting,
order book depth, portfolio tracking, price alerts, and AI-grounded crypto market analysis, all
in one place. If you're looking for a free crypto trading terminal, crypto dashboard, or crypto
market analysis tool, this is what [cryptobolt.io](https://cryptobolt.io/) does.

Follow / find CryptoBolt: [YouTube](https://youtube.com/@cryptobolt) ·
[X (Twitter)](https://x.com/cryptobolt) · [Facebook](https://facebook.com/cryptobolt) ·
[GitHub](https://github.com/sigma-code-op/CryptoBolt)

**First time deploying a website?** Start with
[`CryptoBolt_Complete_Deployment_Guide.md`](./CryptoBolt_Complete_Deployment_Guide.md) — it walks
through every click, in order, in plain English. `DEPLOY_CHECKLIST.md` is the fast reference
version once you've done it once.

A real-time crypto market terminal: live spot & futures data from Binance, TradingView-grade
charting with a full indicator set, an order book/trade tape, portfolio and futures-position
tracking, price alerts, and an AI-generated technical read of whatever asset you're looking at.

```
├── index.html          # App shell (markup only)
├── css/
│   ├── styles.css         # Custom CSS (loaded after Tailwind so it can override utilities)
│   ├── tailwind-input.css # Tailwind entry point — `@import "tailwindcss";`
│   └── tailwind.css       # Compiled output, committed to the repo — run `npm run build:css` after editing classes
├── package.json          # Root-level: Tailwind build tooling only, not a frontend bundler
├── js/                   # Frontend modules, loaded in numeric order (plain <script> tags, no bundler)
│   ├── 00-config.js       #   → runtime config (backend URL, Supabase, Transak)
│   ├── 01-state.js        #   → shared state & small utils
│   ├── 02-api.js           #   → Binance/CoinGecko REST calls
│   ├── 03-ui-table.js       #   → market table rendering
│   ├── 04-ticker-sockets.js  #   → live price WebSocket streams
│   ├── 05-indicators.js       #   → SMA/EMA/RSI/MACD/BB/VWAP math
│   ├── 06-chart-engine.js      #   → chart, order book, trades
│   ├── 07-alerts.js             #   → price alerts
│   ├── 08-portfolio.js           #   → spot + futures position tracking
│   ├── 09-sound-compare.js        #   → alert sound, compare overlay
│   ├── 10-ai-insight.js            #   → AI panel (calls the backend, see below)
│   ├── 11-performance-notes-funding.js
│   ├── 12-events-init.js           #   → keyboard shortcuts, buttons, bootstrap
│   ├── 13-risk-calculator.js       #   → position size & risk calculator
│   ├── 14-transak.js               #   → Buy/Sell widget
│   ├── 15-risk-triggers.js         #   → stop/target trigger checks
│   ├── 16-paper-trading.js         #   → virtual-funds simulator (trade.html)
│   ├── 17-auth.js                  #   → Supabase sign-up/sign-in
│   ├── 18-account.js               #   → account.html purchase history
│   └── 19-cloud-sync.js            #   → cross-device sync of watchlist/alerts/holdings/paper account
└── server/               # Node/Express backend — see server/README.md
```

## Why there's a `server/` now

The AI Market Insight panel sends a Groq API key straight from the browser — same as
before, each visitor brings their own key. The problem it solves isn't "who pays for the key,"
it's that calling Groq directly from a browser runs into CORS/header restrictions, and gives
the frontend full control over the prompt. `server/` is a small proxy: it takes the visitor's key
from a request header, builds the actual prompt itself from validated market numbers (the browser
can only send numbers, never an arbitrary prompt), calls Groq, and returns the result. It
never stores or logs anyone's key — each one is used for exactly one request and discarded.

You (the site owner) don't need a Groq key at all to run this. If you want to try the AI
panel yourself, you paste your own key into the app UI just like any other visitor.

If a visitor hasn't entered a key, or the backend is unreachable, the AI panel automatically falls
back to a clearly-labeled, locally-computed technical read, so the app still works without any
key or backend at all.

## What the AI panel actually does

It's a small research pipeline, not a single prompt on top of RSI/MA math:

1. The backend fetches live news (last 72h, keyless) and the market-wide Fear & Greed index
   in parallel with the AI call.
2. A first model pass reasons freely over technicals + that news/sentiment, explicitly flagging
   where signals disagree.
3. A second pass, grounded in the first pass's own notes, produces the structured read plus a
   **trade setup shape** — breakout continuation, pullback entry, range fade, or no clean setup —
   and how wide (in ATR) the stop should be given current volatility.
4. The frontend turns that shape into real entry/stop/target prices using live support/resistance
   and ATR(14) — the model chooses the strategy, plain math computes every number, so there's
   never a hallucinated price level.

See `server/README.md` for the full pipeline detail and the exact response shape.

## Deploying & going live

Use the complete [single deployment guide](./CryptoBolt_Complete_Deployment_Guide.md). It is the
source of truth for the Tailwind build step, frontend hosting, Node backend deployment, Supabase
(accounts + cross-device cloud sync), Transak, SMTP, DNS, HTTPS, CI, configuration, testing, and
troubleshooting. The short [deployment checklist](./DEPLOY_CHECKLIST.md) is only a final reminder
after you have followed the guide.

## SEO & shareability, already wired up

- `index.html` / `contact.html` / `privacy.html` — full `<title>`/description/canonical, Open
  Graph + Twitter Card tags, and (on the homepage) `WebApplication` + `Organization` JSON-LD
  structured data, so search engines and chat apps can show a rich preview.
- `robots.txt` + `sitemap.xml` at the repo root — submit the sitemap URL in Google Search
  Console and Bing Webmaster Tools after you deploy; that's what actually gets a new site
  crawled and indexed, nothing client-side can do that for you.
- `assets/og-image.png` (1200×630) is the image shown when the site is shared on X, Discord,
  Slack, LinkedIn, iMessage, etc. `assets/favicon.svg` is the source vector; the PNG/ICO sizes
  next to it are pre-rendered for browser tabs, home-screen icons, and PWA installs.
- `site.webmanifest` makes the app installable (Add to Home Screen / desktop PWA install).
- A **Share** button in the header uses the native Web Share API (falls back to copy-link)
  so visitors can share the page in one tap without you building a custom share flow.

- Target keywords (`crypto terminal`, `crypto trading terminal`, `crypto dashboard`, `live crypto
  prices`, `crypto portfolio tracker`, `AI crypto analysis`, etc.) are already in the `<title>`,
  meta description, `keywords` meta, H1/H2 copy, and Open Graph tags on `index.html`, `app.html`,
  `features.html`, `ai.html`, and now `about.html` / `contact.html` too. Note: Google itself
  ignores the `keywords` meta tag for ranking (Bing gives it a little weight) — it's included for
  completeness, but title tags, headings, and real body copy are what actually matter.

**Honest note on ranking:** none of this can guarantee showing up first in search — no one
outside the search engines controls that, and anyone promising a guaranteed #1 ranking is
overselling. What this setup does is remove every *technical* reason a search engine or link
preview would rank/render the site poorly (crawlability, a valid sitemap, correct metadata,
fast load, mobile-friendliness, a real preview image). Actual ranking beyond that comes from
backlinks, content depth, and time — things no code change can shortcut.

### Getting real backlinks (the part code can't do)

A backlink only counts for SEO if it comes from *someone else's* site — links added inside this
repo/README only point outward, they don't point back in, so they help visitors and GitHub's own
index but aren't themselves a ranking signal. To actually build backlinks:

- **Submit the tool, not just the site**: Product Hunt, BetaList, SaaSHub, AlternativeTo, and
  crypto-specific directories (CoinGecko's "apps" listings, CryptoJobsList tool roundups, etc.)
  — most give a free, permanent listing link.
- **List it on GitHub properly**: add `crypto`, `crypto-terminal`, `trading-terminal`,
  `binance-api`, `crypto-dashboard` as repo topics, and fill in the GitHub "Website" field with
  `https://cryptobolt.io` — repo topic pages and the linked site both get crawled.
- **Write for other people's sites**: a guest post, a "tools I use" mention on a crypto/dev blog,
  or answering a relevant Reddit/Stack Overflow/Quora question with a genuine link when it's
  actually the best answer.
- **Press/launch mentions**: a short write-up pitched to crypto or indie-hacker newsletters
  (e.g. Console, TLDR, IndieHackers) tends to earn a real editorial backlink.
- Avoid link farms, PBNs, or bulk "SEO backlink packages" — Google's spam policies treat those as
  manipulative and they can get a site penalized rather than ranked higher.

## Running it locally

**Frontend** — one-time Tailwind build, then any static file server works:

```bash
npm install
npm run build:css   # or `npm run watch:css` while actively editing styles
npx serve .
# or
python3 -m http.server 5500
```

Then open the printed URL. Binance's public REST/WebSocket endpoints and CoinGecko are called
directly from the browser — no backend required for market data, charting, portfolio tracking,
or alerts.

**Backend (optional, needed for the proxy that makes the AI panel work in any browser)**:

```bash
cd server
npm install
cp .env.example .env   # no API key needed here — visitors bring their own
npm run dev
```

Then set `apiBaseUrl` in `js/00-config.js` to `http://localhost:8787` (or wherever you deploy it).

## Deploying

- **Frontend**: any static host — GitHub Pages, Netlify, Vercel, Cloudflare Pages.
- **Backend**: any Node host — Render, Railway, Fly.io, a VPS. See `server/README.md` for details.

## Tech

Tailwind CSS v4 (compiled with the Tailwind CLI — `npm run build:css` — not a CDN script),
TradingView Lightweight Charts, native WebSockets against Binance spot and futures streams with a
reconnect/watchdog layer, REST fallbacks, Groq models (bring-your-own-key) for the AI panel,
Supabase for auth/accounts/cross-device sync, and `localStorage` for watchlists, holdings, alerts,
and notes on top of that. No JS bundler on the frontend — the only build step is the CSS.

## Disclaimer

Nothing in this app is financial advice. Price data, indicators, and AI-generated or
locally-calculated "insights" can be delayed, incomplete, or wrong. Always do your own research
before trading.