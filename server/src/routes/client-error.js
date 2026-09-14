// ---------------------------------------------------------------------------
// POST /api/client-error — receives uncaught frontend errors from js/error-reporter.js
// (window.onerror / unhandledrejection) and writes them through the same structured logger
// as server-side errors (lib/logger.js), so a real visitor hitting a broken AI call, a WS
// disconnect, or a cloud-sync failure shows up in your logs instead of silently vanishing —
// see lib/logger.js's header comment for why this is plain structured logging rather than a
// third-party error-tracking SaaS.
//
// Deliberately accepts NO identifying information beyond what's needed to debug a JS error:
// message, stack, source URL, and user agent. No cookies, no auth token, no localStorage
// contents — the browser can't be trusted not to have a bug in the very error-handling code
// that's reporting the error, so this endpoint treats the payload as untrusted input, not as
// a log line to store verbatim.
// ---------------------------------------------------------------------------

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { logError } from '../lib/logger.js';

const router = Router();

// Generous but bounded — a real bug can throw repeatedly (e.g. every ticker tick), and this
// endpoint's whole job is to surface that, not to be the next thing rate-limited into
// silence. Per-IP rather than global so one visitor's error loop can't drown out others'.
const clientErrorLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many error reports.' },
});

function truncate(value, maxLen) {
  if (typeof value !== 'string') return '';
  return value.length > maxLen ? `${value.slice(0, maxLen)}…` : value;
}

router.post('/api/client-error', clientErrorLimiter, (req, res) => {
  const body = req.body || {};

  logError('Client-reported error', truncate(body.message, 500) || 'Unknown client error', {
    requestId: req.requestId,
    source: 'browser',
    url: truncate(body.url, 500),
    stack: truncate(body.stack, 4000),
    userAgent: truncate(req.get('user-agent') || '', 300),
  });

  res.status(204).end();
});

export default router;