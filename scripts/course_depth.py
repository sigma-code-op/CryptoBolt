# -*- coding: utf-8 -*-
"""Extra written depth for each course lesson. build-course.py appends DEPTH[slug] to the lesson body.
Shorthand: [[glossary-id|text]] -> glossary link, {{page-slug|text}} -> site link.
All numbers are illustrative and rounded. No predictions, no performance claims.
"""

DEPTH = {}

DEPTH["course-what-is-trading"] = """
<h2 id="depth-a-day-in-two-lives">Two beginners, the same $500</h2>
<p>Numbers make the point better than advice does. Imagine two people who each start with $500 and a vague wish to "make some extra money".</p>
<p><strong>Sam</strong> opens a leveraged position worth $5,000 on the first day, because the app made it one tap. Price moves 2% against him. That is a $100 loss, a fifth of the account, in an afternoon. He panics, adds money to "win it back", and ten days later the account is empty.</p>
<p><strong>Priya</strong> starts in paper trading. Over four weeks she places thirty practice trades, risking about $5 on each. Her results are mixed: eleven winners, nineteen losers, and a small net loss. But she notices something useful. Nearly all her worst trades were entered within minutes of seeing a big green candle. She writes that down as a rule: no entries right after a spike. Only then does she put in a small amount of real money.</p>
<p>Neither person was smarter than the other. Priya simply paid for her education with fake money and Sam paid with real money. That is the single biggest lever a beginner controls.</p>

<h2 id="depth-who-is-on-the-other-side">Who is on the other side of your trade?</h2>
<p>Every trade needs two parties. When you buy, someone sells to you, and that someone may be a patient long-term holder, a market-making firm quoting prices all day, or a program that reacts in milliseconds. You will rarely know which. What matters is that you should not assume the other side is making a mistake. Often they are simply working on a different time scale, or hedging something you cannot see.</p>
<p>This is why a trade needs a reason that goes beyond "it looks like it will go up". A better reason sounds like: "Price has pulled back to a level where buyers stepped in twice before, I can place my exit just below it, and if I am wrong the loss is small." That sentence can be checked, and it contains its own exit.</p>

<h2 id="depth-skills-that-pay">Where the real skill is</h2>
<p>New traders usually think the skill is predicting direction. In practice, direction is the least controllable part. Four things are far more in your hands:</p>
<ul>
<li><strong>How much you risk.</strong> Cutting a position in half halves every loss, whether or not your idea was good.</li>
<li><strong>Where you exit if you are wrong.</strong> A planned exit turns an open-ended problem into a known cost.</li>
<li><strong>What you pay.</strong> Fees and slippage are certain, while profits are not. Fewer, better trades usually cost less.</li>
<li><strong>How you behave after a loss.</strong> A calm routine after a losing trade matters more than any indicator.</li>
</ul>
<div class="mk-callout mk-callout-key-idea" role="note"><strong>Key idea:</strong> A trader's edge is a bundle of habits, not a secret signal. The habits in this course (sizing, exits, costs, journaling) are the ones that keep you in the game long enough to improve.</div>

<h2 id="depth-questions-beginners-ask">Questions beginners ask before they start</h2>
<p><strong>"How much money do I need?"</strong> To learn, none: paper trading is free. To trade for real, only an amount you could lose completely without it changing your life. Many beginners start with a sum so small that a bad day is an annoyance, not a crisis.</p>
<p><strong>"Can I do this full time?"</strong> Treat that as a long-term question. Trading income is uneven, and a salary is not. Learning part time, with a separate income, removes the pressure to force trades just to pay bills.</p>
<p><strong>"Should I follow someone's signals?"</strong> A signal you do not understand is a decision you cannot manage. If you cannot say why you are in a trade and where you will get out, you will not know what to do when it moves against you. Learning your own process is slower but it is the one that lasts.</p>
"""

