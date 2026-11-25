// Generates grid-bot-profit-calculator.html and dca-bot-safety-order-calculator.html from the
// Hyperliquid calculator page (same head, nav, footer, styles) and fills the example tables by
// running the real calculator code, so the numbers on the page always match the tool.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCalc } from './load-calc.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATE = fs.readFileSync(path.join(ROOT, 'hyperliquid-position-size-calculator.html'), 'utf8').replace(/\r\n/g, '\n');
const grid = loadCalc('js/grid-bot.js', 'CBGrid');
const dca = loadCalc('js/dca-bot.js', 'CBDcaBot');
const DATE = '2026-11-25';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const usd = (n) => (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (n, d = 2) => n.toFixed(d) + '%';
const px = (n) => '$' + n.toLocaleString('en-US', { maximumFractionDigits: n >= 10 ? 2 : 4 });
const table = (head, rows) => `<div class="lc-tbl-wrap"><table>\n<thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead>\n<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>\n</table></div>`;

function card(href, icon, kind, title, text) {
  return `        <a href="${href}" class="mk-blog-card">
            <div class="mk-blog-cover" style="background:rgba(34,197,140,.08);"><i data-lucide="${icon}" width="26" height="26" stroke-width="1.8"></i></div>
            <div class="mk-blog-body">
                <span class="mk-blog-meta">${kind}</span>
                <h3>${title}</h3>
                <p>${text}</p>
                <span class="mk-blog-read">Open <i data-lucide="arrow-right" class="mk-btn-icon" width="13" height="13" stroke-width="2.4"></i></span>
            </div>
        </a>`;
}
const faqHtml = (faq) => faq.map(([q, a]) => `        <div class="mk-card mk-span-2">
            <h3>${esc(q)}</h3>
            <p>${esc(a)}</p>
        </div>`).join('\n');
const ld = (o) => '<script type="application/ld+json">\n' + JSON.stringify(o, null, 2) + '\n    </script>';

function build(p) {
  let h = TEMPLATE;
  const url = `https://cryptobolt.io/${p.slug}`;
  const og = `https://cryptobolt.io/assets/og/${p.slug}.png`;
  const rep = (re, v) => { if (!re.test(h)) throw new Error('template miss: ' + re); h = h.replace(re, () => v); };
  rep(/<title>.*?<\/title>/, `<title>${esc(p.title)}</title>`);
  rep(/<meta name="description" content=".*?">/, `<meta name="description" content="${esc(p.desc)}">`);
  rep(/<meta name="keywords" content=".*?">/, `<meta name="keywords" content="${esc(p.keywords)}">`);
  rep(/<link rel="canonical" href=".*?">/, `<link rel="canonical" href="${url}">`);
  rep(/<link rel="alternate" hreflang="en" href=".*?">/, `<link rel="alternate" hreflang="en" href="${url}">`);
  rep(/<link rel="alternate" hreflang="x-default" href=".*?">/, `<link rel="alternate" hreflang="x-default" href="${url}">`);
  rep(/<meta property="og:url" content=".*?">/, `<meta property="og:url" content="${url}">`);
  rep(/<meta property="og:title" content=".*?">/, `<meta property="og:title" content="${esc(p.title)}">`);
  rep(/<meta property="og:description" content=".*?">/, `<meta property="og:description" content="${esc(p.desc)}">`);
  rep(/<meta property="og:image" content=".*?">/, `<meta property="og:image" content="${og}">`);
  rep(/<meta property="og:image:alt" content=".*?">/, `<meta property="og:image:alt" content="${esc(p.ogAlt)}">`);
  rep(/<meta name="twitter:title" content=".*?">/, `<meta name="twitter:title" content="${esc(p.title)}">`);
  rep(/<meta name="twitter:description" content=".*?">/, `<meta name="twitter:description" content="${esc(p.desc)}">`);
  rep(/<meta name="twitter:image" content=".*?">/, `<meta name="twitter:image" content="${og}">`);
  rep(/<meta name="twitter:image:alt" content=".*?">/, `<meta name="twitter:image:alt" content="${esc(p.ogAlt)}">`);

  rep(/<\/style>/, '.lc-calc .lc-tbl-wrap table{width:100%;border-collapse:collapse;font-size:13px;margin-top:6px}.lc-calc .lc-tbl-wrap th,.lc-calc .lc-tbl-wrap td{padding:8px 10px;white-space:nowrap;text-align:left;border-bottom:1px solid var(--mk-line,rgba(237,239,243,.08))}.lc-calc .lc-tbl-wrap th{color:var(--mk-text-dim,#8B93A3);font-weight:600}' + (p.css || '') + '</style>');
  // JSON-LD: replace the first three blocks (WebApplication, FAQPage, BreadcrumbList), keep Organization.
  const marker = '<script type="application/ld+json">';
  const parts = h.split(marker);
  if (parts.length < 5) throw new Error('unexpected ld+json count');
  const tail = (s) => s.slice(s.indexOf('</script>') + '</script>'.length);
  const webapp = ld({ '@context': 'https://schema.org', '@type': ['WebPage', 'WebApplication'], name: p.name, url, description: p.ldDesc,
    applicationCategory: 'FinanceApplication', operatingSystem: 'Any', isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, inLanguage: 'en', dateModified: DATE,
    isPartOf: { '@id': 'https://cryptobolt.io/#website' }, publisher: { '@id': 'https://cryptobolt.io/#organization' } });
  const faq = ld({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: p.faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) });
  const crumbs = ld({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'CryptoBolt', item: 'https://cryptobolt.io/' },
    { '@type': 'ListItem', position: 2, name: 'Crypto calculators', item: 'https://cryptobolt.io/crypto-calculators' },
    { '@type': 'ListItem', position: 3, name: p.name, item: url }] });
  h = parts[0] + webapp.replace(marker, '') .replace(/^/, marker) + tail(parts[1]) + marker + faq.replace(marker, '') + tail(parts[2]) + marker + crumbs.replace(marker, '') + tail(parts[3]) + marker + parts.slice(4).join(marker);

  // body
  const a = h.indexOf('<header class="mk-fhero">');
  const b = h.indexOf('</main>');
  const body = `<header class="mk-fhero">
    <span class="mk-eyebrow">${p.eyebrow}</span>
    <h1>${p.h1}</h1>
    <p>${p.lead}</p>
</header>

<p class="lc-meta">Written and checked by the CryptoBolt founder · Formulas tested against worked examples on ${p.checked} · <a href="editorial-policy">How we build and check our tools</a></p>

<section class="mk-section" id="calculator">
${p.form}
</section>

<article class="mk-article" id="guide">
${p.article}
</article>

<section class="mk-section" id="faq">
    <div class="mk-section-head">
        <span class="mk-eyebrow">FAQ</span>
        <h2>${p.faqTitle}</h2>
    </div>
    <div class="mk-bento">
${faqHtml(p.faq)}
    </div>
</section>

<section class="mk-section" aria-labelledby="related-heading">
    <div class="mk-section-head">
        <span class="mk-eyebrow">Keep going</span>
        <h2 id="related-heading">Related calculators and guides</h2>
    </div>
    <div class="mk-blog-grid">
${p.related.join('\n')}
    </div>
</section>

`;
  h = h.slice(0, a) + body + h.slice(b);
  rep(/<script src="js\/hyperliquid-calculator\.js\?v=\d+" defer><\/script>/, `<script src="js/${p.js}?v=20261125" defer></script>`);
  return h;
}

