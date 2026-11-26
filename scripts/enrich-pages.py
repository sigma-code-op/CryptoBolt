#!/usr/bin/env python3
"""Inject unique, hand-written enrichment blocks (worked examples, mistakes, rules of thumb,
lesson scenarios, a features walkthrough) into the existing static pages.
Idempotent: each block sits between <!-- px:start --> and <!-- px:end --> markers and is replaced on re-run.
Run from the project root:  python3 scripts/enrich-pages.py
All example numbers are computed here so they cannot drift from the formulas.
"""
import math, re, random, html, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
E = html.escape
def usd(x, d=2): return ('-' if x < 0 else '') + '$' + format(abs(x), ',.%df' % d)
def pc(x, d=2): return format(x, ',.%df' % d) + '%'
def num(x, d=2): return format(x, ',.%df' % d)
def ncdf(z): return 0.5 * (1 + math.erf(z / math.sqrt(2)))

# ------------------------------------------------------------------ calculators
def calc_data():
    D = {}
    # altcoin profit
    inv, b, s, f = 1000, 0.50, 0.80, 0.001
    coins = (inv - inv * f) / b; proc = coins * s; net = proc - proc * f - inv
    be = inv / (coins * (1 - f))
    D['altcoin-profit-calculator'] = dict(
        title='Worked example: a $1,000 altcoin trade',
        rows=[('Invested', usd(inv)), ('Buy price / sell price', '$0.50 / $0.80'), ('Fee per side', '0.1%'),
              ('Coins bought', num(coins, 1)), ('Sale proceeds', usd(proc)), ('Net profit after both fees', usd(net)),
              ('Net ROI', pc(net / inv * 100)), ('Break-even sell price', '$' + num(be, 4))],
        note='The price rose 60%, but the profit is 59.68%. Fees take a little off the top on the way in and a little more on the way out.',
        mistakes=['Quoting the headline price change (+60%) instead of net ROI after both fees.', 'Forgetting that the sell fee is charged on the larger sale amount, not on what you invested.', 'Ignoring break-even: any sell price below it is a loss even if it is above your buy price.'],
        rule='Before you buy a low-priced coin, work out the break-even sell price first. If the realistic target is not far above it, the trade is not worth the fees.')
    # average price
    buys = [(2, 100), (3, 80), (5, 60)]
    cost = sum(q * p for q, p in buys); qty = sum(q for q, p in buys); avg = cost / qty; cur = 70
    D['crypto-average-price-calculator'] = dict(
        title='Worked example: three buys at three prices',
        rows=[('Buy 1', '2 units at $100'), ('Buy 2', '3 units at $80'), ('Buy 3', '5 units at $60'), ('Total cost', usd(cost)),
              ('Total quantity', '10 units'), ('Weighted average price', usd(avg)), ('Simple average of the 3 prices', '$80.00 (misleading)'),
              ('Result if price is now $70', usd(qty * cur - cost) + ' (' + pc((qty * cur - cost) / cost * 100, 1) + ')')],
        note='More units were bought at the lower prices, so the weighted average ($74) is below the simple average ($80). The weighted one is the figure that decides profit and loss.',
        mistakes=['Averaging the prices instead of weighting them by quantity.', 'Leaving out small buys or fees, which quietly shifts your real entry.', 'Averaging down a position without a plan: a lower average makes you feel better but does not change what the price is doing.'],
        rule='Your average price is a bookkeeping number, not a support level. The market does not know or care where you bought.')
    # futures profit
    m, lev, en, ex, fee = 500, 10, 100, 105, 0.0005
    pv = m * lev; u = pv / en; gross = u * (ex - en); fees = fee * pv + fee * u * ex; netp = gross - fees
    D['crypto-profit-calculator'] = dict(
        title='Worked example: a 10x long that moves 5%',
        rows=[('Margin / leverage', '$500 / 10x'), ('Position value', usd(pv)), ('Units', num(u, 0)), ('Entry to exit', '$100 to $105'),
              ('Gross PnL', usd(gross)), ('Fees (0.05% each side, on position value)', usd(fees, 3)), ('Net PnL', usd(netp, 3)), ('Return on margin (ROE)', pc(netp / m * 100, 2))],
        note='A 5% price move turned into a roughly 49% return on margin. The same leverage makes a 5% move the other way a roughly 51% loss, fees included.',
        mistakes=['Reading ROE as if it were the price move. Leverage multiplies both.', 'Charging fees on margin instead of position value, which understates the cost by the leverage factor.', 'Skipping funding on trades held overnight.'],
        rule='Fees on a leveraged trade are paid on the whole position, so at 10x a 0.05% fee is 0.5% of your margin, each way.')
    # ROI
    inv, b, s, f = 2000, 40, 55, 0.001
    coins = inv * (1 - f) / b; proc = coins * s * (1 - f); netr = proc - inv
    D['crypto-roi-calculator'] = dict(
        title='Worked example: a $2,000 spot trade',
        rows=[('Invested', usd(inv)), ('Buy / sell', '$40 / $55'), ('Fee per side', '0.1%'), ('Coins received', num(coins, 3)),
              ('Proceeds after sell fee', usd(proc)), ('Net profit', usd(netr)), ('ROI', pc(netr / inv * 100)), ('Total fees paid', usd(inv - inv * (1 - f) + coins * s * f))],
        note='A 37.5% price rise gives a 37.2% ROI. Fees are small on one trade and large across hundreds.',
        mistakes=['Comparing ROI across trades of different length without annualising.', 'Ignoring the buy fee because it is taken out of what you spend, not added on top.', 'Counting unrealised ROI as banked profit.'],
        rule='ROI says how much you made, not how fast or how risky. Always put the holding time and the worst drop beside it.')
    # staking
    apr, yrs, n = 0.08, 3, 365
    apy = (1 + apr / n) ** n - 1; bal = 1000 * (1 + apr / n) ** (n * yrs)
    D['crypto-staking-calculator'] = dict(
        title='Worked example: 8% APR compounded daily for 3 years',
        rows=[('Start', usd(1000, 0)), ('APR', '8%'), ('APY with daily compounding', pc(apy * 100)), ('Balance after 3 years', usd(bal)),
              ('Rewards earned', usd(bal - 1000)), ('Same rewards, no compounding', usd(1000 * apr * yrs)), ('Extra from compounding', usd(bal - 1000 - 1000 * apr * yrs))],
        note='Compounding adds a few dollars here. The bigger risk is the token price: if the coin falls 30% in those three years, the rewards do not cover the loss in dollars.',
        mistakes=['Treating APR and APY as the same number.', 'Assuming the advertised rate stays fixed. Staking rates change with network conditions.', 'Forgetting lockup, unbonding time and slashing risk.'],
        rule='Rewards are paid in the token. Judge a staking offer by what you would hold in dollars, not by the percentage.')
    # DCA
    prices = [100, 90, 80, 70, 60, 50]; amt = 100
    coins = sum(amt / p for p in prices); tot = amt * len(prices); avgc = tot / coins; fin = coins * prices[-1]
    lump = tot / prices[0] * prices[-1]
    D['dca-calculator'] = dict(
        title='Worked example: six $100 buys while price falls from $100 to $50',
        rows=[('Prices at each buy', '$100, $90, $80, $70, $60, $50'), ('Total invested', usd(tot, 0)), ('Coins bought', num(coins, 3)),
              ('Average cost', usd(avgc)), ('Simple average of the prices', '$75.00'), ('Value at $50', usd(fin)), ('A lump sum at $100 would be worth', usd(lump))],
        note='The average cost ($68.60) is lower than the simple average ($75) because falling prices buy more coins. DCA lost less than the lump sum here, and it would have lagged if price had risen instead.',
        mistakes=['Calling DCA safe. It reduces timing risk, not the risk of the asset falling.', 'Stopping buys after a drop, which defeats the plan.', 'Choosing an amount you cannot keep buying through a long decline.'],
        rule='DCA is a rule about when you buy. Pick a size you could keep up for a year even if the price only went down.')
    # DCA bot
    base = 100; so = [98, 96, 94, 92, 90]
    orders = [(base, 100)] + [(100, p) for p in so]
    spent = sum(a for a, p in orders); co = sum(a / p for a, p in orders); avge = spent / co; tp = avge * 1.015
    D['dca-bot-safety-order-calculator'] = dict(
        title='Worked example: a base order and five evenly spaced safety orders',
        rows=[('Base order', '$100 at $100'), ('Safety orders', '5 x $100 at about $98, $96, $94, $92, $90'), ('Capital needed if all fill', usd(spent, 0)),
              ('Average entry if all fill', usd(avge)), ('Take profit at +1.5%', usd(tp)), ('Price drop covered', 'about 10% below entry')],
        note='A bot that is fully filled needs six times its first order, and it is exposed to a 10% decline. The price must still recover about 7% from the last fill ($90) to reach the take-profit ($96.30).',
        mistakes=['Sizing only the first order and forgetting the capital the safety orders will demand.', 'Letting the grid of safety orders cover only a small drop, so a normal decline exhausts them.', 'Using a large volume scale: each extra order is bigger, so the last fills carry most of the risk.'],
        rule='Check the total capital with every safety order filled. If you cannot afford that number, shrink the bot, not the safety orders.')
    # fibonacci
    lo, hi = 60000, 70000; rng = hi - lo
    ret = {r: hi - rng * r for r in (0.236, 0.382, 0.5, 0.618, 0.786)}
    D['fibonacci-retracement-calculator'] = dict(
        title='Worked example: an uptrend from $60,000 to $70,000',
        rows=[('Range', usd(rng, 0))] + [(pc(r * 100, 1) + ' retracement', usd(v, 0)) for r, v in ret.items()] + [('161.8% extension target', usd(lo + rng * 1.618, 0))],
        note='These are reference levels where many traders watch for a pause. They are not forecasts, and the ones that matter most are the ones that line up with older highs, lows or round numbers.',
        mistakes=['Drawing from the wrong swing. A different high or low gives a completely different set of levels.', 'Treating a retracement level as a guaranteed bounce.', 'Using Fibonacci levels alone without checking trend, volume or another level nearby.'],
        rule='A level is stronger when two unrelated methods agree on it, for example a retracement and a prior swing low.')
    # funding
    pos, rate = 20000, 0.0001
    pay = pos * rate
    D['funding-fee-calculator'] = dict(
        title='Worked example: a $20,000 long paying 0.01% per 8 hours',
        rows=[('Position value', usd(pos, 0)), ('Funding rate', '0.01% per 8 hours'), ('Per payment', usd(pay)), ('Payments per day', '3'),
              ('Per day', usd(pay * 3)), ('Over 30 days', usd(pay * 3 * 30)), ('Annualised', pc(rate * 3 * 365 * 100))],
        note='0.01% looks like nothing, but it is about 10.95% a year on the whole position. On a 10x trade that is roughly 110% of the margin per year if the rate never changed.',
        mistakes=['Calculating funding on margin instead of position value.', 'Assuming the rate stays at today\'s level. It changes every interval.', 'Forgetting that funding can be income if you are on the side that gets paid.'],
        rule='If funding is positive, longs pay. Holding a crowded long for weeks costs real money even when the price goes nowhere.')
    # grid
    q, lowl, upl, f = 1, 100, 101, 0.001
    cyc = q * (upl - lowl) - f * q * (lowl + upl)
    D['grid-bot-profit-calculator'] = dict(
        title='Worked example: one grid cycle between $100 and $101',
        rows=[('Grid lines', '$100 and $101'), ('Quantity per grid', '1 coin'), ('Fee per side', '0.1%'), ('Gross profit', '$1.00'),
              ('Fees (buy at $100, sell at $101)', usd(f * q * (lowl + upl), 3)), ('Net profit of the cycle', usd(cyc, 3)),
              ('Break-even grid step', pc(((1 + f) / (1 - f) - 1) * 100, 4))],
        note='The grid step here is 1%, about five times the break-even step of 0.2%. If the lines were only 0.15% apart, every cycle would lose money after fees.',
        mistakes=['Packing grid lines so tightly that the step is smaller than twice the fee.', 'Setting a range the price can leave. Below it the bot holds the coin at a loss, above it the bot sits in cash.', 'Judging a bot only on completed cycles and ignoring the unrealised loss from a price drop.'],
        rule='Make the grid step at least three or four times the break-even step, and size the range for the move you actually expect.')
    # hyperliquid
    acc, rp, en, st = 10000, 0.01, 3000, 2910
    risk = acc * rp; size = risk / (en - st); val = size * en
    D['hyperliquid-position-size-calculator'] = dict(
        title='Worked example: risking 1% on a $10,000 account',
        rows=[('Account / risk', '$10,000 / 1%'), ('Amount at risk', usd(risk, 0)), ('Entry / stop', '$3,000 / $2,910'), ('Stop distance', '$90'),
              ('Position size', num(size, 4) + ' units'), ('Position value', usd(val)), ('Margin at 5x', usd(val / 5)), ('Margin at 20x', usd(val / 20))],
        note='The loss at the stop is $100 whether you use 5x or 20x. Leverage only decides how much margin is locked up and how close liquidation sits to the stop.',
        mistakes=['Choosing leverage first and size second. Risk decides size; leverage just sets margin.', 'Placing the stop beyond the liquidation price, so liquidation arrives first.', 'Ignoring hourly funding on a position held for days.'],
        rule='Check that the liquidation price is well beyond your stop. If the stop would never be reached, the stop is decoration.')
    # impermanent loss
    r = 2; il = 2 * math.sqrt(r) / (1 + r) - 1; held = 1000 * (1 + r) / 2; pool = 1000 * math.sqrt(r)
    D['impermanent-loss-calculator'] = dict(
        title='Worked example: a $1,000 deposit when one token doubles',
        rows=[('Deposit', usd(1000, 0)), ('Price ratio change', '2x'), ('Value if held', usd(held)), ('Value in the pool', usd(pool)),
              ('Impermanent loss', pc(il * 100)), ('Fees needed to break even', usd(held - pool))],
        note='You still have more dollars than you deposited, but $85.79 less than simply holding. Trading fees have to cover that gap before the pool beats holding.',
        mistakes=['Comparing pool value to the deposit instead of to holding.', 'Counting advertised APR without checking whether fees outrun impermanent loss.', 'Using a volatile pair and expecting the loss to disappear. It only closes if the ratio returns.'],
        rule='Pools suit pairs that move together. The more the two prices diverge, the more fees you need.')
    # liquidation
    en, lv, mm = 60000, 10, 0.005
    ll = en * (1 - 1 / lv + mm); ls = en * (1 + 1 / lv - mm)
    D['liquidation-price-calculator'] = dict(
        title='Worked example: a 10x position opened at $60,000',
        rows=[('Entry / leverage / maintenance margin', '$60,000 / 10x / 0.5%'), ('Long liquidation price', usd(ll, 0)), ('Distance below entry', pc((1 - ll / en) * 100, 1)),
              ('Short liquidation price', usd(ls, 0)), ('Distance above entry', pc((ls / en - 1) * 100, 1)), ('At 25x, long liquidation', usd(en * (1 - 1 / 25 + mm), 0))],
        note='A 9.5% dip is a normal week for crypto. At 25x the cushion falls to 3.5% and the price only has to fall to $57,900.',
        mistakes=['Setting a stop-loss beyond the liquidation price.', 'Using cross margin without knowing that other positions share the same balance.', 'Forgetting fees and funding, which move the real number slightly.'],
        rule='Put the stop well inside the liquidation price. If liquidation happens first, you did not have a stop.')
    # liquidation probability
    cush = 1 / 10 - 0.005; sig = 0.60; days = 30
    sh = sig * math.sqrt(days / 365); d = -math.log(1 - cush); p = 2 * (1 - ncdf(d / sh))
    cush3 = 1 / 3 - 0.005; d3 = -math.log(1 - cush3); p3 = 2 * (1 - ncdf(d3 / sh))
    D['liquidation-probability-calculator'] = dict(
        title='Worked example: a 10x long over 30 days at 60% annual volatility',
        rows=[('Cushion to liquidation (10x, 0.5% maintenance)', pc(cush * 100, 1)), ('30-day volatility', pc(sh * 100, 1)), ('Chance of touching liquidation within 30 days', pc(p * 100, 0)),
              ('Same trade at 3x (cushion %s)' % pc(cush3 * 100, 1), pc(p3 * 100, 0))],
        note='This uses the zero-drift model described on this page, so treat it as a sense of scale. The point is the gap: the same market gives roughly even odds at 10x and a small chance at 3x.',
        mistakes=['Reading a low one-day probability as a low risk over the weeks you actually hold.', 'Using calm-market volatility. Risk rises in the weeks that matter.', 'Forgetting that touching the level once is enough. Price does not have to close there.'],
        rule='Pick leverage from the probability you can live with, not from the profit you hope for.')
    # losing streak
    def run_prob(n, q, k):
        # P(at least one run of k losses) via DP over current run length
        st = [0.0] * k; st[0] = 1.0; hit = 0.0
        for _ in range(n):
            ns = [0.0] * k
            for j, v in enumerate(st):
                ns[0] += v * (1 - q)
                if j + 1 == k: hit += v * q
                else: ns[j + 1] += v * q
            st = ns
        return hit
    a = run_prob(100, 0.5, 7); bb = run_prob(100, 0.6, 8)
    D['losing-streak-calculator'] = dict(
        title='Worked example: how often long losing streaks show up',
        rows=[('50% win rate, 100 trades: at least 7 losses in a row', pc(a * 100, 0)), ('40% win rate, 100 trades: at least 8 losses in a row', pc(bb * 100, 0)),
              ('Cost of 8 losses in a row at 1% risk', pc((1 - 0.99 ** 8) * 100, 1) + ' of the account'), ('Cost of 8 losses in a row at 5% risk', pc((1 - 0.95 ** 8) * 100, 1) + ' of the account')],
        note='Streaks that feel like proof the strategy is broken are often just arithmetic. What decides survival is the size you risk while the streak plays out.',
        mistakes=['Changing the strategy after a streak that sits inside the normal range.', 'Sizing as if streaks will not happen. At 5% risk, eight losses in a row takes about a third of the account.', 'Assuming trades are independent when they are all long and the market is trending down.'],
        rule='Plan for a streak twice as long as the one you consider likely, and pick a size that survives it.')
    # position size
    acc, rp, en, st = 5000, 0.01, 100, 95
    risk = acc * rp; size = risk / (en - st)
    D['position-size-calculator'] = dict(
        title='Worked example: $5,000 account, 1% risk, stop $5 away',
        rows=[('Amount at risk', usd(risk, 0)), ('Entry / stop', '$100 / $95'), ('Position size', num(size, 0) + ' units'), ('Position value', usd(size * en, 0)),
              ('1R / 2R / 3R targets', '$105 / $110 / $115'), ('If the stop is $10 away instead', num(risk / 10, 0) + ' units')],
        note='The same $50 risk buys 10 units with a $5 stop and 5 units with a $10 stop. A wider stop means a smaller position, never a bigger loss.',
        mistakes=['Sizing from the money you have instead of the money you are willing to lose.', 'Moving the stop further away after entry without reducing size.', 'Forgetting that fees and slippage mean the real loss at the stop is slightly larger than planned.'],
        rule='Decide the stop from the chart first, then calculate the size. If the size is too small to be worth it, skip the trade.')
    # risk of ruin (simulation with the page's described process)
    def sim(win, rr, risk, trades, dd, runs=4000, seed=7):
        rnd = random.Random(seed); hit = 0
        for _ in range(runs):
            bal = peak = 1.0
            for _ in range(trades):
                bal *= 1 + (risk * rr if rnd.random() < win else -risk)
                peak = max(peak, bal)
                if bal <= peak * (1 - dd): hit += 1; break
        return hit / runs
    r1 = sim(0.45, 2, 0.01, 200, 0.30); r5 = sim(0.45, 2, 0.05, 200, 0.30)
    D['risk-of-ruin-calculator'] = dict(
        title='Worked example: the same edge at two different sizes',
        rows=[('Win rate / reward / trades', '45% / 2R / 200 trades'), ('Expectancy per trade', '+0.35R'), ('Risk 1% per trade: chance of a 30% drawdown', ('under 1%' if r1 < 0.01 else 'about ' + pc(r1 * 100, 0))),
              ('Risk 5% per trade: chance of a 30% drawdown', 'about ' + pc(r5 * 100, 0))],
        note='Same strategy, same win rate, same reward. Only the size changed. These are simulation results (4,000 runs), so expect small differences each time you run it.',
        mistakes=['Believing a positive expectancy protects you from a deep drawdown.', 'Sizing from the best-case run instead of the bad-luck case.', 'Using a win rate from a small sample that will not repeat.'],
        rule='Choose size from the drawdown you can tolerate. The edge decides whether you win over time, the size decides whether you are still there to see it.')
    # risk reward
    D['risk-reward-calculator'] = dict(
        title='Worked example: entry $100, stop $95, target $110',
        rows=[('Risk per unit', '$5'), ('Reward per unit', '$10'), ('Risk-reward ratio', '2.0 (1 : 2)'), ('Break-even win rate', pc(100 / 3, 1)),
              ('Expectancy at a 40% win rate', '+0.20R'), ('Expectancy at a 30% win rate', '-0.10R')],
        note='A 40% win rate is profitable at 1:2, and a 30% win rate is not. The ratio only means something together with how often the trade works.',
        mistakes=['Choosing the target to make the ratio look good instead of where price can realistically reach.', 'Ignoring fees, which push the true break-even higher.', 'Cutting winners early while letting losers run, which destroys the planned ratio.'],
        rule='Write down the ratio and the win rate you need before the trade. If you cannot reach that win rate, the plan does not work.')
    return D

