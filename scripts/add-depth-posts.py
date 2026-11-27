#!/usr/bin/env python3
"""Insert new written sections into existing posts/*.md articles, then rebuild with `npm run build:blog`.
Idempotent: a section is skipped if a heading with the same text already exists in the post.
Each entry is (heading to insert before, new markdown). Numbers are rounded and illustrative; no predictions.
Run from the project root:  python3 scripts/add-depth-posts.py
"""
import pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent.parent
POSTS = ROOT / "posts"

NEW = {}

NEW["1000-dollar-day-trap"] = ("## What to do with that instead", """## What the arithmetic of a $1,000 day requires

Turn the headline into a requirement and it stops looking casual. To make $1,000 in one day, you need a return that matches your account size:

| Account size | Daily return needed for $1,000 |
|---|---|
| $5,000 | 20% |
| $20,000 | 5% |
| $50,000 | 2% |
| $100,000 | 1% |

Most traders do not hold $50,000 to $100,000 for a single day's trading, so the people posting such results are typically using leverage or very large positions. That means two things. First, the same position could just as easily have lost $1,000 or more. Second, a single day is not a business: what matters is whether the approach holds up across hundreds of days, including the bad ones.

It also helps to remember what is not shown. A screenshot of one winning day hides the losing days before it and the fees on every trade. If someone posted ten days in a row, including the red ones, the picture would usually look very different. That is not cynicism, it is just how survivorship works: the winners post, and the rest go quiet.
""")

NEW["ai-meets-crypto"] = ("## What's next", """## A practical test for any "AI crypto" claim

Marketing around AI and crypto moves faster than the products behind it. A few questions cut through most of the noise:

1. **What data does it actually see?** An AI that only reads old text cannot know today's funding rate. Look for live inputs it names.
2. **Can you check its claims?** A good answer points to a number or a panel you can open yourself. If you cannot verify it, treat it as an opinion.
3. **Does it admit uncertainty?** Markets are uncertain. A tool that never says "this is unclear" is probably overselling.
4. **Does it make price promises?** If it tells you where a coin will be next week, that is a warning sign, not a feature.
5. **Who is paid when you act on it?** A tool that earns from your trades has different incentives from one that does not.

None of these questions needs technical knowledge. They simply move the conversation from "is it AI?" to "is it useful and honest?", which is the question that matters.
""")

NEW["ai-research-grounded-data"] = ("## Frequently asked questions", """## A worked example: checking one claim

Suppose the AI desk says: "Funding on this coin is elevated, which suggests traders are leaning long." Here is how to check that in two minutes.

First, find the funding rate on the terminal and note the number. Second, compare it with what is normal for that coin: a rate of 0.01% per eight hours is the common baseline on many exchanges, so a reading of 0.05% is several times higher. Third, look at open interest. If open interest has also been rising, more positions are being opened, and the long side is paying to hold them. Fourth, check price. If price has not moved much while funding climbed, positions may be building without much price progress.

At the end you have not learned where price will go. You have learned that the claim matches the data, and what the data does and does not say. That is the standard worth holding any AI summary to: every sentence should be something you could verify yourself in a few clicks.
""")

NEW["bitcoin-halving-explained"] = ("## How to use this knowledge sensibly", """## Halving myths, checked

A few ideas about the halving are repeated so often that they are easy to accept without thinking.

**"The halving makes the price go up."** The halving reduces the rate of new supply. Whether that changes the price depends on demand, which no rule fixes. Markets also know the date years in advance, so much of the expectation can already be in the price.

**"The halving happens on a fixed date."** It happens every 210,000 blocks. Blocks arrive about every ten minutes on average, so the calendar date is an estimate that shifts with how fast blocks are found.

**"Miners stop mining after the halving."** Their reward per block is cut, which raises pressure on those with high costs. Miners with cheaper power and better hardware continue. Over time, transaction fees are meant to make up a larger share of miner income.

**"Supply drops by half."** Only the *new* supply per block is halved. The existing coins stay where they are. The block reward started at 50 BTC and has fallen to 3.125 BTC since the April 2024 halving.

The useful way to hold this is simple: the halving is a scheduled, known change to how fast new coins appear. It is context for the story of Bitcoin, not a trading signal on its own.
""")

