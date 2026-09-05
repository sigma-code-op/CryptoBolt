# CryptoBolt — Backend

A small Express proxy in front of Groq's Llama models. It does **not** hold an API key of its own —
each visitor pastes their own Groq key into the app, and it's sent per-request, used once,
and never stored or logged server-side.

## Why this exists

Calling Groq straight from the browser runs into CORS/header restrictions and gives the
frontend full control over the prompt sent to the model. This proxy fixes both: it accepts the
visitor's key in a request header, builds the actual prompt itself from validated market data
(the browser can only send numbers — never an arbitrary prompt), and forwards the call.

## A note on the model

Groq has been retiring its Llama lineup: Llama 4 Scout and Llama 4 Maverick are already gone,
and `llama-3.1-8b-instant` / `llama-3.3-70b-versatile` are scheduled to shut down on
**2026-08-16** in favor of Groq's own `openai/gpt-oss-*` and `qwen` models. This server defaults
to `openai/gpt-oss-120b` via the `GROQ_MODEL` env var — if requests start failing, check
https://console.groq.com/docs/models for what's currently live and update `.env`.

## What `/api/ai-insight` actually does

This isn't a single prompt-and-parse call — it's a small research pipeline:

1. **Live research (keyless, parallel):** the server fetches the asset's last 72h of news
   headlines from CryptoCompare's free news API, and the market-wide Fear & Greed Index from
   Alternative.me. No API key required for either; both degrade silently on failure/timeout.
2. **Pass 1 — research:** a free-text call asks the model to reason over technicals
   (multi-timeframe trend, momentum, volatility, volume, funding if futures) *and* the headlines
   and sentiment just fetched, explicitly flagging disagreement between signals rather than
   smoothing it over.
3. **Pass 2 — synthesis:** a second call, grounded in pass 1's own notes, produces structured
   JSON: trend/momentum/confidence, a hedged outlook, a news/sentiment read, the single nearest
   catalyst to watch, and a **trade setup shape** (`breakout-continuation` / `pullback-entry` /
   `range-fade` / `no-setup`) plus a volatility-scaled stop distance (`stopATRMultiple`).
4. The frontend turns that structure into actual price levels using real support/resistance and
   live ATR(14) — the model never invents a price, only the strategy shape and stop width.

## Track record: is the AI panel actually any good?

Every time the panel renders a real setup (not the local/offline fallback, not "no clear
setup"), the frontend logs it — asset, setup shape, entry zone, stop, both targets, all pure
math already computed from real support/resistance + ATR, nothing new invented — to
`public.ai_calls` (see `supabase/schema.sql`). `lib/ai-call-tracker.js` then re-checks every
open call against live Binance prices on its own timer (`AI_CALL_CHECK_INTERVAL_SECONDS`,
default 60s), marking it a win (`hit_target1`/`hit_target2`), a loss (`hit_stop`), or
`expired` if nothing happens within `AI_CALL_EXPIRY_HOURS` (default 72). `GET
/api/ai-calls/track-record` aggregates the result into a public win-rate + average-R
readout, bucketed by setup type (a range-fade's naturally higher hit rate shouldn't quietly
flatter a breakout call's real record) — shown in-app via the "📊 Show track record" toggle
under the AI panel. Needs only `SUPABASE_URL`/`SUPABASE_API_KEY` — independent of the push
alert section below, so it can be on with no Web Push setup at all.

## Endpoints

- `GET /api/health` — liveness check, also reports which model is configured.
- `POST /api/ai-insight` — header `x-groq-key: gsk_...` (the visitor's own key), body
  `{ "context": { asset, market, interval, price, change24hPct, high24h, low24h, volume24hUSDT, ma7, ma25, rsi14, atr14, atrPct, recentSwingHigh, recentSwingLow, recentClosesTrend, ... } }`.
  Returns `{ "result": { trend, momentum, support, resistance, summary, outlook, confidence, reasoningSteps, keyRisk, newsContext, setupType, stopATRMultiple, catalystWatch }, "research": "...", "sources": [{title, source, hoursAgo}], "fearGreed": {value, classification} }`.
- `POST /api/ai-calls` — logs one AI-generated trade setup for the track record (called
  automatically by the frontend; see above). Body: `{ asset, market, interval, bias,
  setupType, entryLow, entryHigh, stopPrice, target1, target2, priceAtCall, atr14, stopMult
  }`. No-ops with `202` if Supabase isn't configured.
- `GET /api/ai-calls/track-record` — public win-rate/avg-R stats, overall and by setup type.

## Local setup

```bash
cd server
npm install
cp .env.example .env   # no API key needed here — see above
npm run dev
```

The server listens on `http://localhost:8787` by default (`PORT` in `.env`).

## Deploying

Any Node host works (Render, Railway, Fly.io, a small VPS):

1. Push this `server/` folder (or the whole repo) to your host.
2. Set `ALLOWED_ORIGINS` in the host's environment variables to your deployed frontend's URL.
3. Start command: `npm start`.
4. Point the frontend's `apiBaseUrl` (in `js/00-config.js`) at the deployed server's URL.

You (the site owner) don't need a Groq key here at all unless you also want to use the AI
panel yourself — in that case, just paste your own key into the app's UI like any other visitor.

## Security notes

- No Groq key is ever stored, cached, or logged by this server — it's read from the
  `x-groq-key` header, used for exactly one request, and discarded.
- `ALLOWED_ORIGINS` restricts which frontend origins may call the API (CORS).
- `AI_RATE_LIMIT_MAX` / `AI_RATE_LIMIT_WINDOW_MINUTES` cap how often any single IP can call the
  endpoint, regardless of whose key is used.
- Request bodies are capped at 32kb and validated field-by-field before anything is sent to Groq.