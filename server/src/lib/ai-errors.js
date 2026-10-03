// ---------------------------------------------------------------------------
// AI failure handling shared by every Groq-backed route (routes/ai.js).
//
// Two jobs:
//  1. Turn whatever the Groq SDK / network threw into a small, stable, machine-readable
//     shape — { status, code, error, retryable, retryAfterSeconds? } — so the browser can
//     show a specific message and offer the right action (retry, add a key, switch keys)
//     instead of one generic "request failed".
//  2. Make sure a visitor's API key can never end up in a log line. Keys are BYOK and are
//     used for exactly one request; they must not be persisted anywhere, logs included.
//
// The user-facing `error` strings here are fixed text. Upstream error messages are never
// forwarded to the browser: provider errors sometimes echo a (masked) key or request
// details, and none of that is useful to a visitor anyway.
// ---------------------------------------------------------------------------

// Groq keys look like gsk_<alphanumerics>. Also strip bearer tokens and any value passed in
// an x-groq-key style header that happens to be stringified into an error message.
const SECRET_PATTERNS = [
  /gsk_[A-Za-z0-9_-]{6,}/g,
  /(bearer\s+)[A-Za-z0-9._~+/=-]{8,}/gi,
  /(x-groq-key["']?\s*[:=]\s*["']?)[^\s"',}]+/gi,
  /(api[_-]?key["']?\s*[:=]\s*["']?)[A-Za-z0-9._~+/=-]{8,}/gi,
];

export function redactSecrets(value) {
  if (value === null || value === undefined) return value;
  let text = typeof value === 'string' ? value : String(value);
  text = text.replace(SECRET_PATTERNS[0], '[redacted-key]');
  text = text.replace(SECRET_PATTERNS[1], '$1[redacted]');
  text = text.replace(SECRET_PATTERNS[2], '$1[redacted]');
  text = text.replace(SECRET_PATTERNS[3], '$1[redacted]');
  return text;
}

// Deep-redacts the strings in a log-meta object (one level of nesting is plenty for our
// meta: requestId, path, stack, etc.). Non-string values pass through untouched.
export function redactMeta(meta) {
  if (!meta || typeof meta !== 'object') return meta;
  const out = Array.isArray(meta) ? [] : {};
  for (const [k, v] of Object.entries(meta)) {
    if (typeof v === 'string') out[k] = redactSecrets(v);
    else if (v && typeof v === 'object') out[k] = redactMeta(v);
    else out[k] = v;
  }
  return out;
}

// Stable codes the frontend switches on. Keep in sync with js/ai-chat.js (AI_FAILURES).
export const AI_ERROR_CODES = Object.freeze({
  MISSING_KEY: 'missing_key',
  INVALID_KEY: 'invalid_key',
  HOUSE_KEY_DISABLED: 'house_key_disabled',
  RATE_LIMITED: 'rate_limited',
  HOUSE_RATE_LIMITED: 'house_rate_limited',
  MODEL_UNAVAILABLE: 'model_unavailable',
  UPSTREAM_UNAVAILABLE: 'upstream_unavailable',
  MALFORMED_RESPONSE: 'malformed_response',
  EMPTY_RESPONSE: 'empty_response',
  BAD_REQUEST: 'bad_request',
  INTERNAL: 'ai_failed',
});

function retryAfterFromErr(err) {
  const headers = err?.headers;
  let raw = null;
  if (headers && typeof headers.get === 'function') raw = headers.get('retry-after');
  else if (headers && typeof headers === 'object') raw = headers['retry-after'] ?? headers['Retry-After'];
  const secs = Number(raw);
  if (Number.isFinite(secs) && secs > 0) return Math.min(Math.ceil(secs), 3600);
  return null;
}

/**
 * Maps a thrown Groq SDK / network error to the response we send the browser.
 * `label` is only used to pick wording (e.g. 'chat' vs 'insight'); `model` is the
 * configured GROQ_MODEL, named in the "model unavailable" message because that one is
 * actionable for the deployment owner.
 */
export function classifyAiError(err, { model = '' } = {}) {
  const status = Number(err?.status) || 0;
  const message = String(err?.message || '').toLowerCase();
  const errName = String(err?.name || '');

  if (status === 401 || status === 403) {
    return {
      status: 401,
      code: AI_ERROR_CODES.INVALID_KEY,
      retryable: false,
      error: 'Invalid API key. Check the key you entered and try again.',
    };
  }

  if (status === 429) {
    const retryAfterSeconds = retryAfterFromErr(err);
    return {
      status: 429,
      code: AI_ERROR_CODES.RATE_LIMITED,
      retryable: true,
      ...(retryAfterSeconds ? { retryAfterSeconds } : {}),
      error: 'Rate limited by Groq. Please wait a moment and try again.',
    };
  }

  if (status === 404 || (status === 400 && message.includes('model'))) {
    return {
      status: 502,
      code: AI_ERROR_CODES.MODEL_UNAVAILABLE,
      retryable: false,
      error: `Model "${model}" is unavailable. Set GROQ_MODEL in the server environment to a supported model.`,
    };
  }

  const isTimeout =
    status === 408 ||
    errName === 'APIConnectionTimeoutError' ||
    errName === 'AbortError' ||
    message.includes('timed out') ||
    message.includes('timeout');
  const isConnection =
    errName === 'APIConnectionError' ||
    ['econnreset', 'econnrefused', 'enotfound', 'etimedout', 'fetch failed', 'socket hang up'].some((s) =>
      message.includes(s)
    );

  if (isTimeout || isConnection || status >= 500) {
    return {
      status: 503,
      code: AI_ERROR_CODES.UPSTREAM_UNAVAILABLE,
      retryable: true,
      error: isTimeout
        ? 'The AI service took too long to respond. Please try again.'
        : 'The AI service is temporarily unavailable. Please try again in a moment.',
    };
  }

  // Older behavior treated any message mentioning "model" as a model problem.
  if (message.includes('model')) {
    return {
      status: 502,
      code: AI_ERROR_CODES.MODEL_UNAVAILABLE,
      retryable: false,
      error: `Model "${model}" is unavailable. Set GROQ_MODEL in the server environment to a supported model.`,
    };
  }

  return {
    status: 502,
    code: AI_ERROR_CODES.INTERNAL,
    retryable: true,
    error: 'The AI request failed. Please try again.',
  };
}

/** Body to send for a classified error (drops `status`, which goes on the response line). */
export function aiErrorBody(classified) {
  const { status: _status, ...body } = classified;
  return body;
}