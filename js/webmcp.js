// ---------------------------------------------------------------------------
// WebMCP: exposes a few safe, read-only CryptoBolt tools to in-browser AI agents
// through navigator.modelContext (https://webmachinelearning.github.io/webmcp/).
// Browsers without WebMCP skip this file silently. Nothing here touches the
// user's account, keys or paper-trading data: it is calculators, a public
// Binance price lookup and page navigation to our own pages.
// Same maths as server/src/lib/trading-math.js (the MCP server at
// api.cryptobolt.io/mcp) and js/liquidation-calculator.js / trading-calculators.js.
// ---------------------------------------------------------------------------
(function () {
    'use strict';
    var mc = typeof navigator !== 'undefined' && navigator.modelContext;
    if (!mc) return;

    var PAGES = {
        home: '/', terminal: '/app.html', features: '/features.html', ai_research: '/ai.html',
        paper_trading: '/trade.html', bitcoin: '/bitcoin.html', ethereum: '/ethereum.html',
        solana: '/solana.html', calculators: '/crypto-calculators.html',
        liquidation_calculator: '/liquidation-price-calculator.html',
        position_size_calculator: '/position-size-calculator.html',
        profit_calculator: '/crypto-profit-calculator.html',
        funding_fee_calculator: '/funding-fee-calculator.html',
        glossary: '/glossary.html', blog: '/blog.html', releases: '/releases.html',
        about: '/about.html', contact: '/contact.html'
    };

    function ok(obj) { return { content: [{ type: 'text', text: JSON.stringify(obj) }] }; }
    function fail(msg) { return { isError: true, content: [{ type: 'text', text: msg }] }; }
    function num(v) { return typeof v === 'string' ? parseFloat(v) : v; }
    function r(n, d) { var k = Math.pow(10, d == null ? 2 : d); return Math.round(n * k) / k; }
    var SIDE = { type: 'string', enum: ['long', 'short'], description: 'Position direction.' };

    var tools = [
        {
            name: 'get_crypto_price',
            description: 'Get the live spot price and 24h change for a crypto pair from Binance public data, e.g. BTC, ETH or SOLUSDT.',
            inputSchema: {
                type: 'object',
                properties: { symbol: { type: 'string', description: 'Coin ticker like BTC or a pair like BTCUSDT (USDT is assumed if omitted).' } },
                required: ['symbol']
            },
            annotations: { readOnlyHint: true },
            execute: function (args) {
                var s = String((args && args.symbol) || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
                if (!s) return Promise.resolve(fail('symbol is required'));
                if (!/(USDT|USDC|BTC|ETH|BUSD|FDUSD)$/.test(s)) s += 'USDT';
                return fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=' + s)
                    .then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
                    .then(function (d) {
                        return ok({
                            symbol: d.symbol, price: parseFloat(d.lastPrice),
                            change_24h_pct: parseFloat(d.priceChangePercent),
                            high_24h: parseFloat(d.highPrice), low_24h: parseFloat(d.lowPrice),
                            quote_volume_24h: parseFloat(d.quoteVolume),
                            source: 'Binance public API', note: 'Market data, not financial advice.'
                        });
                    })
                    .catch(function (e) { return fail('Could not fetch ' + s + ': ' + e.message); });
            }
        },
        {
            name: 'calculate_liquidation_price',
            description: 'Estimate the liquidation price of an isolated-margin leveraged futures position (simplified model, same as the CryptoBolt liquidation calculator).',
            inputSchema: {
                type: 'object',
                properties: {
                    side: SIDE,
                    entry_price: { type: 'number', description: 'Entry price in USD.' },
                    leverage: { type: 'number', description: 'Leverage multiple, 1 or higher.' },
                    maintenance_margin_pct: { type: 'number', description: 'Maintenance margin rate in percent. Default 0.5.' }
                },
                required: ['side', 'entry_price', 'leverage']
            },
            annotations: { readOnlyHint: true },
            execute: function (a) {
                var entry = num(a.entry_price), lev = num(a.leverage);
                var mmr = (a.maintenance_margin_pct == null ? 0.5 : num(a.maintenance_margin_pct)) / 100;
                if (!(entry > 0) || !(lev >= 1) || !(mmr >= 0) || (a.side !== 'long' && a.side !== 'short')) return fail('Provide side (long/short), entry_price > 0 and leverage >= 1.');
                var cushion = 1 / lev - mmr, liq;
                if (cushion <= 0) liq = a.side === 'long' ? entry * 1.001 : entry * 0.999;
                else liq = a.side === 'long' ? entry * (1 - cushion) : entry * (1 + cushion);
                return ok({ liquidation_price: r(liq), distance_from_entry_pct: r(Math.abs(liq - entry) / entry * 100), model: 'simplified isolated margin' });
            }
        },
        {
            name: 'calculate_position_size',
            description: 'Turn account balance, risk percentage, entry and stop-loss into position size, notional, required margin and 1R/2R/3R targets.',
            inputSchema: {
                type: 'object',
                properties: {
                    side: SIDE,
                    balance: { type: 'number', description: 'Account balance in USD.' },
                    risk_pct: { type: 'number', description: 'Percent of balance to risk, e.g. 1.' },
                    entry_price: { type: 'number' }, stop_price: { type: 'number' },
                    leverage: { type: 'number', description: 'Default 1.' }
                },
                required: ['side', 'balance', 'risk_pct', 'entry_price', 'stop_price']
            },
            annotations: { readOnlyHint: true },
            execute: function (a) {
                var bal = num(a.balance), risk = num(a.risk_pct), entry = num(a.entry_price), stop = num(a.stop_price), lev = num(a.leverage);
                if (!(lev >= 1)) lev = 1;
                var dist = Math.abs(entry - stop);
                if (!(bal > 0) || !(risk > 0) || !(entry > 0) || !(stop > 0) || !(dist > 0)) return fail('Provide balance, risk_pct, entry_price and a stop_price different from entry.');
                var long = a.side === 'long';
                if ((long && stop > entry) || (!long && stop < entry)) return fail(long ? 'For a long, stop must be below entry.' : 'For a short, stop must be above entry.');
                var riskUsd = bal * risk / 100, qty = riskUsd / dist, notional = qty * entry, dir = long ? 1 : -1;
                return ok({
                    risk_usd: r(riskUsd), quantity: r(qty, 6), notional_usd: r(notional), margin_usd: r(notional / lev),
                    stop_distance_pct: r(dist / entry * 100),
                    targets: { '1R': r(entry + dir * dist), '2R': r(entry + dir * dist * 2), '3R': r(entry + dir * dist * 3) }
                });
            }
        },
        {
            name: 'calculate_futures_pnl',
            description: 'Net profit/loss, ROE and fees for a leveraged futures trade.',
            inputSchema: {
                type: 'object',
                properties: {
                    side: SIDE, entry_price: { type: 'number' }, exit_price: { type: 'number' },
                    margin: { type: 'number', description: 'Margin in USD.' }, leverage: { type: 'number' },
                    fee_pct: { type: 'number', description: 'Taker fee per side in percent. Default 0.05.' }
                },
                required: ['side', 'entry_price', 'exit_price', 'margin', 'leverage']
            },
            annotations: { readOnlyHint: true },
            execute: function (a) {
                var entry = num(a.entry_price), exit = num(a.exit_price), margin = num(a.margin), lev = num(a.leverage);
                var fee = (a.fee_pct == null ? 0.05 : num(a.fee_pct)) / 100;
                if (!(entry > 0) || !(exit > 0) || !(margin > 0) || !(lev >= 1) || !(fee >= 0)) return fail('Provide side, entry_price, exit_price, margin and leverage >= 1.');
                var dir = a.side === 'long' ? 1 : -1, notional = margin * lev, qty = notional / entry;
                var gross = qty * (exit - entry) * dir, fees = notional * fee + qty * exit * fee, net = gross - fees;
                return ok({ gross_pnl: r(gross), fees: r(fees), net_pnl: r(net), roe_pct: r(net / margin * 100), notional_usd: r(notional), quantity: r(qty, 6) });
            }
        },
        {
            name: 'estimate_funding_fee',
            description: 'Estimate what a perpetual futures position pays or receives in funding over a holding period.',
            inputSchema: {
                type: 'object',
                properties: {
                    side: SIDE, notional: { type: 'number', description: 'Position value in USD.' },
                    funding_rate_pct: { type: 'number', description: 'Funding rate per interval in percent, e.g. 0.01.' },
                    interval_hours: { type: 'number', description: 'Hours between funding payments. Default 8.' },
                    days: { type: 'number', description: 'Holding period in days.' }
                },
                required: ['side', 'notional', 'funding_rate_pct', 'days']
            },
            annotations: { readOnlyHint: true },
            execute: function (a) {
                var notional = num(a.notional), rate = num(a.funding_rate_pct) / 100, interval = a.interval_hours == null ? 8 : num(a.interval_hours), days = num(a.days);
                if (!(notional > 0) || !Number.isFinite(rate) || !(interval > 0) || !(days >= 0)) return fail('Provide side, notional, funding_rate_pct and days.');
                var perDay = 24 / interval, long = a.side === 'long';
                var sign = (long ? -1 : 1) * (rate >= 0 ? 1 : -1);
                var perPay = Math.abs(notional * rate), count = Math.floor(perDay * days + 1e-9);
                return ok({
                    total_usd: r(sign * perPay * count), payments: count, per_payment_usd: r(perPay),
                    per_day_usd: r(sign * perPay * perDay), annualised_rate_pct: r(Math.abs(rate) * perDay * 365 * 100),
                    direction: sign * perPay * count < 0 ? 'you pay' : (sign * perPay * count > 0 ? 'you receive' : 'none')
                });
            }
        },
        {
            name: 'open_cryptobolt_page',
            description: 'Navigate the browser to a page on cryptobolt.io: terminal, AI research, paper trading, coin pages, calculators, glossary and more.',
            inputSchema: {
                type: 'object',
                properties: { page: { type: 'string', enum: Object.keys(PAGES), description: 'Which page to open.' } },
                required: ['page']
            },
            execute: function (a) {
                var path = PAGES[a && a.page];
                if (!path) return fail('Unknown page. Choose one of: ' + Object.keys(PAGES).join(', '));
                window.location.assign(path);
                return ok({ navigating_to: 'https://cryptobolt.io' + path });
            }
        }
    ];

    try {
        if (typeof mc.registerTool === 'function') {
            tools.forEach(function (t) {
                try { mc.registerTool(t); } catch (e) { /* already registered on this page */ }
            });
        } else if (typeof mc.provideContext === 'function') {
            mc.provideContext({ tools: tools });
        }
    } catch (e) { /* WebMCP is optional */ }
})();