NEW["day-trading-crypto-realistic-returns"] = ("## A more honest way to explore this", """## The arithmetic of frequent trading

Even before skill comes into it, trading often has a built-in handicap: costs. Take a trader with a $5,000 account who trades 5 times a day using the full account, paying about 0.2% per round trip in fees and slippage. That is $10 per trade, or $50 a day. Over 20 trading days that is about $1,000, a fifth of the account, just to stand still.

Now compare a trader who makes 2 careful trades a week with the same costs: about $80 a month. The second trader needs far less luck or skill to break even, simply because fewer costs are in the way.

This is why many of the people who last in trading do less, not more. They wait for setups where the likely reward is large compared with the cost of trying. It is also why the first month in paper trading is useful: you can count how often you actually trade and see how much of your result is just cost.

A realistic goal for a beginner is not to match a screenshot, it is to end the year with the account intact and a clearer idea of whether trading suits you.
""")

NEW["dollar-cost-averaging-crypto"] = ("## What can go wrong", """## Choosing the interval and the amount

People spend a lot of time choosing between weekly and monthly purchases. In practice, the difference between them is small compared with the other choices you make. What matters more:

- **The amount.** Pick a sum that you could keep buying even in a month when you are short of cash. A plan you abandon after three months teaches you little.
- **The consistency.** Buying on a fixed date, automatically if possible, removes the temptation to guess a "better" day.
- **The fees.** If the platform charges a fixed fee per purchase, small frequent buys can lose a large share to fees. A $10 purchase with a $1 fee costs you 10% before price moves at all. Check the fee table before choosing a schedule.
- **The time frame.** DCA is designed for long horizons. If you may need the money in a few months, the schedule does not remove the risk that the price is lower when you need to sell.

A simple approach is to decide an amount and a date, write down how long you plan to continue, and decide in advance what would make you stop. Then leave it alone. The {{dca-calculator|DCA calculator}} lets you see how a schedule would have averaged out on past prices, which is useful for understanding the method, not for predicting the future.
""".replace("{{dca-calculator|DCA calculator}}", "[DCA calculator](dca-calculator)"))

NEW["fear-and-greed-index"] = ("## Common mistakes", """## Using the index with your own plan

The index is most useful as a mood gauge, not a signal. A short routine keeps it in its place.

1. **Read the score and the trend.** A reading of 25 that has been falling for a week says something different from a reading of 25 that has just jumped up from 10.
2. **Ask what you are doing about it.** If the answer is "buying because the score is low" or "selling because it is high", pause. That is a rule of thumb many people share, so it can be crowded, and it ignores your own situation.
3. **Check it against your plan.** Does your plan have a trade here? Does the mood change your position size or your stop? If the index is extreme, the sensible response is often to size down, because moves can be fast in both directions.
4. **Look at the price action beside it.** Mood and price usually move together. A gap between them, such as price rising while sentiment stays fearful, is an observation worth noting, not a verdict.

Used this way, the index stops being a button and becomes a prompt to check your own discipline. It is a useful question to ask, "Am I reacting to the crowd?", even if the score cannot answer it for you.
""")

NEW["funding-rate-explained"] = ("## The catch", """## Funding in three scenarios

Examples make the cost easier to feel. All three assume a $10,000 long position, and funding paid every eight hours, which is common on many perpetual markets.

**Calm market, 0.01% per interval.** You pay $1 every eight hours, or $3 a day. Over a month that is about $90, about 0.9% of the position. Not alarming, but it adds up if you hold for weeks with a small expected gain.

**Crowded longs, 0.05% per interval.** You pay $5 every eight hours, $15 a day, about $450 a month, which is 4.5% of the position. A trade that you expected to make 5% could have most of that eaten by funding alone.

**Negative funding, −0.02% per interval.** Now shorts pay longs. You would *receive* about $2 every eight hours, $6 a day. This does not make the trade good, but it changes the holding cost.

The rate can change at each interval, so these are snapshots, not forecasts. The habit to build is simple: before holding a perpetual position for more than a day, look at the current rate and multiply it out. The {{funding-fee-calculator|funding fee calculator}} does the arithmetic for you.
""".replace("{{funding-fee-calculator|funding fee calculator}}", "[funding fee calculator](funding-fee-calculator)"))

