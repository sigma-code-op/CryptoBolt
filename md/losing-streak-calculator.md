# Losing Streak Calculator: Losses in a Row | CryptoBolt

> Free losing streak calculator: the exact odds of 5, 8 or 12 losses in a row for your win rate and trade count, and what each streak costs your account.

Source: https://cryptobolt.io/losing-streak-calculator

Written and checked by the CryptoBolt founder · Reviewed November 14, 2026 · [How we build and check our tools](https://cryptobolt.io/editorial-policy)

Win rate (%)

Number of trades

Risk per trade (% of account)

Bad-luck streak (1 run in 20)

Rare streak (1 run in 100)

Account fall from the typical streak

Account fall from the bad-luck streak

Check a specific streak: losses in a row

Chance of at least one streak that long

Exact probabilities for independent trades with a constant win rate, not a simulation. Real markets can bunch losses together, so treat the figures as the natural floor of how bad streaks get. Educational tool, not financial advice.

## The question every trader asks after a bad week

“Is it normal to lose this many trades in a row?” Almost nobody can answer it with a number, so traders guess, and guesses are shaped by emotion. After five losses in a row people start suspecting that the strategy has stopped working, or that something is wrong with them. Sometimes that is true. More often, the streak was simply due.

Losing streaks are not a sign of a broken strategy; they are a mathematical certainty of any strategy that does not win almost every time. The only question is how long a streak to expect, and that has an exact answer. The calculator above gives it for your win rate and your number of trades. With a 40% win rate, for example, a run of 100 trades has a coin-flip chance of containing a streak of seven or more losses, and about a one-in-twenty chance of containing twelve.

## Why streaks surprise people

Our intuition expects randomness to look evenly mixed: win, lose, win, win, lose. True randomness is clumpier than that. If trades are independent, each loss is a fresh draw with the same loss probability, so a streak of *k* losses starting at any given trade has probability `qk` (where q is the loss rate). That sounds small. But a streak can start at any of dozens or hundreds of trades, and these tiny chances add up. This is the same reason a fair coin flipped 100 times contains a run of five heads in a row about 81% of the time, even though any single run of five has only a 3% chance.

## How the calculator finds exact odds

Rather than simulating, it tracks the current length of the losing streak through every trade as a probability distribution. On each trade, a win resets the streak to zero and a loss extends it by one; any probability that reaches the target length is moved to a “hit” bucket and counted. After the last trade, the hit bucket is the exact chance that a streak of at least that length occurred at least once. The “typical” streak is the longest length that appears in at least half of runs, and the bad-luck and rare streaks are the longest lengths appearing in at least 5% and 1% of runs.

## Longest losing streak by win rate and number of trades

Each cell shows two numbers: the typical longest streak (reached in at least half of runs), then the bad-luck streak (reached in at least one run in twenty). Trades are independent and the win rate is constant.

| Win rate | 50 trades | 100 trades | 250 trades | 500 trades | 1,000 trades |
| --- | --- | --- | --- | --- | --- |
| 30% | 8 / 15 | 10 / 17 | 13 / 20 | 15 / 22 | 17 / 24 |
| 40% | 6 / 11 | 7 / 12 | 9 / 14 | 11 / 16 | 12 / 17 |
| 50% | 5 / 8 | 6 / 9 | 7 / 11 | 8 / 12 | 9 / 13 |
| 60% | 4 / 6 | 4 / 7 | 5 / 8 | 6 / 9 | 7 / 10 |
| 70% | 3 / 5 | 3 / 5 | 4 / 6 | 5 / 7 | 5 / 7 |

Notice two things. First, streaks are longer than most people expect at every win rate: even a 60% win rate typically contains a four-loss streak within 50 trades, and a seven-loss streak within a thousand. Second, streak length grows slowly with the number of trades. Going from 100 to 1,000 trades multiplies the chances for a streak to start tenfold, yet at a 40% win rate it only lengthens the typical longest streak from 7 to 12. Streak length grows like a logarithm: a lot more trading adds only a few more losses in a row.

## What a streak costs your account

The table below turns a streak into a drawdown. Each cell is the fall in the account after *k* consecutive full-risk losses when a fixed percentage of the current balance is risked on each trade: `1 − (1 − risk)k`.

| Losses in a row | 0.5% risk | 1% risk | 2% risk | 3% risk | 5% risk | 10% risk |
| --- | --- | --- | --- | --- | --- | --- |
| 3 | 1.5% | 3.0% | 5.9% | 8.7% | 14.3% | 27.1% |
| 5 | 2.5% | 4.9% | 9.6% | 14.1% | 22.6% | 41.0% |
| 8 | 3.9% | 7.7% | 14.9% | 21.6% | 33.7% | 57.0% |
| 10 | 4.9% | 9.6% | 18.3% | 26.3% | 40.1% | 65.1% |
| 12 | 5.8% | 11.4% | 21.5% | 30.6% | 46.0% | 71.8% |
| 15 | 7.2% | 14.0% | 26.1% | 36.7% | 53.7% | 79.4% |
| 20 | 9.5% | 18.2% | 33.2% | 45.6% | 64.2% | 87.8% |

This is where position sizing turns from theory into something you can feel. A 40% win rate plan will, in half of its 100-trade runs, string together at least seven losses. At 1% risk per trade that costs about 7% of the account, which is irritating. At 5% risk the same ordinary streak costs about 30%, and the 12-loss streak that appears in one run in twenty costs 46%. The streak was identical; the damage was set entirely by the bet size. If you cannot afford to lose the amount in the cell for your win rate’s bad-luck streak, your risk per trade is too high. The [risk of ruin calculator](https://cryptobolt.io/risk-of-ruin-calculator) follows the same idea through a whole sequence of trades.

## The chance of a given streak within 100 trades

| Streak length | 30% win rate | 40% win rate | 50% win rate | 60% win rate |
| --- | --- | --- | --- | --- |
| 5+ | 99.9% | 97.6% | 81.0% | 45.9% |
| 8+ | 85.8% | 49.0% | 17.0% | 3.63% |
| 10+ | 58.0% | 20.5% | 4.41% | 0.58% |
| 12+ | 32.9% | 7.65% | 1.09% | 0.09% |

These are probabilities of seeing at least one streak of that length (or longer) in 100 trades. They are worth memorising in rough form. At a 50% win rate, a streak of eight losses has a 17% chance within 100 trades, which is nearly one run in six. At a 40% win rate it is a coin flip. A trader who has just lost eight in a row on a 40% system has experienced something that happens about half the time.

## When a streak is a warning and when it is noise

Maths cannot tell you whether the streak you are in is bad luck or a sign that something changed. It can tell you how unusual it is. As a rough guide:

- **Inside the typical range:** a streak no longer than the “typical” figure for your win rate and trade count is not evidence of anything. Keep to the plan.
- **Between typical and bad-luck:** uncommon, but it happens to roughly one trader in several. Check that you executed the plan as written before changing it.
- **Beyond the bad-luck figure:** this has under a 5% chance if your win rate is what you think it is. Treat it as a prompt to review, in case the market regime changed, or your true win rate is lower than your estimate, rather than as proof that the system is dead.

A better approach than reacting in the moment is to decide your response in advance. Many traders pre-commit to a drawdown level at which they pause, reduce size and review, so that the decision is not made while emotions are high. Which level is right for you is a personal choice, and nothing here is advice to trade at any size.

## Limits of the model

- **Independence.** The maths assumes each trade’s outcome is unrelated to the last. Real strategies often win in one market regime and lose in another, so real losses can cluster more than shown.
- **A single win rate.** Your true win rate is unknown and your measured one has an error range. If you are unsure, run the calculator at a lower win rate than you measured.
- **Full-size losses.** The drawdown table assumes each losing trade loses the full risk amount. Partial losses, break-even exits and slippage change the figures.

To size a trade from your risk, use the [position size calculator](https://cryptobolt.io/position-size-calculator); to check what your reward-to-risk and win rate imply, use the [risk-reward calculator](https://cryptobolt.io/risk-reward-calculator); and to practise surviving streaks without real money, try [crypto paper trading](https://cryptobolt.io/crypto-paper-trading).

Check your understanding

## Worked example: how often long losing streaks show up

50% win rate, 100 trades: at least 7 losses in a row

32%

40% win rate, 100 trades: at least 8 losses in a row

49%

Cost of 8 losses in a row at 1% risk

7.7% of the account

Cost of 8 losses in a row at 5% risk

33.7% of the account

Streaks that feel like proof the strategy is broken are often just arithmetic. What decides survival is the size you risk while the streak plays out.

### Mistakes this calculator helps you catch

- Changing the strategy after a streak that sits inside the normal range.
- Sizing as if streaks will not happen. At 5% risk, eight losses in a row takes about a third of the account.
- Assuming trades are independent when they are all long and the market is trending down.

### Rule of thumb

Plan for a streak twice as long as the one you consider likely, and pick a size that survives it.

FAQ

## Losing streak calculator FAQ

### How many losing trades in a row is normal?

It depends on your win rate and how many trades you take. With a 40% win rate, half of all 100-trade runs contain a losing streak of seven or more, and about one run in twenty contains a streak of twelve or more. The calculator gives the figures for your own win rate and trade count.

### How do I calculate the chance of a losing streak?

Track the current streak length through each trade: a win resets it, a loss extends it. The probability that a streak of a given length occurs at least once in a number of trades can be computed exactly this way, and that is what the calculator does. A single streak of k losses starting at a given trade has probability q to the power k, where q is the loss rate.

### How many losses in a row should make me stop trading?

There is no universal number. A streak within the typical range for your win rate is normal. One beyond the bad-luck figure has under a 5% chance if your win rate is what you think, so it is a reasonable prompt to review your execution and assumptions. Many traders also set a drawdown level in advance at which they pause and review.

### Does a higher win rate remove losing streaks?

No, it shortens them. At a 70% win rate over 100 trades the typical longest streak is still about three losses, with a one-in-twenty chance of five or more. Streaks only disappear when the win rate is close to 100%.

### How much does a losing streak cost my account?

With a fixed percentage risked per trade, a streak of k full-risk losses reduces the account by 1 minus (1 minus risk) to the power k. Ten losses at 1% risk costs about 9.6%, but at 5% risk it costs about 40%. The second table on this page covers the common cases.

### Do losing streaks mean my strategy stopped working?

Not by themselves. Long streaks are expected, even from a strategy with a positive edge. They become informative only when they are much longer than the calculator suggests for your win rate, or when they come with other evidence, such as changed market conditions or execution that has drifted from the plan.

Keep going

## Related calculators and guides

Calculator

### Risk of ruin calculator

How likely your plan is to hit a deep drawdown.

Open

Link: https://cryptobolt.io/risk-of-ruin-calculator

Calculator

### Risk-reward calculator

The ratio and the win rate it needs.

Open

Link: https://cryptobolt.io/risk-reward-calculator

Guide

### Risk-reward ratio and win rate

Why a 40% win rate can still work.

Open

Link: https://cryptobolt.io/risk-reward-ratio-and-win-rate

---
CryptoBolt is a market-data and education tool, not an exchange and not financial advice. Contact: info@cryptobolt.io