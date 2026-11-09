# How to Calculate Crypto Profit and Loss | CryptoBolt

> Step by step: crypto profit and loss on spot and futures trades, including fees, average cost, break-even, ROE, funding and why losses are hard to recover.

Source: https://cryptobolt.io/how-to-calculate-crypto-profit-and-loss.html

It sounds trivial: you bought low and sold high, so you made money. In practice the number on your exchange screen and the number in your bank often disagree. The difference is almost always fees, several purchases at different prices, leverage or time. This guide builds the calculation up from a single spot trade to a leveraged position, so you can check any result by hand.

## Step 1: a simple spot trade

For a spot purchase with no fees, profit is the number of coins multiplied by the change in price.

**Profit = coins × (sell price − buy price)**

Buy 0.5 coins at $2,000 and sell at $2,600: 0.5 × $600 = $300, which is a 30% gain on the $1,000 spent. The percentage is the return on investment (ROI): profit divided by the amount invested.

## Step 2: add fees on both sides

Exchanges charge a fee on the buy and another on the sell, usually a percentage of the trade value. With a 0.1% fee each way, $1,000 buys about 0.4995 coins after the buy fee, and selling them at $2,600 returns about $1,297.40 after the sell fee. Net profit is about $297.40, or 29.74%. Fees look small on a big move, but they matter on small ones and for frequent traders. Run your own numbers in the [crypto ROI calculator](https://cryptobolt.io/crypto-roi-calculator.html).

## Step 3: several purchases mean an average cost

If you bought in several steps, your break-even is the weighted average price, not the simple average of the prices:

**Average price = total cost ÷ total coins**

Buy 0.1 coin at $60,000, 0.2 at $50,000 and 0.3 at $40,000: total cost $28,000 for 0.6 coin, an average of about $46,667, not $50,000. The [average price calculator](https://cryptobolt.io/crypto-average-price-calculator.html) does this for up to five buys. Remember that tax authorities may require a specific lot-matching method rather than an average.

## Step 4: realised versus unrealised

A position you still hold has an **unrealised** profit or loss: it exists on paper and changes every second. It becomes **realised** only when you sell. Mixing them up is how people feel richer or poorer than they are. Use your average cost and today's price to measure the unrealised figure, and the sale proceeds to measure the realised one.

## Step 5: leveraged futures

On a futures position, your margin controls a larger position, and profit and loss are measured on the full position value, not on your margin.

- **Position value** = margin × leverage
- **Units** = position value ÷ entry price
- **Gross PnL (long)** = units × (exit − entry); for a short, units × (entry − exit)
- **Fees** = fee rate × entry value + fee rate × exit value
- **Net PnL** = gross PnL − fees
- **ROE** (return on equity) = net PnL ÷ margin

A long at $60,000 closed at $63,000, with $1,000 margin, 10x leverage and a 0.05% fee per side, has a position of $10,000, a gross profit of $500, fees of about $10.25, net profit of $489.75 and an ROE of about 48.98%. The price moved 5%; the equity moved about 49%. Leverage multiplies both directions, so a 5% fall would have cost about half the margin plus fees. Use the [futures profit calculator](https://cryptobolt.io/crypto-profit-calculator.html) for your own trade and the [liquidation price calculator](https://cryptobolt.io/liquidation-price-calculator.html) to check the position would survive until your exit.

## Step 6: funding on perpetual contracts

Perpetual futures have no expiry, so exchanges use a [funding rate](https://cryptobolt.io/glossary.html#funding-rate) to keep the contract near the spot price. While you hold a position, you pay or receive funding at regular intervals. At 0.01% every eight hours on a $10,000 position, that is $1 per payment, $3 a day, about $90 a month: small for a day, meaningful for a month. The [funding fee calculator](https://cryptobolt.io/funding-fee-calculator.html) handles it, and [funding rates explained](https://cryptobolt.io/funding-rate-explained.html) shows why the sign changes.

## Step 7: the asymmetry of losses

A loss needs a larger gain to recover, because the base is smaller after the loss.

| Loss | Gain needed to get back to even |
| --- | --- |
| −10% | +11.1% |
| −20% | +25.0% |
| −50% | +100.0% |
| −75% | +300.0% |
| −90% | +900.0% |

This is the strongest argument for limiting risk per trade, which is covered in [position sizing and the 1% rule](https://cryptobolt.io/position-sizing-and-the-one-percent-rule.html).

## Common mistakes

- Comparing ROE with the price move as if they were the same number.
- Forgetting fees, especially on frequent or small trades.
- Using a simple average of prices when the buys were different sizes.
- Ignoring funding on a position held for weeks.
- Treating an unrealised gain as money in the bank.
- Assuming a leveraged position will last until the target without checking liquidation.

## A repeatable checklist

1. Write down entry, exit, size and fees before you trade. 2. Calculate the break-even price, not just the target. 3. For futures, calculate liquidation, funding and ROE as well as PnL. 4. After the trade, record the realised result, including fees, in a journal.

Tax rules for crypto vary widely, and none of the figures here is tax or financial advice.

Keep reading

## More from the blog

Risk · 6 min read

### Position sizing and the 1% rule: how big should a crypto trade be?

Decide how much you can lose first, then let the stop distance set the size. A worked example of the 1% rule and where leverage fits.

Read the post

Link: https://cryptobolt.io/position-sizing-and-the-one-percent-rule.html

Mechanics · 5 min read

### Crypto funding rates: what the number on your futures screen means

The small percentage next to every perpetual contract quietly tells you which side of the market is crowded — here's how to actually read it.

Read the post

Link: https://cryptobolt.io/funding-rate-explained.html

Mechanics · 5 min read

### Spot vs. perpetual futures: what actually changes

Ownership, leverage, liquidation, and funding rate — the mechanics that actually differ between holding the asset and trading a derivative on it.

Read the post

Link: https://cryptobolt.io/spot-vs-futures.html

---
CryptoBolt is a market-data and education tool, not an exchange and not financial advice. Contact: info@cryptobolt.io
