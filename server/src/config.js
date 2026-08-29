// ---------------------------------------------------------------------------
// CryptoBolt server: shared configuration, derived from environment variables.
// Extracted from server.js so every route module reads the same values.
// ---------------------------------------------------------------------------

export const PORT = process.env.PORT || 8787;

export const IS_PRODUCTION = process.env.NODE_ENV === 'production';

export const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

// Fail CLOSED in production: an empty ALLOWED_ORIGINS with NODE_ENV=production almost always
// means someone forgot to set the env var on deploy, not "allow every origin". Outside of
// production (local dev, CI, `npm test`) an empty list still means "allow anything", which is
// what makes `npm run dev` and the test suite work with no configuration at all.
if (IS_PRODUCTION && ALLOWED_ORIGINS.length === 0) {
  console.error(
    '[cryptobolt-server] ALLOWED_ORIGINS is empty in production. Refusing to start with an ' +
      'open CORS policy — set ALLOWED_ORIGINS to a comma-separated list of allowed origins ' +
      '(e.g. https://cryptobolt.io) and restart.'
  );
  process.exit(1);
}

// =========================================================
// GROQ
// =========================================================

export const GROQ_MODEL =
  process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

// CryptoBolt uses BYOK.
// The server does NOT permanently store a user's Groq key.
// The frontend sends the key with each AI request.

// AlchemyPay integration removed — Buy/Sell now redirects to Binance client-side
// (see js/14-alchemypay.js). No server-side config needed for it anymore.