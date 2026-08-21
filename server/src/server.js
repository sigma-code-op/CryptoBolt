import 'dotenv/config';
import crypto from 'crypto';
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

// =========================================================
// GROQ
// =========================================================

const GROQ_MODEL =
  process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

// CryptoBolt uses BYOK.
// The server does NOT permanently store a user's Groq key.
// The frontend sends the key with each AI request.

// =========================================================
// ALCHEMYPAY
// =========================================================
// AlchemyPay's Ramp "Page Integration" is a signed-URL flow, not a token-exchange flow like
// Transak: every request (widget URL, order status query) is authenticated by an HMAC-SHA256
// signature computed from timestamp + httpMethod + requestPath(+sorted query) + bodyString,
// using the merchant's appSecret. The appSecret NEVER leaves this file — see
// https://alchemypay.readme.io/docs/api-sign and https://alchemypay.readme.io/docs/on-ramp-custom-parameters

const ALCHEMYPAY_APP_ID =
  process.env.ALCHEMYPAY_APP_ID || '';

const ALCHEMYPAY_APP_SECRET =
  process.env.ALCHEMYPAY_APP_SECRET || '';

const ALCHEMYPAY_ENVIRONMENT =
  (process.env.ALCHEMYPAY_ENVIRONMENT || 'STAGING').toUpperCase();

// Ramp widget (page integration) host — this is what the iframe src points at.
const ALCHEMYPAY_RAMP_URL =
  ALCHEMYPAY_ENVIRONMENT === 'PRODUCTION'
    ? 'https://ramp.alchemypay.org'
    : 'https://ramptest.alchemypay.org';

// Open API host — used for server-to-server calls like Query Order.
const ALCHEMYPAY_API_URL =
  ALCHEMYPAY_ENVIRONMENT === 'PRODUCTION'
    ? 'https://openapi.alchemypay.org'
    : 'https://openapi-test.alchemypay.org';

const ALCHEMYPAY_REDIRECT_BASE =
  process.env.ALCHEMYPAY_REDIRECT_BASE || 'https://cryptobolt.io';

const ALCHEMYPAY_CALLBACK_URL =
  process.env.ALCHEMYPAY_CALLBACK_URL || '';

// Sensible default network per popular ticker, so a person doesn't have to pick a chain just
// to buy/sell BTC. Coins not in this list are still supported — we just omit 'network' and let
// AlchemyPay's own widget ask the visitor to choose one.
const ALCHEMYPAY_DEFAULT_NETWORK = {
  BTC: 'BTC',
  ETH: 'ETH',
  USDT: 'TRX',
  USDC: 'ETH',
  BNB: 'BSC',
  SOL: 'SOL',
  XRP: 'XRP',
  ADA: 'ADA',
  DOGE: 'DOGE',
  MATIC: 'POLYGON',
  TRX: 'TRX',
  DOT: 'DOT',
  LTC: 'LTC',
  AVAX: 'AVAXC',
};

// timestamp + httpMethod + requestPath(with sorted, non-empty query params) + bodyString,
// HMAC-SHA256'd with the appSecret and base64-encoded. Identical rule for GET (query-signed)
// and POST (body-signed) endpoints — see docs/api-sign.
function alchemyPaySign({ timestamp, httpMethod, requestPath, queryParams, bodyObj }) {
  let pathForSig = requestPath;

  if (queryParams && Object.keys(queryParams).length) {
    const sortedQuery = Object.keys(queryParams)
      .filter((k) => queryParams[k] !== undefined && queryParams[k] !== null && queryParams[k] !== '')
      .sort()
      .map((k) => `${k}=${queryParams[k]}`)
      .join('&');
    if (sortedQuery) pathForSig = `${requestPath}?${sortedQuery}`;
  }

  let bodyString = '';
  if (bodyObj && Object.keys(bodyObj).length) {
    const cleaned = {};
    Object.keys(bodyObj)
      .filter((k) => bodyObj[k] !== undefined && bodyObj[k] !== null && bodyObj[k] !== '')
      .sort()
      .forEach((k) => {
        cleaned[k] = bodyObj[k];
      });
    if (Object.keys(cleaned).length) bodyString = JSON.stringify(cleaned);
  }

  const content = `${timestamp}${httpMethod.toUpperCase()}${pathForSig}${bodyString}`;

  return crypto
    .createHmac('sha256', ALCHEMYPAY_APP_SECRET)
    .update(content, 'utf8')
    .digest('base64');
}

