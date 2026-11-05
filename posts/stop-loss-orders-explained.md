title: Stop-loss orders explained: stop-market, stop-limit and why they slip
meta_title: Stop-Loss Orders: Stop-Market vs Stop-Limit
og_title: Stop-Loss Orders Explained: Stop-Market, Stop-Limit and Why They Slip
date: 2026-11-05
section: Mechanics
readtime: 6 min read
emoji: 🛑
color: rgba(255,107,107,.08)
summary: How crypto stop-loss orders work, the difference between stop-market and stop-limit, what slippage and wicks do to them, and how to place a stop with a reason.
card_summary: Stop-market versus stop-limit, trigger prices, slippage and wicks: what a stop-loss really guarantees, and what it doesn't.
keywords: stop loss crypto, stop market vs stop limit, how stop loss works, stop loss slippage, crypto stop loss order, where to place stop loss
related: spot-vs-futures, how-to-read-an-order-book, funding-rate-explained
---
A stop-loss is the most common risk tool in trading, and one of the most misunderstood. Many people assume it guarantees an exit at a chosen price. It does not. What it guarantees depends on which kind you use, and understanding the difference is worth more than any particular stop level.

## What a stop-loss is

A [stop-loss](glossary.html#stop-loss) is an instruction that stays dormant until price reaches a level you set, called the trigger or stop price. At that moment it turns into a real order and tries to close your position. Until the trigger is reached, it is not in the [order book](glossary.html#order-book) at all, which means nobody can see it.

The key question is what kind of order it becomes when triggered.

## Stop-market versus stop-limit

| | Stop-market | Stop-limit |
|---|---|---|
| Becomes | A [market order](glossary.html#market-order) | A [limit order](glossary.html#limit-order) |
| Guarantees | That you get out, if there is anyone to trade with | The worst price you will accept |
| Does not guarantee | The exit price | That you get out at all |
| Main risk | [Slippage](glossary.html#slippage) in fast or thin markets | Price jumps past your limit and the order never fills |
| Fees | Taker | Often maker if it rests, taker if it fills immediately |

A stop-market prioritises certainty of exit over price. A stop-limit prioritises price over certainty. Neither is better in general. Which one fits depends on what you are protecting against.

> **Example:** You are long at $100 and want to be out if price falls to $95. With a stop-market at $95, a sudden drop that gaps through to $93 fills you around $93 or slightly lower. With a stop-limit with a trigger of $95 and a limit of $94.50, the same drop leaves your order unfilled at $93 because the price already passed your limit. You are still holding the position, now at a larger loss, and the order is sitting at $94.50 waiting for a bounce.

## Why stops slip

Slippage on a stop is the same mechanical effect described in our piece on [reading the order book](how-to-read-an-order-book.html): a market order fills against whatever is resting, and if size runs out at the best price it moves to the next one. A stop is more likely to suffer for two reasons.

- Stops cluster. Many traders place them at obvious levels, often just beyond a [round number](glossary.html#round-number-level) or a recent low. When price reaches that zone, many stop-market orders fire together and all demand liquidity at the same moment.
- The moment a stop triggers is usually the moment markets are moving fastest, which is when [liquidity](glossary.html#liquidity) is thinnest.

None of this is a reason to avoid stops. It is a reason to expect that your real exit may be worse than the number you typed in, and to size your position with that in mind.

## Wicks and the trigger price

Many exchanges let you choose what triggers the stop: the last traded price or the [mark price](glossary.html#mark-price). A brief spike on a single venue, a [wick](glossary.html#wick), can touch a last-price trigger and stop you out even though the market closes the candle back above your level. A mark-price trigger, which is derived from an index across venues, is less sensitive to that kind of single-exchange spike. Check which option your platform uses, because the default is not always the one you would choose.

## On futures: stops and liquidation

If you trade with [leverage](glossary.html#leverage), the stop and the [liquidation price](glossary.html#liquidation-price) interact. A stop that sits beyond your liquidation price is useless, because the exchange will close the position first. Work out your liquidation level before you pick a stop, and keep the stop comfortably inside it. The [liquidation price calculator](liquidation-price-calculator.html) can do that arithmetic for you.

## Placing a stop with a reason

The most common mistake is choosing a stop by feel or by a percentage that sounds comfortable. A stop works better when it is tied to something about the trade:

- **Invalidation.** Place it at the level where your reason for entering is clearly wrong, not at a random distance.
- **Volatility.** A stop tighter than the asset's normal movement will be hit by noise. Measures such as [ATR](glossary.html#atr) express typical movement in price terms and are one way to set a distance that fits the coin you are trading.
- **Size.** Once you know the stop distance, work backwards to the position size that makes the loss acceptable. That calculation is covered in our guide to [position sizing](position-sizing-and-the-one-percent-rule.html).

## Practice before it costs money

How a stop behaves in a fast market is hard to appreciate from a description. Using [paper trading](glossary.html#paper-trading) on live prices lets you see slippage and stop-outs happen with virtual funds, which is far cheaper than learning it with real ones.