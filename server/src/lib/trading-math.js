// Pure trading calculators shared by the MCP endpoint (routes/mcp.js).
// Same formulas as the public calculators in js/liquidation-calculator.js and
// js/trading-calculators.js and the WebMCP tools in js/webmcp.js.

const r = (n, d = 2) => {
  const k = 10 ** d;
  return Math.round(n * k) / k;
};
const num = (v) => (typeof v === 'string' ? parseFloat(v) : v);

export class InputError extends Error {}

export function liquidationPrice({ side, entry_price, leverage, maintenance_margin_pct }) {
  const entry = num(entry_price);
  const lev = num(leverage);
  const mmr = (maintenance_margin_pct == null ? 0.5 : num(maintenance_margin_pct)) / 100;
  if (!(entry > 0) || !(lev >= 1) || !(mmr >= 0) || (side !== 'long' && side !== 'short')) {
    throw new InputError('Provide side (long/short), entry_price > 0 and leverage >= 1.');
  }
  const cushion = 1 / lev - mmr;
  let liq;
  if (cushion <= 0) liq = side === 'long' ? entry * 1.001 : entry * 0.999;
  else liq = side === 'long' ? entry * (1 - cushion) : entry * (1 + cushion);
  return {
    liquidation_price: r(liq),
    distance_from_entry_pct: r((Math.abs(liq - entry) / entry) * 100),
    model: 'simplified isolated margin',
  };
}

export function positionSize({ side, balance, risk_pct, entry_price, stop_price, leverage }) {
  const bal = num(balance);
  const risk = num(risk_pct);
  const entry = num(entry_price);
  const stop = num(stop_price);
  let lev = num(leverage);
  if (!(lev >= 1)) lev = 1;
  const dist = Math.abs(entry - stop);
  if (!(bal > 0) || !(risk > 0) || !(entry > 0) || !(stop > 0) || !(dist > 0)) {
    throw new InputError('Provide balance, risk_pct, entry_price and a stop_price different from entry.');
  }
  const long = side === 'long';
  if (side !== 'long' && side !== 'short') throw new InputError('side must be long or short.');
  if ((long && stop > entry) || (!long && stop < entry)) {
    throw new InputError(long ? 'For a long, stop must be below entry.' : 'For a short, stop must be above entry.');
  }
  const riskUsd = (bal * risk) / 100;
  const qty = riskUsd / dist;
  const notional = qty * entry;
  const dir = long ? 1 : -1;
  return {
    risk_usd: r(riskUsd),
    quantity: r(qty, 6),
    notional_usd: r(notional),
    margin_usd: r(notional / lev),
    stop_distance_pct: r((dist / entry) * 100),
    targets: { '1R': r(entry + dir * dist), '2R': r(entry + dir * dist * 2), '3R': r(entry + dir * dist * 3) },
  };
}

export function futuresPnl({ side, entry_price, exit_price, margin, leverage, fee_pct }) {
  const entry = num(entry_price);
  const exit = num(exit_price);
  const m = num(margin);
  const lev = num(leverage);
  const fee = (fee_pct == null ? 0.05 : num(fee_pct)) / 100;
  if (!(entry > 0) || !(exit > 0) || !(m > 0) || !(lev >= 1) || !(fee >= 0) || (side !== 'long' && side !== 'short')) {
    throw new InputError('Provide side, entry_price, exit_price, margin and leverage >= 1.');
  }
  const dir = side === 'long' ? 1 : -1;
  const notional = m * lev;
  const qty = notional / entry;
  const gross = qty * (exit - entry) * dir;
  const fees = notional * fee + qty * exit * fee;
  const net = gross - fees;
  return {
    gross_pnl: r(gross),
    fees: r(fees),
    net_pnl: r(net),
    roe_pct: r((net / m) * 100),
    notional_usd: r(notional),
    quantity: r(qty, 6),
  };
}

export function fundingFee({ side, notional, funding_rate_pct, interval_hours, days }) {
  const n = num(notional);
  const rate = num(funding_rate_pct) / 100;
  const interval = interval_hours == null ? 8 : num(interval_hours);
  const d = num(days);
  if (!(n > 0) || !Number.isFinite(rate) || !(interval > 0) || !(d >= 0) || (side !== 'long' && side !== 'short')) {
    throw new InputError('Provide side, notional, funding_rate_pct and days.');
  }
  const perDay = 24 / interval;
  const sign = (side === 'long' ? -1 : 1) * (rate >= 0 ? 1 : -1);
  const perPay = Math.abs(n * rate);
  const count = Math.floor(perDay * d + 1e-9);
  const total = sign * perPay * count;
  return {
    total_usd: r(total),
    payments: count,
    per_payment_usd: r(perPay),
    per_day_usd: r(sign * perPay * perDay),
    annualised_rate_pct: r(Math.abs(rate) * perDay * 365 * 100),
    direction: total < 0 ? 'you pay' : total > 0 ? 'you receive' : 'none',
  };
}