NEW["how-to-calculate-crypto-profit-and-loss"] = ("## Common mistakes", """## A full worked example, start to finish

Seeing all the steps in one place helps. You buy 2 coins at $100 each and pay a 0.10% fee. You later sell both at $110 and pay 0.10% again.

- **Buy:** 2 × $100 = $200, plus a fee of $0.20, so you spend $200.20.
- **Sell:** 2 × $110 = $220, minus a fee of $0.22, so you receive $219.78.
- **Profit:** $219.78 − $200.20 = **$19.58**.
- **Return:** $19.58 ÷ $200.20 ≈ **9.78%**.

The headline price move was 10%, but your return was 9.78%, because fees took a small bite on each side. On a small, short trade that is a rounding error. On a trade that makes 0.5%, the same fees could erase most of the gain, which is why it matters to include them.

Now test the other direction. If you had sold at $95 instead, you would receive $189.81 after a $0.19 fee, for a loss of $10.39, or about 5.19%. The loss is a little larger than the 5% price drop, again because of fees. Fees always make a winning trade smaller and a losing trade larger.
""")

NEW["how-to-read-an-order-book"] = ("## A short checklist before a larger order", """## Walls that disappear

A very large order sitting in the book looks like a barrier. It is natural to think price will stop there. But resting orders can be cancelled at any moment, and some traders place large orders with no intention of letting them fill, a practice called spoofing. It is prohibited in regulated markets, though how well it is policed on crypto venues varies.

You do not need to accuse anyone to be careful. Treat a big order as a temporary fact about the book, not as a promise. A few ways to read it more honestly:

- **Watch what happens when price approaches.** If the order is traded through, it was real. If it vanishes just before price arrives, it was not something to rely on.
- **Look at it over time.** An order that has sat for hours and been partially filled is more believable than one that appeared a moment ago.
- **Compare it with the rest of the book.** One huge order amid thin depth says more about the thin depth than about the order.
- **Do not size your trade around it.** If your plan only works because a wall stays put, the plan has a hole.

The book is a live picture of intentions, and intentions can change quickly. Useful information, but always a little provisional.
""")

NEW["impermanent-loss-explained"] = ("## A short checklist before you provide liquidity", """## Three outcomes side by side

For a standard 50/50 pool, impermanent loss depends only on how far the price ratio has moved from when you deposited, not on the direction. The rounded values below come from the usual formula, 2√r ÷ (1 + r) − 1, where r is the price ratio.

| Price of one token versus the other | Loss compared with just holding |
|---|---|
| 1.25x (up 25%) | about 0.6% |
| 2x (doubles) | about 5.7% |
| 4x | 20% |
| 0.5x (halves) | about 5.7% |

Notice two things. A move up and the matching move down produce the same loss, and the loss grows quickly as the ratio diverges. A 2x move costs about 5.7%, but a 4x move costs 20%, far more than double.

That is why the question "will I earn enough fees?" is the right one. If a pool pays 15% a year in fees and the pair moves 2x, the fees might cover the 5.7% shortfall over a few months. If the pair moves 4x quickly, the shortfall could take much longer to recover. The comparison you care about is fees earned against the loss, not either number alone. You can try your own numbers in the {{impermanent-loss-calculator|impermanent loss calculator}}.
""".replace("{{impermanent-loss-calculator|impermanent loss calculator}}", "[impermanent loss calculator](impermanent-loss-calculator)"))

NEW["most-useful-crypto-tools-2027"] = ("## Frequently asked questions", """## Five questions to ask before you trust any trading tool

New tools appear constantly. Before you build a habit around one, run it through a short filter.

1. **Does it show its assumptions?** A calculator that hides how it gets its numbers is hard to trust. Good tools show the formula or at least the inputs.
2. **Does it use realistic costs?** A result that ignores fees, slippage and funding will look better than reality.
3. **Does it change your behaviour for the better?** The best tools make you slow down: they ask for a stop, show a liquidation price, or reveal a loss you were ignoring.
4. **Can you test it on something you already know?** Feed it a trade whose outcome you understand. If the output is wrong, you have learned something cheaply.
5. **Does it ask for more than it needs?** A calculator should not need your API keys. Be careful with anything that asks for access to your funds.

No tool replaces a plan. The most useful ones simply make the parts of the plan harder to skip.
""")

NEW["open-interest-explained"] = ("## What it cannot do", """## A stylised example: a leverage flush

A made-up but typical sequence shows how open interest and price interact. Treat it as a teaching story, not a record of a particular day.

Over several days price drifts up a few percent. Each day open interest climbs, which means new positions are being opened, and funding rises as more traders pile on the long side. The market looks calm because nothing dramatic has happened, but a lot of borrowed money is leaning one way.

Then a modest drop of 3% to 4% happens, perhaps from a headline or a large sell order. Some highly leveraged longs hit their liquidation prices. Their positions are closed by force, and those forced sales push price down further, which triggers the next group of liquidations. Within minutes, open interest drops sharply, because positions are being closed, and price may overshoot lower than the news justifies.

The lesson is not that every rise in open interest ends this way. Most do not. It is that high and rising open interest combined with high funding tells you the market is crowded, and crowded markets can move abruptly. That is a good moment to check your own leverage and your distance to liquidation.
""")

