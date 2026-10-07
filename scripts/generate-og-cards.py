#!/usr/bin/env python3
"""
CryptoBolt: generate the page-level social preview cards (1200x630) that mirror the
Figma file "CryptoBolt - Mobile Terminal & Social Cards" (page "Social Cards").

  pip install pillow
  FONT_DIR=/path/to/fonts python3 scripts/generate-og-cards.py

Writes assets/og/<slug>.png for: home, terminal, ai-research, paper-trading,
liquidation-calculator, bitcoin-live-price, ethereum-live-price, solana-live-price.
(Per-article cards come from scripts/generate-og-images.py.)

Fonts (all OFL, not bundled): put these in FONT_DIR, or the script falls back to DejaVu.
  SpaceGrotesk[wght].ttf, Inter[opsz,wght].ttf, JetBrainsMono-Regular.ttf, JetBrainsMono-Bold.ttf

Everything is drawn at 2x and downsampled for smooth edges.
"""
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "og")
FONT_DIR = os.environ.get("FONT_DIR", os.path.join(os.path.dirname(__file__), "fonts"))
S = 2  # supersampling factor
W, H = 1200, 630

BG, PANEL, PANEL2 = "#0a0b0f", "#12141b", "#151822"
LINE, GREEN, RED = "#97b1b7", "#14d38a", "#ff4d6a"
CYAN, AMBER, TEXT, DIM = "#4fd8e8", "#ffb020", "#eaf3f1", "#8da1a6"
CHART_BG = "#0d1016"
UP = [40, 44, 41, 52, 49, 60, 57, 68, 64, 76, 72, 83, 80, 92, 88, 100]


def rgb(h, a=1.0):
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), int(round(a * 255)))


_cache = {}


def font(kind, size, weight=None):
    """kind: grotesk | inter | mono ; weight: wght value for variable fonts, or 'bold' for mono."""
    key = (kind, size, weight)
    if key in _cache:
        return _cache[key]
    px = int(round(size * S))
    f = None
    try:
        if kind == "grotesk":
            f = ImageFont.truetype(os.path.join(FONT_DIR, "SpaceGrotesk[wght].ttf"), px)
            f.set_variation_by_axes([weight or 700])
        elif kind == "inter":
            f = ImageFont.truetype(os.path.join(FONT_DIR, "Inter[opsz,wght].ttf"), px)
            f.set_variation_by_axes([14, weight or 400])
        else:
            name = "JetBrainsMono-Bold.ttf" if weight == "bold" else "JetBrainsMono-Regular.ttf"
            f = ImageFont.truetype(os.path.join(FONT_DIR, name), px)
    except OSError:
        path = "/usr/share/fonts/truetype/dejavu/DejaVuSans%s.ttf" % ("-Bold" if (weight in ("bold",) or (isinstance(weight, int) and weight >= 600)) else "")
        try:
            f = ImageFont.truetype(path, px)
        except OSError:
            f = ImageFont.load_default()
    _cache[key] = f
    return f


