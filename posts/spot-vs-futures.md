title: Spot vs. perpetual futures: what actually changes
meta_title: Spot vs Futures Crypto Trading Explained
og_title: Spot vs. Perpetual Futures: What Actually Changes
date: 2026-08-24
section: Mechanics
readtime: 5 min read
emoji: ⚖️
color: rgba(79,216,232,.08)
summary: Spot vs perpetual futures crypto trading explained: ownership, leverage, liquidation price, and the funding rate — the mechanics that actually differ.
card_summary: Ownership, leverage, liquidation, and funding rate — the mechanics that actually differ between holding the asset and trading a derivative on it.
keywords: spot vs futures crypto, perpetual futures explained, crypto funding rate, liquidation price crypto, spot trading vs futures trading, crypto leverage explained
updated: 2026-10-09
related: funding-rate-explained, day-trading-crypto-realistic-returns, why-we-dont-predict-crypto-prices
---
Both show up as a price on a chart, which makes it easy to gloss over how differently they actually work underneath. Here is the short version before the detail:

| Feature | Spot | Perpetual futures |
|---|---|---|
| What you hold | The coin itself | A contract that tracks the price |
| Leverage | None | Optional, and the maximum depends on the coin |
| Can be liquidated | No | Yes |
| Profit if price falls | Only by selling what you already own | Yes, by going short |
| Ongoing cost | None while you hold (trading fees aside) | Funding payments, plus trading fees |
| Worst case | The asset goes to zero | Closed early at the liquidation price, often far from zero |

## Ownership

A [spot](glossary.html#spot-trading) trade means you hold the asset itself — buy 0.1 BTC and you own 0.1 BTC, full stop. A [perpetual futures](glossary.html#perpetual-futures) contract is a derivative: you're holding a position that tracks BTC's price without ever owning the coin. That distinction is why spot has no liquidation risk and futures does.

## Leverage and liquidation

Futures let you open a position larger than your posted [margin](glossary.html#margin) — 5x, 10x, sometimes more. That multiple is called [leverage](glossary.html#leverage). That amplifies gains and losses equally, and if the market moves far enough against you, the exchange closes the position automatically at the [liquidation price](glossary.html#liquidation-price) to prevent your balance from going negative. CryptoBolt's portfolio view estimates that price for every open futures position so it's never a surprise mid-move.

> **Example:** You open a $1,000 long with $100 of margin, which is 10x leverage. A price drop of roughly 10% costs the position about $100, which is all of your margin, so the exchange closes it first (a little before 10%, because exchanges also require a maintenance margin). The same 10% drop on $1,000 of spot leaves you holding about $900 of coin, and you still own it.

![Bar chart of how far price can move against a long position before its margin is used up: about 100% at 1x, 50% at 2x, 20% at 5x, 10% at 10x, 5% at 20x, 2% at 50x and 1% at 100x.](assets/diagrams/leverage-liquidation-distance.svg "The higher the leverage, the smaller the move that wipes out your margin. Try your own numbers in the [liquidation price calculator](liquidation-price-calculator.html).")

## Funding rate

Perpetuals never expire, so exchanges use a periodic [funding payment](glossary.html#funding-rate) between longs and shorts to keep the contract price anchored near spot. When funding is positive, longs pay shorts, which usually means positioning is leaning long — one more piece of context the AI research pass folds in. The full explanation, with a worked example of what funding costs, is in [crypto funding rates explained](funding-rate-explained.html).

## Spot vs futures trading for beginners

If you're new to crypto, the practical difference in the spot vs futures decision comes down to what you can lose and how fast. With spot, the worst case is the asset going to zero — painful, but bounded, and you can hold through a drawdown indefinitely since there's no liquidation clock. With futures, leverage means a move that would be a rough week on spot can wipe out a position outright, and it can happen in minutes during a volatile session. Most traders are better served starting on spot until they've sat through a few full market cycles, then treating futures as a separate, smaller allocation with position sizing that assumes the trade can be wrong.

Neither is inherently better. Spot is simpler and caps your downside at zero; futures adds leverage and funding dynamics on top. Know which one you're actually looking at before you size a trade.

## Where to go next

- [Funding rates explained](funding-rate-explained.html): the ongoing cost that only futures traders pay.
- [Liquidation price calculator](liquidation-price-calculator.html): see how leverage moves your liquidation price.
- [How much can you realistically make day trading crypto?](day-trading-crypto-realistic-returns.html): what the research says about leveraged short-term trading.
- [Paper trading](crypto-paper-trading.html): practice futures with virtual money on live prices.
- [Bitcoin live price](bitcoin-live-price.html): live BTC/USDT with halving, ETF and funding context.
- [Why round numbers act like support and resistance](round-number-levels.html): where price tends to react.

[Track spot holdings and futures positions side by side in the terminal →](app.html)