NEW["position-sizing-and-the-one-percent-rule"] = ("## Practising it", """## What changes when the stop distance changes

The same account and the same risk percentage can lead to very different position sizes. Take a $10,000 account risking 1%, so $100 per trade, buying at $50.

| Stop distance | Risk per coin | Coins | Position size |
|---|---|---|---|
| 2% ($49.00) | $1.00 | 100 | $5,000 |
| 5% ($47.50) | $2.50 | 40 | $2,000 |
| 10% ($45.00) | $5.00 | 20 | $1,000 |

In each case a stop-out costs about $100. The tighter the stop, the bigger the position, which feels attractive, but a tight stop is also hit more often by ordinary noise. A 2% stop on a coin that routinely moves 5% in an hour will be triggered constantly, so the large position gives you more trades to lose, not more profit.

This is why you start with the chart, not the account. Find where the idea is wrong, and let the stop distance tell you the size. If that size is too small to be worth the effort, the honest conclusion is that this trade does not suit your account, not that you should widen the risk.
""")

NEW["risk-reward-ratio-and-win-rate"] = ("## Do not trust a short sample", """## How costs shift the break-even

The break-even win rates in the table above ignore fees and slippage. Add a realistic cost and they move. Suppose costs equal 0.1R per trade, meaning every trade loses a tenth of your planned risk to costs.

- At **1:1**, a winner nets +0.9R and a loser costs −1.1R. Break-even is a win rate of 55%, not 50%.
- At **1:2**, a winner nets +1.9R and a loser costs −1.1R. Break-even is about 37%, not 33%.

The tighter your stops and the more often you trade, the larger the cost is in relation to your risk, and the more these shifts matter. A strategy that looks marginally profitable before costs can easily be unprofitable after them.

Practical consequence: when you test an idea, record your real costs in R from the first trade. When you plan a trade, prefer setups where the reward is large compared with both the risk and the cost of trying. And be suspicious of any approach that depends on very small stops and very high frequency, because that is exactly where costs dominate.
""")

NEW["round-number-levels"] = ("## Frequently asked questions", """## Levels inside levels

Not every round number is equal. A useful way to think about it is as a hierarchy.

The biggest ones are the thousands and ten-thousands for a coin like Bitcoin, such as $60,000 or $100,000. These attract headlines, large orders and a lot of attention. Next are the half levels, like $62,500 or $57,500, and the hundreds in between. Smaller coins follow the same pattern at a smaller scale, so $1.00 and $0.50 matter for a low-priced token.

Two practical points follow. First, price often reacts a little *before* the exact number, because traders place orders slightly early so they are filled. A resistance at $60,000 may show up as a pause at $59,800. Second, because many stops sit just beyond the number, price sometimes pushes through briefly and then reverses, leaving a wick. Both are tendencies, not rules.

Use round numbers as zones, in the same way you would use any support or resistance level. Place your own stop beyond the zone, not on the number, and decide what you will do if the level fails. The number gives you a place to look. It does not tell you what happens next.
""")

NEW["spot-vs-futures"] = ("## Where to go next", """## Choosing between them: questions to ask yourself

There is no universal answer, but a few questions usually point to the right tool.

**How long do I plan to hold?** Long holds fit spot better, because futures have funding costs and liquidation risk that build over time.

**Do I want to own the coin?** Only spot gives you the actual asset, which you can move to a wallet. A futures contract is an agreement about price, not ownership.

**Do I want to bet on a fall?** Futures let you take a short position. On spot you can only sell what you hold.

**Can I handle the extra risk?** A leveraged position can be closed by force if price moves against you, even if the coin later recovers. That requires planning your stop and size before you open the trade.

**What are my costs?** Compare trading fees, funding, and the spread. A cheap-looking futures trade can cost more over a week than a spot trade, once funding is counted.

A sensible path for most beginners is to learn on spot or paper trading, understand liquidation and funding with practice trades, and only then consider small, low-leverage futures positions. The {{liquidation-price-calculator|liquidation price calculator}} and the {{funding-fee-calculator|funding fee calculator}} are good places to start.
""".replace("{{liquidation-price-calculator|liquidation price calculator}}", "[liquidation price calculator](liquidation-price-calculator)").replace("{{funding-fee-calculator|funding fee calculator}}", "[funding fee calculator](funding-fee-calculator)"))