DEPTH["course-how-markets-work"] = """
<h2 id="depth-price-is-a-last-agreement">Price is only the last agreement</h2>
<p>The number on your screen is not what the coin is "worth". It is the price at which the most recent buyer and seller agreed to trade. A second later it can be different, because a different buyer or seller showed up. This is why price can jump on thin markets: there were simply few people willing to trade near the old number.</p>
<p>Two ideas explain most moves. <strong>Liquidity</strong> is how much can be traded without moving the price much. <strong>Volume</strong> is how much did trade over a period. A coin with deep liquidity can absorb a large order quietly. A thin one cannot, and your own order can push the price against you before it finishes filling.</p>

<h2 id="depth-a-market-order-story">What really happens when you press buy</h2>
<p>Say the order book shows these sell offers: 2 coins at $100.10, 3 coins at $100.20 and 5 coins at $100.30. You send a market order to buy 6 coins. Your order takes the first 2 at $100.10, then 3 at $100.20, then 1 at $100.30. Your average price is about $100.18, not the $100.10 you saw. That small gap is slippage, and it grows with order size and with thin books.</p>
<p>Nothing went wrong. The market simply gave you what was available, in order, cheapest first. Understanding this one mechanism removes a lot of beginner confusion about why fills "differ from the chart".</p>

<h2 id="depth-spot-and-derivatives">Spot, futures and why prices stay close</h2>
<p>When you buy on the spot market, you own the coin. A futures contract is an agreement whose value tracks the coin, and it lets you take a bigger position with less money. Perpetual futures never expire, so exchanges use a small periodic payment called the funding rate to nudge the contract price back toward the spot price. You will meet this properly in later lessons. For now, remember the shape: spot is ownership, futures are exposure with extra moving parts.</p>

<h2 id="depth-what-moves-prices">What moves prices in the short run</h2>
<ul>
<li><strong>News and scheduled events</strong>, such as economic data releases or an exchange listing.</li>
<li><strong>Positioning.</strong> When many traders lean the same way with borrowed money, a small move against them can force exits that push price further.</li>
<li><strong>Liquidity changes.</strong> Weekends and late hours often have thinner books, so moves can look bigger.</li>
<li><strong>Plain noise.</strong> Many moves have no clear cause at all. Not every candle needs a story.</li>
</ul>
<div class="mk-callout mk-callout-key-idea" role="note"><strong>Key idea:</strong> You do not need to know why price moved to manage a trade well. You need to know where you are wrong, how much you lose if that happens, and whether the market is liquid enough to get you out.</div>
<p>A useful habit while you learn: when price moves sharply, spend a minute on the order book and recent candles before reading a headline. Often the book already shows what happened, such as a stack of orders being cleared in a thin area.</p>
"""

DEPTH["course-how-to-read-candlestick-charts"] = """
<h2 id="depth-reading-a-candle-sequence">Reading a short sequence, not a single candle</h2>
<p>One candle tells you what happened inside one time slice. A sequence tells you about momentum. Compare these two imaginary hourly sequences that both end at the same price:</p>
<p><strong>Sequence A:</strong> four candles in a row that each close higher than they open, with small wicks. Buyers were in control in every hour.</p>
<p><strong>Sequence B:</strong> a large down candle, then three small candles drifting up. Sellers hit hard, and buyers only partly recovered.</p>
<p>The ending price is identical, but the story is different. In A the move is steady, so a pause would not be surprising. In B the market first rejected a level aggressively, and a retest of that area is worth watching. You are not predicting anything. You are describing what the evidence so far says.</p>

<h2 id="depth-wicks-tell-stories">What wicks are telling you</h2>
<p>A long upper wick means price went up but sellers pushed it back down before the candle closed. A long lower wick means the reverse. Wicks are rejected prices, places the market tried and did not accept. Three practical uses:</p>
<ul>
<li>A cluster of long lower wicks around one price shows buyers defending that area, which is useful for placing a stop just beyond it.</li>
<li>A very long wick on a low-volume candle can be a brief spike through thin orders and may mean little.</li>
<li>A wick that closes back inside the previous range often shows a failed breakout, a sign that the move did not attract follow-through.</li>
</ul>

<h2 id="depth-timeframes">Choosing a timeframe without overthinking it</h2>
<p>A candle on the 1-minute chart and one on the daily chart are the same shape but carry very different weight. Longer timeframes contain more trading, so their levels tend to be respected more often than levels on a 1-minute chart. A common beginner routine is to look at the daily chart first to see the broad picture, then step down to the 1-hour or 4-hour chart to plan the entry and the exit. Switching constantly between five timeframes until one agrees with you is a way of fooling yourself, so decide your main timeframe before you open the chart.</p>

<h2 id="depth-volume-context">Why volume gives candles context</h2>
<p>A big green candle with heavy volume means many traders took part. The same candle on thin volume may have been moved by a few orders. Volume does not tell you direction, but it tells you how much to trust the move. If price breaks above a recent high and volume barely rises, treat the break with more doubt than if volume surges.</p>
<div class="mk-callout mk-callout-example" role="note"><strong>Example:</strong> Price has failed three times to close above $60. On the fourth attempt a green candle closes at $61 on volume nearly double the recent average. That is more convincing than a $61 close on shrinking volume, because more traders were willing to buy at the higher price. It still proves nothing about tomorrow. It just changes how you size your doubt.</div>
<p>Practise by scrolling back on any chart, covering the right side with your hand, and describing in one sentence what the last five candles show. Then uncover and see what came next. You will quickly notice how often the honest answer is "it was unclear", and that is a healthy thing to learn early.</p>
"""

