#!/usr/bin/env python3
"""Build the free beginner trading course: trading-course.html (hub) + 12 lesson pages.

Content lives in scripts/course_content_a.py and course_content_b.py. Head, nav and footer are
copied from how-to-read-an-order-book.html so the pages match the rest of the site.
Run: python3 scripts/build-course.py && node scripts/build-csp.js
Then: python3 scripts/build-markdown.py, python3 scripts/generate-course-cards.py
"""
import os, re, json, html, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from course_content_a import LESSONS_A
from course_content_b import LESSONS_B

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://cryptobolt.io"
DATE = "2026-11-15"
LESSONS = LESSONS_A + LESSONS_B
TOTAL = len(LESSONS)
HUB = "trading-course"
HUB_TITLE = "Free Trading Course for Beginners (12 Lessons) | CryptoBolt"
HUB_DESC = "A free 12-lesson trading course for absolute beginners: charts, orders, fees, leverage, risk and psychology, with quizzes and a 30-day paper trading plan."
MODULES = {
    1: ("Foundations", "What trading is, how prices form, and how to read a chart."),
    2: ("Placing your first trade", "Order types, the true cost of trading, and why leverage is dangerous."),
    3: ("Protecting your money", "Position sizing, stops, risk-reward and your own psychology."),
    4: ("Building a process", "Simple analysis, a written plan, a journal and a 30-day practice routine."),
}

def read(p):
    with open(os.path.join(ROOT, p), encoding="utf-8") as f:
        return f.read().replace("\r\n", "\n")

def write(p, text):
    with open(os.path.join(ROOT, p), "w", encoding="utf-8", newline="\n") as f:
        f.write(text)

tpl = read("how-to-read-an-order-book.html")
ORG = re.search(r'<script type="application/ld\+json">\s*(\{"@context": "https://schema.org", "@type": "Organization".*?\})\s*</script>', read("ebook.html"), re.S).group(1)
PRE = tpl[: tpl.index("    <!-- ============ Primary SEO")]
FAV = tpl[tpl.index("    <!-- ============ Favicons"): tpl.index("    <!-- ============ Open Graph")]
HEAD_TAIL = tpl[tpl.index('    <link rel="preload" href="/assets/fonts/inter'): tpl.index("</head>")]
HEAD_TAIL = HEAD_TAIL.rstrip() + '\n    <link rel="stylesheet" href="css/course.css?v=20261115">\n'
NAV = tpl[tpl.index('<body class="mk">'): tpl.index('<main id="main"')]
NAV = NAV.replace('<a href="blog" style="color:#eef1f4;" aria-current="page">Blog</a>', '<a href="blog">Blog</a>')
NAV = NAV.replace('<a href="blog">Blog</a>', '<a href="trading-course" style="color:#eef1f4;" aria-current="page">Course</a>\n        <a href="blog">Blog</a>', 2)
FOOT = tpl[tpl.index("</main>") + len("</main>"):]
FOOT = FOOT.replace('<a href="glossary">Glossary</a>', '<a href="trading-course">Free course</a>\n            <a href="glossary">Glossary</a>', 1)
FOOT = FOOT.replace('<script src="js/lang-switcher.js', '<script src="js/course.js?v=20261115" defer></script>\n<script src="js/lang-switcher.js', 1)

GLOSSARY_IDS = set(re.findall(r'id="([a-z0-9-]+)"', read("glossary.html")))
PAGES_OK = {f[:-5] for f in os.listdir(ROOT) if f.endswith(".html")} | {s["slug"] for s in LESSONS} | {HUB}

def esc(s): return html.escape(s, quote=True)

def fix_links(s):
    s = re.sub(r"\[\[([a-z0-9-]+)\|([^\]]+)\]\]", lambda m: f'<a href="glossary#{m.group(1)}">{m.group(2)}</a>', s)
    for m in re.finditer(r'href="glossary#([a-z0-9-]+)"', s):
        assert m.group(1) in GLOSSARY_IDS, "unknown glossary id " + m.group(1)
    for m in re.finditer(r'href="([a-z0-9-]+)(?:#[a-z0-9-]+)?"', s):
        assert m.group(1) in PAGES_OK, "unknown page " + m.group(1)
    return s

