# Crypto Position Sizing and the 1% Rule | CryptoBolt

> Position sizing explained: work out trade size from stop distance and risk per trade, with a worked 1% rule example and what leverage does and doesn't change.

Source: https://cryptobolt.io/position-sizing-and-the-one-percent-rule

Most beginners decide how big a trade should be by asking how much they want to make. Experienced traders ask the opposite question: how much am I prepared to lose if this is wrong? That one change of question is the core of [position sizing](https://cryptobolt.io/glossary#position-sizing), and it matters more to long-term survival than almost any entry technique.

## Size comes from risk, not from conviction

Your position size is not a measure of how sure you are. It is the answer to a small piece of arithmetic that starts from three numbers you choose before entering:

- **Account size.** The money you are trading with.
- **Risk per trade.** The share of the account you accept losing if the stop is hit.
- **Stop distance.** The gap between your entry and your [stop-loss](https://cryptobolt.io/glossary#stop-loss).

The formula follows directly:

**Position size = (account size × risk per trade) ÷ stop distance per unit**

Notice what is missing: leverage never appeared. Risk is set by the size of the loss if you are wrong, and that is determined by the position and the stop, not by how you fund it.

## Why 1% is a common starting point

There is nothing magical about 1%, but the logic behind small percentages is solid. Consider how many consecutive losses would hurt you at different risk levels.

| Risk per trade | Account after 10 losses in a row | Gain needed to get back |
| --- | --- | --- |
| 1% | about 90.4% of the start | about 10.6% |
| 2% | about 81.7% of the start | about 22.4% |
| 5% | about 59.9% of the start | about 67% |
| 10% | about 34.9% of the start | about 187% |

Losses compound against you, and recovering is harder than it looks: a 50% drawdown requires a 100% gain just to break even. A small fixed percentage keeps a bad run survivable. Even strategies that win most of the time experience losing streaks, which is why [win rate](https://cryptobolt.io/glossary#win-rate) alone says little about safety. Our article on [realistic day-trading returns](https://cryptobolt.io/day-trading-crypto-realistic-returns) covers what research found about how rarely short-term traders stay ahead.

## Where leverage fits

[Leverage](https://cryptobolt.io/glossary#leverage) does not change how much you risk if your sizing is right. It changes how much [margin](https://cryptobolt.io/glossary#margin) you have to post to hold the position, and it moves your [liquidation price](https://cryptobolt.io/glossary#liquidation-price) closer or further away.

In the example above, the $1,000 position could be held with $1,000 of margin (1x) or $100 (10x). The loss at the stop is the same $50 either way. What differs is the cushion: at 10x the liquidation price is much closer to entry, and if it sits before your stop, the exchange will close you out first and the loss will be your full margin instead of $50. So the rule is simple: size by stop distance, and then verify that the liquidation price lies safely beyond the stop. The [position size calculator](https://cryptobolt.io/position-size-calculator) and the [liquidation price calculator](https://cryptobolt.io/liquidation-price-calculator) work through both steps.

## Common mistakes

- **Moving the stop to fit a bigger position.** The stop should come from the trade's logic. If you widen it to keep your size, you have raised your real risk.
- **Sizing to a round dollar amount.** "I always buy $1,000" means your risk changes with every stop distance. Risk, not notional, is the thing to keep constant.
- **Ignoring costs.** Fees and [slippage](https://cryptobolt.io/glossary#slippage) mean the real loss at a stop is a little more than the plan. Leave some margin of safety.
- **Treating several trades as independent.** Three long positions in highly correlated coins behave like one larger position when the market falls together.

## Using risk-reward

Once size is set by risk, you can evaluate whether a trade is worth taking by its [risk-reward](https://cryptobolt.io/glossary#risk-reward) ratio: how far to your target compared to how far to your stop. A trade risking $50 to make $150 needs to win far less often to be worthwhile than one risking $50 to make $50. Sizing and risk-reward are two halves of the same decision.

## Practising it

Position sizing is a habit more than a calculation. Doing it every time, on every trade, even in simulation, is how it becomes automatic. CryptoBolt's [paper trading](https://cryptobolt.io/crypto-paper-trading) account lets you practise sizing on live prices with virtual funds, and the numbers you build there are the same numbers you would use with real money.

**Go deeper.** Chapter 13 of our 160-page ebook [Crypto Clarity](https://cryptobolt.io/ebook) covers position sizing and risk management, with worked examples and self-test questions. A free 16-page sample is available on the [ebook page](https://cryptobolt.io/ebook).

Keep reading

## More from the blog

Mechanics · 6 min read

### Stop-loss orders explained: stop-market, stop-limit and why they slip

Stop-market versus stop-limit, trigger prices, slippage and wicks: what a stop-loss really guarantees, and what it doesn't.

Read the post

Link: https://cryptobolt.io/stop-loss-orders-explained

Mechanics · 5 min read

### Spot vs. perpetual futures: what actually changes

Ownership, leverage, liquidation, and funding rate — the mechanics that actually differ between holding the asset and trading a derivative on it.

Read the post

Link: https://cryptobolt.io/spot-vs-futures

Reality Check · 6 min read

### How much can you realistically make day trading crypto?

"Make $1000 a day" is everywhere. Here's what peer-reviewed research on day traders actually found — and a more honest way to test a strategy first.

Read the post

Link: https://cryptobolt.io/day-trading-crypto-realistic-returns

---
CryptoBolt is a market-data and education tool, not an exchange and not financial advice. Contact: info@cryptobolt.io