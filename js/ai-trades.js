/* =========================================================
   CryptoBolt AI x Paper Trades
   Lets the AI chat on ai.html see the visitor's PRACTICE account (kept in this browser's
   localStorage by the Trading Account page, js/16-paper-trading.js) and lets them apply
   changes the AI proposes — only after they click Confirm on a card.

   Everything here is virtual money. The pure logic lives in one object (cwAiTrades) with no
   DOM access so test/ai-trades.test.js can load this exact file and check it against the real
   trade-page formulas. The few formulas duplicated from 16-paper-trading.js (P&L, slippage,
   liquidation shift, fee rate) are locked to it by that test, so they can't silently drift.
   ========================================================= */

(function (root) {
    "use strict";

    // Same value as FEE_RATE inside js/16-paper-trading.js (0.10% per side).
    const FEE_RATE = 0.001;
    const PT_MIN_SLIPPAGE_BPS = 2;
    const PT_SLIPPAGE_REF_NOTIONAL_USD = 5000;
    const PT_MAX_SLIPPAGE_BPS = 150;

    const MAX_CLOSED_FOR_AI = 15;

    /* -----------------------------
       Storage
    ----------------------------- */

    function safeParse(str, fallback) {
        try {
            const val = JSON.parse(str);
            return val === null || val === undefined ? fallback : val;
        } catch (e) {
            return fallback;
        }
    }

    function readState(storage) {
        const get = (k, fb) => safeParse(storage.getItem(k), fb);
        const arr = (v) => (Array.isArray(v) ? v : []);
        return {
            cash: get("cw_paper_cash", null),
            totalDeposited: get("cw_paper_deposited", null),
            holdings: arr(get("cw_paper_holdings", [])),
            trades: arr(get("cw_paper_trades", [])),
            pendingOrders: arr(get("cw_paper_orders", [])),
            futuresPositions: arr(get("cw_paper_futures", [])),
        };
    }

    // Only writes the keys an action can change; leaves equity curve etc. to the trade page.
    function persistState(state, storage, keys) {
        const map = {
            cash: "cw_paper_cash",
            holdings: "cw_paper_holdings",
            trades: "cw_paper_trades",
            pendingOrders: "cw_paper_orders",
            futuresPositions: "cw_paper_futures",
        };
        keys.forEach((k) => storage.setItem(map[k], JSON.stringify(state[k])));
    }

    function hasActivity(state) {
        return (
            state.futuresPositions.length +
                state.holdings.length +
                state.pendingOrders.length +
                state.trades.length >
            0
        );
    }

    function neededSymbols(state) {
        const set = new Set();
        state.futuresPositions.forEach((p) => p.symbol && set.add(p.symbol));
        state.holdings.forEach((h) => h.symbol && set.add(h.symbol));
        state.pendingOrders.forEach((o) => o.symbol && set.add(o.symbol));
        return Array.from(set);
    }

    /* -----------------------------
       Formulas shared with the trade page (parity-tested)
    ----------------------------- */

    function futuresPnl(position, markPrice) {
        return position.side === "long"
            ? (markPrice - position.entryPrice) * position.qty
            : (position.entryPrice - markPrice) * position.qty;
    }

    function effectiveLiqPrice(side, liqPrice, qty, fundingPaid) {
        if (!fundingPaid || !(qty > 0)) return liqPrice;
        const shift = fundingPaid / qty;
        return side === "long" ? liqPrice + shift : liqPrice - shift;
    }

    function computeSlippageBps(notionalUsd) {
        if (!(notionalUsd > 0)) return PT_MIN_SLIPPAGE_BPS;
        const scaled = PT_MIN_SLIPPAGE_BPS * Math.sqrt(notionalUsd / PT_SLIPPAGE_REF_NOTIONAL_USD);
        return Math.min(PT_MAX_SLIPPAGE_BPS, Math.max(PT_MIN_SLIPPAGE_BPS, scaled));
    }

    function estimateFillPrice(side, referencePrice, bid, ask, notionalUsd) {
        const slippageBps = computeSlippageBps(notionalUsd);
        const baseline = side === "buy" ? (ask && ask > 0 ? ask : referencePrice) : bid && bid > 0 ? bid : referencePrice;
        if (!baseline) return baseline;
        const slip = baseline * (slippageBps / 10000);
        return side === "buy" ? baseline + slip : Math.max(0, baseline - slip);
    }

    /* -----------------------------
       Snapshot sent to the AI
       quotes: { BTC: { price, bid, ask } }
    ----------------------------- */

    const round = (n, dp = 6) => (Number.isFinite(n) ? Number(n.toFixed(dp)) : null);
    const isClosing = (t) => t.side === "sell" || ["close", "tp", "sl", "liquidated"].includes(t.type);

    function buildTradesContext(state, quotes, now) {
        now = now || Date.now();
        const price = (sym) => (quotes[sym] && quotes[sym].price) || null;
        const hoursAgo = (ts) => (Number.isFinite(ts) ? round((now - ts) / 3600000, 1) : null);

        let unrealizedTotal = 0;
        let marginTotal = 0;

        const futuresPositions = state.futuresPositions.map((p) => {
            const mark = price(p.symbol);
            const funding = p.fundingPaid || 0;
            const unrealized = mark ? futuresPnl(p, mark) - funding : null;
            const liq = effectiveLiqPrice(p.side, p.liqPrice, p.qty, p.fundingPaid);
            if (unrealized !== null) unrealizedTotal += unrealized;
            marginTotal += p.margin || 0;
            return {
                id: p.id,
                symbol: p.symbol,
                side: p.side,
                leverage: p.leverage,
                entryPrice: p.entryPrice,
                qty: p.qty,
                margin: round(p.margin, 2),
                notional: round(p.notional, 2),
                liqPrice: round(liq),
                tpPrice: p.tpPrice || null,
                slPrice: p.slPrice || null,
                markPrice: mark,
                unrealizedPnl: unrealized === null ? null : round(unrealized, 2),
                pnlPctOnMargin: unrealized !== null && p.margin > 0 ? round((unrealized / p.margin) * 100, 1) : null,
                distanceToLiqPct: mark
                    ? round((p.side === "long" ? (mark - liq) / mark : (liq - mark) / mark) * 100, 2)
                    : null,
                fundingPaid: round(funding, 4),
                ageHours: hoursAgo(p.ts),
            };
        });

        const holdings = state.holdings.map((h) => {
            const mark = price(h.symbol);
            const unrealized = mark ? (mark - h.avgCost) * h.qty : null;
            if (unrealized !== null) unrealizedTotal += unrealized;
            return {
                symbol: h.symbol,
                qty: h.qty,
                avgCost: h.avgCost,
                markPrice: mark,
                unrealizedPnl: unrealized === null ? null : round(unrealized, 2),
                tpPrice: h.tpPrice || null,
                slPrice: h.slPrice || null,
            };
        });

        const pendingOrders = state.pendingOrders.map((o) => {
            const mark = price(o.symbol);
            return {
                id: o.id,
                symbol: o.symbol,
                side: o.side,
                qty: o.qty,
                limitPrice: o.limitPrice,
                distancePct: mark ? round(((o.limitPrice - mark) / mark) * 100, 2) : null,
            };
        });

        const closed = state.trades.filter(isClosing);
        const pnls = closed.map((t) => t.realizedPnl || 0);
        const wins = pnls.filter((x) => x > 0);
        const losses = pnls.filter((x) => x < 0);
        const stats = {
            closedCount: closed.length,
            wins: wins.length,
            losses: losses.length,
            winRate: closed.length ? round((wins.length / closed.length) * 100, 1) : null,
            avgWin: wins.length ? round(wins.reduce((a, b) => a + b, 0) / wins.length, 2) : null,
            avgLoss: losses.length ? round(-losses.reduce((a, b) => a + b, 0) / losses.length, 2) : null,
            expectancy: closed.length ? round(pnls.reduce((a, b) => a + b, 0) / closed.length, 2) : null,
        };

        const recentClosedTrades = closed.slice(0, MAX_CLOSED_FOR_AI).map((t) => ({
            symbol: t.symbol,
            side: t.side,
            type: t.type,
            leverage: t.leverage || null,
            realizedPnl: round(t.realizedPnl || 0, 2),
            fee: round(t.fee || 0, 2),
            ageHours: hoursAgo(t.ts),
        }));

        // Spot holdings valued at market, plus futures margin and unrealized P&L, on top of cash.
        const spotValue = state.holdings.reduce((sum, h) => sum + (price(h.symbol) || h.avgCost) * h.qty, 0);
        const equity = (state.cash || 0) + spotValue + marginTotal +
            state.futuresPositions.reduce((sum, p) => {
                const mark = price(p.symbol);
                return sum + (mark ? futuresPnl(p, mark) - (p.fundingPaid || 0) : 0);
            }, 0);

        return {
            account: {
                cash: round(state.cash, 2),
                totalDeposited: round(state.totalDeposited, 2),
                equity: round(equity, 2),
                unrealizedPnl: round(unrealizedTotal, 2),
            },
            stats,
            futuresPositions,
            holdings,
            pendingOrders,
            recentClosedTrades,
        };
    }

    /* -----------------------------
       Actions: validate + preview + apply
       action: as returned by /api/ai-chat (already shape-checked server-side, re-checked here
       against the CURRENT account state and live prices at the moment the user confirms).
    ----------------------------- */

    const fmtUsd = (n) =>
        `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const fmtPrice = (n) => (n < 1 ? n.toFixed(6) : n.toLocaleString("en-US", { maximumFractionDigits: 2 }));
    const fail = (error) => ({ ok: false, error });

    function checkTpSl(dir, mark, tp, sl, liq) {
        const long = dir === "long";
        if (tp !== undefined && tp !== null) {
            if (long && tp <= mark) return "Take profit must be above the current price for a long.";
            if (!long && tp >= mark) return "Take profit must be below the current price for a short.";
        }
        if (sl !== undefined && sl !== null) {
            if (long && sl >= mark) return "Stop loss must be below the current price for a long.";
            if (!long && sl <= mark) return "Stop loss must be above the current price for a short.";
            if (liq) {
                if (long && sl <= liq) return "Stop loss would sit at or beyond the liquidation price, so it could never trigger first.";
                if (!long && sl >= liq) return "Stop loss would sit at or beyond the liquidation price, so it could never trigger first.";
            }
        }
        return null;
    }

    function planClose(p, quote) {
        const live = quote && quote.price;
        if (!live) return null;
        const liq = effectiveLiqPrice(p.side, p.liqPrice, p.qty, p.fundingPaid);
        if ((p.side === "long" && live <= liq) || (p.side === "short" && live >= liq)) {
            return { liquidated: true };
        }
        const bid = quote.bid || live;
        const ask = quote.ask || live;
        const fillPrice = estimateFillPrice(p.side === "long" ? "sell" : "buy", live, bid, ask, p.notional);
        const pnl = futuresPnl(p, fillPrice);
        const closeNotional = p.qty * fillPrice;
        const fee = closeNotional * FEE_RATE;
        const funding = p.fundingPaid || 0;
        const netPnl = pnl - fee - funding;
        return { fillPrice, closeNotional, fee, funding, netPnl, proceeds: Math.max(0, p.margin + netPnl) };
    }

    // Returns { ok:true, title, detail } or { ok:false, error }.
    function previewAction(state, action, quotes) {
        if (!action || typeof action !== "object") return fail("Unknown action.");

        if (action.type === "cancel_order") {
            const o = state.pendingOrders.find((x) => x.id === action.id);
            if (!o) return fail("That order no longer exists.");
            return {
                ok: true,
                title: `Cancel ${o.side} limit order — ${o.symbol}`,
                detail: `${o.qty} ${o.symbol} at $${fmtPrice(o.limitPrice)}. No cash is reserved for pending orders, so nothing else changes.`,
            };
        }

        if (action.type === "close_futures") {
            const p = state.futuresPositions.find((x) => x.id === action.id);
            if (!p) return fail("That position no longer exists.");
            const plan = planClose(p, quotes[p.symbol]);
            if (!plan) return fail("Live price unavailable right now — try again in a moment.");
            if (plan.liquidated) return fail("This position is at or past its liquidation price. Open the Trading Account page to settle it.");
            return {
                ok: true,
                title: `Close ${p.leverage}x ${p.side.toUpperCase()} ${p.symbol}`,
                detail: `Market close at about $${fmtPrice(plan.fillPrice)}. Estimated result after fees and funding: ${plan.netPnl >= 0 ? "+" : ""}${fmtUsd(plan.netPnl)}.`,
            };
        }

        if (action.type === "set_tp_sl") {
            const parts = [];
            let name;
            if (action.market === "futures") {
                const p = state.futuresPositions.find((x) => x.id === action.id);
                if (!p) return fail("That position no longer exists.");
                const q = quotes[p.symbol];
                if (!q || !q.price) return fail("Live price unavailable right now — try again in a moment.");
                const liq = effectiveLiqPrice(p.side, p.liqPrice, p.qty, p.fundingPaid);
                const err = checkTpSl(p.side, q.price, action.tpPrice, action.slPrice, liq);
                if (err) return fail(err);
                name = `${p.leverage}x ${p.side.toUpperCase()} ${p.symbol}`;
            } else if (action.market === "spot") {
                const h = state.holdings.find((x) => x.symbol === action.symbol);
                if (!h) return fail("That holding no longer exists.");
                const q = quotes[h.symbol];
                if (!q || !q.price) return fail("Live price unavailable right now — try again in a moment.");
                const err = checkTpSl("long", q.price, action.tpPrice, action.slPrice, null);
                if (err) return fail(err);
                name = `${h.symbol} spot holding`;
            } else {
                return fail("Unknown market.");
            }
            if (action.tpPrice !== undefined) parts.push(action.tpPrice === null ? "remove take profit" : `take profit $${fmtPrice(action.tpPrice)}`);
            if (action.slPrice !== undefined) parts.push(action.slPrice === null ? "remove stop loss" : `stop loss $${fmtPrice(action.slPrice)}`);
            if (!parts.length) return fail("Nothing to change.");
            return { ok: true, title: `Update exits on ${name}`, detail: `Set: ${parts.join(", ")}.` };
        }

        return fail("Unknown action.");
    }

    // Mutates `state` (pass a fresh readState()) and returns { ok, message, changed:[keys] }.
    // Always re-validates through previewAction first, so a stale card can never do something
    // the current account/prices wouldn't allow.
    function applyAction(state, action, quotes, now) {
        now = now || Date.now();
        const check = previewAction(state, action, quotes);
        if (!check.ok) return { ok: false, error: check.error };

        if (action.type === "cancel_order") {
            state.pendingOrders = state.pendingOrders.filter((o) => o.id !== action.id);
            return { ok: true, message: "Order cancelled.", changed: ["pendingOrders"] };
        }

        if (action.type === "set_tp_sl") {
            const target =
                action.market === "futures"
                    ? state.futuresPositions.find((x) => x.id === action.id)
                    : state.holdings.find((x) => x.symbol === action.symbol);
            if (action.tpPrice !== undefined) target.tpPrice = action.tpPrice;
            if (action.slPrice !== undefined) target.slPrice = action.slPrice;
            return {
                ok: true,
                message: "Take-profit / stop-loss updated.",
                changed: [action.market === "futures" ? "futuresPositions" : "holdings"],
            };
        }

        if (action.type === "close_futures") {
            const p = state.futuresPositions.find((x) => x.id === action.id);
            const plan = planClose(p, quotes[p.symbol]);
            state.cash = (state.cash || 0) + plan.proceeds;
            state.futuresPositions = state.futuresPositions.filter((x) => x.id !== p.id);
            state.trades.unshift({
                id: `${p.id}_close_${now}`,
                ts: now,
                symbol: p.symbol,
                side: p.side,
                type: "close",
                qty: p.qty,
                price: plan.fillPrice,
                value: plan.closeNotional,
                fee: plan.fee,
                funding: plan.funding,
                realizedPnl: plan.netPnl,
                leverage: p.leverage,
            });
            return {
                ok: true,
                message: `Closed ${p.leverage}x ${p.side.toUpperCase()} ${p.symbol} (${plan.netPnl >= 0 ? "+" : ""}${fmtUsd(plan.netPnl)}).`,
                changed: ["cash", "futuresPositions", "trades"],
            };
        }

        return { ok: false, error: "Unknown action." };
    }

    /* -----------------------------
       Live quotes (browser only)
    ----------------------------- */

    async function fetchQuotes(symbols) {
        const out = {};
        if (!symbols.length || typeof fetch !== "function") return out;
        const param = encodeURIComponent(JSON.stringify(symbols.map((s) => `${s}USDT`)));
        const get = async (path) => {
            const ctrl = new AbortController();
            const t = setTimeout(() => ctrl.abort(), 9000);
            try {
                const res = await fetch(`https://api.binance.com/api/v3/ticker/${path}?symbols=${param}`, { signal: ctrl.signal });
                return res.ok ? await res.json() : [];
            } catch (e) {
                return [];
            } finally {
                clearTimeout(t);
            }
        };
        const [prices, books] = await Promise.all([get("price"), get("bookTicker")]);
        (Array.isArray(prices) ? prices : []).forEach((r) => {
            if (r.symbol && r.symbol.endsWith("USDT")) {
                out[r.symbol.replace(/USDT$/, "")] = { price: parseFloat(r.price) || 0 };
            }
        });
        (Array.isArray(books) ? books : []).forEach((r) => {
            const base = r.symbol && r.symbol.endsWith("USDT") ? r.symbol.replace(/USDT$/, "") : null;
            if (base && out[base]) {
                out[base].bid = parseFloat(r.bidPrice) || 0;
                out[base].ask = parseFloat(r.askPrice) || 0;
            }
        });
        return out;
    }

    root.cwAiTrades = {
        readState,
        persistState,
        hasActivity,
        neededSymbols,
        fetchQuotes,
        buildTradesContext,
        previewAction,
        applyAction,
        // exposed for parity tests
        _math: { FEE_RATE, futuresPnl, effectiveLiqPrice, computeSlippageBps, estimateFillPrice },
    };
})(typeof window !== "undefined" ? window : globalThis);