const field = (id, label, value, extra = '', hint = '') =>
  `            <div class="lc-field"><label for="${id}">${label}${hint ? ` <span class="lc-hint">${hint}</span>` : ''}</label><input type="number" id="${id}" inputmode="decimal" step="any" value="${value}"${extra}></div>`;

/* ------------------------------------------------------------------ GRID */
const g0 = { lower: 50000, upper: 70000, grids: 20, invest: 10000, price: 60000, fee: 0.1, mode: 'arithmetic', cyclesPerDay: 3 };
const gr = grid.compute(g0);
const geo = grid.compute({ ...g0, mode: 'geometric' });

const gridCounts = [5, 10, 20, 50, 100, 200].map((n) => {
  const r = grid.compute({ ...g0, mode: 'geometric', grids: n });
  return [String(n), pct(r.stepLow), pct(r.minNetPct), usd(r.orderValue), usd(r.avgNet), usd(r.sumNet)];
});
const feeRows = [0.02, 0.05, 0.1, 0.2].map((f) => {
  const be = ((1 + f / 100) / (1 - f / 100) - 1) * 100;
  const step = (1.003) * (1 + f / 100) / (1 - f / 100);
  const n = Math.floor(Math.log(70000 / 50000) / Math.log(step));
  return [pct(f), pct(be, 3), String(n)];
});
const scenRows = gr.scen.map((s, i) => [['10% below the range ($45,000)', 'Bottom of range ($50,000)', 'Start price ($60,000)', 'Top of range ($70,000)', '10% above the range ($77,000)'][i],
  usd(s.value), `<span${s.pnl < 0 ? ' class="lc-neg"' : ''}>${usd(s.pnl)}</span>`, usd(s.hodl), usd(s.hodl - g0.invest)]);

