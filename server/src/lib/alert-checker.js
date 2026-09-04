// ---------------------------------------------------------------------------
// Closed-tab price alerts.
//
// js/07-alerts.js's checkPriceAlerts() only runs while a CryptoBolt tab is
// open and in the foreground of a live-updating ticker socket — close the
// tab and an alert you set specifically so you *didn't* have to keep
// watching the screen just silently never fires. This module is the
// server-side twin: on a timer (wired up in server.js), it re-runs the same
// hit logic against every signed-in visitor's stored alerts, using their
// existing cloud-synced data (js/19-cloud-sync.js already mirrors
// localStorage's cw_alerts into Supabase's app_state table — nothing new to
// sync), and delivers a Web Push notification instead of an in-tab toast.
//
// Deliberately reuses infrastructure that already exists in this project
// rather than adding a new database or a separate scheduler process:
//   - app_state (supabase/schema.sql)   — already has every signed-in
//     visitor's alerts, written by js/19-cloud-sync.js.
//   - push_subscriptions (schema.sql)   — new table, but same shape as the
//     rest of this project's Supabase usage.
//   - server/db.js's admin-client style — lib/supabase-admin.js.
//   - mailer.js                          — reused for the email fallback.
// ---------------------------------------------------------------------------

import { getSupabaseAdmin, SUPABASE_ADMIN_CONFIGURED } from './supabase-admin.js';
import { sendPush, PUSH_CONFIGURED } from './push.js';
import { sendAlertEmail, isMailerConfigured } from '../mailer.js';

export const ALERT_CHECKER_CONFIGURED = SUPABASE_ADMIN_CONFIGURED && PUSH_CONFIGURED;