DEPTH["course-order-types"] = """
<h2 id="depth-choosing-the-order">Choosing the order: a plain decision guide</h2>
<p>Instead of memorising definitions, ask three questions in this order.</p>
<ol>
<li><strong>Do I care more about getting in now, or about the price?</strong> If it must happen now, a market order. If price matters more, a limit order.</li>
<li><strong>Do I need a protective exit?</strong> If yes, plan a stop order before you enter, not after.</li>
<li><strong>Is the market calm or fast?</strong> In a fast market, market orders slip more and limit orders may not fill at all. Neither is "safe", they fail in different ways.</li>
</ol>

<h2 id="depth-limit-order-trade-offs">The hidden cost of waiting with a limit order</h2>
<p>A limit order feels like a bargain: you name your price. The cost is that nothing guarantees a fill. Suppose you want to buy at $98 while price is $100. If price dips to $98.10 and bounces, you never get in and your idea plays out without you. That is not a failure, it is the trade-off you chose. Many beginners get frustrated and chase the price with a market order at $103, which is usually the worst of both worlds.</p>
<p>A calmer approach: decide beforehand whether you will accept missing the move. If the answer is "yes, I only want that price", leave the limit and walk away. If the answer is "no, I want to be in", you should have used a different size or a different plan.</p>

<h2 id="depth-stop-order-reality">What a stop does and does not do</h2>
<p>A stop order stays dormant until price reaches its trigger, then becomes a real order. If it becomes a market order, you get out but maybe not at the trigger price. If it becomes a limit order, you get a price you accept but may not get out at all. Because of this, a stop is a plan for the typical case, not a guarantee against the worst case. In very fast moves, even a good stop can fill several percent beyond its trigger.</p>
<div class="mk-callout mk-callout-example" role="note"><strong>Example:</strong> You buy at $100 and set a stop-market at $95. A sudden bad headline pushes price from $97 to $92 within seconds. Your stop triggers at $95 and the market order fills against whatever bids are left, perhaps around $93. You lost about 7%, not 5%. The stop still did its job: it took you out before price fell further. The lesson is to size positions so that a bit more than your planned loss is still survivable.</div>

<h2 id="depth-maker-taker-in-practice">Maker and taker in practice</h2>
<p>Exchanges usually charge lower fees to orders that add liquidity (makers) than to orders that remove it (takers). A resting limit order that fills later is typically a maker. A market order is a taker. On a single trade the difference looks tiny, but a person who trades often can pay noticeably more as a taker. Keep this in mind, and do not let the saving push you into a limit order you would never want to miss.</p>

<h2 id="depth-order-mistakes">Four order mistakes worth avoiding</h2>
<ul>
<li>Using a market order on a thin coin without looking at the order book first.</li>
<li>Placing a stop exactly on a round number where many other stops sit.</li>
<li>Forgetting that a resting order stays live. A forgotten limit order can fill days later when you no longer agree with it.</li>
<li>Sending a bigger order than your plan allows because "the price looked great".</li>
</ul>
"""

