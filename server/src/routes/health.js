// ---------------------------------------------------------------------------
// GET /api/health — extracted verbatim from server.js.
// ---------------------------------------------------------------------------

import { Router } from 'express';
import { GROQ_MODEL, HOUSE_KEY_ENABLED } from '../config.js';
import { isMailerConfigured } from '../mailer.js';
import { ALERT_CHECKER_CONFIGURED } from '../lib/alert-checker.js';

const router = Router();

router.get('/api/health', (_req, res) => {

  res.json({
    ok: true,

    service:
      'cryptobolt-server',

    model:
      GROQ_MODEL,

    mailerConfigured:
      isMailerConfigured(),

    houseKeyEnabled:
      HOUSE_KEY_ENABLED,

    pushAlertsConfigured:
      ALERT_CHECKER_CONFIGURED,

    time:
      new Date().toISOString(),
  });
});

export default router;