async function fetchAllBinancePrices() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch('https://api.binance.com/api/v3/ticker/price', {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return null;
    const rows = await res.json();
    if (!Array.isArray(rows)) return null;
    const map = new Map();
    for (const row of rows) {
      if (row?.symbol && row?.price) map.set(row.symbol, Number(row.price));
    }
    return map;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Mirrors checkPriceAlerts()'s hit test in js/07-alerts.js exactly, so an alert fires under
// the same rule server-side as it would have client-side.
function alertHit(alert, livePrice) {
  switch (alert.direction) {
    case 'above':
      return livePrice >= alert.target ? `rose above $${alert.target}` : null;
    case 'below':
      return livePrice <= alert.target ? `fell below $${alert.target}` : null;
    case 'pct_up': {
      const threshold = alert.basePrice * (1 + alert.target / 100);
      return livePrice >= threshold ? `rose ${alert.target}% (now $${livePrice})` : null;
    }
    case 'pct_down': {
      const threshold = alert.basePrice * (1 - alert.target / 100);
      return livePrice <= threshold ? `fell ${alert.target}% (now $${livePrice})` : null;
    }
    default:
      return null;
  }
}

function symbolForAssetId(assetId) {
  // Asset ids are built client-side as `${BINANCE_SYMBOL}_S` (spot) or `_F` (futures) — see
  // js/02-api.js / js/04-ticker-sockets.js. Spot and futures share the same Binance symbol
  // and therefore the same price for alert purposes.
  return assetId.replace(/_S$|_F$/, '');
}

/**
 * Runs one full check cycle. Exported (rather than only wired into a bare setInterval) so it
 * can be called directly from a test or a one-off `node -e` invocation.
 */
export async function runAlertCheckCycle() {
  if (!ALERT_CHECKER_CONFIGURED) return;
  const supabase = getSupabaseAdmin();

  const { data: subs, error: subsErr } = await supabase
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth');
  if (subsErr) {
    console.error('[cryptobolt-server] alert-checker: could not read push_subscriptions:', subsErr.message);
    return;
  }
  if (!subs || subs.length === 0) return; // nobody has enabled push alerts — nothing to do

  const userIds = [...new Set(subs.map((s) => s.user_id))];
  const { data: stateRows, error: stateErr } = await supabase
    .from('app_state')
    .select('user_id, state')
    .in('user_id', userIds);
  if (stateErr) {
    console.error('[cryptobolt-server] alert-checker: could not read app_state:', stateErr.message);
    return;
  }

  // Work out which Binance symbols we actually need before fetching anything.
  const perUserAlerts = new Map(); // user_id -> { assetId: [alert, ...] }
  const neededSymbols = new Set();
  for (const row of stateRows || []) {
    const raw = row.state?.cw_alerts;
    if (!raw) continue;
    let parsed;
    try {
      parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
      continue; // malformed local data on that visitor's end — skip, don't crash the cycle
    }
    if (!parsed || typeof parsed !== 'object') continue;
    const untriggered = {};
    for (const [assetId, list] of Object.entries(parsed)) {
      if (!Array.isArray(list)) continue;
      const pending = list.filter((a) => a && !a.triggered);
      if (pending.length > 0) {
        untriggered[assetId] = pending;
        neededSymbols.add(symbolForAssetId(assetId));
      }
    }
    if (Object.keys(untriggered).length > 0) perUserAlerts.set(row.user_id, untriggered);
  }
  if (perUserAlerts.size === 0) return; // everyone with push enabled has zero pending alerts

  const prices = await fetchAllBinancePrices();
  if (!prices) return; // Binance unreachable this cycle — try again next tick, don't guess

  const subsByUser = new Map();
  for (const s of subs) {
    if (!subsByUser.has(s.user_id)) subsByUser.set(s.user_id, []);
    subsByUser.get(s.user_id).push(s);
  }

  const expiredSubIds = [];

  for (const [userId, alertsByAsset] of perUserAlerts) {
    const triggeredMessages = [];
    const remaining = {};

    for (const [assetId, list] of Object.entries(alertsByAsset)) {
      const symbol = symbolForAssetId(assetId);
      const livePrice = prices.get(symbol);
      const stillPending = [];
      for (const alert of list) {
        const hitDesc = livePrice !== undefined ? alertHit(alert, livePrice) : null;
        if (hitDesc) {
          triggeredMessages.push(`${symbol.replace(/USDT$/, '')} ${hitDesc}`);
        } else {
          stillPending.push(alert);
        }
      }
      if (stillPending.length > 0) remaining[assetId] = stillPending;
    }

    if (triggeredMessages.length === 0) continue;

    // Write the trimmed alert list back so this alert doesn't fire again next cycle, and so
    // the next time this visitor opens a tab, js/19-cloud-sync.js pulls the same
    // already-triggered state instead of re-adding what the server just fired.
    const { data: currentRow } = await supabase
      .from('app_state')
      .select('state')
      .eq('user_id', userId)
      .single();
    const nextState = { ...(currentRow?.state || {}), cw_alerts: JSON.stringify(remaining) };
    await supabase.from('app_state').update({ state: nextState }).eq('user_id', userId);

    const body =
      triggeredMessages.length === 1
        ? triggeredMessages[0]
        : `${triggeredMessages.length} alerts triggered: ${triggeredMessages.slice(0, 3).join(', ')}${triggeredMessages.length > 3 ? '…' : ''}`;
    const payload = { title: 'CryptoBolt Alert', body, url: '/' };

    let pushedOk = false;
    for (const sub of subsByUser.get(userId) || []) {
      const result = await sendPush(sub, payload);
      if (result.ok) pushedOk = true;
      else if (result.expired) expiredSubIds.push(sub.id);
    }

    // Email fallback: only when push didn't actually reach the device this cycle (no
    // subscriptions left, or every send failed) — not a duplicate channel on top of a push
    // that already worked.
    if (!pushedOk && isMailerConfigured()) {
      const { data: userRecord } = await supabase.auth.admin.getUserById(userId);
      const email = userRecord?.user?.email;
      if (email) {
        try {
          await sendAlertEmail({ to: email, messages: triggeredMessages });
        } catch (err) {
          console.error('[cryptobolt-server] alert-checker: fallback email failed:', err?.message || err);
        }
      }
    }
  }

  if (expiredSubIds.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', expiredSubIds);
  }
}

let intervalHandle = null;

/**
 * Starts the recurring check. No-op (with a one-time log explaining why) if Supabase or
 * VAPID env vars aren't set — same "silently stay off" pattern as HOUSE_KEY_ENABLED and
 * isMailerConfigured(), so a deployment that doesn't want this feature needs zero extra
 * config to leave it disabled.
 */
export function startAlertChecker() {
  if (intervalHandle) return;
  if (!ALERT_CHECKER_CONFIGURED) {
    console.info(
      '[cryptobolt-server] Closed-tab push alerts are OFF — set SUPABASE_URL, SUPABASE_API_KEY, ' +
        'PUSH_VAPID_PUBLIC_KEY, and PUSH_VAPID_PRIVATE_KEY to enable (see server/.env.example).'
    );
    return;
  }
  const seconds = Number(process.env.ALERT_CHECK_INTERVAL_SECONDS) || 45;
  intervalHandle = setInterval(() => {
    runAlertCheckCycle().catch((err) => {
      console.error('[cryptobolt-server] alert-checker cycle failed:', err?.message || err);
    });
  }, seconds * 1000);
  console.log(`[cryptobolt-server] Closed-tab push alerts ON — checking every ${seconds}s.`);
}

export function stopAlertChecker() {
  if (intervalHandle) clearInterval(intervalHandle);
  intervalHandle = null;
}