def field(i, label, value, step="any", mn=None, mx=None, suffix=""):
    a = f' min="{mn}"' if mn is not None else ""
    a += f' max="{mx}"' if mx is not None else ""
    return (f'<div class="cc-field"><label for="{i}">{label}</label>'
            f'<span class="cc-input"><input id="{i}" type="number" inputmode="decimal" step="{step}"{a} value="{value}" data-f="{i.split("-",1)[1]}">{suffix}</span></div>')

def out(key, label):
    return f'<div class="cc-res"><span class="cc-res-l">{label}</span><strong data-out="{key}">-</strong></div>'

def widget(name):
    if name == "candle":
        return ('<div class="cc-tool" data-tool="candle" aria-label="Candle builder">'
                '<div class="cc-tool-grid"><div class="cc-fields">'
                + field("cd-o", "Open", 100) + field("cd-h", "High", 108) + field("cd-l", "Low", 99) + field("cd-c", "Close", 106) +
                '</div><div class="cc-viz"><svg viewBox="0 0 160 240" class="cc-candle-svg" role="img" aria-label="Candle drawn from the numbers you entered" data-candle></svg>'
                '<p class="cc-msg" data-out="msg" role="status" aria-live="polite"></p></div></div></div>')
    if name == "cost":
        return ('<div class="cc-tool" data-tool="cost"><div class="cc-fields">'
                + field("co-size", "Trade size ($)", 1000, mn=0) + field("co-fee", "Fee per side (%)", 0.1, 0.01, 0) + field("co-spread", "Spread (%)", 0.05, 0.01, 0) + field("co-slip", "Slippage per side (%)", 0.02, 0.01, 0) +
                '</div><div class="cc-results">' + out("cost", "Cost of one round trip") + out("be", "Price must move just to break even") + out("day", "Cost of 10 round trips") + '</div></div>')
    if name == "leverage":
        return ('<div class="cc-tool" data-tool="leverage"><div class="cc-fields">'
                + field("lv-margin", "Your margin ($)", 100, mn=0) + field("lv-lev", "Leverage (x)", 10, 1, 1, 125) + field("lv-entry", "Entry price", 100, mn=0) +
                '<div class="cc-field"><label for="lv-dir">Direction</label><span class="cc-input"><select id="lv-dir" data-f="dir"><option value="long">Long (bet on a rise)</option><option value="short">Short (bet on a fall)</option></select></span></div>'
                '</div><div class="cc-results">' + out("pos", "Position size") + out("liq", "Approx. liquidation price") + out("dist", "Move against you that wipes the margin") + out("up", "If price moves 5% your way") + out("down", "If price moves 5% against you") + '</div></div>')
    if name == "size":
        return ('<div class="cc-tool" data-tool="size"><div class="cc-fields">'
                + field("sz-acct", "Account size ($)", 1000, mn=0) + field("sz-risk", "Risk per trade (%)", 1, 0.1, 0.1, 100) + field("sz-entry", "Entry price", 100, mn=0) + field("sz-stop", "Stop price", 95, mn=0) +
                '</div><div class="cc-results">' + out("risk", "Money at risk") + out("rpc", "Risk per coin") + out("size", "Position size (coins)") + out("val", "Position value") + '</div>'
                '<p class="cc-msg" data-out="msg" role="status" aria-live="polite"></p></div>')
    if name == "rr":
        return ('<div class="cc-tool" data-tool="rr"><div class="cc-fields">'
                + field("rr-entry", "Entry price", 100, mn=0) + field("rr-stop", "Stop price", 95, mn=0) + field("rr-target", "Target price", 115, mn=0) + field("rr-win", "Your win rate (%)", 40, 1, 0, 100) +
                '</div><div class="cc-results">' + out("risk", "Risk per coin") + out("reward", "Reward per coin") + out("rr", "Risk-reward") + out("be", "Break-even win rate") + out("exp", "Expectancy per trade") + '</div>'
                '<p class="cc-msg" data-out="msg" role="status" aria-live="polite"></p></div>')
    if name == "plan":
        items = [("markets", "Markets I trade (1 to 3 pairs)", "BTC/USDT and ETH/USDT, spot only"),
                 ("timeframes", "Timeframes (trend chart, entry chart)", "Daily for trend, 1-hour for entries"),
                 ("setup", "My setup: what must be true to enter", "Trend up on the daily chart, price pulling back to a support zone"),
                 ("entry", "How I enter", "Limit order near support, never a market order chasing a candle"),
                 ("stop", "Where my stop goes", "Just below the support zone, set the moment I enter"),
                 ("target", "Where I take profit (minimum reward-to-risk)", "Next resistance, only if reward is at least 2 times the risk"),
                 ("risk", "My risk limits", "1% per trade, stop for the day after 2 losses or 2% down"),
                 ("notrade", "When I do not trade", "Tired, upset, in a rush, no clear setup, or after my daily limit")]
        rows = "".join(f'<div class="cc-field cc-field-wide"><label for="pl-{k}">{lbl}</label><textarea id="pl-{k}" rows="2" data-plan-field="{k}" placeholder="{esc(ph)}"></textarea></div>' for k, lbl, ph in items)
        return f'<div class="cc-tool cc-plan" data-tool="plan">{rows}<div class="cc-actions"><button type="button" class="mk-btn mk-btn-primary" data-plan-copy>Copy my plan</button><button type="button" class="mk-btn mk-btn-ghost" data-plan-clear>Clear</button><span class="cc-msg" data-out="msg" role="status" aria-live="polite"></span></div></div>'
    if name == "checklist":
        items = ["I followed my risk rule (about 1% per trade) on every paper trade.",
                 "I used a stop on every trade and never moved it farther away.",
                 "My biggest loss was close to the 1R I planned, with no surprises.",
                 "I stayed inside my daily loss limit.",
                 "I wrote a journal entry, with a screenshot, for every trade.",
                 "I made at least 30 paper trades under the same rules.",
                 "I can explain leverage and liquidation to someone else in my own words.",
                 "I know what I can afford to lose, and I will never risk money I need."]
        li = "".join(f'<li><label class="cc-check" for="ck-{i}"><input type="checkbox" id="ck-{i}" data-save-check="ck-{i}"><span>{t}</span></label></li>' for i, t in enumerate(items))
        return f'<div class="cc-tool" data-tool="checklist"><ul class="cc-checklist">{li}</ul><p class="cc-msg" data-out="msg" role="status" aria-live="polite"></p></div>'
    raise KeyError(name)

