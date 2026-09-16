title: Crypto funding rates: what the number on your futures screen means
meta_title: Crypto Funding Rate Explained: Positive vs Negative
og_title: Crypto Funding Rates Explained: What the Number Actually Means
date: 2026-09-16
section: Mechanics
readtime: 5 min read
emoji: 💸
color: rgba(74,222,128,.08)
summary: What the crypto funding rate on a perpetual futures contract actually measures, why it flips between positive and negative, and how to read it alongside open interest instead of as a standalone signal.
card_summary: The small percentage next to every perpetual contract quietly tells you which side of the market is crowded — here's how to actually read it.
keywords: crypto funding rate, funding rate explained, perpetual futures funding, positive vs negative funding rate, funding rate arbitrage, crypto funding rate history
---
Open any perpetual futures contract and there's a small percentage sitting next to the price, updating every few hours. Most traders glance past it. It's worth slowing down on, because the funding rate is one of the few numbers on the screen that tells you what other traders are actually positioned for, not just where price has been.

## What it's actually for

Perpetual futures never expire, which is what makes them convenient — and also what creates a problem: with no expiry date to force the contract price back to the real spot price, the two can drift apart indefinitely. The funding rate is the fix. It's a periodic payment exchanged directly between long and short traders, sized so that staying on the more crowded side of the trade becomes slightly costly. That constant pressure is what keeps the perpetual's price anchored near spot without anyone needing to settle the contract.

## Reading positive vs. negative

- **Positive funding**: longs pay shorts. This usually means more traders are positioned long than short — demand for upside exposure is outrunning the other side of the trade, and the market is paying a premium to hold it.
- **Negative funding**: shorts pay longs. Short positioning is crowded relative to long positioning, often during a fast selloff or heavy hedging activity.

Neither direction is inherently bullish or bearish on its own. A modest positive rate during a steady uptrend is normal, unremarkable positioning. A sharply positive rate that keeps climbing, especially alongside rising open interest, is a different signal — it means leveraged long positioning is getting crowded, and crowded positioning is exactly what fast liquidation cascades are made of.

## Why it matters more paired with open interest

Funding rate alone tells you the direction of the crowd. Open interest tells you the size of it. A high funding rate with flat or falling open interest often just means a small, stubborn group of traders is paying up to stay positioned — not much fuel for a violent move either way. The same funding rate with open interest climbing fast is a more crowded, more fragile setup: more leveraged positions sitting on one side, more that would need to unwind if price turns against them. CryptoBolt's terminal surfaces both side by side for exactly this reason — funding rate by itself is a data point, funding rate next to open interest starts to look like a read on positioning risk.

## The catch

Funding resets every eight hours on most venues, so a single reading is a snapshot, not a trend. What's more useful is watching how it moves over the funding periods leading into a big move: rate climbing steadily into a rally, then spiking right before it stalls, is a very different picture than a rate that's been calm the whole way up. Treat it the same way you'd treat the Fear & Greed index or round-number levels — informative in isolation, more useful stacked with price action, volume, and open interest than read alone.

[See live funding rates next to open interest in the terminal →](app.html)