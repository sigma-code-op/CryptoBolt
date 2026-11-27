# Risk of Ruin Calculator for Crypto Traders | CryptoBolt

> Free risk of ruin calculator: simulate win rate, reward-to-risk and risk per trade to see the odds of a deep drawdown and how your size compares with Kelly.

Source: https://cryptobolt.io/risk-of-ruin-calculator

Written and checked by the CryptoBolt founder · Reviewed November 14, 2026 · [How we build and check our tools](https://cryptobolt.io/editorial-policy)

Win rate (%)

Reward per 1 risked (R)

Risk per trade (% of account)

Number of trades

Drawdown you call ruin (%)

Fees + slippage per trade (R) (optional)

Median account after the trades

Bad luck case (5th percentile)

Good luck case (95th percentile)

Typical worst drawdown (median)

Bad-case worst drawdown (95th percentile)

Chance of finishing below the start

Expectancy per trade

Your risk versus the Kelly fraction

Simulated with a fixed random seed, so the same inputs always give the same answer. Trades are assumed independent, with the same win rate and risk each time, and risk is a percentage of the current balance. Real results will differ. Educational tool, not financial advice.

## What “risk of ruin” means here

Classic risk-of-ruin formulas ask for the chance of losing everything, which is not how real traders get hurt. Long before an account reaches zero, a deep drawdown ends the strategy: confidence goes, rules get broken, or a prop firm or exchange closes the account. So this calculator asks a more useful question: **what is the chance that your account falls by a damaging amount from its own peak at some point during a run of trades?** You choose the number. Thirty percent is the default; try 20 if you cannot stomach more, or 50 if you can.

The default example — a 40% win rate, a 1:2 reward-to-risk ratio and 1% risked per trade — is a plan with a healthy positive expectancy of +0.20R per trade. Even so, the simulation shows a typical worst drawdown of about 12% across 200 trades, and a bad-luck drawdown of about 21%. A plan that wins on average still has to survive its own variance.

## How the simulation works

1. Start an account at 1.00 and set the running peak to 1.00.
2. For each trade, draw a random number. If it is below your win rate the account grows by `risk × (ratio − cost)`; otherwise it shrinks by `risk × (1 + cost)`. Risk is applied to the current balance, so wins and losses compound.
3. After every trade, compare the balance with the highest balance so far. The largest fall from a peak is that run’s maximum drawdown.
4. Repeat for thousands of independent accounts. The share of runs whose maximum drawdown reached your ruin level is the answer; the sorted results give the median and the good and bad luck cases.

A fixed random seed makes the output repeatable, so nothing changes when you reload the page. The calculator uses up to 5,000 accounts for speed, while the tables below use 20,000, so a figure for the same plan can differ by a fraction of a percentage point between them.

## How often a plan hits a 30% drawdown, by risk per trade

Each cell is the chance that an account suffers a drawdown of at least 30% from a peak at some point within 200 trades, before fees. The columns are five different plans; the rows are how much of the account is risked on each trade.

| Risk per trade | 35% wins at 1:2 | 40% wins at 1:2 | 50% wins at 1:1.5 | 50% wins at 1:1 | 30% wins at 1:3 |
| --- | --- | --- | --- | --- | --- |
| 0.5% | <0.05% | <0.05% | <0.05% | <0.05% | <0.05% |
| 1% | 6.54% | 0.24% | <0.05% | 2.38% | 3.01% |
| 2% | 58.1% | 19.4% | 3.48% | 41.7% | 48.0% |
| 3% | 90.1% | 61.6% | 24.7% | 76.6% | 88.1% |
| 5% | 99.9% | 98.7% | 84.6% | 98.6% | >99.9% |
| 10% | >99.9% | >99.9% | >99.9% | >99.9% | >99.9% |

Read down any column and the lesson is blunt: **risk per trade matters more than almost anything else you choose.** The 40%-at-1:2 plan has a 0.24% chance of a 30% drawdown at 1% risk, 19% at 2%, 62% at 3%, and is almost guaranteed to suffer one at 5%. Same win rate, same ratio, same edge; only the bet size changed. At 10% per trade, every plan in the table hits the drawdown.

Read across a row and you see the cost of a thin edge. The 35%-at-1:2 plan has an expectancy of only +0.05R per trade, and at 2% risk it has a 58% chance of a 30% drawdown, three times the rate of the 40% plan at the same size. The 50%-at-1:1 column has no edge at all (before fees), yet at 1% risk it still has a few percent chance of a 30% drawdown: drawdowns are a property of variance, not only of losing strategies.

## What a run of 200 trades can look like

Here is the same 40% win rate at 1:2 followed through to the end of 200 trades, for different risk levels. The account is shown as a multiple of its starting value.

| Risk per trade | Median account | Bad luck (5th pct) | Good luck (95th pct) | Typical worst drawdown | Bad-case worst drawdown |
| --- | --- | --- | --- | --- | --- |
| 0.5% | 1.21x | 1.03x | 1.43x | 6.0% | 11.0% |
| 1% | 1.46x | 1.05x | 2.03x | 11.8% | 20.9% |
| 2% | 2.04x | 1.06x | 3.92x | 23.1% | 38.3% |
| 3% | 2.74x | 1.03x | 7.26x | 32.9% | 52.5% |
| 5% | 4.35x | 0.87x | 21.81x | 49.8% | 73.0% |
| 10% | 6.98x | 0.29x | 165.17x | 78.9% | 95.2% |

Higher risk raises the median outcome, which is why aggressive sizing is tempting. But look at the bad-luck column: at 5% risk the bad case is already a loss (0.87x), and at 10% it is a 71% loss (0.29x) while the good case is absurdly large. Those huge numbers are the survivors of a very uneven game, and the drawdown columns show the price: at 10% risk a typical account falls about 79% from a peak at some point. Sizing is a trade-off between growth and the chance you are still trading to enjoy it.

## Kelly: the ceiling, not the target

The Kelly fraction is the bet size that maximises long-run growth for a given edge: `win rate − (loss rate ÷ ratio)`. For 40% at 1:2 it is 0.40 − 0.60 ÷ 2 = 10% of the account per trade. The calculator shows what fraction of Kelly your chosen risk represents. Betting full Kelly is mathematically optimal only if your win rate and ratio are known exactly, and they are not: they are estimates from a limited number of past trades. If your true edge is smaller than you think, full Kelly is a ruinous over-bet. That is why many traders risk a small fraction of Kelly, often a quarter or less. In the table above, 10% risk equals full Kelly for the 40%-at-1:2 plan, and it produces a typical drawdown near 79%.

## What the simulation leaves out

- **Your win rate is an estimate.** If you measured 40% over 50 trades, the true figure could easily be 30% or 50%. Run the calculator at a lower win rate than you measured to see how fragile the plan is.
- **Trades are not independent.** Losing streaks tend to bunch in some market regimes. The [losing streak calculator](https://cryptobolt.io/losing-streak-calculator) shows how long runs of losses naturally occur even when trades are independent.
- **Constant risk and constant ratio.** Real traders vary both. Taking bigger risks after a win, or after a loss to “make it back”, makes outcomes worse than shown.
- **Leverage and liquidation.** This models percentage risk per trade, not margin. A leveraged position can be liquidated before your stop, which breaks the assumption that a loss is limited to your planned risk. Check that with the [liquidation probability calculator](https://cryptobolt.io/liquidation-probability-calculator).
- **Fees and slippage.** Use the cost field to include them. A cost of 0.05R per trade sounds small and quietly erodes a thin edge.

## How to use it

1. Enter the win rate and ratio from your own trade log, or from a [paper trading](https://cryptobolt.io/crypto-paper-trading) record if you are still testing a plan. Use a deliberately lower win rate for a stress test.
2. Choose a ruin level you would genuinely treat as a signal to stop and review, not a number you hope to avoid.
3. Lower the risk per trade until the chance of that drawdown is one you can accept, then set the size of every trade with the [position size calculator](https://cryptobolt.io/position-size-calculator).
4. Pair the result with the [risk-reward calculator](https://cryptobolt.io/risk-reward-calculator) to check that the ratio and break-even win rate you assumed are realistic for your levels.

Check your understanding

## Worked example: the same edge at two different sizes

Win rate / reward / trades

45% / 2R / 200 trades

Expectancy per trade

+0.35R

Risk 1% per trade: chance of a 30% drawdown

under 1%

Risk 5% per trade: chance of a 30% drawdown

about 90%

Same strategy, same win rate, same reward. Only the size changed. These are simulation results (4,000 runs), so expect small differences each time you run it.

### Mistakes this calculator helps you catch

- Believing a positive expectancy protects you from a deep drawdown.
- Sizing from the best-case run instead of the bad-luck case.
- Using a win rate from a small sample that will not repeat.

### Rule of thumb

Choose size from the drawdown you can tolerate. The edge decides whether you win over time, the size decides whether you are still there to see it.

FAQ

## Risk of ruin calculator FAQ

### What is risk of ruin in trading?

It is the probability that a trading account suffers a loss large enough to end the strategy. Here we define ruin as a drawdown of a size you choose, measured from the account’s highest balance, and estimate its probability over a set number of trades with a simulation.

### What risk per trade is safe?

There is no universally safe number, but the tables show that risk per trade has an outsized effect on drawdown odds. A plan with a healthy edge had about a 0.24% chance of a 30% drawdown at 1% risk per trade and about 62% at 3% over 200 trades. Many traders keep risk at 1% or below for that reason.

### How is this different from the Kelly criterion?

Kelly gives the bet size that maximises long-run growth if your edge is known exactly. Risk of ruin shows how rough the ride is at a given size. The calculator shows both, including what share of full Kelly your chosen risk represents, because betting full Kelly on an overestimated edge is dangerous.

### Why is my chance of ruin high even though my expectancy is positive?

Positive expectancy describes the average over many trades. Variance still produces losing streaks and drawdowns on the way, and with a thin edge or a large bet size those can be deep. Lowering risk per trade is the most effective way to cut the odds.

### What win rate and ratio should I enter?

Use your own results from a trade log or paper trading record, and then test a lower win rate, because past results overstate the future more often than they understate it. Reward per 1 risked is the average win divided by the average loss, in R.

### Does this include fees and slippage?

Optionally. The cost field subtracts a fixed amount of R from each win and adds it to each loss. Leave it at zero for a pure strategy view, or try 0.03 to 0.1 to see how trading costs eat into a thin edge.

### Is the result exact?

No. It is a simulation based on stated assumptions: independent trades, a constant win rate and a constant risk fraction. It uses a fixed seed, so it is repeatable, but it is an estimate of a model, not a prediction of your results.

Keep going

## Related calculators and guides

Calculator

### Losing streak calculator

How many losses in a row are normal for your win rate.

Open

Link: https://cryptobolt.io/losing-streak-calculator

Calculator

### Position size calculator

Size a trade from risk, entry and stop.

Open

Link: https://cryptobolt.io/position-size-calculator

Guide

### Position sizing and the 1% rule

Why small risk per trade keeps you in the game.

Open

Link: https://cryptobolt.io/position-sizing-and-the-one-percent-rule

---
CryptoBolt is a market-data and education tool, not an exchange and not financial advice. Contact: info@cryptobolt.io