// =========================================================
// APP
// =========================================================

const app = express();

app.set('trust proxy', 1);

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: 'cross-origin',
    },
  })
);

app.use(
  express.json({
    limit: '32kb',
  })
);

// =========================================================
// LIVE INTERNET RESEARCH
// =========================================================

async function fetchWithTimeout(url, ms) {
  const controller = new AbortController();

  const timer = setTimeout(
    () => controller.abort(),
    ms
  );

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: 'application/json',
      },
    });

    if (!res.ok) {
      return null;
    }

    return await res.json();

  } catch {
    return null;

  } finally {
    clearTimeout(timer);
  }
}

// =========================================================
// CRYPTO NEWS
// =========================================================

async function fetchCryptoNews(asset) {
  const symbol =
    (asset || '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 15);

  if (!symbol) {
    return [];
  }

  const primary =
    await fetchWithTimeout(
      `https://min-api.cryptocompare.com/data/v2/news/?lang=EN&categories=${encodeURIComponent(symbol)}&sortOrder=latest`,
      4500
    );

  let items =
    Array.isArray(primary?.Data)
      ? primary.Data
      : [];

  // Fallback to general trading news.
  if (items.length === 0) {

    const fallback =
      await fetchWithTimeout(
        'https://min-api.cryptocompare.com/data/v2/news/?lang=EN&categories=Trading&sortOrder=latest',
        4500
      );

    items =
      Array.isArray(fallback?.Data)
        ? fallback.Data
        : [];
  }

  const nowSec =
    Date.now() / 1000;

  return items
    .filter(
      (item) =>
        item?.title &&
        item?.published_on &&
        nowSec - item.published_on <
          60 * 60 * 72
    )
    .slice(0, 6)
    .map((item) => ({
      title: String(
        item.title
      ).slice(0, 180),

      source: String(
        item.source_info?.name ||
        item.source ||
        'Unknown'
      ).slice(0, 40),

      hoursAgo: Math.max(
        0,
        Math.round(
          (nowSec - item.published_on) /
            3600
        )
      ),
    }));
}

// =========================================================
// FEAR & GREED
// =========================================================

async function fetchFearGreedIndex() {
  const data =
    await fetchWithTimeout(
      'https://api.alternative.me/fng/?limit=1',
      3500
    );

  const entry =
    data?.data?.[0];

  if (!entry) {
    return null;
  }

  return {
    value: Number(entry.value),
    classification:
      String(
        entry.value_classification || ''
      ),
  };
}

// =========================================================
// CORS
// =========================================================

app.use(
  cors({
    origin(origin, callback) {

      if (
        !origin ||
        origin === 'null' ||
        ALLOWED_ORIGINS.length === 0 ||
        ALLOWED_ORIGINS.includes(origin)
      ) {
        return callback(null, true);
      }

      return callback(
        new Error('Not allowed by CORS')
      );
    },

    allowedHeaders: [
      'Content-Type',
      'x-groq-key',
    ],
  })
);

// =========================================================
// AI RATE LIMIT
// =========================================================

const aiLimiter = rateLimit({
  windowMs:
    (Number(
      process.env.AI_RATE_LIMIT_WINDOW_MINUTES
    ) || 15) *
    60 *
    1000,

  max:
    Number(
      process.env.AI_RATE_LIMIT_MAX
    ) || 30,

  standardHeaders: true,

  legacyHeaders: false,

  message: {
    error:
      'Too many AI requests from this address. Please wait and try again.',
  },
});

// =========================================================
// HEALTH
// =========================================================

app.get('/api/health', (_req, res) => {

  res.json({
    ok: true,

    service:
      'cryptobolt-server',

    model:
      GROQ_MODEL,

    mailerConfigured:
      isMailerConfigured(),

    alchemyPayConfigured:
      Boolean(
        ALCHEMYPAY_APP_ID &&
        ALCHEMYPAY_APP_SECRET
      ),

    time:
      new Date().toISOString(),
  });
});

// =========================================================
// ALCHEMYPAY RATE LIMIT
// =========================================================

const alchemyPayLimiter = rateLimit({
  windowMs:
    (Number(
      process.env.ALCHEMYPAY_RATE_LIMIT_WINDOW_MINUTES
    ) || 15) *
    60 *
    1000,

  max:
    Number(
      process.env.ALCHEMYPAY_RATE_LIMIT_MAX
    ) || 60,

  standardHeaders: true,

  legacyHeaders: false,

  message: {
    error:
      'Too many widget requests from this address. Please wait and try again.',
  },
});

// =========================================================
// ALCHEMYPAY WIDGET URL
// =========================================================
// Unlike Transak, AlchemyPay's page-integration widget needs no server-minted session/token —
// the backend just signs a query string with the merchant's appSecret and the frontend drops
// the result straight into an iframe src. We still keep this server-side so the appSecret is
// never exposed to the browser, and so we can attach a per-order merchantOrderNo we control.

app.post(
  '/api/alchemypay-widget-url',
  alchemyPayLimiter,
  (req, res) => {

    if (
      !ALCHEMYPAY_APP_ID ||
      !ALCHEMYPAY_APP_SECRET
    ) {
      return res.status(503).json({
        error:
          'AlchemyPay is not configured on this server yet.',
      });
    }

    const mode =
      req.body?.mode === 'SELL'
        ? 'SELL'
        : 'BUY';

    const side =
      mode === 'SELL'
        ? 'sell'
        : 'buy';

    const symbol =
      String(
        req.body?.symbol || 'BTC'
      )
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 15) || 'BTC';

    const network =
      String(
        req.body?.network ||
        ALCHEMYPAY_DEFAULT_NETWORK[symbol] ||
        ''
      )
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 20);

    // Ours to generate and track — carried through in the webhook + Query Order lookups, and
    // echoed back on redirectUrl so the frontend knows which order to poll after the widget
    // hands control back to us.
    const merchantOrderNo =
      `cb${Date.now()}${crypto.randomBytes(4).toString('hex')}`;

    const timestamp =
      String(Date.now());

    const requestPath =
      side === 'buy'
        ? '/index/rampPageBuy'
        : '/index/rampPageSell';

    const queryParams = {
      appId: ALCHEMYPAY_APP_ID,
      crypto: symbol,
      showTable: side,
      merchantOrderNo,
      redirectUrl: `${ALCHEMYPAY_REDIRECT_BASE.replace(/\/$/, '')}/ramp-return.html?orderNo=${encodeURIComponent(merchantOrderNo)}&side=${side}`,
      timestamp,
    };

    if (network) queryParams.network = network;
    if (ALCHEMYPAY_CALLBACK_URL) queryParams.callbackUrl = ALCHEMYPAY_CALLBACK_URL;

    const partnerCustomerEmail =
      req.body?.email;

    if (
      typeof partnerCustomerEmail === 'string' &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(partnerCustomerEmail)
    ) {
      queryParams.email = partnerCustomerEmail;
    }

    try {

      const sign = alchemyPaySign({
        timestamp,
        httpMethod: 'GET',
        requestPath,
        queryParams,
      });

      const search = new URLSearchParams({
        ...queryParams,
        sign,
      }).toString();

      const widgetUrl = `${ALCHEMYPAY_RAMP_URL}?${search}`;

      return res.json({
        widgetUrl,
        merchantOrderNo,
        side,
      });

    } catch (err) {

      console.error(
        '[cryptobolt-server] AlchemyPay widget URL error:',
        err?.message || err
      );

      return res.status(502).json({
        error:
          'Could not start the AlchemyPay widget session. Please try again shortly.',
      });
    }
  }
);

