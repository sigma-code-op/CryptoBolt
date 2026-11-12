# Risk-Reward Ratio and Win Rate Explained | CryptoBolt

> How risk-reward ratio and win rate combine into expectancy: two worked traders, a break-even table, losing streak maths and honest stops and targets.

Source: https://cryptobolt.io/risk-reward-ratio-and-win-rate

Ask a beginner what makes a good trader and the answer is usually "being right a lot". The people who last in markets tend to answer differently: they talk about how much they make when they are right compared with how much they lose when they are wrong. These two numbers, the win rate and the [risk-reward](https://cryptobolt.io/glossary#risk-reward) ratio, only mean something together. This article shows how they combine, why losing streaks are normal, and how to avoid fooling yourself with either number.

## Measuring in R

To compare trades of different sizes, measure results in R, where 1R is the amount you risk on a trade (the distance from entry to stop times your size). A trade stopped out at the stop is −1R. A trade that reaches a target twice as far as the stop is +2R. The [risk-reward ratio](https://cryptobolt.io/glossary#r-multiple) is the planned reward divided by the planned risk: with an entry at $65,000, a stop at $63,700 and a target at $69,000, the risk is $1,300, the reward is $4,000 and the ratio is about 1:3.08.

## Expectancy: the average result per trade

[Expectancy](https://cryptobolt.io/glossary#expectancy) combines the two numbers into the average result of a trade, in R:

**Expectancy = win rate × average win − loss rate × average loss**

If every win is the target and every loss is the stop, that becomes win rate × ratio − (1 − win rate). A positive number means the plan, if it works as described, makes money on average over many trades. A negative number means it does not, however good individual trades feel.

## Two traders, one lesson

Trader A wins 60% of trades but takes profit early, so wins are only 0.5R. Expectancy = 0.60 × 0.5 − 0.40 × 1 = **−0.10R** per trade. Despite winning most trades, A slowly loses money.

Trader B wins only 35% of trades but lets winners run to 3R. Expectancy = 0.35 × 3 − 0.65 × 1 = **+0.40R** per trade. B is wrong almost two times out of three and still makes money.

The numbers are illustrative, and real trades do not always reach their full targets or stop out exactly. The point is the structure: a high win rate with small wins and large losses is fragile, and a low win rate with large wins can be robust.

## The break-even win rate

For any ratio there is a win rate below which the plan loses money (before fees): 1 ÷ (1 + ratio).

| Risk-reward | Break-even win rate |
| --- | --- |
| 1 : 0.5 | 66.7% |
| 1 : 1 | 50.0% |
| 1 : 1.5 | 40.0% |
| 1 : 2 | 33.3% |
| 1 : 3 | 25.0% |
| 1 : 5 | 16.7% |

Fees and slippage push the real break-even higher, so leave a margin. The [risk-reward calculator](https://cryptobolt.io/risk-reward-calculator) computes the break-even win rate and expectancy for your own levels.

## Losing streaks are normal

A common mistake is to abandon a sound plan after a few losses in a row. Even good plans produce streaks. If your win rate is 35%, each trade loses with probability 65%, so any particular run of five trades has about an 11.6% chance of being all losses (0.65 to the power of five). Over a hundred trades, runs like that are expected to appear. With 1% risk per trade, five losses in a row cost about 4.9% of the account: uncomfortable, survivable. With 10% risk per trade the same streak costs about 41% and ends the plan. Streaks are why [position sizing](https://cryptobolt.io/position-sizing-and-the-one-percent-rule) matters as much as the ratio.

## Setting stops and targets honestly

- **Stop where the idea is wrong.** A stop placed only to make the ratio look better will be hit by ordinary movement. See [stop-loss orders explained](https://cryptobolt.io/stop-loss-orders-explained) for how stops fill and slip.
- **Target where the market has a reason to go.** Previous highs and lows, round numbers and retracement levels are more credible than an arbitrary multiple. The [Fibonacci calculator](https://cryptobolt.io/fibonacci-retracement-calculator) lists common levels.
- **Account for costs.** Fees and funding reduce the reward and increase the loss. The [futures profit calculator](https://cryptobolt.io/crypto-profit-calculator) shows the net figure.
- **Do not widen a stop to avoid a loss.** That changes the ratio after the fact and is the usual way small losses become large ones.

## Do not trust a short sample

A win rate measured over twenty trades is nearly meaningless: luck dominates. Record every trade, including the ones you skipped for rule violations, and look at expectancy over at least a few dozen trades before changing anything. If you are new, test the plan with virtual funds in [paper trading](https://cryptobolt.io/crypto-paper-trading) first. Beware also of survivorship bias: the traders who post screenshots of 10R wins rarely show the dozens of −1R trades around them.

## A short checklist

1. Write the entry, stop and target before you place the trade. 2. Check the ratio and the break-even win rate. 3. Ask honestly how often similar setups reach the target. 4. Size the position so the stop costs a small, fixed percentage. 5. Log the result in R, fees included.

Nothing here is financial advice; leveraged trading can lose more than you expect, and past results do not predict future ones.

Keep reading

## More from the blog

Risk · 6 min read

### Position sizing and the 1% rule: how big should a crypto trade be?

Decide how much you can lose first, then let the stop distance set the size. A worked example of the 1% rule and where leverage fits.

Read the post

Link: https://cryptobolt.io/position-sizing-and-the-one-percent-rule

Mechanics · 6 min read

### Stop-loss orders explained: stop-market, stop-limit and why they slip

Stop-market versus stop-limit, trigger prices, slippage and wicks: what a stop-loss really guarantees, and what it doesn't.

Read the post

Link: https://cryptobolt.io/stop-loss-orders-explained

Reality Check · 6 min read

### How much can you realistically make day trading crypto?

"Make $1000 a day" is everywhere. Here's what peer-reviewed research on day traders actually found — and a more honest way to test a strategy first.

Read the post

Link: https://cryptobolt.io/day-trading-crypto-realistic-returns

---
CryptoBolt is a market-data and education tool, not an exchange and not financial advice. Contact: info@cryptobolt.io