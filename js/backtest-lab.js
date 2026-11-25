/*
 * CryptoBolt Backtest Lab: engine + page UI.
 *
 * Engine rules (stated on the page):
 *  - A signal is read at the CLOSE of a bar and filled at the OPEN of the next bar (no look-ahead).
 *  - Every trade uses 100% of current equity as margin; notional = equity x leverage.
 *  - Fee is charged on notional at entry and exit; slippage moves each fill against you.
 *  - Stop-loss, take-profit and liquidation are checked on the bar's high/low. If a stop and a target
 *    are both inside one bar, the stop is assumed to hit first. A gap through a stop fills at the open.
 *  - Liquidation (isolated margin): adverse move of 1/leverage minus a 0.5% maintenance margin loses
 *    the whole account.
 *  - Out-of-sample: indicators run over the full history, the first 70% of bars is "in-sample" and the
 *    last 30% is "out-of-sample"; each part is simulated from flat.
 *  - Monte Carlo: trade returns are resampled with replacement (seeded, 1,000 runs).
 */
(function (root) {
    'use strict';

    var MMR = 0.005;

    /* ------------------------------ indicators ------------------------------ */
    function nanArr(n) { var a = new Array(n), i; for (i = 0; i < n; i++) a[i] = NaN; return a; }

    function sma(a, n) {
        var out = nanArr(a.length), s = 0, i;
        for (i = 0; i < a.length; i++) {
            s += a[i];
            if (i >= n) s -= a[i - n];
            if (i >= n - 1) out[i] = s / n;
        }
        return out;
    }

    // EMA seeded with the SMA of the first n valid values (skips leading NaN).
    function ema(a, n) {
        var out = nanArr(a.length), k = 2 / (n + 1), i, first = -1, cnt = 0, s = 0, prev = NaN;
        for (i = 0; i < a.length; i++) {
            if (isNaN(a[i])) continue;
            if (first < 0) first = i;
            cnt++; s += a[i];
            if (cnt === n) { prev = s / n; out[i] = prev; }
            else if (cnt > n) { prev = a[i] * k + prev * (1 - k); out[i] = prev; }
        }
        return out;
    }

    function rsi(c, n) {
        var out = nanArr(c.length), g = 0, l = 0, i, d, ag, al;
        if (c.length <= n) return out;
        for (i = 1; i <= n; i++) { d = c[i] - c[i - 1]; if (d > 0) g += d; else l -= d; }
        ag = g / n; al = l / n;
        out[n] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
        for (i = n + 1; i < c.length; i++) {
            d = c[i] - c[i - 1];
            ag = (ag * (n - 1) + (d > 0 ? d : 0)) / n;
            al = (al * (n - 1) + (d < 0 ? -d : 0)) / n;
            out[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
        }
        return out;
    }

    function stdev(a, n) {
        var out = nanArr(a.length), i, j, m, s;
        for (i = n - 1; i < a.length; i++) {
            m = 0; for (j = i - n + 1; j <= i; j++) m += a[j]; m /= n;
            s = 0; for (j = i - n + 1; j <= i; j++) s += (a[j] - m) * (a[j] - m);
            out[i] = Math.sqrt(s / n);
        }
        return out;
    }

    // Highest high (or lowest low) of the PREVIOUS n bars, not including the current one.
    function prevExtreme(a, n, isMax) {
        var out = nanArr(a.length), i, j, v;
        for (i = n; i < a.length; i++) {
            v = a[i - n];
            for (j = i - n + 1; j < i; j++) v = isMax ? Math.max(v, a[j]) : Math.min(v, a[j]);
            out[i] = v;
        }
        return out;
    }

    /* ------------------------------ strategies ------------------------------ */
    var STRATEGIES = {
        sma_cross: { label: 'SMA crossover', desc: 'Long while the fast average is above the slow one.',
            params: [{ k: 'fast', label: 'Fast SMA', v: 20, min: 2, max: 200 }, { k: 'slow', label: 'Slow SMA', v: 50, min: 3, max: 400 }] },
        ema_cross: { label: 'EMA crossover', desc: 'Long while the fast EMA is above the slow EMA.',
            params: [{ k: 'fast', label: 'Fast EMA', v: 12, min: 2, max: 200 }, { k: 'slow', label: 'Slow EMA', v: 26, min: 3, max: 400 }] },
        macd: { label: 'MACD signal cross', desc: 'Long while the MACD line is above its signal line.',
            params: [{ k: 'fast', label: 'Fast EMA', v: 12, min: 2, max: 100 }, { k: 'slow', label: 'Slow EMA', v: 26, min: 3, max: 200 }, { k: 'signal', label: 'Signal EMA', v: 9, min: 2, max: 50 }] },
        rsi_revert: { label: 'RSI mean reversion', desc: 'Buy when RSI drops below the low level, sell when it rises above the high level.',
            params: [{ k: 'period', label: 'RSI period', v: 14, min: 2, max: 100 }, { k: 'low', label: 'Buy below', v: 30, min: 1, max: 49 }, { k: 'high', label: 'Sell above', v: 70, min: 51, max: 99 }] },
        bb_revert: { label: 'Bollinger band reversion', desc: 'Buy a close below the lower band, exit at the middle band.',
            params: [{ k: 'period', label: 'Period', v: 20, min: 5, max: 200 }, { k: 'k', label: 'Std devs', v: 2, min: 0.5, max: 5 }] },
        donchian: { label: 'Donchian breakout', desc: 'Buy a close above the highest high of the last N bars, exit below the lowest low of the last N/2 bars.',
            params: [{ k: 'period', label: 'Lookback bars', v: 20, min: 4, max: 400 }] },
        hold: { label: 'Buy and hold', desc: 'Baseline: buy on the first bar and keep it.', params: [] }
    };

    function defaultParams(name) {
        var d = {}, s = STRATEGIES[name];
        if (s) s.params.forEach(function (p) { d[p.k] = p.v; });
        return d;
    }

    // Desired position after each bar's close: 1 long, -1 short, 0 flat.
    function signals(name, p, cs, allowShort) {
        var c = cs.c, n = c.length, sig = new Array(n), i, pos = 0, s, f, a, b, line, sg, r, m, sd, up, lo, hi, lw, hiX, loX, x;
        for (i = 0; i < n; i++) sig[i] = 0;
        if (name === 'hold') { for (i = 0; i < n; i++) sig[i] = 1; return sig; }
        if (name === 'sma_cross' || name === 'ema_cross') {
            f = name === 'sma_cross' ? sma(c, p.fast) : ema(c, p.fast);
            s = name === 'sma_cross' ? sma(c, p.slow) : ema(c, p.slow);
            for (i = 0; i < n; i++) {
                if (isNaN(f[i]) || isNaN(s[i])) { sig[i] = 0; continue; }
                sig[i] = f[i] > s[i] ? 1 : (allowShort ? -1 : 0);
            }
            return sig;
        }
        if (name === 'macd') {
            a = ema(c, p.fast); b = ema(c, p.slow);
            line = nanArr(n);
            for (i = 0; i < n; i++) if (!isNaN(a[i]) && !isNaN(b[i])) line[i] = a[i] - b[i];
            sg = ema(line, p.signal);
            for (i = 0; i < n; i++) {
                if (isNaN(line[i]) || isNaN(sg[i])) { sig[i] = 0; continue; }
                sig[i] = line[i] > sg[i] ? 1 : (allowShort ? -1 : 0);
            }
            return sig;
        }
        if (name === 'rsi_revert') {
            r = rsi(c, p.period);
            for (i = 0; i < n; i++) {
                x = r[i];
                if (!isNaN(x)) {
                    if (pos === 1 && x > p.high) pos = allowShort ? -1 : 0;
                    else if (pos === -1 && x < p.low) pos = 1;
                    else if (pos === 0) { if (x < p.low) pos = 1; else if (x > p.high && allowShort) pos = -1; }
                }
                sig[i] = pos;
            }
            return sig;
        }
        if (name === 'bb_revert') {
            m = sma(c, p.period); sd = stdev(c, p.period);
            for (i = 0; i < n; i++) {
                if (!isNaN(m[i])) {
                    up = m[i] + p.k * sd[i]; lo = m[i] - p.k * sd[i];
                    if (pos === 1 && c[i] >= m[i]) pos = 0;
                    else if (pos === -1 && c[i] <= m[i]) pos = 0;
                    if (pos === 0) { if (c[i] < lo) pos = 1; else if (c[i] > up && allowShort) pos = -1; }
                }
                sig[i] = pos;
            }
            return sig;
        }
        if (name === 'donchian') {
            var half = Math.max(2, Math.round(p.period / 2));
            hi = prevExtreme(cs.h, p.period, true); lw = prevExtreme(cs.l, p.period, false);
            hiX = prevExtreme(cs.h, half, true); loX = prevExtreme(cs.l, half, false);
            for (i = 0; i < n; i++) {
                if (!isNaN(hi[i]) && !isNaN(lw[i])) {
                    if (pos === 1 && c[i] < loX[i]) pos = 0;
                    else if (pos === -1 && c[i] > hiX[i]) pos = 0;
                    if (pos === 0) { if (c[i] > hi[i]) pos = 1; else if (c[i] < lw[i] && allowShort) pos = -1; }
                }
                sig[i] = pos;
            }
            return sig;
        }
        return sig;
    }

    /* ------------------------------ simulator ------------------------------ */
    function simulate(cs, sig, o, start, end) {
        var fee = (o.fee || 0) / 100, slip = (o.slip || 0) / 100, lev = o.leverage || 1;
        var slPct = o.stop > 0 ? o.stop / 100 : 0, tpPct = o.target > 0 ? o.target / 100 : 0;
        var equity = 1, pos = 0, entry = 0, e0 = 0, eBefore = 1, entryBar = 0;
        var trades = [], eq = [], inPos = 0, blown = false, i, j, want, px, d, exitPx, reason, stopPx, tpPx, liqPx, hitStop, hitTp, hitLiq, prevEq;

        function closeTrade(price, bar, why) {
            var notional = e0 * lev * (price / entry);
            var unreal = e0 * lev * pos * (price / entry - 1);
            var after = e0 + unreal - Math.abs(notional) * fee;
            if (after < 0) after = 0;
            trades.push({ side: pos, entryBar: entryBar, exitBar: bar, entryPx: entry, exitPx: price, ret: after / eBefore - 1, reason: why });
            equity = after; pos = 0;
        }

        for (i = start; i < end; i++) {
            if (blown) { eq.push(0); continue; }
            // 1. execute the decision made at the previous close, at this bar's open
            if (i > start) {
                want = sig[i - 1];
                if (want !== pos) {
                    if (pos !== 0) {
                        px = cs.o[i] * (1 - pos * slip);
                        closeTrade(px, i, 'signal');
                    }
                    if (want !== 0 && equity > 0) {
                        px = cs.o[i] * (1 + want * slip);
                        eBefore = equity;
                        e0 = equity * (1 - lev * fee);
                        entry = px; pos = want; entryBar = i;
                    }
                }
            }
            // 2. intrabar stop / target / liquidation
            if (pos !== 0) {
                liqPx = pos === 1 ? entry * (1 - 1 / lev + MMR) : entry * (1 + 1 / lev - MMR);
                stopPx = slPct ? entry * (1 - pos * slPct) : null;
                tpPx = tpPct ? entry * (1 + pos * tpPct) : null;
                if (pos === 1) {
                    hitLiq = cs.l[i] <= liqPx;
                    hitStop = stopPx !== null && cs.l[i] <= stopPx;
                    hitTp = tpPx !== null && cs.h[i] >= tpPx;
                } else {
                    hitLiq = cs.h[i] >= liqPx;
                    hitStop = stopPx !== null && cs.h[i] >= stopPx;
                    hitTp = tpPx !== null && cs.l[i] <= tpPx;
                }
                // which adverse level is nearer to the entry fires first
                if (hitLiq && hitStop) { if (pos === 1 ? stopPx >= liqPx : stopPx <= liqPx) hitLiq = false; else hitStop = false; }
                if (hitLiq) {
                    trades.push({ side: pos, entryBar: entryBar, exitBar: i, entryPx: entry, exitPx: liqPx, ret: -1, reason: 'liquidation' });
                    equity = 0; pos = 0; blown = true;
                } else if (hitStop) {
                    exitPx = pos === 1 ? Math.min(stopPx, cs.o[i]) : Math.max(stopPx, cs.o[i]);
                    closeTrade(exitPx * (1 - pos * slip), i, 'stop');
                } else if (hitTp) {
                    closeTrade(tpPx * (1 - pos * slip), i, 'target');
                }
            }
            // 3. mark to market at the close
            if (blown) { eq.push(0); continue; }
            if (pos !== 0) { inPos++; equity = Math.max(0, e0 + e0 * lev * pos * (cs.c[i] / entry - 1)); eq.push(equity); }
            else eq.push(equity);
            if (pos !== 0 && equity <= 0) { trades.push({ side: pos, entryBar: entryBar, exitBar: i, entryPx: entry, exitPx: cs.c[i], ret: -1, reason: 'liquidation' }); pos = 0; blown = true; }
            // keep running equity for the next bar when still in a trade: equity var holds mark value; e0 stays the margin base
            if (pos !== 0) { /* equity is the mark; e0 untouched */ }
        }
        if (pos !== 0 && !blown) {
            px = cs.c[end - 1] * (1 - pos * slip);
            closeTrade(px, end - 1, 'end');
            eq[eq.length - 1] = equity;
        }
        return { eq: eq, trades: trades, bars: end - start, inPos: inPos, blown: blown };
    }

    /* ------------------------------ metrics ------------------------------ */
    var BARS_PER_YEAR = { '15m': 35040, '1h': 8760, '4h': 2190, '1d': 365 };

    function maxDrawdown(eq) {
        var peak = -Infinity, dd = 0, i;
        for (i = 0; i < eq.length; i++) { if (eq[i] > peak) peak = eq[i]; if (peak > 0) dd = Math.max(dd, (peak - eq[i]) / peak); }
        return dd;
    }

    function metrics(run, barsPerYear, bh) {
        var eq = run.eq, n = eq.length, last = n ? eq[n - 1] : 1, t = run.trades, wins = 0, gw = 0, gl = 0, i, rs = [], m = 0, v = 0, sd, years, best = -Infinity, worst = Infinity, sum = 0;
        for (i = 0; i < t.length; i++) {
            if (t[i].ret > 0) { wins++; gw += t[i].ret; } else gl += -t[i].ret;
            sum += t[i].ret; if (t[i].ret > best) best = t[i].ret; if (t[i].ret < worst) worst = t[i].ret;
        }
        for (i = 1; i < n; i++) rs.push(eq[i - 1] > 0 ? eq[i] / eq[i - 1] - 1 : 0);
        for (i = 0; i < rs.length; i++) m += rs[i];
        m = rs.length ? m / rs.length : 0;
        for (i = 0; i < rs.length; i++) v += (rs[i] - m) * (rs[i] - m);
        sd = rs.length > 1 ? Math.sqrt(v / (rs.length - 1)) : 0;
        years = n / barsPerYear;
        return {
            totalReturn: last - 1,
            cagr: years > 0 && last > 0 ? Math.pow(last, 1 / years) - 1 : (last <= 0 ? -1 : 0),
            maxDD: maxDrawdown(eq),
            sharpe: sd > 0 ? (m / sd) * Math.sqrt(barsPerYear) : 0,
            trades: t.length,
            winRate: t.length ? wins / t.length : 0,
            profitFactor: gl > 0 ? gw / gl : (gw > 0 ? Infinity : 0),
            avgTrade: t.length ? sum / t.length : 0,
            best: t.length ? best : 0, worst: t.length ? worst : 0,
            exposure: n ? run.inPos / n : 0,
            blown: run.blown,
            buyHold: bh || null
        };
    }

    function buyHold(cs, start, end) {
        var eq = [], i, base = cs.c[start];
        for (i = start; i < end; i++) eq.push(cs.c[i] / base);
        return { eq: eq, ret: eq[eq.length - 1] - 1, maxDD: maxDrawdown(eq) };
    }

    /* ------------------------------ full run ------------------------------ */
    function runAll(cs, name, params, opts) {
        var n = cs.c.length, k = Math.floor(n * (opts.split || 0.7)), sig = signals(name, params, cs, !!opts.allowShort);
        var bpy = BARS_PER_YEAR[opts.interval] || 365;
        var full = simulate(cs, sig, opts, 0, n);
        var ins = simulate(cs, sig, opts, 0, k);
        var oos = simulate(cs, sig, opts, k, n);
        var bhFull = buyHold(cs, 0, n), bhIn = buyHold(cs, 0, k), bhOos = buyHold(cs, k, n);
        return {
            splitIndex: k, signals: sig,
            full: { run: full, m: metrics(full, bpy, bhFull) },
            ins: { run: ins, m: metrics(ins, bpy, bhIn) },
            oos: { run: oos, m: metrics(oos, bpy, bhOos) },
            buyHold: bhFull
        };
    }

    /* ------------------------------ Monte Carlo ------------------------------ */
    function rng(seed) {
        var a = seed >>> 0;
        return function () {
            a = (a + 0x6D2B79F5) >>> 0;
            var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    function pct(sorted, q) { return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(q * (sorted.length - 1))))]; }

    function monteCarlo(trades, runs, seed) {
        var n = trades.length, rnd = rng(seed || 12345), rets = trades.map(function (t) { return t.ret; });
        var finals = [], dds = [], r, i, eq, peak, dd, loss = 0, dd50 = 0, ruin = 0;
        runs = runs || 1000;
        if (n < 10) return { ok: false, reason: 'few-trades', trades: n };
        for (r = 0; r < runs; r++) {
            eq = 1; peak = 1; dd = 0;
            for (i = 0; i < n; i++) {
                eq *= 1 + rets[Math.floor(rnd() * n)];
                if (eq > peak) peak = eq;
                if (peak > 0) dd = Math.max(dd, (peak - eq) / peak);
            }
            finals.push(eq - 1); dds.push(dd);
            if (eq < 1) loss++;
            if (dd >= 0.5) dd50++;
            if (eq <= 0.1) ruin++;
        }
        finals.sort(function (a, b) { return a - b; }); dds.sort(function (a, b) { return a - b; });
        return {
            ok: true, runs: runs, trades: n,
            ret: { p5: pct(finals, 0.05), p50: pct(finals, 0.5), p95: pct(finals, 0.95) },
            dd: { p5: pct(dds, 0.05), p50: pct(dds, 0.5), p95: pct(dds, 0.95) },
            probLoss: loss / runs, probDD50: dd50 / runs, probRuin: ruin / runs
        };
    }

    /* ------------------------------ optimizer ------------------------------ */
    function range(a, b, steps) {
        var out = [], i, v;
        for (i = 0; i < steps; i++) { v = a + (b - a) * i / (steps - 1); out.push(Math.round(v * 100) / 100); }
        return out;
    }

    function optimize(cs, name, base, ka, va, kb, vb, opts) {
        var n = cs.c.length, k = Math.floor(n * (opts.split || 0.7)), grid = [], cells = [], i, j, p, sig, a, b, ins, oos, rIn, rOos;
        for (i = 0; i < va.length; i++) {
            grid.push([]);
            for (j = 0; j < vb.length; j++) {
                p = {}; for (var key in base) if (Object.prototype.hasOwnProperty.call(base, key)) p[key] = base[key];
                p[ka] = va[i]; if (kb) p[kb] = vb[j];
                if ((name === 'sma_cross' || name === 'ema_cross' || name === 'macd') && p.fast >= p.slow) { grid[i].push(null); continue; }
                if (name === 'rsi_revert' && p.low >= p.high) { grid[i].push(null); continue; }
                sig = signals(name, p, cs, !!opts.allowShort);
                ins = simulate(cs, sig, opts, 0, k); oos = simulate(cs, sig, opts, k, n);
                rIn = ins.eq.length ? ins.eq[ins.eq.length - 1] - 1 : 0;
                rOos = oos.eq.length ? oos.eq[oos.eq.length - 1] - 1 : 0;
                a = { a: va[i], b: kb ? vb[j] : null, ins: rIn, oos: rOos, trades: ins.trades.length };
                grid[i].push(a);
                if (ins.trades.length >= 5) cells.push(a);
            }
        }
        if (!cells.length) return { ok: false, grid: grid, ka: ka, kb: kb, va: va, vb: vb };
        var byIn = cells.slice().sort(function (x, y) { return y.ins - x.ins; });
        var top = byIn.slice(0, Math.max(1, Math.ceil(cells.length * 0.1)));
        var avg = function (arr, f) { var s = 0, q; for (q = 0; q < arr.length; q++) s += f(arr[q]); return arr.length ? s / arr.length : 0; };
        var oosSorted = cells.map(function (c) { return c.oos; }).sort(function (x, y) { return x - y; });
        return {
            ok: true, grid: grid, ka: ka, kb: kb, va: va, vb: vb, tested: cells.length,
            best: byIn[0], topOosAvg: avg(top, function (c) { return c.oos; }),
            topInAvg: avg(top, function (c) { return c.ins; }),
            medianOos: pct(oosSorted, 0.5),
            profitableIn: cells.filter(function (c) { return c.ins > 0; }).length / cells.length,
            profitableOos: cells.filter(function (c) { return c.oos > 0; }).length / cells.length
        };
    }

    /* ------------------------------ synthetic data (tests + page examples) ------------------------------ */
    function randomWalk(n, seed, drift, vol) {
        var rnd = rng(seed), cs = { t: [], o: [], h: [], l: [], c: [] }, p = 100, i, z, w, o, c, hi, lo;
        function normal() { var u = Math.max(rnd(), 1e-12), v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
        for (i = 0; i < n; i++) {
            z = normal(); w = Math.abs(normal());
            o = p; c = o * Math.exp(drift + vol * z);
            hi = Math.max(o, c) * (1 + w * vol * 0.35); lo = Math.min(o, c) * (1 - Math.abs(normal()) * vol * 0.35);
            cs.t.push(i); cs.o.push(o); cs.h.push(hi); cs.l.push(lo); cs.c.push(c); p = c;
        }
        return cs;
    }

    /* ------------------------------ plain-English parser ------------------------------ */
    function parseText(text) {
        var t = String(text || '').toLowerCase(), out = { strategy: null, params: {}, notes: [], leverage: null, stop: null, target: null, allowShort: null }, m, nums, f, s;
        if (!t.trim()) return null;
        m = t.match(/(\d+(?:\.\d+)?)\s*x\b/) || t.match(/leverage\s*(?:of)?\s*(\d+(?:\.\d+)?)/);
        if (m) out.leverage = Math.min(125, Math.max(1, parseFloat(m[1])));
        m = t.match(/(?:stop[\s-]?loss|\bsl\b)\s*(?:of|at)?\s*(\d+(?:\.\d+)?)\s*%/);
        if (m) out.stop = parseFloat(m[1]);
        m = t.match(/(?:take[\s-]?profit|\btp\b|target)\s*(?:of|at)?\s*(\d+(?:\.\d+)?)\s*%/);
        if (m) out.target = parseFloat(m[1]);
        if (/long[\s-]?only|no shorts?/.test(t)) out.allowShort = false;
        else if (/\bshort(s|ing)?\b|long and short|both directions/.test(t)) out.allowShort = true;
        var stripped = t.replace(/(\d+(?:\.\d+)?)\s*x\b/g, ' ').replace(/(\d+(?:\.\d+)?)\s*%/g, ' ');
        if (/buy (and|&) hold|hodl/.test(t)) { out.strategy = 'hold'; return out; }
        if (/golden cross/.test(t)) { out.strategy = 'sma_cross'; out.params = { fast: 50, slow: 200 }; out.notes.push('Golden cross = 50/200 SMA.'); return out; }
        if (/macd/.test(t)) {
            out.strategy = 'macd'; nums = (stripped.match(/\d+/g) || []).map(Number);
            if (nums.length >= 3) out.params = { fast: nums[0], slow: nums[1], signal: nums[2] };
            return out;
        }
        if (/rsi/.test(t)) {
            out.strategy = 'rsi_revert';
            var rest = stripped;
            m = rest.match(/rsi\s*\(\s*(\d+)\s*\)/) || rest.match(/(\d+)[\s-]*(?:period|day|bar)s?\s*rsi/);
            if (m) { out.params.period = parseInt(m[1], 10); rest = rest.replace(m[0], ' '); }
            nums = (rest.match(/\d+(?:\.\d+)?/g) || []).map(Number);
            nums.forEach(function (x) { if (x < 50 && out.params.low === undefined) out.params.low = x; else if (x > 50 && x < 100 && out.params.high === undefined) out.params.high = x; });
            return out;
        }
        if (/bollinger|\bbb\b|bands?/.test(t)) {
            out.strategy = 'bb_revert'; nums = (stripped.match(/\d+(?:\.\d+)?/g) || []).map(Number);
            nums.forEach(function (x) { if (x >= 5 && Math.floor(x) === x && out.params.period === undefined) out.params.period = x; else if (x < 5 && out.params.k === undefined) out.params.k = x; });
            return out;
        }
        if (/breakout|donchian|channel/.test(t)) {
            out.strategy = 'donchian'; m = stripped.match(/(\d+)/);
            if (m) out.params.period = parseInt(m[1], 10);
            return out;
        }
        if (/(sma|ema|moving average|\bma\b)/.test(t)) {
            out.strategy = /ema/.test(t) ? 'ema_cross' : 'sma_cross';
            nums = (stripped.match(/\d+/g) || []).map(Number);
            if (nums.length >= 2) { f = Math.min(nums[0], nums[1]); s = Math.max(nums[0], nums[1]); if (f !== s) out.params = { fast: f, slow: s }; }
            return out;
        }
        return null;
    }

    root.CBBacktest = {
        STRATEGIES: STRATEGIES, defaultParams: defaultParams, signals: signals, simulate: simulate, metrics: metrics,
        runAll: runAll, monteCarlo: monteCarlo, optimize: optimize, range: range, randomWalk: randomWalk,
        parseText: parseText, buyHold: buyHold, sma: sma, ema: ema, rsi: rsi, rng: rng, BARS_PER_YEAR: BARS_PER_YEAR
    };

    /* ============================== page UI ============================== */
    if (typeof document === 'undefined') return;

    var $ = function (id) { return document.getElementById(id); };
    var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    var B = root.CBBacktest;
    var state = { cs: null, symbol: '', market: '', interval: '', last: null, mc: null, opt: null };
    if (!$('bt-run')) return;

    function pctS(x, d) { if (!isFinite(x)) return x > 0 ? '∞' : '—'; return (x * 100).toFixed(d === undefined ? 1 : d) + '%'; }
    function signedS(x, d) { return (x >= 0 ? '+' : '') + pctS(x, d); }
    function cls(x) { return x < 0 ? ' class="lc-neg"' : ''; }
    function num(id, d) { var v = parseFloat($(id).value); return isFinite(v) ? v : d; }

    function renderParams(name, vals) {
        var box = $('bt-params'), s = B.STRATEGIES[name], html = '';
        $('bt-strategy-desc').textContent = s.desc;
        s.params.forEach(function (p) {
            var v = vals && vals[p.k] !== undefined ? vals[p.k] : p.v;
            html += '<div class="lc-field"><label for="bt-p-' + p.k + '">' + esc(p.label) + '</label><input type="number" id="bt-p-' + p.k + '" inputmode="decimal" step="any" min="' + p.min + '" max="' + p.max + '" value="' + v + '"></div>';
        });
        box.innerHTML = html;
        var sel = $('bt-opt-a'), selB = $('bt-opt-b'), o = '';
        s.params.forEach(function (p) { o += '<option value="' + p.k + '">' + esc(p.label) + '</option>'; });
        sel.innerHTML = o; selB.innerHTML = '<option value="">(none)</option>' + o;
        if (s.params.length > 1) selB.value = s.params[1].k;
        $('bt-optimize').disabled = !s.params.length;
    }

    function readParams(name) {
        var p = {}, s = B.STRATEGIES[name];
        s.params.forEach(function (d) { var v = parseFloat($('bt-p-' + d.k).value); p[d.k] = isFinite(v) ? v : d.v; });
        return p;
    }

    function readOpts() {
        return { fee: Math.max(0, num('bt-fee', 0.05)), slip: Math.max(0, num('bt-slip', 0.02)), leverage: Math.min(125, Math.max(1, num('bt-lev', 1))),
            stop: Math.max(0, num('bt-stop', 0)), target: Math.max(0, num('bt-tp', 0)), allowShort: $('bt-short').checked, interval: $('bt-interval').value, split: 0.7 };
    }

    function setStatus(msg, bad) { var s = $('bt-status'); s.textContent = msg; s.className = 'lc-warning' + (bad ? '' : ' bt-ok'); s.style.display = msg ? 'block' : 'none'; }

    async function fetchCandles(symbol, market, interval, want) {
        var base = market === 'futures' ? 'https://fapi.binance.com/fapi/v1/klines' : 'https://api.binance.com/api/v3/klines';
        var per = market === 'futures' ? 1500 : 1000, rows = [], end = null, guard = 0, url, res, chunk;
        while (rows.length < want && guard++ < 8) {
            url = base + '?symbol=' + symbol + '&interval=' + interval + '&limit=' + Math.min(per, want - rows.length) + (end ? '&endTime=' + end : '');
            res = await fetch(url);
            if (!res.ok) throw new Error(res.status === 400 ? 'Binance does not list ' + symbol + ' on ' + market + '.' : 'Binance returned HTTP ' + res.status + '.');
            chunk = await res.json();
            if (!chunk.length) break;
            rows = chunk.concat(rows);
            end = chunk[0][0] - 1;
            if (chunk.length < Math.min(per, want - rows.length + chunk.length)) break;
        }
        var cs = { t: [], o: [], h: [], l: [], c: [] };
        rows.forEach(function (r) { cs.t.push(r[0]); cs.o.push(+r[1]); cs.h.push(+r[2]); cs.l.push(+r[3]); cs.c.push(+r[4]); });
        return cs;
    }

    async function ensureData() {
        var sym = ($('bt-symbol').value || 'BTC').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (!sym) throw new Error('Type a coin symbol, for example BTC.');
        var symbol = /USDT$/.test(sym) ? sym : sym + 'USDT', market = $('bt-market').value, interval = $('bt-interval').value, want = parseInt($('bt-bars').value, 10);
        if (state.cs && state.symbol === symbol && state.market === market && state.interval === interval && state.cs.c.length >= want * 0.98) return state.cs;
        setStatus('Downloading ' + want + ' ' + interval + ' candles for ' + symbol + ' from Binance…');
        var cs = await fetchCandles(symbol, market, interval, want);
        if (cs.c.length < 300) throw new Error('Only ' + cs.c.length + ' candles are available for ' + symbol + '. Pick a longer-listed coin or a shorter number of bars.');
        state.cs = cs; state.symbol = symbol; state.market = market; state.interval = interval;
        return cs;
    }

    function dateS(ts) { var d = new Date(ts); return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2); }

    function chart(cs, res) {
        var W = 760, H = 280, pad = 36, n = cs.c.length, k = res.splitIndex, i, x, y;
        var eq = res.full.run.eq, bh = res.buyHold.eq, lo = Infinity, hi = -Infinity;
        for (i = 0; i < n; i++) { lo = Math.min(lo, eq[i], bh[i]); hi = Math.max(hi, eq[i], bh[i]); }
        lo = Math.max(lo, 0.0001); hi = Math.max(hi, lo * 1.01);
        var useLog = hi / lo > 8, f = function (v) { return useLog ? Math.log(Math.max(v, lo)) : v; };
        var a = f(lo), b = f(hi);
        var X = function (j) { return pad + (W - pad - 8) * j / (n - 1); }, Y = function (v) { return H - 24 - (H - 40) * (f(Math.max(v, lo)) - a) / (b - a); };
        var line = function (arr) { var p = [], j; for (j = 0; j < n; j += Math.max(1, Math.floor(n / 600))) p.push(X(j).toFixed(1) + ',' + Y(arr[j]).toFixed(1)); p.push(X(n - 1).toFixed(1) + ',' + Y(arr[n - 1]).toFixed(1)); return p.join(' '); };
        var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Equity curve of the strategy compared with buy and hold" style="width:100%;height:auto;max-width:100%">';
        s += '<rect x="' + X(k).toFixed(1) + '" y="8" width="' + (X(n - 1) - X(k)).toFixed(1) + '" height="' + (H - 32) + '" fill="rgba(245,158,11,.10)"/>';
        s += '<text x="' + (X(k) + 6).toFixed(1) + '" y="22" fill="#F59E0B" font-size="11">out-of-sample (last 30%)</text>';
        s += '<text x="' + (pad + 4) + '" y="22" fill="#8B93A3" font-size="11">in-sample</text>';
        s += '<line x1="' + pad + '" y1="' + Y(1).toFixed(1) + '" x2="' + (W - 8) + '" y2="' + Y(1).toFixed(1) + '" stroke="rgba(237,239,243,.25)" stroke-dasharray="4 4"/>';
        s += '<polyline fill="none" stroke="#8B93A3" stroke-width="1.5" points="' + line(bh) + '"/>';
        s += '<polyline fill="none" stroke="#22C58C" stroke-width="2" points="' + line(eq) + '"/>';
        s += '<text x="' + pad + '" y="' + (H - 6) + '" fill="#8B93A3" font-size="11">' + dateS(cs.t[0]) + '</text><text x="' + (W - 8) + '" y="' + (H - 6) + '" fill="#8B93A3" font-size="11" text-anchor="end">' + dateS(cs.t[n - 1]) + '</text>';
        s += '<text x="' + (W - 8) + '" y="' + (H - 22) + '" fill="#8B93A3" font-size="11" text-anchor="end">' + (useLog ? 'log scale · ' : '') + 'green = strategy, grey = buy and hold</text></svg>';
        return s;
    }

    function statGrid(label, m) {
        var h = '<div class="lc-stat"><b' + cls(m.totalReturn) + '>' + signedS(m.totalReturn) + '</b><span>' + label + ' return</span></div>';
        h += '<div class="lc-stat"><b' + cls(m.buyHold.ret) + '>' + signedS(m.buyHold.ret) + '</b><span>Buy and hold, same period</span></div>';
        h += '<div class="lc-stat"><b class="lc-neg">-' + pctS(m.maxDD) + '</b><span>Max drawdown (buy and hold -' + pctS(m.buyHold.maxDD) + ')</span></div>';
        h += '<div class="lc-stat"><b>' + m.sharpe.toFixed(2) + '</b><span>Sharpe ratio (annualised)</span></div>';
        h += '<div class="lc-stat"><b>' + m.trades + '</b><span>Trades · win rate ' + pctS(m.winRate, 0) + '</span></div>';
        h += '<div class="lc-stat"><b>' + (isFinite(m.profitFactor) ? m.profitFactor.toFixed(2) : '∞') + '</b><span>Profit factor · exposure ' + pctS(m.exposure, 0) + '</span></div>';
        return h;
    }

    function verdict(res) {
        var a = res.ins.m, b = res.oos.m, notes = [];
        if (res.full.m.blown) notes.push('The account was liquidated. Lower the leverage or add a stop-loss closer than the liquidation price.');
        if (res.full.m.trades < 20) notes.push('Only ' + res.full.m.trades + ' trades. Results from fewer than about 30 trades are mostly luck. Use a shorter timeframe or more bars.');
        if (a.totalReturn > 0 && b.totalReturn <= 0) notes.push('Profitable in-sample, but it lost money out-of-sample. That is the classic sign of a strategy that only fit the past.');
        else if (a.totalReturn > 0 && b.totalReturn > 0) notes.push('Profitable in both the first 70% and the last 30%, which is a better sign, though not proof.');
        else if (a.totalReturn <= 0 && b.totalReturn <= 0) notes.push('It lost money in both parts of the history.');
        if (res.full.m.totalReturn < res.buyHold.ret) notes.push('It did not beat simply holding the coin over this period.');
        return notes;
    }

    function tradesTable(trades, cs) {
        var rows = trades.slice(-15).reverse().map(function (t) {
            return '<tr><td>' + dateS(cs.t[t.entryBar]) + '</td><td>' + (t.side > 0 ? 'Long' : 'Short') + '</td><td>' + t.entryPx.toLocaleString('en-US', { maximumFractionDigits: 4 }) + '</td><td>' + t.exitPx.toLocaleString('en-US', { maximumFractionDigits: 4 }) + '</td><td' + cls(t.ret) + '>' + signedS(t.ret, 2) + '</td><td>' + t.reason + '</td></tr>';
        }).join('');
        return '<div class="lc-tbl-wrap"><table><thead><tr><th>Entry date</th><th>Side</th><th>Entry</th><th>Exit</th><th>Result on account</th><th>Exit reason</th></tr></thead><tbody>' + rows + '</tbody></table></div><p class="lc-note">Showing the last ' + Math.min(15, trades.length) + ' of ' + trades.length + ' trades.</p>';
    }

    function render() {
        var res = state.last, cs = state.cs, m = res.full.m;
        $('bt-results').classList.remove('hidden');
        $('bt-chart').innerHTML = chart(cs, res);
        $('bt-stats-full').innerHTML = statGrid('Total', m);
        $('bt-stats-split').innerHTML =
            '<div class="lc-tbl-wrap"><table><thead><tr><th>Part of the history</th><th>Strategy</th><th>Buy and hold</th><th>Max drawdown</th><th>Trades</th></tr></thead><tbody>' +
            '<tr><td>In-sample: first 70% (' + dateS(cs.t[0]) + ' to ' + dateS(cs.t[res.splitIndex - 1]) + ')</td><td' + cls(res.ins.m.totalReturn) + '>' + signedS(res.ins.m.totalReturn) + '</td><td>' + signedS(res.ins.m.buyHold.ret) + '</td><td>-' + pctS(res.ins.m.maxDD) + '</td><td>' + res.ins.m.trades + '</td></tr>' +
            '<tr><td>Out-of-sample: last 30% (' + dateS(cs.t[res.splitIndex]) + ' to ' + dateS(cs.t[cs.t.length - 1]) + ')</td><td' + cls(res.oos.m.totalReturn) + '>' + signedS(res.oos.m.totalReturn) + '</td><td>' + signedS(res.oos.m.buyHold.ret) + '</td><td>-' + pctS(res.oos.m.maxDD) + '</td><td>' + res.oos.m.trades + '</td></tr></tbody></table></div>';
        $('bt-verdict').innerHTML = verdict(res).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('');
        $('bt-trades').innerHTML = res.full.run.trades.length ? tradesTable(res.full.run.trades, cs) : '<p class="lc-note">No trades were made with these settings.</p>';
        var mc = B.monteCarlo(res.full.run.trades, 1000, 20261125);
        state.mc = mc;
        $('bt-mc').innerHTML = mc.ok
            ? '<div class="lc-stats"><div class="lc-stat"><b' + cls(mc.ret.p5) + '>' + signedS(mc.ret.p5, 0) + ' / ' + signedS(mc.ret.p50, 0) + ' / ' + signedS(mc.ret.p95, 0) + '</b><span>Return: worst 5% / median / best 5%</span></div>' +
              '<div class="lc-stat"><b class="lc-neg">-' + pctS(mc.dd.p5, 0) + ' / -' + pctS(mc.dd.p50, 0) + ' / -' + pctS(mc.dd.p95, 0) + '</b><span>Max drawdown: mild / median / severe</span></div>' +
              '<div class="lc-stat"><b>' + pctS(mc.probLoss, 0) + '</b><span>Runs that ended in a loss</span></div>' +
              '<div class="lc-stat"><b>' + pctS(mc.probDD50, 0) + '</b><span>Runs with a drawdown of 50% or more</span></div></div><p class="lc-note">1,000 reshuffles of your ' + mc.trades + ' trades. Same trades, different order and repeats, so it shows how much of the result depended on luck of sequence. It assumes trades are independent.</p>'
            : '<p class="lc-note">Monte Carlo needs at least 10 trades; this run has ' + mc.trades + '.</p>';
        setStatus('');
        $('bt-ai-box').classList.remove('hidden');
    }

    async function run() {
        try {
            $('bt-run').disabled = true;
            var cs = await ensureData(), name = $('bt-strategy').value, p = readParams(name), o = readOpts();
            if ((name === 'sma_cross' || name === 'ema_cross' || name === 'macd') && p.fast >= p.slow) throw new Error('The fast period must be smaller than the slow period.');
            if (name === 'rsi_revert' && p.low >= p.high) throw new Error('The RSI buy level must be below the sell level.');
            state.last = B.runAll(cs, name, p, o); state.last.cfg = { name: name, params: p, opts: o };
            render();
        } catch (e) { setStatus(e.message || 'Something went wrong.', true); }
        finally { $('bt-run').disabled = false; }
    }

    async function optimizeRun() {
        try {
            $('bt-optimize').disabled = true;
            var cs = await ensureData(), name = $('bt-strategy').value, base = readParams(name), o = readOpts();
            var ka = $('bt-opt-a').value, kb = $('bt-opt-b').value, defs = B.STRATEGIES[name].params, da = defs.filter(function (d) { return d.k === ka; })[0], db = kb ? defs.filter(function (d) { return d.k === kb; })[0] : null;
            if (kb === ka) kb = '';
            var va = B.range(Math.max(da.min, base[ka] * 0.4), Math.min(da.max, base[ka] * 2.2), 8), vb = kb ? B.range(Math.max(db.min, base[kb] * 0.4), Math.min(db.max, base[kb] * 2.2), 8) : [0];
            if (name === 'sma_cross' || name === 'ema_cross' || name === 'donchian') { va = va.map(Math.round); if (kb) vb = vb.map(Math.round); }
            setStatus('Testing ' + va.length * vb.length + ' parameter combinations on the first 70%…');
            await new Promise(function (r) { setTimeout(r, 30); });
            var out = B.optimize(cs, name, base, ka, va, kb || null, vb, o);
            state.opt = out;
            var h = '';
            if (!out.ok) h = '<p class="lc-note">No combination made at least 5 trades in-sample.</p>';
            else {
                h += '<div class="lc-stats"><div class="lc-stat"><b>' + esc(ka) + ' ' + out.best.a + (kb ? ', ' + esc(kb) + ' ' + out.best.b : '') + '</b><span>Best in-sample setting (of ' + out.tested + ' tested)</span></div>' +
                    '<div class="lc-stat"><b' + cls(out.best.ins) + '>' + signedS(out.best.ins, 0) + '</b><span>Its in-sample return</span></div>' +
                    '<div class="lc-stat"><b' + cls(out.best.oos) + '>' + signedS(out.best.oos, 0) + '</b><span>The same setting out-of-sample</span></div>' +
                    '<div class="lc-stat"><b' + cls(out.medianOos) + '>' + signedS(out.medianOos, 0) + '</b><span>Median out-of-sample result of all settings</span></div>' +
                    '<div class="lc-stat"><b>' + pctS(out.profitableIn, 0) + ' → ' + pctS(out.profitableOos, 0) + '</b><span>Settings profitable in-sample → out-of-sample</span></div></div>';
                h += '<div class="lc-tbl-wrap"><table><thead><tr><th>' + esc(ka) + (kb ? ' ↓ / ' + esc(kb) + ' →' : '') + '</th>' + out.vb.map(function (v) { return '<th>' + (kb ? v : 'in-sample') + '</th>'; }).join('') + (kb ? '' : '<th>out-of-sample</th>') + '</tr></thead><tbody>';
                out.grid.forEach(function (row, i) {
                    h += '<tr><td><b>' + out.va[i] + '</b></td>';
                    if (kb) row.forEach(function (c) { h += c ? '<td' + (c.ins < 0 ? ' class="lc-neg"' : '') + ' title="out-of-sample ' + signedS(c.oos, 0) + '">' + signedS(c.ins, 0) + '</td>' : '<td>·</td>'; });
                    else h += row[0] ? '<td' + cls(row[0].ins) + '>' + signedS(row[0].ins, 0) + '</td><td' + cls(row[0].oos) + '>' + signedS(row[0].oos, 0) + '</td>' : '<td>·</td><td>·</td>';
                    h += '</tr>';
                });
                h += '</tbody></table></div><p class="lc-note">' + (kb ? 'Cells show in-sample return; hover a cell for its out-of-sample return. ' : '') + 'A setting you can trust sits inside a region of neighbours that are also profitable, not on a single lucky cell. If the best in-sample setting falls apart out-of-sample, the optimizer found noise.</p>';
            }
            $('bt-opt').innerHTML = h; $('bt-opt-wrap').classList.remove('hidden'); setStatus('');
        } catch (e) { setStatus(e.message || 'Something went wrong.', true); }
        finally { $('bt-optimize').disabled = false; }
    }

    /* ------------------------------ AI critique ------------------------------ */
    function summaryForAI() {
        var r = state.last, c = r.cfg, f = r.full.m, a = r.ins.m, b = r.oos.m, mc = state.mc, o = state.opt;
        var L = ['Review this crypto backtest bluntly. Say whether it looks overfit, what market regime it probably depends on, how sensitive it is to fees and leverage, and list 3 specific tests I should run next. Do not give price predictions or tell me to trade.',
            'Setup: ' + B.STRATEGIES[c.name].label + ' ' + JSON.stringify(c.params) + ' on ' + state.symbol + ' ' + state.market + ' ' + state.interval + ', ' + state.cs.c.length + ' candles (' + dateS(state.cs.t[0]) + ' to ' + dateS(state.cs.t[state.cs.t.length - 1]) + '). Leverage ' + c.opts.leverage + 'x, fee ' + c.opts.fee + '%/side, slippage ' + c.opts.slip + '%, stop ' + (c.opts.stop || 'none') + ', target ' + (c.opts.target || 'none') + ', shorts ' + (c.opts.allowShort ? 'on' : 'off') + '.',
            'Full: return ' + signedS(f.totalReturn, 0) + ' vs buy&hold ' + signedS(f.buyHold.ret, 0) + ', max DD -' + pctS(f.maxDD, 0) + ', Sharpe ' + f.sharpe.toFixed(2) + ', ' + f.trades + ' trades, win rate ' + pctS(f.winRate, 0) + ', profit factor ' + (isFinite(f.profitFactor) ? f.profitFactor.toFixed(2) : 'inf') + (f.blown ? ', ACCOUNT LIQUIDATED' : '') + '.',
            'In-sample (first 70%): ' + signedS(a.totalReturn, 0) + ' (' + a.trades + ' trades). Out-of-sample (last 30%): ' + signedS(b.totalReturn, 0) + ' (' + b.trades + ' trades), buy&hold OOS ' + signedS(b.buyHold.ret, 0) + '.'];
        if (mc && mc.ok) L.push('Monte Carlo: median ' + signedS(mc.ret.p50, 0) + ', worst 5% ' + signedS(mc.ret.p5, 0) + ', ' + pctS(mc.probLoss, 0) + ' of runs lost money, ' + pctS(mc.probDD50, 0) + ' had a 50%+ drawdown.');
        if (o && o.ok) L.push('Optimizer: best in-sample ' + signedS(o.best.ins, 0) + ' became ' + signedS(o.best.oos, 0) + ' out-of-sample; median OOS across ' + o.tested + ' settings ' + signedS(o.medianOos, 0) + '.');
        return L.join('\n').slice(0, 1750);
    }

    async function aiReview() {
        var out = $('bt-ai-out'), btn = $('bt-ai'), key = '';
        try { key = sessionStorage.getItem('cw_groq_api_key') || ''; } catch (e) { key = ''; }
        var headers = { 'Content-Type': 'application/json' };
        if (key) headers['x-groq-key'] = key; else headers['x-use-house-key'] = '1';
        var base = ((root.CW_CONFIG && root.CW_CONFIG.apiBaseUrl) || 'https://api.cryptobolt.io').replace(/\/$/, '');
        btn.disabled = true; out.classList.remove('hidden'); out.textContent = 'Reviewing your backtest…';
        try {
            var ctl = new AbortController(), to = setTimeout(function () { ctl.abort(); }, 45000);
            var res = await fetch(base + '/api/ai-chat', { method: 'POST', headers: headers, signal: ctl.signal, body: JSON.stringify({ message: summaryForAI(), history: [], context: { selectedAsset: state.symbol.replace('USDT', ''), asset: state.symbol.replace('USDT', ''), symbol: state.symbol, market: state.market, timeframe: state.interval } }) });
            clearTimeout(to);
            var data = await res.json().catch(function () { return {}; });
            if (!res.ok || !data.answer) {
                var msg = (data && (data.error || data.message)) || ('The AI service returned HTTP ' + res.status + '.');
                out.innerHTML = '<p class="lc-warning" style="display:block">' + esc(msg) + ' You can paste your own free Groq key on the <a href="ai">AI page</a> and try again.</p>';
            } else {
                out.innerHTML = '<div class="bt-ai-text">' + esc(data.answer).replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>') + '</div><p class="lc-note">AI commentary on your numbers, generated from the summary shown to the model. It can be wrong. Not financial advice.</p>';
            }
        } catch (e) {
            out.innerHTML = '<p class="lc-warning" style="display:block">' + esc(e && e.name === 'AbortError' ? 'The AI took too long. Try again.' : 'Could not reach the AI service. Check your connection and try again.') + '</p>';
        } finally { btn.disabled = false; }
    }

    /* ------------------------------ wiring ------------------------------ */
    function applyParsed(p) {
        if (!p || !p.strategy) { setStatus('Could not recognise a strategy in that sentence. Try: "buy when RSI is below 30, sell above 70" or "50/200 EMA crossover".', true); return; }
        $('bt-strategy').value = p.strategy;
        var d = B.defaultParams(p.strategy), k;
        for (k in p.params) if (Object.prototype.hasOwnProperty.call(p.params, k)) d[k] = p.params[k];
        renderParams(p.strategy, d);
        if (p.leverage) $('bt-lev').value = p.leverage;
        if (p.stop !== null) $('bt-stop').value = p.stop;
        if (p.target !== null) $('bt-tp').value = p.target;
        if (p.allowShort !== null) $('bt-short').checked = p.allowShort;
        setStatus('Set up: ' + B.STRATEGIES[p.strategy].label + (p.notes.length ? '. ' + p.notes.join(' ') : '') + ' Press Run backtest.');
    }

    var sel = $('bt-strategy'), opts = '';
    Object.keys(B.STRATEGIES).forEach(function (k) { opts += '<option value="' + k + '">' + esc(B.STRATEGIES[k].label) + '</option>'; });
    sel.innerHTML = opts; sel.value = 'sma_cross'; renderParams('sma_cross');
    sel.addEventListener('change', function () { renderParams(sel.value); });
    $('bt-run').addEventListener('click', run);
    $('bt-optimize').addEventListener('click', optimizeRun);
    $('bt-parse').addEventListener('click', function () { applyParsed(B.parseText($('bt-text').value)); });
    $('bt-ai').addEventListener('click', aiReview);
    $('bt-lev').addEventListener('input', function () {
        var l = num('bt-lev', 1), w = $('bt-lev-warn');
        w.textContent = l > 1 ? 'At ' + l + 'x a ' + (100 / l - 0.5).toFixed(1) + '% move against a position liquidates the account.' : '';
    });
})(typeof globalThis !== 'undefined' ? globalThis : this);