// =========================================================
// ALCHEMYPAY ORDER STATUS
// =========================================================
// Called by the frontend once the widget redirects back to /ramp-return.html, so the actual
// completed crypto/fiat amounts (not just "the user finished the flow") come from AlchemyPay's
// own Query Order API rather than being trusted from the client. See
// https://alchemypay.readme.io/docs/query-order-2

app.get(
  '/api/alchemypay-order-status',
  alchemyPayLimiter,
  async (req, res) => {

    if (
      !ALCHEMYPAY_APP_ID ||
      !ALCHEMYPAY_APP_SECRET
    ) {
      return res.status(503).json({
        error:
          'AlchemyPay is not configured on this server yet.',
      });
    }

    const merchantOrderNo =
      String(req.query?.orderNo || '').slice(0, 64);

    const side =
      req.query?.side === 'sell'
        ? 'SELL'
        : 'BUY';

    if (!merchantOrderNo) {
      return res.status(400).json({
        error:
          'Missing orderNo.',
      });
    }

    const timestamp =
      String(Date.now());

    const requestPath =
      '/open/api/v4/merchant/query/trade';

    const queryParams = {
      merchantOrderNo,
      side,
    };

    try {

      const sign = alchemyPaySign({
        timestamp,
        httpMethod: 'GET',
        requestPath,
        queryParams,
      });

      const search = new URLSearchParams(queryParams).toString();

      const orderRes = await fetch(
        `${ALCHEMYPAY_API_URL}${requestPath}?${search}`,
        {
          method: 'GET',
          headers: {
            accept: 'application/json',
            appid: ALCHEMYPAY_APP_ID,
            timestamp,
            sign,
          },
        }
      );

      const orderJson =
        await orderRes.json().catch(() => ({}));

      if (!orderRes.ok) {
        console.error(
          '[cryptobolt-server] AlchemyPay query-order failed:',
          orderRes.status,
          JSON.stringify(orderJson).slice(0, 300)
        );

        return res.status(502).json({
          error:
            'Could not look up the AlchemyPay order right now.',
        });
      }

      return res.json(orderJson?.data || orderJson);

    } catch (err) {

      console.error(
        '[cryptobolt-server] AlchemyPay order status error:',
        err?.message || err
      );

      return res.status(502).json({
        error:
          'Could not reach AlchemyPay right now. Please try again shortly.',
      });
    }
  }
);

