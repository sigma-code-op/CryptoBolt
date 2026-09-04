// ---------------------------------------------------------------------------
// Push subscription endpoints for closed-tab price alerts (js/23-push-alerts.js,
// lib/alert-checker.js, supabase/schema.sql's push_subscriptions table).
//
// These go through the server rather than letting the browser write to
// push_subscriptions directly with the anon key, because writing a row
// requires knowing WHICH visitor it belongs to — that means verifying the
// visitor's Supabase access token server-side first. (The alternative —
// trusting a user_id the browser sends in the request body — would let
// anyone register a push endpoint against someone else's account.)
// ---------------------------------------------------------------------------

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getSupabaseAdmin, SUPABASE_ADMIN_CONFIGURED } from '../lib/supabase-admin.js';
import { getVapidPublicKey, PUSH_CONFIGURED } from '../lib/push.js';

const router = Router();

const pushLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many push subscription requests. Please wait and try again.' },
});

async function requireUser(req, res) {
  if (!SUPABASE_ADMIN_CONFIGURED) {
    res.status(503).json({ error: "Push alerts aren't set up on this deployment yet." });
    return null;
  }
  const authHeader = req.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) {
    res.status(401).json({ error: 'Missing Authorization header.' });
    return null;
  }
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    res.status(401).json({ error: 'Invalid or expired session — please sign in again.' });
    return null;
  }
  return data.user;
}

function isValidSubscription(sub) {
  return (
    sub &&
    typeof sub.endpoint === 'string' &&
    sub.endpoint.length > 0 &&
    sub.endpoint.length < 2000 &&
    sub.keys &&
    typeof sub.keys.p256dh === 'string' &&
    typeof sub.keys.auth === 'string'
  );
}

// =========================================================
// GET /api/push/vapid-public-key
// =========================================================
router.get('/api/push/vapid-public-key', (_req, res) => {
  if (!PUSH_CONFIGURED) {
    return res.status(503).json({ error: "Push alerts aren't set up on this deployment yet." });
  }
  res.json({ publicKey: getVapidPublicKey() });
});

// =========================================================
// POST /api/push/subscribe
// body: { subscription: PushSubscriptionJSON }
// =========================================================
router.post('/api/push/subscribe', pushLimiter, async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const { subscription } = req.body || {};
  if (!isValidSubscription(subscription)) {
    return res.status(400).json({ error: 'Invalid push subscription payload.' });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: user.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
    { onConflict: 'endpoint' }
  );

  if (error) {
    console.error('[cryptobolt-server] push subscribe failed:', error.message);
    return res.status(500).json({ error: 'Could not save push subscription.' });
  }
  return res.json({ ok: true });
});

// =========================================================
// POST /api/push/unsubscribe
// body: { endpoint: string }
// =========================================================
router.post('/api/push/unsubscribe', pushLimiter, async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const { endpoint } = req.body || {};
  if (typeof endpoint !== 'string' || !endpoint) {
    return res.status(400).json({ error: 'Missing endpoint.' });
  }

  const supabase = getSupabaseAdmin();
  // Scoped to this user's own id as well as the endpoint, so one visitor can't unsubscribe
  // another visitor's device even if they somehow guessed its endpoint URL.
  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint).eq('user_id', user.id);

  if (error) {
    console.error('[cryptobolt-server] push unsubscribe failed:', error.message);
    return res.status(500).json({ error: 'Could not remove push subscription.' });
  }
  return res.json({ ok: true });
});

export default router;