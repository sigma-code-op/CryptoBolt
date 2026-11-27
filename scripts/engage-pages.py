#!/usr/bin/env python3
"""Inject a hand-written "hook" block (headline, three cards, a 60-second try-it list and CTAs) right under
the hero of the public pages that did not have one. Idempotent: each block sits between
<!-- eg2:start --> and <!-- eg2:end --> and is replaced on re-run.  Run from the project root:
    python3 scripts/engage-pages.py
Every claim below is something the page or site already says or something universally true; there are
no performance claims, predictions or invented features.
"""
import html, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent.parent
E = html.escape

# (eyebrow, headline, lead, [(title, text)], try-it title, [steps], (primary label, href), (secondary label, href))
PAGES = {
 'about': ('Why this exists',
  'Built by one person who wanted a clean screen, then shared it.',
  'No investors to please, no paywall to push you toward. That is the whole idea, and it shapes every choice you see on the site.',
  [('Free where it counts', 'The terminal, calculators, guides and paper trading cost nothing and need no account to browse.'),
   ('Honest about limits', 'CryptoBolt never holds your money and never predicts prices. It shows you what is happening and what the numbers mean.'),
   ('Shaped by you', 'Most of the roadmap comes from messages sent through the contact form, so a good idea can ship quickly.')],
  'See it for yourself in a minute',
  ['Open the terminal and watch live Binance prices with no sign-up.', 'Ask the AI desk what is driving a coin right now and check its sources.', 'Place a practice trade in paper trading and watch the equity curve.'],
  ('Launch the terminal', 'app'), ('Send an idea', 'contact')),
 'crypto-trading-terminal': ('Your first five minutes',
  'Stop juggling four tabs to answer one question.',
  'Price, chart, order book, alerts and an AI read sit in one view, so a question like \u201cis this move real?\u201d takes seconds instead of a tab hunt.',
  [('See where size sits', 'The order book shows resting bids and asks, so a thin book or a wall of orders is visible before you click.'),
   ('Chart and context together', 'Watch an indicator cross on the chart while the book and the AI summary update beside it.'),
   ('No wall in front of it', 'Open it and look around. Prices, charts and depth need no account and no email.')],
  'Try this first session',
  ['Open BTC/USDT and switch the chart to the 4-hour timeframe.', 'Look at the order book: is size stacked above or below the price?', 'Ask the AI desk for a read and compare it with what you can see yourself.'],
  ('Launch live terminal', 'app'), ('Learn to read an order book', 'how-to-read-an-order-book')),
 'crypto-paper-trading': ('Practice that feels real',
  'Make your beginner mistakes with fake money.',
  'Most beginners lose money early. Paper trading lets that happen at live prices with nothing at stake, and shows exactly where your process broke.',
  [('Live prices, virtual cash', 'Real market movement and a virtual balance, so the lessons are real and the losses are not.'),
   ('A scoreboard, not a hunch', 'Holdings, realised and unrealised P&L and an equity curve turn \u201cI think I am doing well\u201d into numbers.'),
   ('A leaderboard when you want it', 'Sign in to save your account and compare weekly and monthly P&L with other traders.')],
  'Run your first practice trade',
  ['Write down your risk per trade before you open anything, for example 1% of the account.', 'Place a small buy, set where you would exit, and note why in one line.', 'Check the result against the plan, not against your mood.'],
  ('Start paper trading', 'trade'), ('Take the free course', 'trading-course')),
 'ai-crypto-research': ('Research you can check',
  'An AI that shows its work instead of calling the next candle.',
  'A good read is a short list of conditions you can verify: trend, positioning, sentiment and news, each tied to something on your screen.',
  [('Grounded in live inputs', 'Price action, funding rates and the Fear & Greed Index feed the read, so it reflects now and not a stale snapshot.'),
   ('No predictions', 'It will not tell you where price goes tomorrow. It tells you what the market is doing and why it matters.'),
   ('Built to be questioned', 'Every claim points back to a panel or a source you can open, so you can disagree with it.')],
  'Test it in a minute',
  ['Open the AI desk and ask what is driving a coin you follow.', 'Find the funding rate and open interest it mentions on the terminal and confirm them.', 'Decide for yourself whether you agree, then note why.'],
  ('Open AI desk', 'app'), ('How the research stays grounded', 'ai-research-grounded-data')),
 'bitcoin': ('Before you trade Bitcoin',
  'Know what is moving BTC before you click buy or sell.',
  'Bitcoin has a hard 21 million supply cap, a halving roughly every four years, and a large futures market alongside spot. Those three facts explain a lot of the noise.',
  [('Read the positioning', 'Funding and open interest show how crowded one side of the trade is, which often matters more than the headline.'),
   ('Know the cycle', 'The halving cuts new supply in half. It is context for the story, not a timer for the price.'),
   ('Size for the swings', 'BTC can move several percent in a day. Your position size should survive that, not hope it will not happen.')],
  'Do this before your next BTC trade',
  ['Size the trade from your stop with the position size calculator.', 'Check the liquidation price if you plan to use leverage.', 'Rehearse the idea in paper trading first.'],
  ('Position size calculator', 'position-size-calculator'), ('The halving, explained', 'bitcoin-halving-explained')),
 'ethereum': ('Before you trade Ethereum',
  'ETH is not just \u201csmaller Bitcoin\u201d, and it trades that way.',
  'Staking, fee burn and activity across the network give ETH drivers that Bitcoin does not have, and the ETH/BTC ratio shows when it is leading or lagging.',
  [('Watch ETH against BTC', 'The ETH/BTC ratio tells you whether ETH is really outperforming or just riding the whole market.'),
   ('Understand the yield', 'Staking rewards are quoted as APR or APY. They are not the same thing, and the guide shows the difference.'),
   ('Respect the leverage', 'ETH moves hard. At high leverage a normal swing can liquidate a position before your idea plays out.')],
  'Do this before your next ETH trade',
  ['Look at ETH/USDT and ETH/BTC side by side on the page.', 'Work out your risk with the risk-reward calculator.', 'Check where leverage would liquidate you before you commit.'],
  ('Risk-reward calculator', 'risk-reward-calculator'), ('Liquidation price calculator', 'liquidation-price-calculator')),
 'solana': ('Before you trade Solana',
  'Fast network, fast moves: plan for both.',
  'SOL can move a lot in a short time, so the risk side of the plan matters more than the entry. Know your exit before you are in.',
  [('Big candles are normal', 'Wide swings mean tight stops get hit often. Decide whether your stop fits the coin, not just your wish.'),
   ('Mind the thin spots', 'Smaller markets can slip on big orders. The order book shows how much size really sits near the price.'),
   ('Practice the volatility', 'Feeling a 10% swing with virtual money is a far cheaper lesson than feeling it with real money.')],
  'Do this before your next SOL trade',
  ['Check the order book depth before sizing up.', 'Use the position size calculator so a stop-out costs a fixed, small amount.', 'Practise the setup in paper trading first.'],
  ('Position size calculator', 'position-size-calculator'), ('Try paper trading', 'trade')),
 'crypto-calculators': ('Fourteen calculators, one habit',
  'The traders who last do the maths before the trade, not after.',
  'Three numbers get skipped more than any others: how much they can lose, how big the position is, and where leverage liquidates them. These tools answer all three in seconds.',
  [('Plan the trade', 'Risk, size and reward in one pass, so you know the cost of being wrong before you enter.'),
   ('Plan the hold', 'Average price, ROI, staking and DCA, with fees included, so the real return is the one you see.'),
   ('Stress-test it', 'Liquidation, losing streaks and risk of ruin show how a plan behaves when things go badly.')],
  'A two-minute routine to copy',
  ['Enter your account size and a 1% risk in the position size calculator.', 'Check the reward-to-risk ratio of the idea.', 'Run the losing streak calculator once so a bad run is not a surprise.'],
  ('Position size calculator', 'position-size-calculator'), ('Losing streak calculator', 'losing-streak-calculator')),
 'crypto-pro-tools': ('Five tools, no sign-up',
  'Find out if you actually have an edge, with your own trades.',
  'Paste your profit and loss numbers and see expectancy, drawdown, streaks and fee drag. It runs in your browser, so your trades never leave your device.',
  [('Journal analyzer', 'Shows whether your results come from skill or from a few lucky trades.'),
   ('Safe leverage finder', 'Finds the leverage where your stop fires before liquidation, after fees and slippage.'),
   ('Challenge odds', 'Simulates thousands of funded-challenge attempts and shows which rule is most likely to fail you.')],
  'Start with the one most people skip',
  ['Open the journal analyzer and press Try sample data.', 'Note the break-even win rate you needed against what you achieved.', 'Paste your own numbers and compare.'],
  ('See all 14 calculators', 'crypto-calculators'), ('How the tools are built', 'editorial-policy')),
 'crypto-backtester': ('Test it before you trust it',
  'Your strategy looked great on one chart. Does it survive another?',
  'A backtest that ignores fees, slippage and unseen data flatters every idea. This one adds the real-world costs and then tries to break the result.',
  [('Costs included', 'Fees, slippage, leverage and liquidation are in the run, so the equity curve is not a fantasy.'),
   ('Out-of-sample check', 'The strategy is tested on data it never saw, which is where most overfitted ideas fall apart.'),
   ('Monte Carlo stress', 'Reshuffling the trades shows how bad a streak could realistically get.')],
  'Run your first test',
  ['Pick a market and timeframe, then choose a simple strategy.', 'Turn on fees and slippage before you press run.', 'Check the out-of-sample result before you believe the equity curve.'],
  ('Practise it in paper trading', 'trade'), ('Stress-test a losing streak', 'losing-streak-calculator')),
 'ebook': ('Why people buy these guides',
  'Skip the expensive part of learning: the losses.',
  'Both books are plain-English, 160-page PDFs written to be finished. They teach risk and process first, because that is what keeps an account alive long enough to learn the rest.',
  [('Crypto Clarity', 'From \u201cwhat is a blockchain?\u201d to security, position sizing and a written plan you can actually follow.'),
   ('Candlestick patterns', 'Every formation explained with what it can and cannot tell you, and an honest look at how often patterns fail.'),
   ('No hype', 'No signals, no get-rich promises and no guaranteed returns. Just how things work and how to protect yourself.')],
  'Not sure yet? Do this first',
  ['Read how the book begins in the free sample on this page.', 'Take lesson 1 of the free course to see the teaching style.', 'Come back for the full guide if it suits you.'],
  ('Start the free course', 'trading-course'), ('Read the glossary', 'glossary')),
 'videos': ('Four short ideas that decide a trade',
  'The concepts that decide whether a trade survives, in motion.',
  'Leverage, the order book, position size and practice are easier to grasp when you can watch the numbers move. Each video is short and each one has a tool to try straight after.',
  [('Watch', 'A short animated explainer for each idea, with no jargon left unexplained.'),
   ('Try', 'Each topic has a matching calculator, or the paper trading account, to practise on.'),
   ('Check', 'The free course has a quiz on each topic if you want to test yourself.')],
  'A good order to watch them',
  ['Start with position sizing and the 1% rule.', 'Then leverage and liquidation, so you know what size can do to you.', 'Finish with the order book and paper trading to practise both.'],
  ('Start with position sizing', 'position-sizing-1-percent-rule-video'), ('Take the free course', 'trading-course')),
 'contact': ('Read by a person',
  'Your message goes to the person who builds this site.',
  'Tell us what broke, what confused you or what you wish existed. A short, specific note is the most useful kind.',
  [('Bug report', 'Say the page, what you did and what you saw. A screenshot helps a lot.'),
   ('Feature idea', 'Describe the problem you are trying to solve, not only the button you want.'),
   ('Correction', 'Spotted a wrong number or an unclear sentence in a guide? Tell us and it gets fixed.')],
  'What makes a message easy to act on',
  ['Name the page or tool.', 'Say what you expected and what happened.', 'Add your browser or device if it looks like a display bug.'],
  ('See what shipped recently', 'releases'), ('Read the editorial policy', 'editorial-policy')),
 'blog': ('Start here',
  'The guides to read first, in a sensible order.',
  'If you read only a few things on this site, read these. They run from \u201cwhat can go wrong\u201d to \u201chow to size it\u201d and need no prior knowledge.',
  [('1. How trades fail', 'Start with why the $1,000-a-day dream fails, then why we never predict prices.'),
   ('2. How to protect yourself', 'Position sizing, stop-loss orders and the risk-reward and win-rate guide.'),
   ('3. How the market works', 'Spot versus futures, funding rates, open interest and the order book.')],
  'A 20-minute reading path',
  ['The $1,000 day trap, then why we do not predict crypto prices.', 'Position sizing and the one percent rule, then stop-loss orders explained.', 'Spot versus futures, then funding rate explained.'],
  ('Read the first guide', '1000-dollar-day-trap'), ('Or learn it as a course', 'trading-course')),
 'releases': ('Still shipping',
  'This site keeps changing, and the changelog says so plainly.',
  'Each release lists what is new, what was fixed and where the data comes from. If something you wanted is missing, tell us.',
  [('Plain entries', 'Sorted into new, fixed and data sources, so you can see what actually changed.'),
   ('Driven by feedback', 'The contact form feeds the roadmap, so your message can end up here.'),
   ('Nothing hidden', 'Behind-the-scenes tweaks are left out so the list stays useful.')],
  'Catch up quickly',
  ['Read the newest entry at the top.', 'Try anything that sounds useful, such as the free course or the risk tools.', 'Send us what you would like to see next.'],
  ('Take the free course', 'trading-course'), ('Suggest a feature', 'contact')),
 'features': ('See it work',
  'A terminal is only as good as the first question it answers.',
  'The best way to judge these features is to use them on a coin you already follow. It takes less time than reading about them.',
  [('Look', 'Live charts and order book depth from Binance spot and futures.'),
   ('Ask', 'An AI desk that explains the move using live data and shows its sources.'),
   ('Practise', 'Paper trading with live prices, plus calculators for every number that matters.')],
  'Take the one-minute tour',
  ['Open the terminal on a coin you follow.', 'Ask the AI desk what is driving it.', 'Open paper trading and place a practice trade with a stop.'],
  ('Launch the terminal', 'app'), ('Take the free course', 'trading-course')),
}

