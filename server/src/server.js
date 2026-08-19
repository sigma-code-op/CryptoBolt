import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import Groq from 'groq-sdk';
import { validateContext, validateContact } from './validators.js';
import { sendContactEmail, isMailerConfigured } from './mailer.js';

const PORT = process.env.PORT || 8787;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

// Groq retired Llama 4 Scout/Maverick already, and llama-3.1-8b-instant / llama-3.3-70b-versatile
// are scheduled to shut down 2026-08-16 — Groq's recommended replacements are their own
// openai/gpt-oss-* and qwen models. This default MUST stay a currently-supported model: it's
// what every deployment gets unless GROQ_MODEL is explicitly set in the host's env vars, so an
// outdated default here breaks production silently the day Groq flips the switch, even though
// server/.env.example already documents the right value.
// Kept as an env var on purpose so swapping the model doesn't require a code change.
const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

// Bring-your-own-key model: this server holds NO Groq key of its own.
// Each visitor pastes their own key into the app; it's sent per-request in the
// x-groq-key header, used once to call Groq, and never logged or stored.

// ---------- Transak (Buy/Sell Crypto widget) ----------
// Transak deprecated embedding widget params directly in the iframe URL (that now gets a hard
// 403 + X-Frame-Options block) and now REQUIRES generating the widget URL from a backend using
// the partner API key + secret. Full flow: (1) exchange apiKey+secret for a short-lived partner
// access token, (2) use that token to mint a single-use, 5-minute sessionId + widgetUrl scoped to
// this specific buy/sell request, (3) hand only that widgetUrl back to the browser. The secret
// itself NEVER reaches the frontend.
const TRANSAK_API_KEY = process.env.TRANSAK_API_KEY || '';
const TRANSAK_API_SECRET = process.env.TRANSAK_API_SECRET || '';
const TRANSAK_ENVIRONMENT = (process.env.TRANSAK_ENVIRONMENT || 'STAGING').toUpperCase();
const TRANSAK_REFERRER_DOMAIN = process.env.TRANSAK_REFERRER_DOMAIN || '';
const TRANSAK_REFRESH_TOKEN_URL = TRANSAK_ENVIRONMENT === 'PRODUCTION'
  ? 'https://api.transak.com/partners/api/v2/refresh-token'
  : 'https://api-stg.transak.com/partners/api/v2/refresh-token';
const TRANSAK_CREATE_SESSION_URL = TRANSAK_ENVIRONMENT === 'PRODUCTION'
  ? 'https://api-gateway.transak.com/api/v2/auth/session'
  : 'https://api-gateway-stg.transak.com/api/v2/auth/session';

// The partner access token is valid 7 days — cached in memory (per server process) and only
// refreshed once it's within an hour of expiring, so we're not hitting Transak's auth endpoint
// on every single Buy/Sell click.
let cachedTransakAccessToken = null;
let cachedTransakAccessTokenExpiresAt = 0;

