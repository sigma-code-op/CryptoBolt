# Impermanent Loss Explained, With an Example | CryptoBolt

> How impermanent loss works in a crypto liquidity pool: a step-by-step ETH example, a loss table by price move, and what fees and pair choice change.

Source: https://cryptobolt.io/impermanent-loss-explained.html

Providing liquidity to a decentralised exchange sounds like a free lunch: deposit two tokens, earn a share of the trading fees. Then you withdraw and discover that you would have had more money by doing nothing. The gap has a name, impermanent loss, and it is the main reason liquidity provision is not passive income. This article walks through where it comes from with numbers you can check by hand.

## How a liquidity pool prices things

Most decentralised exchanges use an [automated market maker](https://cryptobolt.io/glossary.html#automated-market-maker) (AMM) instead of an [order book](https://cryptobolt.io/glossary.html#order-book). In the classic design, a [liquidity pool](https://cryptobolt.io/glossary.html#liquidity-pool) holds two tokens, say ETH and a dollar stablecoin, and keeps the product of the two quantities constant. If someone buys ETH from the pool, the ETH balance falls, the stablecoin balance rises, and the price of ETH moves up automatically so the product is unchanged.

Because the pool is always willing to trade, any gap between its price and the wider market is quickly closed by arbitrage traders. They buy the token that is cheap in the pool and sell the one that is expensive, which keeps the pool price in line with the market, but at the cost of changing what the pool holds.

## A worked example

You deposit 1 ETH and 2,000 USDC when ETH is $2,000. Your deposit is worth $4,000. The pool's constant is 1 × 2,000 = 2,000 (ignoring your share of the whole pool, which scales everything equally).

Now ETH rises to $4,000 on the wider market. Arbitrage trades push the pool until its price is $4,000, which means the quantities satisfy two conditions: USDC ÷ ETH = 4,000 and ETH × USDC = 2,000. That gives about 0.7071 ETH and 2,828.43 USDC.

- **Value in the pool:** 0.7071 × $4,000 + $2,828.43 = about **$5,656.85**.
- **Value if you had just held:** 1 × $4,000 + $2,000 = **$6,000**.

The pool left you about $343 behind, or 5.72%. That gap is impermanent loss. The arbitrage traders effectively sold you out of ETH as it rose, so you ended up with less of the winner than if you had kept your tokens.

## The formula and how big the loss gets

For a 50/50 constant-product pool, if one token's price changes by a factor r against the other:

**Impermanent loss = 2 × √r ÷ (1 + r) − 1**

The loss depends only on how far the price ratio has moved, not on the direction, and it grows more slowly than the price move at first and faster later:

| Price change vs the other token | Impermanent loss |
| --- | --- |
| −50% | −5.72% |
| +25% | −0.62% |
| +50% | −2.02% |
| +100% (2x) | −5.72% |
| +200% (3x) | −13.40% |
| +300% (4x) | −20.00% |
| +900% (10x) | −42.50% |

Use the [impermanent loss calculator](https://cryptobolt.io/impermanent-loss-calculator.html) to see the number for your own deposit and price move.

## Why it is called impermanent

If the price goes back to where it was when you deposited, the loss disappears completely, because the pool returns to its original composition. It becomes permanent when you withdraw while the price is away from your entry. The word can give a false sense of comfort: there is no guarantee the price returns, and for a token that drifts in one direction for months, the loss is simply a loss.

## Fees: the other half of the picture

Liquidity providers earn a share of every trade's fee, and those fees are the compensation for taking the divergence risk. Whether you come out ahead depends on three things: how much volume the pool sees relative to its size, the fee tier, and how far prices move. In the example above, ETH doubling creates a loss of about 8.58% of your original deposit measured against holding, so you would need to have earned roughly that much in fees to break even. A busy pool might do that over a few months; a quiet one might never.

## How people reduce impermanent loss

- **Choose correlated pairs.** Two stablecoins, or a token and its liquid-staked version, move together, so the ratio barely changes and the loss is tiny.
- **Prefer volume over hype.** A pool that trades a lot relative to its size generates more fees per dollar of liquidity.
- **Keep the horizon realistic.** The longer you stay while prices trend away, the more likely the loss grows.
- **Understand concentrated liquidity.** On platforms where you choose a price range, you earn much more fees per dollar while the price is inside the range, but if it leaves the range you hold only the losing token and the loss is larger than the simple formula suggests. The calculator on this site models the classic 50/50 pool only.

## Risks that are not impermanent loss

Impermanent loss is only the arithmetic of balancing a pool. Liquidity providers also face smart-contract bugs and exploits, tokens that are scams or lose their peg, rug pulls on the pool's creator side, and the usual price risk of the tokens themselves. None of that is captured in a formula. A new, unaudited pool offering a very high yield is not a better deal than a boring one; it is usually a riskier one.

## A short checklist before you provide liquidity

1. Work out the break-even fees for a few price moves (use the [calculator](https://cryptobolt.io/impermanent-loss-calculator.html)). 2. Estimate realistic fees from the pool's recent volume, not from the headline yield. 3. Ask what happens if either token falls 50% or rises 3x. 4. Check that the contracts are audited and the tokens are legitimate. 5. Decide in advance when you will withdraw.

Related reading: if you would rather earn a rate than provide liquidity, see [staking: APR vs APY](https://cryptobolt.io/staking-apr-vs-apy.html) and the [staking calculator](https://cryptobolt.io/crypto-staking-calculator.html). This article is educational and not financial advice.

Keep reading

## More from the blog

Mechanics · 5 min read

### Spot vs. perpetual futures: what actually changes

Ownership, leverage, liquidation, and funding rate — the mechanics that actually differ between holding the asset and trading a derivative on it.

Read the post

Link: https://cryptobolt.io/spot-vs-futures.html

Mechanics · 6 min read

### How to read a crypto order book (and what it can't tell you)

Bids, asks, the spread and depth: what the live order book shows, and why a snapshot of resting orders is not a forecast.

Read the post

Link: https://cryptobolt.io/how-to-read-an-order-book.html

Mechanics · 5 min read

### Crypto funding rates: what the number on your futures screen means

The small percentage next to every perpetual contract quietly tells you which side of the market is crowded — here's how to actually read it.

Read the post

Link: https://cryptobolt.io/funding-rate-explained.html

---
CryptoBolt is a market-data and education tool, not an exchange and not financial advice. Contact: info@cryptobolt.io
