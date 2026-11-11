#!/usr/bin/env python3
"""Render the CryptoBolt explainer videos (assets/video/*.mp4 + poster JPGs).

Usage: python3 scripts/build-videos.py [slug ...]
Needs: Pillow, numpy, ffmpeg. Everything is drawn in code, so the videos are
original, contain no third-party footage, and can be regenerated any time.
Output: 1280x720 H.264 MP4, 30 fps, silent (all text is on screen), faststart.
"""
import math, os, subprocess, sys
from PIL import Image, ImageDraw, ImageFont

W, H, FPS = 1920, 1080, 30
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'video')
BG = (7, 9, 13); PANEL = (16, 21, 30); PANEL2 = (22, 29, 41); LINE = (38, 48, 64)
TXT = (236, 241, 247); MUTED = (140, 156, 176)
CYAN = (79, 216, 232); GREEN = (34, 197, 140); RED = (240, 85, 95); AMBER = (255, 176, 32)

def font(size, bold=False, mono=False):
    if mono:
        return ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono%s.ttf' % ('-Bold' if bold else ''), size)
    return ImageFont.truetype('/usr/share/fonts/opentype/inter/Inter-%s.otf' % ('Bold' if bold else 'Medium'), size)
FONTS = {}
def F(size, bold=False, mono=False):
    k = (size, bold, mono)
    if k not in FONTS: FONTS[k] = font(size, bold, mono)
    return FONTS[k]

def clamp(x, a=0.0, b=1.0): return max(a, min(b, x))
def ease(x): x = clamp(x); return x * x * (3 - 2 * x)
def seg(t, a, b): return ease((t - a) / (b - a))          # eased 0..1 between a and b
def lerp(a, b, k): return a + (b - a) * k
def mix(c, bg, a): return tuple(int(bg[i] + (c[i] - bg[i]) * clamp(a)) for i in range(3))

class Canvas:
    def __init__(self):
        self.im = Image.new('RGB', (W, H), BG); self.d = ImageDraw.Draw(self.im)
    def text(self, xy, s, size=40, color=TXT, bold=False, mono=False, a=1.0, anchor='la', bg=BG):
        self.d.text(xy, s, font=F(size, bold, mono), fill=mix(color, bg, a), anchor=anchor)
    def rect(self, box, fill=None, outline=None, r=18, w=2, a=1.0, bg=BG):
        self.d.rounded_rectangle(box, r, fill=mix(fill, bg, a) if fill else None,
                                 outline=mix(outline, bg, a) if outline else None, width=w)
    def line(self, p, q, color=LINE, w=3, a=1.0, bg=BG): self.d.line([p, q], fill=mix(color, bg, a), width=w)
    def dashed(self, y, x0, x1, color, w=3, dash=18, gap=12, a=1.0, bg=PANEL):
        x = x0
        while x < x1:
            self.d.line([(x, y), (min(x + dash, x1), y)], fill=mix(color, bg, a), width=w); x += dash + gap

def chrome(c, t, total, title):
    # brand tag + title + progress bar
    c.d.polygon([(112, 62), (132, 62), (122, 82), (138, 82), (112, 118), (120, 90), (104, 90)], fill=CYAN)
    c.text((152, 70), 'CryptoBolt', 34, TXT, True)
    c.text((W - 100, 74), title, 28, MUTED, anchor='ra')
    c.d.rectangle([0, H - 8, W, H], fill=(20, 26, 36)); c.d.rectangle([0, H - 8, int(W * t / total), H], fill=CYAN)