// =========================================================
// ALCHEMYPAY WEBHOOK (optional server-verified hardening)
// =========================================================
// AlchemyPay POSTs order-status updates here if ALCHEMYPAY_CALLBACK_URL is set. This is a stub:
// it logs the notification so you can see it arrive. To make the purchase ledger tamper-proof,
// verify the payload signature (see https://alchemypay.readme.io/docs/webhook-signature) and
// write the row directly to Supabase here using the service_role key instead of trusting the
// browser — see the note at the bottom of supabase/schema.sql.

app.post(
  '/api/alchemypay-webhook',
  (req, res) => {
    console.log(
      '[cryptobolt-server] AlchemyPay webhook received:',
      JSON.stringify(req.body).slice(0, 500)
    );

    // Always 200 quickly — AlchemyPay retries on non-2xx responses.
    return res.json({ ok: true });
  }
);

// =========================================================
// CONTACT FORM
// =========================================================

const contactLimiter = rateLimit({
  windowMs:
    (Number(
      process.env.CONTACT_RATE_LIMIT_WINDOW_MINUTES
    ) || 15) *
    60 *
    1000,

  max:
    Number(
      process.env.CONTACT_RATE_LIMIT_MAX
    ) || 5,

  standardHeaders: true,

  legacyHeaders: false,

  message: {
    error:
      'Too many messages sent from this address. Please wait and try again.',
  },
});

app.post(
  '/api/contact',
  contactLimiter,
  async (req, res) => {

    const validationError =
      validateContact(req.body);

    if (validationError) {
      return res.status(400).json({
        error: validationError,
      });
    }

    const {
      name,
      email,
      topic,
      message,
    } = req.body;

    try {

      await sendContactEmail({
        name: name.trim(),
        email: email.trim(),
        topic,
        message: message.trim(),
      });

      return res.json({
        ok: true,
      });

    } catch (err) {

      if (
        err?.code ===
        'MAILER_NOT_CONFIGURED'
      ) {

        console.error(
          '[cryptobolt-server] Contact form used, but mailer is not configured.'
        );

        return res.status(503).json({
          error:
            "Contact form isn't set up on this deployment yet.",
        });
      }

      console.error(
        '[cryptobolt-server] Contact email send failed:',
        err?.message || err
      );

      return res.status(502).json({
        error:
          'Could not send your message right now.',
      });
    }
  }
);

// =========================================================
// AI PROMPTING
// =========================================================

function marketFramingBlock(ctx) {

  if (
    ctx.market ===
    'perpetual futures'
  ) {

    return `
This is a PERPETUAL FUTURES market.

Funding rate is a crowding signal:
- Positive funding means longs pay shorts.
- Negative funding means shorts pay longs.
- Extreme positioning can increase squeeze risk.

Because futures can involve leverage:
- Technical invalidation matters more urgently.
- Avoid pretending a long-term thesis eliminates short-term liquidation risk.
- Keep the analysis tactical and cautious.
`;
  }

  return `
This is a SPOT market.

Frame the analysis around:
- accumulation/distribution
- trend
- momentum
- support/resistance
- volatility
- volume

Do not discuss funding, liquidation, or leverage because those are not spot-market mechanics.
`;
}

