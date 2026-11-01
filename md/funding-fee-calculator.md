# Funding Fee Calculator for Perpetual Futures | CryptoBolt

> Free funding fee calculator for crypto perpetual futures. Enter position size, funding rate and hold time to see what you pay or earn per day, month and year.

Source: https://cryptobolt.io/funding-fee-calculator.html

Position value / notional (USD)

Funding rate per interval (%)

Funding interval

Holding period (days)

Per funding payment

Per day

Per 30 days

Payments in period

Annualised, % of position value

At this rate sign

Estimate only — funding rates change every interval, so a fixed rate is an assumption, and your exchange may calculate payments on mark price. Educational tool, not financial advice.

## What a funding fee is

Perpetual futures have no expiry date, so exchanges use a funding payment to keep the contract price close to the spot price. Every funding interval, one side pays the other. When the funding rate is positive, longs pay shorts; when it is negative, shorts pay longs. The exchange does not keep this money — it moves between traders. Our guide to [funding rates](https://cryptobolt.io/funding-rate-explained.html) covers what the number says about market positioning.

## The funding fee formula

- **Funding payment** = position value × funding rate
- **Payments per day** = 24 ÷ funding interval in hours
- **Cost over a holding period** = payment × payments per day × days held
- **Annualised** = rate × payments per day × 365

Many major perpetual venues settle every 8 hours (three times a day) and use a small baseline rate such as 0.01% per interval when the perpetual and spot prices are close, though actual rates move with market conditions and differ between contracts. Check the live number on your exchange before you rely on one.

## Worked example

A $10,000 long with funding at +0.01% every 8 hours:

- Per payment: $10,000 × 0.01% = $1.00
- Per day (3 payments): $3.00
- Over 7 days: $21.00
- Per 30 days: $90.00 — an annualised drag of about 10.95% on the position value

On a leveraged trade that drag is measured against the position value, but you fund it from margin. At 10x leverage, 10.95% of the position value is about 109.5% of the margin per year — so funding matters most for trades held for weeks, not hours.

## Funding can also pay you

If you are on the receiving side, funding is income. When the rate is positive and you are short, you receive the payment. Extreme rates, such as 0.1% per 8 hours or more, usually signal very crowded positioning and are paid by the crowded side, which is one reason traders watch funding as a sentiment signal. A high rate is not a prediction on its own.

## Funding and liquidation

Funding payments are taken from your margin balance. On a long held through many positive intervals, the payments slowly reduce your margin and nudge your [liquidation price](https://cryptobolt.io/liquidation-price-calculator.html) closer to entry. Compare this with the profit you expect using the [futures profit calculator](https://cryptobolt.io/crypto-profit-calculator.html).

[See live funding rates alongside charts in the terminal →](https://cryptobolt.io/app.html)

FAQ

## Funding fee calculator FAQ

### How is the funding fee calculated?

Position value multiplied by the funding rate, charged once per funding interval. Multiply by the number of intervals to get the cost over your holding period.

### Who pays the funding fee?

When the funding rate is positive, long positions pay short positions. When it is negative, shorts pay longs. The payment goes between traders, not to the exchange.

### How often is funding charged?

Many major perpetual contracts settle every 8 hours, though some contracts use 4-hour or 1-hour intervals. Check the interval for your contract.

### Do I pay funding if I close before the funding time?

Generally no. Funding is charged only to positions that are open at the moment of the funding timestamp, according to most exchanges, so closing a minute before avoids that payment.

### Can funding make a profitable trade lose money?

Yes, over long holding periods. A small price gain can be cancelled by weeks of positive funding paid on a long, which is why funding belongs in the cost of any trade held longer than a few days.

More tools

## Related calculators and guides

Guide

### Funding rates explained

What the funding number on your futures screen means.

Open

Link: https://cryptobolt.io/funding-rate-explained.html

Calculator

### Liquidation price calculator

Where a leveraged long or short gets force-closed.

Open

Link: https://cryptobolt.io/liquidation-price-calculator.html

Guide

### Spot vs. perpetual futures

What actually changes when you add leverage.

Open

Link: https://cryptobolt.io/spot-vs-futures.html

---
CryptoBolt is a market-data and education tool, not an exchange and not financial advice. Contact: info@cryptobolt.io
