#!/usr/bin/env python3
"""Wire the course certificate and the site-wide engagement layer into the static pages.
Idempotent: safe to re-run. Run from the project root:  python3 scripts/add-certificate.py
 - every public page that loads js/live.js also loads js/engage.js (course chip + course band)
 - glossary page/template also load js/glossary-game.js
 - trading-course.html gets the certificate section, a new title/description, a FAQ and schema
 - each lesson page gets the "your certificate" progress panel
"""
import json, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent.parent
V = '20261126'
LESSONS = ['course-what-is-trading', 'course-how-markets-work', 'course-how-to-read-candlestick-charts', 'course-order-types',
           'course-trading-costs', 'course-leverage-for-beginners', 'course-position-sizing', 'course-stop-loss-and-risk-reward',
           'course-trading-psychology', 'course-trend-support-resistance', 'course-trading-plan-and-journal', 'course-first-30-days']


def rd(p):
    with open(ROOT / p, encoding='utf-8', newline='') as f:
        return f.read()


def wr(p, s):
    with open(ROOT / p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)


def add_after_script(s, after_name, tag_src, extra_attr=' defer'):
    """Insert <script src=tag_src> on the line after the script that loads after_name. Keeps the file's line endings."""
    if tag_src.split('?')[0] in s:
        return s, False
    m = re.search(r'<script[^>]*src="' + re.escape(after_name) + r'[^"]*"[^>]*></script>(\r?\n)', s)
    if not m:
        return s, False
    nl = m.group(1)
    return s[:m.end()] + '<script src="%s"%s></script>%s' % (tag_src, extra_attr, nl) + s[m.end():], True


# ---------------------------------------------------------------- 1. engage.js on public pages
changed = []
targets = sorted(ROOT.glob('*.html')) + sorted((ROOT / 'templates').glob('*.html'))
for p in targets:
    s = rd(p)
    if 'js/live.js' not in s:
        continue
    s2, ok = add_after_script(s, 'js/live.js', 'js/engage.js?v=' + V)
    if p.name in ('glossary.html', 'glossary-template.html'):
        s2, ok2 = add_after_script(s2, 'js/engage.js', 'js/glossary-game.js?v=' + V)
        ok = ok or ok2
    if ok:
        wr(p, s2)
        changed.append(p.name)
print('engage tags added to', len(changed), 'files')

# ---------------------------------------------------------------- 2. hub page
CERT_SECTION = '''<!-- cert:start -->
<section class="cert" id="certificate" aria-labelledby="cert-h" data-cert>
<div class="cert-copy">
<span class="mk-eyebrow">Certificate of completion</span>
<h2 id="cert-h">Finish the course. Earn your certificate.</h2>
<p>Mark all twelve lessons complete and you can generate a personal certificate with your name, the date and a unique ID. Download it as an image or a PDF, print it, or share it. Score 90% or more across all twelve quizzes and it carries the With Distinction seal.</p>
<ol class="cert-dots" data-cert-dots aria-label="Lesson checklist"></ol>
<p class="cert-status" data-cert-status role="status" aria-live="polite">Your certificate unlocks when all 12 lessons are marked complete.</p>
<div class="cert-form" data-cert-form>
<div class="cert-row"><div><label for="cert-name">Name on the certificate</label><input id="cert-name" type="text" maxlength="40" autocomplete="name" placeholder="Your full name" data-cert-name disabled></div>
<div><label for="cert-theme">Style</label><select id="cert-theme" data-cert-theme disabled><option value="dark">Dark</option><option value="light">Light (print-friendly)</option></select></div></div>
<div class="cert-acts"><button type="button" class="mk-btn mk-btn-primary" data-act="png" disabled>Download PNG</button><button type="button" class="mk-btn mk-btn-ghost" data-act="pdf" disabled>Download PDF</button><button type="button" class="mk-btn mk-btn-ghost" data-act="print" disabled>Print</button><button type="button" class="mk-btn mk-btn-ghost" data-act="x" disabled>Share on X</button><button type="button" class="mk-btn mk-btn-ghost" data-act="li" disabled>Share on LinkedIn</button></div>
<p class="cert-msg" data-cert-msg role="status" aria-live="polite"></p>
</div>
<p class="cert-badges-h">Your badges</p>
<ul class="cert-badges" data-cert-badges></ul>
<p class="cert-fine">The certificate is created in your browser from the progress saved here. CryptoBolt does not store your name, and a certificate cannot be verified by a third party. It is a personal record of study, not an accredited qualification or financial advice.</p>
</div>
<div class="cert-stage"><canvas width="1600" height="1131" data-cert-canvas role="img" aria-label="Preview of your certificate of completion"></canvas>
<div class="cert-lock" data-cert-lock><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>Locked<span>Complete all 12 lessons to unlock your certificate.</span></div></div>
</section>
<!-- cert:end -->
'''

NEW_TITLE = 'Free Trading Course with Certificate | CryptoBolt'
NEW_OG_TITLE = 'Free Trading Course with Certificate (12 Lessons)'
NEW_DESC = 'Free 12-lesson trading course for beginners: charts, orders, fees, leverage and risk, with quizzes, a 30-day plan and a certificate when you finish.'
assert len(NEW_DESC) <= 160, len(NEW_DESC)
FAQ_Q = 'Do I get a certificate?'
FAQ_A = ('Yes. Mark all twelve lessons complete and you can download a personal certificate of completion as a PNG or PDF. '
         'Score 90% or more across all twelve quizzes for the With Distinction version. It is a record of your study, not an accredited qualification.')


