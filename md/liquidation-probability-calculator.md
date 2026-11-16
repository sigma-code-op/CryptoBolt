# Liquidation Probability Calculator for Crypto | CryptoBolt

> Free liquidation probability calculator: the odds a leveraged crypto position is liquidated, how long it takes, and the highest leverage for a risk you accept.

Source: https://cryptobolt.io/liquidation-probability-calculator

Written and checked by the CryptoBolt founder · Reviewed November 14, 2026 · [How we build and check our tools](https://cryptobolt.io/editorial-policy)

Entry price (USD)

Leverage (x)

Volatility preset (illustrative, not live)

Annualised volatility (%)

Time horizon (days)

Maintenance margin rate (%)

Yearly drift of price (%) (optional, 0 = none)

Risk you will accept (%) (for max leverage)

Liquidation price

Move needed to be liquidated

Size of that move in daily standard deviations

Time until a 5% chance of liquidation

Time until a 50% chance of liquidation

Highest leverage within your accepted risk

Within 1 day

Within 7 days

Within 30 days

Within 90 days

A model, not a forecast: it assumes price moves continuously with the volatility you enter, so it understates wicks, gaps and crashes. Treat the result as a minimum. Get the exact liquidation price for your exchange with the [liquidation price calculator](https://cryptobolt.io/liquidation-price-calculator). Educational tool, not financial advice.

## Why a liquidation price on its own is not enough

Every leverage guide tells you where your position gets liquidated. Almost none tell you *how likely* that is. Yet two positions with the same liquidation distance can carry completely different risk: a 9.5% cushion on a slow-moving large coin is a very different bet from the same cushion on a coin that routinely moves 10% in a day. The distance only becomes a risk once you compare it with how far price tends to travel in the time you plan to hold.

This calculator does that comparison. You give it leverage, a volatility figure and a holding period, and it returns the probability that price touches your liquidation level at least once, how long you can expect to survive, and the highest leverage that keeps the odds within a limit you choose. The default example — a 10x long with 45% annualised volatility held for a week — comes out at roughly 11%, which most people find higher than their gut feeling suggests.

## How the odds are calculated

1. **Distance to liquidation.** For an isolated position the cushion is roughly `1 ÷ leverage − maintenance margin rate`. At 10x with a 0.5% maintenance rate that is 10% − 0.5% = 9.5%, so a long is liquidated near 9.5% below entry. This is the same simplification used by our [liquidation price calculator](https://cryptobolt.io/liquidation-price-calculator).
2. **Convert it to a log distance.** Price moves multiply, so the model works in log terms: `a = −ln(1 − distance)` for a long and `a = ln(1 + distance)` for a short.
3. **Scale volatility to your horizon.** Annual volatility `σ` becomes `σ × √(days ÷ 365)` over the holding period.
4. **Apply the barrier-hitting formula.** With no drift, the chance that a random walk touches a level at least once is `2 × Φ(−a ÷ (σ√T))`, where Φ is the standard normal curve. This is twice the chance of *ending* beyond the level, because every path that finishes past it must have touched it, and half of the paths that touch it come back. With a drift the formula gains one extra term, which the calculator includes.

Two results fall out of the same maths. The time until the chance reaches 5% or 50% comes from solving the formula for time, and the maximum leverage for your accepted risk comes from solving it for distance. Both are shown above, so you can see not just how risky a setup is, but what would make it acceptable.

## Liquidation odds by leverage and holding period

The tables below were produced by the same functions that power the calculator. They show the chance that a **long** position is liquidated at least once, with a 0.5% maintenance margin rate and no drift. The three volatility levels are round illustrative assumptions, not measurements of any coin on any date; replace them with your own figure in the calculator.

| Leverage | Liquidation distance | 1 day | 7 days | 30 days | 90 days |
| --- | --- | --- | --- | --- | --- |
| 2x | 49.50% | <0.05% | <0.05% | <0.05% | 0.22% |
| 3x | 32.83% | <0.05% | <0.05% | 0.20% | 7.49% |
| 5x | 19.50% | <0.05% | 0.05% | 9.27% | 33.2% |
| 10x | 9.50% | <0.05% | 10.9% | 43.9% | 65.5% |
| 20x | 4.50% | 5.06% | 46.0% | 72.1% | 83.7% |
| 25x | 3.50% | 13.0% | 56.8% | 78.2% | 87.3% |
| 50x | 1.50% | 52.1% | 80.8% | 90.7% | 94.6% |
| 100x | 0.50% | 83.1% | 93.6% | 96.9% | 98.2% |

| Leverage | Liquidation distance | 1 day | 7 days | 30 days | 90 days |
| --- | --- | --- | --- | --- | --- |
| 2x | 49.50% | <0.05% | <0.05% | <0.05% | 3.43% |
| 3x | 32.83% | <0.05% | <0.05% | 3.27% | 21.8% |
| 5x | 19.50% | <0.05% | 1.60% | 24.4% | 50.2% |
| 10x | 9.50% | 0.33% | 26.7% | 59.2% | 75.7% |
| 20x | 4.50% | 17.6% | 60.9% | 80.5% | 88.7% |
| 25x | 3.50% | 29.5% | 69.2% | 84.8% | 91.2% |
| 50x | 1.50% | 65.7% | 86.7% | 93.5% | 96.3% |
| 100x | 0.50% | 88.3% | 95.6% | 97.9% | 98.8% |

| Leverage | Liquidation distance | 1 day | 7 days | 30 days | 90 days |
| --- | --- | --- | --- | --- | --- |
| 2x | 49.50% | <0.05% | <0.05% | 0.51% | 10.6% |
| 3x | 32.83% | <0.05% | 0.07% | 10.2% | 34.6% |
| 5x | 19.50% | <0.05% | 6.54% | 37.3% | 60.7% |
| 10x | 9.50% | 2.49% | 39.6% | 68.2% | 81.3% |
| 20x | 4.50% | 30.1% | 69.6% | 85.0% | 91.3% |
| 25x | 3.50% | 42.3% | 76.2% | 88.4% | 93.3% |
| 50x | 1.50% | 73.4% | 89.8% | 95.1% | 97.1% |
| 100x | 0.50% | 91.0% | 96.6% | 98.4% | 99.1% |

Three patterns stand out. First, the odds rise with leverage far faster than most people expect: on the Bitcoin-like table, going from 10x to 20x lifts the 30-day chance from about 44% to about 72%. Second, time is not on your side: even a 5x position that is almost safe over a week has roughly a one-in-three chance of being liquidated within three months if it is simply left open. Third, a high-leverage position is not “risky for a day” but “almost certain to be closed by the market if held”; 100x only survives because traders exit within minutes.

## The highest leverage for a 5% chance of liquidation

If you would accept a one-in-twenty chance of being liquidated over your holding period, this is the most leverage the model allows (long, 0.5% maintenance margin, no drift):

| Asset (assumed volatility) | Held 1 day | Held 7 days | Held 30 days |
| --- | --- | --- | --- |
| BTC (45% vol) | 20x | 8.3x | 4.4x |
| ETH (65% vol) | 14x | 6.0x | 3.2x |
| SOL (85% vol) | 11x | 4.7x | 2.6x |
| Large-cap altcoin (110% vol) | 9.0x | 3.8x | 2.1x |
| Small-cap / meme coin (160% vol) | 6.4x | 2.8x | 1.7x |

These numbers are well below the maximum leverage exchanges offer, and that gap is the point. Exchange limits describe what the matching engine will allow; they say nothing about what is sensible for a position you intend to hold. If your plan is to hold for a month, the table suggests staying in the low single digits on a Bitcoin-like asset and lower on anything more volatile.

## How long until a 5% and a 50% chance of liquidation

| Leverage (long) | BTC-like: 5% chance by | BTC-like: 50% chance by | SOL-like: 5% chance by | SOL-like: 50% chance by |
| --- | --- | --- | --- | --- |
| 3x | 74 days | 1.7 years | 21 days | 176 days |
| 5x | 22 days | 186 days | 6.2 days | 52 days |
| 10x | 4.7 days | 39 days | 1.3 days | 11 days |
| 20x | 24 hours | 8.4 days | 6.7 hours | 2.4 days |
| 50x | 2.6 hours | 22 hours | 0.7 hours | 6.1 hours |

This view turns the odds into a clock. At 20x on a Bitcoin-like asset, there is already a 5% chance of liquidation within about a day, and an even chance within about eight days. On a more volatile coin the clock runs much faster at the same leverage. A useful rule of thumb follows: **double the volatility and you must halve the leverage to keep the same odds.**

## What this model gets wrong, and which way

Every model simplifies. The ones below all push real-world risk *up*, which is why we call the output a minimum rather than an estimate.

- **Fat tails.** Crypto returns have more extreme days than a normal curve allows. Large moves that the model treats as one-in-a-thousand happen noticeably more often.
- **Wicks and gaps.** Liquidation engines work on the mark price, and thin-book spikes can push it through your level for a moment. The formula watches price continuously, which captures some of this, but real order books add more.
- **Volatility is not constant.** It clusters: calm periods are followed by violent ones. A volatility figure taken from a quiet month will understate a stormy one.
- **Funding and fees.** Perpetual futures charge [funding](https://cryptobolt.io/funding-rate-explained), and a position held for weeks slowly loses margin, moving liquidation closer. The [funding fee calculator](https://cryptobolt.io/funding-fee-calculator) shows the size of that drag.
- **Tiered margin and cross margin.** Larger positions often face higher maintenance rates, and cross margin shares your whole balance across positions. Both change the real liquidation point.

One effect pushes the other way: if you use a stop-loss, you will normally exit long before liquidation, so the real chance of losing your whole margin is lower than the figure shown. That is exactly why a stop-loss and a sensible size matter more than the leverage setting. See [stop-loss orders explained](https://cryptobolt.io/stop-loss-orders-explained) for how stops can slip in fast markets.

## Finding a volatility figure you can trust

The most useful input is your own. A simple recipe: take the last 30 to 90 daily closing prices, compute each day’s log return `ln(close ÷ previous close)`, take the standard deviation of those returns and multiply by `√365`. Crypto trades every day, so 365 is the right number. Because volatility changes, it is worth running the calculator twice, once with a calm figure and once with a stormy one, and sizing for the stormy case.

## Putting it into practice

1. Decide your holding period first. A trade you will close within hours faces very different odds from one you will hold for weeks.
2. Enter the volatility of the coin you actually trade, not a typical one.
3. Check the maximum leverage for your accepted risk. If your planned leverage is above it, cut the leverage or shorten the hold.
4. Place a stop-loss well inside the liquidation price and size the position from the stop distance with the [position size calculator](https://cryptobolt.io/position-size-calculator), not from the leverage setting.
5. Check that the planned reward justifies the risk with the [risk-reward calculator](https://cryptobolt.io/risk-reward-calculator), and test the whole plan with no real money in [crypto paper trading](https://cryptobolt.io/crypto-paper-trading).

FAQ

## Liquidation probability calculator FAQ

### What is the probability of getting liquidated at 10x leverage?

It depends on how volatile the coin is and how long you hold. With a Bitcoin-like 45% annualised volatility, a 10x long has roughly an 11% chance of being liquidated within a week and about a 44% chance within a month in this model. The calculator above gives the figure for your own inputs.

### How do I calculate the chance my position gets liquidated?

Work out the distance to liquidation (about 1 divided by leverage, minus the maintenance margin rate), convert it to a log distance, scale your annual volatility to your holding period, and apply the barrier-hitting formula 2 × Φ(−a / (σ√T)). The calculator does all four steps and shows the result.

### What leverage is safe for crypto futures?

No leverage is safe in an absolute sense, but you can choose a level for a risk you accept. In this model a Bitcoin-like asset held for a week stays under a 5% liquidation chance at about 8x, and a more volatile coin needs less. Using a stop-loss placed well inside the liquidation price lowers the real risk further.

### Why is the chance higher than the chance of ending below the liquidation price?

Because liquidation happens the moment price touches the level, even if it recovers later. For a driftless random walk the chance of touching a level is twice the chance of finishing beyond it, which is why the numbers here are larger than a quick estimate from a normal curve.

### Does this account for my stop-loss?

No. The output is the chance of reaching the liquidation price, which is the worst case if you have no stop. With a stop-loss between your entry and the liquidation price, you would normally exit earlier, so the chance of losing the full margin is lower, though a stop can still slip in a fast market.

### Can I trust the volatility presets?

Treat them as round illustrative figures, not live measurements. Volatility changes constantly. For a real decision, compute your own from recent daily closes (standard deviation of daily log returns times the square root of 365) and type it into the volatility box.

### Does it work for shorts?

Yes. Switch the toggle to Short and the model uses the barrier above your entry price. A short also faces the asymmetry that prices can rise without limit, so the practical risk of a short squeeze is not fully captured by a normal-distribution model.

Keep going

## Related calculators and guides

Calculator

### Liquidation price calculator

The exact price a leveraged long or short is force-closed.

Open

Link: https://cryptobolt.io/liquidation-price-calculator

Calculator

### Risk of ruin calculator

How likely a trading plan is to hit a deep drawdown.

Open

Link: https://cryptobolt.io/risk-of-ruin-calculator

Calculator

### Position size calculator

Size a trade from risk, entry and stop.

Open

Link: https://cryptobolt.io/position-size-calculator

---
CryptoBolt is a market-data and education tool, not an exchange and not financial advice. Contact: info@cryptobolt.io