const gridFaq = [
  ['How do you calculate grid bot profit?', 'Each completed grid cycle earns the quantity per grid times the price step, minus the fee on the buy and the sell. In a geometric grid the net profit per cycle is the price step as a percentage, reduced by the fee on both legs. Total profit is the number of completed cycles times that amount, plus or minus the change in value of the coin the bot is holding.'],
  ['How many grids should a grid bot have?', 'Enough that every grid step is clearly larger than the round-trip fees, and few enough that each order stays above the exchange minimum. More grids give smaller profit per cycle but more cycles. With a 0.1% fee per side, a grid step has to be above about 0.2% just to break even, and most traders want a margin well above that.'],
  ['Can a grid bot lose money?', 'Yes. If the price falls below the bottom of the range, the bot is left holding coins bought on the way down, and the unrealised loss can be larger than all the grid profit collected. If the price rises above the top, the bot has sold everything and stops earning while the coin keeps rising.'],
  ['What is the difference between an arithmetic and a geometric grid?', 'An arithmetic grid uses the same price distance between lines, so the percentage step is larger at the bottom and smaller at the top. A geometric grid uses the same percentage between lines, so each cycle earns about the same percentage. Geometric grids suit wide ranges, arithmetic grids suit tight ranges.'],
  ['Is the daily profit estimate a forecast?', 'No. The calculator multiplies the net profit of an average cycle by the number of cycles per day that you type in. How many cycles actually complete depends on volatility and on how the price moves inside your range, which nobody can forecast. Use it to compare setups, not to predict income.']
];

