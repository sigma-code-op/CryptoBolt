# DCA Bot Safety Order Calculator (Capital & Avg Entry)

> Free DCA bot safety order calculator: total capital needed, average entry, take-profit price and last-order drop for any step and volume scale. No signup.

Source: https://cryptobolt.io/dca-bot-safety-order-calculator

Written and checked by the CryptoBolt founder · Formulas tested against worked examples on November 25, 2026 · [How we build and check our tools](https://cryptobolt.io/editorial-policy)

Entry price (USD)

Base order size (USD)

First safety order size (USD)

Number of safety orders

Price deviation to first safety order (%)

Safety order step scale (1 = equal gaps)

Safety order volume scale (1 = equal sizes)

Take profit from average entry (%)

Fee per trade (%)

Leverage (x, 1 = spot)

Maintenance margin rate (%) (futures only)

Capital for the full ladder

Price of the last safety order

Average entry after the last order

Move needed to reach take profit

Profit at take profit with the full ladder, after fees

Floating result when price sits at the last order

Estimated liquidation of the averaged position

| Order | Price | Drop from entry | Order size | Total invested | Average entry | Take-profit price |
| --- | --- | --- | --- | --- | --- | --- |
| Base | $100 | 0.00% | $100.00 | $100.00 | $100 | $101.5 |
| SO 1 | $98.5 | 1.50% | $200.00 | $300.00 | $98.99 | $100.48 |
| SO 2 | $96.7 | 3.30% | $300.00 | $600.00 | $97.83 | $99.3 |
| SO 3 | $94.54 | 5.46% | $450.00 | $1,050.00 | $96.39 | $97.84 |
| SO 4 | $91.95 | 8.05% | $675.00 | $1,725.00 | $94.6 | $96.02 |
| SO 5 | $88.84 | 11.16% | $1,012.50 | $2,737.50 | $92.39 | $93.77 |

Standard ladder: safety order k sits at a cumulative deviation of d × (1 + s + … + sk−1) and has the size first-order × vk−1. Fees are taken on both legs of the full position. It does not model slippage, partial fills, funding, stop-losses or the exchange’s own bot rules. Educational tool, not financial advice. [Practice with virtual funds first →](https://cryptobolt.io/crypto-paper-trading)

## How a DCA bot ladder works

A DCA bot, sometimes called a martingale bot, opens a base order and then keeps buying more if the price moves against it. Each extra buy is a safety order. Because the later buys happen at lower prices, your average entry drops, and the price only needs to recover to a take-profit level above the new average, not back to the original entry.

- **Price deviation**: the drop from the entry that triggers the first safety order.
- **Step scale**: multiplies the gap to each next safety order. At 1.0 the orders are evenly spaced; at 1.2 each gap is 20% wider than the one before.
- **Volume scale**: multiplies each safety order’s size. At 1.0 all orders are equal; at 1.5 each one is 50% larger.
- **Take profit**: the percentage above your average entry at which the bot sells everything.

## Worked example: $100 base order and five safety orders

A long bot enters at $100 with a $100 base order. The first safety order is $200 at a 1.5% drop, the step scale is 1.2, the volume scale is 1.5 and take profit is 1.5% above the average entry.

| Order | Price | Drop from entry | Order size | Total invested | Average entry | Take-profit price |
| --- | --- | --- | --- | --- | --- | --- |
| Base order | $100 | 0.00% | $100.00 | $100.00 | $100 | $101.5 |
| Safety order 1 | $98.5 | 1.50% | $200.00 | $300.00 | $98.99 | $100.48 |
| Safety order 2 | $96.7 | 3.30% | $300.00 | $600.00 | $97.83 | $99.3 |
| Safety order 3 | $94.54 | 5.46% | $450.00 | $1,050.00 | $96.39 | $97.84 |
| Safety order 4 | $91.95 | 8.05% | $675.00 | $1,725.00 | $94.6 | $96.02 |
| Safety order 5 | $88.84 | 11.16% | $1,012.50 | $2,737.50 | $92.39 | $93.77 |

The full ladder needs $2,737.50, which is 27 times the base order. The last order fills at $88.84, 11.16% below the entry, and by then the average entry is $92.39. To close at take profit the price has to climb 5.55% from the last order. If it does, the bot makes about $35.59 after fees on $2,737.50 invested. If it never does, the floating loss at the last order is about -$105.15.

## How volume scale changes the risk

Bigger later orders pull the average entry down faster, so take profit comes closer. They also put more money into the position exactly when the price is lowest. Same ladder as above, only the volume scale changes:

| Volume scale | Size of last order | Total capital | Average entry after last order | Move needed to take profit | Capital as multiple of base order |
| --- | --- | --- | --- | --- | --- |
| 1.0x | $200.00 | $1,100.00 | $94.5 | 7.97% | 11x |
| 1.5x | $1,012.50 | $2,737.50 | $92.39 | 5.55% | 27x |
| 2.0x | $3,200.00 | $6,300.00 | $91.24 | 4.24% | 63x |

## How step scale changes the depth

A step scale above 1 spreads the orders further apart, so the ladder survives a deeper fall before it runs out of safety orders:

| Step scale | Last order is this far below entry | Price of last order | Average entry | Move needed to take profit |
| --- | --- | --- | --- | --- |
| 1.0x | 7.50% | $92.5 | $94.52 | 3.72% |
| 1.2x | 11.16% | $88.84 | $92.39 | 5.55% |
| 1.5x | 19.78% | $80.22 | $87.46 | 10.66% |

That extra depth costs you earlier averaging: the first orders still fill at the same prices, but the last ones are much lower, and the average entry stays higher until they fill.

## Using leverage on a futures DCA bot

On perpetual futures every safety order adds margin, but the averaged position is liquidated when the price moves roughly 1 ÷ leverage against the average entry, minus the maintenance margin. The calculator uses the simple isolated formula, average entry × (1 − 1 ÷ leverage + maintenance margin rate) for a long. For the same $100 base order ladder as above, with a 0.5% maintenance margin rate:

| Leverage | Margin needed for the full ladder | Liquidation price after the last order | Liquidated before the ladder finishes? |
| --- | --- | --- | --- |
| 3x | $912.50 | $62.05 | No |
| 5x | $547.50 | $74.37 | No |
| 10x | $273.75 | $83.61 | No |
| 20x | $136.88 | $88.23 | Yes, around safety order 4 |

If a liquidation price sits above the price of a later safety order, that order can never fill, and the “safety” ladder is not safe at all. Use the [liquidation price calculator](https://cryptobolt.io/liquidation-price-calculator) to check an exact exchange setup and the [liquidation probability calculator](https://cryptobolt.io/liquidation-probability-calculator) to see how likely it is that the price reaches that level.

## A checklist before you start a bot

- Can you afford the **full ladder**, and would you be comfortable holding that coin if it fell below the last safety order?
- Is the last safety order at a price that is plausible for this coin’s volatility? Smaller coins can fall much further than the ladder covers.
- Is the take-profit move from the last order realistic, or does it need a full recovery?
- Do you have a plan, such as a stop-loss or a time limit, for the case where take profit is never hit?

## What this calculator does not model

- **Partial recoveries.** A real bot can hit take profit after the first or second safety order, which gives a smaller profit than the full-ladder figure shown here.
- **Slippage, partial fills and minimum order sizes.**
- **Funding payments** on futures bots, which add up on a long-running position. See the [funding fee calculator](https://cryptobolt.io/funding-fee-calculator).
- **Exchange-specific rules**, such as different ways of measuring the deviation or trailing take profit.

The same averaging maths applies to manual buys, which you can check with the [crypto average price calculator](https://cryptobolt.io/crypto-average-price-calculator). If you prefer to compare the approach with simple regular buying, see [dollar-cost averaging in crypto](https://cryptobolt.io/dollar-cost-averaging-crypto) and the [DCA calculator](https://cryptobolt.io/dca-calculator). Grid strategies work differently; the [grid bot profit calculator](https://cryptobolt.io/grid-bot-profit-calculator) shows how.

Check your understanding

## Worked example: a base order and five evenly spaced safety orders

Base order

$100 at $100

Safety orders

5 x $100 at about $98, $96, $94, $92, $90

Capital needed if all fill

$600

Average entry if all fill

$94.88

Take profit at +1.5%

$96.30

Price drop covered

about 10% below entry

A bot that is fully filled needs six times its first order, and it is exposed to a 10% decline. The price must still recover about 7% from the last fill ($90) to reach the take-profit ($96.30).

### Mistakes this calculator helps you catch

- Sizing only the first order and forgetting the capital the safety orders will demand.
- Letting the grid of safety orders cover only a small drop, so a normal decline exhausts them.
- Using a large volume scale: each extra order is bigger, so the last fills carry most of the risk.

### Rule of thumb

Check the total capital with every safety order filled. If you cannot afford that number, shrink the bot, not the safety orders.

FAQ

## DCA bot safety order FAQ

### What is a safety order in a DCA bot?

A safety order is an extra buy a DCA bot places below your entry price. When the price drops by the set deviation, the bot buys more, which lowers your average entry price so the take-profit target comes closer. Each later safety order can be larger (volume scale) and further away (step scale).

### How much capital does a DCA bot need?

Add up the base order and every safety order. With a volume scale above 1 the orders grow, so the total can be many times the base order. In the example here a $100 base order and five safety orders need $2,737.50, about 27 times the base order. Always plan for the full ladder, not just the base order.

### What do price deviation, step scale and volume scale mean?

Price deviation is how far the price must drop before the first safety order. Step scale multiplies the gap between each safety order and the previous one, so a scale of 1.2 spaces later orders further apart. Volume scale multiplies the size of each safety order relative to the previous one, so a scale of 1.5 makes each order 50% larger.

### Why can a DCA bot lose money?

A DCA bot keeps buying while the price falls. If the price never comes back up to the take-profit level, all the capital ends up in a coin that keeps falling. Larger later orders speed up recovery but also put more money into the losing position, which is why the full ladder size and the price of the last safety order matter more than the base order.

### How does leverage change a DCA bot?

With futures and leverage, each safety order adds margin and moves the average entry, but the liquidation price of the combined position is only a few percent away from the average at high leverage. The calculator estimates the isolated liquidation price of the averaged position and warns when the price would hit it before the ladder finishes.

Keep going

## Related calculators and guides

Calculator

### Grid bot profit calculator

Net profit per grid after fees and the cost of leaving the range.

Open

Link: https://cryptobolt.io/grid-bot-profit-calculator

Calculator

### Crypto average price calculator

Combine several buys into one weighted entry price.

Open

Link: https://cryptobolt.io/crypto-average-price-calculator

Calculator

### Crypto DCA calculator

Regular buys versus a lump sum.

Open

Link: https://cryptobolt.io/dca-calculator

Calculator

### Liquidation price calculator

For futures bots that use leverage.

Open

Link: https://cryptobolt.io/liquidation-price-calculator

---
CryptoBolt is a market-data and education tool, not an exchange and not financial advice. Contact: info@cryptobolt.io