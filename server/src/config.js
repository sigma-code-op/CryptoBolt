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

// AlchemyPay integration removed — Buy/Sell now redirects to Binance client-side
// (see js/14-alchemypay.js). No server-side config needed for it anymore.