title: How to read a crypto order book (and what it can't tell you)
meta_title: How to Read a Crypto Order Book
og_title: How to Read a Crypto Order Book (and What It Can't Tell You)
date: 2026-11-05
section: Mechanics
readtime: 6 min read
emoji: 📚
color: rgba(79,216,232,.08)
summary: How to read a crypto order book: bids, asks, the spread, market depth and slippage, plus the limits of what a snapshot of resting orders can tell you.
card_summary: Bids, asks, the spread and depth: what the live order book shows, and why a snapshot of resting orders is not a forecast.
keywords: how to read order book crypto, crypto order book explained, bid ask spread crypto, market depth crypto, order book depth, slippage crypto
related: spot-vs-futures, round-number-levels, why-we-dont-predict-crypto-prices
---
Every price you see on a crypto chart is the result of a queue of orders waiting to be filled. That queue is the [order book](glossary.html#order-book), and learning to read it explains a lot of things that otherwise look random: why a market order sometimes fills at a worse price than the one on screen, why thin altcoins jump around, and why the same trade size can be trivial on one pair and expensive on another.

## The two sides of the book

The book has two columns. The **bids** are buy orders: each one says "I will buy this much at this price or lower." The **asks** (also called offers) are sell orders: "I will sell this much at this price or higher." Bids are listed from the highest price down, asks from the lowest price up, so the two best prices sit next to each other in the middle.

The highest bid is the best price you can sell at right now. The lowest ask is the best price you can buy at right now. The gap between them is the [spread](glossary.html#spread).

| Term | What it means | Who it serves |
|---|---|---|
| Best bid | Highest price a buyer is currently willing to pay | Someone selling immediately |
| Best ask | Lowest price a seller is currently willing to accept | Someone buying immediately |
| Spread | Best ask minus best bid | The cost of trading instantly |
| Depth | How much size is resting at each price level | Anyone placing a large order |

## What happens when you place an order

A [limit order](glossary.html#limit-order) joins the book at the price you choose and waits. If nobody trades with it, it just sits there. This is why limit orders are called "making" liquidity, and why exchanges usually charge a lower fee for them; the difference is explained in the glossary entry on [maker and taker](glossary.html#maker-taker) fees.

A [market order](glossary.html#market-order) does the opposite. It does not wait. It takes whatever is already resting on the other side, starting with the best price and working outward until your size is filled.

> **Example:** Suppose the asks for a coin look like this: 2 coins at $100.00, 3 coins at $100.10, and 5 coins at $100.30. You send a market order to buy 4 coins. The first 2 fill at $100.00. The next 2 fill at $100.10. Your average price is $100.05, not the $100.00 you saw on screen. That difference is [slippage](glossary.html#slippage).

Slippage is not a malfunction. It is the direct, mechanical result of your order being larger than the size available at the best price.

## Depth: how much size sits where

The number next to each price is the quantity resting there. Adding those quantities up as you move away from the middle price gives the [order book depth](glossary.html#order-book-depth). A deep book has a lot of size close to the current price, so a big order moves the price only slightly. A shallow book has gaps, so the same order walks through several price levels.

This is the main reason large-cap pairs such as BTC/USDT behave differently from small altcoins. With the same $50,000 market order, one book barely notices and the other can move by several percent. If you trade smaller coins, check the depth before you check the chart. The terminal's depth view is built for exactly that.

## Reading imbalance, carefully

It is tempting to look at the book and see a forecast: far more bids than asks must mean price is going up. In practice that conclusion is unreliable, for three reasons.

- **Orders can be cancelled.** Resting orders cost nothing to remove. A large bid can vanish the moment price approaches it, which is sometimes called spoofing when it is done deliberately to create a false impression.
- **Hidden size exists.** Some orders are split into small pieces or placed only as price approaches, so the visible book understates real interest.
- **Both sides get hit.** A big wall of bids can be filled by sellers just as easily as it can hold price. Resting size tells you where orders are, not what the next trade will be.

So treat the book as a description of the present, not a prediction. It is excellent for judging the cost of getting in or out, and for seeing where size is concentrated, such as around a [round number level](glossary.html#round-number-level). It is a weak tool for guessing direction. That is the same reason CryptoBolt does not publish price forecasts, which we explain in [why we don't predict crypto prices](why-we-dont-predict-crypto-prices.html).

## A short checklist before a larger order

- Check the spread. A wide spread on a quiet pair means instant execution is expensive.
- Check the depth within 1% of the price. Compare it to your order size.
- Consider a limit order if you are not in a hurry, so you are not paying the spread.
- On futures, remember that your size also affects where a stop or a liquidation would actually fill. The [liquidation price calculator](liquidation-price-calculator.html) shows the theoretical level; the book decides how close to it you really get out.

The order book will not tell you where price is going. It will tell you, precisely, what it costs to trade at this moment, and that is information you can use on every single trade.