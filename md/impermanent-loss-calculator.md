# Impermanent Loss Calculator for Liquidity Pools | CryptoBolt

> Free impermanent loss calculator. Enter the price change and your deposit to see the loss versus holding, value in the pool and the fees needed to break even.

Source: https://cryptobolt.io/impermanent-loss-calculator.html

Written and checked by the CryptoBolt founder · Reviewed November 8, 2026 · [How we build and check our tools](https://cryptobolt.io/editorial-policy.html)

Price change of one token vs the other (%)

Deposit value at entry (USD)

Fees earned (% of deposit, optional)

Value if you had just held

Value inside the pool

Gap vs holding

Fees earned

Pool + fees vs holding

Fees needed to break even (% of deposit)

Assumes a 50/50 constant-product pool (the Uniswap v2 design) and that the second token does not move. Concentrated-liquidity and weighted pools behave differently. Educational tool, not financial advice.

## What impermanent loss is

When you deposit two tokens into an automated market maker (AMM) liquidity pool, the pool keeps the two sides balanced by value. If the price of one token rises, arbitrage traders buy it from the pool until the pool price matches the market, and in doing so they leave the pool with *less* of the token that went up and *more* of the one that went down. When you withdraw, your share is worth less than if you had simply kept both tokens in your wallet. That shortfall is **impermanent loss**. It is called impermanent because it shrinks or disappears if the price returns to where it was when you deposited; it becomes permanent only when you withdraw while the price is away from your entry.

## The formula

For a standard 50/50 constant-product pool, where one token's price changes by a factor r relative to the other:

- **Impermanent loss** = 2 × √r ÷ (1 + r) − 1 (a negative number or zero)
- **Value if held** = deposit × (1 + r) ÷ 2
- **Value in the pool** = deposit × √r

Notice that the result depends only on how far the *ratio* of the two prices has moved, not on which direction. A token that doubles and a token that halves against its partner produce the same loss percentage.

## Loss by price change

| Price change vs the other token | Impermanent loss vs holding | Fees needed to break even (% of deposit) |
| --- | --- | --- |
| -75% | -20.00% | 12.50% |
| -50% | -5.72% | 4.29% |
| -25% | -1.03% | 0.90% |
| +25% | -0.62% | 0.70% |
| +50% | -2.02% | 2.53% |
| +100% | -5.72% | 8.58% |
| +200% | -13.40% | 26.79% |
| +300% | -20.00% | 50.00% |
| +400% | -25.46% | 76.39% |
| +900% | -42.50% | 233.77% |

## Worked example

Deposit $10,000 into a 50/50 pool ($5,000 of each token). One token then doubles against the other. Holding the two tokens would have been worth $15,000. Inside the pool your share is worth about $14,142, a gap of about $858 or 5.72%. If the pool paid you 3% of your deposit in trading fees ($300) over the period, you would still be about $558 behind simply holding. To come out even you would need fees of about 8.58% of your deposit. This is the core trade-off: pools pay you fees for taking on the divergence, and whether that is enough depends on trading volume, the pool's fee tier and how far the prices move.

## When impermanent loss matters most

- **Volatile pairs** (two uncorrelated tokens) suffer the most. A pair that moves together, such as two similar stablecoins or a token and its liquid-staked version, suffers very little.
- **Large one-way moves** hurt more than small oscillations; the loss grows faster than the price move.
- **Concentrated liquidity** (ranges chosen by the provider) earns more fees per dollar while the price stays in range but amplifies the loss when it moves out. This calculator does not model it.
- **Token-specific risk** is separate from impermanent loss: a pool token can go to zero or be exploited, and no formula captures that.

## How to use the calculator

Enter how much one token has moved relative to the other (use a negative number for a fall), your deposit and, optionally, the fees you expect to earn as a percentage of the deposit. If the other token is a stablecoin, the price change is simply the volatile token's change in dollars. For a full walk-through of how pools work and how liquidity providers think about the trade-off, read [impermanent loss explained](https://cryptobolt.io/impermanent-loss-explained.html).

FAQ

## Impermanent loss calculator FAQ

### What is impermanent loss in simple terms?

It is the gap between what your tokens are worth inside a liquidity pool and what they would be worth if you had just held them. It appears when the prices of the two tokens move apart and shrinks if they move back.

### How do you calculate impermanent loss?

For a 50/50 pool, impermanent loss = 2 × √r ÷ (1 + r) − 1, where r is the price ratio change. A token that doubles (r = 2) gives about −5.72%; one that quadruples (r = 4) gives exactly −20%.

### Is impermanent loss real?

Yes, it is a real opportunity cost compared with holding, and it becomes a realised loss if you withdraw while prices are away from your entry. It is "impermanent" only in the sense that it can reverse if prices return.

### Can trading fees cover impermanent loss?

Sometimes. Fees go to liquidity providers, and in busy pools they can exceed the loss. The "fees needed to break even" figure shows how much you would have to earn for a given price move.

### Which pools have the least impermanent loss?

Pools of assets that move together, such as two stablecoins or a token paired with its staked version, have the smallest divergence. Pairs of unrelated volatile tokens have the most.

### Does this calculator work for Uniswap v3 or concentrated liquidity?

No. It models the classic 50/50 constant-product pool. Concentrated positions have a different payoff and can lose much more when the price leaves the chosen range.

Keep going

## Related calculators and guides

Calculator

### Staking rewards calculator

Compound rewards and convert APR to APY.

Open

Link: https://cryptobolt.io/crypto-staking-calculator.html

Calculator

### Crypto ROI calculator

Profit, ROI and break-even price on a spot trade.

Open

Link: https://cryptobolt.io/crypto-roi-calculator.html

Guide

### Impermanent loss explained

Why pool tokens can lag simply holding.

Open

Link: https://cryptobolt.io/impermanent-loss-explained.html

---
CryptoBolt is a market-data and education tool, not an exchange and not financial advice. Contact: info@cryptobolt.io
