# Grid Bot Profit Calculator (After Fees & Range Exit)

> Free grid bot profit calculator: net profit per grid after fees, the minimum grid step, and what a drop below or rise above your range costs. No signup.

Source: https://cryptobolt.io/grid-bot-profit-calculator

Written and checked by the CryptoBolt founder · Formulas tested against worked examples on November 25, 2026 · [How we build and check our tools](https://cryptobolt.io/editorial-policy)

Lower price of the range (USD)

Upper price of the range (USD)

Number of grids

Investment (USD)

Current price (USD)

Fee per trade (%) (each buy and each sell)

Completed cycles per day (your estimate, not a forecast)

Average order size per grid

Grid step as % of price

Smallest step that breaks even

Average net profit per cycle

Profit per day at your cycle estimate

Simple annual rate of that estimate

Profit or loss if price falls to the bottom

Profit or loss if price rises to the top

Cycles needed to earn back the bottom loss

| If price moves in one direction to | Price | Value of the bot | Profit or loss | Value if you had just bought |
| --- | --- | --- | --- | --- |
| 10% below the range | $45,000 | $7,852.41 | -$2,147.59 | $7,492.51 |
| Bottom of range | $50,000 | $8,724.90 | -$1,275.10 | $8,325.01 |
| Start price | $60,000 | $9,994.77 | -$5.23 | $9,990.01 |
| Top of range | $70,000 | $10,468.92 | $468.92 | $11,655.01 |
| 10% above the range | $77,000 | $10,468.92 | $468.92 | $12,820.51 |

Spot grid with an equal coin quantity per grid. The scenario table follows a one-way move from the start price and adds no extra cycles, so it isolates the cost of leaving the range. It ignores slippage, funding (futures grids), minimum order sizes and tax. Educational tool, not financial advice. [Practice with virtual funds first →](https://cryptobolt.io/crypto-paper-trading)

## How this calculator works

A grid bot places buy orders below the current price and sell orders above it, evenly spaced between a lower and an upper price. Each time the price moves up one grid, a sell fills; each time it moves back down, the matching buy fills. Every completed buy-and-sell pair banks one grid profit. The calculator follows this setup:

- **Grid lines**: arithmetic grids use an equal price distance between lines; geometric grids use an equal percentage.
- **Quantity per grid**: every grid holds the same amount of the coin. The calculator picks the amount so that the waiting buy orders plus the coin bought at the start cost exactly your investment.
- **Profit of one cycle** = quantity × (upper line − lower line) − fee × quantity × (lower line + upper line).
- **Break-even step** = (1 + fee) ÷ (1 − fee) − 1. With a 0.1% fee per side that is about 0.2002%.
- **Range exit**: the value of the bot after a one-way move to a price outside the range, compared with simply buying the coin at the start price.

## Worked example: 20 grids between $50,000 and $70,000

With $10,000 invested, the start price at $60,000 and a 0.1% fee per trade, an arithmetic grid with 20 lines places 10 buy orders and starts with coin for 10 sell orders. Each grid order is about $500.00. The grid step is $1,000, which is 2.00% of the price at the bottom and 1.45% at the top. After fees one completed cycle nets between 1.25% and 1.80%, about $7.68 on average.

A geometric grid with the same range and grid count has an equal 1.70% step in every grid, so each cycle nets 1.49%.

## More grids does not mean more profit

Splitting the same range into more grids makes each step smaller and each order smaller. The profit per cycle falls, and the fees take a bigger share. More cycles complete, but only if the price actually travels that far. Here is a geometric grid on the same $50,000 to $70,000 range:

| Grids | Step per grid | Net per cycle | Order size | Average profit per cycle | Profit if every grid completes once |
| --- | --- | --- | --- | --- | --- |
| 5 | 6.96% | 6.75% | $2,000.00 | $136.77 | $683.86 |
| 10 | 3.42% | 3.22% | $1,000.00 | $33.10 | $331.02 |
| 20 | 1.70% | 1.49% | $500.00 | $7.72 | $154.43 |
| 50 | 0.68% | 0.47% | $200.00 | $0.98 | $49.18 |
| 100 | 0.34% | 0.14% | $100.00 | $0.14 | $14.18 |
| 200 | 0.17% | -0.03% | $50.00 | -$0.02 | -$3.30 |

Going from 20 to 200 grids shrinks the net profit per cycle from 1.49% to -0.03%. At 200 grids the step is only a little above what the fees take, so a small change in your fee tier or a bit of slippage can wipe out the edge.

## How fees set the smallest useful grid

Every cycle pays a fee on the buy and on the sell. If the grid step is smaller than the two fees together, the cycle loses money even though the bot reports a “profit” in price terms. The table shows the break-even step for common fee levels, and how many geometric grids fit in the $50,000 to $70,000 range while each cycle still nets about 0.3%:

| Fee per trade | Break-even grid step | Most grids for about 0.3% net per cycle |
| --- | --- | --- |
| 0.02% | 0.040% | 99 |
| 0.05% | 0.100% | 84 |
| 0.10% | 0.200% | 67 |
| 0.20% | 0.401% | 48 |

Fee levels depend on the exchange, your trading volume and whether you pay in the exchange token, so check your own tier before you rely on any number here.

## What happens when price leaves the range

This is the part most grid bot calculators leave out. Using the example above:

| Price moves one way to | Value of the bot | Profit or loss | Value if you had just bought | Profit or loss from just buying |
| --- | --- | --- | --- | --- |
| 10% below the range ($45,000) | $7,852.41 | -$2,147.59 | $7,492.51 | -$2,507.49 |
| Bottom of range ($50,000) | $8,724.90 | -$1,275.10 | $8,325.01 | -$1,674.99 |
| Start price ($60,000) | $9,994.77 | -$5.23 | $9,990.01 | -$9.99 |
| Top of range ($70,000) | $10,468.92 | $468.92 | $11,655.01 | $1,655.01 |
| 10% above the range ($77,000) | $10,468.92 | $468.92 | $12,820.51 | $2,820.51 |

If the price falls to the bottom of the range, the bot has bought every grid on the way down and holds coins worth less than it paid, a loss of -$1,275.10, which would take about 167 average cycles to earn back. That is still a smaller loss than buying and holding, because the bot bought gradually. If the price rises to the top, the bot has sold everything and holds cash, earning $468.92, while a holder would have made $1,655.01. Above the range the bot earns nothing more while the coin keeps rising.

## Arithmetic or geometric grid?

- **Arithmetic** works well for a tight range, where the percentage difference between the lowest and highest line is small. The bottom grids have a larger percentage step than the top grids.
- **Geometric** works better for a wide range, such as a range that spans 40% or more, because each grid earns about the same percentage.

## Choosing a range

A narrow range gives more cycles but a higher chance of the price leaving it. A wide range survives bigger moves but spreads the money across more grids, so each grid is smaller. Many traders pick the range from support and resistance levels they can see on the chart; the [Fibonacci retracement calculator](https://cryptobolt.io/fibonacci-retracement-calculator) can help mark them. To see how the position behaves if the price falls through the bottom, you can also check the maths of averaging down with the [average price calculator](https://cryptobolt.io/crypto-average-price-calculator).

## What this calculator does not model

- **Futures grids.** Grids on perpetual futures add leverage, liquidation risk and funding payments. Use the [liquidation price calculator](https://cryptobolt.io/liquidation-price-calculator) and the [funding fee calculator](https://cryptobolt.io/funding-fee-calculator) for those parts.
- **Slippage and minimum orders.** Exchanges reject orders below a minimum size, and thin books fill at worse prices.
- **Trailing grids and stop-losses.** Some bots move the range or close the bot at a stop price, which changes the outcome.
- **Tax.** Every completed cycle can be a taxable event in many countries.
- **The future.** The cycles-per-day input is your own guess. The calculator does not predict how often the price will cross your grid lines.

Before you run a real bot, practise reading the range and the risks with virtual funds in [crypto paper trading](https://cryptobolt.io/crypto-paper-trading), and read [why win rate and risk-reward matter together](https://cryptobolt.io/risk-reward-ratio-and-win-rate).

Check your understanding

## Worked example: one grid cycle between $100 and $101

Grid lines

$100 and $101

Quantity per grid

1 coin

Fee per side

0.1%

Gross profit

$1.00

Fees (buy at $100, sell at $101)

$0.201

Net profit of the cycle

$0.799

Break-even grid step

0.2002%

The grid step here is 1%, about five times the break-even step of 0.2%. If the lines were only 0.15% apart, every cycle would lose money after fees.

### Mistakes this calculator helps you catch

- Packing grid lines so tightly that the step is smaller than twice the fee.
- Setting a range the price can leave. Below it the bot holds the coin at a loss, above it the bot sits in cash.
- Judging a bot only on completed cycles and ignoring the unrealised loss from a price drop.

### Rule of thumb

Make the grid step at least three or four times the break-even step, and size the range for the move you actually expect.

FAQ

## Grid bot profit FAQ

### How do you calculate grid bot profit?

Each completed grid cycle earns the quantity per grid times the price step, minus the fee on the buy and the sell. In a geometric grid the net profit per cycle is the price step as a percentage, reduced by the fee on both legs. Total profit is the number of completed cycles times that amount, plus or minus the change in value of the coin the bot is holding.

### How many grids should a grid bot have?

Enough that every grid step is clearly larger than the round-trip fees, and few enough that each order stays above the exchange minimum. More grids give smaller profit per cycle but more cycles. With a 0.1% fee per side, a grid step has to be above about 0.2% just to break even, and most traders want a margin well above that.

### Can a grid bot lose money?

Yes. If the price falls below the bottom of the range, the bot is left holding coins bought on the way down, and the unrealised loss can be larger than all the grid profit collected. If the price rises above the top, the bot has sold everything and stops earning while the coin keeps rising.

### What is the difference between an arithmetic and a geometric grid?

An arithmetic grid uses the same price distance between lines, so the percentage step is larger at the bottom and smaller at the top. A geometric grid uses the same percentage between lines, so each cycle earns about the same percentage. Geometric grids suit wide ranges, arithmetic grids suit tight ranges.

### Is the daily profit estimate a forecast?

No. The calculator multiplies the net profit of an average cycle by the number of cycles per day that you type in. How many cycles actually complete depends on volatility and on how the price moves inside your range, which nobody can forecast. Use it to compare setups, not to predict income.

Keep going

## Related calculators and guides

Calculator

### DCA bot safety order calculator

Capital, average entry and take-profit price for every safety order.

Open

Link: https://cryptobolt.io/dca-bot-safety-order-calculator

Calculator

### Crypto average price calculator

Combine several buys into one weighted entry price.

Open

Link: https://cryptobolt.io/crypto-average-price-calculator

Calculator

### Fibonacci retracement calculator

Levels that help you choose a grid range.

Open

Link: https://cryptobolt.io/fibonacci-retracement-calculator

Calculator

### Liquidation price calculator

For grids that use futures and leverage.

Open

Link: https://cryptobolt.io/liquidation-price-calculator

---
CryptoBolt is a market-data and education tool, not an exchange and not financial advice. Contact: info@cryptobolt.io