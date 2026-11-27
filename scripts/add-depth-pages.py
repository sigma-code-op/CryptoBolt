#!/usr/bin/env python3
"""Add new written sections to existing calculator and core pages. Idempotent: each block sits between
<!-- depth:start --> and <!-- depth:end --> and is replaced on re-run.  Run from the project root, AFTER
enrich-pages.py / engage-pages.py, then run: node scripts/build-csp.js && python3 scripts/build-markdown.py
Numbers are rounded and illustrative. No predictions or performance claims.
"""
import pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent.parent
S, E = "<!-- depth:start -->", "<!-- depth:end -->"

# calculators: block goes inside the guide article, before </article>
CALC = {}
CALC["funding-fee-calculator"] = """
<h2>Reading your result: three cases</h2>
<p>The calculator gives you a cost, but the number only means something next to what you expect to earn. Take a $5,000 long held for 5 days.</p>
<p>At 0.01% per 8 hours, the cost is $0.50 per interval, $1.50 per day and $7.50 over five days, about 0.15% of the position. Most trades can carry that. At 0.05% the same hold costs $37.50, or 0.75%, which is a real slice of a trade aiming for 3%. At 0.10%, which appears in very crowded markets, it is $75, or 1.5%, and funding alone can decide whether the trade pays.</p>
<h2>When this number misleads you</h2>
<ul>
<li><strong>The rate will not stay fixed.</strong> It is recalculated every interval and can swing from positive to negative within days.</li>
<li><strong>Position value moves.</strong> If price rises, the position is worth more and so is each payment.</li>
<li><strong>It is not the only cost.</strong> Trading fees and slippage come on top, so add them before judging a trade.</li>
<li><strong>The sign matters.</strong> If you are short while funding is positive, you receive the payment instead of paying it.</li>
</ul>
<p>A useful habit: run the calculator at the current rate, then again at three times that rate. If the trade still makes sense at the higher figure, funding is not your main risk.</p>
"""

CALC["crypto-profit-calculator"] = """
<h2>Reading your result: why percent and dollars tell different stories</h2>
<p>A $40 profit sounds good, but it means different things on different positions. On a $400 position it is a 10% return. On a $4,000 position it is 1%, and a single fee or slip could erase it. Always look at both numbers together, and at what you risked to get there.</p>
<p>Compare two trades. Trade A: buy $1,000, sell at +3%, pay 0.2% in round-trip fees. Net profit is about $28. Trade B: the same, but you also gave up 0.3% in slippage because the coin was thinly traded. Net profit is about $25, a 10% smaller result from a cost you could have checked beforehand in the order book.</p>
<h2>Using the calculator before a trade, not just after</h2>
<ol>
<li>Enter your planned entry, your target and your fees to see the profit if it works.</li>
<li>Enter the stop price as the exit to see the loss if it does not.</li>
<li>Divide the first by the second. If the potential gain is not clearly larger than the potential loss, reconsider the trade.</li>
<li>Check the break-even price, the level where fees are covered, and ask whether the move you expect is comfortably beyond it.</li>
</ol>
<p>Many people only use profit calculators to feel good about a win. They are more valuable as a pre-trade check on whether the numbers justify the risk.</p>
"""

CALC["crypto-roi-calculator"] = """
<h2>What ROI hides</h2>
<p>Return on investment is a ratio, and ratios hide size and time. A 50% ROI on $100 is $50. A 5% ROI on $10,000 is $500. And a 50% ROI that took three years is a very different result from a 50% ROI that took three weeks.</p>
<h2>Comparing investments fairly</h2>
<p>To compare two results, convert them to an annualised figure. A 20% gain over six months is not 20% a year. Compounded, it is roughly 44% a year if repeated, but nothing guarantees it will be. Annualising is useful for comparing, and misleading if you treat it as a forecast. That is why short-term results should be quoted with their time period attached.</p>
<h2>The loss side of ROI</h2>
<p>ROI is not symmetrical. After a −50% result you need +100% to get back to where you started. After −20% you need +25%. When the calculator shows a negative ROI, check what return would recover it. That number is often larger than people expect, and it explains why limiting losses matters more than chasing gains.</p>
<h2>Include everything you paid</h2>
<p>For an honest ROI, count the full cost: purchase fees, withdrawal or network fees, and any funding or borrowing costs. Leaving these out can turn a small apparent gain into a small real loss. If you used leverage, calculate ROI on the margin you put in, not on the full position value, or the percentages will look far smaller than the risk you actually took.</p>
"""