const gridPage = {
  slug: 'grid-bot-profit-calculator',
  name: 'Grid bot profit calculator',
  title: 'Grid Bot Profit Calculator (After Fees & Range Exit)',
  desc: 'Free grid bot profit calculator: net profit per grid after fees, the minimum grid step, and what a drop below or rise above your range costs. No signup.',
  ldDesc: 'Free grid bot profit calculator: net profit per grid cycle after fees, break-even grid step, and the profit or loss when price leaves the range, for arithmetic and geometric spot grids.',
  keywords: 'grid bot profit calculator, grid trading calculator, crypto grid bot calculator, grid bot fees, arithmetic vs geometric grid, grid bot minimum profit per grid, grid bot range calculator, spot grid bot profit',
  ogAlt: 'CryptoBolt grid bot profit calculator',
  eyebrow: 'Original analysis · Spot grid bots',
  h1: 'Grid bot profit calculator',
  lead: 'Enter your price range, number of grids and fee to see what each completed grid really earns after fees, how small a step can get before it loses money, and what happens to your investment if the price leaves the range.',
  checked: 'November 25, 2026',
  js: 'grid-bot.js',
  faqTitle: 'Grid bot profit FAQ',
  faq: gridFaq,
  form: `    <div class="lc-calc">
        <div class="lc-toggle" role="group" aria-label="Grid type">
            <button type="button" id="gb-mode-a" class="active" aria-pressed="true">Arithmetic grid</button>
            <button type="button" id="gb-mode-g" aria-pressed="false">Geometric grid</button>
        </div>
        <div class="lc-grid">
${field('gb-lower', 'Lower price of the range (USD)', 50000)}
${field('gb-upper', 'Upper price of the range (USD)', 70000)}
${field('gb-grids', 'Number of grids', 20, ' min="2" max="500" step="1"')}
${field('gb-invest', 'Investment (USD)', 10000)}
${field('gb-price', 'Current price (USD)', 60000)}
${field('gb-fee', 'Fee per trade (%)', 0.1, ' min="0"', '(each buy and each sell)')}
${field('gb-cycles', 'Completed cycles per day', 3, ' min="0"', '(your estimate, not a forecast)')}
        </div>
        <div class="lc-result">
            <div class="lc-price" id="gb-out-main">${pct(gr.minNetPct)} to ${pct(gr.maxNetPct)}</div>
            <div class="lc-sub" id="gb-out-sub">Net profit per completed grid cycle after fees (arithmetic grid, about ${usd(gr.avgNet)} per cycle)</div>
        </div>
        <div class="lc-stats">
            <div class="lc-stat"><b id="gb-out-order">${usd(gr.orderValue)}</b><span>Average order size per grid</span></div>
            <div class="lc-stat"><b id="gb-out-step">${pct(gr.stepLow)} to ${pct(gr.stepHigh)}</b><span>Grid step as % of price</span></div>
            <div class="lc-stat"><b id="gb-out-net">${pct(gr.minStepPct)} needed to cover fees</b><span>Smallest step that breaks even</span></div>
            <div class="lc-stat"><b id="gb-out-avg">${usd(gr.avgNet)}</b><span>Average net profit per cycle</span></div>
            <div class="lc-stat"><b id="gb-out-day">${usd(gr.daily)}</b><span>Profit per day at your cycle estimate</span></div>
            <div class="lc-stat"><b id="gb-out-apr">${pct(gr.apr, 1)}</b><span>Simple annual rate of that estimate</span></div>
            <div class="lc-stat"><b id="gb-out-low" class="lc-neg">${usd(gr.scen[1].pnl)}</b><span>Profit or loss if price falls to the bottom</span></div>
            <div class="lc-stat"><b id="gb-out-up">${usd(gr.scen[3].pnl)}</b><span>Profit or loss if price rises to the top</span></div>
            <div class="lc-stat"><b id="gb-out-rec">${gr.cyclesToRecover} cycles</b><span>Cycles needed to earn back the bottom loss</span></div>
        </div>
        <div class="lc-warning" id="gb-warning"></div>
        <div class="lc-tbl-wrap"><table>
<thead><tr><th>If price moves in one direction to</th><th>Price</th><th>Value of the bot</th><th>Profit or loss</th><th>Value if you had just bought</th></tr></thead>
<tbody id="gb-scen">${gr.scen.map((s, i) => `<tr><td>${['10% below the range', 'Bottom of range', 'Start price', 'Top of range', '10% above the range'][i]}</td><td>${px(s.price)}</td><td>${usd(s.value)}</td><td${s.pnl < 0 ? ' class="lc-neg"' : ''}>${usd(s.pnl)}</td><td>${usd(s.hodl)}</td></tr>`).join('')}</tbody>
</table></div>
        <p class="lc-note">Spot grid with an equal coin quantity per grid. The scenario table follows a one-way move from the start price and adds no extra cycles, so it isolates the cost of leaving the range. It ignores slippage, funding (futures grids), minimum order sizes and tax. Educational tool, not financial advice. <a href="crypto-paper-trading">Practice with virtual funds first &rarr;</a></p>
    </div>`,
  article: `    <h2>How this calculator works</h2>
    <p>A grid bot places buy orders below the current price and sell orders above it, evenly spaced between a lower and an upper price. Each time the price moves up one grid, a sell fills; each time it moves back down, the matching buy fills. Every completed buy-and-sell pair banks one grid profit. The calculator follows this setup:</p>
    <ul>
        <li><strong>Grid lines</strong>: arithmetic grids use an equal price distance between lines; geometric grids use an equal percentage.</li>
        <li><strong>Quantity per grid</strong>: every grid holds the same amount of the coin. The calculator picks the amount so that the waiting buy orders plus the coin bought at the start cost exactly your investment.</li>
        <li><strong>Profit of one cycle</strong> = quantity × (upper line − lower line) − fee × quantity × (lower line + upper line).</li>
        <li><strong>Break-even step</strong> = (1 + fee) ÷ (1 − fee) − 1. With a 0.1% fee per side that is about 0.2002%.</li>
        <li><strong>Range exit</strong>: the value of the bot after a one-way move to a price outside the range, compared with simply buying the coin at the start price.</li>
    </ul>
    <h2>Worked example: 20 grids between $50,000 and $70,000</h2>
    <p>With $10,000 invested, the start price at $60,000 and a 0.1% fee per trade, an arithmetic grid with 20 lines places ${gr.buys} buy orders and starts with coin for ${gr.sells} sell orders. Each grid order is about ${usd(gr.orderValue)}. The grid step is $1,000, which is ${pct(gr.stepLow)} of the price at the bottom and ${pct(gr.stepHigh)} at the top. After fees one completed cycle nets between ${pct(gr.minNetPct)} and ${pct(gr.maxNetPct)}, about ${usd(gr.avgNet)} on average.</p>
    <p>A geometric grid with the same range and grid count has an equal ${pct(geo.stepLow)} step in every grid, so each cycle nets ${pct(geo.minNetPct)}.</p>
    <h2>More grids does not mean more profit</h2>
    <p>Splitting the same range into more grids makes each step smaller and each order smaller. The profit per cycle falls, and the fees take a bigger share. More cycles complete, but only if the price actually travels that far. Here is a geometric grid on the same $50,000 to $70,000 range:</p>
    ${table(['Grids', 'Step per grid', 'Net per cycle', 'Order size', 'Average profit per cycle', 'Profit if every grid completes once'], gridCounts)}
    <p>Going from 20 to 200 grids shrinks the net profit per cycle from ${pct(grid.compute({ ...g0, mode: 'geometric', grids: 20 }).minNetPct)} to ${pct(grid.compute({ ...g0, mode: 'geometric', grids: 200 }).minNetPct)}. At 200 grids the step is only a little above what the fees take, so a small change in your fee tier or a bit of slippage can wipe out the edge.</p>
    <h2>How fees set the smallest useful grid</h2>
    <p>Every cycle pays a fee on the buy and on the sell. If the grid step is smaller than the two fees together, the cycle loses money even though the bot reports a &ldquo;profit&rdquo; in price terms. The table shows the break-even step for common fee levels, and how many geometric grids fit in the $50,000 to $70,000 range while each cycle still nets about 0.3%:</p>
    ${table(['Fee per trade', 'Break-even grid step', 'Most grids for about 0.3% net per cycle'], feeRows)}
    <p>Fee levels depend on the exchange, your trading volume and whether you pay in the exchange token, so check your own tier before you rely on any number here.</p>
    <h2>What happens when price leaves the range</h2>
    <p>This is the part most grid bot calculators leave out. Using the example above:</p>
    ${table(['Price moves one way to', 'Value of the bot', 'Profit or loss', 'Value if you had just bought', 'Profit or loss from just buying'], scenRows)}
    <p>If the price falls to the bottom of the range, the bot has bought every grid on the way down and holds coins worth less than it paid, a loss of ${usd(gr.scen[1].pnl)}, which would take about ${gr.cyclesToRecover} average cycles to earn back. That is still a smaller loss than buying and holding, because the bot bought gradually. If the price rises to the top, the bot has sold everything and holds cash, earning ${usd(gr.scen[3].pnl)}, while a holder would have made ${usd(gr.scen[3].hodl - g0.invest)}. Above the range the bot earns nothing more while the coin keeps rising.</p>
    <div class="lc-callout"><strong>The trade-off in one line:</strong> a grid bot swaps the big upside of holding for small repeated profits, and it carries a downside nearly as large as holding if the price leaves the bottom of the range.</div>
    <h2>Arithmetic or geometric grid?</h2>
    <ul>
        <li><strong>Arithmetic</strong> works well for a tight range, where the percentage difference between the lowest and highest line is small. The bottom grids have a larger percentage step than the top grids.</li>
        <li><strong>Geometric</strong> works better for a wide range, such as a range that spans 40% or more, because each grid earns about the same percentage.</li>
    </ul>
    <h2>Choosing a range</h2>
    <p>A narrow range gives more cycles but a higher chance of the price leaving it. A wide range survives bigger moves but spreads the money across more grids, so each grid is smaller. Many traders pick the range from support and resistance levels they can see on the chart; the <a href="fibonacci-retracement-calculator">Fibonacci retracement calculator</a> can help mark them. To see how the position behaves if the price falls through the bottom, you can also check the maths of averaging down with the <a href="crypto-average-price-calculator">average price calculator</a>.</p>
    <h2>What this calculator does not model</h2>
    <ul>
        <li><strong>Futures grids.</strong> Grids on perpetual futures add leverage, liquidation risk and funding payments. Use the <a href="liquidation-price-calculator">liquidation price calculator</a> and the <a href="funding-fee-calculator">funding fee calculator</a> for those parts.</li>
        <li><strong>Slippage and minimum orders.</strong> Exchanges reject orders below a minimum size, and thin books fill at worse prices.</li>
        <li><strong>Trailing grids and stop-losses.</strong> Some bots move the range or close the bot at a stop price, which changes the outcome.</li>
        <li><strong>Tax.</strong> Every completed cycle can be a taxable event in many countries.</li>
        <li><strong>The future.</strong> The cycles-per-day input is your own guess. The calculator does not predict how often the price will cross your grid lines.</li>
    </ul>
    <p>Before you run a real bot, practise reading the range and the risks with virtual funds in <a href="crypto-paper-trading">crypto paper trading</a>, and read <a href="risk-reward-ratio-and-win-rate">why win rate and risk-reward matter together</a>.</p>`,
  related: [
    card('dca-bot-safety-order-calculator', 'bar-chart-3', 'Calculator', 'DCA bot safety order calculator', 'Capital, average entry and take-profit price for every safety order.'),
    card('crypto-average-price-calculator', 'calculator', 'Calculator', 'Crypto average price calculator', 'Combine several buys into one weighted entry price.'),
    card('fibonacci-retracement-calculator', 'ruler', 'Calculator', 'Fibonacci retracement calculator', 'Levels that help you choose a grid range.'),
    card('liquidation-price-calculator', 'target', 'Calculator', 'Liquidation price calculator', 'For grids that use futures and leverage.')
  ]
};

