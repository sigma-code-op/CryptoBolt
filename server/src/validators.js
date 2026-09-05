// ---------- Shared request validators ----------
// Pulled into their own module (instead of living inline in server.js) so they can be
// unit-tested directly with no server/network involved — see /server/test/validators.test.js.

/**
 * Validate the shape of the market-context payload sent by the frontend for /api/ai-insight.
 * We only accept plain numbers/strings/arrays of numbers — never a raw prompt —
 * so the server, not the browser, controls exactly what gets sent to the model.
 * Returns an error message string, or null if the payload is valid.
 */
function validateContext(ctx) {
  if (!ctx || typeof ctx !== 'object') return 'Missing market context.';
  const requiredStrings = ['asset', 'market', 'interval'];
  for (const key of requiredStrings) {
    if (typeof ctx[key] !== 'string' || ctx[key].length > 40) return `Invalid field: ${key}`;
  }
  const requiredNumbers = ['price', 'change24hPct', 'high24h', 'low24h', 'volume24hUSDT', 'recentSwingHigh', 'recentSwingLow'];
  for (const key of requiredNumbers) {
    if (typeof ctx[key] !== 'number' || !Number.isFinite(ctx[key])) return `Invalid field: ${key}`;
  }
  if (ctx.ma7 !== null && typeof ctx.ma7 !== 'number') return 'Invalid field: ma7';
  if (ctx.ma25 !== null && typeof ctx.ma25 !== 'number') return 'Invalid field: ma25';
  if (ctx.rsi14 !== null && typeof ctx.rsi14 !== 'number') return 'Invalid field: rsi14';
  if (!Array.isArray(ctx.recentClosesTrend) || ctx.recentClosesTrend.length > 60 || !ctx.recentClosesTrend.every((n) => typeof n === 'number')) {
    return 'Invalid field: recentClosesTrend';
  }
  // ---- Optional, deeper-context fields (all nullable — older frontend builds simply omit them) ----
  if (ctx.atr14 !== undefined && ctx.atr14 !== null && typeof ctx.atr14 !== 'number') return 'Invalid field: atr14';
  if (ctx.atrPct !== undefined && ctx.atrPct !== null && typeof ctx.atrPct !== 'number') return 'Invalid field: atrPct';
  if (ctx.volumeTrend !== undefined && ctx.volumeTrend !== null) {
    if (typeof ctx.volumeTrend !== 'string' || !['rising', 'falling', 'flat'].includes(ctx.volumeTrend)) return 'Invalid field: volumeTrend';
  }
  // Funding rate only makes sense for perpetual futures, but we accept-and-ignore rather than
  // hard-reject if a spot context happens to include null values for these.
  if (ctx.fundingRatePct !== undefined && ctx.fundingRatePct !== null && typeof ctx.fundingRatePct !== 'number') return 'Invalid field: fundingRatePct';
  if (ctx.fundingNextMins !== undefined && ctx.fundingNextMins !== null && typeof ctx.fundingNextMins !== 'number') return 'Invalid field: fundingNextMins';
  if (ctx.mtf !== undefined && ctx.mtf !== null) {
    if (!Array.isArray(ctx.mtf) || ctx.mtf.length > 5) return 'Invalid field: mtf';
    for (const row of ctx.mtf) {
      if (!row || typeof row.tf !== 'string' || row.tf.length > 6) return 'Invalid field: mtf[].tf';
      if (typeof row.trend !== 'string' || row.trend.length > 12) return 'Invalid field: mtf[].trend';
      if (typeof row.pct !== 'number' || !Number.isFinite(row.pct)) return 'Invalid field: mtf[].pct';
    }
  }
  return null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate the contact-form payload sent to /api/contact.
 * Returns an error message string, or null if the payload is valid.
 */
function validateContact(body) {
  if (!body || typeof body !== 'object') return 'Missing form data.';

  const { name, email, topic, message, company } = body;

  // Honeypot: a real visitor never sees or fills this field (hidden via CSS). Bots that
  // auto-fill every input on a page will populate it, so any non-empty value is a strong
  // spam signal — reject silently-ish with a generic error rather than revealing the trap.
  if (typeof company === 'string' && company.trim().length > 0) return 'Submission rejected.';

  if (typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 100) {
    return 'Please enter your name (up to 100 characters).';
  }
  if (typeof email !== 'string' || email.trim().length > 200 || !EMAIL_RE.test(email.trim())) {
    return 'Please enter a valid email address.';
  }
  const allowedTopics = ['Bug report', 'Feature request', 'AI Insight / Groq key question', 'Privacy question', 'Something else'];
  if (typeof topic !== 'string' || !allowedTopics.includes(topic)) {
    return 'Please choose a valid topic.';
  }
  if (typeof message !== 'string' || message.trim().length < 5 || message.trim().length > 4000) {
    return 'Message must be between 5 and 4000 characters.';
  }
  return null;
}

const ASSET_RE = /^[A-Z0-9]{1,15}$/;

/**
 * Validate the payload sent by the frontend to log one AI-generated trade setup for the
 * public track record (POST /api/ai-calls). Every numeric field is exactly what
 * js/10-ai-insight.js's computeTradePlan() already computed from real support/resistance +
 * ATR — this just double-checks shape/sanity server-side before it's written, the same way
 * validateContext() does for /api/ai-insight.
 * Returns an error message string, or null if the payload is valid.
 */
function validateAiCallLog(body) {
  if (!body || typeof body !== 'object') return 'Missing call data.';

  if (typeof body.asset !== 'string' || !ASSET_RE.test(body.asset.toUpperCase())) {
    return 'Invalid field: asset';
  }
  if (body.market !== 'spot' && body.market !== 'perpetual futures') {
    return 'Invalid field: market';
  }
  if (typeof body.interval !== 'string' || body.interval.length > 10) {
    return 'Invalid field: interval';
  }
  if (body.bias !== 'long-leaning' && body.bias !== 'short-leaning') {
    return 'Invalid field: bias';
  }
  const allowedSetupTypes = ['breakout-continuation', 'pullback-entry', 'range-fade'];
  if (!allowedSetupTypes.includes(body.setupType)) {
    return 'Invalid field: setupType';
  }

  const requiredNumbers = ['entryLow', 'entryHigh', 'stopPrice', 'target1', 'target2', 'priceAtCall'];
  for (const key of requiredNumbers) {
    if (typeof body[key] !== 'number' || !Number.isFinite(body[key]) || body[key] <= 0) {
      return `Invalid field: ${key}`;
    }
  }
  if (body.atr14 !== undefined && body.atr14 !== null && (typeof body.atr14 !== 'number' || !Number.isFinite(body.atr14))) {
    return 'Invalid field: atr14';
  }
  if (body.stopMult !== undefined && body.stopMult !== null && (typeof body.stopMult !== 'number' || !Number.isFinite(body.stopMult))) {
    return 'Invalid field: stopMult';
  }
  return null;
}

export { validateContext, validateContact, validateAiCallLog };