# -*- coding: utf-8 -*-
"""Course content, part A: modules 1 and 2 (lessons 1-6).
Shorthand used in bodies:  [[glossary-id|text]] -> glossary link,  {{page-slug|text}} -> site link.
Widgets/figures: <!--WIDGET:name--> and <!--FIG:name--> are replaced by scripts/build-course.py.
"""

LESSONS_A = [
{
"slug": "course-what-is-trading",
"title": "What trading is (and what it is not)",
"module": 1,
"minutes": 10,
"desc": "Lesson 1 of the free beginner trading course: what trading actually is, how it differs from investing, why most beginners lose, and what you will learn.",
"goal": "Explain what trading is in one sentence, tell it apart from investing, and know honestly what to expect as a beginner.",
"icon": "compass",
"body": """
<p>Trading means buying or selling something, such as a coin, a share or a currency, with the plan of selling or buying it back later at a better price. That is the whole idea. Everything else in this course is about doing it without wrecking your account in the process.</p>
<div class="mk-callout mk-callout-definition" role="note"><strong>Definition:</strong> A <em>trade</em> has two sides: an entry (you open the position) and an exit (you close it). The difference between the two prices, minus costs, is your result.</div>

<h2 id="trading-vs-investing">Trading versus investing</h2>
<p>People mix these up, and it causes real damage. They are different activities with different rules.</p>
<div class="mk-table-wrap"><table class="mk-table">
<thead><tr><th scope="col"></th><th scope="col">Investing</th><th scope="col">Trading</th></tr></thead>
<tbody>
<tr><th scope="row">Time horizon</th><td>Years</td><td>Minutes to weeks</td></tr>
<tr><th scope="row">Main idea</th><td>Own something that may grow in value, and wait</td><td>Profit from price moves, in either direction</td></tr>
<tr><th scope="row">How often you act</th><td>Rarely</td><td>Often</td></tr>
<tr><th scope="row">Biggest enemy</th><td>Panic selling and bad picks</td><td>Costs, leverage and emotions</td></tr>
<tr><th scope="row">Skill needed</th><td>Patience, diversification</td><td>Risk control, discipline, a repeatable process</td></tr>
</tbody></table></div>
<p>Neither is "better". But trading is harder than it looks, because on every trade you are competing against other people, some of whom are full-time professionals and automated programs.</p>

<h2 id="honest-expectations">The honest picture</h2>
<p>You will see ads showing someone turning a small account into a large one in a week. Those are marketing, not typical outcomes. Research on large sets of retail day-trading accounts keeps reaching the same conclusion: most people lose money once costs are counted, and only a small minority earn consistent profits. Our own articles on <a href="day-trading-crypto-realistic-returns">realistic day-trading returns</a> and the <a href="1000-dollar-day-trap">"$1,000 in a day" headline trap</a> go through why.</p>
<div class="mk-callout mk-callout-key-idea" role="note"><strong>Key idea:</strong> For a beginner, the first goal is not to make money. It is to <em>not lose much</em> while you learn. Survive first, then get good, then think about profit.</div>
<p>That is not meant to scare you off. It is meant to set the right target. If you protect your account while you learn, you give yourself years to improve. If you lose it all in the first month, you get no second chance.</p>

<h2 id="what-you-will-learn">What you will be able to do by the end</h2>
<ul>
<li>Read a price chart and understand what each candle says.</li>
<li>Place the right type of order and know what it costs.</li>
<li>Understand <a href="glossary#leverage">leverage</a> and why it is the number one account-killer.</li>
<li>Decide how much to risk on each trade, and where to get out before you get in.</li>
<li>Spot the emotional traps that beat most beginners.</li>
<li>Write a simple trading plan and practise it with fake money for 30 days.</li>
</ul>
<h2 id="the-ground-rules">Three ground rules for the whole course</h2>
<ol>
<li><strong>Only ever risk money you can afford to lose completely.</strong> Not rent money, not borrowed money, not savings you need.</li>
<li><strong>Practise with <a href="glossary#paper-trading">paper trading</a> first.</strong> It uses virtual money and real prices, so mistakes cost nothing.</li>
<li><strong>Nobody can predict prices.</strong> Not us, not an influencer, not an AI. You will learn to manage risk instead of guessing the future. See <a href="why-we-dont-predict-crypto-prices">why we do not predict prices</a>.</li>
</ol>
<p class="cc-note">This course is education, not financial advice. Trading carries a high risk of loss.</p>
""",
"takeaways": [
 "Trading is opening and closing positions to profit from price moves; investing is owning for the long term.",
 "Most retail traders lose money after costs. Your first goal is to protect your account while you learn.",
 "Use paper trading first, risk only money you can afford to lose, and never trust anyone who promises returns.",
],
"tryit": "Open the <a href=\"trade\">paper trading page</a> and just look around for five minutes. You do not need to place a trade yet. Find where your virtual balance is shown, and notice which pairs you can choose.",
"quiz": [
 ("Which statement best describes trading?", ["Owning an asset for many years and ignoring the price", "Opening and closing positions to profit from price moves over a shorter time", "A guaranteed way to grow a small account quickly", "Lending your money to an exchange"], 1, "Trading is about entering and exiting positions to profit from price changes. There are no guarantees, and the time frame is usually shorter than investing."),
 ("What should a beginner's first goal be?", ["Doubling the account in a month", "Copying the biggest influencer", "Not losing much while learning", "Using the highest leverage available"], 2, "Survival comes first. Traders who protect their accounts early get time to improve; those who blow up early do not."),
 ("Why is paper trading useful at the start?", ["It guarantees real profits later", "It lets you make beginner mistakes using virtual money", "It is the only legal way to trade", "It removes all risk forever"], 1, "Paper trading uses real prices with virtual money, so you can practise the mechanics and your habits without risking savings. It does not guarantee later results."),
 ("An ad says: 'Turn $100 into $10,000 in a week, guaranteed.' What is the right reaction?", ["Join immediately before the offer ends", "Treat it as a red flag, because no one can guarantee trading returns", "Send them a small deposit to test it", "Ask for a screenshot of their profits"], 1, "Guaranteed returns are the classic sign of a scam or of misleading marketing. Screenshots can be faked, and real traders never promise outcomes."),
],
},

{
"slug": "course-how-markets-work",
"title": "How a market works: buyers, sellers and price",
"module": 1,
"minutes": 12,
"desc": "Lesson 2: how prices are set by buyers and sellers, what a trading pair like BTC/USDT means, and why the price of one coin tells you nothing about its size.",
"goal": "Understand where a price comes from, read a trading pair, and avoid the beginner mistake of judging a coin by how cheap it looks.",
"icon": "arrow-left-right",
"body": """
<p>Before you click any button, you need a clear picture of what a price actually is. It is simpler than it looks, and once you see it, charts and order screens start to make sense.</p>

<h2 id="price-is-a-meeting-point">Price is where a buyer and a seller meet</h2>
<p>An exchange is a meeting place. Some people want to buy and say the highest price they will pay. Others want to sell and say the lowest price they will accept. When a buyer and a seller agree, a trade happens, and <strong>that agreed price becomes the latest price</strong> you see on the screen.</p>
<p>Nobody "sets" the price. It is simply the most recent deal. If more people want to buy than sell, buyers have to offer more to get filled, and the price drifts up. If more people want to sell, sellers have to accept less, and it drifts down. That is all "supply and demand" means here.</p>
<div class="mk-callout mk-callout-example" role="note"><strong>Example:</strong> Imagine a coin where one person offers to sell at $100.10 and another offers to buy at $100.00. Nothing happens until one of them moves. If the buyer raises the bid to $100.10, a trade occurs at $100.10 and the screen shows $100.10. The list of waiting offers is the <a href="glossary#order-book">order book</a>, which you will meet again in lesson 4.</div>

<h2 id="reading-a-trading-pair">Reading a trading pair</h2>
<p>Every market is a <a href="glossary#trading-pair">trading pair</a> written like <strong>BTC/USDT</strong>. The first part is the thing you are buying or selling (the base). The second part is what you pay with (the quote).</p>
<div class="mk-table-wrap"><table class="mk-table">
<thead><tr><th scope="col">Pair</th><th scope="col">Base (what you trade)</th><th scope="col">Quote (the price is in this)</th><th scope="col">Reads as</th></tr></thead>
<tbody>
<tr><th scope="row">BTC/USDT</th><td>Bitcoin</td><td>USDT, a <a href="glossary#stablecoin">stablecoin</a> pegged to the US dollar</td><td>"One bitcoin costs this many dollars"</td></tr>
<tr><th scope="row">ETH/BTC</th><td>Ether</td><td>Bitcoin</td><td>"One ether costs this many bitcoin"</td></tr>
<tr><th scope="row">SOL/USDT</th><td>Solana</td><td>USDT</td><td>"One SOL costs this many dollars"</td></tr>
</tbody></table></div>
<p>Buying BTC/USDT means you spend USDT and receive BTC. Selling does the opposite. Beginners usually start with pairs quoted in a dollar stablecoin because the price is easy to read.</p>

<h2 id="spot-trading">Spot: the simplest way to trade</h2>
<p><a href="glossary#spot-trading">Spot trading</a> means you buy the actual asset and it lands in your account. You can only make money if the price rises after you buy. The most you can lose is what you put in. That makes spot the right place to start. Other products, like futures, add leverage and extra risks, which we cover in lesson 6.</p>

<h2 id="price-is-not-size">Why a cheap price does not mean a cheap coin</h2>
<p>Here is a trap that catches almost every beginner: "This coin costs $0.0004, so it has lots of room to grow, but Bitcoin costs a fortune." The price of one unit says nothing about how big or valuable the whole project is. What matters is the <a href="glossary#market-cap">market cap</a>:</p>
<div class="mk-callout mk-callout-definition" role="note"><strong>Market cap</strong> = price of one coin × number of coins in circulation.</div>
<p>A coin priced at $0.0004 with a trillion coins in circulation is worth $400 million. A coin priced at $400 with 1 million coins is worth the same $400 million. The tiny price is just a result of how many units exist. A low price does not make a coin "undervalued", and it does not make it more likely to rise.</p>

<h2 id="liquidity-and-volatility">Two words you will hear constantly</h2>
<ul>
<li><strong><a href="glossary#liquidity">Liquidity</a></strong> is how easily you can buy or sell without moving the price. Big pairs like BTC/USDT are very liquid. Tiny coins can be very hard to exit.</li>
<li><strong><a href="glossary#volatility">Volatility</a></strong> is how much and how fast the price moves. Crypto is more volatile than most traditional markets, and it trades 24 hours a day, 7 days a week.</li>
</ul>
<p>High volatility is why people are drawn to crypto and also why it can hurt so quickly.</p>
""",
"takeaways": [
 "The price on screen is simply the last deal between a buyer and a seller; more buyers push it up, more sellers push it down.",
 "In BTC/USDT you trade the first asset (base) and pay in the second (quote).",
 "Judge a coin by market cap, not by how cheap one unit looks. Spot trading, where you own the asset, is the safest place to start.",
],
"tryit": "In the <a href=\"app\">terminal</a>, open three different pairs. For each one write down the base, the quote and the 24-hour volume. Which pair looks the most liquid? Which looks the least?",
"quiz": [
 ("In the pair ETH/BTC, what are you buying when you buy the pair?", ["Bitcoin, paid for with ether", "Ether, paid for with bitcoin", "Ether, paid for with dollars", "A fixed-price contract"], 1, "The first asset is the base (what you receive when you buy) and the second is the quote (what you pay with). So buying ETH/BTC gives you ether and costs bitcoin."),
 ("What is the 'price' you see on a chart, in plain words?", ["A value set by the exchange each morning", "The most recent price at which a buyer and seller agreed to trade", "The average of all coins ever sold", "The price the exchange wants you to pay"], 1, "Price is just the latest agreed deal. The exchange does not decide it."),
 ("Coin A costs $0.01 and coin B costs $500. Which one is automatically 'cheaper' to own as a company-sized bet?", ["Coin A, because the price is lower", "Coin B, because the price is higher", "Neither: you must compare market cap, not the price per unit", "Whichever has more green candles"], 2, "Price per unit depends on how many units exist. Market cap (price × circulating supply) is the fair way to compare size."),
 ("Why is spot trading a sensible place for a beginner to start?", ["It is always profitable", "You own the asset and cannot lose more than you put in", "It has no fees", "Prices never move"], 1, "On spot you buy the real asset, so your maximum loss is the amount invested. There is no borrowed money that can force you out."),
],
},

{
"slug": "course-how-to-read-candlestick-charts",
"title": "Reading a price chart: candles and timeframes",
"module": 1,
"minutes": 14,
"desc": "Lesson 3: how to read candlestick charts. Open, high, low and close, body and wick, why timeframes matter, plus an interactive candle builder.",
"goal": "Read any single candle at a glance and choose a sensible timeframe for what you want to do.",
"icon": "candlestick-chart",
"body": """
<p>A price chart looks scary, but it is only a record of what the price did. The most common chart type uses <a href="glossary#candlestick">candlesticks</a>. Learn to read one candle and you can read the whole chart.</p>

<h2 id="one-candle-four-prices">One candle shows four prices</h2>
<p>Each candle covers a fixed slice of time, for example one hour, and records four numbers:</p>
<ul>
<li><strong>Open:</strong> the price at the start of that period.</li>
<li><strong>High:</strong> the highest price reached during it.</li>
<li><strong>Low:</strong> the lowest price reached during it.</li>
<li><strong>Close:</strong> the price at the end of the period.</li>
</ul>
<!--FIG:candle-->
<p>The thick part is the <strong>body</strong>. It runs from open to close. The thin lines above and below are the <strong><a href="glossary#wick">wicks</a></strong> (also called shadows). They show how far price went before being pushed back.</p>
<div class="mk-callout mk-callout-key-idea" role="note"><strong>Colour rule:</strong> On most charts a candle is <strong>green</strong> if it closed higher than it opened, and <strong>red</strong> if it closed lower. Some platforms let you swap the colours, so always check the settings before you trust your eyes.</div>

<h2 id="build-a-candle">Build one yourself</h2>
<p>Change the four numbers and watch the candle redraw. Try making a candle with a very long upper wick, then one with almost no wicks at all.</p>
<!--WIDGET:candle-->

<h2 id="what-candles-hint-at">What a candle can and cannot tell you</h2>
<div class="mk-table-wrap"><table class="mk-table">
<thead><tr><th scope="col">What you see</th><th scope="col">What it describes</th></tr></thead>
<tbody>
<tr><th scope="row">Long green body, tiny wicks</th><td>Buyers were in control for the whole period and price closed near the high.</td></tr>
<tr><th scope="row">Long red body, tiny wicks</th><td>Sellers were in control for the whole period.</td></tr>
<tr><th scope="row">Long upper wick</th><td>Price pushed up, then sellers drove it back down before the close. The move up was rejected.</td></tr>
<tr><th scope="row">Long lower wick</th><td>Price dropped, then buyers pushed it back up. The move down was rejected.</td></tr>
<tr><th scope="row">Small body, wicks both sides</th><td>A tug of war with no clear winner. Often called indecision.</td></tr>
</tbody></table></div>
<p>Notice the wording: these describe <em>what already happened</em>. A candle is a summary of the past, not a promise about the next one. Plenty of beginners memorise candle "patterns" with funny names and believe they predict the future. They do not, at least not reliably.</p>

<h2 id="timeframes">Timeframes: the same market, different stories</h2>
<p>A <a href="glossary#timeframe">timeframe</a> is how much time each candle covers: 1 minute, 15 minutes, 1 hour, 4 hours, 1 day, 1 week. The same market can look like a crash on the 1-minute chart and a gentle pullback on the daily chart.</p>
<div class="mk-table-wrap"><table class="mk-table">
<thead><tr><th scope="col">Timeframe</th><th scope="col">Good for</th><th scope="col">Watch out for</th></tr></thead>
<tbody>
<tr><th scope="row">1m to 5m</th><td>Very short-term trading</td><td>Lots of noise, fast decisions, high costs</td></tr>
<tr><th scope="row">15m to 1h</th><td>Day trading entries</td><td>Easy to overtrade</td></tr>
<tr><th scope="row">4h to 1D</th><td>Seeing the bigger picture, swing trades</td><td>Slower, so patience matters</td></tr>
<tr><th scope="row">1W</th><td>Long-term trend</td><td>Few signals</td></tr>
</tbody></table></div>
<p>For a beginner, <strong>start on the 1-hour to 1-day charts</strong>. They move slower, give you time to think, and cost less in fees because you trade less. Then zoom in to a smaller timeframe only to fine-tune an entry you already decided on.</p>

<h2 id="volume">Volume: how many people took part</h2>
<p>Under the candles you will usually see bars showing <a href="glossary#volume">volume</a>, the amount traded in that period. A big move on high volume means many participants agreed. A big move on thin volume is easier to reverse. Volume is context, not a signal on its own.</p>
""",
"takeaways": [
 "A candle records open, high, low and close for one time period; the body spans open to close and the wicks show the extremes.",
 "Candles describe what has already happened. They do not reliably predict what comes next.",
 "Beginners should start on 1-hour to 1-day charts; very small timeframes bring noise, stress and higher costs.",
],
"tryit": "Open the <a href=\"app\">terminal</a> and view one pair on the 15m, 4h and 1D charts. Take a screenshot of each. Write one sentence on how the story changes as you zoom out.",
"quiz": [
 ("A candle opened at $100, reached a high of $108, a low of $99 and closed at $106. What colour is it on a standard chart?", ["Red, because it hit a low", "Green, because it closed above its open", "Grey, because it had a wick", "You cannot tell"], 1, "Close ($106) is above open ($100), so it is an up candle, normally green."),
 ("A candle with a very long upper wick and a small body most likely means:", ["Price rose and stayed up all period", "Price pushed up but was rejected and pushed back down before the close", "The exchange was offline", "Volume was zero"], 1, "The wick shows how far price went. A long upper wick means buyers pushed up and sellers drove it back."),
 ("Which timeframe is usually most suitable for a complete beginner to start with?", ["1 second", "1 minute", "1 hour to 1 day", "Only the yearly chart"], 2, "Slower timeframes have less noise and give you time to think. They also tend to mean fewer trades and lower fees."),
 ("What does a candlestick pattern prove about the next candle?", ["It guarantees the direction", "It shows the future with 90% accuracy", "Nothing guaranteed: it only describes what already happened", "It proves the market is manipulated"], 2, "Candles summarise the past. Patterns can give context but never certainty."),
],
},

{
"slug": "course-order-types",
"title": "Order types: market, limit and stop",
"module": 2,
"minutes": 13,
"desc": "Lesson 4: market orders, limit orders and stop orders explained for beginners, with simple examples, when to use each, and the maker versus taker difference.",
"goal": "Choose between a market, limit and stop order, and know exactly what each one does when you press the button.",
"icon": "mouse-pointer-click",
"body": """
<p>An <em>order</em> is an instruction you give the exchange. The type of order decides <strong>how</strong> and <strong>at what price</strong> your trade is carried out. Using the wrong type is one of the cheapest ways for a beginner to lose money by accident.</p>

<h2 id="the-order-book">First, the waiting list</h2>
<p>Recall the meeting place from lesson 2. Waiting buy orders are called <strong>bids</strong> and waiting sell orders are called <strong>asks</strong>. Together they form the <a href="glossary#order-book">order book</a>. The gap between the best bid and the best ask is the <a href="glossary#spread">spread</a>.</p>
<!--FIG:book-->
<p>Remember these two prices, because they decide everything below: you <strong>buy</strong> at the ask and you <strong>sell</strong> at the bid, if you want to trade immediately.</p>

<h2 id="market-order">Market order: "do it now"</h2>
<p>A <a href="glossary#market-order">market order</a> says: buy or sell right now at the best available price. It fills immediately, almost always. The catch is that you do not control the exact price. If you are buying, you take the cheapest asks, and if your order is bigger than what is waiting there, you eat into higher and higher prices. That extra cost is called <a href="glossary#slippage">slippage</a>.</p>
<ul>
<li><strong>Pros:</strong> fast, certain to fill.</li>
<li><strong>Cons:</strong> you pay the spread and possible slippage; you can get a worse price than you expected in a fast market.</li>
<li><strong>Use it when:</strong> getting in or out matters more than a small price difference, for example closing a losing trade quickly.</li>
</ul>

<h2 id="limit-order">Limit order: "only at this price or better"</h2>
<p>A <a href="glossary#limit-order">limit order</a> says: buy no higher than this price, or sell no lower than this price. It joins the order book and waits. If the market reaches your price, you are filled. If it never does, you are not filled at all.</p>
<ul>
<li><strong>Pros:</strong> you control the price; often lower fees; no slippage.</li>
<li><strong>Cons:</strong> it may never fill, and you may miss the move.</li>
<li><strong>Use it when:</strong> you are patient and have a specific price in mind.</li>
</ul>
<div class="mk-callout mk-callout-example" role="note"><strong>Example:</strong> A coin trades at $100. You want to buy, but only if it dips to $98. You place a limit buy at $98. If the price drops to $98, you buy. If it goes up without touching $98, nothing happens and you keep your cash.</div>

<h2 id="stop-order">Stop order: "if it goes there, then act"</h2>
<p>A stop order stays dormant until the price reaches a trigger level you set (the stop price). Then it activates. Stops are mostly used to <strong>limit a loss</strong>: you own a coin bought at $100, and you set a stop at $95. If price falls to $95, your order triggers and sells.</p>
<div class="mk-table-wrap"><table class="mk-table">
<thead><tr><th scope="col">Type</th><th scope="col">What happens at the trigger</th><th scope="col">Risk</th></tr></thead>
<tbody>
<tr><th scope="row">Stop-market</th><td>Becomes a market order and sells at whatever price is available</td><td>You are almost sure to exit, but possibly at a worse price than the stop</td></tr>
<tr><th scope="row">Stop-limit</th><td>Becomes a limit order at the price you set</td><td>You control the price, but in a fast fall the order may never fill, so you stay in the trade</td></tr>
</tbody></table></div>
<p>A stop is a plan, not a guarantee. In a sudden drop the exit price can be lower than your stop. Our deeper guide to <a href="stop-loss-orders-explained">stop-loss orders</a> covers this. In lesson 8 you will learn <em>where</em> to put one.</p>

<h2 id="maker-and-taker">Maker and taker: why exchanges charge differently</h2>
<p>If your order <strong>waits</strong> in the book (a limit order), you are a <em>maker</em>: you add liquidity. If your order <strong>takes</strong> what is already waiting (a market order), you are a <em>taker</em>. Many exchanges charge takers a higher <a href="glossary#maker-taker">fee</a> than makers. Over many trades, that adds up.</p>

<h2 id="which-to-use">A simple rule for beginners</h2>
<ul>
<li><strong>Entering:</strong> use a limit order when you can wait; use a market order only when speed truly matters.</li>
<li><strong>Protecting:</strong> set a stop as soon as you are in.</li>
<li><strong>Always</strong> check the order preview before you confirm: side (buy or sell), price, amount and fee.</li>
</ul>
""",
"takeaways": [
 "You buy at the ask and sell at the bid when trading instantly; the gap between them is the spread.",
 "Market orders are fast but cost the spread and possible slippage; limit orders control the price but may not fill.",
 "A stop order triggers at a price you choose to limit losses. It is a plan, not a guarantee of the exit price.",
],
"tryit": "In <a href=\"trade\">paper trading</a>, place one limit buy order a little below the current price and watch whether it fills. Then place a small market order and compare the price you got to the price you saw on screen.",
"quiz": [
 ("You want to buy a coin only if it falls to $98 (currently $100). Which order fits?", ["Market buy", "Limit buy at $98", "Market sell", "Stop-market sell at $98"], 1, "A limit buy waits at $98 and only fills at that price or lower."),
 ("What is slippage?", ["A fee charged monthly", "The difference between the expected price and the price you actually got", "A type of chart pattern", "A rule that blocks trading"], 1, "Slippage is the cost of a market order eating through several price levels, so you pay or receive a worse average price than expected."),
 ("Which statement about a stop-limit order is true?", ["It is guaranteed to fill at the stop price", "It might not fill at all if the market falls past your limit price", "It can never lose money", "It is the same as a market order"], 1, "A stop-limit becomes a limit order at the trigger, so in a fast move price can skip past your limit and leave you in the trade."),
 ("You place a limit order that sits in the order book and later gets filled. Which role were you?", ["Taker", "Maker", "Regulator", "Market cap holder"], 1, "Orders that wait in the book add liquidity, so you are the maker. Many exchanges charge makers lower fees."),
],
},

{
"slug": "course-trading-costs",
"title": "The real cost of a trade: fees, spread and slippage",
"module": 2,
"minutes": 11,
"desc": "Lesson 5: what trading really costs. Fees, spread and slippage explained simply, with a break-even cost calculator that shows how fast small costs add up.",
"goal": "Calculate the full cost of a round-trip trade and understand why overtrading quietly drains accounts.",
"icon": "receipt",
"body": """
<p>"Trading is free!" is a common claim. It is not. Every trade has costs, and they are charged whether you win or lose. If you ignore them, a strategy that looks fine on paper can lose money in practice.</p>

<h2 id="three-costs">The three costs of every trade</h2>
<div class="mk-table-wrap"><table class="mk-table">
<thead><tr><th scope="col">Cost</th><th scope="col">What it is</th><th scope="col">Who you pay</th></tr></thead>
<tbody>
<tr><th scope="row">Fee</th><td>A percentage of your trade value, charged on entry and again on exit</td><td>The exchange</td></tr>
<tr><th scope="row">Spread</th><td>The gap between the best bid and best ask. Trading instantly means paying it</td><td>The other side of your trade</td></tr>
<tr><th scope="row">Slippage</th><td>Getting a worse price because your order was bigger than what was waiting at the best price</td><td>Market depth</td></tr>
</tbody></table></div>
<p>On a liquid pair, spread and slippage are tiny for small orders. On a small coin they can be several percent, which means you start every trade already behind.</p>

<h2 id="round-trip">The round trip</h2>
<p>A <em>round trip</em> is one full trade: buy, then sell. You pay fees on both legs. If your fee is 0.1% per side, a round trip costs about 0.2% before you even count the spread. Fees differ by exchange and account level, so check your own fee table rather than trusting a number from a blog.</p>
<div class="mk-callout mk-callout-example" role="note"><strong>Example:</strong> You trade $1,000. Fee is 0.1% per side, so $1 to buy and about $1 to sell. Add a 0.05% spread. Your total cost is roughly $2.50 per round trip. The price has to rise about 0.25% before you merely break even.</div>

<h2 id="break-even-calculator">Try it: your break-even move</h2>
<p>Change the numbers to match your exchange and the pair you trade. Fees and slippage apply on both entry and exit; the spread is paid once across the round trip.</p>
<!--WIDGET:cost-->

<h2 id="overtrading">Why frequent trading is expensive</h2>
<p>Costs repeat on every trade. A trader who makes 10 round trips a day at 0.25% each pays about 2.5% of their position size per day in friction alone. Over a month of weekdays that is more than 50% of the position size, and the trader has to be consistently skilled just to cover it. This is a main reason short-term trading is so hard for beginners.</p>
<div class="mk-callout mk-callout-key-idea" role="note"><strong>Key idea:</strong> Fewer, better-planned trades beat many impulsive ones, partly because each trade has a fixed price tag. Before you click, ask: "Is the expected move bigger than the cost?"</div>

<h2 id="more-costs">Costs you only meet later</h2>
<ul>
<li><strong>Funding fees</strong> on perpetual futures, paid between longs and shorts every few hours. See <a href="funding-rate-explained">funding rates explained</a>.</li>
<li><strong>Withdrawal and network fees</strong> when you move coins out of an exchange.</li>
<li><strong>Taxes</strong> in many countries on profits. Rules vary, so ask a qualified local professional.</li>
</ul>
<p>To practise the arithmetic on a real position, try our <a href="how-to-calculate-crypto-profit-and-loss">profit and loss guide</a> and the <a href="crypto-roi-calculator">ROI calculator</a>, which both include fees.</p>
""",
"takeaways": [
 "Every trade costs fees, spread and slippage. You pay them win or lose.",
 "A round trip pays fees twice, so your price must move enough just to break even.",
 "Overtrading multiplies costs; fewer, planned trades protect your account.",
],
"tryit": "Use the calculator above with your exchange's real fee. Then work out how many round trips per day would eat 1% of your trade size in costs alone.",
"quiz": [
 ("Which of these is NOT a normal trading cost?", ["Exchange fee", "Spread", "Slippage", "A guaranteed profit bonus"], 3, "Fees, spread and slippage are real costs. No exchange pays a guaranteed profit bonus."),
 ("A round trip with 0.1% fee per side costs about how much in fees alone?", ["0.01%", "0.1%", "0.2%", "1%"], 2, "You pay once to buy and once to sell, so fees roughly double to 0.2%."),
 ("Why does trading very often make it harder to profit?", ["Costs repeat on every trade and add up", "Exchanges ban frequent traders", "Charts stop working", "Profits are taxed at 100%"], 0, "Each round trip has a cost. The more trades you make, the more your skill must exceed the accumulated friction."),
 ("You are trading a thin, little-known coin with a 2% spread. What does that mean for a market order?", ["It is free to trade", "You start the trade about 2% behind", "Slippage is impossible", "It is safer than Bitcoin"], 1, "A wide spread means the instant buy and sell prices are far apart, so you begin in a hole before the market moves at all."),
],
},

{
"slug": "course-leverage-for-beginners",
"title": "Leverage and liquidation, explained simply",
"module": 2,
"minutes": 15,
"desc": "Lesson 6: leverage for beginners. How borrowed buying power multiplies gains and losses, what liquidation is, and why high leverage ends most beginner accounts.",
"goal": "Understand what leverage really does, calculate roughly where a leveraged position gets liquidated, and decide to treat it with great caution.",
"icon": "gauge",
"body": """
<p>Leverage is the single most dangerous tool a beginner can touch, and exchanges make it one click away. This lesson is long on purpose. If you remember one thing from the course, make it this lesson.</p>

<h2 id="what-leverage-is">What leverage is</h2>
<p><a href="glossary#leverage">Leverage</a> lets you open a position larger than the money you put up. You deposit your own money as <a href="glossary#margin">margin</a>, and the exchange lends you the rest. With 10x leverage, $100 of margin controls a $1,000 position.</p>
<div class="mk-callout mk-callout-definition" role="note"><strong>Position size</strong> = margin × leverage. At 10x, $100 margin = $1,000 position. At 50x, the same $100 controls $5,000.</div>
<p>Leverage is available on products like <a href="glossary#perpetual-futures">perpetual futures</a>, which are different from spot. If you want to see the differences, read <a href="spot-vs-futures">spot vs. perpetual futures</a>.</p>

<h2 id="both-directions">It multiplies gains and losses</h2>
<p>The result on your position is magnified by the leverage, in both directions:</p>
<div class="mk-table-wrap"><table class="mk-table">
<thead><tr><th scope="col">Price moves</th><th scope="col">No leverage</th><th scope="col">10x leverage</th></tr></thead>
<tbody>
<tr><th scope="row">+5%</th><td>+5% on your money</td><td>+50% on your margin</td></tr>
<tr><th scope="row">-5%</th><td>-5% on your money</td><td>-50% on your margin</td></tr>
<tr><th scope="row">-10%</th><td>-10%</td><td>About -100%: your margin is gone</td></tr>
</tbody></table></div>
<p>The exciting row is the first one. The row that ends accounts is the last.</p>

<h2 id="liquidation">Liquidation: when the exchange closes you out</h2>
<p>Because the exchange lent you money, it protects itself. If the price moves against you so much that your margin is nearly used up, the exchange <strong>force-closes your position</strong>. This is <a href="glossary#liquidation">liquidation</a>. You lose the margin you put in for that position, and you do not get to choose the exit.</p>
<p>A rough rule for a long position (ignoring fees and a small safety buffer called maintenance margin): the price only needs to fall about <strong>100 divided by the leverage</strong> percent from your entry.</p>
<div class="mk-table-wrap"><table class="mk-table">
<thead><tr><th scope="col">Leverage</th><th scope="col">Price drop that wipes your margin (approx.)</th></tr></thead>
<tbody>
<tr><td>2x</td><td>about 50%</td></tr>
<tr><td>5x</td><td>about 20%</td></tr>
<tr><td>10x</td><td>about 10%</td></tr>
<tr><td>25x</td><td>about 4%</td></tr>
<tr><td>50x</td><td>about 2%</td></tr>
<tr><td>100x</td><td>about 1%</td></tr>
</tbody></table></div>
<p>Crypto routinely moves 2% in a single hour. At 50x or 100x, ordinary noise liquidates you. This is why the most common beginner story is "I made a few trades and lost everything".</p>

<h2 id="try-leverage">Try it: where would you be liquidated?</h2>
<!--WIDGET:leverage-->
<p class="cc-note">This tool is a simplified estimate. Real liquidation prices are a little closer to your entry because of fees and maintenance margin. For a closer figure, use our <a href="liquidation-price-calculator">liquidation price calculator</a>.</p>

<h2 id="other-dangers">Other dangers of leverage</h2>
<ul>
<li><strong>Funding fees</strong> on perpetuals are charged while you hold, whether you are winning or not.</li>
<li><strong>It shrinks your room for being wrong.</strong> With a tight liquidation point, you cannot survive a normal dip even if your idea turns out right later.</li>
<li><strong>It tempts you to over-size.</strong> Leverage turns a small account into a large position, so a single mistake is huge.</li>
<li><strong>Emotions get louder.</strong> Watching 50% swings on your margin makes clear thinking hard.</li>
</ul>
<p>For a visual walk-through, watch our <a href="leverage-liquidation-explained-video">leverage and liquidation video</a>.</p>

<h2 id="beginner-rule">A sensible rule for beginners</h2>
<div class="mk-callout mk-callout-key-idea" role="note"><strong>Key idea:</strong> Start with spot and no leverage. Practise leverage only in paper trading, and keep it very low (1x to 3x) while you learn. Never use leverage to "make up" for a small account. If you cannot make money without leverage, leverage will not fix that. It will only make the losses bigger.</div>
""",
"takeaways": [
 "Leverage lets you control a bigger position with a smaller margin. It magnifies profits and losses equally.",
 "Liquidation happens when losses use up your margin: roughly a drop of 100 ÷ leverage percent for a long position.",
 "Beginners should avoid leverage on real money, and practise at low leverage in paper trading only.",
],
"tryit": "In <a href=\"trade\">paper trading</a>, open one small position at 2x and note the liquidation price shown. Then compare it to the same trade at 20x. How much room does each give you?",
"quiz": [
 ("You use 10x leverage and the price moves 10% against you. Roughly what happens to your margin?", ["You lose about 10% of it", "You lose about 100% of it: you are liquidated", "Nothing, stops protect you automatically", "You gain"], 1, "At 10x, a 10% adverse move equals about a 100% loss on your margin, so you are close to or at liquidation."),
 ("Which has a liquidation price closer to your entry?", ["2x leverage", "5x leverage", "20x leverage", "They are all the same"], 2, "Higher leverage means a smaller adverse move wipes you out, so the liquidation price is closer to your entry."),
 ("What is liquidation?", ["The exchange closing your leveraged position because your margin is almost used up", "Selling your coins for a profit", "A type of order that waits at a price", "Converting coins to cash voluntarily"], 0, "Liquidation is a forced closure by the exchange to protect the money it lent you. You lose the margin."),
 ("A sensible approach to leverage for a new trader is:", ["Start at 100x to grow the account quickly", "Use leverage only to recover losses", "Avoid it on real money and keep it very low in practice mode", "Always use the maximum available"], 2, "Leverage is a risk amplifier. Learn the basics unlevered, and test low leverage only in paper trading until you have a proven process."),
],
},
]