FIG_CANDLE = '''<figure class="cc-fig"><svg viewBox="0 0 520 260" role="img" aria-labelledby="fig-candle-t"><title id="fig-candle-t">Anatomy of an up candle and a down candle, showing open, high, low and close</title>
<g font-size="13" fill="#cbd3da" font-family="Inter, system-ui, sans-serif">
<text x="110" y="16" text-anchor="middle" fill="#14d38a" font-weight="600">Up candle (close above open)</text>
<line x1="110" y1="30" x2="110" y2="232" stroke="#14d38a" stroke-width="3"/><rect x="88" y="85" width="44" height="90" rx="3" fill="#14d38a"/>
<g stroke="#5b6472" stroke-dasharray="3 3"><line x1="114" y1="30" x2="170" y2="30"/><line x1="136" y1="85" x2="170" y2="85"/><line x1="136" y1="175" x2="170" y2="175"/><line x1="114" y1="232" x2="170" y2="232"/></g>
<text x="176" y="34">High: the top of the upper wick</text><text x="176" y="89">Close: where the period ended</text><text x="176" y="179">Open: where the period began</text><text x="176" y="236">Low: the bottom of the lower wick</text>
<text x="40" y="135" text-anchor="end">Body</text><text x="64" y="58" text-anchor="end">Wick</text>
</g></svg>
<svg viewBox="0 0 520 260" role="img" aria-labelledby="fig-candle2-t" style="margin-top:8px"><title id="fig-candle2-t">A down candle: the open is at the top of the body and the close at the bottom</title>
<g font-size="13" fill="#cbd3da" font-family="Inter, system-ui, sans-serif">
<text x="110" y="16" text-anchor="middle" fill="#ff4d6a" font-weight="600">Down candle (close below open)</text>
<line x1="110" y1="30" x2="110" y2="232" stroke="#ff4d6a" stroke-width="3"/><rect x="88" y="70" width="44" height="110" rx="3" fill="#ff4d6a"/>
<g stroke="#5b6472" stroke-dasharray="3 3"><line x1="114" y1="30" x2="170" y2="30"/><line x1="136" y1="70" x2="170" y2="70"/><line x1="136" y1="180" x2="170" y2="180"/><line x1="114" y1="232" x2="170" y2="232"/></g>
<text x="176" y="34">High</text><text x="176" y="74">Open: the top of the body</text><text x="176" y="184">Close: the bottom of the body</text><text x="176" y="236">Low</text>
</g></svg>
<figcaption>Same four prices, different story: the colour tells you whether price closed above or below where it opened.</figcaption></figure>'''

