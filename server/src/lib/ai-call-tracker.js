// ---------------------------------------------------------------------------
// AI call track record routes.
//   POST /api/ai-calls              — log one AI-generated trade setup
//   GET  /api/ai-calls/track-record — public win-rate / avg-R readout
// See lib/ai-call-tracker.js for the logging/resolving/aggregation logic.
// ---------------------------------------------------------------------------

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { validateAiCallLog } from '../validators.js';
import { logAiCall, getTrackRecordStats, AI_CALL_TRACKER_CONFIGURED } from '../lib/ai-call-tracker.js';

const router = Router();

// Generous but not unbounded: one log call happens per AI insight a visitor generates, and
// generating an insight already sits behind the (much stricter) AI rate limiters in
// routes/ai.js — this just stops something hammering the endpoint directly.
const logLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please wait and try again.' },
});

router.post('/api/ai-calls', logLimiter, async (req, res) => {
  const validationError = validateAiCallLog(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  if (!AI_CALL_TRACKER_CONFIGURED) {
    // Not an error — this deployment simply hasn't set up Supabase. The frontend fires this
    // request fire-and-forget and doesn't need to do anything differently either way.
    return res.status(202).json({ ok: false, reason: 'not_configured' });
  }

  const result = await logAiCall(req.body);
  return res.status(result.ok ? 201 : 502).json(result);
});

router.get('/api/ai-calls/track-record', async (_req, res) => {
  const stats = await getTrackRecordStats();
  return res.json(stats);
});

export default router;