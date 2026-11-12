# Liquidation Price Calculator (Crypto Futures) | CryptoBolt

> Free crypto liquidation price calculator for long and short futures. Enter entry price, leverage and margin mode to estimate where a position is liquidated.

Source: https://cryptobolt.io/liquidation-price-calculator

Entry price (USD)

Leverage

Maintenance margin rate (%)

Margin mode

Estimate only — ignores trading fees and funding payments, and cross-margin liquidation depends on your whole wallet balance, not just this position. [Track real positions and estimated liquidation prices live in the terminal →](https://cryptobolt.io/app)

## What "liquidation price" means

A leveraged futures position is backed by a fraction of its full value — the margin. If the market moves against you far enough that your remaining margin can no longer cover the position's losses plus the exchange's maintenance margin requirement, the exchange force-closes the position. The price at which that happens is the liquidation price, and it's fixed the moment you open the position, not something that drifts based on sentiment.

## How to calculate liquidation price

For an isolated-margin position, the standard approximation is:

- **Long:** Liquidation price ≈ Entry price × (1 − 1/Leverage + Maintenance margin rate)
- **Short:** Liquidation price ≈ Entry price × (1 + 1/Leverage − Maintenance margin rate)

Higher leverage divides your margin thinner, so 1/Leverage shrinks and the liquidation price sits closer to entry. The maintenance margin rate is small on major pairs like BTC and ETH (often 0.4%–0.5% at lower leverage tiers) but climbs on lower-liquidity altcoins and at higher leverage tiers, so it's worth checking your exchange's actual tier table rather than assuming a flat number.

## Isolated vs cross margin

Isolated margin caps your risk at the margin assigned to that one position — lose it all, and only that position is liquidated. Cross margin pools your entire futures wallet balance as backing for every open position, which typically pushes each individual liquidation price further away, but it also means a bad move on one position can eat into the margin backing an unrelated position. Cross margin's real liquidation price depends on your total account state at the moment of the move, so treat the cross-margin estimate above as a rough anchor, not an exact number.

## Funding rate and fees aren't in this number

This calculator, like most public ones, uses the standard formula above and leaves out two things that move the real number slightly: trading fees (charged on entry and on the forced liquidation itself) and accumulated funding payments on a perpetual contract held across funding periods. Both nudge liquidation price a little closer to entry over time on a losing position. See [how funding rate works](https://cryptobolt.io/funding-rate-explained) for why that running cost matters over a multi-day hold.

## Plan the whole trade, not just the liquidation price

Liquidation price is one input. Use the [position size calculator](https://cryptobolt.io/position-size-calculator) to size a trade from your risk and stop-loss, the [futures profit calculator](https://cryptobolt.io/crypto-profit-calculator) to check reward against fees, and the [funding fee calculator](https://cryptobolt.io/funding-fee-calculator) to price in the cost of holding a perpetual position. All four live on the [crypto calculators](https://cryptobolt.io/crypto-calculators) page.

[See estimated liquidation price update live next to your open positions in the terminal →](https://cryptobolt.io/app)

FAQ

## Liquidation price calculator FAQ

### How is liquidation price calculated?

For isolated margin, it's approximately entry price × (1 − 1/leverage + maintenance margin rate) for a long, or entry price × (1 + 1/leverage − maintenance margin rate) for a short. Real exchange formulas also factor in fees and, on some venues, unrealized funding.

### What's the difference between isolated and cross margin liquidation?

Isolated margin only risks the margin assigned to that one position. Cross margin shares your whole futures wallet balance across positions — usually a further-away liquidation price, but a loss on one position can now draw down margin backing another.

### Does higher leverage mean a closer liquidation price?

Yes. Liquidation price moves closer to entry as leverage increases, since less price movement wipes out the smaller margin behind a higher-leverage position.

### Is this calculator exact?

No — it's an estimate using the standard isolated-margin formula, ignoring fees and funding. Use it to plan position size before opening a trade, not to time an exit; your exchange's own figure on an open position is the accurate one.

Keep reading

## More from the blog

Mechanics · 5 min read

### Spot vs. perpetual futures: what actually changes

Ownership, leverage, funding, and why one has liquidation risk and the other doesn't.

Read the post

Link: https://cryptobolt.io/spot-vs-futures

Mechanics · 5 min read

### Crypto funding rates: what the number on your futures screen means

What positive and negative funding actually tell you, and why it matters more paired with open interest.

Read the post

Link: https://cryptobolt.io/funding-rate-explained

## Watch: Leverage and liquidation explained

What actually happens when a leveraged futures position is liquidated.

- How margin multiplied by leverage sets your position size
- Roughly how far price must fall to liquidate a long at 2x, 5x, 10x, 20x and 50x
- Why a stop-loss belongs well inside the liquidation price

Read the transcript

Leverage lets you control a bigger position with less money. With $100 of margin at 10x, you control a $1,000 position, so a 10% move against you moves your margin by 100%. Approximate drop to liquidation for a long position, before fees and maintenance margin: about 50% at 2x, 20% at 5x, 10% at 10x, 5% at 20x and 2% at 50x. In the example, price from $100 dips to about $88 and then recovers. The 10x position, with liquidation near $90, is closed out during the dip, while the 2x position is still open. Remember: more leverage means less room before liquidation, place a stop-loss well inside the liquidation price, and fees and funding move the real liquidation price. The numbers are illustrative and this is educational content, not financial advice.

[Stop-loss orders explained](https://cryptobolt.io/stop-loss-orders-explained)

[Spot vs futures](https://cryptobolt.io/spot-vs-futures)

---
CryptoBolt is a market-data and education tool, not an exchange and not financial advice. Contact: info@cryptobolt.io