/* ------------------------------------------------------------------ DCA BOT */
const d0 = { side: 'long', entry: 100, base: 100, so: 200, count: 5, dev: 1.5, stepScale: 1.2, volScale: 1.5, tp: 1.5, fee: 0.1, lev: 1, mmr: 0.5 };
const dr = dca.compute(d0);
const ladderRows = dr.rows.map((r) => [r.n === 0 ? 'Base order' : 'Safety order ' + r.n, px(r.price), pct(r.dev), usd(r.size), usd(r.cost), px(r.avg), px(r.tpPrice)]);
const scaleRows = [1, 1.5, 2].map((v) => {
  const r = dca.compute({ ...d0, volScale: v });
  const lastSize = r.rows[r.rows.length - 1].size;
  return [v.toFixed(1) + 'x', usd(lastSize), usd(r.capital), px(r.avg), pct(r.reachBackPct), String(Math.round(r.capital / d0.base)) + 'x'];
});
const stepRows = [1, 1.2, 1.5].map((s) => {
  const r = dca.compute({ ...d0, stepScale: s });
  return [s.toFixed(1) + 'x', pct(r.lastDev), px(r.lastPrice), px(r.avg), pct(r.reachBackPct)];
});
const levRows = [3, 5, 10, 20].map((L) => {
  const r = dca.compute({ ...d0, lev: L });
  return [L + 'x', usd(r.margin), px(r.liq), r.liqAtOrder ? 'Yes, around safety order ' + r.liqAtOrder : 'No', ];
});