const RESEARCH_SYSTEM_PROMPT = `
You are the research stage of CryptoBolt AI.

Your job is to carefully analyze supplied crypto market data.

Consider:

1. Multi-timeframe trend.
2. RSI and momentum.
3. MA(7) and MA(25).
4. Volatility and ATR.
5. Volume.
6. Support and resistance.
7. Funding if futures.
8. Recent news.
9. Fear & Greed.
10. What could invalidate bullish and bearish scenarios.

Be honest when indicators disagree.

Do not:
- guarantee future prices
- claim certainty
- recommend buying
- recommend selling
- invent news
- invent prices
- invent indicators

Keep the response under 260 words.
`;

const SYNTHESIS_SYSTEM_PROMPT_HEADER = `
You are the synthesis stage of CryptoBolt AI.

Use only the supplied market information and research notes.

Do not recommend buying, selling, or holding.

Do not give guaranteed future prices.

Use conditional language such as:
- may
- could
- if
- would need to

Never present a forecast as certainty.
`;

function synthesisSystemPrompt(ctx) {

  const isFutures =
    ctx.market ===
    'perpetual futures';

  const fundingField =
    isFutures
      ? `,"fundingContext":"1 sentence explaining funding and crowding risk, or null"`
      : '';

  return `
${SYNTHESIS_SYSTEM_PROMPT_HEADER}

${marketFramingBlock(ctx)}

Use recent news and Fear & Greed when supplied.

If no relevant news exists,
newsContext must be null.

Return ONLY valid JSON.

Use this exact structure:

{
  "trend": "bullish|bearish|neutral",
  "momentum": "strong|moderate|weak",
  "support": 0,
  "resistance": 0,
  "summary": "2-3 sentence technical read",
  "outlook": "conditional scenario",
  "confidence": "low|medium|high",
  "reasoningSteps": [
    "short factual point",
    "short factual point",
    "short factual point"
  ],
  "keyRisk": "single major invalidation risk",
  "newsContext": "news interpretation or null",
  "setupType": "breakout-continuation|pullback-entry|range-fade|no-setup",
  "stopATRMultiple": 1.0,
  "catalystWatch": "short catalyst or null"${fundingField}
}
`;
}

function buildUserPrompt(ctx) {

  const lines = [

    `Asset: ${ctx.asset}`,

    `Market: ${ctx.market}`,

    `Interval: ${ctx.interval}`,

    `Price: $${ctx.price}`,

    `24h change: ${ctx.change24hPct}%`,

    `24h high: $${ctx.high24h}`,

    `24h low: $${ctx.low24h}`,

    `24h volume: ${ctx.volume24hUSDT}`,

    `MA(7): ${ctx.ma7}`,

    `MA(25): ${ctx.ma25}`,

    `RSI(14): ${ctx.rsi14}`,

    `Recent swing high: $${ctx.recentSwingHigh}`,

    `Recent swing low: $${ctx.recentSwingLow}`,
  ];

  if (
    typeof ctx.atr14 === 'number'
  ) {

    lines.push(
      `ATR(14): ${ctx.atr14}` +
      (
        typeof ctx.atrPct === 'number'
          ? ` (${ctx.atrPct.toFixed(2)}% of price)`
          : ''
      )
    );
  }

  if (ctx.volumeTrend) {

    lines.push(
      `Volume trend: ${ctx.volumeTrend}`
    );
  }

  if (
    Array.isArray(ctx.mtf) &&
    ctx.mtf.length > 0
  ) {

    lines.push(
      `Higher timeframe trends: ${
        ctx.mtf
          .map(
            (m) =>
              `${m.tf}=${m.trend}(${m.pct >= 0 ? '+' : ''}${m.pct.toFixed(2)}%)`
          )
          .join(', ')
      }`
    );
  }

  if (
    ctx.market ===
      'perpetual futures' &&
    typeof ctx.fundingRatePct ===
      'number'
  ) {

    lines.push(
      `Funding rate: ${
        ctx.fundingRatePct >= 0
          ? '+'
          : ''
      }${ctx.fundingRatePct.toFixed(4)}%`
    );
  }

  lines.push(
    `Recent closes: ${JSON.stringify(
      ctx.recentClosesTrend
    )}`
  );

  if (
    Array.isArray(ctx.newsItems) &&
    ctx.newsItems.length > 0
  ) {

    lines.push('');

    lines.push(
      `Recent news for ${ctx.asset}:`
    );

    ctx.newsItems.forEach(
      (news, index) => {

        lines.push(
          `${index + 1}. "${news.title}" — ${news.source}, ${news.hoursAgo}h ago`
        );
      }
    );

  } else {

    lines.push('');

    lines.push(
      `Recent news: none found for ${ctx.asset} in the last 72 hours.`
    );
  }

  if (ctx.fearGreed) {

    lines.push(
      `Fear & Greed: ${ctx.fearGreed.value}/100 (${ctx.fearGreed.classification})`
    );
  }

  return lines.join('\n');
}