DEPTH["course-trading-costs"] = """
<h2 id="depth-costs-add-up">A cost calculation worth doing once</h2>
<p>Costs feel small on one trade and large over many. Take a simple setup: you trade $1,000 per position, pay a 0.10% fee on entry and 0.10% on exit, and also lose about 0.05% to slippage on each side. That is 0.30% per round trip, or $3 on a $1,000 trade.</p>
<p>Now suppose you make 20 round trips in a month. Costs alone come to about $60, or 6% of the $1,000 you used per trade. Your trades must earn more than that just to break even. A beginner who makes 100 small trades with the same setup pays about $300 in costs, which is 30% of the $1,000 used per trade, before earning a cent.</p>
<div class="mk-callout mk-callout-key-idea" role="note"><strong>Key idea:</strong> Costs are the only part of trading that is guaranteed. Reducing how often you trade, and avoiding thin markets, is one of the few reliable ways to improve your results.</div>

<h2 id="depth-spread-slippage-fees">Three costs, three different causes</h2>
<ul>
<li><strong>Fees</strong> are charged by the exchange as a percentage of the trade. They are known in advance.</li>
<li><strong>Spread</strong> is the gap between the best buy price and the best sell price. If you buy and sell instantly you pay it every time.</li>
<li><strong>Slippage</strong> is the difference between the price you expected and the price you got, usually because your order was larger than the size available at the best price.</li>
</ul>
<p>On a large, liquid coin the spread can be tiny and slippage small. On a lightly traded coin, the spread alone can be a noticeable fraction of your expected profit.</p>

<h2 id="depth-funding-and-holding-costs">Costs that depend on how long you hold</h2>
<p>On perpetual futures, a funding payment is exchanged between long and short traders at regular intervals. When funding is positive, longs pay shorts; when negative, the opposite. A small rate can look harmless, but it repeats several times a day. At 0.01% per eight hours, a long position pays about 0.03% per day, close to 11% per year on the position size if the rate stayed the same, which it rarely does. That is why a trade you plan to hold for weeks needs a different cost check from one you hold for an hour.</p>
<p>Leverage also makes cost percentages larger relative to your own money. A 0.30% round-trip cost on a position ten times your margin is 3% of your margin, before the trade has even moved.</p>

<h2 id="depth-cost-checklist">A pre-trade cost checklist</h2>
<ol>
<li>Write the fee rate you actually pay, not the headline one. Fee tiers and token discounts change it.</li>
<li>Look at the order book. If your size would eat several levels, estimate the slippage.</li>
<li>Add the likely funding cost if the trade will run past a funding time.</li>
<li>Compare the total with the profit you expect. If costs take more than a fifth of the expected gain, the trade needs a better reason or a different size.</li>
</ol>
<p>The {{funding-fee-calculator|funding fee calculator}} and the {{crypto-profit-calculator|profit calculator}} can run these numbers for you, and doing so before you enter is one of the cheapest habits you can build.</p>
"""

DEPTH["course-leverage-for-beginners"] = """
<h2 id="depth-leverage-in-numbers">Leverage in numbers, step by step</h2>
<p>Leverage lets a small amount of money, called margin, control a larger position. With $100 of margin at 10x, you control a $1,000 position. Gains and losses are calculated on the full $1,000. A 1% move in price is therefore a 10% move in your margin: $10 on $100.</p>
<p>Now see what happens when the market turns. At 10x, a 10% move against you removes your entire margin, so the exchange closes your position. That is a liquidation, and it can happen on a perfectly normal day for many coins. At 20x the same thing happens on roughly a 5% move. At 50x, close to 2%. Fees and maintenance margin make the real distance a little shorter than these round figures.</p>
<div class="mk-table-wrap"><table class="mk-table">
<thead><tr><th scope="col">Leverage</th><th scope="col">Price move that wipes out margin (approx.)</th><th scope="col">Loss on margin from a 2% adverse move</th></tr></thead>
<tbody>
<tr><td>2x</td><td>about 50%</td><td>4%</td></tr>
<tr><td>5x</td><td>about 20%</td><td>10%</td></tr>
<tr><td>10x</td><td>about 10%</td><td>20%</td></tr>
<tr><td>25x</td><td>about 4%</td><td>50%</td></tr>
<tr><td>50x</td><td>about 2%</td><td>100%</td></tr>
</tbody></table></div>
<p>The table uses simple round numbers to show the shape. Your exchange's exact liquidation price depends on fees, margin mode and maintenance margin, so always check it with the {{liquidation-price-calculator|liquidation price calculator}} before you open a trade.</p>

<h2 id="depth-leverage-vs-size">The difference between leverage and risk</h2>
<p>Leverage and risk are related but not the same. What you actually risk on a trade is the distance from your entry to your stop, times your position size. You can trade 10x leverage and still risk only 1% of your account if the position is small and the stop is close. You can also trade 2x leverage and risk 30% of your account if the position is huge and there is no stop. The leverage number is a limit on how much room you have before liquidation, not a measure of how dangerous the trade is.</p>
<p>That is why the safest way to use leverage is the opposite of how it is advertised. Decide your stop first, size the position so that hitting the stop costs about 1% of the account, then use only as much leverage as needed to open that position. If the liquidation price sits comfortably beyond your stop, you are using leverage as a tool. If your stop sits beyond your liquidation price, the exchange will close you out before your plan does.</p>

<h2 id="depth-isolated-cross">Isolated and cross margin, briefly</h2>
<p>With <strong>isolated margin</strong>, only the margin you assign to a position is at risk. If it is liquidated, the rest of your account is untouched. With <strong>cross margin</strong>, your whole balance backs the position, which gives more room before liquidation but can put the entire account at stake. Beginners are usually better served by isolated margin, because the worst case is capped and visible.</p>

<h2 id="depth-leverage-habits">Habits that keep leverage from hurting you</h2>
<ul>
<li>Never add margin to a losing position just to push the liquidation price away. It turns a small, planned loss into a large one.</li>
<li>Start at the lowest leverage that lets you open the position you planned. Raise it only when you can explain why.</li>
<li>Expect fast moves around news and weekends, and avoid maximum leverage during them.</li>
<li>Practise with leveraged paper trades first. Seeing a liquidation happen with fake money is far cheaper than with real money.</li>
</ul>
"""