FIG_BOOK = '''<figure class="cc-fig"><svg viewBox="0 0 520 300" role="img" aria-labelledby="fig-book-t"><title id="fig-book-t">A small order book: sell orders (asks) above, buy orders (bids) below, with the spread between them</title>
<g font-size="13" font-family="Inter, system-ui, sans-serif" fill="#cbd3da">
<text x="12" y="18" fill="#929aa8">Price</text><text x="110" y="18" fill="#929aa8">Size waiting</text>
<rect x="12" y="28" width="150" height="26" rx="3" fill="rgba(255,77,106,.28)"/><text x="20" y="46" fill="#ff8a9d">100.30</text><text x="120" y="46">5</text>
<rect x="12" y="58" width="90" height="26" rx="3" fill="rgba(255,77,106,.28)"/><text x="20" y="76" fill="#ff8a9d">100.20</text><text x="120" y="76">3</text>
<rect x="12" y="88" width="60" height="26" rx="3" fill="rgba(255,77,106,.45)"/><text x="20" y="106" fill="#ff8a9d">100.10</text><text x="120" y="106">2</text>
<text x="12" y="138" fill="#ffb020" font-weight="600">Spread: 0.10</text>
<rect x="12" y="150" width="120" height="26" rx="3" fill="rgba(20,211,138,.45)"/><text x="20" y="168" fill="#5eead4">100.00</text><text x="120" y="168">4</text>
<rect x="12" y="180" width="170" height="26" rx="3" fill="rgba(20,211,138,.28)"/><text x="20" y="198" fill="#5eead4">99.90</text><text x="120" y="198">6</text>
<rect x="12" y="210" width="90" height="26" rx="3" fill="rgba(20,211,138,.28)"/><text x="20" y="228" fill="#5eead4">99.80</text><text x="120" y="228">3</text>
<g stroke="#5b6472" stroke-dasharray="3 3"><line x1="200" y1="101" x2="250" y2="101"/><line x1="200" y1="163" x2="250" y2="163"/></g>
<text x="256" y="97" fill="#ff8a9d" font-weight="600">Best ask: 100.10</text><text x="256" y="114">You BUY here if you buy instantly</text>
<text x="256" y="159" fill="#5eead4" font-weight="600">Best bid: 100.00</text><text x="256" y="176">You SELL here if you sell instantly</text>
<text x="256" y="46" fill="#929aa8">Asks: people waiting to sell</text><text x="256" y="206" fill="#929aa8">Bids: people waiting to buy</text>
</g></svg><figcaption>Illustrative numbers. The cheapest ask and the highest bid are the two prices that matter for an instant trade.</figcaption></figure>'''

def render_body(s):
    b = s["body"]
    b = b.replace("<!--FIG:candle-->", FIG_CANDLE).replace("<!--FIG:book-->", FIG_BOOK)
    b = re.sub(r"<!--WIDGET:([a-z]+)-->", lambda m: widget(m.group(1)), b)
    return fix_links(b)

def plain(m):
    # bare header/section element rules in styles.css restyle these tags, so use divs with ARIA instead
    m = re.sub(r'<(header|section)( [^>]*)?>', lambda x: '<div' + (x.group(2) or '') + (' role="region"' if x.group(1) == 'section' and 'aria-labelledby' in (x.group(2) or '') else '') + '>', m)
    return m.replace('</header>', '</div>').replace('</section>', '</div>')

def text_len(s): return len(re.sub(r"<[^>]+>", " ", s).split())