// =========================================================
// SAFETY LANGUAGE
// =========================================================

const OVERCONFIDENT_REPLACEMENTS = [

  [/\bwill\b/gi, 'may'],

  [/\bguaranteed\b/gi, 'possible'],

  [/\bdefinitely\b/gi, 'likely'],

  [/\bcertainly\b/gi, 'likely'],

  [/\bcertain to\b/gi, 'likely to'],

  [/\bis going to\b/gi, 'could'],
];

function softenOverconfidentLanguage(text) {

  if (
    typeof text !== 'string'
  ) {
    return text;
  }

  return OVERCONFIDENT_REPLACEMENTS
    .reduce(
      (result, [pattern, replacement]) =>
        result.replace(
          pattern,
          replacement
        ),
      text
    );
}

function softenList(list) {

  if (!Array.isArray(list)) {
    return list;
  }

  return list.map(
    (item) =>
      softenOverconfidentLanguage(
        item
      )
  );
}

// =========================================================
// AI CHAT
// =========================================================

const CHAT_SYSTEM_PROMPT = `
You are CryptoBolt AI.

You are a conversational crypto market research assistant.

Your purpose is to help users UNDERSTAND cryptocurrency markets.

You can explain:

- price action
- RSI
- moving averages
- support
- resistance
- volume
- volatility
- market structure
- funding
- sentiment
- Fear & Greed
- news catalysts
- why a coin may be moving
- bullish scenarios
- bearish scenarios
- technical-analysis concepts

Preserve the useful analytical behavior of CryptoBolt's older AI Insight system.

Consider multiple signals together.

Mention conflicting signals.

Separate facts from interpretations.

Use recent news and Fear & Greed when available.

RULES:

1. Never guarantee future prices.

2. Never claim certainty about future price direction.

3. Do not tell users that they must buy, sell, or hold.

4. Do not provide personalized financial advice.

5. Do not invent prices.

6. Do not invent news.

7. Do not invent indicators.

8. If information is unavailable, say so.

9. Explain technical terms when the user asks educational questions.

10. Treat news headlines as reported information, not independently verified facts.

11. Crypto markets are volatile and AI can be wrong.

12. If discussing a potential setup, describe it as a hypothetical scenario.

Keep normal answers around 120-280 words unless the user asks for more detail.
`;

// =========================================================
// AI CHAT ENDPOINT
// =========================================================

