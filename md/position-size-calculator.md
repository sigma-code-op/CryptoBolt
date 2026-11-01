# Crypto Position Size Calculator (Risk %) | CryptoBolt

> Free crypto position size calculator. Enter account balance, risk % and stop-loss to get position size, margin needed and 1R/2R/3R targets. No signup.

Source: https://cryptobolt.io/position-size-calculator.html

Account balance (USD)

Risk per trade (%)

Entry price (USD)

Stop-loss price (USD)

Leverage (futures only)

Amount at risk

Position value (notional)

Margin at chosen leverage

1R target (risk ×1)

2R target (risk ×2)

3R target (risk ×3)

Estimate only — ignores trading fees and slippage, which make a real stop-out slightly larger than planned. Educational tool, not financial advice. [Practice the sizing with virtual funds →](https://cryptobolt.io/crypto-paper-trading.html)

## What position size means

Position size is how much of an asset you buy or sell in one trade. Beginners usually pick it by feel — "I will put in $1,000" — which makes the loss on a bad trade depend on how far away the stop happens to be. Risk-based sizing flips that: you decide the most you are willing to lose on the trade, then let the stop-loss distance determine the size.

## The position size formula

- **Amount at risk** = account balance × risk %
- **Stop distance** = |entry price − stop-loss price|
- **Position size (units)** = amount at risk ÷ stop distance
- **Position value** = units × entry price
- **Margin needed** = position value ÷ leverage

Leverage does not change how much you lose if the stop is hit — the stop distance and the units do. Leverage only changes how much margin you must lock up to hold that position, and how close your liquidation price sits.

## Worked example

Account of $5,000, risking 1% per trade, long Bitcoin at $65,000 with a stop at $63,700:

- Amount at risk: $5,000 × 1% = $50
- Stop distance: $65,000 − $63,700 = $1,300 (2% below entry)
- Position size: $50 ÷ $1,300 ≈ 0.0385 BTC
- Position value: 0.0385 × $65,000 ≈ $2,500
- Margin at 5x leverage: $2,500 ÷ 5 = $500; at 10x: $250

If the stop fills, you lose about $50 whether you used 5x or 10x. The 10x trade just leaves more of your balance free — and puts the liquidation price closer, which is where it can go wrong.

## Check your stop against your liquidation price

A stop-loss only protects you if it triggers *before* the exchange liquidates the position. As a rough guide, a position at leverage L is liquidated after a move of about 1/L minus the maintenance margin rate. At 20x that is roughly 4.5%; at 50x, about 1.5%. If your stop sits further away than that, liquidation arrives first. Use the [liquidation price calculator](https://cryptobolt.io/liquidation-price-calculator.html) to compare the two numbers for your exact setup.

## How much should you risk per trade?

There is no universally correct number. Many traders who write about risk management use somewhere around 0.5%–2% of the account per trade, because even a long losing streak then leaves most of the balance intact. At 1% risk, ten straight losses cost roughly 10% of the account; at 10% risk, the same streak would cost about 65%. Smaller risk per trade buys survival time, which is what a new strategy needs most. A good way to test a risk level without real money is a [paper trading account](https://cryptobolt.io/crypto-paper-trading.html).

## R-multiples: reading the targets

"R" is the amount you risk on the trade. A 2R target is a profit twice the size of the loss you accepted. The calculator shows the price for 1R, 2R and 3R in the direction of your trade so you can check whether a take-profit level is realistic against nearby support, resistance or round-number levels.

[See live prices and charts to pick your entry and stop in the terminal →](https://cryptobolt.io/app.html)

FAQ

## Position size calculator FAQ

### How do I calculate position size in crypto?

Multiply your account balance by the percentage you are willing to risk, then divide that dollar amount by the distance between your entry and your stop-loss. The result is the number of coins or contracts to trade.

### Does leverage change my position size?

Not the risk-based size. The stop distance and risk amount set the size; leverage only decides how much margin you tie up to hold it, and how close your liquidation price is.

### What percentage of my account should I risk per trade?

It depends on your strategy and tolerance, but many risk-management guides discuss roughly 0.5% to 2% per trade. Lower risk lets you survive a losing streak while you learn what works.

### Does this work for spot trading?

Yes. For spot, set leverage to 1 — the margin needed then equals the full position value.

### Why is my real loss slightly bigger than planned?

Trading fees and slippage on the stop order add to the loss. A fast market can fill a stop-loss beyond your stop price, so treat the calculated risk as the plan, not a guarantee.

More tools

## Related calculators and guides

Calculator

### Liquidation price calculator

Where a leveraged long or short gets force-closed.

Open

Link: https://cryptobolt.io/liquidation-price-calculator.html

Calculator

### Futures profit calculator

Net PnL, ROE and fees for a leveraged trade.

Open

Link: https://cryptobolt.io/crypto-profit-calculator.html

Practice

### Crypto paper trading

Test a plan with virtual funds before risking real money.

Open

Link: https://cryptobolt.io/crypto-paper-trading.html

---
CryptoBolt is a market-data and education tool, not an exchange and not financial advice. Contact: info@cryptobolt.io