# ------------------------------------------------------------------ course lessons
COURSE = {
    'course-what-is-trading': dict(
        title='Scenario: what a small trade really looks like',
        body='Sam buys $200 of a coin at $50 and sells at $55. That is 4 coins, a $220 sale and a gross gain of $20. With a 0.1% fee on each side, fees are about $0.42, so the net profit is about $19.58. Notice what is missing: a signal, a prediction or a secret. A trade is a decision about price, size and exit, plus the cost of making it.',
        mistakes=['Thinking trading is predicting. It is managing risk while you are wrong more often than you expect.', 'Judging a trade by the outcome instead of by whether the plan was followed.', 'Starting with money you cannot afford to lose.']),
    'course-how-markets-work': dict(
        title='Scenario: the spread is the first cost',
        body='The best bid is $99.90 and the best ask is $100.10. The gap is $0.20, or 0.2%. If you buy at the ask and immediately sell at the bid, you lose $0.20 per coin before any fee. That is why a price on a chart is not a price you can trade at: you buy slightly above it and sell slightly below it.',
        mistakes=['Believing the last price is the price you will get.', 'Trading thin markets where the spread is wide.', 'Assuming a price move is news when it is only a trade hitting one side of the book.']),
    'course-how-to-read-candlestick-charts': dict(
        title='Scenario: reading one candle',
        body='On the 1-hour chart a candle opens at $100, reaches a high of $104, a low of $98 and closes at $102. It is green because it closed above its open. The body ($100 to $102) shows where the hour started and ended. The upper wick ($102 to $104) shows buyers pushed higher but could not hold it, and the lower wick ($98 to $100) shows sellers pushed lower but were rejected.',
        mistakes=['Memorising pattern names without checking trend and context.', 'Comparing a 1-minute candle with a daily candle as if they meant the same thing.', 'Reading a single candle as a signal.']),
    'course-leverage-for-beginners': dict(
        title='Scenario: $500 at 5x',
        body='You post $500 of margin at 5x leverage, so the position is worth $2,500. If price falls 10%, the position loses $250, which is half of your margin. Liquidation is roughly where the price has fallen about 19.5%, because 1 divided by 5 is 20%, less a 0.5% maintenance margin. The same trade at 20x has a cushion of only about 4.5%.',
        mistakes=['Choosing leverage by how much you could win.', 'Not checking the liquidation price before opening the trade.', 'Adding margin to a losing position instead of closing it.']),
    'course-order-types': dict(
        title='Scenario: $1,000 market order in a thin book',
        body='You place a market buy for $1,000. The first few coins fill at $100.00, but the order has to climb the asks and the average fill ends up at $100.05, which is 0.05% worse. That is $0.50 of slippage. On a calm major coin it is negligible. On a thin coin, or a bigger order, the same mistake can cost many times more. A limit order would have avoided it, at the price of maybe not filling.',
        mistakes=['Using market orders on illiquid coins.', 'Placing a stop-limit with the limit too close to the stop.', 'Not checking that a limit order has actually filled before you assume you are in the trade.']),
    'course-position-sizing': dict(
        title='Scenario: Ana sizes her first trade',
        body='Ana has $2,000 and decides to risk 1%, which is $20. Her entry is $50 and her stop is $48, so the stop distance is $2. She can buy 10 coins, a $500 position. If the stop is hit she loses about $20. If she had wanted to buy 40 coins "because it feels right", the same stop would cost $80, or 4% of her account.',
        mistakes=['Letting confidence decide the size.', 'Putting the stop where the position size works instead of where the chart says the idea is wrong.', 'Risking a bigger percentage after a win.']),
    'course-stop-loss-and-risk-reward': dict(
        title='Scenario: a 1:2 plan written before the entry',
        body='Entry $100, stop $96, target $108. The risk is $4 and the reward is $8, a ratio of 1:2, so the plan breaks even at a 33.3% win rate. If you expect to win about four trades in ten, each trade carries an expectancy of about +0.2R before costs. The numbers are written down before the order is placed, so the exit does not get decided in the middle of a move.',
        mistakes=['Moving the stop further away after the price approaches it.', 'Taking profit early because a small gain feels safe, while still letting losses run to the stop.', 'Setting a target that is far outside the recent range.']),
    'course-trading-costs': dict(
        title='Scenario: the true price of a $1,000 round trip',
        body='A trade has a 0.1% fee each side ($2 in total), a spread of 0.1% ($1) and slippage of about 0.05% ($0.50). That is about $3.50, or 0.35% of the trade. Price must move more than 0.35% in your favour just to get you back to even. Do ten such trades a day and the costs alone are 3.5% a day before the market has done anything.',
        mistakes=['Ignoring the cost of frequent small trades.', 'Not checking fees at higher volume tiers or with a discount token.', 'Forgetting funding when comparing futures to spot.']),
    'course-trading-plan-and-journal': dict(
        title='Scenario: what 20 journal entries reveal',
        body='After 20 logged trades, a trader has 8 wins averaging +1.8R and 12 losses of -1R. The result is (8 x 1.8 - 12) / 20, or about +0.12R per trade. That is barely above zero, so the journal says the edge, if there is one, is small and costs matter. The same journal might also show that the three worst losses all happened after skipping the plan.',
        mistakes=['Journaling only the winners.', 'Writing results but not the reason for the trade or how you felt.', 'Reviewing too rarely to catch repeating mistakes.']),
    'course-trading-psychology': dict(
        title='Scenario: doubling after a loss',
        body='On a $5,000 account the plan risks $50 per trade. After a loss, a frustrated trader doubles the next size to win it back, then doubles again. Four losses in a row at $50, $100, $200 and $400 costs $750, which is 15% of the account. The same four losses at a fixed $50 cost $200, or 4%. The emotion does not change the odds of the next trade, but it changes the cost of the streak.',
        mistakes=['Revenge trading after a loss.', 'Moving the stop to avoid being wrong.', 'Trading when tired, angry or chasing a price that already moved.']),
    'course-trend-support-resistance': dict(
        title='Scenario: a range and what breaks it',
        body='Price has moved between $90 and $100 for two weeks and bounced off $90 three times. The $90 area is support because buyers have repeatedly stepped in there. If a candle closes at $88 on strong volume, the idea that buyers will defend $90 is wrong, and your plan should already say what you do then. Levels are places where decisions get made, not guarantees.',
        mistakes=['Drawing a dozen levels on the chart until every price is near one.', 'Treating a wick through a level as a break without waiting for a close.', 'Entering only because price is at a level with no plan for being wrong.']),
    'course-first-30-days': dict(
        title='Scenario: a sample 30-day scorecard',
        body='After 30 days on paper, a beginner has 22 logged trades, 9 wins averaging +1.6R and 13 losses of -1R. The result is (9 x 1.6 - 13) / 22, about +0.06R per trade. That is not proof of anything: 22 trades is a tiny sample. The real result of the month is that every trade has a plan, a size and a note, which is the habit you will take to real money.',
        mistakes=['Going live after a week of paper profits.', 'Changing the strategy every few days so nothing is ever tested.', 'Skipping the journal because the paper money is not real.']),
}