app.post(
  '/api/ai-chat',
  aiLimiter,
  async (req, res) => {

    const apiKey =
      req.get('x-groq-key');

    if (
      !apiKey ||
      !apiKey.startsWith('gsk_')
    ) {

      return res.status(401).json({
        error:
          'Missing or invalid Groq API key. Add your key in the AI page first.',
      });
    }

    // Support both the current frontend contract ({ message, context }) and an
    // older/alternate one ({ question, market }) so this endpoint keeps working
    // even if an older cached/deployed copy of ai-chat.js is still live somewhere.
    const message =
      String(
        req.body?.message || req.body?.question || ''
      ).trim();

    if (!message) {

      return res.status(400).json({
        error:
          'Ask a question first.',
      });
    }

    if (message.length > 1800) {

      return res.status(400).json({
        error:
          'Please keep your question under 1,800 characters.',
      });
    }

    const rawContext =
      (req.body?.context &&
        typeof req.body.context === 'object' &&
        req.body.context) ||
      (req.body?.market &&
        typeof req.body.market === 'object' &&
        req.body.market) ||
      {};

    const context = rawContext;

    const selectedAsset =
      String(
        context?.selectedAsset ||
        context?.asset ||
        'BTC'
      )
        .toUpperCase()
        .replace(
          /[^A-Z0-9]/g,
          ''
        )
        .slice(0, 15) || 'BTC';

    // Create a new Groq client for this request.
    // The user's API key is not saved.
    const groq =
      new Groq({
        apiKey,
      });

    // Fetch current news and sentiment.
    const [
      newsItems,
      fearGreed,
    ] = await Promise.all([

      fetchCryptoNews(
        selectedAsset
      ).catch(() => []),

      fetchFearGreedIndex()
        .catch(() => null),
    ]);

    const contextText =
      JSON.stringify({

        pageSnapshot:
          context,

        liveServerFearGreed:
          fearGreed,

        recentNews:
          newsItems,

        note:
          'This is market research context, not personalized portfolio or account state.',
      });

    try {

      const completion =
        await groq.chat.completions.create({

          model:
            GROQ_MODEL,

          max_tokens:
            900,

          reasoning_effort:
            'low',

          messages: [

            {
              role:
                'system',

              content:
                CHAT_SYSTEM_PROMPT,
            },

            {
              role:
                'user',

              content:
                `LIVE MARKET CONTEXT:\n${contextText}\n\nUSER QUESTION:\n${message}`,
            },

          ],
        });

      let answer =
        (
          completion
            .choices?.[0]
            ?.message
            ?.content || ''
        ).trim();

      if (!answer) {

        return res.status(502).json({
          error:
            'AI model returned an empty response. Please try again.',
        });
      }

      answer =
        softenOverconfidentLanguage(
          answer
        );

      return res.json({

        answer,

        sources:
          newsItems.map(
            (news) => ({
              title:
                news.title,

              source:
                news.source,

              hoursAgo:
                news.hoursAgo,
            })
          ),

        fearGreed:
          fearGreed || null,
      });

    } catch (err) {

      const status =
        err?.status;

      if (status === 401) {

        return res.status(401).json({
          error:
            'Invalid API key. Check the key you entered and try again.',
        });
      }

      if (status === 429) {

        return res.status(429).json({
          error:
            'Rate limited by Groq. Please wait a moment and try again.',
        });
      }

      if (
        status === 404 ||
        (err?.message || '')
          .toLowerCase()
          .includes('model')
      ) {

        return res.status(502).json({
          error:
            `Model "${GROQ_MODEL}" is unavailable. Update GROQ_MODEL on the server.`,
        });
      }

      console.error(
        '[cryptobolt-server] Groq chat error:',
        err?.message || err
      );

      return res.status(502).json({
        error:
          'AI chat request failed.',
      });
    }
  }
);

// =========================================================
// ORIGINAL AI INSIGHT ENDPOINT
// =========================================================