class Canvas:
    def __init__(self):
        self.img = Image.new("RGBA", (W * S, H * S), rgb(BG))

    # ---- primitives (coordinates in 1x units) ----
    def _layer(self):
        return Image.new("RGBA", self.img.size, (0, 0, 0, 0))

    def rrect(self, x, y, w, h, r, fill=None, stroke=None, sw=1):
        lay = self._layer()
        d = ImageDraw.Draw(lay)
        box = (x * S, y * S, (x + w) * S - 1, (y + h) * S - 1)
        d.rounded_rectangle(box, radius=r * S, fill=fill, outline=stroke, width=int(sw * S) if stroke else 0)
        self.img.alpha_composite(lay)

    def ellipse(self, x, y, w, h, fill):
        lay = self._layer()
        ImageDraw.Draw(lay).ellipse((x * S, y * S, (x + w) * S, (y + h) * S), fill=fill)
        self.img.alpha_composite(lay)

    def glow(self, x, y, d, color, alpha, blur):
        lay = self._layer()
        ImageDraw.Draw(lay).ellipse((x * S, y * S, (x + d) * S, (y + d) * S), fill=rgb(color, alpha))
        lay = lay.filter(ImageFilter.GaussianBlur(blur * S))
        self.img.alpha_composite(lay)

    def poly(self, pts, fill):
        lay = self._layer()
        ImageDraw.Draw(lay).polygon([(px * S, py * S) for px, py in pts], fill=fill)
        self.img.alpha_composite(lay)

    def line(self, pts, fill, width):
        lay = self._layer()
        d = ImageDraw.Draw(lay)
        sp = [(px * S, py * S) for px, py in pts]
        d.line(sp, fill=fill, width=int(width * S), joint="curve")
        r = width * S / 2
        for px, py in (sp[0], sp[-1]):
            d.ellipse((px - r, py - r, px + r, py + r), fill=fill)
        self.img.alpha_composite(lay)

    def text(self, x, top, s, f, fill, lh=None, anchor="l", tracking=0.0):
        """Draw text so that its line box (height lh, default font height) starts at `top`, like Figma."""
        asc, desc = f.getmetrics()
        base_h = (asc + desc) / S
        lh = lh or base_h
        baseline = (top + (lh - base_h) / 2) * S + asc
        d = ImageDraw.Draw(self.img)
        if anchor == "r":
            x = x - self.tw(s, f, tracking)
        if tracking:
            cx = x * S
            for ch in s:
                d.text((cx, baseline), ch, font=f, fill=fill, anchor="ls")
                cx += d.textlength(ch, font=f) + tracking * S
        else:
            d.text((x * S, baseline), s, font=f, fill=fill, anchor="ls")

    def tw(self, s, f, tracking=0.0):
        d = ImageDraw.Draw(self.img)
        return d.textlength(s, font=f) / S + tracking * len(s)

    def lh(self, f):
        asc, desc = f.getmetrics()
        return (asc + desc) / S

    def wrap(self, s, f, max_w):
        lines, cur = [], ""
        for word in s.split():
            trial = (cur + " " + word).strip()
            if self.tw(trial, f) <= max_w:
                cur = trial
            else:
                lines.append(cur)
                cur = word
        lines.append(cur)
        return lines

    def save(self, path):
        out = self.img.convert("RGB").resize((W, H), Image.LANCZOS)
        out.save(path, optimize=True)


# ---------------- reusable pieces ----------------
def pill(c, x, y, label, color, mono=False):
    f = font("mono", 15, "bold") if mono else font("inter", 15, 600)
    w = c.tw(label, f) + 24
    h = c.lh(f) + 10
    c.rrect(x, y, w, h, h / 2, fill=rgb(color, 0.14), stroke=rgb(color, 0.5), sw=1)
    c.text(x + 12, y + 5, label, f, rgb(color))
    return w, h


def chart(c, x, y, w, h, color=GREEN):
    c.rrect(x, y, w, h, 12, fill=rgb(CHART_BG))
    for i in range(1, 4):
        yy = y + i * h / 4
        c.line([(x + 6, yy), (x + w - 6, yy)], rgb(LINE, 0.1), 1)
    mn, mx = min(UP), max(UP)
    pts = []
    for i, v in enumerate(UP):
        px = x + i * (w / (len(UP) - 1))
        py = y + h - 12 - ((v - mn) / (mx - mn)) * (h - 28)
        pts.append((px, py))
    c.line(pts, rgb(color), 3)


def price_row(c, x, y, w, sym, price, chg, color):
    c.text(x, y, sym, font("mono", 18, "bold"), rgb(DIM))
    c.text(x, y + 26, price, font("mono", 40, "bold"), rgb(color))
    pf = font("mono", 15, "bold")
    pw = c.tw(chg, pf) + 24
    pill(c, x + w - pw, y + 25, chg, color, mono=True)
    return 79


def panel(c, x, y, w, h):
    c.rrect(x, y, w, h, 20, fill=rgb(PANEL), stroke=rgb(LINE, 0.22), sw=1)


# ---------------- visuals (x,y = panel top-left) ----------------
def v_home(c, x, y, w):
    rows = [("Live prices", "BTC, ETH, SOL and more, streaming", CYAN),
            ("Paper trading", "Practice futures with simulated funds", GREEN),
            ("AI research", "Reports with sources and timestamps", AMBER)]
    cy = y
    for a, b, col in rows:
        c.rrect(x, cy, w, 90, 18, fill=rgb(PANEL), stroke=rgb(LINE, 0.22), sw=1)
        c.rrect(x + 20, cy + 19, 52, 52, 12, fill=rgb(col, 0.16), stroke=rgb(col, 0.5), sw=1)
        c.ellipse(x + 20 + 18, cy + 19 + 18, 16, 16, rgb(col))
        c.text(x + 88, cy + 19, a, font("inter", 24, 700), rgb(TEXT))
        c.text(x + 88, cy + 19 + 33, b, font("inter", 16, 400), rgb(DIM))
        cy += 104


