// Page definition for /crypto-backtester. All example numbers are produced by the real engine
// (js/backtest-lab.js) on seeded synthetic random-walk data, so they are reproducible and honest.
import { loadCalc } from './load-calc.mjs';

export function backtestPage(_build, h) {
  const { table, card, pct } = h;
  const B = loadCalc('js/backtest-lab.js', 'CBBacktest');
  const base = { fee: 0, slip: 0, leverage: 1, stop: 0, target: 0, allowShort: false, interval: '1d', split: 0.7 };
  const sgn = (x, d = 0) => (x >= 0 ? '+' : '') + (x * 100).toFixed(d) + '%';
  const neg = (x, t) => (x < 0 ? `<span class="lc-neg">${t}</span>` : t);

  // 1) costs on one synthetic series
  const cs = B.randomWalk(1500, 21, 0.0008, 0.025);
  const costRows = [[0, 0], [0.05, 0], [0.05, 0.02], [0.1, 0.05], [0.2, 0.1]].map(([fee, slip]) => {
    const r = B.runAll(cs, 'ema_cross', { fast: 12, slow: 26 }, { ...base, fee, slip });
    const m = r.full.m;
    return [`${fee}% fee, ${slip}% slippage`, String(m.trades), neg(m.totalReturn, sgn(m.totalReturn)), `${(m.trades * 2 * (fee + slip)).toFixed(1)}%`];
  });
  const free = B.runAll(cs, 'ema_cross', { fast: 12, slow: 26 }, base).full.m;
  const mid = B.runAll(cs, 'ema_cross', { fast: 12, slow: 26 }, { ...base, fee: 0.1, slip: 0.05 }).full.m;

  // 2) leverage
  const levRows = [1, 2, 3, 5, 10, 20].map((lev) => {
    const r = B.runAll(cs, 'ema_cross', { fast: 12, slow: 26 }, { ...base, fee: 0.05, slip: 0.02, leverage: lev });
    const m = r.full.m;
    return [`${lev}x`, neg(m.totalReturn, sgn(m.totalReturn)), `-${(m.maxDD * 100).toFixed(0)}%`, m.blown ? '<span class="lc-neg">Yes, account wiped out</span>' : 'No'];
  });

  // 3) optimiser on pure noise
  const N = 20; let sIn = 0, sOos = 0, sMed = 0, posIn = 0;
  const o0 = { ...base, fee: 0.05, slip: 0.02 };
  let demo = null;
  for (let seed = 1; seed <= N; seed++) {
    const w = B.randomWalk(2000, seed, 0, 0.015);
    const o = B.optimize(w, 'sma_cross', { fast: 10, slow: 40 }, 'fast', B.range(3, 30, 8).map(Math.round), 'slow', B.range(20, 120, 8).map(Math.round), o0);
    sIn += o.best.ins; sOos += o.best.oos; sMed += o.medianOos; if (o.best.ins > 0) posIn++;
    if (seed === 2) demo = o;
  }

  // 4) Monte Carlo on a realistic trend-following profile
  const mcTrades = []; for (let i = 0; i < 60; i++) mcTrades.push({ ret: (i * 7) % 10 < 4 ? 0.09 : -0.03 }); // 40% winners, 3:1 payoff
  const mc = B.monteCarlo(mcTrades, 1000, 20261125);
  const mcOrdered = (() => { let e = 1, peak = 1, dd = 0; for (const t of mcTrades) { e *= 1 + t.ret; peak = Math.max(peak, e); dd = Math.max(dd, (peak - e) / peak); } return { ret: e - 1, dd }; })();

  const css = '.lc-calc textarea{width:100%;box-sizing:border-box;background:rgba(10,12,16,.6);border:1px solid var(--mk-line,rgba(237,239,243,.08));border-radius:8px;padding:10px 12px;color:var(--mk-text,#EDEFF3);font-size:14px;font-family:inherit;resize:vertical}'
    + '.lc-calc .hidden{display:none !important}.lc-calc .bt-ok{background:rgba(34,197,140,.08);border-color:rgba(34,197,140,.3);color:#9fe3c8}'
    + '.lc-calc .bt-row{display:flex;flex-wrap:wrap;gap:10px;margin:16px 0 4px}.lc-calc .bt-btn{padding:11px 18px;border-radius:10px;border:1px solid rgba(34,197,140,.5);background:rgba(34,197,140,.14);color:var(--mk-green,#22C58C);font-weight:700;font-size:14px;cursor:pointer}'
    + '.lc-calc .bt-btn:disabled{opacity:.5;cursor:wait}.lc-calc .bt-btn.alt{background:transparent;border-color:var(--mk-line,rgba(237,239,243,.18));color:var(--mk-text,#EDEFF3)}'
    + '.lc-calc h2{margin:26px 0 6px;font-size:16px}.lc-calc .bt-check{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--mk-text-dim,#8B93A3);margin-top:12px}'
    + '.lc-calc .bt-ai-text{font-size:14px;line-height:1.6;margin-top:12px}.lc-calc #bt-verdict{margin:10px 0 0;padding-left:18px;font-size:14px;line-height:1.55}.lc-calc .lc-stats{grid-template-columns:repeat(3,minmax(0,1fr))}'
    + '@media (max-width:640px){.lc-calc .lc-stats{grid-template-columns:repeat(2,minmax(0,1fr))}}';

  const form = `    <div class="lc-calc" id="bt-app">
        <div class="lc-field"><label for="bt-text">Describe a strategy in plain English <span class="lc-hint">(optional; works offline, no AI key needed)</span></label>
            <textarea id="bt-text" rows="2" placeholder="e.g. buy when RSI is below 30 and sell above 70, 3x leverage, stop loss 4%"></textarea></div>
        <div class="bt-row"><button type="button" class="bt-btn alt" id="bt-parse">Set it up from my sentence</button></div>
        <h2>1. Market and data</h2>
        <div class="lc-grid">
            <div class="lc-field"><label for="bt-symbol">Coin</label><input type="text" id="bt-symbol" value="BTC" maxlength="12" autocomplete="off" spellcheck="false"></div>
            <div class="lc-field"><label for="bt-market">Market</label><select id="bt-market"><option value="spot">Spot (Binance)</option><option value="futures">USDT perpetual (Binance)</option></select></div>
            <div class="lc-field"><label for="bt-interval">Candle size</label><select id="bt-interval"><option value="1h">1 hour</option><option value="4h">4 hours</option><option value="1d" selected>1 day</option></select></div>
            <div class="lc-field"><label for="bt-bars">History length</label><select id="bt-bars"><option value="1000">1,000 candles</option><option value="2000">2,000 candles</option><option value="3000" selected>3,000 candles</option><option value="5000">5,000 candles</option></select></div>
        </div>
        <h2>2. Strategy</h2>
        <div class="lc-grid"><div class="lc-field"><label for="bt-strategy">Strategy</label><select id="bt-strategy"></select></div></div>
        <p class="lc-note" id="bt-strategy-desc"></p>
        <div class="lc-grid" id="bt-params"></div>
        <h2>3. Real-world costs and risk</h2>
${h.field('bt-lev', 'Leverage (x)', 1, ' min="1" max="125" step="1"', '(1 = no leverage)')}
        <p class="lc-note" id="bt-lev-warn" style="margin-top:4px"></p>
        <div class="lc-grid">
${h.field('bt-fee', 'Fee per side (%)', 0.05, ' min="0"', '(taker fee on entry and exit)')}
${h.field('bt-slip', 'Slippage per fill (%)', 0.02, ' min="0"')}
${h.field('bt-stop', 'Stop-loss (%)', 0, ' min="0"', '(0 = none)')}
${h.field('bt-tp', 'Take-profit (%)', 0, ' min="0"', '(0 = none)')}
        </div>
        <label class="bt-check"><input type="checkbox" id="bt-short"> Allow short trades (the strategy flips to short instead of going flat)</label>
        <div class="bt-row"><button type="button" class="bt-btn" id="bt-run">Run backtest</button></div>
        <div class="lc-warning" id="bt-status" role="status" aria-live="polite"></div>

        <div id="bt-results" class="hidden">
            <h2>Equity curve</h2>
            <div id="bt-chart"></div>
            <div class="lc-stats" id="bt-stats-full"></div>
            <h2>Does it survive out-of-sample?</h2>
            <div id="bt-stats-split"></div>
            <ul id="bt-verdict"></ul>
            <h2>Monte Carlo stress test</h2>
            <div id="bt-mc"></div>
            <h2>Trades</h2>
            <div id="bt-trades"></div>

            <h2>Parameter optimizer</h2>
            <p class="lc-note" style="margin-top:0">Tests 64 nearby settings on the first 70% of history only, then shows how each one did on the last 30%.</p>
            <div class="lc-grid">
                <div class="lc-field"><label for="bt-opt-a">First parameter (rows)</label><select id="bt-opt-a"></select></div>
                <div class="lc-field"><label for="bt-opt-b">Second parameter (columns)</label><select id="bt-opt-b"></select></div>
            </div>
            <div class="bt-row"><button type="button" class="bt-btn alt" id="bt-optimize">Run optimizer</button></div>
            <div id="bt-opt-wrap" class="hidden"><div id="bt-opt"></div></div>

            <div id="bt-ai-box" class="hidden">
                <h2>AI review of this backtest</h2>
                <p class="lc-note" style="margin-top:0">Sends only the numbers above (not your browser data) to the CryptoBolt AI, which critiques overfitting risk, regime dependence and cost sensitivity, and suggests the next tests. Uses your Groq key from the <a href="ai">AI page</a> if you saved one, otherwise CryptoBolt's shared key when available.</p>
                <div class="bt-row"><button type="button" class="bt-btn alt" id="bt-ai">Ask the AI to review it</button></div>
                <div id="bt-ai-out" class="hidden"></div>
            </div>
        </div>
        <noscript><p class="lc-note">The backtester needs JavaScript to download candles and run the simulation.</p></noscript>
        <p class="lc-note">Past results do not predict future results. Candles come directly from Binance’s public API in your browser; nothing you test is sent to CryptoBolt except the AI review, if you press it. Educational tool, not financial advice. <a href="crypto-paper-trading">Practice with virtual funds &rarr;</a></p>
    </div>`;

  const article = `    <h2>What makes this backtester different</h2>
    <p>Most free backtests show a smooth equity curve and one big number. That number is usually wrong in the direction you want it to be. This tool is built to argue against your strategy first:</p>
    <ul>
        <li><strong>No look-ahead.</strong> A signal is read at the close of a candle and filled at the <em>next</em> open. Reading a signal and filling at the same close is the most common reason a backtest looks too good.</li>
        <li><strong>Costs are on by default.</strong> A 0.05% fee and 0.02% slippage per side are pre-filled, because zero-cost backtests overstate every active strategy.</li>
        <li><strong>Leverage and liquidation are modelled.</strong> At 10x an adverse move of about 9.5% ends the account. The simulator checks every candle’s high and low, not just the close.</li>
        <li><strong>An out-of-sample test is automatic.</strong> The last 30% of history is held back and reported separately, next to buy and hold.</li>
        <li><strong>A Monte Carlo stress test</strong> reshuffles your trades 1,000 times to show how much of the result depended on the order they arrived in.</li>
        <li><strong>The optimizer shows you its own failure.</strong> It finds the best setting on the first 70% and then reveals what that setting did on the rest.</li>
    </ul>
    <h2>How to read the results</h2>
    <p>Start with the <strong>out-of-sample table</strong>, not the headline return. A strategy that makes money in the first 70% and loses money in the last 30% fit the past; it did not find an edge. Then check the <strong>trade count</strong>: under about 30 trades, a win rate or profit factor is mostly noise. Compare the <strong>max drawdown</strong> with what you could actually sit through, and compare the return with <strong>buy and hold</strong> over the same dates, because a trend strategy that earns less than holding with a deeper drawdown has no reason to exist.</p>
    <h2>Example 1: trading costs, on one reproducible series</h2>
    <p>The examples on this page run the real engine on a seeded synthetic price series (1,500 daily candles, 2.5% daily volatility, a small upward drift), so you can reproduce the numbers exactly. They are not real market data. The strategy is a 12/26 EMA crossover, long only, with no stop. Only the costs change:</p>
    ${table(['Costs per side', 'Trades', 'Total return', 'Rough cost drag (trades x round-trip cost)'], costRows)}
    <p>With no costs the same rules return ${sgn(free.totalReturn)}; with a 0.1% fee and 0.05% slippage they return ${sgn(mid.totalReturn)} on ${mid.trades} trades. The drag grows with the number of trades, which is why a strategy that looks fine on daily candles can be destroyed on 5-minute candles: it simply trades more often.</p>
    <h2>Example 2: what leverage does to the same strategy</h2>
    <p>Same series, same rules, costs at 0.05% fee and 0.02% slippage, only the leverage changes:</p>
    ${table(['Leverage', 'Total return', 'Max drawdown', 'Account liquidated?'], levRows)}
    <p>Leverage multiplies the drawdown as well as the gain, and past a certain point the question is no longer &ldquo;how much does it make&rdquo; but &ldquo;does it survive its worst candle&rdquo;. A stop-loss placed closer than the liquidation price keeps a leveraged account alive; check where yours sits with the <a href="liquidation-price-calculator">liquidation price calculator</a>.</p>
    <h2>Example 3: the optimizer will happily find a &ldquo;winner&rdquo; in pure noise</h2>
    <p>This is the experiment every trader should see once. We generated ${N} price series with <strong>zero drift and no pattern at all</strong> (a pure random walk), and for each one ran the optimizer over 64 SMA-crossover settings on the first 70%. The best in-sample setting averaged <strong>${sgn(sIn / N)}</strong>, and it was profitable in-sample on ${posIn} of ${N} series. On the unseen last 30% the same settings averaged <strong>${sgn(sOos / N)}</strong>, almost exactly the ${sgn(sMed / N)} that a typical setting made. The &ldquo;best&rdquo; setting had no edge at all; it was just the luckiest of 64 tries.</p>
    <p>One concrete case: on the second series the optimizer picked fast=${demo.best.a}, slow=${demo.best.b}, which made ${sgn(demo.best.ins)} in-sample and then ${sgn(demo.best.oos)} out-of-sample. On a real chart, the same thing happens whenever you tune parameters until the equity curve looks good. The defence is simple: only trust a setting that sits inside a block of neighbours that are also profitable, and that still works on the part of the history the optimizer never saw.</p>
    <h2>Example 4: Monte Carlo on a trend-following profile</h2>
    <p>Take a strategy that wins 40% of the time, makes +9% on a winner and loses 3% on a loser, over 60 trades. In the order it happened it returns ${sgn(mcOrdered.ret)} with a worst drawdown of ${(mcOrdered.dd * 100).toFixed(0)}%. Reshuffling those same 60 trades 1,000 times gives a median return of ${sgn(mc.ret.p50)} but a range from ${sgn(mc.ret.p5)} (worst 5% of runs) to ${sgn(mc.ret.p95)} (best 5%), and a median worst drawdown of ${(mc.dd.p50 * 100).toFixed(0)}%, with the severe end near ${(mc.dd.p95 * 100).toFixed(0)}%. The trades did not change, only their order. That spread is the part of a backtest that is luck, and it is the number to compare with your own risk tolerance. For the maths of losing streaks and ruin, see the <a href="losing-streak-calculator">losing streak calculator</a> and the <a href="risk-of-ruin-calculator">risk of ruin calculator</a>.</p>
    <h2>A checklist before you trust any backtest</h2>
    <ul>
        <li>Is the trade count above about 30, ideally above 100?</li>
        <li>Does it make money in <strong>both</strong> the first 70% and the last 30% of history?</li>
        <li>Does it beat buy and hold <strong>after</strong> costs, or at least match it with a much smaller drawdown?</li>
        <li>Do the neighbouring parameter values also work, or is it one lucky cell?</li>
        <li>Is the Monte Carlo worst-5% outcome something you could live with?</li>
        <li>If you use leverage, is your stop closer than your liquidation price?</li>
        <li>Have you tried a different coin and a different time window? An idea that only works on one chart is a coincidence.</li>
    </ul>
    <h2>What this backtester does not model</h2>
    <ul>
        <li><strong>Funding payments</strong> on perpetual futures, which cost or pay a few percent a year depending on the side. See the <a href="funding-fee-calculator">funding fee calculator</a>.</li>
        <li><strong>The order book.</strong> Fills happen at the open of the next candle plus your slippage setting; large orders on thin coins would fill worse.</li>
        <li><strong>Intrabar order.</strong> If a stop and a target are inside the same candle, the stop is assumed to hit first, which is the conservative choice.</li>
        <li><strong>Survivorship bias.</strong> You can only test coins that still trade. Coins that died are missing from every free dataset, including this one.</li>
        <li><strong>Taxes, borrowing costs and exchange-specific margin rules.</strong> Liquidation uses a simple isolated formula with a 0.5% maintenance margin.</li>
        <li><strong>The future.</strong> Markets change regime. A result describes how the rules would have behaved, not how they will.</li>
    </ul>
    <p>When a strategy survives all of that, the next step is to practise it with virtual money, where every trade is real in everything but cost. The <a href="crypto-paper-trading">paper trading simulator</a> is built for that, and the position size for each trade can come from the <a href="position-size-calculator">position size calculator</a>.</p>`;

  const faq = [
    ['Is this crypto backtester really free?', 'Yes. There is no account, no limit on runs and no paywall. The candles are downloaded straight from Binance’s public API in your browser, and the simulation runs locally on your device. The optional AI review uses CryptoBolt’s shared AI key or your own free Groq key.'],
    ['How many years of history can I test?', 'You can load up to 5,000 candles per run. That is about 13.7 years of daily candles, about 208 days of hourly candles, or about 2.3 years of 4-hour candles, limited by how long the coin has been listed on Binance. Use daily candles for long-term ideas and hourly or 4-hour candles when you need many trades.'],
    ['What does out-of-sample mean?', 'The first 70% of the candles are the in-sample part, where you design and tune a strategy. The last 30% are held back and used only to check it. If the strategy makes money in-sample but loses money out-of-sample, it was fitted to noise in the past rather than catching something that repeats.'],
    ['Why does the backtest fill at the next open instead of the close?', 'A candle is only known to be closed once it has finished, so a rule that reads the close can only act after it. Filling at that same close assumes you traded at a price you could not have known in time. This tool reads the signal at the close and fills at the next candle’s open, plus slippage, which is the realistic version.'],
    ['Does it include funding fees and liquidation?', 'Liquidation is modelled: with leverage, an adverse move of about 1 divided by leverage, minus a 0.5% maintenance margin, wipes out the account, and it is checked against every candle’s high and low. Funding payments are not modelled, so long-held leveraged perpetual positions will look slightly better here than in real life.'],
    ['Can a good backtest still lose money live?', 'Yes. Fees, slippage and funding can differ from your assumptions, the market regime can change, and a strategy tuned on past data can simply be an accident of that data. A good backtest is a reason to test the strategy further with paper trading, not a reason to risk real money.']
  ];

  return {
    slug: 'crypto-backtester',
    name: 'Crypto backtester',
    title: 'Free Crypto Backtester (Fees, Leverage & Monte Carlo)',
    desc: 'Free crypto backtester with fees, leverage and liquidation, an automatic out-of-sample test, optimizer, Monte Carlo and AI review. No signup.',
    ldDesc: 'Free browser-based crypto strategy backtester using Binance candles: moving-average, MACD, RSI, Bollinger and breakout strategies with fees, slippage, leverage, liquidation, stop-loss, out-of-sample validation, parameter optimization, Monte Carlo stress test and AI review.',
    keywords: 'crypto backtester, free crypto backtesting tool, backtest crypto strategy, bitcoin backtester, backtest rsi strategy crypto, backtest leverage liquidation, monte carlo backtest crypto, crypto strategy tester, out of sample backtest, backtest ema crossover crypto',
    ogAlt: 'CryptoBolt free crypto backtester',
    eyebrow: 'Free tool · No signup · Runs in your browser',
    h1: 'Free crypto backtester',
    lead: 'Test a trading strategy on real Binance candles with fees, slippage, leverage and liquidation, then see whether it survives data it never saw, a Monte Carlo reshuffle and an optimizer that tries to fool you.',
    checked: 'November 25, 2026',
    js: 'backtest-lab.js',
    faqTitle: 'Crypto backtester FAQ',
    faq,
    form,
    css,
    article,
    related: [
      card('crypto-calculators', 'calculator', 'Hub', 'All crypto calculators', 'Every free CryptoBolt calculator in one place.'),
      card('risk-of-ruin-calculator', 'calculator', 'Calculator', 'Risk of ruin calculator', 'How likely a strategy is to blow up an account.'),
      card('losing-streak-calculator', 'calculator', 'Calculator', 'Losing streak calculator', 'How long a losing run to expect.'),
      card('crypto-paper-trading', 'target', 'Practice', 'Crypto paper trading', 'Try the strategy with virtual funds.')
    ]
  };
}