def head(title, desc, path, og_img, og_type, jsonld, keywords):
    url = f"{SITE}/{path}" if path else SITE + "/"
    blocks = "".join(f'    <script type="application/ld+json">\n    {json.dumps(j, ensure_ascii=False)}\n    </script>\n' for j in jsonld)
    blocks += f'    <script type="application/ld+json">\n    {ORG}\n    </script>\n'
    return (PRE +
f'''    <!-- ============ Primary SEO ============ -->
    <title>{esc(title)}</title>
    <meta name="description" content="{esc(desc)}">
    <meta name="keywords" content="{esc(keywords)}">
    <meta name="author" content="CryptoBolt">
    <meta name="robots" content="index, follow, max-image-preview:large">
    <link rel="canonical" href="{url}">
    <link rel="alternate" type="text/markdown" href="{SITE}/md/{path}.md">
    <link rel="alternate" hreflang="en" href="{url}">
    <link rel="alternate" hreflang="x-default" href="{url}">

''' + FAV +
f'''    <!-- ============ Open Graph ============ -->
    <meta property="og:type" content="{og_type}">
    <meta property="og:site_name" content="CryptoBolt">
    <meta property="og:url" content="{url}">
    <meta property="og:title" content="{esc(title.replace(" | CryptoBolt", ""))}">
    <meta property="og:description" content="{esc(desc)}">
    <meta property="og:image" content="{SITE}/assets/og/{og_img}.png">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="CryptoBolt free trading course: {esc(title.replace(" | CryptoBolt", ""))}">
    <meta property="og:locale" content="en_US">

    <!-- ============ Twitter / X Card ============ -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:site" content="@cryptobolt5fvj">
    <meta name="twitter:creator" content="@cryptobolt5fvj">
    <meta name="twitter:title" content="{esc(title.replace(" | CryptoBolt", ""))}">
    <meta name="twitter:description" content="{esc(desc)}">
    <meta name="twitter:image" content="{SITE}/assets/og/{og_img}.png">
    <meta name="twitter:image:alt" content="CryptoBolt free trading course: {esc(title.replace(" | CryptoBolt", ""))}">

    <!-- ============ Structured data (JSON-LD) ============ -->
''' + blocks + "\n" + HEAD_TAIL + "</head>\n")

PROVIDER = {"@type": "Organization", "name": "CryptoBolt", "url": SITE + "/"}
COURSE_REF = {"@type": "Course", "name": "Trading for Absolute Beginners", "url": f"{SITE}/{HUB}", "provider": PROVIDER}

def crumbs(items):
    return {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "name": n, "item": u} for i, (n, u) in enumerate(items)]}

def side(cur):
    rows = ""
    for m, (mt, _) in MODULES.items():
        rows += f'<p class="cc-side-mod">{mt}</p><ol class="cc-side-list">'
        for s in LESSONS:
            if s["module"] != m: continue
            n = LESSONS.index(s) + 1
            c = ' aria-current="page"' if s["slug"] == cur else ""
            rows += f'<li><a href="{s["slug"]}" data-lesson-link="{s["slug"]}"{c}><span class="cc-side-n">{n}</span><span class="cc-side-t">{s["title"].split(":")[0] if len(s["title"])>46 else s["title"]}</span><span class="cc-tick" aria-hidden="true"></span></a></li>'
        rows += "</ol>"
    return f'<aside class="cc-side" aria-label="Course map"><details class="cc-side-box" open><summary>Course map</summary><div data-progress-wrap><div class="cc-bar" role="progressbar" aria-label="Course progress" aria-valuemin="0" aria-valuemax="{TOTAL}" aria-valuenow="0" data-progress-bar><i></i></div><p class="cc-bar-t" data-progress-text>0 of {TOTAL} lessons complete</p></div>{rows}<p class="cc-side-foot"><a href="{HUB}">Course overview</a></p></details></aside>'

def quiz(s):
    qs = ""
    for i, (q, opts, ans, why) in enumerate(s["quiz"]):
        k = (i * 3 + LESSONS.index(s)) % len(opts)  # rotate so correct answers are not always in the same slot
        opts = opts[k:] + opts[:k]; ans = (ans - k) % len(opts)
        o = "".join(f'<label class="cc-opt" for="q{i}-{j}"><input type="radio" id="q{i}-{j}" name="q{i}" value="{j}"><span>{esc(t)}</span></label>' for j, t in enumerate(opts))
        qs += f'<fieldset class="cc-q" data-answer="{ans}"><legend>{i+1}. {esc(q)}</legend>{o}<p class="cc-explain" hidden>{esc(why)}</p></fieldset>'
    return (f'<section class="cc-quiz" data-quiz aria-labelledby="quiz-h"><h2 id="quiz-h">Check your understanding</h2><p>Four quick questions. Wrong answers are fine: the explanation is where you learn.</p>{qs}'
            '<div class="cc-actions"><button type="button" class="mk-btn mk-btn-primary" data-quiz-check>Check answers</button><button type="button" class="mk-btn mk-btn-ghost" data-quiz-reset hidden>Try again</button><p class="cc-score" data-quiz-score role="status" aria-live="polite"></p></div></section>')