def v_terminal(c, x, y, w):
    panel(c, x, y, w, 411)
    ix, iw, cy = x + 22, w - 44, y + 22
    cy += price_row(c, ix, cy, iw, "BTC/USDT", "67,412.50", "+2.31%", GREEN) + 14
    chart(c, ix, cy, iw, 170)
    cy += 170 + 14
    for a, b, col in (("67,412.5", "0.730", GREEN), ("67,418.0", "0.412", RED)):
        c.rrect(ix, cy, iw, 38, 8, fill=rgb(col, 0.08))
        f = font("mono", 17)
        c.text(ix + 10, cy + 8, a, f, rgb(col))
        c.text(ix + iw - 10, cy + 8, b, f, rgb(TEXT), anchor="r")
        cy += 38 + 14


def v_ai(c, x, y, w):
    panel(c, x, y, w, 303)
    ix, iw, cy = x + 22, w - 44, y + 22
    c.text(ix, cy + 2, "AI research · BTC", font("inter", 22, 700), rgb(TEXT))
    pf = font("inter", 15, 600)
    pw = c.tw("Report", pf) + 24
    pill(c, ix + iw - pw, cy + 1, "Report", CYAN)
    cy += 30 + 14
    for a, b in (("Market data", "12:04 UTC"), ("Indicators", "RSI · MACD · funding"), ("News items", "6 sources")):
        c.rrect(ix, cy, iw, 48, 12, fill=rgb(PANEL2))
        c.line([(ix + 14, cy + 25), (ix + 19, cy + 30), (ix + 28, cy + 19)], rgb(GREEN), 2.6)
        c.text(ix + 48, cy + 12, a, font("inter", 19, 600), rgb(TEXT))
        c.text(ix + iw - 14, cy + 15, b, font("mono", 15), rgb(DIM), anchor="r")
        cy += 48 + 14
    w1, _ = pill(c, ix, cy, "Measured data", CYAN)
    pill(c, ix + w1 + 10, cy, "AI interpretation", AMBER)


def v_paper(c, x, y, w):
    panel(c, x, y, w, 411)
    ix, iw, cy = x + 22, w - 44, y + 22
    t = "BTCUSDT Long"
    tf = font("inter", 22, 700)
    c.text(ix, cy + 2, t, tf, rgb(TEXT))
    px = ix + c.tw(t, tf) + 10
    pill(c, px, cy + 1, "10x", AMBER, mono=True)
    pf = font("inter", 15, 600)
    pw = c.tw("Paper", pf) + 24
    pill(c, ix + iw - pw, cy + 1, "Paper", CYAN)
    cy += 30 + 14
    c.text(ix, cy, "Unrealized PnL", font("inter", 15), rgb(DIM))
    c.text(ix, cy + 18, "+$578.10", font("mono", 52, "bold"), rgb(GREEN))
    cy += 89 + 14
    chart(c, ix, cy, iw, 110)
    cy += 110 + 14
    for a, b in (("Entry", "65,100.0"), ("Mark", "67,412.5"), ("Liq. price", "59,240.0")):
        c.text(ix, cy, a, font("inter", 17), rgb(DIM))
        c.text(ix + iw, cy, b, font("mono", 17), rgb(RED if a == "Liq. price" else TEXT), anchor="r")
        cy += 21 + 14


def v_calc(c, x, y, w):
    panel(c, x, y, w, 431)
    ix, iw, cy = x + 22, w - 44, y + 22
    c.text(ix, cy, "Position", font("inter", 20, 700), rgb(TEXT))
    cy += 24 + 14
    for a, b in (("Entry price", "67,000"), ("Leverage", "20x"), ("Side", "Long")):
        c.rrect(ix, cy, iw, 56, 12, fill=rgb(PANEL2), stroke=rgb(LINE, 0.18), sw=1)
        c.text(ix + 16, cy + 17, a, font("inter", 18), rgb(DIM))
        c.text(ix + iw - 16, cy + 15, b, font("mono", 20, "bold"), rgb(TEXT), anchor="r")
        cy += 56 + 14
    c.rrect(ix, cy, iw, 146, 14, fill=rgb(RED, 0.1), stroke=rgb(RED, 0.5), sw=1)
    c.text(ix + 18, cy + 16, "Liquidation price", font("inter", 16), rgb(DIM))
    c.text(ix + 18, cy + 40, "63,830.00", font("mono", 42, "bold"), rgb(RED))
    c.text(ix + 18, cy + 108, "4.73% below entry", font("mono", 16), rgb(DIM))