async function getTransakAccessToken() {
  const nowSec = Math.floor(Date.now() / 1000);
  if (cachedTransakAccessToken && cachedTransakAccessTokenExpiresAt - nowSec > 3600) {
    return cachedTransakAccessToken;
  }
  const res = await fetch(TRANSAK_REFRESH_TOKEN_URL, {
    method: 'POST',
    headers: { accept: 'application/json', 'api-secret': TRANSAK_API_SECRET, 'content-type': 'application/json' },
    body: JSON.stringify({ apiKey: TRANSAK_API_KEY }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Transak refresh-token failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const json = await res.json();
  const accessToken = json?.data?.accessToken;
  if (!accessToken) throw new Error('Transak refresh-token response missing accessToken');
  cachedTransakAccessToken = accessToken;
  cachedTransakAccessTokenExpiresAt = Number(json?.data?.expiresAt) || nowSec + 6 * 24 * 60 * 60;
  return cachedTransakAccessToken;
}

const app = express();
app.set('trust proxy', 1);
// helmet()'s default Cross-Origin-Resource-Policy: same-origin header blocks this API's
// responses from being read by fetch() calls made from the frontend's origin (cryptobolt.io
// calling api.cryptobolt.io — two different origins by design). The browser enforces that
// header regardless of CORS being configured correctly, and it fails silently as a generic
// "Failed to fetch" in the browser with no explanatory error surfaced to the page — a plain
// page visit (e.g. opening /api/health directly in a tab) is a navigation, not a fetch, so it's
// unaffected by CORP and can misleadingly look like the server is fine. cross-origin here is
// intentional and safe: real access control is handled by the CORS origin allowlist below.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(express.json({ limit: '32kb' }));

// ---------- Live internet research (news + market-wide sentiment) ----------
// Previously the AI only ever saw numbers the frontend already computed from candles —
// technically correct, but not "research": it never knew about a listing, a hack, an ETF
// headline, or a regulatory story that can dominate over pure technicals. These two fetchers
// pull real, live data with NO API key required, with tight timeouts and silent degradation:
// if either call fails or times out, the pipeline proceeds without it rather than failing the
// whole insight. Nothing here is ever shown to the user as fact without the model citing it.

async function fetchWithTimeout(url, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json' } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// CryptoCompare's news endpoint is free and keyless for reasonable volumes. We filter by the
// asset's own news category, then fall back to the general "Trading" category if the asset has
// no dedicated feed, so smaller-cap coins still get some market-wide news context.
async function fetchCryptoNews(asset) {
  const symbol = (asset || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15);
  if (!symbol) return [];
  const primary = await fetchWithTimeout(
    `https://min-api.cryptocompare.com/data/v2/news/?lang=EN&categories=${encodeURIComponent(symbol)}&sortOrder=latest`,
    4500
  );
  let items = Array.isArray(primary?.Data) ? primary.Data : [];
  if (items.length === 0) {
    const fallback = await fetchWithTimeout(
      'https://min-api.cryptocompare.com/data/v2/news/?lang=EN&categories=Trading&sortOrder=latest',
      4500
    );
    items = Array.isArray(fallback?.Data) ? fallback.Data : [];
  }
  const nowSec = Date.now() / 1000;
  return items
    .filter((it) => it?.title && it?.published_on && nowSec - it.published_on < 60 * 60 * 72)
    .slice(0, 6)
    .map((it) => ({
      title: String(it.title).slice(0, 180),
      source: String(it.source_info?.name || it.source || 'unknown').slice(0, 40),
      hoursAgo: Math.max(0, Math.round((nowSec - it.published_on) / 3600)),
    }));
}

// Alternative.me's Fear & Greed Index is free, keyless, and updates daily — gives the model
// market-wide risk appetite context that a single asset's chart can't show on its own.
async function fetchFearGreedIndex() {
  const data = await fetchWithTimeout('https://api.alternative.me/fng/?limit=1', 3500);
  const entry = data?.data?.[0];
  if (!entry) return null;
  return { value: Number(entry.value), classification: String(entry.value_classification || '') };
}

app.use(
  cors({
    origin(origin, callback) {
      // Allow same-origin / server-to-server calls (no Origin header), local file:// pages
      // (browsers send the literal string "null" as Origin for those), and configured origins.
      if (!origin || origin === 'null' || ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    allowedHeaders: ['Content-Type', 'x-groq-key'],
  })
);

// Rate limited per-IP so one visitor (with or without a key) can't hammer the endpoint.
const aiLimiter = rateLimit({
  windowMs: (Number(process.env.AI_RATE_LIMIT_WINDOW_MINUTES) || 15) * 60 * 1000,
  max: Number(process.env.AI_RATE_LIMIT_MAX) || 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many AI insight requests from this address. Please wait and try again.' },
});

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'cryptobolt-server',
    model: GROQ_MODEL,
    mailerConfigured: isMailerConfigured(),
    transakConfigured: Boolean(TRANSAK_API_KEY && TRANSAK_API_SECRET && TRANSAK_REFERRER_DOMAIN),
    time: new Date().toISOString(),
  });
});

// Rate limited per-IP — mints a live, single-use Transak session, so it shouldn't be hammered.
const transakLimiter = rateLimit({
  windowMs: (Number(process.env.TRANSAK_RATE_LIMIT_WINDOW_MINUTES) || 15) * 60 * 1000,
  max: Number(process.env.TRANSAK_RATE_LIMIT_MAX) || 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many widget requests from this address. Please wait and try again.' },
});

// Mints a fresh, single-use Transak widgetUrl for one Buy/Sell modal open. Called every time the
// modal opens or the asset/mode changes — a sessionId can't be reused, so this is never cached
// on the frontend.
app.post('/api/transak-widget-url', transakLimiter, async (req, res) => {
  if (!TRANSAK_API_KEY || !TRANSAK_API_SECRET) {
    return res.status(503).json({ error: 'Transak is not configured on this server yet (missing TRANSAK_API_KEY / TRANSAK_API_SECRET).' });
  }
  if (!TRANSAK_REFERRER_DOMAIN) {
    return res.status(503).json({ error: 'TRANSAK_REFERRER_DOMAIN is not set on this server.' });
  }

  const mode = req.body?.mode === 'SELL' ? 'SELL' : 'BUY';
  const symbol = String(req.body?.symbol || 'BTC').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15) || 'BTC';

  const widgetParams = {
    apiKey: TRANSAK_API_KEY,
    referrerDomain: TRANSAK_REFERRER_DOMAIN,
    productsAvailable: mode,
    defaultCryptoCurrency: symbol,
    themeColor: mode === 'BUY' ? '14d38a' : 'ff9f1c',
    exchangeScreenTitle: `${mode === 'BUY' ? 'Buy' : 'Sell'} ${symbol}`,
  };
  // Only forward a partnerCustomerId that looks like one of our own Supabase user UUIDs — never
  // trust an arbitrary client-supplied string here, since it gets attributed to a real order.
  const partnerCustomerId = req.body?.partnerCustomerId;
  if (typeof partnerCustomerId === 'string' && /^[0-9a-f-]{36}$/i.test(partnerCustomerId)) {
    widgetParams.partnerCustomerId = partnerCustomerId;
  }

  try {
    const accessToken = await getTransakAccessToken();
    const sessionRes = await fetch(TRANSAK_CREATE_SESSION_URL, {
      method: 'POST',
      headers: { accept: 'application/json', 'access-token': accessToken, 'content-type': 'application/json' },
      body: JSON.stringify({ widgetParams }),
    });
    if (!sessionRes.ok) {
      const text = await sessionRes.text().catch(() => '');
      console.error('[cryptobolt-server] Transak create-widget-url failed:', sessionRes.status, text.slice(0, 300));
      return res.status(502).json({ error: 'Could not start the Transak widget session. Please try again.' });
    }
    const sessionJson = await sessionRes.json();
    const widgetUrl = sessionJson?.data?.widgetUrl;
    if (!widgetUrl) {
      return res.status(502).json({ error: 'Transak session response was missing a widget URL.' });
    }
    return res.json({ widgetUrl });
  } catch (err) {
    console.error('[cryptobolt-server] Transak widget URL error:', err?.message || err);
    return res.status(502).json({ error: 'Could not reach Transak right now. Please try again shortly.' });
  }
});

// Rate limited per-IP so the contact form can't be used to spam an inbox.
const contactLimiter = rateLimit({
  windowMs: (Number(process.env.CONTACT_RATE_LIMIT_WINDOW_MINUTES) || 15) * 60 * 1000,
  max: Number(process.env.CONTACT_RATE_LIMIT_MAX) || 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many messages sent from this address. Please wait and try again.' },
});

app.post('/api/contact', contactLimiter, async (req, res) => {
  const validationError = validateContact(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }
  const { name, email, topic, message } = req.body;
  try {
    await sendContactEmail({ name: name.trim(), email: email.trim(), topic, message: message.trim() });
    return res.json({ ok: true });
  } catch (err) {
    if (err?.code === 'MAILER_NOT_CONFIGURED') {
      console.error('[cryptobolt-server] Contact form used, but mailer is not configured — see server/.env.example.');
      return res.status(503).json({ error: 'Contact form isn\'t set up on this deployment yet. Please use a direct contact link instead.' });
    }
    console.error('[cryptobolt-server] Contact email send failed:', err?.message || err);
    return res.status(502).json({ error: 'Could not send your message right now. Please try again shortly.' });
  }
});

// ---------- Prompting strategy ----------
// This is a genuine two-pass pipeline, not a single-shot call dressed up to look thorough:
//  Pass 1 ("research"): the model reasons in free text over every signal it's been given —
//    multi-timeframe agreement, momentum, volatility, volume, and (perpetual only) funding-rate
//    positioning — and is explicitly told to flag where signals disagree, not paper over it.
//  Pass 2 ("synthesis"): a fresh call receives the ORIGINAL data plus pass 1's own research notes
//    and must ground every field of the final structured JSON in that reasoning. Grounding the
//    second pass in the first pass's actual output (rather than just asking one model to "think
//    step by step" inline) means the synthesis step can't quietly skip the harder analytical work.
// Spot and perpetual futures get materially different instructions, not just a word swap: spot
// framing is about accumulation/distribution and multi-timeframe positioning with no leverage
// context; perpetual framing must weigh funding-rate crowding/squeeze risk and liquidation-aware
// caution, since a technically identical chart implies different risk depending on the wrapper.

function marketFramingBlock(ctx) {
  if (ctx.market === 'perpetual futures') {
    return `This is a PERPETUAL FUTURES market, not spot. That changes what matters:
- Funding rate is a crowding signal: sustained positive funding means longs are paying shorts and the trade is crowded long (squeeze-lower risk on any wobble); sustained negative funding means the opposite (crowded short, squeeze-higher risk). A funding rate near zero implies no strong positioning bias either way.
- Because positions here can be leveraged, technical invalidation levels matter more urgently than on spot — mention that a leveraged position can be liquidated well before a "long-term thesis" would be proven wrong, without giving specific leverage or liquidation numbers (the app already shows those elsewhere).
- Frame the technical scenario over a shorter, more tactical horizon than you would for spot.`;
  }
  return `This is a SPOT market — the person may be holding the asset outright with no leverage. Framing should:
- Consider a somewhat longer accumulation/distribution horizon than a leveraged trader would use.
- NOT mention funding rates, liquidation, or leverage at all — none of that applies here.
- Still flag near-term technical risk, but there's no forced-liquidation urgency to convey.`;
}

const RESEARCH_SYSTEM_PROMPT = `You are the research stage of a two-stage technical-analysis pipeline embedded in a crypto market dashboard. Your ONLY job is to reason carefully in plain text — a second model call will later turn your notes into a structured summary, so do not format as JSON and do not write a final verdict yet.

Work through, explicitly, in short labeled paragraphs:
1. Multi-timeframe read: does the higher-timeframe context (1h/4h/1d, if given) agree with the chart interval being analyzed? Note any disagreement plainly — disagreement across timeframes is itself an important, honestly-reportable finding, not something to smooth over.
2. Momentum: what RSI and the MA(7)/MA(25) relationship actually imply, including if they contradict each other.
3. Volatility & volume: what ATR (relative to price) and the volume trend say about how much to trust the current move.
4. Key levels: how far price sits from the recent swing high/low, and what that implies about room to run vs. proximity to a level.
5. Only if this is a perpetual futures market: funding-rate positioning and what it implies about crowding risk.
6. News & sentiment, if provided below: do any of the recent headlines plausibly explain the current price action or represent a live catalyst/risk (listing, hack, regulatory action, macro event, ETF flow, etc.)? Is broad market sentiment (Fear & Greed) reinforcing or fighting the technical picture? If no news was provided, or none of it is relevant to this asset, say so plainly rather than inventing a connection.
7. What would most cleanly invalidate a bullish read, and what would most cleanly invalidate a bearish read — be specific about which data point or headline would need to change.

Be honest about disagreement and uncertainty between signals rather than forcing a tidy narrative. Never state a headline as fact beyond what it says — you are told the headline text and source, not the full article, so treat it as a reported claim, not verified truth. Do not recommend buying, selling, or holding, and do not state a specific future price. Keep the whole response under 260 words.`;

const SYNTHESIS_SYSTEM_PROMPT_HEADER = `You are the synthesis stage of a two-stage technical-analysis pipeline embedded in a crypto market dashboard. You are given the same live market statistics a first-pass research model already reasoned over, PLUS that model's own research notes. Ground every field below in that research — don't introduce new claims the notes didn't support, and don't ignore a disagreement the notes flagged.

Do NOT recommend buying, selling, or holding. Do NOT state or imply a specific future price. Do NOT use words like "will", "guaranteed", "definitely", or "certain" about future price action — use only hedged language ("may", "could", "would need to", "if X holds"). The "outlook" field must describe a scenario conditionally, never a forecast presented as fact.`;

function synthesisSystemPrompt(ctx) {
  const isFutures = ctx.market === 'perpetual futures';
  const fundingField = isFutures
    ? `,"fundingContext":"1 sentence on what the funding rate implies about crowding/squeeze risk right now, or null if funding data wasn't provided"`
    : '';
  return `${SYNTHESIS_SYSTEM_PROMPT_HEADER}

${marketFramingBlock(ctx)}

You are also given recent news headlines (if any were found) and the market-wide Fear & Greed index. Weigh these as real inputs, not decoration: if a headline plausibly explains the move or represents a live catalyst/risk, say so; if sentiment reinforces or fights the technical read, say so. If no relevant news was found, newsContext must be null — never invent a headline or a causal story that isn't in the notes.

You must also propose a TRADE STRUCTURE — not exact entry/target/stop prices (the app computes those deterministically from support/resistance/ATR, never trust a model with exact price levels) — but the STRATEGY shape a disciplined trader would use given everything above:
- "setupType": "breakout-continuation" (trade in the trend's direction, expecting the move to extend) | "pullback-entry" (wait for a retracement toward support/resistance before entering with the trend) | "range-fade" (fade extremes back toward the middle of a range) | "no-setup" (signals too mixed, or a major news catalyst makes technical structure unreliable right now)
- "stopATRMultiple": a number 1.0-3.0 — how many ATR(14) the invalidation/stop should sit beyond the entry, given current volatility (tighter in low-vol/high-conviction setups, wider when ATR is elevated or news adds uncertainty)
- "catalystWatch": "1 short sentence naming the single nearest event/level/headline a trader should watch that could invalidate or accelerate this setup, or null if nothing stands out"

Respond with ONLY a single valid JSON object, no markdown fences, no extra text, matching exactly this shape: {"trend":"bullish|bearish|neutral","momentum":"strong|moderate|weak","support":<number>,"resistance":<number>,"summary":"2-3 sentence plain-English technical read, factual and hedged, no trade calls","outlook":"1-2 sentence hedged, conditional near-term technical scenario (e.g. what continuation or reversal would each require) - never a confident forecast","confidence":"low|medium|high describing how clearly the indicators agree with each other, NOT how likely the outlook is to come true","reasoningSteps":["3-4 short factual bullet points (each under 15 words) distilled from the research notes, covering the strongest points FOR and the strongest points AGAINST the stated trend"],"keyRisk":"1 sentence: the single most likely way this specific read turns out wrong","newsContext":"1-2 sentence read on whether recent news/sentiment support, contradict, or are irrelevant to the technical picture, or null","setupType":"breakout-continuation|pullback-entry|range-fade|no-setup","stopATRMultiple":<number 1.0-3.0>,"catalystWatch":"short sentence or null"${fundingField}}`;
}

function buildUserPrompt(ctx) {
  const lines = [
    `Market data for ${ctx.asset} (${ctx.market}, ${ctx.interval} chart):`,
    `Price: $${ctx.price}`,
    `24h change: ${ctx.change24hPct}%`,
    `24h high: $${ctx.high24h}, 24h low: $${ctx.low24h}`,
    `24h volume (USDT): ${ctx.volume24hUSDT}`,
    `MA(7): ${ctx.ma7}, MA(25): ${ctx.ma25}`,
    `RSI(14): ${ctx.rsi14}`,
    `Recent swing high: $${ctx.recentSwingHigh}, recent swing low: $${ctx.recentSwingLow}`,
  ];
  if (typeof ctx.atr14 === 'number') {
    lines.push(`ATR(14): ${ctx.atr14}${typeof ctx.atrPct === 'number' ? ` (${ctx.atrPct.toFixed(2)}% of price — higher means choppier/more volatile right now)` : ''}`);
  }
  if (ctx.volumeTrend) {
    lines.push(`Recent volume trend: ${ctx.volumeTrend} (last 10 candles vs. the 10 before that)`);
  }
  if (Array.isArray(ctx.mtf) && ctx.mtf.length > 0) {
    lines.push(`Higher-timeframe trend readout: ${ctx.mtf.map((m) => `${m.tf}=${m.trend}(${m.pct >= 0 ? '+' : ''}${m.pct.toFixed(2)}%)`).join(', ')}`);
  }
  if (ctx.market === 'perpetual futures' && typeof ctx.fundingRatePct === 'number') {
    lines.push(`Current funding rate: ${ctx.fundingRatePct >= 0 ? '+' : ''}${ctx.fundingRatePct.toFixed(4)}% (next funding in ~${ctx.fundingNextMins ?? '?'} min) — positive means longs pay shorts, negative means shorts pay longs`);
  }
  lines.push(`Last 30 closes: ${JSON.stringify(ctx.recentClosesTrend)}`);

  if (Array.isArray(ctx.newsItems) && ctx.newsItems.length > 0) {
    lines.push('');
    lines.push(`Recent news (last 72h, may or may not be directly about ${ctx.asset} — judge relevance yourself):`);
    ctx.newsItems.forEach((n, i) => {
      lines.push(`${i + 1}. "${n.title}" — ${n.source}, ${n.hoursAgo}h ago`);
    });
  } else {
    lines.push('');
    lines.push('Recent news: none found in the last 72h for this asset.');
  }

  if (ctx.fearGreed) {
    lines.push(`Market-wide sentiment — Fear & Greed Index: ${ctx.fearGreed.value}/100 (${ctx.fearGreed.classification}).`);
  }

  return lines.join('\n');
}

// Belt-and-suspenders: even with prompt instructions, a model can occasionally slip in
// overconfident language. Soften the most common offenders before this ever reaches a user.
const OVERCONFIDENT_REPLACEMENTS = [
  [/\bwill\b/gi, 'may'],
  [/\bguaranteed\b/gi, 'possible'],
  [/\bdefinitely\b/gi, 'likely'],
  [/\bcertainly\b/gi, 'likely'],
  [/\bcertain to\b/gi, 'likely to'],
  [/\bis going to\b/gi, 'could'],
];
function softenOverconfidentLanguage(text) {
  if (typeof text !== 'string') return text;
  return OVERCONFIDENT_REPLACEMENTS.reduce((acc, [pattern, replacement]) => acc.replace(pattern, replacement), text);
}
function softenList(list) {
  if (!Array.isArray(list)) return list;
  return list.map((t) => softenOverconfidentLanguage(t));
}



app.post('/api/ai-insight', aiLimiter, async (req, res) => {
  const apiKey = req.get('x-groq-key');
  if (!apiKey || !apiKey.startsWith('gsk_')) {
    return res.status(401).json({ error: 'Missing or invalid Groq API key. Add your key in the app first.' });
  }

  const ctx = req.body?.context;
  const validationError = validateContext(ctx);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  // A fresh client per request, scoped to this visitor's key — never cached or reused,
  // never written to disk or logs.
  const groq = new Groq({ apiKey });

  // ---- Live internet research: news + market-wide sentiment, fetched in parallel ----
  // Both are keyless public endpoints with tight timeouts (see fetchWithTimeout above) and
  // degrade silently — a slow/unavailable news source never blocks or fails the AI insight,
  // it just means the model reasons without that extra context for this one request.
  const [newsItems, fearGreed] = await Promise.all([
    fetchCryptoNews(ctx.asset).catch(() => []),
    fetchFearGreedIndex().catch(() => null),
  ]);
  const enrichedCtx = { ...ctx, newsItems, fearGreed };
  const userPrompt = buildUserPrompt(enrichedCtx);

  try {
    // ---- Pass 1: research (free-text reasoning, not JSON-constrained) ----
    const researchCompletion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      max_tokens: 700,
      reasoning_effort: 'low',
      messages: [
        { role: 'system', content: RESEARCH_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    });
    const researchNotes = (researchCompletion.choices?.[0]?.message?.content || '').trim();

    // ---- Pass 2: synthesis, grounded in pass 1's own notes ----
    // gpt-oss models on Groq can occasionally spend their whole token budget on internal
    // reasoning and return an empty completion under response_format: json_object (Groq
    // then rejects it with a 400 json_validate_failed and an empty failed_generation). This
    // is intermittent, not deterministic, so one retry clears most cases without user impact.
    const synthesisMessages = [
      { role: 'system', content: synthesisSystemPrompt(enrichedCtx) },
      { role: 'user', content: `${userPrompt}\n\nResearch notes from pass 1 (ground your answer in these):\n${researchNotes || '(no research notes were returned — reason from the raw data above only)'}` },
    ];
    let rawText = '';
    let lastErr = null;
    for (let attempt = 0; attempt < 2 && !rawText; attempt++) {
      try {
        const synthesisCompletion = await groq.chat.completions.create({
          model: GROQ_MODEL,
          max_tokens: 1200,
          reasoning_effort: 'low',
          response_format: { type: 'json_object' },
          messages: synthesisMessages,
        });
        rawText = (synthesisCompletion.choices?.[0]?.message?.content || '').trim();
      } catch (e) {
        lastErr = e;
      }
    }
    if (!rawText) {
      if (lastErr) throw lastErr;
      return res.status(502).json({ error: 'AI model returned an empty response — try again.' });
    }
    const cleaned = rawText.replace(/^```json\s*/i, '').replace(/```$/, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return res.status(502).json({ error: 'AI service returned an unexpected response format.' });
    }

    parsed.summary = softenOverconfidentLanguage(parsed.summary);
    parsed.outlook = softenOverconfidentLanguage(parsed.outlook);
    parsed.reasoningSteps = softenList(parsed.reasoningSteps);
    if (parsed.keyRisk) parsed.keyRisk = softenOverconfidentLanguage(parsed.keyRisk);
    if (parsed.fundingContext) parsed.fundingContext = softenOverconfidentLanguage(parsed.fundingContext);
    if (parsed.newsContext) parsed.newsContext = softenOverconfidentLanguage(parsed.newsContext);
    if (parsed.catalystWatch) parsed.catalystWatch = softenOverconfidentLanguage(parsed.catalystWatch);
    if (typeof parsed.stopATRMultiple === 'number') {
      parsed.stopATRMultiple = Math.min(3, Math.max(1, parsed.stopATRMultiple));
    }

    return res.json({
      result: parsed,
      research: researchNotes || null,
      sources: newsItems.map((n) => ({ title: n.title, source: n.source, hoursAgo: n.hoursAgo })),
      fearGreed: fearGreed || null,
    });
  } catch (err) {
    const status = err?.status;
    if (status === 401) {
      return res.status(401).json({ error: 'Invalid API key — check the key you entered and try again.' });
    }
    if (status === 429) {
      return res.status(429).json({ error: 'Rate limited by Groq — wait a moment and try again.' });
    }
    if (status === 404 || (err?.message || '').includes('model')) {
      return res.status(502).json({ error: `Model "${GROQ_MODEL}" is unavailable — Groq may have retired it. Set GROQ_MODEL in the server's .env to a currently supported model.` });
    }
    console.error('[cryptobolt-server] Groq request error:', err?.message || err);
    return res.status(502).json({ error: 'AI service request failed.' });
  }
});

app.use((err, _req, res, _next) => {
  if (err?.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'Origin not allowed.' });
  }
  console.error('[cryptobolt-server] Unhandled error:', err);
  return res.status(500).json({ error: 'Internal server error.' });
});

// Bind to a port unless this file was imported by the test suite (NODE_ENV=test), which uses
// `app` with its own ephemeral listener instead, so tests never fight over PORT or leave a real
// server running after they finish.
//
// NOTE: this used to detect "was I run directly?" via `import.meta.url === file://${process.argv[1]}`
// (the ESM equivalent of `require.main === module`). That check silently fails on Hostinger's
// Node.js hosting because Hostinger launches the app through its own process wrapper, so
// process.argv[1] never matches import.meta.url — app.listen() never ran, and Hostinger killed
// the app after 3 seconds with "App did not call listen() within 3 seconds." Every deploy was
// hitting this. An explicit NODE_ENV check avoids relying on how the host invokes the process.
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`[cryptobolt-server] listening on port ${PORT} (bring-your-own-key mode, model: ${GROQ_MODEL})`);
  });
}

export { app };