def lesson_page(idx, s):
    n = idx + 1
    mt = MODULES[s["module"]][0]
    prev = LESSONS[idx - 1] if idx > 0 else None
    nxt = LESSONS[idx + 1] if idx < TOTAL - 1 else None
    body = render_body(s)
    take = "".join(f"<li>{esc(t)}</li>" for t in s["takeaways"])
    words = text_len(body) + text_len(s["tryit"]) + sum(text_len(q[0] + " ".join(q[1]) + q[3]) for q in s["quiz"])
    jl = [{"@context": "https://schema.org", "@type": "Article", "headline": s["title"], "description": s["desc"],
           "url": f"{SITE}/{s['slug']}", "mainEntityOfPage": {"@type": "WebPage", "@id": f"{SITE}/{s['slug']}"},
           "image": f"{SITE}/assets/og/{s['slug']}.png", "datePublished": DATE, "dateModified": DATE, "wordCount": words,
           "educationalLevel": "Beginner", "learningResourceType": "Lesson", "timeRequired": f"PT{s['minutes']}M",
           "isAccessibleForFree": True, "inLanguage": "en", "position": n, "isPartOf": COURSE_REF,
           "author": PROVIDER, "publisher": {**PROVIDER, "logo": {"@type": "ImageObject", "url": SITE + "/assets/android-chrome-512.png"}}},
          crumbs([("CryptoBolt", SITE + "/"), ("Free trading course", f"{SITE}/{HUB}"), (s["title"], f"{SITE}/{s['slug']}")])]
    kw = f"trading for beginners, {s['title'].lower()}, beginner trading course, learn trading, crypto trading lesson"
    title = f"{s['title']} | CryptoBolt Course"
    if len(title) > 60: title = f"{s['title']} | CryptoBolt"
    if len(title) > 60: title = s["title"]
    navbtn = ""
    if prev: navbtn += f'<a class="cc-nav-prev" href="{prev["slug"]}"><span>Previous</span>{esc(prev["title"])}</a>'
    else: navbtn += f'<a class="cc-nav-prev" href="{HUB}"><span>Back to</span>Course overview</a>'
    if nxt: navbtn += f'<a class="cc-nav-next" href="{nxt["slug"]}" data-next-lesson><span>Next lesson</span>{esc(nxt["title"])}</a>'
    else: navbtn += f'<a class="cc-nav-next" href="crypto-calculators"><span>Course finished. Next</span>Use the free calculators</a>'
    main = f'''<main id="main" tabindex="-1">
<div class="cc-wrap">
<nav class="cc-crumbs" aria-label="Breadcrumb"><a href="/">CryptoBolt</a> <span aria-hidden="true">/</span> <a href="{HUB}">Free trading course</a> <span aria-hidden="true">/</span> <span>Lesson {n}</span></nav>
<div class="cc-layout">
{side(s["slug"])}
<article class="cc-lesson" data-lesson="{s['slug']}" data-index="{n}">
<header class="cc-head">
<p class="cc-kicker">{mt}. Lesson {n} of {TOTAL}. About {s['minutes']} minutes.</p>
<h1>{esc(s['title'])}</h1>
<p class="cc-goal"><strong>By the end of this lesson:</strong> {esc(s['goal'])}</p>
</header>
<div class="mk-article cc-article">
{body}
</div>
<section class="cc-take" aria-labelledby="take-h"><h2 id="take-h">What to remember</h2><ul>{take}</ul></section>
<div class="mk-callout mk-callout-try-it cc-try" role="note"><strong>Try it:</strong> {fix_links(s['tryit'])}</div>
{quiz(s)}
<div class="cc-done"><button type="button" class="mk-btn mk-btn-primary" data-complete aria-pressed="false">Mark lesson complete</button><p class="cc-msg" data-complete-msg role="status" aria-live="polite">Your progress is saved in this browser only.</p></div>
<nav class="cc-pager" aria-label="Lesson navigation">{navbtn}</nav>
<p class="cc-disc">Educational content only, not financial advice. Trading carries a high risk of loss. Examples use made-up numbers. See our <a href="editorial-policy">editorial policy</a>.</p>
</article>
</div>
</div>
</main>
'''
    return head(title, s["desc"], s["slug"], s["slug"], "article", jl, kw) + NAV + plain(main) + FOOT