CALC["crypto-average-price-calculator"] = """
<h2>What your average price tells you, and what it does not</h2>
<p>An average cost is simply total money spent divided by total coins held. It is your break-even point, the price at which you would neither gain nor lose, before fees. It is not a target, and it has no influence on what the market does next.</p>
<p>Suppose you buy 1 coin at $100, then 2 coins at $80, then 1 coin at $60. You spent $320 for 4 coins, so your average is $80. If the price is $70 you are down about 12.5%, even though your last purchase was at $60. Notice that the average moved toward the later, cheaper buys, which is the whole point of averaging down.</p>
<h2>The trap of averaging down</h2>
<p>Buying more as price falls lowers your average, which feels like progress. But it also increases your exposure to something that is going the wrong way. Averaging down works when it is a plan made in advance with limits, such as a fixed amount on a fixed schedule. It is dangerous when it is a reaction, with bigger purchases each time, because losses can grow faster than your average improves.</p>
<h2>A quick discipline</h2>
<ul>
<li>Decide the maximum total you are willing to put into one coin before the first purchase.</li>
<li>Write down the price at which you would admit the idea was wrong.</li>
<li>Use the calculator to see how far price must recover to reach break-even after each extra buy.</li>
</ul>
"""

CALC["crypto-staking-calculator"] = """
<h2>How to read the projected reward</h2>
<p>The calculator multiplies your balance by a rate over time. That is arithmetic, not a promise. Real staking rewards depend on network rules, how many others are staking, and sometimes on validator performance. Treat the output as a "what if the rate stayed this way" figure.</p>
<h2>Three things the projection leaves out</h2>
<ul>
<li><strong>The coin price.</strong> Rewards are usually paid in the staked token. If its price falls 30%, a 6% reward does not rescue the position in dollar terms.</li>
<li><strong>Lock-up and unbonding.</strong> Some networks hold your coins for days or weeks after you unstake. You cannot sell during that period.</li>
<li><strong>Fees and risk.</strong> Platforms or validators may take a commission, and a validator that misbehaves can be penalised, which can reduce your balance in some systems.</li>
</ul>
<h2>Getting more from the tool</h2>
<p>Run it twice: once with the current advertised rate and once with half of it. Rates often fall as more people stake. If the lower figure still justifies locking your coins, the decision is sturdier. Also compare compounding on and off, to see how much of the result depends on reinvesting rewards, which may need manual action on some platforms.</p>
"""

# core pages: a new section before the given pattern
CORE = {}
CORE["crypto-paper-trading"] = ("""<section class="mk-section" id="depth-paper-mistakes"><article class="mk-article">
<h2>Six habits that make paper trading worthless</h2>
<p>Paper trading is easy to do badly. If your practice does not resemble the real thing, it can teach you habits that hurt when real money is involved. Watch for these:</p>
<ol>
<li><strong>Using absurd size.</strong> A $1,000,000 virtual balance risked in huge positions teaches nothing. Set the balance to an amount you might really trade.</li>
<li><strong>Ignoring costs.</strong> If you do not count fees and slippage, your results will look better than reality.</li>
<li><strong>Trading with no rules.</strong> Without a written plan, you are only clicking. Decide risk, entry and exit before you start.</li>
<li><strong>Skipping the losses.</strong> Resetting the account after a bad run hides the lesson. Keep the results and study them.</li>
<li><strong>Taking trades because it is free.</strong> Fake money makes it tempting to gamble. Ask whether you would take this trade with real money, and if not, skip it.</li>
<li><strong>Stopping too soon.</strong> A handful of trades is noise. A few dozen starts to show how you behave.</li>
</ol>
<h2>What a good practice month looks like</h2>
<p>In a useful month you follow one plan, trade one or two markets, journal every trade, and review weekly. You will probably find that most of your mistakes are about process, not about picking direction: entering late, moving a stop, or sizing too big after a win. Those are exactly the problems that cost real money, and they are far cheaper to find here. When your plan-following rate is high and your risk per trade is steady, you have learned the most important thing paper trading can teach.</p>
</article></section>
""", r'<section class="mk-section" id="paper-trading-faq">')

CORE["crypto-trading-terminal"] = ("""<section class="mk-section" id="depth-terminal-routine"><article class="mk-article">
<h2>A five-step routine for using a trading terminal well</h2>
<p>A terminal gives you a lot of information at once, which can make it harder to think, not easier. A fixed routine keeps you focused on what matters.</p>
<ol>
<li><strong>Start with the big picture.</strong> Open the daily chart and note the trend and the two or three levels that mattered most recently.</li>
<li><strong>Check positioning.</strong> Look at funding and open interest. High funding with rising open interest suggests a crowded trade, which can mean sharp moves.</li>
<li><strong>Look at the order book.</strong> See how much size sits near price. Thin depth means your order may move the market.</li>
<li><strong>Define the trade.</strong> Write the entry, the stop and the size from your risk rule before touching the order panel.</li>
<li><strong>Decide what would change your mind.</strong> Name the condition that cancels the idea, so you are not inventing reasons later.</li>
</ol>
<h2>What not to do with it</h2>
<p>More screens do not create an edge. Beginners often add indicator after indicator until something agrees with what they already want to do. Pick a small set of tools, learn what each one shows, and ignore the rest. The goal of the terminal is to make your process faster and more careful, not to give you a reason to trade more often.</p>
</article></section>
""", r'<section class="mk-section" id="terminal-faq">')