def caption(c, s, t, a0, a1, y=930, size=40):
    a = seg(t, a0, a0 + .4) * (1 - seg(t, a1 - .4, a1))
    if a > 0:
        c.text((W // 2, y), s, size, TXT, a=a, anchor='mm')

def title_card(c, t, head, sub, dur=3.2):
    a = seg(t, 0, .6) * (1 - seg(t, dur - .5, dur))
    c.text((W // 2, 450), head, 92, TXT, True, a=a, anchor='mm')
    c.text((W // 2, 560), sub, 40, CYAN, a=a, anchor='mm')

def end_card(c, t, t0, total):
    a = seg(t, t0, t0 + .7)
    if a <= 0: return
    c.im = Image.blend(c.im, Image.new('RGB', (W, H), BG), a); c.d = ImageDraw.Draw(c.im)
    c.d.polygon([(900, 330), (940, 330), (920, 372), (952, 372), (900, 440), (916, 388), (884, 388)], fill=mix(CYAN, BG, a))
    c.text((W // 2, 520), 'Practice it free on CryptoBolt', 66, TXT, True, a=a, anchor='mm')
    c.text((W // 2, 610), 'cryptobolt.io', 52, CYAN, True, a=a, anchor='mm')
    c.text((W // 2, 760), 'Educational content only. Not financial advice. Numbers are illustrative.', 30, MUTED, a=a, anchor='mm')

def money(v): return '${:,.0f}'.format(v)

# ---------------------------------------------------------------- video 1
def v_liquidation(t, c):
    T = 50
    chrome(c, t, T, 'Leverage & liquidation')
    if t < 3.4: title_card(c, t, 'Leverage and liquidation', 'What actually happens when a futures position is wiped out', 3.4)
    # scene A: margin x leverage
    if 3.4 <= t < 14:
        a = seg(t, 3.4, 4) * (1 - seg(t, 13.4, 14))
        c.text((W // 2, 230), 'Leverage lets you control a bigger position with less money', 48, TXT, True, a=a, anchor='mm')
        k = seg(t, 4.5, 6.5); lev = 10
        c.rect((260, 380, 260 + 360, 380 + 360), PANEL, LINE, a=a)
        c.text((440, 470), 'Your margin', 34, MUTED, a=a, anchor='mm', bg=PANEL)
        c.text((440, 560), '$100', 90, CYAN, True, a=a, anchor='mm', bg=PANEL)
        c.text((810, 560), '×  10', 80, AMBER, True, a=a * seg(t, 6, 7), anchor='mm')
        w = int(lerp(360, 700, k)); h = int(lerp(360, 400, k))
        x0 = 1000; y1 = 740
        c.rect((x0, y1 - h, x0 + w, y1), PANEL2, CYAN, a=a)
        c.text((x0 + w // 2, y1 - h // 2 - 40), 'Position size', 34, MUTED, a=a, anchor='mm', bg=PANEL2)
        c.text((x0 + w // 2, y1 - h // 2 + 30), '$1,000' if k > .95 else money(lerp(100, 1000, k)), 80, TXT, True, a=a, anchor='mm', bg=PANEL2)
        caption(c, 'A 10% move against you now moves your margin by 100%.', t, 9.5, 13.4)
    # scene B: distance to liquidation by leverage
    if 14 <= t < 28:
        a = seg(t, 14, 14.6) * (1 - seg(t, 27.4, 28))
        c.text((W // 2, 220), 'Higher leverage puts liquidation closer to your entry', 48, TXT, True, a=a, anchor='mm')
        rows = [('2x', 50), ('5x', 20), ('10x', 10), ('20x', 5), ('50x', 2)]
        for i, (lab, pct) in enumerate(rows):
            y = 340 + i * 110; k = seg(t, 15 + i * .8, 17 + i * .8)
            c.text((300, y + 30), lab, 54, TXT, True, a=a, anchor='lm')
            c.rect((420, y, 1500, y + 60), PANEL, None, r=12, a=a)
            wbar = int(1080 * pct / 50 * k)
            col = GREEN if pct >= 20 else (AMBER if pct >= 5 else RED)
            if wbar > 14: c.rect((420, y, 420 + wbar, y + 60), col, None, r=12, a=a)
            c.text((1540, y + 30), '≈ {}% move'.format(int(pct * k + .5) if k < 1 else pct), 44, col, True, a=a, anchor='lm')
        c.text((W // 2, 900), 'Approximate drop to liquidation for a long position, before fees and maintenance margin.', 30, MUTED, a=a, anchor='mm')
    # scene C: the same dip, two outcomes
    if 28 <= t < 42:
        a = seg(t, 28, 28.6) * (1 - seg(t, 41.4, 42))
        c.text((W // 2, 200), 'Same price move, different outcome', 48, TXT, True, a=a, anchor='mm')
        x0, x1, y0, y1 = 240, 1500, 300, 820
        c.rect((x0 - 40, y0 - 30, x1 + 40, y1 + 40), PANEL, LINE, a=a)
        def py(p): return y1 - (p - 80) / 40 * (y1 - y0 - 20)   # 80..120 range
        pts = [(0, 100), (.12, 103), (.28, 97), (.42, 91), (.52, 88), (.66, 96), (.82, 106), (1, 112)]
        def price_at(u):
            for i in range(len(pts) - 1):
                if pts[i][0] <= u <= pts[i + 1][0]:
                    k = (u - pts[i][0]) / (pts[i + 1][0] - pts[i][0]); return lerp(pts[i][1], pts[i + 1][1], ease(k))
            return pts[-1][1]
        prog = seg(t, 29, 37)
        # liquidation guides
        c.dashed(int(py(90)), x0, x1, RED, a=a * seg(t, 29, 30))
        c.text((x1 - 10, int(py(90)) - 40), '10x liquidation ≈ $90', 28, RED, a=a * seg(t, 29, 30), anchor='ra', bg=PANEL)
        c.dashed(int(py(100)), x0, x1, MUTED, a=a * .8)
        c.text((x0 + 10, int(py(100)) - 42), 'Entry $100', 28, MUTED, a=a, bg=PANEL)
        N = 160; last = None
        for i in range(N + 1):
            u = i / N
            if u > prog: break
            p = (x0 + (x1 - x0) * u, py(price_at(u)))
            if last: c.d.line([last, p], fill=mix(CYAN, PANEL, a), width=6)
            last = p
        if last and prog >= .52:
            hit = seg(t, 29 + 8 * .52, 29 + 8 * .52 + .5)
            mx, my = x0 + (x1 - x0) * .5, py(90)
            c.rect((mx - 250, my + 40, mx + 250, my + 130), RED, None, a=a * hit, bg=PANEL)
            c.text((mx, my + 85), '10x position liquidated', 34, (255, 255, 255), True, a=a * hit, anchor='mm', bg=RED)
        if prog >= .98:
            k = seg(t, 37.2, 38.4)
            c.text((x1 - 10, py(112) - 50), '2x position still open', 34, GREEN, True, a=a * k, anchor='ra', bg=PANEL)
        caption(c, 'Price dipped to about $88, then recovered. Only the low-leverage position survived.', t, 33, 41.4, 925, 36)
    # scene D: takeaways
    if 42 <= t < 50:
        a = seg(t, 42, 42.6)
        c.text((W // 2, 260), 'Remember', 56, CYAN, True, a=a, anchor='mm')
        items = ['More leverage = less room before liquidation',
                 'Place a stop-loss well inside the liquidation price',
                 'Fees and funding move the real liquidation price']
        for i, s in enumerate(items):
            k = seg(t, 43 + i * 1.2, 44 + i * 1.2)
            c.rect((360, 360 + i * 150, 1560, 360 + i * 150 + 112), PANEL, LINE, a=k)
            c.text((420, 360 + i * 150 + 56), s, 44, TXT, a=k, anchor='lm', bg=PANEL)
    end_card(c, t, 47.4, T)
    return T

# ---------------------------------------------------------------- video 2
def v_orderbook(t, c):
    T = 48
    chrome(c, t, T, 'The order book')
    if t < 3.4: title_card(c, t, 'How to read an order book', 'Bids, asks, spread and slippage in under a minute', 3.4)
    asks0 = [(100.05, 4.0), (100.04, 2.6), (100.03, 3.4), (100.02, 1.8), (100.01, 2.2)]   # top to bottom
    bids0 = [(100.00, 3.0), (99.99, 2.4), (99.98, 4.2), (99.97, 1.6), (99.96, 3.6)]
    def book(c, a, asks, bids, x=260, wmax=620, hl_asks=0):
        c.rect((x - 40, 270, x + wmax + 340, 860), PANEL, LINE, a=a)
        c.text((x, 295), 'Price (USDT)', 28, MUTED, a=a, bg=PANEL); c.text((x + wmax + 280, 295), 'Size', 28, MUTED, a=a, anchor='ra', bg=PANEL)
        for i, (p, s) in enumerate(asks):
            y = 345 + i * 56
            if s > 0.01:
                c.rect((x + 120, y, x + 120 + int(wmax * s / 5), y + 46), RED, None, r=8, a=a * .55, bg=PANEL)
            c.text((x, y + 23), '%.2f' % p, 32, RED, True, mono=True, a=a, anchor='lm', bg=PANEL)
            c.text((x + wmax + 280, y + 23), '%.1f' % s, 32, TXT, mono=True, a=a, anchor='rm', bg=PANEL)
        c.line((x, 640), (x + wmax + 280, 640), LINE, 2, a=a, bg=PANEL)
        for i, (p, s) in enumerate(bids):
            y = 660 + i * 38 if False else 655 + i * 40 - (0)
            y = 655 + i * 40
            c.rect((x + 120, y, x + 120 + int(wmax * s / 5), y + 32), GREEN, None, r=8, a=a * .55, bg=PANEL)
            c.text((x, y + 16), '%.2f' % p, 28, GREEN, True, mono=True, a=a, anchor='lm', bg=PANEL)
            c.text((x + wmax + 280, y + 16), '%.1f' % s, 28, TXT, mono=True, a=a, anchor='rm', bg=PANEL)
    if 3.4 <= t < 17:
        a = seg(t, 3.4, 4) * (1 - seg(t, 16.4, 17))
        asks = [(p, s * seg(t, 4.4 + i * .25, 5.2 + i * .25)) for i, (p, s) in enumerate(asks0)]
        bids = [(p, s * seg(t, 6 + i * .25, 6.8 + i * .25)) for i, (p, s) in enumerate(bids0)]
        book(c, a, asks, bids)
        k = seg(t, 5, 5.8)
        c.text((1300, 360), 'Asks', 48, RED, True, a=a * k, bg=BG); c.text((1300, 415), "Sellers' orders waiting to sell", 32, MUTED, a=a * k)
        k = seg(t, 7, 7.8)
        c.text((1300, 690), 'Bids', 48, GREEN, True, a=a * k); c.text((1300, 745), "Buyers' orders waiting to buy", 32, MUTED, a=a * k)
        k = seg(t, 10, 11)
        c.rect((1300, 520, 1700, 600), PANEL2, AMBER, a=a * k, bg=BG)
        c.text((1500, 560), 'Spread: 0.01', 36, AMBER, True, a=a * k, anchor='mm', bg=PANEL2)
        caption(c, 'Best ask minus best bid = the spread. A tight spread means a liquid market.', t, 11.5, 16.4, 960, 34)
    if 17 <= t < 32:
        a = seg(t, 17, 17.6) * (1 - seg(t, 31.4, 32))
        c.text((W // 2, 200), 'A market buy walks up the book', 48, TXT, True, a=a, anchor='mm')
        k = seg(t, 19, 28)             # how much of the 10-unit order has filled
        want = 10.0 * k; filled = 0.0; cost = 0.0; asks = []
        order = list(reversed(asks0))  # lowest ask first
        eaten = []
        for p, s in order:
            take = min(s, max(0.0, want - filled)); filled += take; cost += take * p; eaten.append((p, s - take))
        asks = list(reversed(eaten))
        book(c, a, asks, bids0)
        c.rect((1300, 330, 1700, 640), PANEL2, LINE, a=a, bg=BG)
        c.text((1500, 375), 'Buy 10 at market', 32, MUTED, a=a, anchor='mm', bg=PANEL2)
        c.text((1500, 450), 'Filled %.1f / 10' % filled, 40, TXT, True, a=a, anchor='mm', bg=PANEL2)
        avg = cost / filled if filled > 0.01 else 100.01
        c.text((1500, 530), 'Avg price', 28, MUTED, a=a, anchor='mm', bg=PANEL2)
        c.text((1500, 585), '%.3f' % avg, 52, AMBER, True, mono=True, a=a, anchor='mm', bg=PANEL2)
        caption(c, 'The order eats cheaper asks first, then pays more. That gap is slippage.', t, 24, 31.4, 960, 34)
    if 32 <= t < 40:
        a = seg(t, 32, 32.6) * (1 - seg(t, 39.4, 40))
        c.text((W // 2, 200), 'Big walls can move or vanish', 48, TXT, True, a=a, anchor='mm')
        bids = [(100.00, 1.6), (99.99, 1.2), (99.98, 5.0), (99.97, 0.9), (99.96, 1.4)]
        k = seg(t, 34.5, 35.5)
        bids = [(p, s) for p, s in bids]
        book(c, a, asks0, bids)
        c.rect((1300, 560, 1700, 700), PANEL2, AMBER, a=a * k, bg=BG)
        c.text((1500, 600), 'Large bid "wall"', 34, AMBER, True, a=a * k, anchor='mm', bg=PANEL2)
        c.text((1500, 655), 'can be cancelled any time', 28, MUTED, a=a * k, anchor='mm', bg=PANEL2)
        caption(c, 'A big order can look like support or resistance, but it is only a promise.', t, 36, 39.4, 960, 34)
    if 40 <= t < 48:
        a = seg(t, 40, 40.6)
        c.text((W // 2, 260), 'Remember', 56, CYAN, True, a=a, anchor='mm')
        for i, s in enumerate(['Bids = buyers, asks = sellers', 'Wide spread or thin book = more slippage', 'Treat walls as hints, not guarantees']):
            k = seg(t, 41 + i * 1.1, 42 + i * 1.1)
            c.rect((360, 360 + i * 150, 1560, 360 + i * 150 + 112), PANEL, LINE, a=k)
            c.text((420, 360 + i * 150 + 56), s, 44, TXT, a=k, anchor='lm', bg=PANEL)
    end_card(c, t, 45.4, T)
    return T

# ---------------------------------------------------------------- video 3
def v_sizing(t, c):
    T = 46
    chrome(c, t, T, 'Position sizing')
    if t < 3.4: title_card(c, t, 'The 1% rule', 'How to size a trade so one loss cannot hurt much', 3.4)
    if 3.4 <= t < 20:
        a = seg(t, 3.4, 4) * (1 - seg(t, 19.4, 20))
        c.text((W // 2, 210), 'Start from what you are willing to lose', 48, TXT, True, a=a, anchor='mm')
        cards = [('Account', '$1,000', TXT, 4.5), ('Risk per trade', '1%  =  $10', AMBER, 7), ('Entry / stop', '$100 / $98', CYAN, 10)]
        for i, (lab, val, col, t0) in enumerate(cards):
            k = seg(t, t0, t0 + .8); x = 190 + i * 540
            c.rect((x, 340, x + 500, 540), PANEL, LINE, a=a * k)
            c.text((x + 250, 400), lab, 32, MUTED, a=a * k, anchor='mm', bg=PANEL)
            c.text((x + 250, 480), val, 54, col, True, a=a * k, anchor='mm', bg=PANEL)
        k = seg(t, 12, 13)
        c.text((W // 2, 640), 'Stop distance  =  (100 − 98) ÷ 100  =  2%', 46, TXT, a=a * k, anchor='mm')
        k = seg(t, 14.5, 15.5)
        c.rect((330, 730, 1590, 860), PANEL2, AMBER, a=a * k)
        c.text((W // 2, 795), 'Position size  =  $10 ÷ 2%  =  $500', 56, AMBER, True, a=a * k, anchor='mm', bg=PANEL2)
        caption(c, 'If the stop is hit, you lose $10, which is 1% of the account.', t, 16.5, 19.4, 960, 36)
    if 20 <= t < 38:
        a = seg(t, 20, 20.6) * (1 - seg(t, 37.4, 38))
        c.text((W // 2, 200), 'Why small risk matters: 10 losses in a row', 48, TXT, True, a=a, anchor='mm')
        bars = [('Risk 1% per trade', 904, GREEN), ('Risk 10% per trade', 349, RED)]
        for i, (lab, final, col) in enumerate(bars):
            y = 340 + i * 250; k = seg(t, 22 + i * 2.5, 26 + i * 2.5)
            c.text((260, y), lab, 40, TXT, True, a=a)
            c.rect((260, y + 60, 1560, y + 150), PANEL, None, r=14, a=a)
            val = lerp(1000, final, k)
            c.rect((260, y + 60, 260 + int(1300 * val / 1000), y + 150), col, None, r=14, a=a)
            c.text((1600, y + 105), money(val), 54, col, True, a=a, anchor='lm')
        c.text((260, 270), 'Starting balance $1,000', 28, MUTED, a=a)
        caption(c, 'Compounded losses: 0.99¹⁰ ≈ 90.4% left versus 0.90¹⁰ ≈ 34.9% left.', t, 31, 37.4, 960, 36)
    if 38 <= t < 46:
        a = seg(t, 38, 38.6)
        c.text((W // 2, 260), 'Remember', 56, CYAN, True, a=a, anchor='mm')
        for i, s in enumerate(['Decide the risk in dollars first', 'Position size = risk ÷ stop distance', 'Smaller losses keep you in the game']):
            k = seg(t, 39 + i * 1.1, 40 + i * 1.1)
            c.rect((360, 360 + i * 150, 1560, 360 + i * 150 + 112), PANEL, LINE, a=k)
            c.text((420, 360 + i * 150 + 56), s, 44, TXT, a=k, anchor='lm', bg=PANEL)
    end_card(c, t, 43.4, T)
    return T

# ---------------------------------------------------------------- video 4
def v_paper(t, c):
    T = 44
    chrome(c, t, T, 'Paper trading')
    if t < 3.4: title_card(c, t, 'How paper trading works', 'Practice with virtual money before risking real money', 3.4)
    steps = [('1', 'Start with $10,000', 'Every account begins with virtual funds'),
             ('2', 'Pick a market', 'Trade at live prices, spot or futures'),
             ('3', 'Set size, stop-loss and take-profit', 'Plan the exit before the entry'),
             ('4', 'Review your results', 'Track P&L and learn from each trade')]
    if 3.4 <= t < 38:
        a = seg(t, 3.4, 4) * (1 - seg(t, 37.4, 38))
        # left: step list
        for i, (n, head, sub) in enumerate(steps):
            t0 = 4.5 + i * 7.5; k = .35 + .65 * seg(t, t0, t0 + .7)
            active = t0 <= t < t0 + 7.5
            y = 250 + i * 160
            c.rect((140, y, 900, y + 130), PANEL2 if active else PANEL, CYAN if active else LINE, a=a * k)
            c.d.ellipse((170, y + 30, 240, y + 100), fill=mix(CYAN if active else LINE, BG, a * k))
            c.text((205, y + 65), n, 40, BG if active else MUTED, True, a=a * k, anchor='mm', bg=CYAN)
            c.text((270, y + 48), head, 34, TXT, True, a=a * k, anchor='lm', bg=PANEL)
            c.text((270, y + 92), sub, 26, MUTED, a=a * k, anchor='lm', bg=PANEL)
        # right: mock terminal
        c.rect((980, 250, 1800, 880), PANEL, LINE, a=a)
        c.text((1020, 285), 'BTCUSDT', 34, TXT, True, a=a, bg=PANEL); c.text((1780, 285), 'Paper account', 26, MUTED, a=a, anchor='ra', bg=PANEL)
        bal = 10000 + 21.25 * seg(t, 30.5, 33.5)
        c.text((1020, 345), 'Balance', 24, MUTED, a=a, bg=PANEL); c.text((1020, 380), '${:,.2f}'.format(bal), 44, CYAN, True, a=a, bg=PANEL)
        import random
        rnd = random.Random(11); p = 100.0; cs = []
        for i in range(14):
            o = p; p = o + rnd.uniform(-3.2, 4.6); cs.append((o, p, max(o, p) + rnd.uniform(.6, 2), min(o, p) - rnd.uniform(.6, 2)))
        lo_v = min(x[3] for x in cs); hi_v = max(x[2] for x in cs)
        gy0, gy1 = 470, 840
        yy = lambda v: gy1 - (v - lo_v) / (hi_v - lo_v) * (gy1 - gy0)
        n_show = int(clamp((t - 8.6) / 6.5) * 14) if t > 8.6 else 0
        for i, (o, cl, hi, lo) in enumerate(cs[:n_show]):
            x = 1030 + i * 34; col = GREEN if cl >= o else RED
            c.line((x + 12, yy(hi)), (x + 12, yy(lo)), col, 3, a=a, bg=PANEL)
            c.rect((x, min(yy(o), yy(cl)), x + 24, max(yy(o), yy(cl)) + 3), col, None, r=3, a=a, bg=PANEL)
        k = seg(t, 19.5, 20.5) * (1 - seg(t, 27, 27.6))
        if k > 0:
            c.rect((1510, 430, 1780, 850), PANEL2, AMBER, a=a * k, bg=PANEL)
            c.text((1645, 475), 'Order ticket', 28, MUTED, a=a * k, anchor='mm', bg=PANEL2)
            for j, (lab, val, col) in enumerate([('Size', '0.01 BTC', TXT), ('Stop-loss', 'set', RED), ('Take-profit', 'set', GREEN)]):
                kk = seg(t, 20.2 + j * .9, 21 + j * .9)
                c.text((1535, 560 + j * 95), lab, 26, MUTED, a=a * k * kk, bg=PANEL2); c.text((1755, 600 + j * 95), val, 34, col, True, a=a * k * kk, anchor='ra', bg=PANEL2)
        k = seg(t, 30, 31) * (1 - seg(t, 37, 37.6))
        if k > 0:
            c.rect((1510, 430, 1780, 850), PANEL2, GREEN, a=a * k, bg=PANEL)
            c.text((1645, 500), 'Closed trade', 28, MUTED, a=a * k, anchor='mm', bg=PANEL2)
            v = lerp(0, 21.25, seg(t, 30.5, 33.5))
            c.text((1645, 640), '+$%.2f' % v, 52, GREEN, True, a=a * k, anchor='mm', bg=PANEL2)
            c.text((1645, 760), 'Example result', 26, MUTED, a=a * k, anchor='mm', bg=PANEL2)
        caption(c, 'Reset the balance any time to test a new idea from a clean slate.', t, 33.5, 37, 960, 32)
    if 38 <= t < 44:
        a = seg(t, 38, 38.6)
        c.text((W // 2, 260), 'Remember', 56, CYAN, True, a=a, anchor='mm')
        for i, s in enumerate(['Paper results are practice, not a promise', 'Test your plan, stops and sizing first', 'Real markets add emotion, fees and slippage']):
            k = seg(t, 39 + i * .9, 39.8 + i * .9)
            c.rect((360, 360 + i * 150, 1560, 360 + i * 150 + 112), PANEL, LINE, a=k)
            c.text((420, 360 + i * 150 + 56), s, 44, TXT, a=k, anchor='lm', bg=PANEL)
    end_card(c, t, 41.4, T)
    return T

VIDEOS = {'leverage-liquidation-explained': v_liquidation, 'order-book-explained': v_orderbook,
          'position-sizing-1-percent-rule': v_sizing, 'paper-trading-how-it-works': v_paper}
POSTER_AT = {'leverage-liquidation-explained': 36, 'order-book-explained': 22, 'position-sizing-1-percent-rule': 27, 'paper-trading-how-it-works': 21}

def render(slug):
    fn = VIDEOS[slug]; dur = fn(0, Canvas())
    mp4 = os.path.join(OUT, slug + '.mp4')
    cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '%dx%d' % (W, H), '-r', str(FPS), '-i', '-',
           '-vf', 'scale=1280:720:flags=lanczos', '-c:v', 'libx264', '-preset', 'medium', '-crf', '22', '-pix_fmt', 'yuv420p',
           '-profile:v', 'high', '-movflags', '+faststart', '-an', mp4]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for f in range(int(dur * FPS)):
        c = Canvas(); fn(f / FPS, c); p.stdin.write(c.im.tobytes())
    p.stdin.close(); p.wait()
    c = Canvas(); fn(POSTER_AT[slug], c)
    c.im.resize((1280, 720), Image.LANCZOS).save(os.path.join(OUT, slug + '.jpg'), quality=86, optimize=True, progressive=True)
    print('done', slug, dur, 's')

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for s in (sys.argv[1:] or list(VIDEOS)): render(s)