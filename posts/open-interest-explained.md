title: Open interest in crypto futures: what it measures and what it doesn't
meta_title: Open Interest in Crypto Futures Explained
og_title: Open Interest in Crypto Futures: What It Measures and What It Doesn't
date: 2026-11-05
section: Mechanics
readtime: 6 min read
emoji: 📈
color: rgba(79,216,232,.08)
summary: Open interest explained: how it differs from volume, how to read it together with price, and why a rising number is not a bullish or bearish signal on its own.
card_summary: Open interest counts the futures contracts still open. Here's how it differs from volume and how to read it with price and funding.
keywords: open interest crypto, what is open interest, open interest vs volume, crypto futures open interest, open interest and price, how to read open interest
related: funding-rate-explained, spot-vs-futures, round-number-levels
---
Open interest is one of the most quoted numbers in crypto derivatives and one of the most misread. People see it climbing and announce that the market is bullish, or see it fall and announce a trend is dead. Neither conclusion follows from the number alone. Here is what it actually measures and how to use it without over-reading it.

## What open interest counts

[Open interest](glossary#open-interest) is the total size of futures contracts that have been opened and not yet closed. Every futures trade has two sides: someone long and someone short. When a new long and a new short are created, open interest goes up. When an existing long and an existing short close against each other, it goes down.

It is a measure of how much money is currently committed to positions, not of how much trading happened.

## Open interest versus volume

[Volume](glossary#volume) counts every trade, whether it opens a new position, closes an old one, or just swaps hands. Open interest counts only what remains open at the end.

> **Example:** Alice buys 1 BTC contract from Bob. Both are opening new positions, so open interest rises by 1. Later Alice sells her contract to Carol, who takes over the long. Volume has now counted two trades, but open interest is still 1, because the same single long position exists, only with a new owner. When Carol sells it back to Bob to close his short, open interest finally falls by 1.

This is why a day with very high volume can leave open interest almost unchanged: lots of trades, but no net change in how many positions exist.

## Reading it together with price

Open interest only becomes informative when you read it alongside price. The four combinations below are a standard way to describe what is happening to positioning. They describe the past move, not the next one.

| Price | Open interest | A common reading |
|---|---|---|
| Rising | Rising | New money is entering and leaning long |
| Rising | Falling | Shorts are closing, which can mean a [short squeeze](glossary#short-squeeze) rather than fresh demand |
| Falling | Rising | New money is entering and leaning short |
| Falling | Falling | Longs are closing or being liquidated, so leverage is leaving the market |

These are interpretations, not rules. A rising price with rising open interest can still reverse immediately. What the table does give you is a way to ask a better question than "is it up or down": is the move being driven by new positions or by existing ones closing?

## Why high open interest matters for risk

High open interest means there is a lot of leveraged exposure on the table. If price moves sharply against the more crowded side, many positions hit their [liquidation price](glossary#liquidation-price) at around the same time. Forced closing adds to the move, which can trigger more liquidations, a chain reaction called a [liquidation cascade](glossary#liquidation-cascade).

So open interest is better thought of as a measure of fragility than of direction. A market with low open interest can still move a lot, but a market with very high open interest relative to its size has more potential for sudden, violent moves in either direction.

## Pairing it with funding

Open interest tells you how much is committed. The [funding rate](glossary#funding-rate) tells you which side is paying to hold. Together they say more than either alone:

- High open interest with strongly positive funding suggests many longs are paying to stay in. Crowded and expensive positions can unwind quickly.
- High open interest with funding near zero suggests positioning is large but balanced.

Our guide to [funding rates](funding-rate-explained) goes through the mechanics and a worked example of what funding actually costs.

## How to measure it fairly

A few details trip people up when comparing open interest across assets or time:

- **Units differ.** Some sources quote contracts or coins, others quote the dollar value. Dollar value rises when price rises even if no new positions open, so compare in the same unit.
- **Scale it.** A $2 billion open interest means something very different for Bitcoin than for a small coin. Looking at open interest relative to market cap, or relative to its own recent range, is more meaningful than the raw figure.
- **Exchanges differ.** Each exchange reports its own open interest, and aggregated figures depend on which venues are included.

## What it cannot do

Open interest cannot tell you who is long and who is short in total, because every contract has both. It cannot tell you direction. And it cannot tell you the timing of any move. What it can do is show how much leverage the market is carrying, which is useful context for deciding how much leverage you want to carry yourself. If you want to see what a given leverage level means for your own position, the [liquidation price calculator](liquidation-price-calculator) is a good place to start.