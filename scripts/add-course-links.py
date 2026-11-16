#!/usr/bin/env python3
"""Add a 'Course' link to the top nav and a 'Free course' link to the footer of every public page. Safe to re-run."""
import os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP = {"404.html", "app.html", "trade.html", "account.html", "invest.html", "ai.html"}
n = 0
for f in sorted(os.listdir(ROOT)):
    if not f.endswith(".html") or f in SKIP or f.startswith("course-") or f == "trading-course.html": continue
    raw = open(os.path.join(ROOT, f), "rb").read().decode("utf-8"); t = raw; nl = "\r\n" if "\r\n" in raw else "\n"
    if "mk-nav-links" not in t: continue
    if 'href="trading-course"' not in t:
        t = re.sub(r'(\n(\s*)<a href="blog"[^>]*>Blog</a>)', lambda m: f'{nl}{m.group(2)}<a href="trading-course">Course</a>{m.group(1)}', t)
        t = t.replace('<a href="glossary">Glossary</a>', '<a href="trading-course">Free course</a>' + nl + '            <a href="glossary">Glossary</a>', 1)
    if t != raw:
        open(os.path.join(ROOT, f), "wb").write(t.encode("utf-8")); n += 1
print("updated", n, "pages")