DEPTH["course-position-sizing"] = """
<h2 id="depth-sizing-walkthrough">A full sizing walkthrough</h2>
<p>Suppose your account is $2,000 and you decide to risk 1% per trade, which is $20. You want to buy a coin at $50 with a stop at $47. The distance between them is $3 per coin.</p>
<p>Position size is the amount you risk divided by the risk per unit: $20 ÷ $3 is about 6.67 coins. That position costs about $333 at $50. If the stop is hit, you lose about $20, plus a little for fees and slippage. If you had instead bought 20 coins because it "felt right", the same stop would cost $60, three times your plan.</p>
<p>Notice what drove the size: not your confidence, but the stop distance. A wider stop means fewer coins. A tighter stop means more coins, although tighter stops are hit more often by ordinary noise. The calculation forces a trade-off you would otherwise skip.</p>
<div class="mk-callout mk-callout-key-idea" role="note"><strong>Key idea:</strong> Size = (account × risk %) ÷ (entry − stop). Fix the percentage, find the stop from the chart, and let the position size be the result.</div>

<h2 id="depth-why-small-risk-wins">Why small risk per trade matters so much</h2>
<p>Losses are harder to recover than they look. A 10% loss needs about an 11% gain to get back to even. A 25% loss needs about 33%. A 50% loss needs 100%. Because of this asymmetry, a string of losses at big size can leave an account in a hole that is very hard to climb out of, even if your strategy is decent.</p>
<p>Consider ten losing trades in a row, which happens more often than people expect for strategies that win less than half the time. At 1% risk each, you are down about 9.6%. At 5% risk each, you are down about 40%. At 10% risk each, you are down about 65%. The strategy is the same, the outcome is entirely different, and only the sizing changed.</p>

<h2 id="depth-adjusting-for-reality">Adjusting for real conditions</h2>
<ul>
<li><strong>Volatility.</strong> If a coin routinely swings 8% a day, a 2% stop will be hit constantly. Either use a wider stop with a smaller size, or skip the coin.</li>
<li><strong>Several positions at once.</strong> If three trades all depend on the same market move, they are really one large trade. Count their combined risk, not each one alone.</li>
<li><strong>Fees and slippage.</strong> Allow a little extra, so a stop-out that costs slightly more than planned does not break your limit.</li>
<li><strong>Account changes.</strong> Recalculate from the current balance now and then. Do not keep sizing from an old, larger number after losses.</li>
</ul>

<h2 id="depth-sizing-routine">A routine you can repeat every time</h2>
<ol>
<li>Pick the risk percentage for the account and keep it fixed while you learn.</li>
<li>Find the exit that proves your idea wrong, based on the chart rather than the money.</li>
<li>Run the numbers in the {{position-size-calculator|position size calculator}}.</li>
<li>Check the liquidation price if you use leverage. It should sit beyond your stop.</li>
<li>Write the plan down: entry, stop, size, and the dollar loss if wrong.</li>
</ol>
<p>It takes a minute, and it is the single habit that most often separates accounts that survive from accounts that do not.</p>
"""

