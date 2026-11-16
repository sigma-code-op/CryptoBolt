#!/usr/bin/env python3
"""Social preview cards (1200x630) for the trading course: assets/og/trading-course.png + one per lesson.
FONT_DIR may hold Inter / SpaceGrotesk; falls back to system Inter or DejaVu. Needs: pip install pillow"""
import os, sys, glob
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from course_content_a import LESSONS_A
from course_content_b import LESSONS_B
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "og"); os.makedirs(OUT, exist_ok=True)
MODS = {1: "Foundations", 2: "Placing your first trade", 3: "Protecting your money", 4: "Building a process"}
def find(names):
    for d in [os.environ.get("FONT_DIR", ""), "/usr/share/fonts/opentype/inter", "/usr/share/fonts/truetype/dejavu"]:
        for n in names:
            for f in glob.glob(os.path.join(d, n)):
                return f
    return None
BOLD = find(["Inter-Bold.otf", "DejaVuSans-Bold.ttf"]); REG = find(["Inter-Regular.otf", "DejaVuSans.ttf"])
def F(p, s): return ImageFont.truetype(p, s)
def wrap(d, t, f, w):
    out, cur = [], ""
    for word in t.split():
        x = (cur + " " + word).strip()
        if d.textlength(x, font=f) <= w: cur = x
        else: out.append(cur); cur = word
    return out + [cur]
def card(slug, kicker, title, sub):
    S = 2; im = Image.new("RGB", (1200 * S, 630 * S), "#0a0b0f"); d = ImageDraw.Draw(im)
    for i, (h, c) in enumerate([(120, "#ff4d6a"), (200, "#14d38a"), (150, "#14d38a"), (260, "#14d38a"), (210, "#ff4d6a"), (320, "#14d38a"), (290, "#14d38a"), (400, "#14d38a")]):
        x = (760 + i * 52) * S; top = (560 - h) * S
        d.line([(x + 14 * S, top - 30 * S), (x + 14 * S, 560 * S)], fill=c, width=4 * S)
        d.rectangle([x, top, x + 28 * S, top + (h - 40) * S], fill=c)
    d.rectangle([0, 0, 1200 * S, 8 * S], fill="#14d38a")
    d.text((70 * S, 70 * S), "CryptoBolt", font=F(BOLD, 34 * S), fill="#eef1f4")
    d.text((70 * S, 160 * S), kicker, font=F(BOLD, 26 * S), fill="#14d38a")
    ft = F(BOLD, 62 * S); y = 210 * S
    for ln in wrap(d, title, ft, 640 * S)[:4]:
        d.text((70 * S, y), ln, font=ft, fill="#ffffff"); y += 76 * S
    d.text((70 * S, 540 * S), sub, font=F(REG, 28 * S), fill="#929aa8")
    im.resize((1200, 630), Image.LANCZOS).save(os.path.join(OUT, slug + ".png"), optimize=True)
card("trading-course", "Free course", "Trading for absolute beginners", "12 lessons. Quizzes. No money at risk.")
for i, s in enumerate(LESSONS_A + LESSONS_B):
    card(s["slug"], f"Lesson {i+1} of 12", s["title"], MODS[s["module"]])
print("cards done")