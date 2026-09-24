import test from 'node:test';
import assert from 'node:assert/strict';
import {
  alertHit,
  symbolForAssetId,
  ALERT_CHECKER_CONFIGURED,
  startAlertChecker,
  stopAlertChecker,
} from '../src/lib/alert-checker.js';

// ---------------------------------------------------------------------------
// alertHit — this is the actual "did the alert fire" decision, mirrored from the
// client-side check in js/07-alerts.js. Getting a boundary wrong here means a visitor's
// price alert either fires early/never or fires a duplicate — worth pinning down exactly.
// ---------------------------------------------------------------------------

test('alertHit "above": fires at or above the target, not below it', () => {
  const alert = { direction: 'above', target: 65000 };
  assert.equal(alertHit(alert, 64999.99), null);
  assert.equal(alertHit(alert, 65000), 'rose above $65000');
  assert.equal(alertHit(alert, 70000), 'rose above $65000'); // message reports the target, not the live price
});

test('alertHit "below": fires at or below the target, not above it', () => {
  const alert = { direction: 'below', target: 60000 };
  assert.equal(alertHit(alert, 60000.01), null);
  assert.equal(alertHit(alert, 60000), 'fell below $60000');
  assert.equal(alertHit(alert, 50000), 'fell below $60000');
});

test('alertHit "pct_up": fires once the live price is target% above basePrice', () => {
  const alert = { direction: 'pct_up', target: 10, basePrice: 100 };
  assert.equal(alertHit(alert, 109.99), null);
  assert.equal(alertHit(alert, 110), 'rose 10% (now $110)');
  assert.equal(alertHit(alert, 120), 'rose 10% (now $120)');
});

test('alertHit "pct_down": fires once the live price is target% below basePrice', () => {
  const alert = { direction: 'pct_down', target: 15, basePrice: 200 };
  const threshold = 200 * (1 - 15 / 100); // 170
  assert.equal(alertHit(alert, threshold + 0.01), null);
  assert.equal(alertHit(alert, threshold), `fell 15% (now $${threshold})`);
});

test('alertHit returns null for an unrecognized direction instead of throwing', () => {
  assert.equal(alertHit({ direction: 'sideways', target: 1 }, 100), null);
});

// ---------- symbolForAssetId ----------

test('symbolForAssetId strips the trailing _S (spot) or _F (futures) suffix', () => {
  assert.equal(symbolForAssetId('BTCUSDT_S'), 'BTCUSDT');
  assert.equal(symbolForAssetId('BTCUSDT_F'), 'BTCUSDT');
});

test('symbolForAssetId leaves an id with no recognized suffix untouched', () => {
  assert.equal(symbolForAssetId('BTCUSDT'), 'BTCUSDT');
});

// ---------------------------------------------------------------------------
// Configured/no-op behavior. No SUPABASE_URL/PUSH_VAPID_*/TELEGRAM_BOT_TOKEN are set in the
// test environment, so ALERT_CHECKER_CONFIGURED is false here — same "off by default, no
// crash" contract as isMailerConfigured() elsewhere in this project.
// ---------------------------------------------------------------------------

test('ALERT_CHECKER_CONFIGURED is false with no Supabase/push/Telegram env vars set', () => {
  assert.equal(ALERT_CHECKER_CONFIGURED, false);
});

test('startAlertChecker() / stopAlertChecker() no-op cleanly when not configured', () => {
  assert.doesNotThrow(() => {
    startAlertChecker();
    stopAlertChecker();
  });
});