DEPTH["course-stop-loss-and-risk-reward"] = """
<h2 id="depth-where-the-stop-goes">Where does the stop actually go?</h2>
<p>A good stop goes where your idea is proven wrong, not where a fixed percentage happens to land. If you buy because price bounced from a support area, a sensible stop sits just below that area. If price falls through it, the reason for the trade has gone. Then you work out position size from that distance, as in the previous lesson.</p>
<p>Three common mistakes to avoid: a stop so tight that normal noise hits it, a stop at an obvious round number where many others sit, and a stop that you move further away whenever price approaches it. The last one defeats the purpose of having a stop at all.</p>

<h2 id="depth-reward-risk-numbers">Risk-reward and win rate work as a pair</h2>
<p>Risk-reward compares what you might gain with what you might lose. If you risk $20 to make $60, the ratio is 1:3. What is less obvious is that the ratio only means something alongside how often you win.</p>
<div class="mk-table-wrap"><table class="mk-table">
<thead><tr><th scope="col">Risk-reward</th><th scope="col">Break-even win rate (before costs)</th></tr></thead>
<tbody>
<tr><td>1 : 1</td><td>50%</td></tr>
<tr><td>1 : 2</td><td>about 33%</td></tr>
<tr><td>1 : 3</td><td>25%</td></tr>
<tr><td>2 : 1 (risk 2 to make 1)</td><td>about 67%</td></tr>
</tbody></table></div>
<p>With a 1:3 setup you can lose three trades out of four and still break even. With a 2:1 setup you need to win two out of three just to stay level. Neither is automatically better. A strategy with a high win rate can use a small reward, and a strategy with a low win rate needs a large one. The trap is quoting a big ratio without checking whether the target is realistically reachable.</p>

<h2 id="depth-expectancy">Expectancy: the average result per trade</h2>
<p>Expectancy combines both numbers. If you win 40% of the time, earn 2R on a win and lose 1R on a loss, then on average each trade returns (0.4 × 2) − (0.6 × 1) = 0.2R. That is a small edge. If you risk $20 per trade, you expect about $4 per trade before costs, and results will swing a lot around that average. Fees can easily eat a 0.2R edge, so check costs honestly.</p>
<div class="mk-callout mk-callout-example" role="note"><strong>Example:</strong> You are long at $100 with a stop at $96 (risk $4) and a target at $112 (reward $12). That is 1:3. If your past trades of this type reach their targets about 30% of the time, expectancy is (0.3 × 3) − (0.7 × 1) = 0.2R. If you are not sure about the 30%, the number means nothing, so keep a journal and let the data tell you.</div>

<h2 id="depth-targets">Setting a target without wishful thinking</h2>
<p>Pick a target at a level where price has a reason to pause: a prior high, a round number, or an area where sellers appeared before. A target chosen only to make the ratio look pretty, such as "3x my risk because that sounds good", is a guess dressed as a plan. If the nearest sensible target gives you only 1:1, either accept a smaller size, wait for a better entry that improves the ratio, or pass on the trade.</p>
<p>Passing is a legitimate decision. Many good traders take only a few setups a week, because most of what they see does not offer a clear exit and a worthwhile reward at the same time.</p>
"""

DEPTH["course-trading-psychology"] = """
<h2 id="depth-emotion-patterns">The same four patterns, over and over</h2>
<p>Most emotional mistakes fall into a small number of patterns. Learning their names makes them easier to catch in the moment.</p>
<ul>
<li><strong>Fear of missing out (FOMO).</strong> Price is running and you jump in late, at a worse price, with a wider stop than you would normally accept.</li>
<li><strong>Revenge trading.</strong> After a loss you take a bigger, faster trade to "get it back". It is usually the least planned trade of the week.</li>
<li><strong>Moving the stop.</strong> The trade goes against you and you widen the stop "to give it room". A small, planned loss turns into a large, unplanned one.</li>
<li><strong>Cutting winners short.</strong> You close a good trade at the first sign of profit, then let losers run because closing them feels like admitting a mistake.</li>
</ul>

<h2 id="depth-why-brain-fights">Why your brain makes this hard</h2>
<p>Humans feel losses more strongly than equal gains, a pattern researchers call loss aversion. That is why closing a losing trade hurts, and why holding on in hope feels easier than accepting the loss. Another pattern is that a few recent wins can make you feel more skilful than the evidence supports, so you size up exactly when you should not. None of this means something is wrong with you. It means that rules written in advance, when you are calm, protect you from decisions made when you are not.</p>

<h2 id="depth-rules-that-help">Rules that work when emotions run high</h2>
<ol>
<li><strong>A daily loss limit.</strong> Decide a number, for example 2% of the account. If you reach it, you stop for the day, no exceptions.</li>
<li><strong>A cooling-off rule.</strong> After a losing trade, wait a set time, such as thirty minutes, before the next one.</li>
<li><strong>A pre-trade sentence.</strong> Before every entry, write: "I am buying because ___, I am wrong if ___, and I lose about $___ if so." If you cannot fill it in, you do not trade.</li>
<li><strong>A maximum number of trades per day.</strong> It limits overtrading and keeps costs down.</li>
</ol>
<div class="mk-callout mk-callout-try-it" role="note"><strong>Try it:</strong> In your next paper trading session, break one of your own rules on purpose, then write down how it felt and what happened. Knowing how the urge feels in a safe setting makes it easier to recognise later.</div>

<h2 id="depth-a-bad-day">What a bad day should look like</h2>
<p>A well-run bad day is boring. You hit your daily limit after two small losses, close the app, and review what happened in your journal. A badly run bad day starts the same way, and then three more trades follow, each larger than the last. The difference between the two is not skill, it is whether a rule was in place and followed.</p>
<p>Also look after the basics. Trading while tired, hungry, stressed about money, or after an argument tends to produce worse decisions. If you notice that your worst trades cluster at certain times, treat that as data and schedule around it.</p>
<p>If trading ever starts to feel compulsive, or you find yourself risking money you cannot afford to lose, step away and talk to someone you trust. No trade is worth that.</p>
"""

