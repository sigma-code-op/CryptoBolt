# Crypto Futures Profit Calculator (PnL & ROE) | CryptoBolt

> Free crypto futures profit calculator. Enter entry, exit, margin, leverage and fees to see net PnL, ROE and the price move needed. Long or short, no signup.

Source: https://cryptobolt.io/crypto-profit-calculator

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

Estimate only — excludes funding payments, slippage and liquidation. A losing position can be liquidated before your exit price is reached; check the [liquidation price](https://cryptobolt.io/liquidation-price-calculator) first. Educational tool, not financial advice.

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

Funding payments on perpetual contracts (use the [funding fee calculator](https://cryptobolt.io/funding-fee-calculator)), slippage, and the possibility of liquidation before the exit price. Size trades with the [position size calculator](https://cryptobolt.io/position-size-calculator) so a loss stays within your risk limit.

[Try the trade with virtual funds in paper trading →](https://cryptobolt.io/trade)

## Reading your result: why percent and dollars tell different stories

A $40 profit sounds good, but it means different things on different positions. On a $400 position it is a 10% return. On a $4,000 position it is 1%, and a single fee or slip could erase it. Always look at both numbers together, and at what you risked to get there.

Compare two trades. Trade A: buy $1,000, sell at +3%, pay 0.2% in round-trip fees. Net profit is about $28. Trade B: the same, but you also gave up 0.3% in slippage because the coin was thinly traded. Net profit is about $25, a 10% smaller result from a cost you could have checked beforehand in the order book.

## Using the calculator before a trade, not just after

1. Enter your planned entry, your target and your fees to see the profit if it works.
2. Enter the stop price as the exit to see the loss if it does not.
3. Divide the first by the second. If the potential gain is not clearly larger than the potential loss, reconsider the trade.
4. Check the break-even price, the level where fees are covered, and ask whether the move you expect is comfortably beyond it.

Many people only use profit calculators to feel good about a win. They are more valuable as a pre-trade check on whether the numbers justify the risk.

Check your understanding

## Worked example: a 10x long that moves 5%

Margin / leverage

$500 / 10x

Position value

$5,000.00

Units

50

Entry to exit

$100 to $105

Gross PnL

$250.00

Fees (0.05% each side, on position value)

$5.125

Net PnL

$244.875

Return on margin (ROE)

48.98%

A 5% price move turned into a roughly 49% return on margin. The same leverage makes a 5% move the other way a roughly 51% loss, fees included.

### Mistakes this calculator helps you catch

- Reading ROE as if it were the price move. Leverage multiplies both.
- Charging fees on margin instead of position value, which understates the cost by the leverage factor.
- Skipping funding on trades held overnight.

### Rule of thumb

Fees on a leveraged trade are paid on the whole position, so at 10x a 0.05% fee is 0.5% of your margin, each way.

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

Link: https://cryptobolt.io/liquidation-price-calculator

Calculator

### Position size calculator

Size a trade from your risk, entry and stop-loss.

Open

Link: https://cryptobolt.io/position-size-calculator

Calculator

### Funding fee calculator

What a perpetual position costs or earns in funding.

Open

Link: https://cryptobolt.io/funding-fee-calculator

---
CryptoBolt is a market-data and education tool, not an exchange and not financial advice. Contact: info@cryptobolt.io