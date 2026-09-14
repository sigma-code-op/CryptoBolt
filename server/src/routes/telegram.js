// ---------------------------------------------------------------------------
// GET /api/telegram/configured — lets account.html (js/18-account.js) hide the
// "Link Telegram" card on deployments that haven't set TELEGRAM_BOT_TOKEN, same pattern as
// GET /api/push/vapid-public-key returning 503 when push isn't configured (routes/push.js).
//
// The actual chat-id save is NOT a server route — it's a direct Supabase insert from the
// browser into notification_settings using the visitor's own session (RLS restricts that to
// their own row, see supabase/schema.sql), same as the username field on this page. This
// endpoint exists purely so the UI doesn't invite someone to link a channel that will never
// actually deliver anything.
// ---------------------------------------------------------------------------

import { Router } from 'express';
import { TELEGRAM_CONFIGURED } from '../lib/telegram.js';

const router = Router();

router.get('/api/telegram/configured', (req, res) => {
  res.json({ configured: TELEGRAM_CONFIGURED });
});

export default router;