def hub_page():
    total_min = sum(s["minutes"] for s in LESSONS)
    hours = f"{total_min/60:.1f}".rstrip("0").rstrip(".")
    mods = ""
    for m, (mt, md) in MODULES.items():
        rows = ""
        for s in LESSONS:
            if s["module"] != m: continue
            n = LESSONS.index(s) + 1
            rows += (f'<li><a class="cc-row" href="{s["slug"]}" data-lesson-card="{s["slug"]}"><span class="cc-row-n">{n}</span>'
                     f'<span class="cc-row-b"><strong>{esc(s["title"])}</strong><span>{esc(s["goal"])}</span></span>'
                     f'<span class="cc-row-m">{s["minutes"]} min</span><span class="cc-tick" aria-hidden="true"></span></a></li>')
        mods += f'<section class="cc-mod" aria-labelledby="mod{m}"><div class="cc-mod-h"><h3 id="mod{m}">{mt}</h3><p>{md}</p></div><ol class="cc-rows">{rows}</ol></section>'
    faqs = [
        ("Is the course really free?", "Yes. All twelve lessons, quizzes and tools are free, with no sign-up. Your progress is saved in your own browser, not on our servers."),
        ("Do I need any experience or money?", "No. The course assumes you know nothing about trading. You practise with virtual money in paper trading, so you do not need to deposit anything."),
        ("Will this course make me profitable?", "No course can promise that, and we do not. Most beginners lose money. This course teaches the habits that protect your account while you learn: risk control, planning and record keeping."),
        ("Is this about crypto only?", "The examples and tools use crypto because that is what CryptoBolt covers, but the ideas (orders, costs, risk, position sizing, psychology) apply to any market."),
        ("How long does it take?", f"About {hours} hours of reading in total, plus the practice exercises. Then a 30-day paper trading plan to put it into action. You can go at your own pace."),
        ("Is this financial advice?", "No. It is educational content. Trading carries a high risk of loss, so only risk money you can afford to lose, and speak to a licensed professional about your own situation."),
    ]
    fq = "".join(f'<details class="cc-faq"><summary>{esc(q)}</summary><p>{esc(a)}</p></details>' for q, a in faqs)
    jl = [
        {"@context": "https://schema.org", "@type": "Course", "name": "Trading for Absolute Beginners", "description": HUB_DESC,
         "url": f"{SITE}/{HUB}", "provider": PROVIDER, "educationalLevel": "Beginner", "inLanguage": "en", "isAccessibleForFree": True,
         "image": f"{SITE}/assets/og/{HUB}.png",
         "teaches": ["Reading candlestick charts", "Market, limit and stop orders", "Trading costs", "Leverage and liquidation", "Position sizing", "Risk-reward", "Trading psychology", "Writing a trading plan"],
         "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD", "category": "Free"},
         "hasCourseInstance": {"@type": "CourseInstance", "courseMode": "online", "courseWorkload": f"PT{round(total_min/60)}H"},
         "hasPart": [{"@type": "Article", "name": s["title"], "url": f"{SITE}/{s['slug']}", "position": i + 1} for i, s in enumerate(LESSONS)]},
        {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faqs]},
        crumbs([("CryptoBolt", SITE + "/"), ("Free trading course", f"{SITE}/{HUB}")]),
    ]
    main = f'''<main id="main" tabindex="-1">
<header class="cc-hero">
<div class="cc-hero-in">
<span class="mk-eyebrow">Free course</span>
<h1>Trading for absolute beginners</h1>
<p class="cc-lead">Twelve short lessons that take you from "what is a candle?" to a written trading plan and a 30-day practice routine. No jargon without an explanation, no get-rich promises, and no money at risk.</p>
<div class="cc-hero-cta"><a class="mk-btn mk-btn-primary" href="{LESSONS[0]['slug']}" data-start-link>Start lesson 1</a><a class="mk-btn mk-btn-ghost" href="trade">Open paper trading</a></div>
<div class="cc-hero-progress" data-progress-wrap><div class="cc-bar" role="progressbar" aria-label="Course progress" aria-valuemin="0" aria-valuemax="{TOTAL}" aria-valuenow="0" data-progress-bar><i></i></div><p class="cc-bar-t" data-progress-text>0 of {TOTAL} lessons complete</p></div>
</div>
<dl class="cc-facts"><div><dt>Lessons</dt><dd>{TOTAL}</dd></div><div><dt>Reading time</dt><dd>about {hours} h</dd></div><div><dt>Quizzes</dt><dd>{TOTAL * 4} questions</dd></div><div><dt>Cost</dt><dd>Free</dd></div></dl>
</header>
<div class="cc-wrap">
<section class="cc-sec" aria-labelledby="how-h"><h2 id="how-h">How each lesson works</h2>
<ol class="cc-how"><li><strong>Read.</strong> Short sections, plain words, examples with simple numbers.</li><li><strong>Play.</strong> Several lessons have a tool: build a candle, size a trade, find a liquidation price.</li><li><strong>Practise.</strong> Each lesson ends with a small exercise in the terminal or paper trading.</li><li><strong>Check.</strong> A four-question quiz with an explanation for every answer.</li></ol></section>
<section class="cc-sec" aria-labelledby="cur-h"><h2 id="cur-h">The curriculum</h2>
{mods}</section>
<section class="cc-sec cc-honest" aria-labelledby="hon-h"><h2 id="hon-h">What this course will and will not do</h2>
<div class="cc-two"><div><h3>It will</h3><ul><li>Teach you the vocabulary and mechanics so nothing on a trading screen is a mystery.</li><li>Show you how costs, leverage and position size really affect an account.</li><li>Give you a plan, a journal and a safe way to practise.</li></ul></div>
<div><h3>It will not</h3><ul><li>Give you signals, predictions or a "secret strategy".</li><li>Promise profits. Most beginners lose money, and that is why risk comes first here.</li><li>Replace advice from a licensed professional about your own finances.</li></ul></div></div></section>
<section class="cc-sec" aria-labelledby="faq-h"><h2 id="faq-h">Common questions</h2><div class="cc-faqs">{fq}</div></section>
<section class="cc-sec" aria-labelledby="more-h"><h2 id="more-h">Tools to use alongside the course</h2>
<div class="cc-links"><a href="trade"><strong>Paper trading</strong><span>Practise with virtual money and real prices.</span></a><a href="crypto-calculators"><strong>Free calculators</strong><span>Position size, risk-reward, liquidation and more.</span></a><a href="glossary"><strong>Glossary</strong><span>Plain-English definitions of every term.</span></a><a href="ebook"><strong>Crypto Clarity ebook</strong><span>160 pages if you want to go deeper.</span></a></div></section>
<p class="cc-disc">Educational content only, not financial advice. Trading carries a high risk of loss. Read how we write and review our guides in the <a href="editorial-policy">editorial policy</a>.</p>
</div>
</main>
'''
    return head(HUB_TITLE, HUB_DESC, HUB, HUB, "website", jl, "trading course for beginners, free trading course, learn to trade, how to start trading, crypto trading for beginners, trading basics") + NAV + plain(main) + FOOT