app.post(
  '/api/ai-insight',
  aiLimiter,
  async (req, res) => {

    const apiKey =
      req.get('x-groq-key');

    if (
      !apiKey ||
      !apiKey.startsWith('gsk_')
    ) {

      return res.status(401).json({
        error:
          'Missing or invalid Groq API key. Add your key in the app first.',
      });
    }

    const ctx =
      req.body?.context;

    const validationError =
      validateContext(ctx);

    if (validationError) {

      return res.status(400).json({
        error:
          validationError,
      });
    }

    const groq =
      new Groq({
        apiKey,
      });

    // Live news + sentiment.
    const [
      newsItems,
      fearGreed,
    ] = await Promise.all([

      fetchCryptoNews(
        ctx.asset
      ).catch(() => []),

      fetchFearGreedIndex()
        .catch(() => null),
    ]);

    const enrichedCtx = {
      ...ctx,
      newsItems,
      fearGreed,
    };

    const userPrompt =
      buildUserPrompt(
        enrichedCtx
      );

    try {

      // =====================================================
      // PASS 1 — RESEARCH
      // =====================================================

      const researchCompletion =
        await groq.chat.completions.create({

          model:
            GROQ_MODEL,

          max_tokens:
            700,

          reasoning_effort:
            'low',

          messages: [

            {
              role:
                'system',

              content:
                RESEARCH_SYSTEM_PROMPT,
            },

            {
              role:
                'user',

              content:
                userPrompt,
            },

          ],
        });

      const researchNotes =
        (
          researchCompletion
            .choices?.[0]
            ?.message
            ?.content || ''
        ).trim();

      // =====================================================
      // PASS 2 — SYNTHESIS
      // =====================================================

      const synthesisMessages = [

        {
          role:
            'system',

          content:
            synthesisSystemPrompt(
              enrichedCtx
            ),
        },

        {
          role:
            'user',

          content:
            `${userPrompt}

Research notes from pass 1:
${researchNotes || '(No research notes were returned. Reason from the supplied data only.)'}`,
        },

      ];

      let rawText =
        '';

      let lastErr =
        null;

      for (
        let attempt = 0;
        attempt < 2 &&
        !rawText;
        attempt++
      ) {

        try {

          const synthesisCompletion =
            await groq.chat.completions.create({

              model:
                GROQ_MODEL,

              max_tokens:
                1200,

              reasoning_effort:
                'low',

              response_format:
                {
                  type:
                    'json_object',
                },

              messages:
                synthesisMessages,
            });

          rawText =
            (
              synthesisCompletion
                .choices?.[0]
                ?.message
                ?.content || ''
            ).trim();

        } catch (error) {

          lastErr =
            error;
        }
      }

      if (!rawText) {

        if (lastErr) {
          throw lastErr;
        }

        return res.status(502).json({
          error:
            'AI model returned an empty response. Please try again.',
        });
      }

      const cleaned =
        rawText
          .replace(
            /^```json\s*/i,
            ''
          )
          .replace(
            /```$/,
            ''
          )
          .trim();

      let parsed;

      try {

        parsed =
          JSON.parse(
            cleaned
          );

      } catch {

        return res.status(502).json({
          error:
            'AI service returned an unexpected response format.',
        });
      }

      // =====================================================
      // SAFETY LANGUAGE CLEANUP
      // =====================================================

      if (parsed.summary) {

        parsed.summary =
          softenOverconfidentLanguage(
            parsed.summary
          );
      }

      if (parsed.outlook) {

        parsed.outlook =
          softenOverconfidentLanguage(
            parsed.outlook
          );
      }

      parsed.reasoningSteps =
        softenList(
          parsed.reasoningSteps
        );

      if (parsed.keyRisk) {

        parsed.keyRisk =
          softenOverconfidentLanguage(
            parsed.keyRisk
          );
      }

      if (parsed.fundingContext) {

        parsed.fundingContext =
          softenOverconfidentLanguage(
            parsed.fundingContext
          );
      }

      if (parsed.newsContext) {

        parsed.newsContext =
          softenOverconfidentLanguage(
            parsed.newsContext
          );
      }

      if (parsed.catalystWatch) {

        parsed.catalystWatch =
          softenOverconfidentLanguage(
            parsed.catalystWatch
          );
      }

      if (
        typeof parsed.stopATRMultiple ===
        'number'
      ) {

        parsed.stopATRMultiple =
          Math.min(
            3,
            Math.max(
              1,
              parsed.stopATRMultiple
            )
          );
      }

      return res.json({

        result:
          parsed,

        research:
          researchNotes || null,

        sources:
          newsItems.map(
            (news) => ({
              title:
                news.title,

              source:
                news.source,

              hoursAgo:
                news.hoursAgo,
            })
          ),

        fearGreed:
          fearGreed || null,
      });

    } catch (err) {

      const status =
        err?.status;

      if (status === 401) {

        return res.status(401).json({
          error:
            'Invalid API key. Check the key you entered and try again.',
        });
      }

      if (status === 429) {

        return res.status(429).json({
          error:
            'Rate limited by Groq. Please wait a moment and try again.',
        });
      }

      if (
        status === 404 ||
        (err?.message || '')
          .toLowerCase()
          .includes('model')
      ) {

        return res.status(502).json({
          error:
            `Model "${GROQ_MODEL}" is unavailable. Set GROQ_MODEL in the server environment to a supported model.`,
        });
      }

      console.error(
        '[cryptobolt-server] Groq request error:',
        err?.message || err
      );

      return res.status(502).json({
        error:
          'AI service request failed.',
      });
    }
  }
);

// =========================================================
// ERROR HANDLER
// =========================================================

app.use(
  (
    err,
    _req,
    res,
    _next
  ) => {

    if (
      err?.message ===
      'Not allowed by CORS'
    ) {

      return res.status(403).json({
        error:
          'Origin not allowed.',
      });
    }

    console.error(
      '[cryptobolt-server] Unhandled error:',
      err
    );

    return res.status(500).json({
      error:
        'Internal server error.',
    });
  }
);

// =========================================================
// START SERVER
// =========================================================

if (
  process.env.NODE_ENV !==
  'test'
) {

  app.listen(
    PORT,
    () => {

      console.log(
        `[cryptobolt-server] listening on port ${PORT} (bring-your-own-key mode, model: ${GROQ_MODEL})`
      );
    }
  );
}

export {
  app,
};