CORE["ai-crypto-research"] = ("""<section class="mk-section" id="depth-ai-limits"><article class="mk-article">
<h2>How to get better answers from an AI research tool</h2>
<p>The quality of what you get depends a lot on how you ask. A few habits help.</p>
<ul>
<li><strong>Ask specific questions.</strong> "What has changed in funding and open interest for this coin over the last day?" is better than "Is this coin good?"</li>
<li><strong>Ask for the evidence.</strong> Request the numbers behind a claim, then compare them with the panels yourself.</li>
<li><strong>Ask for the other side.</strong> "What would make this view wrong?" often reveals the weak point in an argument.</li>
<li><strong>Keep your own timeframe.</strong> Say whether you care about the next hour or the next month. The relevant evidence is different.</li>
</ul>
<h2>What an AI summary should never replace</h2>
<p>A summary can save time, but it cannot see your risk limits, your account size, or how you will feel if a trade drops 5%. Those decide whether a trade is right for you. Use the research to understand conditions, then do the sizing and the planning yourself. If an answer sounds certain about the future, treat that certainty as a flaw, not a strength.</p>
</article></section>
""", r'<section class="mk-section" id="ai-question-faq">')

CORE["features"] = ("""<section class="mk-section" id="depth-feature-guide"><article class="mk-article">
<h2>Which feature to learn first</h2>
<p>If you are new, the number of tools can feel like a lot. A simple order makes it manageable.</p>
<ol>
<li><strong>Charting.</strong> Learn to read candles and mark a few levels. Everything else builds on this.</li>
<li><strong>The order book.</strong> Learn what the two sides show and how a market order walks through them.</li>
<li><strong>Paper trading.</strong> Practise entries, stops and targets with virtual money before you risk anything.</li>
<li><strong>Alerts.</strong> Once you have levels in mind, let alerts watch them so you are not glued to the screen.</li>
<li><strong>The AI desk.</strong> Use it last, as a second opinion that you can check, not as a starting point.</li>
</ol>
<h2>How the features work together</h2>
<p>A typical session might start with a chart to find a level, a glance at the order book to see how much size sits near it, a calculator to size the trade from the stop, and a paper trade to rehearse. Each tool answers one question, and the value comes from asking them in order. If you skip straight to placing an order, the other tools have nothing to do.</p>
</article></section>
""", r'<section class="mk-section px-extras" id="session"')

CORE["about"] = ("""<section class="mk-section" id="depth-about-principles"><article class="mk-article">
<h2>The principles behind the site</h2>
<p>Every page on CryptoBolt is written to the same short list of rules, so you can judge the site by whether it keeps them.</p>
<ul>
<li><strong>No predictions.</strong> Nobody can reliably say where a price goes next. The site explains conditions and risk instead.</li>
<li><strong>Show the arithmetic.</strong> Calculators display their formulas, and articles use worked numbers so you can check them.</li>
<li><strong>Say what a tool cannot do.</strong> Funding, slippage and liquidation are explained with their limits, not just their benefits.</li>
<li><strong>Teach before selling.</strong> Learning material is free to read, and anything paid is labelled clearly.</li>
<li><strong>Admit mistakes.</strong> If something on the site is wrong, you can report it through the contact page and it will be fixed.</li>
</ul>
<h2>Who it is for</h2>
<p>The site is aimed at people who want to understand markets before they risk money: beginners who need clear explanations, and more experienced traders who want quick, honest tools for sizing and checking a plan. If you want signals or guaranteed returns, this is not the place, and any site that promises them deserves your suspicion.</p>
</article></section>
""", r'<section class="mk-section" id="about-trust"')


def strip(s):
    return re.sub(re.escape(S) + r".*?" + re.escape(E) + r"\n?", "", s, flags=re.S)


def main():
    n = 0
    for slug, block in CALC.items():
        p = ROOT / (slug + ".html")
        raw = p.read_bytes().decode("utf-8")
        crlf = "\r\n" in raw
        s = strip(raw.replace("\r\n", "\n"))
        i = s.index('id="guide"')
        j = s.index("</article>", i)
        s = s[:j] + S + block + E + "\n" + s[j:]
        p.write_bytes((s.replace("\n", "\r\n") if crlf else s).encode("utf-8")); n += 1
    for slug, (block, anchor) in CORE.items():
        p = ROOT / (slug + ".html")
        raw = p.read_bytes().decode("utf-8")
        crlf = "\r\n" in raw
        s = strip(raw.replace("\r\n", "\n"))
        m = re.search(anchor, s)
        if not m:
            print("anchor missing", slug); continue
        s = s[:m.start()] + S + "\n" + block + E + "\n" + s[m.start():]
        p.write_bytes((s.replace("\n", "\r\n") if crlf else s).encode("utf-8")); n += 1
    print("pages updated:", n)


if __name__ == "__main__":
    main()