# Funding Fee Calculator for Perpetual Futures | CryptoBolt

> Free funding fee calculator for crypto perpetual futures. Enter position size, funding rate and hold time to see what you pay or earn per day, month and year.

Source: https://cryptobolt.io/funding-fee-calculator

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

Perpetual futures have no expiry date, so exchanges use a funding payment to keep the contract price close to the spot price. Every funding interval, one side pays the other. When the funding rate is positive, longs pay shorts; when it is negative, shorts pay longs. The exchange does not keep this money — it moves between traders. Our guide to [funding rates](https://cryptobolt.io/funding-rate-explained) covers what the number says about market positioning.

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

Funding payments are taken from your margin balance. On a long held through many positive intervals, the payments slowly reduce your margin and nudge your [liquidation price](https://cryptobolt.io/liquidation-price-calculator) closer to entry. Compare this with the profit you expect using the [futures profit calculator](https://cryptobolt.io/crypto-profit-calculator).

[See live funding rates alongside charts in the terminal →](https://cryptobolt.io/app)

## Reading your result: three cases

The calculator gives you a cost, but the number only means something next to what you expect to earn. Take a $5,000 long held for 5 days.

At 0.01% per 8 hours, the cost is $0.50 per interval, $1.50 per day and $7.50 over five days, about 0.15% of the position. Most trades can carry that. At 0.05% the same hold costs $37.50, or 0.75%, which is a real slice of a trade aiming for 3%. At 0.10%, which appears in very crowded markets, it is $75, or 1.5%, and funding alone can decide whether the trade pays.

## When this number misleads you

- **The rate will not stay fixed.** It is recalculated every interval and can swing from positive to negative within days.
- **Position value moves.** If price rises, the position is worth more and so is each payment.
- **It is not the only cost.** Trading fees and slippage come on top, so add them before judging a trade.
- **The sign matters.** If you are short while funding is positive, you receive the payment instead of paying it.

A useful habit: run the calculator at the current rate, then again at three times that rate. If the trade still makes sense at the higher figure, funding is not your main risk.

Check your understanding

## Worked example: a $20,000 long paying 0.01% per 8 hours

Position value

$20,000

Funding rate

0.01% per 8 hours

Per payment

$2.00

Payments per day

3

Per day

$6.00

Over 30 days

$180.00

Annualised

10.95%

0.01% looks like nothing, but it is about 10.95% a year on the whole position. On a 10x trade that is roughly 110% of the margin per year if the rate never changed.

### Mistakes this calculator helps you catch

- Calculating funding on margin instead of position value.
- Assuming the rate stays at today's level. It changes every interval.
- Forgetting that funding can be income if you are on the side that gets paid.

### Rule of thumb

If funding is positive, longs pay. Holding a crowded long for weeks costs real money even when the price goes nowhere.

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

Link: https://cryptobolt.io/funding-rate-explained

Calculator

### Liquidation price calculator

Where a leveraged long or short gets force-closed.

Open

Link: https://cryptobolt.io/liquidation-price-calculator

Guide

### Spot vs. perpetual futures

What actually changes when you add leverage.

Open

Link: https://cryptobolt.io/spot-vs-futures

---
CryptoBolt is a market-data and education tool, not an exchange and not financial advice. Contact: info@cryptobolt.io