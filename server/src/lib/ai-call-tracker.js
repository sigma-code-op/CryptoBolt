// ---------------------------------------------------------------------------
// AI call track record.
//
// The AI Market Insight panel (js/10-ai-insight.js) doesn't just describe a
// trend — for a real setup it computes an actual entry zone, stop, and two
// targets from live support/resistance + ATR(14) (see that file's
// computeTradePlan()). Once shown, that call used to just vanish. This
// module gives it a memory:
//
//   1. logAiCall()            — POST /api/ai-calls (routes/ai-calls.js) calls
//                                this the moment a real (non-local-calc, non
//                                "no-setup") plan is rendered, writing one row
//                                to public.ai_calls (supabase/schema.sql).
//   2. runAiCallResolveCycle() — on a timer (startAiCallResolver(), wired up
//                                in server.js next to startAlertChecker()),
//                                re-checks every still-open call against live
//                                Binance prices — the SAME fetchAllBinancePrices()
//                                helper the push-alert checker uses — and marks
//                                it hit_target1 / hit_target2 / hit_stop, or
//                                expired if nothing happened in time.
//   3. getTrackRecordStats()   — aggregates resolved calls into a public
//                                win-rate + average-R readout, bucketed by
//                                setup type so a range-fade's naturally
//                                higher hit rate can't quietly inflate a
//                                breakout call's real record.
//
// Deliberately reuses infrastructure that already exists in this project
// (same pattern as alert-checker.js's own comment): the service-role
// Supabase client from supabase-admin.js, and market-data.js's
// fetchAllBinancePrices() — no new database, no new scheduler process.
// ---------------------------------------------------------------------------

import { getSupabaseAdmin, SUPABASE_ADMIN_CONFIGURED } from './supabase-admin.js';
import { fetchAllBinancePrices } from './market-data.js';

export const AI_CALL_TRACKER_CONFIGURED = SUPABASE_ADMIN_CONFIGURED;

// How long an unresolved call is allowed to sit open before it's marked "expired" rather
// than resolved either way. Matches the AI panel's own "last 72h" news window — a technical
// setup that hasn't played out in that time isn't a clean read on the call anymore.
const EXPIRY_HOURS = Number(process.env.AI_CALL_EXPIRY_HOURS) || 72;

/**
 * Writes one logged AI trade setup. `payload` is the already-validated body from
 * POST /api/ai-calls (see validators.js's validateAiCallLog). Best-effort: if Supabase
 * isn't configured on this deployment, this quietly no-ops — logging the track record is a
 * bonus feature, never a reason to fail the AI insight request itself.
 */
export async function logAiCall(payload) {
  if (!AI_CALL_TRACKER_CONFIGURED) return { ok: false, reason: 'not_configured' };

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('ai_calls').insert({
    asset: String(payload.asset).toUpperCase(),
    market: payload.market,
    interval: payload.interval,
    bias: payload.bias,
    setup_type: payload.setupType,
    entry_low: payload.entryLow,
    entry_high: payload.entryHigh,
    stop_price: payload.stopPrice,
    target1: payload.target1,
    target2: payload.target2,
    price_at_call: payload.priceAtCall,
    atr14: typeof payload.atr14 === 'number' ? payload.atr14 : null,
    stop_mult: typeof payload.stopMult === 'number' ? payload.stopMult : null,
  });

  if (error) {
    console.error('[cryptobolt-server] ai-call-tracker: insert failed:', error.message);
    return { ok: false, reason: 'insert_failed' };
  }
  return { ok: true };
}

// Binance's all-symbols ticker is spot pricing only. Like alert-checker.js's
// symbolForAssetId(), this treats a futures call's underlying price as close enough to its
// spot counterpart for resolution purposes — real basis drift is small next to the width of
// these setups' stops/targets.
function symbolFor(asset) {
  return `${String(asset).toUpperCase()}USDT`;
}

// Farther target checked before the nearer one, since both this project's bullish and
// bearish setups always place target2 strictly farther from entry than target1 (see
// js/10-ai-insight.js's computeTradePlan()) — a price that already reached target2 has, by
// construction, also passed target1.
function resolveOutcome(call, livePrice) {
  if (call.bias === 'long-leaning') {
    if (livePrice <= call.stop_price) return 'hit_stop';
    if (livePrice >= call.target2) return 'hit_target2';
    if (livePrice >= call.target1) return 'hit_target1';
  } else {
    if (livePrice >= call.stop_price) return 'hit_stop';
    if (livePrice <= call.target2) return 'hit_target2';
    if (livePrice <= call.target1) return 'hit_target1';
  }
  return null;
}

/**
 * Runs one resolve cycle: expires stale open calls, then checks the rest against live
 * prices. Exported (like alert-checker.js's runAlertCheckCycle) so it can be invoked
 * directly from a test or a one-off run, not only from the interval.
 */
