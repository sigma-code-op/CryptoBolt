# Hyperliquid Position Size Calculator (Risk %, Liq. Price)

> Free Hyperliquid position size calculator: enter risk %, stop and max leverage to get size, liquidation price and hourly funding cost. No signup.

Source: https://cryptobolt.io/hyperliquid-position-size-calculator

Written and checked by the CryptoBolt founder · Margin and funding rules checked against Hyperliquid’s docs on November 20, 2026 · [How we build and check our tools](https://cryptobolt.io/editorial-policy)

Account balance (USD)

Risk per trade (%)

Entry price (USD)

Stop-loss price (USD)

Asset max leverage on Hyperliquid (x)

Leverage you set (x)

Funding rate per hour (%) (positive: longs pay)

Hours you expect to hold

Amount at risk

Position value (notional)

Initial margin needed

Maintenance margin rate

Estimated liquidation price (isolated)

Liquidation distance vs stop distance

Funding over your holding time

Estimate for an isolated position using Hyperliquid’s published margin rules. It ignores trading fees, slippage, margin tiers for very large positions, and cross-margin effects, and the exchange liquidates on its own mark price. Always confirm the liquidation price shown in the Hyperliquid app. Educational tool, not financial advice. [Practice the sizing with virtual funds →](https://cryptobolt.io/crypto-paper-trading)

## How this calculator works

It combines the standard risk-based sizing formula with the margin rules Hyperliquid publishes for its perpetual futures:

- **Amount at risk** = account balance × risk %
- **Position size (units)** = amount at risk ÷ |entry − stop|
- **Initial margin** = position value ÷ the leverage you set (capped at the asset’s max leverage)
- **Maintenance margin rate** = 1 ÷ (2 × max leverage), which Hyperliquid describes as half of the initial margin at max leverage
- **Liquidation price** = entry − side × available margin ÷ units ÷ (1 − MMR × side), where side is +1 for a long and −1 for a short, and available margin is your isolated margin minus the maintenance margin

The liquidation formula is the one in [Hyperliquid’s liquidation docs](https://hyperliquid.gitbook.io/hyperliquid-docs/trading/liquidations). The maintenance margin depends on the asset: it runs from about 1.25% on 40x assets up to about 16.7% on 3x assets.

| Asset max leverage | Maintenance margin rate | Initial margin at max leverage |
| --- | --- | --- |
| 3x | 16.67% | 33.33% |
| 5x | 10.00% | 20.00% |
| 10x | 5.00% | 10.00% |
| 20x | 2.50% | 5.00% |
| 25x | 2.00% | 4.00% |
| 40x | 1.25% | 2.50% |

## Worked example

Account of $5,000, risking 1%, long an asset with 40x max leverage at $65,000 with a stop at $63,700, using 10x leverage:

- Amount at risk: $5,000 × 1% = $50
- Stop distance: $1,300 (2% below entry), so size = $50 ÷ $1,300 ≈ 0.0385 units
- Position value ≈ $2,500; initial margin at 10x = $250
- Maintenance margin rate: 1.25%, so maintenance margin ≈ $31.25 and available margin ≈ $218.75
- Liquidation price ≈ $59,240, which is about 8.9% below entry and about 4.4 times further away than your stop

The same trade at different leverage settings shows why the stop must come first. The position and the $50 loss at the stop never change; only the margin and the liquidation price do:

| Leverage you set | Margin locked | Liquidation distance | Liquidation price | Stop ($63,700) hits first? |
| --- | --- | --- | --- | --- |
| 3x | $833.33 | 32.49% | $43,881.86 | Yes |
| 5x | $500.00 | 18.99% | $52,658.23 | Yes |
| 10x | $250.00 | 8.86% | $59,240.51 | Yes |
| 20x | $125.00 | 3.80% | $62,531.65 | Yes |
| 25x | $100.00 | 2.78% | $63,189.87 | Yes |
| 40x | $62.50 | 1.27% | $64,177.22 | No, liquidated first |

At 40x the liquidation price is closer than the stop, so the exchange would close the position before your stop could trigger.

## Why your stop must come before liquidation

When equity drops below the maintenance margin, Hyperliquid first tries to close the whole position with market orders on the book, and anything left over stays with you. If equity falls below two thirds of the maintenance margin before that succeeds, a backstop liquidation hands the position to the liquidator vault, and the maintenance margin is not returned to you. Positions above 100,000 USDC are liquidated in 20% slices with a 30-second cooldown. Details are in [Hyperliquid’s docs](https://hyperliquid.gitbook.io/hyperliquid-docs/trading/liquidations). A stop-loss that triggers earlier avoids all of this.

## Isolated versus cross margin

For isolated positions the liquidation price depends on the leverage you set, because it decides how much margin is allocated. For cross positions the liquidation price does not depend on the leverage setting; a lower setting just uses more of your collateral, and your whole account value and other open positions feed into it. This calculator models isolated margin, so treat its liquidation price as indicative on a cross account.

## Funding is charged hourly

Hyperliquid computes an 8-hour funding rate and pays one eighth of it every hour, with a cap of 4% per hour. The interest component is fixed at 0.01% per 8 hours, which is 0.00125% per hour. That is the default hourly rate in the calculator, so the funding figure is the floor in calm markets, not a forecast. See the [Hyperliquid funding docs](https://hyperliquid.gitbook.io/hyperliquid-docs/trading/funding) for the premium formula, and use the [funding fee calculator](https://cryptobolt.io/funding-fee-calculator) to model longer holds.

## What this calculator does not model

- **Margin tiers.** Very large positions can have a higher maintenance margin rate than the flat rate used here.
- **Fees and slippage.** A real stop-out costs slightly more than planned.
- **Mark price.** Liquidations use the mark price, which can differ from the last traded price during volatility.
- **Other markets.** Markets listed by third-party deployers can use different mark prices and rules.

To judge how likely a given liquidation level is to be reached, use the [liquidation probability calculator](https://cryptobolt.io/liquidation-probability-calculator). For the account-level view of how a risk percentage compounds over many trades, use the [risk of ruin calculator](https://cryptobolt.io/risk-of-ruin-calculator), and for spot or Binance-style sizing use the general [position size calculator](https://cryptobolt.io/position-size-calculator).

FAQ

## Hyperliquid position size FAQ

### How do I calculate position size on Hyperliquid?

Risk amount = balance × risk %. Position size in units = risk amount ÷ the distance between your entry and your stop-loss. Margin needed = position value ÷ leverage. Leverage does not change how much you lose at the stop, only how much margin you lock up and how close liquidation sits.

### What is the maintenance margin on Hyperliquid?

Hyperliquid sets the maintenance margin at half of the initial margin at the asset's max leverage. That is about 1.25% for a 40x asset and about 16.7% for a 3x asset, and it can be higher for very large positions that fall into margin tiers.

### Does a higher leverage setting make me lose more at my stop?

No. If your stop fills, the loss is the position size times the stop distance, whatever leverage you chose. Higher leverage locks less margin and moves the liquidation price closer, which is the real danger: a stop beyond the liquidation price never triggers.

### How often does Hyperliquid charge funding?

Every hour. Hyperliquid computes an 8-hour rate and pays one eighth of it each hour. Funding moves between longs and shorts and is capped at 4% per hour. The calculator lets you enter your own hourly rate and holding time.

### Is the liquidation price on this page exact?

No, it is an estimate for an isolated position using the documented formula. The exchange liquidates on its mark price, may apply margin tiers on large positions, and accounts for funding and your other positions on cross margin. Check the figure in the Hyperliquid app before you trade.

Keep going

## Related calculators and guides

Calculator

### Position size calculator

Spot and futures sizing from risk, entry and stop.

Open

Link: https://cryptobolt.io/position-size-calculator

Calculator

### Liquidation probability calculator

How likely the price is to touch your liquidation level.

Open

Link: https://cryptobolt.io/liquidation-probability-calculator

Calculator

### Funding fee calculator

What perpetual funding costs over time.

Open

Link: https://cryptobolt.io/funding-fee-calculator

Guide

### Position sizing and the 1% rule

Why small risk per trade keeps you in the game.

Open

Link: https://cryptobolt.io/position-sizing-and-the-one-percent-rule

---
CryptoBolt is a market-data and education tool, not an exchange and not financial advice. Contact: info@cryptobolt.io