const dcaFaq = [
  ['What is a safety order in a DCA bot?', 'A safety order is an extra buy a DCA bot places below your entry price. When the price drops by the set deviation, the bot buys more, which lowers your average entry price so the take-profit target comes closer. Each later safety order can be larger (volume scale) and further away (step scale).'],
  ['How much capital does a DCA bot need?', 'Add up the base order and every safety order. With a volume scale above 1 the orders grow, so the total can be many times the base order. In the example here a $100 base order and five safety orders need $2,737.50, about 27 times the base order. Always plan for the full ladder, not just the base order.'],
  ['What do price deviation, step scale and volume scale mean?', 'Price deviation is how far the price must drop before the first safety order. Step scale multiplies the gap between each safety order and the previous one, so a scale of 1.2 spaces later orders further apart. Volume scale multiplies the size of each safety order relative to the previous one, so a scale of 1.5 makes each order 50% larger.'],
  ['Why can a DCA bot lose money?', 'A DCA bot keeps buying while the price falls. If the price never comes back up to the take-profit level, all the capital ends up in a coin that keeps falling. Larger later orders speed up recovery but also put more money into the losing position, which is why the full ladder size and the price of the last safety order matter more than the base order.'],
  ['How does leverage change a DCA bot?', 'With futures and leverage, each safety order adds margin and moves the average entry, but the liquidation price of the combined position is only a few percent away from the average at high leverage. The calculator estimates the isolated liquidation price of the averaged position and warns when the price would hit it before the ladder finishes.']
];

