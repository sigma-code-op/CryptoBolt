# Free Crypto Backtester (Fees, Leverage & Monte Carlo)

> Free crypto backtester with fees, leverage and liquidation, an automatic out-of-sample test, optimizer, Monte Carlo and AI review. No signup.

Source: https://cryptobolt.io/crypto-backtester

Written and checked by the CryptoBolt founder · Formulas tested against worked examples on November 25, 2026 · [How we build and check our tools](https://cryptobolt.io/editorial-policy)

Describe a strategy in plain English (optional; works offline, no AI key needed)

## 1. Market and data

Coin

Market

Candle size

History length

## 2. Strategy

Strategy

## 3. Real-world costs and risk

Leverage (x) (1 = no leverage)

Fee per side (%) (taker fee on entry and exit)

Slippage per fill (%)

Stop-loss (%) (0 = none)

Take-profit (%) (0 = none)

Allow short trades (the strategy flips to short instead of going flat)

## Equity curve

## Does it survive out-of-sample?

## Monte Carlo stress test

## Trades

## Parameter optimizer

Tests 64 nearby settings on the first 70% of history only, then shows how each one did on the last 30%.

First parameter (rows)

Second parameter (columns)

## AI review of this backtest

Sends only the numbers above (not your browser data) to the CryptoBolt AI, which critiques overfitting risk, regime dependence and cost sensitivity, and suggests the next tests. Uses your Groq key from the [AI page](https://cryptobolt.io/ai) if you saved one, otherwise CryptoBolt's shared key when available.

Past results do not predict future results. Candles come directly from Binance’s public API in your browser; nothing you test is sent to CryptoBolt except the AI review, if you press it. Educational tool, not financial advice. [Practice with virtual funds →](https://cryptobolt.io/crypto-paper-trading)

## What makes this backtester different

Most free backtests show a smooth equity curve and one big number. That number is usually wrong in the direction you want it to be. This tool is built to argue against your strategy first:

- **No look-ahead.** A signal is read at the close of a candle and filled at the *next* open. Reading a signal and filling at the same close is the most common reason a backtest looks too good.
- **Costs are on by default.** A 0.05% fee and 0.02% slippage per side are pre-filled, because zero-cost backtests overstate every active strategy.
- **Leverage and liquidation are modelled.** At 10x an adverse move of about 9.5% ends the account. The simulator checks every candle’s high and low, not just the close.
- **An out-of-sample test is automatic.** The last 30% of history is held back and reported separately, next to buy and hold.
- **A Monte Carlo stress test** reshuffles your trades 1,000 times to show how much of the result depended on the order they arrived in.
- **The optimizer shows you its own failure.** It finds the best setting on the first 70% and then reveals what that setting did on the rest.

## How to read the results

Start with the **out-of-sample table**, not the headline return. A strategy that makes money in the first 70% and loses money in the last 30% fit the past; it did not find an edge. Then check the **trade count**: under about 30 trades, a win rate or profit factor is mostly noise. Compare the **max drawdown** with what you could actually sit through, and compare the return with **buy and hold** over the same dates, because a trend strategy that earns less than holding with a deeper drawdown has no reason to exist.

## Example 1: trading costs, on one reproducible series

The examples on this page run the real engine on a seeded synthetic price series (1,500 daily candles, 2.5% daily volatility, a small upward drift), so you can reproduce the numbers exactly. They are not real market data. The strategy is a 12/26 EMA crossover, long only, with no stop. Only the costs change:

| Costs per side | Trades | Total return | Rough cost drag (trades x round-trip cost) |
| --- | --- | --- | --- |
| 0% fee, 0% slippage | 25 | +52% | 0.0% |
| 0.05% fee, 0% slippage | 25 | +48% | 2.5% |
| 0.05% fee, 0.02% slippage | 25 | +46% | 3.5% |
| 0.1% fee, 0.05% slippage | 25 | +41% | 7.5% |
| 0.2% fee, 0.1% slippage | 25 | +30% | 15.0% |

With no costs the same rules return +52%; with a 0.1% fee and 0.05% slippage they return +41% on 25 trades. The drag grows with the number of trades, which is why a strategy that looks fine on daily candles can be destroyed on 5-minute candles: it simply trades more often.

## Example 2: what leverage does to the same strategy

Same series, same rules, costs at 0.05% fee and 0.02% slippage, only the leverage changes:

| Leverage | Total return | Max drawdown | Account liquidated? |
| --- | --- | --- | --- |
| 1x | +46% | -51% | No |
| 2x | +37% | -77% | No |
| 3x | -11% | -90% | No |
| 5x | -90% | -99% | No |
| 10x | -100% | -100% | Yes, account wiped out |
| 20x | -100% | -100% | Yes, account wiped out |

Leverage multiplies the drawdown as well as the gain, and past a certain point the question is no longer “how much does it make” but “does it survive its worst candle”. A stop-loss placed closer than the liquidation price keeps a leveraged account alive; check where yours sits with the [liquidation price calculator](https://cryptobolt.io/liquidation-price-calculator).

## Example 3: the optimizer will happily find a “winner” in pure noise

This is the experiment every trader should see once. We generated 20 price series with **zero drift and no pattern at all** (a pure random walk), and for each one ran the optimizer over 64 SMA-crossover settings on the first 70%. The best in-sample setting averaged **+33%**, and it was profitable in-sample on 14 of 20 series. On the unseen last 30% the same settings averaged **-4%**, almost exactly the -5% that a typical setting made. The “best” setting had no edge at all; it was just the luckiest of 64 tries.

One concrete case: on the second series the optimizer picked fast=3, slow=20, which made +38% in-sample and then -43% out-of-sample. On a real chart, the same thing happens whenever you tune parameters until the equity curve looks good. The defence is simple: only trust a setting that sits inside a block of neighbours that are also profitable, and that still works on the part of the history the optimizer never saw.

## Example 4: Monte Carlo on a trend-following profile

Take a strategy that wins 40% of the time, makes +9% on a winner and loses 3% on a loser, over 60 trades. In the order it happened it returns +164% with a worst drawdown of 6%. Reshuffling those same 60 trades 1,000 times gives a median return of +164% but a range from +31% (worst 5% of runs) to +432% (best 5%), and a median worst drawdown of 19%, with the severe end near 32%. The trades did not change, only their order. That spread is the part of a backtest that is luck, and it is the number to compare with your own risk tolerance. For the maths of losing streaks and ruin, see the [losing streak calculator](https://cryptobolt.io/losing-streak-calculator) and the [risk of ruin calculator](https://cryptobolt.io/risk-of-ruin-calculator).

## A checklist before you trust any backtest

- Is the trade count above about 30, ideally above 100?
- Does it make money in **both** the first 70% and the last 30% of history?
- Does it beat buy and hold **after** costs, or at least match it with a much smaller drawdown?
- Do the neighbouring parameter values also work, or is it one lucky cell?
- Is the Monte Carlo worst-5% outcome something you could live with?
- If you use leverage, is your stop closer than your liquidation price?
- Have you tried a different coin and a different time window? An idea that only works on one chart is a coincidence.

## What this backtester does not model

- **Funding payments** on perpetual futures, which cost or pay a few percent a year depending on the side. See the [funding fee calculator](https://cryptobolt.io/funding-fee-calculator).
- **The order book.** Fills happen at the open of the next candle plus your slippage setting; large orders on thin coins would fill worse.
- **Intrabar order.** If a stop and a target are inside the same candle, the stop is assumed to hit first, which is the conservative choice.
- **Survivorship bias.** You can only test coins that still trade. Coins that died are missing from every free dataset, including this one.
- **Taxes, borrowing costs and exchange-specific margin rules.** Liquidation uses a simple isolated formula with a 0.5% maintenance margin.
- **The future.** Markets change regime. A result describes how the rules would have behaved, not how they will.

When a strategy survives all of that, the next step is to practise it with virtual money, where every trade is real in everything but cost. The [paper trading simulator](https://cryptobolt.io/crypto-paper-trading) is built for that, and the position size for each trade can come from the [position size calculator](https://cryptobolt.io/position-size-calculator).

FAQ

## Crypto backtester FAQ

### Is this crypto backtester really free?

Yes. There is no account, no limit on runs and no paywall. The candles are downloaded straight from Binance’s public API in your browser, and the simulation runs locally on your device. The optional AI review uses CryptoBolt’s shared AI key or your own free Groq key.

### How many years of history can I test?

You can load up to 5,000 candles per run. That is about 13.7 years of daily candles, about 208 days of hourly candles, or about 2.3 years of 4-hour candles, limited by how long the coin has been listed on Binance. Use daily candles for long-term ideas and hourly or 4-hour candles when you need many trades.

### What does out-of-sample mean?

The first 70% of the candles are the in-sample part, where you design and tune a strategy. The last 30% are held back and used only to check it. If the strategy makes money in-sample but loses money out-of-sample, it was fitted to noise in the past rather than catching something that repeats.

### Why does the backtest fill at the next open instead of the close?

A candle is only known to be closed once it has finished, so a rule that reads the close can only act after it. Filling at that same close assumes you traded at a price you could not have known in time. This tool reads the signal at the close and fills at the next candle’s open, plus slippage, which is the realistic version.

### Does it include funding fees and liquidation?

Liquidation is modelled: with leverage, an adverse move of about 1 divided by leverage, minus a 0.5% maintenance margin, wipes out the account, and it is checked against every candle’s high and low. Funding payments are not modelled, so long-held leveraged perpetual positions will look slightly better here than in real life.

### Can a good backtest still lose money live?

Yes. Fees, slippage and funding can differ from your assumptions, the market regime can change, and a strategy tuned on past data can simply be an accident of that data. A good backtest is a reason to test the strategy further with paper trading, not a reason to risk real money.

Keep going

## Related calculators and guides

Hub

### All crypto calculators

Every free CryptoBolt calculator in one place.

Open

Link: https://cryptobolt.io/crypto-calculators

Calculator

### Risk of ruin calculator

How likely a strategy is to blow up an account.

Open

Link: https://cryptobolt.io/risk-of-ruin-calculator

Calculator

### Losing streak calculator

How long a losing run to expect.

Open

Link: https://cryptobolt.io/losing-streak-calculator

Practice

### Crypto paper trading

Try the strategy with virtual funds.

Open

Link: https://cryptobolt.io/crypto-paper-trading

---
CryptoBolt is a market-data and education tool, not an exchange and not financial advice. Contact: info@cryptobolt.io