# Crypto Futures Profit Calculator (PnL & ROE) | CryptoBolt

> Free crypto futures profit calculator. Enter entry, exit, margin, leverage and fees to see net PnL, ROE and the price move needed. Long or short, no signup.

Source: https://cryptobolt.io/crypto-profit-calculator.html

Entry price (USD)

Exit price (USD)

Margin / initial investment (USD)

Leverage

Trading fee per side (%)

Gross PnL (before fees)

Total fees (entry + exit)

Return on equity (ROE)

Position value (notional)

Position size (units)

Price move

Estimate only — excludes funding payments, slippage and liquidation. A losing position can be liquidated before your exit price is reached; check the [liquidation price](https://cryptobolt.io/liquidation-price-calculator.html) first. Educational tool, not financial advice.

## How futures profit and loss is calculated

On a leveraged futures trade, your margin controls a much larger position, so profit and loss are measured on the full position value (the notional), not on your margin. The steps:

- **Position value** = margin × leverage
- **Position size (units)** = position value ÷ entry price
- **Gross PnL (long)** = units × (exit price − entry price); for a short, units × (entry price − exit price)
- **Fees** = fee % × entry value + fee % × exit value
- **Net PnL** = gross PnL − fees
- **ROE** = net PnL ÷ margin × 100

## Worked example

Long Bitcoin at $60,000, exit at $63,000, $1,000 margin, 10x leverage, 0.05% fee per side:

- Position value: $1,000 × 10 = $10,000, which is about 0.1667 BTC
- Gross PnL: 0.1667 × $3,000 = $500 (a 5% price move × 10,000)
- Fees: $10,000 × 0.05% = $5.00 on entry, plus $10,500 × 0.05% = $5.25 on exit — $10.25 total
- Net PnL: $500 − $10.25 = $489.75, an ROE of about 48.98%

The same 5% move at 1x leverage would return about 4.98% on the same margin. Leverage multiplies the gain — and the loss: a 5% move against the position would cost about $500 plus fees, roughly half the margin.

## Why ROE is not the same as price change

Return on equity compares profit with the margin you put up, so it scales with leverage. A 2% price move is a 20% ROE at 10x and a 100% ROE at 50x — in either direction. The calculator shows both so the price move and the equity effect are never confused.

## Fees add up faster with leverage

Exchanges charge fees on the position value, not on your margin. At 0.05% per side, round-trip fees are about 0.1% of the notional — which at 20x leverage is about 2% of your margin before any price movement. Frequent trading at high leverage can lose money to fees alone. Check your exchange's maker and taker rates and enter yours above.

## What this calculator leaves out

Funding payments on perpetual contracts (use the [funding fee calculator](https://cryptobolt.io/funding-fee-calculator.html)), slippage, and the possibility of liquidation before the exit price. Size trades with the [position size calculator](https://cryptobolt.io/position-size-calculator.html) so a loss stays within your risk limit.

[Try the trade with virtual funds in paper trading →](https://cryptobolt.io/trade.html)

FAQ

## Crypto futures profit calculator FAQ

### How do I calculate profit on a leveraged crypto trade?

Multiply margin by leverage to get the position value, divide by the entry price to get units, then multiply units by the price difference between exit and entry (reversed for shorts). Subtract fees for net profit.

### What is ROE in crypto futures?

Return on equity is net profit or loss divided by the margin you committed. With leverage, a small price move can produce a large ROE in either direction.

### Does this include funding fees?

No. Funding is charged or paid between longs and shorts on perpetual contracts while a position is open. See the funding fee calculator for that cost.

### What fee rate should I enter?

Use your exchange rate for the order type you will use. Many major venues list taker rates in the range of a few hundredths of a percent per side, but tiers, discounts and token rebates vary — check your account.

### Can a trade be liquidated before my exit price?

Yes. If price reaches your liquidation level first, the position is closed and the margin is lost, so the exit price in this calculator would never be reached.

More tools

## Related calculators and guides

Calculator

### Liquidation price calculator

Where a leveraged long or short gets force-closed.

Open

Link: https://cryptobolt.io/liquidation-price-calculator.html

Calculator

### Position size calculator

Size a trade from your risk, entry and stop-loss.

Open

Link: https://cryptobolt.io/position-size-calculator.html

Calculator

### Funding fee calculator

What a perpetual position costs or earns in funding.

Open

Link: https://cryptobolt.io/funding-fee-calculator.html

---
CryptoBolt is a market-data and education tool, not an exchange and not financial advice. Contact: info@cryptobolt.io
