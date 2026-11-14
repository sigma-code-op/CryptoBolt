# Privacy Policy — CryptoBolt

> CryptoBolt's privacy policy — what data is stored locally in your browser, what's sent to third-party APIs, and how your Groq API key is handled.

Source: https://cryptobolt.io/privacy

CryptoBolt is a client-side market terminal. There's no user account, no server-side database, and no server-side tracking of individual visitors. Almost everything the app remembers — your watchlist, alerts, portfolio entries, notes, and settings — is written directly to your browser's own storage and never leaves your device. The one exception is optional analytics/ad cookies, covered in "Cookies & analytics" below.

## What's stored in your browser (localStorage)

CryptoBolt saves the following to your browser's `localStorage`, scoped to the site's origin. None of it is sent to any server owned by this project:

- Watchlist, price alerts, and alert-trigger history
- Spot holdings and futures positions you enter into the portfolio trackers
- Per-asset notes / trade journal entries
- AI Insight read history (a rolling log of past technical reads per asset)
- Your Groq API key, if you choose to add one (see below)
- Interface preferences: accent color, last-selected asset, chart interval, sound toggle

Clearing your browser's site data for this domain permanently deletes all of it. There is no backup or recovery — nothing exists outside your browser.

## Your Groq API key

If you add a Groq API key to unlock AI-generated reads, that key is stored only in your browser's `localStorage`. When you request an AI read, the key is sent once, over HTTPS, to this app's own lightweight backend proxy in a request header — the backend uses it to call Groq on your behalf and immediately discards it. The key is never written to a database, a log file, or any persistent storage on the backend. If you don't add a key, the AI panel never makes a network call at all and instead computes a locally-calculated, clearly-labeled technical read using plain math already running in your browser.

## Third-party services this app talks to

To show live data, your browser makes direct requests to these services. Each is governed by its own privacy policy, which we don't control:

- [Binance](https://www.binance.com/en/privacy) — spot & futures price, order book, and trade data (REST + WebSocket)
- [CoinGecko](https://www.coingecko.com/en/privacy) — global market cap, volume, and trending-coins data
- [Alternative.me](https://alternative.me/) — the Fear & Greed Index
- [Groq](https://groq.com/privacy-policy/) — only if you've added your own API key, for AI-generated technical reads

These requests carry standard network metadata (like your IP address) to the respective provider, the same as visiting any website that calls their API — this project has no visibility into what each provider does with that traffic beyond what their own policy describes.

## Cookies & analytics

CryptoBolt uses [Google Analytics](https://policies.google.com/privacy) (GA4) to understand traffic at a high level, and [Google AdSense](https://policies.google.com/technologies/ads) to show ads. Both set cookies in your browser and are how this free tool is funded.

A banner asks for your choice the first time you visit. If you accept, analytics and ad-personalization cookies are enabled; if you reject, they stay off and ads are shown without personalization instead. You can change your mind anytime: .

**Language selection.** The language button on our public pages opens the same page through [Google Translate](https://policies.google.com/privacy)'s website translation (a `translate.goog` address). Nothing is sent to Google until you pick a language other than English; after that, Google translates the page and handles your visit under its own privacy policy. We set no cookie for this. Terminal screens are never translated.

This is separate from the `localStorage` data described above, which is not a cookie, is never sent to Google or any analytics provider, and has no consent toggle because it never leaves your device.

## Children's privacy

This app is a financial-market data tool intended for adults and is not directed at children. It does not knowingly collect information from children, in part because it does not collect personal information from anyone.

## Changes to this policy

If this policy changes, the "last updated" date at the top of this page will change with it. Since this is a static page shipped with the app itself, checking back here after an update is the way to see the current version.

Questions about this policy or how the app handles your data? [Get in touch](https://cryptobolt.io/contact).

---
CryptoBolt is a market-data and education tool, not an exchange and not financial advice. Contact: info@cryptobolt.io