# ------------------------------------------------------------------ rendering
def render_calc(d):
    rows = ''.join('<div><dt>%s</dt><dd>%s</dd></div>' % (E(k), E(v)) for k, v in d['rows'])
    li = ''.join('<li>%s</li>' % E(m) for m in d['mistakes'])
    return ('<!-- px:start -->\n<section class="mk-section px-extras" aria-label="Worked example and common mistakes">\n'
            '  <div class="mk-section-head"><span class="mk-eyebrow">Check your understanding</span><h2>%s</h2></div>\n'
            '  <div class="px-grid">\n'
            '    <div class="px-card px-example"><dl class="px-rows">%s</dl><p class="px-note">%s</p></div>\n'
            '    <div class="px-side">\n'
            '      <div class="px-card px-mistakes"><h3>Mistakes this calculator helps you catch</h3><ul>%s</ul></div>\n'
            '      <div class="px-card px-rule"><h3>Rule of thumb</h3><p>%s</p></div>\n'
            '    </div>\n  </div>\n</section>\n<!-- px:end -->\n') % (E(d['title']), rows, E(d['note']), li, E(d['rule']))

def render_course(d):
    li = ''.join('<li>%s</li>' % E(m) for m in d['mistakes'])
    return ('<!-- px:start -->\n<div class="px-lesson">\n<div class="px-card px-scenario"><h2>%s</h2><p>%s</p></div>\n'
            '<div class="px-card px-mistakes"><h3>Common beginner mistakes here</h3><ul>%s</ul></div>\n</div>\n<!-- px:end -->\n') % (E(d['title']), E(d['body']), li)