DEPTH["course-trend-support-resistance"] = """
<h2 id="depth-reading-trend-honestly">Reading trend without fooling yourself</h2>
<p>A simple, testable definition of an uptrend is a series of higher highs and higher lows. A downtrend is lower highs and lower lows. Anything else, with price bouncing between two levels, is a range. Using a clear rule matters because the eye is very good at seeing trends in random noise.</p>
<p>Check yourself with this exercise: pick a chart, hide the right side, and decide whether the last 30 candles form a trend or a range using the rule above. Then check what happened. You will often find that what looked like a strong trend was a range, and that is a valuable thing to learn before you risk money on it.</p>

<h2 id="depth-support-resistance-as-zones">Levels are zones, not lines</h2>
<p>Support and resistance are better thought of as areas where orders have been concentrated, not exact prices. If price turned around $100 twice, the reaction may have occurred anywhere between $99.50 and $100.60. Draw a band, not a hairline. Then plan your stop beyond the whole band, because price often pokes just through the line before reversing.</p>
<p>A level is stronger when it has been tested several times, when the reactions were sharp, and when it sits on a longer timeframe. A level on the 1-hour chart that lines up with one on the daily chart carries more weight than either alone. Round numbers, such as $100 or $60,000, also attract orders because people like to place them there. See the article on {{round-number-levels|round number levels}} for the detail.</p>

<h2 id="depth-flip-and-failure">When a level breaks</h2>
<p>When price closes clearly beyond a level and stays there, old resistance often becomes new support, and vice versa. This "role reversal" is common, but it is a tendency, not a law. A break that quickly falls back inside the range is called a failed breakout, and it can trap traders who bought the break. Many beginners enter on the first touch of a new high. A more careful approach is to wait for a close beyond the level and a retest that holds, accepting that you will sometimes miss part of a move.</p>

<h2 id="depth-trend-plan">Turning this into a plan</h2>
<ol>
<li>Identify the trend on a higher timeframe using the higher highs and lows rule.</li>
<li>Mark the two or three zones that mattered most recently.</li>
<li>Define your idea in the form "if price holds above this zone, I buy, and I am wrong below it".</li>
<li>Check the distance to the next zone to see whether the reward justifies the risk.</li>
<li>If the trend and the zones disagree, or the picture is unclear, do nothing.</li>
</ol>
<div class="mk-callout mk-callout-key-idea" role="note"><strong>Key idea:</strong> Trend, support and resistance do not predict the future. They give you places where the odds of a reaction are better and where an exit makes sense. The plan, not the line, is what protects you.</div>
"""