NEW["staking-apr-vs-apy"] = ("## Questions to ask before you stake", """## The same 5% two ways

Suppose you stake $1,000 at a quoted 5%. What you receive depends on whether that is APR or APY and how often rewards compound.

- **5% APR, no compounding:** $50 after one year.
- **5% APR, compounded monthly:** about $51.16, an effective rate of roughly 5.12% (the APY).
- **5% APR, compounded daily:** about $51.27, roughly 5.13%.

The differences here are small, which is a useful lesson in itself: compounding matters more at high rates and over long periods. At 20% APR, monthly compounding gives roughly 21.9% APY, a gap you would notice.

The bigger question is the price of the coin. If you stake a token for a year, earn 5% in new tokens, and the token falls by 20%, your position is worth less in dollars even though the number of tokens went up. Staking rewards are paid in the asset, so they do not protect you from its price.

Also check whether the quoted rate is fixed or variable. Many networks adjust rewards based on how much is staked overall, so a number that looks attractive today can change next month. The {{crypto-staking-calculator|staking calculator}} lets you test different rates and compounding periods.
""".replace("{{crypto-staking-calculator|staking calculator}}", "[staking calculator](crypto-staking-calculator)"))

NEW["stop-loss-orders-explained"] = ("## Practice before it costs money", """## Trigger prices, mark price and fast markets

Two details trip up many beginners on futures.

**What price triggers the stop?** Many exchanges let you choose between the last traded price and the mark price. The last price is where the most recent trade happened, and can spike on a single large order. The mark price is a smoothed reference, designed to resist manipulation, and is often used for liquidations. A stop that triggers on the last price may fire in a brief wick that the mark price ignores. Check which one your order uses and pick deliberately.

**Where does the stop live?** A stop order placed on the exchange is checked by the exchange's systems. A "mental stop", which you plan to place by hand, depends on you being awake, online and willing to act. Crypto markets run around the clock, so there is no overnight gap like in stock markets, but sudden spikes at 3 a.m. still happen. If you cannot watch the market, a stop on the exchange is far safer.

**What about outages?** Exchanges can slow down or pause under heavy load, exactly when stops matter most. You cannot remove that risk, but you can size positions so that a worse-than-planned fill does not hurt too much. As a rule of thumb, assume your real loss can exceed your planned loss, and make sure that is still acceptable.
""")

NEW["why-we-dont-predict-crypto-prices"] = ("## The catch", """## Scenario thinking in practice

Replacing "where will it go?" with "what will I do if?" sounds abstract, so here is a concrete example. Imagine a coin trading at $100 after a strong week.

A prediction says: "It will reach $120." You cannot do anything with that except wait and hope.

A scenario plan says:

- *If price holds above $95 and pushes through $105 on rising volume,* the move has more support, so I may buy a small position with a stop just under $95.
- *If price falls below $95,* the recent strength has failed, so I stay out or exit any position.
- *If price chops between $95 and $105,* nothing is clear, so I do nothing.

Notice what this does. It names the levels that matter, it ties each action to evidence rather than a feeling, and it includes a "do nothing" branch, which beginners tend to skip. You are not claiming to know the future. You are preparing responses to the futures that could plausibly happen.

It also gives you a way to judge yourself afterwards. Did you follow the plan for the scenario that occurred? That is a question you can answer, while "was my prediction right?" often depends on luck.
""")


def main():
    changed = 0
    for slug, (anchor, block) in NEW.items():
        p = POSTS / f"{slug}.md"
        raw = p.read_bytes().decode("utf-8")
        crlf = "\r\n" in raw
        text = raw.replace("\r\n", "\n")
        heading = block.strip().split("\n", 1)[0]
        if heading in text:
            continue
        if anchor not in text:
            print("anchor missing:", slug, anchor)
            continue
        text = text.replace(anchor, block.strip() + "\n\n" + anchor, 1)
        if crlf:
            text = text.replace("\n", "\r\n")
        p.write_bytes(text.encode("utf-8"))
        changed += 1
    print("posts updated:", changed)


if __name__ == "__main__":
    main()