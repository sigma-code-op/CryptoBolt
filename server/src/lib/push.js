// ---------------------------------------------------------------------------
// Web Push (VAPID) — lets the server wake a price alert on a visitor's device
// even though no CryptoBolt tab is open. See lib/alert-checker.js for what
// decides *when* to push, and routes/push.js for how a browser's
// PushSubscription ends up stored in Supabase in the first place.
//
// Generate a VAPID key pair once per deployment with:
//   npx web-push generate-vapid-keys
// and put the result in PUSH_VAPID_PUBLIC_KEY / PUSH_VAPID_PRIVATE_KEY (see
// server/.env.example). The public key is safe to expose to the browser
// (GET /api/push/vapid-public-key serves it); the private key must stay
// server-side only.
// ---------------------------------------------------------------------------

import webpush from 'web-push';

const VAPID_PUBLIC_KEY = process.env.PUSH_VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.PUSH_VAPID_PRIVATE_KEY || '';
// mailto: contact required by the Web Push protocol so push services (Chrome/Firefox's
// servers) have a way to reach the sender if a deployment's pushes misbehave — it is never
// shown to the visitor. Falls back to the same address the contact form delivers to.
const VAPID_SUBJECT =
  process.env.PUSH_VAPID_SUBJECT ||
  (process.env.CONTACT_TO_EMAIL ? `mailto:${process.env.CONTACT_TO_EMAIL}` : '');

export const PUSH_CONFIGURED = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && VAPID_SUBJECT);

if (PUSH_CONFIGURED) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export function getVapidPublicKey() {
  return VAPID_PUBLIC_KEY || null;
}

/**
 * Send one push notification to one stored subscription.
 * Returns { ok: true } on success, or { ok: false, expired: true } when the push service
 * confirms the subscription is gone (410 Gone / 404 Not Found — the visitor uninstalled,
 * cleared site data, or the browser dropped it) so the caller can delete that row instead of
 * retrying it forever. Any other failure is { ok: false, expired: false } (transient — worth
 * trying again next cycle).
 */
export async function sendPush(subscription, payload) {
  if (!PUSH_CONFIGURED) {
    return { ok: false, expired: false };
  }
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload)
    );
    return { ok: true };
  } catch (err) {
    const status = err?.statusCode;
    if (status === 404 || status === 410) {
      return { ok: false, expired: true };
    }
    console.error('[cryptobolt-server] Push send failed:', status || err?.message || err);
    return { ok: false, expired: false };
  }
}