FEATURES = ('<!-- px:start -->\n<section class="mk-section px-extras" id="session" aria-labelledby="session-h">\n'
 '  <div class="mk-section-head"><span class="mk-eyebrow">In practice</span><h2 id="session-h">One trading session, start to finish</h2>\n'
 '  <p>How the pieces fit together when you actually use the terminal.</p></div>\n'
 '  <ol class="px-steps">\n'
 '    <li><b>Look</b><span>Open a pair and read live Binance candles with the indicators you use. Switch timeframes to see whether the move is a blip or a trend.</span></li>\n'
 '    <li><b>Check the book</b><span>Use depth and the trade tape to see where size is sitting, and how much slippage a market order would cost.</span></li>\n'
 '    <li><b>Ask the AI desk</b><span>Get a structured read grounded in news, funding and sentiment, with trade levels computed from live prices. It describes conditions, it does not predict.</span></li>\n'
 '    <li><b>Practise it first</b><span>Place the trade in the paper account at live prices and see how the plan behaves with no real money on the line.</span></li>\n'
 '    <li><b>Set alerts, then step away</b><span>Add a price alert at the level that matters and close the tab. The plan, not the screen, decides what happens next.</span></li>\n'
 '  </ol>\n</section>\n<!-- px:end -->\n')

def inject(path, block, before_patterns):
    p = ROOT / path
    s = p.read_bytes().decode('utf8')
    nl = '\r\n' if '\r\n' in s else '\n'
    s = s.replace('\r\n', '\n')
    s = re.sub(r'<!-- px:start -->.*?<!-- px:end -->\n?', '', s, flags=re.S)
    for pat in before_patterns:
        m = re.search(pat, s)
        if m:
            s = s[:m.start()] + block + s[m.start():]
            break
    else:
        raise SystemExit('no anchor in ' + path)
    p.write_bytes(s.replace('\n', nl).encode('utf8'))

def add_script(path, tag):
    p = ROOT / path
    s = p.read_bytes().decode('utf8')
    if tag in s: return
    nl = '\r\n' if '\r\n' in s else '\n'
    i = s.rfind('</body>')
    s = s[:i] + tag + nl + s[i:]
    p.write_bytes(s.encode('utf8'))

if __name__ == '__main__':
    for slug, d in calc_data().items():
        inject(slug + '.html', render_calc(d), [r'<section class="mk-section" id="[a-z-]*faq">', r'<section class="mk-section" aria-labelledby="related-heading">', r'</main>'])
    for slug, d in COURSE.items():
        inject(slug + '.html', render_course(d), [r'<div class="cc-take"'])
    inject('features.html', FEATURES, [r'<div class="mk-cta-band">', r'</main>'])
    for page in ['blog.html', 'crypto-calculators.html']:
        add_script(page, '<script src="js/page-extras.js?v=20261126" defer></script>')
    print('enriched', len(calc_data()), 'calculators,', len(COURSE), 'lessons, features')