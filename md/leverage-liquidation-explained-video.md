# Leverage and liquidation explained (Video) | CryptoBolt

> A 50-second animated guide to leverage and liquidation: how margin and position size relate, how close liquidation sits at 2x to 50x leverage, and why the...

Source: https://cryptobolt.io/leverage-liquidation-explained-video

# Leverage and liquidation explained

What actually happens when a leveraged futures position is liquidated.

## What you will learn

- How margin multiplied by leverage sets your position size
- Roughly how far price must fall to liquidate a long at 2x, 5x, 10x, 20x and 50x
- Why a stop-loss belongs well inside the liquidation price

Read the transcript

Leverage lets you control a bigger position with less money. With $100 of margin at 10x, you control a $1,000 position, so a 10% move against you moves your margin by 100%. Approximate drop to liquidation for a long position, before fees and maintenance margin: about 50% at 2x, 20% at 5x, 10% at 10x, 5% at 20x and 2% at 50x. In the example, price from $100 dips to about $88 and then recovers. The 10x position, with liquidation near $90, is closed out during the dip, while the 2x position is still open. Remember: more leverage means less room before liquidation, place a stop-loss well inside the liquidation price, and fees and funding move the real liquidation price. The numbers are illustrative and this is educational content, not financial advice.

## A worked example

You put $200 of margin into a long at 10x. That controls a $2,000 position. At an entry of $100 you hold 20 units. Liquidation is near $90, because a 10% drop wipes out the margin before fees and maintenance margin. If price only slips to $95, that is a 5% move: you are down $100, which is half of your $200 margin, and you are still in the trade. At 2x the same $200 controls $400 and would need a fall of roughly 50% to be liquidated.

| Leverage | Position from $200 margin | Approx. drop to liquidation (long) |
| --- | --- | --- |
| 2x | $400 | about 50% |
| 5x | $1,000 | about 20% |
| 10x | $2,000 | about 10% |
| 20x | $4,000 | about 5% |
| 50x | $10,000 | about 2% |

Approximate values, before fees, funding and maintenance margin. Each exchange has its own rules, so use the [liquidation price calculator](https://cryptobolt.io/liquidation-price-calculator) for your exact setup.

## Common mistakes

- Choosing the highest leverage available. A small normal swing can then close the whole position.
- Putting the stop-loss beyond the liquidation price, so it can never trigger before liquidation does.
- Forgetting funding and fees. They shift the real liquidation price over time.
- Adding margin to a losing position instead of accepting the planned loss.

## Frequently asked questions

What is liquidation in crypto futures?

Liquidation is when the exchange force-closes a leveraged position because your margin can no longer cover the loss. You lose the margin assigned to that position.

Is the liquidation price the same on every exchange?

No. It depends on the margin mode, the maintenance margin rate, fees and funding, so the same trade can have slightly different liquidation prices in different places.

Does lower leverage make a trade safe?

It gives price more room before liquidation, but it does not remove risk. A position can still lose money, and a poorly placed stop-loss is still a problem.

Can I practice leverage without risking money?

Yes. Paper trading lets you try leveraged positions with virtual funds, so you can see how liquidation distance works before using real money.

## Keep reading

[Liquidation price calculator](https://cryptobolt.io/liquidation-price-calculator)

[Liquidation probability calculator](https://cryptobolt.io/liquidation-probability-calculator)

[Stop-loss orders explained](https://cryptobolt.io/stop-loss-orders-explained)

[Spot vs futures](https://cryptobolt.io/spot-vs-futures)

[Liquidation price calculator](https://cryptobolt.io/liquidation-price-calculator)

[Stop-loss orders explained](https://cryptobolt.io/stop-loss-orders-explained)

[Spot vs futures](https://cryptobolt.io/spot-vs-futures)

## More video guides

Video guide

### How to read an order book

Bids, asks, the spread and slippage, animated.

Watch

Link: https://cryptobolt.io/order-book-explained-video

Video guide

### Position sizing and the 1% rule

How to size a trade so one loss cannot do much damage.

Watch

Link: https://cryptobolt.io/position-sizing-1-percent-rule-video

Video guide

### How paper trading works

Practice with $10,000 of virtual money before risking real money.

Watch

Link: https://cryptobolt.io/paper-trading-how-it-works-video

[All video guides](https://cryptobolt.io/videos)

The numbers in these videos are illustrative examples. This is educational content, not financial advice. Trading leveraged crypto can lose more than you expect, quickly.

---
CryptoBolt is a market-data and education tool, not an exchange and not financial advice. Contact: info@cryptobolt.io