export async function runAiCallResolveCycle() {
  if (!AI_CALL_TRACKER_CONFIGURED) return;
  const supabase = getSupabaseAdmin();

  const { data: openCalls, error: openErr } = await supabase
    .from('ai_calls')
    .select('id, asset, bias, stop_price, target1, target2, created_at')
    .eq('status', 'open')
    .limit(500);

  if (openErr) {
    console.error('[cryptobolt-server] ai-call-tracker: could not read open calls:', openErr.message);
    return;
  }
  if (!openCalls || openCalls.length === 0) return;

  const now = Date.now();
  const expiryMs = EXPIRY_HOURS * 60 * 60 * 1000;

  const stillOpen = [];
  const expiredIds = [];
  for (const call of openCalls) {
    if (now - new Date(call.created_at).getTime() >= expiryMs) {
      expiredIds.push(call.id);
    } else {
      stillOpen.push(call);
    }
  }

  if (expiredIds.length > 0) {
    await supabase
      .from('ai_calls')
      .update({ status: 'expired', resolved_at: new Date().toISOString() })
      .in('id', expiredIds);
  }

  if (stillOpen.length === 0) return;

  const prices = await fetchAllBinancePrices();
  if (!prices) return; // Binance unreachable this cycle — try again next tick, don't guess

  const nowIso = new Date().toISOString();
  for (const call of stillOpen) {
    const livePrice = prices.get(symbolFor(call.asset));
    if (livePrice === undefined) continue;

    const outcome = resolveOutcome(call, livePrice);
    if (!outcome) continue;

    const { error: updateErr } = await supabase
      .from('ai_calls')
      .update({ status: outcome, resolved_at: nowIso, resolved_price: livePrice })
      .eq('id', call.id);

    if (updateErr) {
      console.error('[cryptobolt-server] ai-call-tracker: could not resolve call', call.id, updateErr.message);
    }
  }
}

const EMPTY_BUCKET = () => ({ wins: 0, losses: 0, expired: 0, total: 0 });

/**
 * Aggregates the most recent resolved calls into a public track record. Wins/losses are
 * counted against each other for winRate; expired calls are reported separately since they
 * were never actually confirmed right or wrong. avgR is the average realized reward:risk —
 * -1R for every stop-out, and (actual move / planned risk) for every target hit — over
 * decided (non-expired) calls only.
 */
export async function getTrackRecordStats() {
  if (!AI_CALL_TRACKER_CONFIGURED) return { configured: false };

  const supabase = getSupabaseAdmin();
  const { data: rows, error } = await supabase
    .from('ai_calls')
    .select('setup_type, entry_low, entry_high, stop_price, target1, target2, status, resolved_price')
    .neq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    console.error('[cryptobolt-server] ai-call-tracker: could not read track record:', error.message);
    return { configured: true, error: 'Could not load track record right now.' };
  }

  const overall = EMPTY_BUCKET();
  const bySetupType = {};
  let rSum = 0;
  let rCount = 0;

  for (const row of rows || []) {
    const bucket = bySetupType[row.setup_type] || (bySetupType[row.setup_type] = EMPTY_BUCKET());
    overall.total++;
    bucket.total++;

    if (row.status === 'expired') {
      overall.expired++;
      bucket.expired++;
      continue;
    }

    const entryMid = (row.entry_low + row.entry_high) / 2;
    const risk = Math.abs(entryMid - row.stop_price);

    if (row.status === 'hit_stop') {
      overall.losses++;
      bucket.losses++;
      rSum += -1;
      rCount++;
    } else {
      // hit_target1 or hit_target2
      overall.wins++;
      bucket.wins++;
      if (risk > 0 && typeof row.resolved_price === 'number') {
        rSum += Math.abs(row.resolved_price - entryMid) / risk;
        rCount++;
      }
    }
  }

  const winRate = (b) => (b.wins + b.losses > 0 ? b.wins / (b.wins + b.losses) : null);

  return {
    configured: true,
    overall: { ...overall, winRate: winRate(overall) },
    avgR: rCount > 0 ? rSum / rCount : null,
    decidedCalls: rCount,
    bySetupType: Object.fromEntries(
      Object.entries(bySetupType).map(([type, b]) => [type, { ...b, winRate: winRate(b) }])
    ),
  };
}

let intervalHandle = null;

/**
 * Starts the recurring resolve cycle. Independent of startAlertChecker()/push config — this
 * only needs Supabase, not Web Push — so a deployment can have the track record on without
 * ever setting up push alerts. Same "silently stay off with a log line" pattern as the rest
 * of this project's optional features.
 */
export function startAiCallResolver() {
  if (intervalHandle) return;
  if (!AI_CALL_TRACKER_CONFIGURED) {
    console.info(
      '[cryptobolt-server] AI call track record is OFF — set SUPABASE_URL and SUPABASE_API_KEY ' +
        'to enable (see server/.env.example).'
    );
    return;
  }
  const seconds = Number(process.env.AI_CALL_CHECK_INTERVAL_SECONDS) || 60;
  intervalHandle = setInterval(() => {
    runAiCallResolveCycle().catch((err) => {
      console.error('[cryptobolt-server] ai-call-tracker cycle failed:', err?.message || err);
    });
  }, seconds * 1000);
  console.log(`[cryptobolt-server] AI call track record ON — resolving every ${seconds}s.`);
}

export function stopAiCallResolver() {
  if (intervalHandle) clearInterval(intervalHandle);
  intervalHandle = null;
}