def v_live(name, sym, price, chg, col, vol):
    def draw(c, x, y, w):
        panel(c, x, y, w, 411)
        ix, iw, cy = x + 22, w - 44, y + 22
        cy += price_row(c, ix, cy, iw, sym, price, chg, col) + 14
        chart(c, ix, cy, iw, 230, col)
        cy += 230 + 14
        w1, _ = pill(c, ix, cy, vol, CYAN, mono=True)
        pill(c, ix + w1 + 10, cy, "Fear & Greed 64", AMBER)
    return draw


CARDS = [
    # slug, eyebrow, title, subtitle, visual, panel_w, panel_h
    ("home", "Free crypto terminal", "Live charts, paper trading & AI research",
     "One screen for prices, practice futures and data-grounded AI analysis.", v_home, 420, 298),
    ("terminal", "Trading terminal", "Charts, order book & indicators in one view",
     "Interval, indicator and compare tools with a live order book.", v_terminal, 440, 411),
    ("ai-research", "Crypto AI research", "Research Bitcoin & altcoins with grounded data",
     "Every report shows its sources, timestamps and indicators.", v_ai, 440, 303),
    ("paper-trading", "Paper trading", "Practice crypto futures with zero risk",
     "Simulated funds, per-coin leverage limits and live prices.", v_paper, 440, 411),
    ("liquidation-calculator", "Free tool", "Liquidation price calculator",
     "Check how far price can move against a futures position.", v_calc, 440, 431),
    ("bitcoin-live-price", "Live price", "Bitcoin live price",
     "BTC chart and market data, updated in real time.",
     v_live("btc", "BTC/USDT", "67,412.50", "+2.31%", GREEN, "24h Vol 1.2B"), 440, 411),
    ("ethereum-live-price", "Live price", "Ethereum live price",
     "ETH chart and market data, updated in real time.",
     v_live("eth", "ETH/USDT", "3,305.40", "+1.84%", GREEN, "24h Vol 640M"), 440, 411),
    ("solana-live-price", "Live price", "Solana live price",
     "SOL chart and market data, updated in real time.",
     v_live("sol", "SOL/USDT", "151.92", "+3.07%", GREEN, "24h Vol 210M"), 440, 411),
]


def render(slug, eyebrow, title, sub, visual, pw, ph):
    c = Canvas()
    c.glow(760, -260, 640, GREEN, 0.16, 70)
    c.rrect(40, 40, 1120, 550, 28, stroke=rgb(LINE, 0.22), sw=2)
    # brand
    c.rrect(80, 80, 48, 48, 12, fill=rgb(GREEN))
    k = 26 / 24
    bolt = [(13, 2), (4, 14), (11, 14), (10, 22), (19, 10), (12, 10)]
    c.poly([(80 + 11 + px * k, 80 + 11 + py * k) for px, py in bolt], rgb("#06120d"))
    bf = font("grotesk", 32, 700)
    c.text(142, 80, "CryptoBolt", bf, rgb(TEXT), lh=48)
    # text block
    ef, tf, sf = font("inter", 22, 700), font("grotesk", 60, 700), font("inter", 24, 400)
    tl, sl = c.wrap(title, tf, 560), c.wrap(sub, sf, 560)
    eh = round(c.lh(ef))
    block_h = eh + 18 + 66 * len(tl) + 18 + 34 * len(sl)
    top = max(150, round(300 - block_h / 2) + 10)
    c.text(80, top, eyebrow.upper(), ef, rgb(GREEN), tracking=2.2)
    ty = top + eh + 18
    for ln in tl:
        c.text(80, ty, ln, tf, rgb(TEXT), lh=66)
        ty += 66
    ty += 18
    for ln in sl:
        c.text(80, ty, ln, sf, rgb(DIM), lh=34)
        ty += 34
    c.text(80, 520, "cryptobolt.io", font("inter", 26, 700), rgb(CYAN))
    # visual
    visual(c, 1120 - pw, round((630 - ph) / 2) + 10, pw)
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, slug + ".png")
    c.save(path)
    return path


if __name__ == "__main__":
    only = set(os.sys.argv[1:])
    for spec in CARDS:
        if only and spec[0] not in only:
            continue
        print("wrote", os.path.relpath(render(*spec), ROOT))