const dcaPage = {
  slug: 'dca-bot-safety-order-calculator',
  name: 'DCA bot safety order calculator',
  title: 'DCA Bot Safety Order Calculator (Capital & Avg Entry)',
  desc: 'Free DCA bot safety order calculator: total capital needed, average entry, take-profit price and last-order drop for any step and volume scale. No signup.',
  ldDesc: 'Free DCA bot (martingale) safety order calculator: capital needed for the full ladder, average entry and take-profit price after every safety order, and the liquidation price for futures bots.',
  keywords: 'dca bot safety order calculator, dca bot calculator, martingale calculator crypto, safety order calculator, dca bot price deviation, step scale volume scale, dca bot capital needed, averaging down calculator',
  ogAlt: 'CryptoBolt DCA bot safety order calculator',
  eyebrow: 'Original analysis · DCA bots',
  h1: 'DCA bot safety order calculator',
  lead: 'Enter your base order, safety orders, price deviation and the two scales to see every order in the ladder, the capital you need if all of them fill, your average entry after each one, and the take-profit price that closes the deal.',
  checked: 'November 25, 2026',
  js: 'dca-bot.js',
  faqTitle: 'DCA bot safety order FAQ',
  faq: dcaFaq,
  form: `    <div class="lc-calc">
        <div class="lc-toggle" role="group" aria-label="Bot direction">
            <button type="button" id="db-side-long" class="active" aria-pressed="true">Long bot</button>
            <button type="button" id="db-side-short" aria-pressed="false">Short bot</button>
        </div>
        <div class="lc-grid">
${field('db-entry', 'Entry price (USD)', 100)}
${field('db-base', 'Base order size (USD)', 100)}
${field('db-so', 'First safety order size (USD)', 200)}
${field('db-count', 'Number of safety orders', 5, ' min="1" max="30" step="1"')}
${field('db-dev', 'Price deviation to first safety order (%)', 1.5, ' min="0.01" max="99"')}
${field('db-step', 'Safety order step scale', 1.2, ' min="1" max="5"', '(1 = equal gaps)')}
${field('db-vol', 'Safety order volume scale', 1.5, ' min="1" max="5"', '(1 = equal sizes)')}
${field('db-tp', 'Take profit from average entry (%)', 1.5, ' min="0.01"')}
${field('db-fee', 'Fee per trade (%)', 0.1, ' min="0"')}
${field('db-lev', 'Leverage (x, 1 = spot)', 1, ' min="1" max="125"')}
${field('db-mmr', 'Maintenance margin rate (%)', 0.5, ' min="0"', '(futures only)')}
        </div>
        <div class="lc-result">
            <div class="lc-price" id="db-out-main">${usd(dr.capital)}</div>
            <div class="lc-sub" id="db-out-sub">Total capital needed if every safety order fills (5 safety orders)</div>
        </div>
        <div class="lc-stats">
            <div class="lc-stat"><b id="db-out-cap">${usd(dr.capital)}</b><span>Capital for the full ladder</span></div>
            <div class="lc-stat"><b id="db-out-last">${px(dr.lastPrice)} (${pct(dr.lastDev)} below entry)</b><span>Price of the last safety order</span></div>
            <div class="lc-stat"><b id="db-out-avg">${px(dr.avg)}</b><span>Average entry after the last order</span></div>
            <div class="lc-stat"><b id="db-out-reach">${pct(dr.reachBackPct)} from the last order</b><span>Move needed to reach take profit</span></div>
            <div class="lc-stat"><b id="db-out-tp">${usd(dr.tpProfit)}</b><span>Profit at take profit with the full ladder, after fees</span></div>
            <div class="lc-stat"><b id="db-out-float" class="lc-neg">${usd(dr.floatingAtLast)}</b><span>Floating result when price sits at the last order</span></div>
            <div class="lc-stat"><b id="db-out-liq">No leverage (spot)</b><span>Estimated liquidation of the averaged position</span></div>
        </div>
        <div class="lc-warning" id="db-warning"></div>
        <div class="lc-tbl-wrap"><table>
<thead><tr><th>Order</th><th>Price</th><th>Drop from entry</th><th>Order size</th><th>Total invested</th><th>Average entry</th><th>Take-profit price</th></tr></thead>
<tbody id="db-rows">${dr.rows.map((x) => `<tr><td>${x.n === 0 ? 'Base' : 'SO ' + x.n}</td><td>${px(x.price)}</td><td>${pct(x.dev)}</td><td>${usd(x.size)}</td><td>${usd(x.cost)}</td><td>${px(x.avg)}</td><td>${px(x.tpPrice)}</td></tr>`).join('')}</tbody>
</table></div>
        <p class="lc-note">Standard ladder: safety order k sits at a cumulative deviation of d × (1 + s + … + s<sup>k−1</sup>) and has the size first-order × v<sup>k−1</sup>. Fees are taken on both legs of the full position. It does not model slippage, partial fills, funding, stop-losses or the exchange&rsquo;s own bot rules. Educational tool, not financial advice. <a href="crypto-paper-trading">Practice with virtual funds first &rarr;</a></p>
    </div>`,
  article: `    <h2>How a DCA bot ladder works</h2>
    <p>A DCA bot, sometimes called a martingale bot, opens a base order and then keeps buying more if the price moves against it. Each extra buy is a safety order. Because the later buys happen at lower prices, your average entry drops, and the price only needs to recover to a take-profit level above the new average, not back to the original entry.</p>
    <ul>
        <li><strong>Price deviation</strong>: the drop from the entry that triggers the first safety order.</li>
        <li><strong>Step scale</strong>: multiplies the gap to each next safety order. At 1.0 the orders are evenly spaced; at 1.2 each gap is 20% wider than the one before.</li>
        <li><strong>Volume scale</strong>: multiplies each safety order&rsquo;s size. At 1.0 all orders are equal; at 1.5 each one is 50% larger.</li>
        <li><strong>Take profit</strong>: the percentage above your average entry at which the bot sells everything.</li>
    </ul>
    <h2>Worked example: $100 base order and five safety orders</h2>
    <p>A long bot enters at $100 with a $100 base order. The first safety order is $200 at a 1.5% drop, the step scale is 1.2, the volume scale is 1.5 and take profit is 1.5% above the average entry.</p>
    ${table(['Order', 'Price', 'Drop from entry', 'Order size', 'Total invested', 'Average entry', 'Take-profit price'], ladderRows)}
    <p>The full ladder needs ${usd(dr.capital)}, which is ${Math.round(dr.capital / d0.base)} times the base order. The last order fills at ${px(dr.lastPrice)}, ${pct(dr.lastDev)} below the entry, and by then the average entry is ${px(dr.avg)}. To close at take profit the price has to climb ${pct(dr.reachBackPct)} from the last order. If it does, the bot makes about ${usd(dr.tpProfit)} after fees on ${usd(dr.capital)} invested. If it never does, the floating loss at the last order is about ${usd(dr.floatingAtLast)}.</p>
    <div class="lc-callout"><strong>Look at the right-hand column, not the base order.</strong> The base order is only ${pct(d0.base / dr.capital * 100, 1)} of the money the ladder can use. The last safety order alone is ${pct(dr.rows[5].size / dr.capital * 100, 0)}.</div>
    <h2>How volume scale changes the risk</h2>
    <p>Bigger later orders pull the average entry down faster, so take profit comes closer. They also put more money into the position exactly when the price is lowest. Same ladder as above, only the volume scale changes:</p>
    ${table(['Volume scale', 'Size of last order', 'Total capital', 'Average entry after last order', 'Move needed to take profit', 'Capital as multiple of base order'], scaleRows)}
    <h2>How step scale changes the depth</h2>
    <p>A step scale above 1 spreads the orders further apart, so the ladder survives a deeper fall before it runs out of safety orders:</p>
    ${table(['Step scale', 'Last order is this far below entry', 'Price of last order', 'Average entry', 'Move needed to take profit'], stepRows)}
    <p>That extra depth costs you earlier averaging: the first orders still fill at the same prices, but the last ones are much lower, and the average entry stays higher until they fill.</p>
    <h2>Using leverage on a futures DCA bot</h2>
    <p>On perpetual futures every safety order adds margin, but the averaged position is liquidated when the price moves roughly 1 ÷ leverage against the average entry, minus the maintenance margin. The calculator uses the simple isolated formula, average entry × (1 − 1 ÷ leverage + maintenance margin rate) for a long. For the same $100 base order ladder as above, with a 0.5% maintenance margin rate:</p>
    ${table(['Leverage', 'Margin needed for the full ladder', 'Liquidation price after the last order', 'Liquidated before the ladder finishes?'], levRows)}
    <p>If a liquidation price sits above the price of a later safety order, that order can never fill, and the &ldquo;safety&rdquo; ladder is not safe at all. Use the <a href="liquidation-price-calculator">liquidation price calculator</a> to check an exact exchange setup and the <a href="liquidation-probability-calculator">liquidation probability calculator</a> to see how likely it is that the price reaches that level.</p>
    <h2>A checklist before you start a bot</h2>
    <ul>
        <li>Can you afford the <strong>full ladder</strong>, and would you be comfortable holding that coin if it fell below the last safety order?</li>
        <li>Is the last safety order at a price that is plausible for this coin&rsquo;s volatility? Smaller coins can fall much further than the ladder covers.</li>
        <li>Is the take-profit move from the last order realistic, or does it need a full recovery?</li>
        <li>Do you have a plan, such as a stop-loss or a time limit, for the case where take profit is never hit?</li>
    </ul>
    <h2>What this calculator does not model</h2>
    <ul>
        <li><strong>Partial recoveries.</strong> A real bot can hit take profit after the first or second safety order, which gives a smaller profit than the full-ladder figure shown here.</li>
        <li><strong>Slippage, partial fills and minimum order sizes.</strong></li>
        <li><strong>Funding payments</strong> on futures bots, which add up on a long-running position. See the <a href="funding-fee-calculator">funding fee calculator</a>.</li>
        <li><strong>Exchange-specific rules</strong>, such as different ways of measuring the deviation or trailing take profit.</li>
    </ul>
    <p>The same averaging maths applies to manual buys, which you can check with the <a href="crypto-average-price-calculator">crypto average price calculator</a>. If you prefer to compare the approach with simple regular buying, see <a href="dollar-cost-averaging-crypto">dollar-cost averaging in crypto</a> and the <a href="dca-calculator">DCA calculator</a>. Grid strategies work differently; the <a href="grid-bot-profit-calculator">grid bot profit calculator</a> shows how.</p>`,
  related: [
    card('grid-bot-profit-calculator', 'bar-chart-3', 'Calculator', 'Grid bot profit calculator', 'Net profit per grid after fees and the cost of leaving the range.'),
    card('crypto-average-price-calculator', 'calculator', 'Calculator', 'Crypto average price calculator', 'Combine several buys into one weighted entry price.'),
    card('dca-calculator', 'calculator', 'Calculator', 'Crypto DCA calculator', 'Regular buys versus a lump sum.'),
    card('liquidation-price-calculator', 'target', 'Calculator', 'Liquidation price calculator', 'For futures bots that use leverage.')
  ]
};

import { backtestPage } from './backtest-page-def.mjs';
for (const p of [gridPage, dcaPage, backtestPage(build, { field, table, card, usd, pct })]) {
  const html = build(p).replace(/\n/g, '\r\n');
  fs.writeFileSync(path.join(ROOT, p.slug + '.html'), html);
  console.log('wrote', p.slug + '.html', html.length);
}