// ---------------------------------------------------------------------------
// AlchemyPay widget-url, order-status, and webhook routes. Extracted verbatim
// from server.js (only app.* -> router.* and the addition of imports/rate
// limiter export differ).
// ---------------------------------------------------------------------------

import { Router } from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import {
  ALCHEMYPAY_APP_ID,
  ALCHEMYPAY_APP_SECRET,
  ALCHEMYPAY_RAMP_URL,
  ALCHEMYPAY_API_URL,
  ALCHEMYPAY_REDIRECT_BASE,
  ALCHEMYPAY_CALLBACK_URL,
  ALCHEMYPAY_DEFAULT_NETWORK,
} from '../config.js';
import { alchemyPaySign } from '../lib/alchemypay-sign.js';

const router = Router();

// =========================================================
// ALCHEMYPAY RATE LIMIT
// =========================================================

const alchemyPayLimiter = rateLimit({
  windowMs:
    (Number(
      process.env.ALCHEMYPAY_RATE_LIMIT_WINDOW_MINUTES
    ) || 15) *
    60 *
    1000,

  max:
    Number(
      process.env.ALCHEMYPAY_RATE_LIMIT_MAX
    ) || 60,

  standardHeaders: true,

  legacyHeaders: false,

  message: {
    error:
      'Too many widget requests from this address. Please wait and try again.',
  },
});

// =========================================================
// ALCHEMYPAY WIDGET URL
// =========================================================
// Unlike Transak, AlchemyPay's page-integration widget needs no server-minted session/token —
// the backend just signs a query string with the merchant's appSecret and the frontend drops
// the result straight into an iframe src. We still keep this server-side so the appSecret is
// never exposed to the browser, and so we can attach a per-order merchantOrderNo we control.

router.post(
  '/api/alchemypay-widget-url',
  alchemyPayLimiter,
  (req, res) => {

    if (
      !ALCHEMYPAY_APP_ID ||
      !ALCHEMYPAY_APP_SECRET
    ) {
      return res.status(503).json({
        error:
          'AlchemyPay is not configured on this server yet.',
      });
    }

    const mode =
      req.body?.mode === 'SELL'
        ? 'SELL'
        : 'BUY';

    const side =
      mode === 'SELL'
        ? 'sell'
        : 'buy';

    const symbol =
      String(
        req.body?.symbol || 'BTC'
      )
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 15) || 'BTC';

    const network =
      String(
        req.body?.network ||
        ALCHEMYPAY_DEFAULT_NETWORK[symbol] ||
        ''
      )
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 20);

    // Ours to generate and track — carried through in the webhook + Query Order lookups, and
    // echoed back on redirectUrl so the frontend knows which order to poll after the widget
    // hands control back to us.
    const merchantOrderNo =
      `cb${Date.now()}${crypto.randomBytes(4).toString('hex')}`;

    const timestamp =
      String(Date.now());

    const requestPath =
      side === 'buy'
        ? '/index/rampPageBuy'
        : '/index/rampPageSell';

    const queryParams = {
      appId: ALCHEMYPAY_APP_ID,
      crypto: symbol,
      showTable: side,
      merchantOrderNo,
      redirectUrl: `${ALCHEMYPAY_REDIRECT_BASE.replace(/\/$/, '')}/ramp-return.html?orderNo=${encodeURIComponent(merchantOrderNo)}&side=${side}`,
      timestamp,
    };

    if (network) queryParams.network = network;
    if (ALCHEMYPAY_CALLBACK_URL) queryParams.callbackUrl = ALCHEMYPAY_CALLBACK_URL;

    const partnerCustomerEmail =
      req.body?.email;

    if (
      typeof partnerCustomerEmail === 'string' &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(partnerCustomerEmail)
    ) {
      queryParams.email = partnerCustomerEmail;
    }

    try {

      const sign = alchemyPaySign({
        timestamp,
        httpMethod: 'GET',
        requestPath,
        queryParams,
      });

      const search = new URLSearchParams({
        ...queryParams,
        sign,
      }).toString();

      const widgetUrl = `${ALCHEMYPAY_RAMP_URL}?${search}`;

      return res.json({
        widgetUrl,
        merchantOrderNo,
        side,
      });

    } catch (err) {

      console.error(
        '[cryptobolt-server] AlchemyPay widget URL error:',
        err?.message || err
      );

      return res.status(502).json({
        error:
          'Could not start the AlchemyPay widget session. Please try again shortly.',
      });
    }
  }
);

