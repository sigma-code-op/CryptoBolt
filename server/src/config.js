// ---------------------------------------------------------------------------
// CryptoBolt server: shared configuration, derived from environment variables.
// Extracted from server.js so every route module reads the same values.
// ---------------------------------------------------------------------------

export const PORT = process.env.PORT || 8787;

export const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

// =========================================================
// GROQ
// =========================================================

export const GROQ_MODEL =
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
// using the merchant's appSecret. The appSecret NEVER leaves the server — see
// https://alchemypay.readme.io/docs/api-sign and https://alchemypay.readme.io/docs/on-ramp-custom-parameters

export const ALCHEMYPAY_APP_ID =
  process.env.ALCHEMYPAY_APP_ID || '';

export const ALCHEMYPAY_APP_SECRET =
  process.env.ALCHEMYPAY_APP_SECRET || '';

export const ALCHEMYPAY_ENVIRONMENT =
  (process.env.ALCHEMYPAY_ENVIRONMENT || 'STAGING').toUpperCase();

// Ramp widget (page integration) host — this is what the iframe src points at.
export const ALCHEMYPAY_RAMP_URL =
  ALCHEMYPAY_ENVIRONMENT === 'PRODUCTION'
    ? 'https://ramp.alchemypay.org'
    : 'https://ramptest.alchemypay.org';

// Open API host — used for server-to-server calls like Query Order.
export const ALCHEMYPAY_API_URL =
  ALCHEMYPAY_ENVIRONMENT === 'PRODUCTION'
    ? 'https://openapi.alchemypay.org'
    : 'https://openapi-test.alchemypay.org';

export const ALCHEMYPAY_REDIRECT_BASE =
  process.env.ALCHEMYPAY_REDIRECT_BASE || 'https://cryptobolt.io';

export const ALCHEMYPAY_CALLBACK_URL =
  process.env.ALCHEMYPAY_CALLBACK_URL || '';

// Sensible default network per popular ticker, so a person doesn't have to pick a chain just
// to buy/sell BTC. Coins not in this list are still supported — we just omit 'network' and let
// AlchemyPay's own widget ask the visitor to choose one.
export const ALCHEMYPAY_DEFAULT_NETWORK = {
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