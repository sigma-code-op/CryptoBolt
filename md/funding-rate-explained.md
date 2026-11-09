# Crypto Funding Rate: Positive vs Negative | CryptoBolt

> What the crypto funding rate on a perpetual contract measures, why it flips positive and negative, and how to read it alongside open interest.

Source: https://cryptobolt.io/funding-rate-explained.html

Open any [perpetual futures](https://cryptobolt.io/glossary.html#perpetual-futures) contract and there's a small percentage sitting next to the price, updating every few hours. Most traders glance past it. It's worth slowing down on, because the [funding rate](https://cryptobolt.io/glossary.html#funding-rate) is one of the few numbers on the screen that tells you what other traders are actually positioned for, not just where price has been.

## What it's actually for

Perpetual futures never expire, which is what makes them convenient — and also what creates a problem: with no expiry date to force the contract price back to the real spot price, the two can drift apart indefinitely. The funding rate is the fix. It's a periodic payment exchanged directly between long and short traders, sized so that staying on the more crowded side of the trade becomes slightly costly. That constant pressure is what keeps the perpetual's price anchored near spot without anyone needing to settle the contract.

[Glossary entry](https://cryptobolt.io/glossary.html#funding-rate)

## Reading positive vs. negative

- **Positive funding**: longs pay shorts. This usually means more traders are positioned long than short — demand for upside exposure is outrunning the other side of the trade, and the market is paying a premium to hold it.
- **Negative funding**: shorts pay longs. Short positioning is crowded relative to long positioning, often during a fast selloff or heavy hedging activity.

Neither direction is inherently bullish or bearish on its own. A modest positive rate during a steady uptrend is normal, unremarkable positioning. A sharply positive rate that keeps climbing, especially alongside rising open interest, is a different signal — it means leveraged long positioning is getting crowded, and crowded positioning is exactly what fast liquidation cascades are made of.

## A worked example: what funding actually costs

The part beginners miss is that funding is charged on the full position size, not on your margin. At 10x leverage, that $10,000 position is backed by about $1,000 of margin, so the same $1 payment is 0.1% of your own capital every period, and the year-long $1,095 would exceed your entire margin. That is the pressure working as designed: staying on the crowded side of a leveraged trade gets expensive if you stay long enough. If you hold a long while funding is negative, the direction flips and you receive the payment instead.

## Why it matters more paired with open interest

Funding rate alone tells you the direction of the crowd. [Open interest](https://cryptobolt.io/glossary.html#open-interest) tells you the size of it. A high funding rate with flat or falling open interest often just means a small, stubborn group of traders is paying up to stay positioned — not much fuel for a violent move either way. The same funding rate with open interest climbing fast is a more crowded, more fragile setup: more leveraged positions sitting on one side, more that would need to unwind if price turns against them. CryptoBolt's terminal surfaces both side by side for exactly this reason — funding rate by itself is a data point, funding rate next to open interest starts to look like a read on positioning risk.

## What counts as a "good" or normal funding rate?

There's no fixed threshold, but as a rough anchor: funding in the roughly 0.01%–0.02% range per 8-hour period (roughly 11–22% annualized if it never changed) is typical, unremarkable positioning on most major pairs. Rates that push toward 0.05%–0.1% per period (well over 50% annualized), especially while climbing, mean the crowd is leaning hard on one side and paying a real premium to stay there — that's the range where leveraged positioning starts getting fragile. If you're holding a leveraged position while funding runs against you, remember that funding is a running cost that eats into your margin over time, on top of — not instead of — your [liquidation price](https://cryptobolt.io/glossary.html#liquidation-price), which is set mainly by leverage and entry price, not by funding. (You can test this with the [liquidation price calculator](https://cryptobolt.io/liquidation-price-calculator.html).) CryptoBolt's terminal shows estimated liquidation price alongside live funding for exactly this reason: they're two separate risks that both need watching.

## The catch

Funding settles on a fixed schedule, every eight hours on many venues (some contracts use shorter intervals), so a single reading is a snapshot, not a trend. What's more useful is watching how it moves over the funding periods leading into a big move: rate climbing steadily into a rally, then spiking right before it stalls, is a very different picture than a rate that's been calm the whole way up. Treat it the same way you'd treat the Fear & Greed index or round-number levels — informative in isolation, more useful stacked with price action, volume, and open interest than read alone.

## Where to go next

- [Spot vs. perpetual futures](https://cryptobolt.io/spot-vs-futures.html): how leverage and liquidation work alongside funding.
- [Liquidation price calculator](https://cryptobolt.io/liquidation-price-calculator.html): see how leverage moves your liquidation price.
- [Funding fee calculator](https://cryptobolt.io/funding-fee-calculator.html): turn a funding rate into dollars per day, month and year.
- [Reading the Fear & Greed index](https://cryptobolt.io/fear-and-greed-index.html): another crowd-positioning signal, from sentiment instead of derivatives.
- [Bitcoin price](https://cryptobolt.io/bitcoin.html): live BTC/USDT with halving, ETF and funding context.
- [Ethereum price](https://cryptobolt.io/ethereum.html): live ETH/USDT with staking, gas and ETH/BTC context.
- [Why round numbers act like support and resistance](https://cryptobolt.io/round-number-levels.html): where price tends to react.
- [Glossary](https://cryptobolt.io/glossary.html): plain-English definitions for every term used here.

[See live funding rates next to open interest in the terminal →](https://cryptobolt.io/app.html)

**Go deeper.** Chapter 14 of our 160-page ebook [Crypto Clarity](https://cryptobolt.io/ebook.html) covers futures, leverage and liquidation, with worked examples and self-test questions. A free 16-page sample is available on the [ebook page](https://cryptobolt.io/ebook.html).

Keep reading

## More from the blog

Mechanics · 5 min read

### Spot vs. perpetual futures: what actually changes

Ownership, leverage, liquidation, and funding rate — the mechanics that actually differ between holding the asset and trading a derivative on it.

Read the post

Link: https://cryptobolt.io/spot-vs-futures.html

Sentiment · 4 min read

### Reading the Fear & Greed index without overreacting to it

The Fear & Greed index compresses volatility, momentum, and sentiment into one 0–100 score. Here's what it's actually good for, and why it isn't a trade signal on its own.

Read the post

Link: https://cryptobolt.io/fear-and-greed-index.html

Reality Check · 5 min read

### Why CryptoBolt doesn't predict crypto prices (and what to look at instead)

"Bitcoin price prediction today" is one of the most-searched phrases in crypto. Here's why we don't answer it, and what's more useful to look at instead.

Read the post

Link: https://cryptobolt.io/why-we-dont-predict-crypto-prices.html

---
CryptoBolt is a market-data and education tool, not an exchange and not financial advice. Contact: info@cryptobolt.io