def patch_hub():
    p = ROOT / 'trading-course.html'
    s = rd(p)
    # head: title, description, social tags
    s = re.sub(r'<title>[^<]*</title>', '<title>' + NEW_TITLE + '</title>', s, 1)
    for pat in (r'(<meta name="description" content=")[^"]*(")', r'(<meta property="og:description" content=")[^"]*(")', r'(<meta name="twitter:description" content=")[^"]*(")'):
        s = re.sub(pat, lambda m: m.group(1) + NEW_DESC + m.group(2), s, 1)
    for pat in (r'(<meta property="og:title" content=")[^"]*(")', r'(<meta name="twitter:title" content=")[^"]*(")'):
        s = re.sub(pat, lambda m: m.group(1) + NEW_OG_TITLE + m.group(2), s, 1)
    s = re.sub(r'(CryptoBolt free trading course: )[^"]*(")', lambda m: m.group(1) + NEW_OG_TITLE + m.group(2), s)
    if 'trading course with certificate' not in s:
        s = re.sub(r'(<meta name="keywords" content=")', r'\1trading course with certificate, free trading certificate, ', s, 1)

    # JSON-LD
    def fix_ld(m):
        raw = m.group(2)
        try:
            d = json.loads(raw)
        except ValueError:
            return m.group(0)
        if d.get('@type') == 'Course':
            d['description'] = NEW_DESC
            d['educationalCredentialAwarded'] = 'Certificate of completion'
        if d.get('@type') == 'FAQPage' and not any(q.get('name') == FAQ_Q for q in d['mainEntity']):
            d['mainEntity'].insert(1, {'@type': 'Question', 'name': FAQ_Q, 'acceptedAnswer': {'@type': 'Answer', 'text': FAQ_A}})
        return m.group(1) + json.dumps(d, ensure_ascii=False) + m.group(3)
    s = re.sub(r'(<script type="application/ld\+json">\s*)(.*?)(\s*</script>)', fix_ld, s, flags=re.S)

    # visible FAQ
    if FAQ_Q not in s.split('<div class="cc-faqs">', 1)[-1][:4000]:
        s = s.replace('<div class="cc-faqs">', '<div class="cc-faqs"><details class="cc-faq"><summary>' + FAQ_Q + '</summary><p>' + FAQ_A + '</p></details>', 1)

    # hero copy + CTA
    if 'personal certificate' not in s.split('</dl>', 1)[0]:
        s = s.replace('and no money at risk.</p>', 'and no money at risk. Finish all twelve and download your personal certificate.</p>', 1)
        s = s.replace('<a class="mk-btn mk-btn-ghost" href="trade">Open paper trading</a>', '<a class="mk-btn mk-btn-ghost" href="#certificate">See the certificate</a><a class="mk-btn mk-btn-ghost" href="trade">Open paper trading</a>', 1)

    # certificate section: replace or insert at the top of the content wrapper
    block = CERT_SECTION.replace('\n', '\r\n') if '\r\n' in s else CERT_SECTION
    if '<!-- cert:start -->' in s:
        s = re.sub(r'<!-- cert:start -->.*?<!-- cert:end -->\r?\n', lambda m: block, s, flags=re.S)
    else:
        s = s.replace('<div class="cc-wrap">\n', '<div class="cc-wrap">\n' + block, 1) if '<div class="cc-wrap">\n' in s else s.replace('<div class="cc-wrap">\r\n', '<div class="cc-wrap">\r\n' + block, 1)

    s = add_assets(s)
    wr(p, s)


def add_assets(s):
    if 'css/certificate.css' not in s:
        s = re.sub(r'(<link rel="stylesheet" href="css/course\.css[^"]*">)(\r?\n)', lambda m: m.group(1) + m.group(2) + '    <link rel="stylesheet" href="css/certificate.css?v=%s">' % V + m.group(2), s, 1)
    if 'js/certificate.js' not in s:
        s, _ = add_after_script(s, 'js/course.js', 'js/certificate.js?v=' + V)
    return s


def patch_lessons():
    n = 0
    for slug in LESSONS:
        p = ROOT / (slug + '.html')
        s = rd(p)
        if 'data-cert-lesson' not in s:
            nl = '\r\n' if '\r\n' in s else '\n'
            s = s.replace('<nav class="cc-pager"', '<div class="cert-lesson" data-cert-lesson></div>' + nl + '<nav class="cc-pager"', 1)
        s = add_assets(s)
        wr(p, s)
        n += 1
    print('lesson pages patched:', n)


patch_hub()
patch_lessons()

# ---------------------------------------------------------------- 3. llms.txt
p = ROOT / 'llms.txt'
s = rd(p)
if 'certificate' not in s.split('trading-course', 1)[-1][:400]:
    s = s.replace('and a 30-day paper trading routine.', 'a 30-day paper trading routine and a downloadable certificate of completion.', 1)
    wr(p, s)
print('done')