# Order types: market, limit and stop | CryptoBolt Course

> Lesson 4: market orders, limit orders and stop orders explained for beginners, with simple examples, when to use each, and the maker versus taker difference.

Source: https://cryptobolt.io/course-order-types

Course map

0 of 12 lessons complete

Foundations

1. [1What trading is (and what it is not)](https://cryptobolt.io/course-what-is-trading)
2. [2How a market works: buyers, sellers and price](https://cryptobolt.io/course-how-markets-work)
3. [3Reading a price chart: candles and timeframes](https://cryptobolt.io/course-how-to-read-candlestick-charts)

Placing your first trade

1. [4Order types: market, limit and stop](https://cryptobolt.io/course-order-types)
2. [5The real cost of a trade](https://cryptobolt.io/course-trading-costs)
3. [6Leverage and liquidation, explained simply](https://cryptobolt.io/course-leverage-for-beginners)

Protecting your money

1. [7How much to risk: position sizing](https://cryptobolt.io/course-position-sizing)
2. [8Stops and risk-reward](https://cryptobolt.io/course-stop-loss-and-risk-reward)
3. [9Your biggest opponent](https://cryptobolt.io/course-trading-psychology)

Building a process

1. [10Simple analysis: trend, support and resistance](https://cryptobolt.io/course-trend-support-resistance)
2. [11Your trading plan and journal](https://cryptobolt.io/course-trading-plan-and-journal)
3. [12Your first 30 days: a safe practice plan](https://cryptobolt.io/course-first-30-days)

[Course overview](https://cryptobolt.io/trading-course)

Placing your first trade. Lesson 4 of 12. About 13 minutes.

# Order types: market, limit and stop

**By the end of this lesson:** Choose between a market, limit and stop order, and know exactly what each one does when you press the button.

An *order* is an instruction you give the exchange. The type of order decides **how** and **at what price** your trade is carried out. Using the wrong type is one of the cheapest ways for a beginner to lose money by accident.

## First, the waiting list

Recall the meeting place from lesson 2. Waiting buy orders are called **bids** and waiting sell orders are called **asks**. Together they form the [order book](https://cryptobolt.io/glossary#order-book). The gap between the best bid and the best ask is the [spread](https://cryptobolt.io/glossary#spread).

Remember these two prices, because they decide everything below: you **buy** at the ask and you **sell** at the bid, if you want to trade immediately.

## Market order: "do it now"

A [market order](https://cryptobolt.io/glossary#market-order) says: buy or sell right now at the best available price. It fills immediately, almost always. The catch is that you do not control the exact price. If you are buying, you take the cheapest asks, and if your order is bigger than what is waiting there, you eat into higher and higher prices. That extra cost is called [slippage](https://cryptobolt.io/glossary#slippage).

- **Pros:** fast, certain to fill.
- **Cons:** you pay the spread and possible slippage; you can get a worse price than you expected in a fast market.
- **Use it when:** getting in or out matters more than a small price difference, for example closing a losing trade quickly.

## Limit order: "only at this price or better"

A [limit order](https://cryptobolt.io/glossary#limit-order) says: buy no higher than this price, or sell no lower than this price. It joins the order book and waits. If the market reaches your price, you are filled. If it never does, you are not filled at all.

- **Pros:** you control the price; often lower fees; no slippage.
- **Cons:** it may never fill, and you may miss the move.
- **Use it when:** you are patient and have a specific price in mind.

## Stop order: "if it goes there, then act"

A stop order stays dormant until the price reaches a trigger level you set (the stop price). Then it activates. Stops are mostly used to **limit a loss**: you own a coin bought at $100, and you set a stop at $95. If price falls to $95, your order triggers and sells.

| Type | What happens at the trigger | Risk |
| --- | --- | --- |
| Stop-market | Becomes a market order and sells at whatever price is available | You are almost sure to exit, but possibly at a worse price than the stop |
| Stop-limit | Becomes a limit order at the price you set | You control the price, but in a fast fall the order may never fill, so you stay in the trade |

A stop is a plan, not a guarantee. In a sudden drop the exit price can be lower than your stop. Our deeper guide to [stop-loss orders](https://cryptobolt.io/stop-loss-orders-explained) covers this. In lesson 8 you will learn *where* to put one.

## Maker and taker: why exchanges charge differently

If your order **waits** in the book (a limit order), you are a *maker*: you add liquidity. If your order **takes** what is already waiting (a market order), you are a *taker*. Many exchanges charge takers a higher [fee](https://cryptobolt.io/glossary#maker-taker) than makers. Over many trades, that adds up.

## A simple rule for beginners

- **Entering:** use a limit order when you can wait; use a market order only when speed truly matters.
- **Protecting:** set a stop as soon as you are in.
- **Always** check the order preview before you confirm: side (buy or sell), price, amount and fee.

## Choosing the order: a plain decision guide

Instead of memorising definitions, ask three questions in this order.

1. **Do I care more about getting in now, or about the price?** If it must happen now, a market order. If price matters more, a limit order.
2. **Do I need a protective exit?** If yes, plan a stop order before you enter, not after.
3. **Is the market calm or fast?** In a fast market, market orders slip more and limit orders may not fill at all. Neither is "safe", they fail in different ways.

## The hidden cost of waiting with a limit order

A limit order feels like a bargain: you name your price. The cost is that nothing guarantees a fill. Suppose you want to buy at $98 while price is $100. If price dips to $98.10 and bounces, you never get in and your idea plays out without you. That is not a failure, it is the trade-off you chose. Many beginners get frustrated and chase the price with a market order at $103, which is usually the worst of both worlds.

A calmer approach: decide beforehand whether you will accept missing the move. If the answer is "yes, I only want that price", leave the limit and walk away. If the answer is "no, I want to be in", you should have used a different size or a different plan.

## What a stop does and does not do

A stop order stays dormant until price reaches its trigger, then becomes a real order. If it becomes a market order, you get out but maybe not at the trigger price. If it becomes a limit order, you get a price you accept but may not get out at all. Because of this, a stop is a plan for the typical case, not a guarantee against the worst case. In very fast moves, even a good stop can fill several percent beyond its trigger.

## Maker and taker in practice

Exchanges usually charge lower fees to orders that add liquidity (makers) than to orders that remove it (takers). A resting limit order that fills later is typically a maker. A market order is a taker. On a single trade the difference looks tiny, but a person who trades often can pay noticeably more as a taker. Keep this in mind, and do not let the saving push you into a limit order you would never want to miss.

## Four order mistakes worth avoiding

- Using a market order on a thin coin without looking at the order book first.
- Placing a stop exactly on a round number where many other stops sit.
- Forgetting that a resting order stays live. A forgotten limit order can fill days later when you no longer agree with it.
- Sending a bigger order than your plan allows because "the price looked great".

## Scenario: $1,000 market order in a thin book

You place a market buy for $1,000. The first few coins fill at $100.00, but the order has to climb the asks and the average fill ends up at $100.05, which is 0.05% worse. That is $0.50 of slippage. On a calm major coin it is negligible. On a thin coin, or a bigger order, the same mistake can cost many times more. A limit order would have avoided it, at the price of maybe not filling.

### Common beginner mistakes here

- Using market orders on illiquid coins.
- Placing a stop-limit with the limit too close to the stop.
- Not checking that a limit order has actually filled before you assume you are in the trade.

## What to remember

- You buy at the ask and sell at the bid when trading instantly; the gap between them is the spread.
- Market orders are fast but cost the spread and possible slippage; limit orders control the price but may not fill.
- A stop order triggers at a price you choose to limit losses. It is a plan, not a guarantee of the exit price.

[paper trading](https://cryptobolt.io/trade)

## Check your understanding

Four quick questions. Wrong answers are fine: the explanation is where you learn.

Your progress is saved in this browser only.

Educational content only, not financial advice. Trading carries a high risk of loss. Examples use made-up numbers. See our [editorial policy](https://cryptobolt.io/editorial-policy).

---
CryptoBolt is a market-data and education tool, not an exchange and not financial advice. Contact: info@cryptobolt.io