// =========================================================
// ALCHEMYPAY ORDER STATUS
// =========================================================
// Called by the frontend once the widget redirects back to /ramp-return.html, so the actual
// completed crypto/fiat amounts (not just "the user finished the flow") come from AlchemyPay's
// own Query Order API rather than being trusted from the client. See
// https://alchemypay.readme.io/docs/query-order-2

router.get(
  '/api/alchemypay-order-status',
  alchemyPayLimiter,
  async (req, res) => {

    if (
      !ALCHEMYPAY_APP_ID ||
      !ALCHEMYPAY_APP_SECRET
    ) {
      return res.status(503).json({
        error:
          'AlchemyPay is not configured on this server yet.',
      });
    }

    const merchantOrderNo =
      String(req.query?.orderNo || '').slice(0, 64);

    const side =
      req.query?.side === 'sell'
        ? 'SELL'
        : 'BUY';

    if (!merchantOrderNo) {
      return res.status(400).json({
        error:
          'Missing orderNo.',
      });
    }

    const timestamp =
      String(Date.now());

    const requestPath =
      '/open/api/v4/merchant/query/trade';

    const queryParams = {
      merchantOrderNo,
      side,
    };

    try {

      const sign = alchemyPaySign({
        timestamp,
        httpMethod: 'GET',
        requestPath,
        queryParams,
      });

      const search = new URLSearchParams(queryParams).toString();

      const orderRes = await fetch(
        `${ALCHEMYPAY_API_URL}${requestPath}?${search}`,
        {
          method: 'GET',
          headers: {
            accept: 'application/json',
            appid: ALCHEMYPAY_APP_ID,
            timestamp,
            sign,
          },
        }
      );

      const orderJson =
        await orderRes.json().catch(() => ({}));

      if (!orderRes.ok) {
        console.error(
          '[cryptobolt-server] AlchemyPay query-order failed:',
          orderRes.status,
          JSON.stringify(orderJson).slice(0, 300)
        );

        return res.status(502).json({
          error:
            'Could not look up the AlchemyPay order right now.',
        });
      }

      return res.json(orderJson?.data || orderJson);

    } catch (err) {

      console.error(
        '[cryptobolt-server] AlchemyPay order status error:',
        err?.message || err
      );

      return res.status(502).json({
        error:
          'Could not reach AlchemyPay right now. Please try again shortly.',
      });
    }
  }
);

// =========================================================
// ALCHEMYPAY WEBHOOK (optional server-verified hardening)
// =========================================================
// AlchemyPay POSTs order-status updates here if ALCHEMYPAY_CALLBACK_URL is set. This is a stub:
// it logs the notification so you can see it arrive. To make the purchase ledger tamper-proof,
// verify the payload signature (see https://alchemypay.readme.io/docs/webhook-signature) and
// write the row directly to Supabase here using the service_role key instead of trusting the
// browser — see the note at the bottom of supabase/schema.sql.

router.post(
  '/api/alchemypay-webhook',
  (req, res) => {
    console.log(
      '[cryptobolt-server] AlchemyPay webhook received:',
      JSON.stringify(req.body).slice(0, 500)
    );

    // Always 200 quickly — AlchemyPay retries on non-2xx responses.
    return res.json({ ok: true });
  }
);

export default router;