DEPTH["course-trading-plan-and-journal"] = """
<h2 id="depth-sample-plan">A complete sample plan to adapt</h2>
<p>A plan can fit on one page. Here is an example for a beginner who trades one coin on the 4-hour chart. Replace every number with your own.</p>
<ul>
<li><strong>Markets:</strong> BTC/USDT only, spot or low-leverage futures.</li>
<li><strong>Timeframe:</strong> daily chart for direction, 4-hour chart for entries.</li>
<li><strong>Setup:</strong> price pulls back to a previously tested zone inside an uptrend and a candle closes back above the zone.</li>
<li><strong>Risk per trade:</strong> 1% of the account.</li>
<li><strong>Stop:</strong> just below the zone.</li>
<li><strong>Target:</strong> the next zone, only if the reward is at least twice the risk.</li>
<li><strong>Limits:</strong> at most two trades a day, stop for the day after losing 2%.</li>
<li><strong>No-trade conditions:</strong> major news in the next hour, no clear trend, or I am tired or upset.</li>
</ul>
<p>The last line is the most overlooked. A plan that says when not to trade protects you from the trades that cost the most.</p>

<h2 id="depth-journal-columns">What to record in your journal</h2>
<p>A journal is only useful if you can learn from it later. For every trade, record:</p>
<ul>
<li>Date, market and direction.</li>
<li>Why you entered, in one sentence, before you click.</li>
<li>Entry, stop, target, size and the dollar amount at risk.</li>
<li>The result in R, meaning how many times your planned risk you won or lost.</li>
<li>Whether you followed the plan, yes or no.</li>
<li>One line on how you felt, such as calm, rushed or anxious.</li>
</ul>
<p>Measuring in R makes different trades comparable. A $50 win on a $10 risk is +5R, while a $50 loss on a $100 risk is −0.5R, so the dollar figures alone would mislead you.</p>

<h2 id="depth-weekly-review">A weekly review that takes twenty minutes</h2>
<ol>
<li>Count trades, wins, losses and the total in R.</li>
<li>Separate trades that followed the plan from those that did not. Compare their results.</li>
<li>Find the largest loss and ask whether it was a plan trade or a rule break.</li>
<li>Look for patterns: certain times of day, certain coins, certain moods.</li>
<li>Choose one thing to improve next week. Only one.</li>
</ol>
<div class="mk-callout mk-callout-key-idea" role="note"><strong>Key idea:</strong> Be careful with small samples. Ten trades cannot tell you whether a strategy works, because luck dominates short runs. Use the journal first to improve your discipline, and only later to judge the strategy, after you have many more trades.</div>
"""

DEPTH["course-first-30-days"] = """
<h2 id="depth-week-by-week">A week-by-week plan for your first month</h2>
<p><strong>Week 1: observe.</strong> Open the terminal each day for fifteen minutes. Watch how the order book behaves, how candles form, and how price reacts near round numbers. Do not trade yet. Write down three things you noticed each day.</p>
<p><strong>Week 2: practise the mechanics.</strong> Place small paper trades using one market and one setup. The goal is not profit. It is to get used to placing entries, stops and targets quickly and correctly, and to recording every trade in your journal.</p>
<p><strong>Week 3: practise the rules.</strong> Add your risk limits: a fixed risk per trade, a daily loss limit and a maximum number of trades. Count how often you break your own rules. That number is more telling than your profit.</p>
<p><strong>Week 4: review and decide.</strong> Run a full review of the month. Compute your average result in R, how often you followed the plan, and your costs. Decide honestly whether you are ready to try a very small real position, or whether you need another month.</p>

<h2 id="depth-readiness-checklist">A readiness checklist</h2>
<p>Move to real money only when you can say yes to most of these:</p>
<ul>
<li>I followed my plan on at least 80% of my paper trades.</li>
<li>I know my risk per trade in dollars before I enter.</li>
<li>I understand the liquidation price on any leveraged position I take.</li>
<li>I kept a journal for the whole month and reviewed it weekly.</li>
<li>I can explain what I would do if a trade went wrong, without improvising.</li>
<li>The amount I would use is money I could lose without changing my life.</li>
</ul>
<p>If you cannot tick enough boxes, nothing is lost. Another month of practice costs nothing, and you will be more prepared than most people who start.</p>

<h2 id="depth-first-real-trades">Your first real trades</h2>
<p>When you do move to real money, shrink everything. Use a much smaller risk than you used in paper trading, maybe a quarter of it, because real money feels different. The aim of the first month is not profit, it is to see how you behave when the loss is real, and whether your rules survive. Many people find that rules which were easy on paper become hard with real money. That is normal, and it is the reason for starting small.</p>
<p>Keep the journal going, and keep your daily loss limit. If you break your rules, go back to paper trading for a week, without shame. It is a sign that your process needs work, not that you have failed.</p>

<h2 id="depth-what-next">What to learn next</h2>
<ul>
<li>Read the guide on {{funding-rate-explained|funding rates}} and {{open-interest-explained|open interest}} if you plan to trade futures.</li>
<li>Study {{risk-reward-ratio-and-win-rate|risk-reward and win rate}} in more depth, then test your own numbers.</li>
<li>Try the {{crypto-backtester|backtester}} to see how a simple idea would have behaved on past data, remembering that the past does not predict the future.</li>
<li>Revisit the lessons on psychology every few weeks. They read differently after you have taken a few real losses.</li>
</ul>
"""