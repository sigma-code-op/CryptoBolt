# -*- coding: utf-8 -*-
"""Course content, part B: modules 3 and 4 (lessons 7-12)."""

LESSONS_B = [
{
"slug": "course-position-sizing",
"title": "How much to risk: position sizing",
"module": 3,
"minutes": 14,
"desc": "Lesson 7: position sizing for beginners. The 1% rule, why losses are hard to recover from, and a calculator that sizes each trade from your stop.",
"goal": "Work out the exact size of a trade from your account, your risk limit and your stop, instead of guessing.",
"icon": "scale",
"body": """
<p>New traders spend 95% of their effort on <em>when to buy</em> and almost none on <em>how much to buy</em>. Professionals do the opposite, because size is the one thing you fully control. You cannot control where price goes. You can control how much a wrong guess costs you.</p>

<h2 id="risk-vs-size">Risk is not the same as position size</h2>
<p>These are different numbers, and mixing them up is the root of most blown accounts.</p>
<ul>
<li><strong>Position size</strong> is how much you buy, for example $500 worth of a coin.</li>
<li><strong>Risk</strong> is how much you <em>lose if you are wrong</em>, meaning if price hits your stop.</li>
</ul>
<p>A $500 position with a stop 2% away risks $10. A $500 position with a stop 20% away risks $100. Same size, ten times the risk. This is why you must know your stop <em>before</em> you decide the size.</p>

<h2 id="the-one-percent-rule">The 1% rule</h2>
<p>A widely used guideline is to risk no more than <strong>1% of your account on any single trade</strong> (some use 0.5% to 2%). On a $1,000 account, that is $10 of risk per trade. It sounds tiny. That is the point.</p>
<div class="mk-callout mk-callout-definition" role="note"><strong>Position size formula</strong><br>Size (in coins) = (account × risk %) ÷ (entry price − stop price)<br>Position value = size × entry price</div>
<div class="mk-callout mk-callout-example" role="note"><strong>Example:</strong> Account $1,000, risk 1% = $10. You want to buy at $100 with a stop at $95. The risk per coin is $5. So size = $10 ÷ $5 = <strong>2 coins</strong>, a $200 position. If the stop is hit you lose about $10, which is 1% of the account. If you had wanted a tighter stop at $98, the risk per coin would be $2, and the size could be 5 coins ($500).</div>

<h2 id="size-calculator">Try it: size a trade</h2>
<!--WIDGET:size-->
<p>Our <a href="position-size-calculator">position size calculator</a> does the same with more options, and the longer article on the <a href="position-sizing-and-the-one-percent-rule">1% rule</a> goes deeper.</p>

<h2 id="why-small">Why risk such a small slice?</h2>
<p>Because losing streaks are normal, and losses are harder to recover from than they look. First, a streak: if you lose 10 trades in a row, which happens to everyone, risking 1% each leaves you down about 10%. Risking 10% each leaves you down about 65%.</p>
<div class="mk-table-wrap"><table class="mk-table">
<thead><tr><th scope="col">Risk per trade</th><th scope="col">Account after 10 losses in a row</th></tr></thead>
<tbody>
<tr><td>1%</td><td>about 90.4% left (down 9.6%)</td></tr>
<tr><td>2%</td><td>about 81.7% left</td></tr>
<tr><td>5%</td><td>about 59.9% left</td></tr>
<tr><td>10%</td><td>about 34.9% left (down 65%)</td></tr>
</tbody></table></div>
<p>Second, the maths of recovery works against you:</p>
<div class="mk-table-wrap"><table class="mk-table">
<thead><tr><th scope="col">Loss from peak</th><th scope="col">Gain needed to get back</th></tr></thead>
<tbody>
<tr><td>10%</td><td>11.1%</td></tr>
<tr><td>25%</td><td>33.3%</td></tr>
<tr><td>50%</td><td>100%</td></tr>
<tr><td>75%</td><td>300%</td></tr>
</tbody></table></div>
<p>A 50% loss needs a 100% gain to repair. Deep <a href="glossary#drawdown">drawdowns</a> are where accounts die. Small, fixed risk keeps you in the game long enough to improve. You can test how likely a rough patch is with our <a href="losing-streak-calculator">losing streak calculator</a>.</p>

<h2 id="sizing-rules">Rules to take away</h2>
<ol>
<li>Decide your stop first, based on the chart. Never choose it based on how much you want to risk.</li>
<li>Then calculate size from the stop distance. A wider stop means a smaller position.</li>
<li>Do not increase size after wins out of excitement or after losses to "win it back".</li>
<li>If the calculated size is too small to be worth it, skip the trade. That is a feature, not a bug.</li>
</ol>
""",
"takeaways": [
 "Risk is the amount you lose if you are wrong, not the size of the position. Set the stop first, then calculate size.",
 "Size = (account × risk %) ÷ (entry − stop). Many traders cap risk at about 1% per trade.",
 "Big losses are disproportionately hard to recover from: a 50% loss needs a 100% gain.",
],
"tryit": "In the calculator above, enter your paper-trading balance, a 1% risk, and a stop 3% below your entry. Write down the size. Then widen the stop to 6% and see what happens to the size.",
"quiz": [
 ("Account $2,000, risk 1%, entry $50, stop $48. What position size (in coins) does the formula give?", ["5 coins", "10 coins", "20 coins", "40 coins"], 1, "Risk = $20. Risk per coin = $50 − $48 = $2. Size = $20 ÷ $2 = 10 coins."),
 ("What happens to position size if you place your stop farther away, keeping the same risk %?", ["It increases", "It decreases", "It stays the same", "It becomes zero"], 1, "A wider stop means a bigger loss per coin, so to keep the same dollar risk you must buy fewer coins."),
 ("How much gain is needed to recover from a 50% loss?", ["25%", "50%", "75%", "100%"], 3, "If $1,000 becomes $500, you need to double $500 to get back to $1,000, which is a 100% gain."),
 ("Which is the better order of decisions?", ["Pick a size you like, then place a stop wherever it fits", "Choose the stop from the chart, then size the trade from that distance", "Choose the stop after you see the loss", "Always use the biggest size you can afford"], 1, "The stop comes from the chart and your plan. The size is then calculated so that hitting it costs only your chosen risk."),
],
},

{
"slug": "course-stop-loss-and-risk-reward",
"title": "Stops and risk-reward: plan the exit before the entry",
"module": 3,
"minutes": 14,
"desc": "Lesson 8: how to place a stop-loss, what risk-reward and R-multiples mean, and why a win rate below 50% can still work. Includes a calculator.",
"goal": "Plan every trade with an entry, a stop and a target, and calculate whether the trade is worth taking before you place it.",
"icon": "target",
"body": """
<p>A professional never enters a trade without three numbers already written down: where they get in, where they admit they are wrong, and where they will take profit. Beginners often have only the first.</p>

<h2 id="the-stop">The stop: where your idea is proven wrong</h2>
<p>A <a href="glossary#stop-loss">stop-loss</a> is the price at which you close a losing trade. Good stops are not random distances like "5%". They go at a level where, if price reaches it, your reason for the trade no longer holds.</p>
<ul>
<li><strong>Long trade:</strong> place the stop just below a recent low or a <a href="glossary#support-and-resistance">support</a> level. If price breaks that, the buyers you were counting on have lost.</li>
<li><strong>Short trade:</strong> place it just above a recent high or <a href="glossary#support-and-resistance">resistance</a>.</li>
</ul>
<p>Give a little breathing room. Price often pokes past an obvious level before turning, which is called a stop hunt or just noise. A stop exactly on a round number is easy to hit; a bit beyond is usually wiser. Our article on <a href="round-number-levels">round-number levels</a> explains why.</p>
<div class="mk-callout mk-callout-key-idea" role="note"><strong>The golden rule of stops:</strong> You may move a stop <em>in the direction of safety</em> (to lock in profit). You must never move it further away to avoid taking a loss. That is how small losses become big ones.</div>

<h2 id="the-target">The target and risk-reward</h2>
<p>The target is where you plan to take profit. Compare it to your stop to get the <a href="glossary#risk-reward">risk-reward ratio</a>:</p>
<div class="mk-callout mk-callout-definition" role="note"><strong>Risk-reward (R:R)</strong> = potential profit ÷ potential loss.<br>Entry $100, stop $95 (risk $5), target $115 (reward $15) → R:R = 15 ÷ 5 = <strong>3</strong>, written 1:3.</div>
<p>Traders call the risk amount <strong>1R</strong>. A trade that makes three times the risk is a <strong>+3R</strong> win, and a stopped-out trade is <strong>−1R</strong>. Counting results in R, not in dollars, lets you compare trades of any size. See <a href="glossary#r-multiple">R-multiple</a>.</p>

<h2 id="win-rate-and-rr">Why you do not need to win most trades</h2>
<p>Here is the idea that surprises beginners: with a good reward-to-risk, you can lose more often than you win and still come out ahead. The break-even <a href="glossary#win-rate">win rate</a> is:</p>
<div class="mk-callout mk-callout-definition" role="note"><strong>Break-even win rate</strong> = 1 ÷ (1 + R:R)</div>
<div class="mk-table-wrap"><table class="mk-table">
<thead><tr><th scope="col">Risk-reward</th><th scope="col">Win rate needed just to break even</th></tr></thead>
<tbody>
<tr><td>1:1</td><td>50%</td></tr>
<tr><td>1:2</td><td>33.3%</td></tr>
<tr><td>1:3</td><td>25%</td></tr>
<tr><td>1:0.5 (risking $2 to make $1)</td><td>66.7%</td></tr>
</tbody></table></div>
<p>The last row is a warning: if you risk more than you stand to gain, you must be right most of the time just to break even. Many beginners do exactly this by taking quick small profits and giving big losses room to run.</p>
<p><strong>Expectancy</strong> turns this into one number: the average result per trade, in R.</p>
<div class="mk-callout mk-callout-example" role="note"><strong>Example:</strong> You win 40% of trades with a 1:2 ratio. Expectancy = 0.40 × 2 − 0.60 × 1 = 0.8 − 0.6 = <strong>+0.2R per trade</strong>. Over 100 trades at 1% risk, that averages about +20R, roughly +20% before costs. With a win rate of 30% and the same ratio it would be 0.3 × 2 − 0.7 = −0.1R, a slow loss. See <a href="glossary#expectancy">expectancy</a> and our guide to <a href="risk-reward-ratio-and-win-rate">risk-reward and win rate</a>.</div>
<p>These figures are examples to show the maths. They are not forecasts, and real results will vary because costs and slippage reduce them.</p>

<h2 id="rr-calculator">Try it: plan a trade</h2>
<!--WIDGET:rr-->
<p>More detail is available in the <a href="risk-reward-calculator">risk-reward calculator</a>.</p>

<h2 id="pre-trade-checklist">The three-number checklist</h2>
<ol>
<li>Entry: at what price do I get in?</li>
<li>Stop: at what price am I wrong?</li>
<li>Target: where do I take profit, and is the reward at least about twice the risk?</li>
</ol>
<p>If you cannot fill in all three, you are not ready to place the trade. Skip it. There will be another one tomorrow.</p>
""",
"takeaways": [
 "Put the stop where your trade idea is proven wrong, and never move it farther away to dodge a loss.",
 "Risk-reward = reward ÷ risk. Break-even win rate = 1 ÷ (1 + R:R), so a 1:2 plan only needs to win about 34% of the time to break even.",
 "Every trade needs an entry, a stop and a target written down before you click.",
],
"tryit": "Choose any pair in the <a href=\"app\">terminal</a>. On the 4h chart, pick a long entry, put a stop under the last low and a target at the next high. Calculate the R:R above. If it is under 1:2, would you still take it?",
"quiz": [
 ("Entry $200, stop $190, target $230. What is the risk-reward ratio?", ["1:1", "1:2", "1:3", "3:1 against you"], 2, "Risk = $10. Reward = $30. Reward ÷ risk = 3, so 1:3."),
 ("With a 1:3 risk-reward, roughly what win rate do you need to break even (before costs)?", ["75%", "50%", "33%", "25%"], 3, "Break-even win rate = 1 ÷ (1 + 3) = 25%."),
 ("Price is falling toward your stop. What should you do?", ["Move the stop farther away to give it room", "Remove the stop entirely", "Leave the stop where you planned and accept the loss if it is hit", "Double your position"], 2, "Moving a stop away from price turns a planned small loss into an unplanned large one. Keep the plan."),
 ("You win 50% of trades but each win is 0.5R and each loss is 1R. What is your expectancy per trade?", ["+0.25R", "0R", "−0.25R", "+1R"], 2, "0.5 × 0.5 − 0.5 × 1 = 0.25 − 0.5 = −0.25R. Winning half the time is not enough when your wins are small."),
],
},

{
"slug": "course-trading-psychology",
"title": "Your biggest opponent: emotions and common mistakes",
"module": 3,
"minutes": 12,
"desc": "Lesson 9: trading psychology for beginners. FOMO, revenge trading, overtrading and scams explained, with simple rules that protect you.",
"goal": "Recognise the five emotional mistakes that sink most beginners and set rules that stop them before they happen.",
"icon": "brain",
"body": """
<p>You now know enough mechanics to place a sensible trade. Here is the uncomfortable truth: most beginner losses do not come from not knowing the rules. They come from knowing the rules and breaking them while stressed, excited or angry. Your psychology is half the game.</p>

<h2 id="the-five-traps">The five traps</h2>
<div class="mk-table-wrap"><table class="mk-table">
<thead><tr><th scope="col">Trap</th><th scope="col">What it sounds like in your head</th><th scope="col">The fix</th></tr></thead>
<tbody>
<tr><th scope="row"><a href="glossary#fomo">FOMO</a> (fear of missing out)</th><td>"It's already up 30%, I have to get in before it goes higher!"</td><td>Only enter at a planned price. If you missed it, you missed it. Another setup will come.</td></tr>
<tr><th scope="row">Revenge trading</th><td>"I'll make it back right now, with a bigger size."</td><td>After a loss, step away. Set a daily loss limit and stop when you hit it.</td></tr>
<tr><th scope="row">Overtrading</th><td>"I need to be in a trade, otherwise I'm wasting the day."</td><td>Not trading is a position. Define the exact setups you take, and wait.</td></tr>
<tr><th scope="row">Hope</th><td>"It will come back. I'll just remove my stop."</td><td>Stops are set before entry and are not negotiable.</td></tr>
<tr><th scope="row">Overconfidence</th><td>"I'm on a hot streak, let's go bigger."</td><td>Keep the same risk % always. Streaks, good and bad, are normal and random.</td></tr>
</tbody></table></div>

<h2 id="why-brains-fail">Why your brain does this</h2>
<p>Humans feel losses roughly twice as strongly as equal gains, so we hold losers too long and cut winners too early. We also seek evidence that agrees with what we already believe, which is called confirmation bias. Add a screen where numbers flash red and green, and the part of you that plans calmly gets drowned out. Everyone feels this, including professionals. The difference is that they build rules that act <em>for</em> them when emotions peak.</p>

<h2 id="rules-that-protect-you">Rules that protect you from yourself</h2>
<ol>
<li><strong>Write a daily loss limit</strong> (for example, stop after two losing trades or after losing 2% of the account), and obey it.</li>
<li><strong>No trading when tired, angry, drunk or in a rush.</strong> Your decisions are measurably worse.</li>
<li><strong>Same risk % every trade.</strong> Not more after wins, not more after losses.</li>
<li><strong>Take a screenshot before entering</strong> and write one line on why. You will be surprised later at how often the reason was "the price was moving".</li>
<li><strong>Avoid watching the screen all day.</strong> Set alerts, then leave. The more you stare, the more you trade.</li>
<li><strong>Ignore hype.</strong> If a coin is trending everywhere, the easy move has usually already happened.</li>
</ol>
<div class="mk-callout mk-callout-key-idea" role="note"><strong>Key idea:</strong> Make decisions when you are calm, in your plan, and execute them when you are not. The plan is the adult in the room.</div>

<h2 id="scams">Scams that target beginners</h2>
<p>Losing money to a scam is a different problem from losing it to the market, and it is just as common. Stay alert:</p>
<ul>
<li><strong>Guaranteed returns or "risk-free" signals.</strong> Nothing in trading is guaranteed.</li>
<li><strong><a href="glossary#pump-and-dump">Pump-and-dump</a> groups</strong> that hype a small coin so the organisers can sell to you.</li>
<li><strong><a href="glossary#rug-pull">Rug pulls</a>,</strong> where a new token's creators vanish with the money.</li>
<li><strong>Fake support, "recovery" services and romance or mentor scams</strong> that ask for your seed phrase, remote access or a transfer.</li>
<li><strong>Copy-trade and "AI bot" schemes</strong> that need you to deposit with a stranger.</li>
</ul>
<p>Never share your password, 2-factor codes or recovery phrase with anyone. No genuine support agent will ask. Turn on two-factor authentication, and only use well-known, regulated exchanges. Read our piece on <a href="1000-dollar-day-trap">why get-rich headlines work</a> for the psychology behind these pitches.</p>
""",
"takeaways": [
 "Most beginner losses come from emotional rule-breaking: FOMO, revenge trading, overtrading, hope and overconfidence.",
 "Use written rules (a daily loss limit, fixed risk %, no trading when upset) that work when your emotions do not.",
 "Treat guaranteed returns, secret signals and anyone asking for your recovery phrase as scams.",
],
"tryit": "Write your own daily loss limit and one sentence for each of the five traps saying how you will stop yourself. Keep it somewhere you will see it before trading.",
"quiz": [
 ("A coin you were not watching is up 40% today and everyone is talking about it. What is the most disciplined response?", ["Buy a big position right away", "Stay with your plan and wait for a setup that meets your rules", "Borrow money to buy more", "Use 50x leverage to catch up"], 1, "Chasing a move you missed is FOMO. The disciplined approach is to wait for a planned setup."),
 ("You just lost a trade and feel angry. What should you do?", ["Open a larger trade to win it back", "Stop trading for a while and review what happened", "Move your next stop farther away", "Switch to a smaller timeframe"], 1, "Revenge trading turns a small loss into a big one. A cooling-off break and a daily loss limit protect you."),
 ("Which is a common sign of a scam?", ["A promise of guaranteed or risk-free returns", "An exchange with a public fee table", "A tutorial that explains risk", "Two-factor authentication"], 0, "Guaranteed returns do not exist in trading. This is the most common hook in trading scams."),
 ("Who should you ever give your wallet recovery phrase or 2FA code to?", ["Customer support when they ask", "A mentor helping you", "A recovery service", "Nobody, ever"], 3, "Anyone who has these can take your money. Genuine support teams never ask for them."),
],
},

{
"slug": "course-trend-support-resistance",
"title": "Simple analysis: trend, support and resistance",
"module": 4,
"minutes": 14,
"desc": "Lesson 10: simple chart analysis for beginners. Spot a trend, mark support and resistance zones, use volume and a moving average, and know the limits.",
"goal": "Identify the direction of the trend, mark the key price zones, and use them to plan an entry, a stop and a target.",
"icon": "trending-up",
"body": """
<p>Technical analysis means studying past prices to make better decisions. Done sensibly, it does not predict the future. It helps you find places where a trade has a clear stop and a good reward-to-risk. You only need three simple tools to start.</p>

<h2 id="trend">Tool 1: the trend</h2>
<p>A <a href="glossary#trend">trend</a> is the general direction price is moving.</p>
<ul>
<li><strong>Uptrend:</strong> a series of <em>higher highs and higher lows</em>. Each rally goes further than the last, and each dip stops higher.</li>
<li><strong>Downtrend:</strong> <em>lower highs and lower lows</em>.</li>
<li><strong>Range (sideways):</strong> price bounces between a ceiling and a floor without making progress.</li>
</ul>
<p>The saying "the trend is your friend" is popular because trades in the direction of the larger trend tend to be easier. As a beginner, check the <strong>daily chart first</strong>. Is it going up, down or sideways? Then look at the 1-hour chart for your entry. Avoid fighting a strong trend because a coin "looks too high" or "looks too low".</p>

<h2 id="support-and-resistance">Tool 2: support and resistance zones</h2>
<p><a href="glossary#support-and-resistance">Support</a> is a price area where falling prices have often stopped and bounced, because buyers stepped in. <strong>Resistance</strong> is an area where rising prices have often stalled, because sellers appeared. Find them by looking left on the chart for places where price turned several times.</p>
<ul>
<li>They are <strong>zones</strong>, not exact lines. Draw a band, not a hairline.</li>
<li>The more times a zone has held, the more people watch it, but also the likelier it will eventually break.</li>
<li>When support breaks, it often becomes resistance, and the reverse.</li>
<li><a href="glossary#round-number-level">Round numbers</a> like $50,000 often act as zones. See <a href="round-number-levels">why</a>.</li>
</ul>
<div class="mk-callout mk-callout-example" role="note"><strong>Example:</strong> A coin has bounced off $90 three times and stalled at $110 twice. A beginner plan: buy near $91 with a stop just below $88, and a target near $108. Risk is about $3, reward about $17, so R:R is better than 1:5. The setup has a natural stop (support breaking) and a natural target (resistance). If $88 breaks, the idea is wrong, so you exit small.</div>

<h2 id="moving-average">Tool 3: a moving average</h2>
<p>A <a href="glossary#moving-average">moving average</a> (MA) is the average closing price over the last N candles, redrawn on every new candle. It smooths out noise so the direction is easier to see. A common beginner choice is the 50-period MA: price above a rising 50-MA is a healthy uptrend; price below a falling one is a downtrend. It lags, meaning it shows what has already happened.</p>

<h2 id="volume-context">Adding volume as context</h2>
<p>A move through a zone on strong <a href="glossary#volume">volume</a> is more meaningful than one on weak volume. A bounce off support on rising volume suggests real buyers. Treat volume as a clue, not a rule.</p>

<h2 id="limits">The honest limits of analysis</h2>
<ul>
<li>Every tool here describes the past. None predicts the future.</li>
<li>Smart people look at the same chart and disagree. If someone says a pattern "always works", they are guessing or selling something.</li>
<li>More indicators do not equal better decisions. Three clean tools beat fifteen cluttered ones.</li>
<li>News, big sellers and sudden events can ignore every line you draw. That is exactly why you use a stop and size by risk.</li>
</ul>
<p>Read <a href="why-we-dont-predict-crypto-prices">why we do not predict prices</a> for the longer version.</p>

<h2 id="pre-entry-questions">Four questions before any entry</h2>
<ol>
<li>What is the trend on the daily chart?</li>
<li>Where are the nearest support and resistance zones?</li>
<li>Where is my stop (the price that proves me wrong), and how big does that make my position?</li>
<li>Is the reward at least about twice the risk?</li>
</ol>
""",
"takeaways": [
 "An uptrend is higher highs and higher lows; a downtrend is lower highs and lower lows; otherwise price is ranging.",
 "Support and resistance are zones where price has turned before. They give natural places for stops and targets.",
 "Indicators describe the past. Use a few simple tools, and rely on stops and sizing for the times they are wrong.",
],
"tryit": "Pick a pair on the daily chart in the <a href=\"app\">terminal</a>. Identify the trend, then draw two support and two resistance zones. Write down one possible long and one possible short, each with entry, stop and target.",
"quiz": [
 ("Which describes an uptrend?", ["Higher highs and higher lows", "Lower highs and lower lows", "Price staying exactly the same", "A single large green candle"], 0, "An uptrend means each rally and each dip are higher than the last."),
 ("Why are support and resistance drawn as zones instead of exact lines?", ["Because charts are inaccurate", "Because price often turns in an area, not at an exact tick", "Because exchanges prefer it", "It makes no difference"], 1, "Buyers and sellers act around levels, not at a single price, so a band is more realistic."),
 ("What does a moving average mainly do?", ["Predicts tomorrow's price", "Smooths past prices to show the direction", "Guarantees support", "Measures fees"], 1, "A moving average averages recent closes to reduce noise. It lags and does not predict."),
 ("Price breaks clearly below a support zone you were relying on for a long trade. The idea is:", ["Still fine, add more", "Proven wrong, so exit as planned", "A reason to use higher leverage", "Irrelevant"], 1, "The support was the reason for the trade. When it fails, your plan says you are wrong, and you take the small planned loss."),
],
},

{
"slug": "course-trading-plan-and-journal",
"title": "Your trading plan and journal",
"module": 4,
"minutes": 15,
"desc": "Lesson 11: build a simple written trading plan and keep a trading journal. Includes a plan builder you can copy and a journal template.",
"goal": "Write a one-page trading plan you can follow, and start a journal that turns every trade into a lesson.",
"icon": "notebook-pen",
"body": """
<p>Almost every consistent trader, regardless of style, has two habits that beginners skip: a written plan and a journal. They are boring, which is exactly why they work. A plan stops you improvising in the heat of the moment. A journal shows you what you actually do, as opposed to what you think you do.</p>

<h2 id="the-plan">The trading plan</h2>
<p>A plan is a short document that answers: <em>when will I trade, how, and when will I stop?</em> It should fit on one page. If it is longer, you will not follow it.</p>
<div class="mk-table-wrap"><table class="mk-table">
<thead><tr><th scope="col">Section</th><th scope="col">Question it answers</th></tr></thead>
<tbody>
<tr><th scope="row">Markets</th><td>Which 1 to 3 pairs will I trade? (Fewer is better.)</td></tr>
<tr><th scope="row">Timeframes</th><td>Which chart gives the trend, and which gives my entry?</td></tr>
<tr><th scope="row">Setup</th><td>What exact conditions must be true before I enter?</td></tr>
<tr><th scope="row">Entry and order type</th><td>How do I get in (for example, limit order at support)?</td></tr>
<tr><th scope="row">Stop</th><td>Where is my idea proven wrong?</td></tr>
<tr><th scope="row">Target</th><td>Where do I take profit? Minimum reward-to-risk?</td></tr>
<tr><th scope="row">Risk</th><td>What % of the account per trade? Maximum loss per day and per week?</td></tr>
<tr><th scope="row">No-trade rules</th><td>When do I stay out (tired, after the daily limit, big news, no clear setup)?</td></tr>
</tbody></table></div>

<h2 id="plan-builder">Build yours</h2>
<p>Fill in the boxes below. Your answers are saved in this browser only (nothing is sent anywhere), so you can come back and edit them. When you are happy, copy it and paste it into a note you will keep.</p>
<!--WIDGET:plan-->

<h2 id="the-journal">The trading journal</h2>
<p>A journal is a record of each trade. After 30 trades it becomes a mirror. You will see patterns you cannot see in the moment: perhaps you lose money on Fridays, or every time you trade without a stop, or after two wins in a row.</p>
<p>Record these for every trade, ideally right after you close it:</p>
<ul>
<li><strong>Date and pair</strong>, and long or short.</li>
<li><strong>Entry, stop, target and size</strong>, planned and actual.</li>
<li><strong>Result in R</strong> (for example +2R or −1R) and in money.</li>
<li><strong>Why you took it</strong>, in one sentence, and a screenshot of the chart.</li>
<li><strong>How you felt</strong> (calm, rushed, bored, excited) on a 1 to 5 scale.</li>
<li><strong>Did you follow your plan?</strong> Yes or no. Be honest.</li>
</ul>
<div class="mk-table-wrap"><table class="mk-table">
<thead><tr><th scope="col">Date</th><th scope="col">Pair</th><th scope="col">Setup</th><th scope="col">Result</th><th scope="col">Followed plan?</th><th scope="col">Note</th></tr></thead>
<tbody>
<tr><td>Mon</td><td>BTC/USDT long</td><td>Bounce at daily support</td><td>+2.1R</td><td>Yes</td><td>Waited for the limit order. Felt calm.</td></tr>
<tr><td>Tue</td><td>SOL/USDT long</td><td>Chased a green candle</td><td>−1R</td><td>No</td><td>FOMO. Entered without a stop level.</td></tr>
<tr><td>Thu</td><td>ETH/USDT short</td><td>Rejection at resistance</td><td>−1R</td><td>Yes</td><td>Stopped out by the plan. Fine.</td></tr>
</tbody></table></div>
<p>The example above is made up, to show the format. Notice that the middle row is the one to learn from, and also that a loss that follows the plan (the last row) is a good trade. Judge yourself on <strong>process</strong>, not on any single result.</p>

<h2 id="weekly-review">The weekly review</h2>
<p>Once a week, spend 20 minutes with your journal and answer:</p>
<ol>
<li>How many trades did I take, and what was my total in R?</li>
<li>How many broke my plan? What did those cost me?</li>
<li>What is one thing I will do differently next week?</li>
</ol>
<p>Change one thing at a time. Over a month, this review loop will teach you more than any course, including this one.</p>
""",
"takeaways": [
 "A one-page written plan sets your markets, setup, entry, stop, target, risk and no-trade rules in advance.",
 "A journal records every trade with the reason, result in R, your mood and whether you followed the plan.",
 "Judge trades by process: a planned loss is a good trade, and an impulsive win is a bad one.",
],
"tryit": "Complete the plan builder above, copy it, and paste it somewhere you keep notes. Then create a blank journal (a spreadsheet or notebook) with the columns from this lesson.",
"quiz": [
 ("What is the main purpose of a written trading plan?", ["To predict prices", "To decide your rules in advance so emotions do not choose for you", "To impress other traders", "To avoid paying fees"], 1, "A plan lets you act on decisions you made while calm, rather than improvising when stressed."),
 ("In a journal, a trade that hit your stop exactly as planned should be marked as:", ["A mistake", "A good trade, because you followed the plan", "A reason to double the size", "Meaningless"], 1, "Process matters more than a single outcome. A planned loss is part of normal trading."),
 ("How often should you do a review of your journal?", ["Never", "Only after a big win", "Weekly", "Every few years"], 2, "A short weekly review is frequent enough to spot patterns and fix habits."),
 ("Which journal field helps find emotional patterns?", ["Your mood or feeling on each trade", "Your exchange's logo", "Today's weather", "Your username"], 0, "Rating how you felt shows connections between emotions (rushed, bored, angry) and bad decisions."),
],
},

{
"slug": "course-first-30-days",
"title": "Your first 30 days: a safe practice plan",
"module": 4,
"minutes": 12,
"desc": "Lesson 12: a day-by-day 30-day beginner trading practice plan using paper trading, with a graduation checklist and safe rules for moving to real money.",
"goal": "Follow a structured month of paper trading, judge your results honestly, and know exactly when and how to approach real money.",
"icon": "flag",
"body": """
<p>You have the ideas. Now you need reps. This final lesson turns everything into a 30-day plan you can follow with virtual money, and a clear test for when (and whether) to go further.</p>

<h2 id="the-plan">The 30-day plan</h2>
<div class="mk-table-wrap"><table class="mk-table">
<thead><tr><th scope="col">When</th><th scope="col">Focus</th><th scope="col">What to do</th></tr></thead>
<tbody>
<tr><th scope="row">Days 1 to 7</th><td>Watch and learn the tools</td><td>No trades yet. Open the <a href="app">terminal</a> daily, read the daily and 1-hour charts of 2 pairs, mark trend and support/resistance zones, and note what happened the next day. Reread lessons 3, 4 and 10 as needed.</td></tr>
<tr><th scope="row">Days 8 to 14</th><td>Mechanics, tiny risk</td><td>Start <a href="trade">paper trading</a>. Spot only, no leverage. Risk 1% per trade, use limit orders for entries, set a stop every time. Aim for quality, not quantity.</td></tr>
<tr><th scope="row">Days 15 to 21</th><td>Follow the plan, journal everything</td><td>Use your written plan from lesson 11. Journal each trade with a screenshot. Respect your daily loss limit.</td></tr>
<tr><th scope="row">Days 22 to 30</th><td>Review and honesty</td><td>Calculate your results in R. Count how many trades broke the plan. Do the weekly review twice. Decide what to keep, drop and change.</td></tr>
</tbody></table></div>
<p>Keep a minimum target of <strong>around 30 trades</strong> under the same rules before judging anything. A handful of trades says almost nothing, because luck dominates small samples. Then, if you want more evidence, keep going another month.</p>

<h2 id="what-good-looks-like">What "good" looks like after 30 days</h2>
<p>Note what is <em>not</em> on this list: a big profit. A great first month is boring.</p>
<ul>
<li>You followed your risk rule on virtually every trade.</li>
<li>You always had a stop, and you never moved it farther away.</li>
<li>Your largest loss was close to your planned 1R, never a surprise.</li>
<li>You stayed within your daily loss limit.</li>
<li>Your journal is complete and honest.</li>
<li>You can explain why you took each trade.</li>
</ul>
<p>If your paper account is up, check whether it was skill or luck: did your wins come from planned setups, and would the results hold on another 30 trades? If it is down, that is information, not failure. Review the journal to see which rule you broke.</p>

<h2 id="graduation-checklist">Graduation checklist</h2>
<p>Tick these honestly. Your ticks are saved in this browser.</p>
<!--WIDGET:checklist-->

<h2 id="real-money">If you decide to trade real money</h2>
<p>There is no rule that says you ever must. If you decide to, take these precautions:</p>
<ol>
<li><strong>Only use money you can afford to lose entirely.</strong> Think of it as the price of learning, not as an investment you need back.</li>
<li><strong>Start small</strong>, small enough that a total loss would not affect your life. Keep the same 1% rule.</li>
<li><strong>Stay on spot with no leverage</strong> for a long time.</li>
<li><strong>Use a reputable, regulated exchange</strong> and turn on two-factor authentication. Never share recovery phrases.</li>
<li><strong>Expect it to feel different.</strong> Real money is more emotional. Cut your size even smaller at first.</li>
<li><strong>Learn the tax rules</strong> that apply where you live.</li>
<li><strong>Keep journaling.</strong> The journal never stops being useful.</li>
</ol>
<p>If you prefer not to trade actively at all, that is a valid choice. Our guide to <a href="dollar-cost-averaging-crypto">dollar-cost averaging</a> covers a lower-effort approach to owning crypto over time, with its own risks.</p>

<h2 id="where-next">Where to go next</h2>
<ul>
<li>Practise every day in <a href="trade">paper trading</a>.</li>
<li>Use the <a href="crypto-calculators">free calculators</a> before each trade: position size, risk-reward, liquidation price.</li>
<li>Look up any unfamiliar term in the <a href="glossary">glossary</a>.</li>
<li>Go deeper with the 160-page <a href="ebook">Crypto Clarity ebook</a>.</li>
</ul>
<div class="mk-callout mk-callout-key-idea" role="note"><strong>The one-sentence summary of this whole course:</strong> Protect your money first, plan every trade before you take it, keep a record, and let practice (not hope) build your skill.</div>
<p class="cc-note">Congratulations on finishing the course. Remember, this is education, not financial advice, and trading carries a high risk of loss.</p>
""",
"takeaways": [
 "Spend 30 days: one week observing, then paper trade with 1% risk, then journal and review, aiming for around 30 trades under the same rules.",
 "A good first month is judged by discipline (rules followed, stops kept, journal complete), not by profit.",
 "If you ever use real money: only what you can lose, tiny size, spot first, a reputable exchange with 2FA.",
],
"tryit": "Start day 1 now: open the <a href=\"app\">terminal</a>, pick two pairs, and write your trend and zones on the daily chart. Put a reminder in your calendar for the day-8 paper trading start.",
"quiz": [
 ("What should you do in the first week of the plan?", ["Open a leveraged position for fast results", "Watch charts and practise marking trend and zones, without trading", "Deposit as much as possible", "Copy random signals"], 1, "The first week is for learning the tools and your market's behaviour with no pressure and no risk."),
 ("About how many trades under the same rules give a more meaningful sample than just a handful?", ["1 to 3", "About 30", "Exactly 2", "None; one trade is enough"], 1, "Small samples are dominated by luck. Around 30 trades gives a better, though still limited, picture."),
 ("Which is the best sign of a successful first month?", ["The biggest paper profit", "Following your rules on every trade, with a complete journal", "Trading every hour", "Never taking a loss"], 1, "At this stage, discipline and process matter far more than a profit figure."),
 ("If you decide to trade with real money, which approach fits this course?", ["Use all your savings to make it worthwhile", "Start with an amount you can afford to lose fully, on spot, with the 1% rule", "Use 20x leverage to make up for a small account", "Skip the stop-loss to avoid being stopped out"], 1, "Tiny size, spot trading and strict risk rules keep a mistake survivable."),
],
},
]