CSS_ID = 'eg2-h'


def render(slug, d):
    eyebrow, head, lead, cards, try_h, steps, (pl, ph), (sl, sh) = d
    card_html = ''.join('<div class="eg2-card"><b aria-hidden="true">0%d</b><h3>%s</h3><p>%s</p></div>' % (i + 1, E(t), E(x)) for i, (t, x) in enumerate(cards))
    step_html = ''.join('<li>%s</li>' % E(s) for s in steps)
    return ('<!-- eg2:start -->\n<section class="eg2" aria-labelledby="%s"><div class="eg2-in">'
            '<span class="mk-eyebrow">%s</span><h2 id="%s">%s</h2><p class="eg2-lead">%s</p>'
            '<div class="eg2-grid">%s</div>'
            '<div class="eg2-try"><div><h3>%s</h3><ol>%s</ol></div>'
            '<div class="eg2-cta"><a class="mk-btn mk-btn-primary" href="%s">%s</a><a class="mk-btn mk-btn-ghost" href="%s">%s</a></div></div>'
            '</div></section>\n<!-- eg2:end -->\n') % (CSS_ID, E(eyebrow), CSS_ID, E(head), E(lead), card_html, E(try_h), step_html, E(ph), E(pl), E(sh), E(sl))


def main():
    done = 0
    for slug, d in PAGES.items():
        p = ROOT / (slug + '.html')
        with open(p, encoding='utf-8', newline='') as f:
            s = f.read()
        crlf = '\r\n' in s
        block = render(slug, d)
        if crlf:
            block = block.replace('\n', '\r\n')
        if '<!-- eg2:start -->' in s:
            s = re.sub(r'<!-- eg2:start -->.*?<!-- eg2:end -->\r?\n', lambda m: block, s, flags=re.S)
        else:
            m = re.search(r'<main[^>]*>', s)
            h = s.find('</header>', m.end()) if m else -1
            if h < 0:
                print('no header in', slug)
                continue
            h += len('</header>')
            nl = '\r\n' if crlf else '\n'
            s = s[:h] + nl + block + s[h:].lstrip('\r\n') if False else s[:h] + nl + block + s[h:]
        if 'css/engage.css' not in s:
            nl = '\r\n' if crlf else '\n'
            s = s.replace('</head>', '<link rel="stylesheet" href="css/engage.css?v=20261128">' + nl + '</head>', 1)
        with open(p, 'w', encoding='utf-8', newline='') as f:
            f.write(s)
        done += 1
    print('blocks written:', done)


main()