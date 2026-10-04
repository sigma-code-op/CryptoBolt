#!/usr/bin/env python3
"""
CryptoBolt: generate one 1200x630 social-preview image per blog post (and the
glossary), so shared links show the article's own headline instead of the
same generic card everywhere.

  pip install pillow
  python3 scripts/generate-og-images.py

Reads posts/*.md front matter (og_title/title, section, readtime) and writes
assets/og/<slug>.png. scripts/build-blog.js automatically uses assets/og/<slug>.png
when it exists, so re-run `npm run build:blog` afterwards. Fonts: uses DejaVu Sans
(bold) if present, otherwise Pillow's default font; point FONT_BOLD / FONT_REG at
Inter or Plus Jakarta Sans .ttf files for an on-brand look.
"""
import os, re, sys
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "og")
W, H = 1200, 630
BG, PANEL, LINE = (10, 11, 15), (20, 22, 29), (42, 47, 58)
GREEN, CYAN, TEXT, DIM = (31, 207, 140), (79, 216, 232), (238, 241, 244), (146, 154, 168)

FONT_BOLD = os.environ.get("FONT_BOLD", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")
FONT_REG = os.environ.get("FONT_REG", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")


def font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except OSError:
        return ImageFont.load_default()


def wrap(draw, text, fnt, max_w, max_lines):
    words, lines, cur = text.split(), [], ""
    for w in words:
        trial = (cur + " " + w).strip()
        if draw.textlength(trial, font=fnt) <= max_w:
            cur = trial
        else:
            lines.append(cur)
            cur = w
    lines.append(cur)
    if len(lines) > max_lines:
        lines = lines[:max_lines]
        while draw.textlength(lines[-1] + "…", font=fnt) > max_w:
            lines[-1] = lines[-1].rsplit(" ", 1)[0]
        lines[-1] += "…"
    return lines


def card(path, eyebrow, title, footer):
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    # soft glow, top right
    glow = Image.new("RGB", (W, H), BG)
    gd = ImageDraw.Draw(glow)
    gd.ellipse((760, -260, 1400, 380), fill=(14, 52, 44))
    img = Image.blend(img, glow, 0.9)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((40, 40, W - 40, H - 40), radius=28, outline=LINE, width=2)
    # brand
    d.rounded_rectangle((80, 82, 128, 130), radius=12, fill=GREEN)
    bolt = [(108, 90), (92, 114), (105, 114), (100, 124), (118, 100), (105, 100)]
    d.polygon(bolt, fill=(6, 18, 13))
    d.text((144, 90), "CryptoBolt", font=font(FONT_BOLD, 32), fill=TEXT)
    # eyebrow
    d.text((80, 190), eyebrow.upper(), font=font(FONT_BOLD, 24), fill=GREEN)
    # title
    tf = font(FONT_BOLD, 62)
    lines = wrap(d, title, tf, W - 160, 4)
    y = 238
    for ln in lines:
        d.text((80, y), ln, font=tf, fill=TEXT)
        y += 78
    # footer
    d.text((80, H - 96), footer, font=font(FONT_REG, 26), fill=DIM)
    d.text((W - 80, H - 96), "cryptobolt.io", font=font(FONT_BOLD, 26), fill=CYAN, anchor="ra")
    img.save(path, optimize=True)


def front(raw):
    head = raw.replace("\r\n", "\n").split("\n---", 1)[0]
    out = {}
    for line in head.split("\n"):
        if ":" in line:
            k, v = line.split(":", 1)
            out[k.strip()] = v.strip()
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    posts = os.path.join(ROOT, "posts")
    n = 0
    for f in sorted(os.listdir(posts)):
        if not f.endswith(".md"):
            continue
        fm = front(open(os.path.join(posts, f), encoding="utf8").read())
        slug = f[:-3]
        title = (fm.get("og_title") or fm["title"]).strip('"')
        card(os.path.join(OUT, slug + ".png"), fm.get("section", "Blog"), title, fm.get("readtime", ""))
        n += 1
    card(os.path.join(OUT, "glossary.png"), "Reference", "Crypto trading glossary: plain-English definitions", "Funding rate, liquidation price, ATR and more")
    print(f"wrote {n + 1} images to assets/og/")


if __name__ == "__main__":
    sys.exit(main())