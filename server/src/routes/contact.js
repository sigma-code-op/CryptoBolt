// ---------------------------------------------------------------------------
// POST /api/contact — extracted verbatim from server.js.
// ---------------------------------------------------------------------------

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { validateContact } from '../validators.js';
import { sendContactEmail } from '../mailer.js';

const router = Router();

// =========================================================
// CONTACT FORM
// =========================================================

const contactLimiter = rateLimit({
  windowMs:
    (Number(
      process.env.CONTACT_RATE_LIMIT_WINDOW_MINUTES
    ) || 15) *
    60 *
    1000,

  max:
    Number(
      process.env.CONTACT_RATE_LIMIT_MAX
    ) || 5,

  standardHeaders: true,

  legacyHeaders: false,

  message: {
    error:
      'Too many messages sent from this address. Please wait and try again.',
  },
});

router.post(
  '/api/contact',
  contactLimiter,
  async (req, res) => {

    const validationError =
      validateContact(req.body);

    if (validationError) {
      return res.status(400).json({
        error: validationError,
      });
    }

    const {
      name,
      email,
      topic,
      message,
    } = req.body;

    try {

      await sendContactEmail({
        name: name.trim(),
        email: email.trim(),
        topic,
        message: message.trim(),
      });

      return res.json({
        ok: true,
      });

    } catch (err) {

      if (
        err?.code ===
        'MAILER_NOT_CONFIGURED'
      ) {

        console.error(
          '[cryptobolt-server] Contact form used, but mailer is not configured.'
        );

        return res.status(503).json({
          error:
            "Contact form isn't set up on this deployment yet.",
        });
      }

      console.error(
        '[cryptobolt-server] Contact email send failed:',
        err?.message || err
      );

      return res.status(502).json({
        error:
          'Could not send your message right now.',
      });
    }
  }
);

export default router;