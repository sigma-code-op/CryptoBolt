# Open Interest in Crypto Futures Explained | CryptoBolt

> Open interest explained: how it differs from volume, how to read it together with price, and why a rising number is not a bullish or bearish signal on its own.

Source: https://cryptobolt.io/open-interest-explained

## At a glance

- Open interest counts contracts that are still open, not how many traded.
- Rising open interest means new positions are being added. Falling open interest means positions are being closed.
- Read it with price and funding: it shows how much leverage is sitting in the market, not which way it will break.

+1

open interest when two traders open a new contract

0

change when a contract only changes owner

2

metrics to pair with it: price and funding

Open interest is one of the most quoted numbers in crypto derivatives and one of the most misread. People see it climbing and announce that the market is bullish, or see it fall and announce a trend is dead. Neither conclusion follows from the number alone. Here is what it actually measures and how to use it without over-reading it.

## What open interest counts

[Open interest](https://cryptobolt.io/glossary#open-interest) is the total size of futures contracts that have been opened and not yet closed. Every futures trade has two sides: someone long and someone short. When a new long and a new short are created, open interest goes up. When an existing long and an existing short close against each other, it goes down.

It is a measure of how much money is currently committed to positions, not of how much trading happened.

## Open interest versus volume

[Volume](https://cryptobolt.io/glossary#volume) counts every trade, whether it opens a new position, closes an old one, or just swaps hands. Open interest counts only what remains open at the end.

This is why a day with very high volume can leave open interest almost unchanged: lots of trades, but no net change in how many positions exist.

## Reading it together with price

Open interest only becomes informative when you read it alongside price. The four combinations below are a standard way to describe what is happening to positioning. They describe the past move, not the next one.

| Price | Open interest | A common reading |
| --- | --- | --- |
| Rising | Rising | New money is entering and leaning long |
| Rising | Falling | Shorts are closing, which can mean a [short squeeze](https://cryptobolt.io/glossary#short-squeeze) rather than fresh demand |
| Falling | Rising | New money is entering and leaning short |
| Falling | Falling | Longs are closing or being liquidated, so leverage is leaving the market |

These are interpretations, not rules. A rising price with rising open interest can still reverse immediately. What the table does give you is a way to ask a better question than "is it up or down": is the move being driven by new positions or by existing ones closing?

## Why high open interest matters for risk

High open interest means there is a lot of leveraged exposure on the table. If price moves sharply against the more crowded side, many positions hit their [liquidation price](https://cryptobolt.io/glossary#liquidation-price) at around the same time. Forced closing adds to the move, which can trigger more liquidations, a chain reaction called a [liquidation cascade](https://cryptobolt.io/glossary#liquidation-cascade).

So open interest is better thought of as a measure of fragility than of direction. A market with low open interest can still move a lot, but a market with very high open interest relative to its size has more potential for sudden, violent moves in either direction.

## Pairing it with funding

Open interest tells you how much is committed. The [funding rate](https://cryptobolt.io/glossary#funding-rate) tells you which side is paying to hold. Together they say more than either alone:

- High open interest with strongly positive funding suggests many longs are paying to stay in. Crowded and expensive positions can unwind quickly.
- High open interest with funding near zero suggests positioning is large but balanced.

Our guide to [funding rates](https://cryptobolt.io/funding-rate-explained) goes through the mechanics and a worked example of what funding actually costs.

## How to measure it fairly

A few details trip people up when comparing open interest across assets or time:

- **Units differ.** Some sources quote contracts or coins, others quote the dollar value. Dollar value rises when price rises even if no new positions open, so compare in the same unit.
- **Scale it.** A $2 billion open interest means something very different for Bitcoin than for a small coin. Looking at open interest relative to market cap, or relative to its own recent range, is more meaningful than the raw figure.
- **Exchanges differ.** Each exchange reports its own open interest, and aggregated figures depend on which venues are included.

## A stylised example: a leverage flush

A made-up but typical sequence shows how open interest and price interact. Treat it as a teaching story, not a record of a particular day.

Over several days price drifts up a few percent. Each day open interest climbs, which means new positions are being opened, and funding rises as more traders pile on the long side. The market looks calm because nothing dramatic has happened, but a lot of borrowed money is leaning one way.

Then a modest drop of 3% to 4% happens, perhaps from a headline or a large sell order. Some highly leveraged longs hit their liquidation prices. Their positions are closed by force, and those forced sales push price down further, which triggers the next group of liquidations. Within minutes, open interest drops sharply, because positions are being closed, and price may overshoot lower than the news justifies.

The lesson is not that every rise in open interest ends this way. Most do not. It is that high and rising open interest combined with high funding tells you the market is crowded, and crowded markets can move abruptly. That is a good moment to check your own leverage and your distance to liquidation.

## What it cannot do

Open interest cannot tell you who is long and who is short in total, because every contract has both. It cannot tell you direction. And it cannot tell you the timing of any move. What it can do is show how much leverage the market is carrying, which is useful context for deciding how much leverage you want to carry yourself. If you want to see what a given leverage level means for your own position, the [liquidation price calculator](https://cryptobolt.io/liquidation-price-calculator) is a good place to start.

### Myth

High volume and high open interest are the same thing.

### Reality

Volume counts every trade. Open interest only grows when new positions are opened, and falls when they are closed.

## Quick check

Alice sells her open long to Carol. What happens to open interest?

Keep reading

## More from the blog

Mechanics · 5 min read

### Crypto funding rates: what the number on your futures screen means

The small percentage next to every perpetual contract quietly tells you which side of the market is crowded — here's how to actually read it.

Read the post

Link: https://cryptobolt.io/funding-rate-explained

Mechanics · 5 min read

### Spot vs. perpetual futures: what actually changes

Ownership, leverage, liquidation, and funding rate — the mechanics that actually differ between holding the asset and trading a derivative on it.

Read the post

Link: https://cryptobolt.io/spot-vs-futures

Mechanics · 4 min read

### Why round numbers act like support and resistance

Price stalls at $30,000 and $50,000 more often than chance would suggest. Here's why round numbers actually matter.

Read the post

Link: https://cryptobolt.io/round-number-levels

---
CryptoBolt is a market-data and education tool, not an exchange and not financial advice. Contact: info@cryptobolt.io