def sitemap_and_llms():
    sm = read("sitemap.xml")
    entries = ""
    for slug, pr in [(HUB, "0.8")] + [(s["slug"], "0.7") for s in LESSONS]:
        loc = f"{SITE}/{slug}"
        if f"<loc>{loc}</loc>" in sm: continue
        entries += f"  <url>\n    <loc>{loc}</loc>\n    <lastmod>{DATE}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>{pr}</priority>\n  </url>\n"
    if entries:
        sm = sm.replace("</urlset>", entries + "</urlset>")
        write("sitemap.xml", sm)
    ll = read("llms.txt")
    if f"{SITE}/{HUB})" not in ll:
        block = f"- [Free Trading Course for Beginners]({SITE}/{HUB}) — Twelve free lessons for absolute beginners: charts, order types, costs, leverage, position sizing, risk-reward, psychology, a trading plan and a 30-day paper trading routine.\n"
        for s in LESSONS:
            block += f"  - [{s['title']}]({SITE}/{s['slug']})\n"
        ll = ll.replace("- [Crypto Trading Glossary]", block + "- [Crypto Trading Glossary]", 1)
        write("llms.txt", ll)

if __name__ == "__main__":
    write(HUB + ".html", hub_page())
    for i, s in enumerate(LESSONS):
        write(s["slug"] + ".html", lesson_page(i, s))
    sitemap_and_llms()
    print("built", TOTAL + 1, "pages")