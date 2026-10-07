import numpy as np, random, math, re, sys
from PIL import Image

W, H = 720, 480
R = random.Random(21)
BAY = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0
YY, XX = np.mgrid[0:H, 0:W]
BAYF = BAY[YY % 4, XX % 4]


def hx(h):
    return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], float)


def sh(h, f):
    c = np.clip(hx(h) * f, 0, 255).astype(int)
    return '#%02x%02x%02x' % tuple(c)


class Layer:
    def __init__(s):
        s.c = np.zeros((H, W, 3)); s.a = np.zeros((H, W), bool); s.em = np.zeros((H, W))

    def rect(s, x, y, w, h, col, em=0.0):
        x0, y0, x1, y1 = max(0, int(x)), max(0, int(y)), min(W, int(x + w)), min(H, int(y + h))
        if x1 <= x0 or y1 <= y0: return
        s.c[y0:y1, x0:x1] = hx(col); s.a[y0:y1, x0:x1] = True; s.em[y0:y1, x0:x1] = em

    def px(s, x, y, col, em=0.0):
        s.rect(x, y, 1, 1, col, em)

    def mask(s, m, col, em=0.0):
        s.c[m] = hx(col); s.a[m] = True; s.em[m] = em

    def ellipse(s, cx, cy, rx, ry, col, em=0.0):
        s.mask(((XX - cx) / rx) ** 2 + ((YY - cy) / ry) ** 2 <= 1, col, em)

    def sprite(s, rows, pal, ox, oy, sc=1, em=None):
        em = em or {}
        for y, row in enumerate(rows):
            for x, ch in enumerate(row):
                if ch in pal: s.rect(ox + x * sc, oy + y * sc, sc, sc, pal[ch], em.get(ch, 0.0))

    def dark(s, x, y, w, h, f=0.6, dens=0.5):
        x0, y0, x1, y1 = max(0, int(x)), max(0, int(y)), min(W, int(x + w)), min(H, int(y + h))
        if x1 <= x0 or y1 <= y0: return
        m = BAYF[y0:y1, x0:x1] < dens
        sub = s.c[y0:y1, x0:x1]; sub[m] = sub[m] * f

    def vgrad(s, m, y0, y1, stops, em=0.0):
        t = np.clip((YY - y0) / max(1, (y1 - y0)), 0, 0.9999) * (len(stops) - 1)
        i = np.floor(t).astype(int); fr = t - i
        cols = np.array([hx(c) for c in stops])
        pick = np.where(fr > BAYF, i + 1, i)
        s.c[m] = cols[pick][m]; s.a[m] = True; s.em[m] = em


def ri(a, b): return R.randint(a, b)
def pick(a): return R.choice(a)


GOLD, GOLDD, CREAM = '#E0B15A', '#B88A3A', '#EFE3C8'
WOOD, WOODH, WOODD, WOODDD = '#8A5633', '#B0733F', '#5E3A24', '#3E241A'
B = Layer(); F = Layer()

# ---------- wall ----------
B.rect(0, 0, W, 322, '#6E4335')
for x in range(0, W, 30):
    f = R.uniform(0.9, 1.08)
    B.rect(x, 0, 30, 322, sh('#6E4335', f))
    B.rect(x, 0, 1, 322, '#3A211C'); B.rect(x + 1, 0, 1, 322, sh('#8A5744', f))
    for _ in range(14):
        gx, gy, gl = x + ri(3, 27), ri(20, 300), ri(6, 26)
        B.rect(gx, gy, 1, gl, sh('#6E4335', f * pick([0.82, 0.86, 1.14])))
    if R.random() < 0.5:
        kx, ky = x + ri(6, 22), ri(40, 280)
        B.rect(kx, ky, 4, 3, '#4A2B22'); B.rect(kx + 1, ky + 1, 2, 1, '#2E1A15'); B.rect(kx - 1, ky + 3, 6, 1, sh('#6E4335', 0.85))
# ceiling beam + corbels
B.rect(0, 0, W, 16, '#5E3A24'); B.rect(0, 14, W, 2, '#8A5633'); B.rect(0, 16, W, 2, '#2A1712'); B.dark(0, 18, W, 6, 0.6, 0.5)
for x in range(0, W, 48): B.rect(x + ri(0, 20), ri(3, 11), ri(8, 22), 1, '#4A2B1C')
for cx0 in (196, 524):
    for i in range(12): B.rect(cx0 - 6 + (i // 2 if cx0 < 360 else 0), 16 + i, 12 - i // 2, 1, '#5E3A24')
    B.rect(cx0 - 6, 16, 12, 2, '#8A5633')

# ---------- window ----------
cx, ay, RR, wbot = 360, 122, 96, 262
def arch(r): return (YY < wbot) & (((YY >= ay) & (np.abs(XX - cx) <= r)) | ((YY < ay) & ((XX - cx) ** 2 + (YY - ay) ** 2 <= r * r)))
B.mask(arch(RR + 13), '#4A2B1C'); B.mask(arch(RR + 11), '#8A5633'); B.mask(arch(RR + 8), '#A86C3C'); B.mask(arch(RR + 5), '#6E4329'); B.mask(arch(RR + 2), '#2E1A12')
glass = arch(RR)
B.vgrad(glass, ay - RR, 228, ['#0A0A20', '#0E0E2C', '#14133C', '#1C1A4E', '#272463', '#35307A', '#463D90', '#5E4FA4', '#7A62B0'], 1.0)
SKY = B.c.copy()
for _ in range(220):
    y = ri(ay - RR + 4, 200); x = cx + ri(-RR, RR)
    if glass[y, x]: B.px(x, y, pick(['#EFE3C8', '#EFE3C8', '#9A96E0', '#C4C0F5', '#6E69C0']), 1.0)
for (x, y) in [(300, 60), (438, 118), (286, 132), (332, 44), (420, 168), (392, 96), (316, 100)]:
    B.rect(x - 2, y, 5, 1, '#FBF3DC', 1.0); B.rect(x, y - 2, 1, 5, '#FBF3DC', 1.0); B.px(x, y, '#FFFFFF', 1.0)
# moon
mm = ((XX - 418) ** 2 + (YY - 56) ** 2 <= 14 * 14) & ~((XX - 411) ** 2 + (YY - 51) ** 2 <= 13 * 13) & glass
halo = ((XX - 418) ** 2 + (YY - 56) ** 2 <= 24 * 24) & glass & (BAYF < 0.3)
B.mask(halo, '#2A2870', 1.0); B.mask(mm, '#F6ECC4', 1.0)

# clouds
for (x, y, w) in [(286, 104, 46), (372, 150, 60), (300, 172, 40), (410, 128, 30)]:
    for i in range(4):
        ww = w - abs(i - 1.5) * 10
        m = (YY == y + i) & (np.abs(XX - (x + w / 2)) < ww / 2) & glass & (BAYF < 0.75)
        B.mask(m, '#3F3A8C' if i < 2 else '#2E2A72', 1.0)
# mountains
def ridge(base, amp, col, snow=None, seed=0):
    for x in range(cx - RR, cx + RR + 1):
        h = int(base + amp * (0.5 * math.sin(x * 0.045 + seed) + 0.3 * math.sin(x * 0.11 + seed * 2) + 0.2 * math.sin(x * 0.31 + seed * 3)))
        for y in range(228 - h, 228):
            if glass[y, x]:
                c = col
                if snow and y < 228 - h + 3 + (x % 3 == 0) and h > base + amp * 0.25: c = snow
                B.px(x, y, c, 1.0)
ridge(46, 22, '#3D3884', '#8580C8', 1.0); ridge(30, 14, '#2B2768', None, 2.4); ridge(14, 8, '#1B1947', None, 4.1)
# castle
CS = '#100F2A'
def tower(x, y, w, h, roof=True):
    B.rect(x, y, w, h, CS, 1.0)
    for i in range(-1, w + 1, 2): B.px(x + i, y - 1, CS, 1.0)
    if roof:
        for i in range(w // 2 + 2): B.rect(x - 1 + i, y - 2 - i * 2, w + 2 - i * 2, 2, CS, 1.0)
        B.rect(x + w // 2, y - 2 - (w // 2 + 2) * 2 - 4, 1, 5, CS, 1.0); B.rect(x + w // 2 + 1, y - (w // 2 + 2) * 2 - 6, 3, 2, '#B84A52', 1.0)
B.rect(304, 210, 52, 18, CS, 1.0)
for i in range(304, 356, 3): B.px(i, 209, CS, 1.0)
tower(300, 200, 9, 28); tower(346, 204, 9, 24); tower(322, 186, 12, 42); tower(312, 206, 6, 22, False); tower(338, 196, 6, 32)
B.rect(356, 214, 40, 3, CS, 1.0)
for i in range(3):
    B.rect(360 + i * 12, 217, 3, 11, CS, 1.0)
for (x, y) in [(326, 196), (329, 208), (303, 206), (305, 216), (349, 210), (340, 204), (316, 214), (333, 216), (324, 220), (345, 220), (310, 222), (328, 212)]:
    B.rect(x, y, 2, 3, '#F6C56B', 1.0)
for i in range(16): B.px(cx - 88 + i * 11 + ri(0, 6), 227, '#F6C56B', 1.0)
# lake
lake = glass & (YY >= 228)
B.vgrad(lake, 228, wbot, ['#231F5C', '#1C1A4E', '#15143E', '#100F30'], 1.0)
for _ in range(110):
    y = ri(230, wbot - 2); x = cx + ri(-RR, RR - 10); l = ri(4, 14)
    for i in range(l):
        if glass[y, min(W - 1, x + i)]: B.px(x + i, y, pick(['#2E2B70', '#3A3684', '#17153E']), 1.0)
for y in range(231, wbot - 2, 3):
    for (x0, c) in [(326, '#C9963A'), (346, '#B88A3A'), (306, '#B88A3A')]: B.rect(x0 + ri(-3, 3), y, ri(2, 5), 1, c, 1.0)
    B.rect(414 + ri(-4, 2), y + 1, ri(4, 10), 1, '#D9CFA8', 1.0)
# foreground pines in window
def pine(x, base, h, col='#0A0920'):
    for i in range(h):
        w = 1 + (i % 7) + i // 9
        for xx in range(x - w, x + w + 1):
            if 0 <= xx < W and glass[base - h + i, xx]: B.px(xx, base - h + i, col, 1.0)
for (x, h) in [(274, 58), (288, 40), (300, 26), (446, 62), (432, 44), (420, 28), (268, 30), (452, 34)]: pine(x, wbot, h)
# mullions
def bar(m, light='#8A5633', dk='#4A2B1C'): B.mask(m & glass, dk)
B.mask(glass & (np.abs(XX - cx) <= 3), '#4A2B1C'); B.mask(glass & (np.abs(XX - cx) <= 1), '#8A5633'); B.mask(glass & (XX == cx - 1), '#A86C3C')
for yb in (ay, 192):
    B.mask(glass & (np.abs(YY - yb) <= 2), '#4A2B1C'); B.mask(glass & (YY == yb - 1), '#A86C3C'); B.mask(glass & (YY == yb), '#8A5633')
rr = np.sqrt((XX - cx) ** 2 + (YY - ay) ** 2)
B.mask(glass & (YY < ay) & (np.abs(rr - 52) <= 2), '#4A2B1C'); B.mask(glass & (YY < ay) & (np.abs(rr - 52) <= 0.6), '#8A5633')
for ang in (22.5, 67.5, 112.5, 157.5):
    a = math.radians(ang); dx, dy = math.cos(a), -math.sin(a)
    dist = np.abs((XX - cx) * dy - (YY - ay) * dx)
    along = (XX - cx) * dx + (YY - ay) * dy
    B.mask(glass & (YY < ay) & (dist <= 1.4) & (along > 52) , '#4A2B1C')
for xq in (cx - 48, cx + 48):
    B.mask(glass & (YY >= ay) & (np.abs(XX - xq) <= 1), '#4A2B1C')
# glass sheen
for i in range(60):
    x, y = 280 + i, 250 - i * 2
    for k in range(0, 9, 3):
        if 0 <= y - k < H and glass[y - k, x] and (x + y) % 2 == 0 and B.em[y - k, x] == 1.0: B.c[y - k, x] = np.clip(B.c[y - k, x] * 1.25 + 8, 0, 255)
# sill + cabinet
B.rect(240, wbot, 240, 4, '#C08248'); B.rect(240, wbot, 240, 1, '#D99A5A'); B.rect(240, wbot + 4, 240, 7, WOOD); B.rect(240, wbot + 10, 240, 1, WOODDD); B.dark(244, wbot + 11, 232, 5, 0.5, 0.5)
B.rect(226, 276, 268, 46, '#7A4A2E'); B.rect(226, 276, 268, 1, '#A86C3C')
for i in range(3):
    x = 232 + i * 88
    B.rect(x, 282, 80, 34, '#6A3F27'); B.rect(x, 282, 80, 1, '#4A2B1C'); B.rect(x, 282, 1, 34, '#4A2B1C'); B.rect(x + 2, 314, 78, 1, '#8A5633'); B.rect(x + 79, 284, 1, 32, '#8A5633')
    B.rect(x + 34, 296, 12, 3, GOLD); B.rect(x + 34, 299, 12, 1, GOLDD); B.px(x + 34, 296, GOLDD); B.px(x + 45, 296, GOLDD)

# ---------- banners ----------
MEEP = ['...mmm...', '..mmmmm..', '..mmmmm..', '...mmm...', '.mmmmmmm.', 'mmmmmmmmm', 'mmmmmmmmm', '..mmmmm..', '..mm.mm..', '.mmm.mmm.']
for x0 in (212, 476):
    B.rect(x0 - 4, 46, 40, 3, GOLD); B.rect(x0 - 4, 49, 40, 1, GOLDD); B.rect(x0 - 6, 45, 3, 5, GOLD); B.rect(x0 + 35, 45, 3, 5, GOLD)
    for i in range(32):
        f = [1.0, 1.06, 1.0, 0.92, 0.84, 0.92, 1.0, 1.08][i % 8]
        hh = 128 + (abs(i - 15.5) - 4) * 1.6 if True else 0
        B.rect(x0 + i, 50, 1, int(hh), sh('#A3303F', f))
    for i in range(32):
        hh = int(128 + (abs(i - 15.5) - 4) * 1.6)
        B.px(x0 + i, 50 + hh - 1, GOLDD); B.px(x0 + i, 50 + hh - 2, GOLD)
        if i % 3 == 0: B.rect(x0 + i, 50 + hh, 1, 3, GOLDD)
    B.rect(x0 + 3, 52, 1, 118, GOLD); B.rect(x0 + 28, 52, 1, 118, GOLD); B.rect(x0 + 3, 54, 26, 1, GOLD)
    B.sprite(MEEP, {'m': GOLD}, x0 + 7, 92, 2)
    for (sx, sy) in [(16, 74), (16, 132), (9, 144), (23, 144)]:
        B.rect(x0 + sx - 2, 50 + sy - 50 + 50, 5, 1, GOLD); B.rect(x0 + sx, sy - 2, 1, 5, GOLD)
    B.dark(x0 + 32, 54, 3, 120, 0.55, 0.6)
# ---------- sconces ----------
for x in (200, 520):
    B.rect(x - 8, 152, 17, 3, GOLD); B.rect(x - 8, 155, 17, 1, GOLDD); B.rect(x - 2, 156, 5, 10, GOLDD); B.rect(x - 5, 166, 11, 2, GOLD); B.rect(x - 1, 168, 3, 6, GOLDD)
    B.rect(x - 3, 130, 7, 22, '#EFE6CC'); B.rect(x + 2, 130, 2, 22, '#C9BE9E'); B.rect(x - 3, 130, 1, 22, '#FFFAE8'); B.rect(x - 4, 134, 1, 6, '#EFE6CC'); B.rect(x + 4, 138, 1, 8, '#EFE6CC')
    B.rect(x, 126, 1, 4, '#3A2A1C')
    B.sprite(['..o..', '.oyo.', '.oyo.', 'oyWyo', 'oyWyo', 'oyWyo', '.oyo.', '..b..'], {'o': '#F0A23C', 'y': '#F6C56B', 'W': '#FFF6D0', 'b': '#6FA0E0'}, x - 2, 118, 1, {'o': 1, 'y': 1, 'W': 1, 'b': 1})

# ---------- shelves ----------
src = open(sys.argv[1], encoding='utf8').read()  # 첫 인자: apps/web/src/pixel.ts (책장 상자에 넣을 아이콘을 읽습니다)
ICONS = [[s for s in re.findall(r"'([.a-z]+)'", body)] for body in re.findall(r"'[A-Z][A-Za-z: ]+': \[(.*?)\]", src[src.index('const ICONS'):src.index('const DEFAULT_ICON')])]
IPAL = {'w': '#FBF3DC', 'g': '#EBCB86', 'k': '#1B1220', 'r': '#D2505A', 'b': '#4E9FDB', 'c': '#A9D8F7', 'n': '#57C98A', 'p': '#9B6BE0', 'o': '#F0A23C', 'y': '#A8703F', 's': '#B5B1BE'}
bookC = ['#B0424F', '#3F6A9E', '#4F9463', '#C99A3E', '#7E55A0', '#D2743E', '#3F8A8F', '#8A4A7A', '#9A3A3A', '#2F5F7A', '#5A6FB0']
boxC = ['#3F5F9A', '#A8404C', '#3F8A72', '#7A58B8', '#C9963A', '#4A4690', '#C96A3A', '#2F6F8A']
liq = ['#A77BF0', '#5FC8F0', '#F070A8', '#70E8A0', '#F0C45A', '#F08060']
icon_i = [0]

def book(L, x, y, w, h, c):
    L.rect(x, y - h, w, h, c); L.rect(x, y - h, 1, h, sh(c, 1.3)); L.rect(x + w - 1, y - h, 1, h, sh(c, 0.62)); L.rect(x, y - h, w, 1, sh(c, 1.45))
    L.rect(x + 1, y - h + 4, w - 2, 1, GOLD); L.rect(x + 1, y - h + 6, w - 2, 1, GOLD); L.rect(x + 1, y - 6, w - 2, 1, GOLD)
    if w >= 6 and h > 30:
        L.rect(x + 1, y - h + 12, w - 2, 8, sh(c, 0.7)); L.rect(x + 2, y - h + 14, w - 4, 1, CREAM); L.rect(x + 2, y - h + 17, w - 4, 1, CREAM)
    elif R.random() < 0.5: L.rect(x + w // 2 - 1, y - h // 2 - 1, 2, 2, GOLD)

def gbox(L, x, y, w, h, c):
    L.rect(x, y - h, w, h, c); L.rect(x, y - h, w, 1, sh(c, 1.45)); L.rect(x, y - h, 1, h, sh(c, 1.3)); L.rect(x + w - 5, y - h, 5, h, sh(c, 0.55)); L.rect(x + w - 5, y - h, 1, h, sh(c, 0.4))
    pw, ph = w - 11, h - 14
    L.rect(x + 3, y - h + 3, pw, ph, sh(c, 0.35)); L.rect(x + 3, y - h + 3, pw, 1, sh(c, 0.22))
    ic = ICONS[icon_i[0] % len(ICONS)]; icon_i[0] += 1
    sc = 2 if pw >= 34 and ph >= len(ic) * 2 + 2 else 1
    L.sprite(ic, IPAL, x + 3 + (pw - 16 * sc) // 2, y - h + 3 + (ph - len(ic) * sc) // 2, sc)
    L.rect(x + 3, y - 9, pw, 5, CREAM); L.rect(x + 5, y - 7, pw - 8, 1, sh(c, 0.5)); L.rect(x + 3, y - 3, pw // 2, 1, GOLD)

def flask(L, x, y, c):
    r = ri(5, 7); cxx = x + r
    L.ellipse(cxx, y - r - 0.5, r + 0.3, r + 0.3, sh(c, 0.4), 0.15)
    m = ((XX - cxx) ** 2 + (YY - (y - r - 0.5)) ** 2 <= (r - 1) ** 2) & (YY > y - r - 2)
    L.mask(m, c, 0.45); L.mask(m & (YY == y - r - 1), sh(c, 1.4), 0.5)
    L.rect(cxx - 1, y - 2 * r - 6, 3, 7, sh(c, 0.5), 0.1); L.rect(cxx - 2, y - 2 * r - 8, 5, 2, '#C9A26B'); L.px(cxx - r + 2, y - r - 3, '#FFFFFF', 0.5); L.px(cxx - r + 2, y - r - 2, '#FFFFFF', 0.5)
    return 2 * r + 1

def vial(L, x, y, c):
    w, h = ri(5, 7), ri(16, 24)
    L.rect(x, y - h, w, h, sh(c, 0.4), 0.15); L.rect(x + 1, y - h + ri(4, 8), w - 2, h, c, 0.45); L.rect(x, y - 1, w, 1, sh(c, 0.4)); L.rect(x + 1, y - h + 2, 1, h - 4, sh(c, 1.6), 0.5)
    L.rect(x + w // 2 - 1, y - h - 4, 3, 4, sh(c, 0.5)); L.rect(x + w // 2 - 1, y - h - 6, 3, 2, '#C9A26B')
    return w

def jar(L, x, y):
    w, h = ri(11, 14), ri(13, 17)
    L.rect(x, y - h, w, h, '#5A7A86', 0.1); L.rect(x + 1, y - h + 1, w - 2, h - 2, '#31454E', 0.1); L.rect(x + 1, y - h + 1, 1, h - 3, '#9CC7D4', 0.3)
    for _ in range(9): L.rect(x + ri(2, w - 4), y - ri(2, h - 5), 2, 2, pick(['#EFE3C8', '#D2505A', '#EBCB86', '#57C98A', '#4E9FDB']), 0.2)
    L.rect(x - 1, y - h - 3, w + 2, 3, '#8A5633'); L.rect(x - 1, y - h - 3, w + 2, 1, '#B0733F')
    return w

def candle(L, x, y):
    L.rect(x, y - 3, 9, 3, GOLDD); L.rect(x, y - 3, 9, 1, GOLD); h = ri(8, 14)
    L.rect(x + 3, y - 3 - h, 3, h, '#EFE6CC'); L.rect(x + 5, y - 3 - h, 1, h, '#C9BE9E')
    L.sprite(['.o.', 'oyo', 'oWo', '.o.'], {'o': '#F0A23C', 'y': '#F6C56B', 'W': '#FFF6D0'}, x + 3, y - 8 - h, 1, {'o': 1, 'y': 1, 'W': 1})
    return 9

def potplant(L, x, y, big=False):
    w = 12 if not big else 16
    L.rect(x + 1, y - 8, w - 2, 8, '#B5653F'); L.rect(x, y - 10, w, 3, '#C97848'); L.rect(x + w - 3, y - 8, 2, 8, '#8A4A2E'); L.rect(x, y - 10, w, 1, '#DE9460')
    cxp = x + w // 2
    for a in range(-80, 81, 20 if not big else 16):
        ln = ri(9, 15) if not big else ri(14, 22)
        for r_ in range(ln):
            px_ = cxp + math.sin(math.radians(a)) * r_; py_ = y - 10 - math.cos(math.radians(a)) * r_ + (r_ * r_) * 0.012 * abs(a) / 40
            c = pick(['#4F9455', '#3F7A45', '#5FAE66'])
            L.rect(round(px_), round(py_), 2 if r_ < ln - 2 else 1, 1, c)
            if r_ % 3 == 1: L.px(round(px_) + (1 if a >= 0 else -1) * 2, round(py_), '#6FBE76')
    return w

def figurine(L, x, y):
    c = pick(['#D2505A', '#4E9FDB', '#57C98A', '#EBCB86', '#9B6BE0'])
    L.sprite(MEEP, {'m': c}, x, y - 10); L.rect(x + 1, y - 1, 3, 1, sh(c, 0.6)); L.rect(x + 5, y - 1, 3, 1, sh(c, 0.6)); L.rect(x + 7, y - 6, 2, 3, sh(c, 0.7))
    return 9

def shelf(x0, w, skip=None):
    B.rect(x0, 18, w, 304, '#4A2C24')
    for xx in range(x0 + 10, x0 + w, 24): B.rect(xx, 30, 1, 258, '#3A211C')
    B.dark(x0, 28, w, 260, 0.82, 0.5)
    ys = [84, 150, 216, 282]
    for y in ys:
        B.dark(x0, y - 60, w, 14, 0.55, 0.6); B.dark(x0, y - 46, w, 8, 0.6, 0.3)
        x = x0 + 9; lim = x0 + w - 9
        while x < lim - 5:
            if skip and skip(x, y): x += 4; continue
            t = R.random(); room = lim - x
            if t < 0.30:
                for _ in range(ri(2, 6)):
                    bw = ri(4, 8)
                    if x + bw > lim: break
                    book(B, x, y, bw, ri(26, 46), pick(bookC)); x += bw
                x += ri(0, 2)
            elif t < 0.56 and room > 30:
                bw = min(ri(30, 44), room); bh = ri(36, 50)
                gbox(B, x, y, bw, bh, pick(boxC)); x += bw + ri(1, 3)
            elif t < 0.70 and room > 44:
                bw = ri(40, min(56, room)); yy = y
                for _ in range(ri(2, 4)):
                    bh = ri(9, 12); c = pick(boxC); off = ri(0, 3)
                    B.rect(x + off, yy - bh, bw - off, bh, c); B.rect(x + off, yy - bh, bw - off, 1, sh(c, 1.45)); B.rect(x + off, yy - 1, bw - off, 1, sh(c, 0.6)); B.rect(x + bw - 5, yy - bh, 5, bh, sh(c, 0.55))
                    B.rect(x + off + 4, yy - bh + 3, 14, bh - 6, CREAM); B.rect(x + off + 6, yy - bh + bh // 2, 10, 1, sh(c, 0.5)); B.rect(x + off + 22, yy - bh + bh // 2 - 1, 3, 3, GOLD)
                    yy -= bh
                if R.random() < 0.6: figurine(B, x + ri(4, bw - 16), yy)
                x += bw + ri(1, 3)
            elif t < 0.86:
                for _ in range(ri(1, 3)):
                    if x > lim - 14: break
                    k = R.random()
                    x += (flask(B, x, y, pick(liq)) if k < 0.4 else vial(B, x, y, pick(liq)) if k < 0.75 else jar(B, x, y)) + ri(1, 3)
            elif t < 0.91 and room > 10: x += candle(B, x, y) + ri(1, 3)
            elif t < 0.96 and room > 14: x += potplant(B, x, y) + ri(2, 4)
            elif room > 10: x += figurine(B, x, y) + ri(2, 4)
            else: x += 3
    for y in ys:
        B.rect(x0, y, w, 6, WOOD); B.rect(x0, y, w, 1, '#C08248'); B.rect(x0, y + 5, w, 1, WOODDD)
        for xx in range(x0, x0 + w, 40): B.rect(xx + ri(0, 20), y + ri(2, 4), ri(6, 16), 1, WOODD)
        B.dark(x0, y + 6, w, 4, 0.5, 0.7)
    B.rect(x0, 18, w, 10, WOOD); B.rect(x0, 18, w, 1, '#C08248'); B.rect(x0, 26, w, 2, WOODDD); B.rect(x0, 22, w, 1, WOODD)
    B.rect(x0, 288, w, 34, '#7A4A2E')
    for i in range(2):
        dx = x0 + 8 + i * (w - 16) // 2; dw = (w - 16) // 2 - 4
        B.rect(dx, 292, dw, 28, '#6A3F27'); B.rect(dx, 292, dw, 1, '#4A2B1C'); B.rect(dx, 292, 1, 28, '#4A2B1C'); B.rect(dx + 4, 296, dw - 8, 20, '#74462B'); B.rect(dx + dw - 8 if i == 0 else dx + 5, 304, 3, 4, GOLD)
    for xs in (x0, x0 + w - 7):
        B.rect(xs, 18, 7, 304, WOOD); B.rect(xs, 18, 1, 304, '#B0733F'); B.rect(xs + 6, 18, 1, 304, WOODDD)
        for _ in range(10): B.rect(xs + ri(2, 4), ri(30, 300), 1, ri(8, 22), WOODD)

shelf(0, 190)
shelf(530, 190, lambda x, y: y == 150 and 606 < x < 706)
# cat on cloth
B.rect(612, 144, 90, 6, '#A3303F'); B.rect(612, 144, 90, 1, '#C8505A')
for x in range(612, 702):
    B.rect(x, 150, 1, 8 + (2 if (x // 6) % 2 else 0), sh('#A3303F', [1, .9, .8, .9][x % 4]))
    if x % 2 == 0: B.rect(x, 158 + (2 if (x // 6) % 2 else 0), 1, 3, GOLDD)
B.rect(612, 152, 90, 1, GOLD)
CAT = ['.......................dd..dd.', '......................dood.ood', '......oooooooooo......dooooood', '...oooosoooosooooooo..oooooooo', '..ooooosoooosoooosoooookoookoo', '.oooooosoooosoooosooooooowwooo', 'ooooooooooooooooooooooooowwwoo', 'oooooooooooooooooooooooooowooo', 'dooooooooooooooooooooooooooood', '.ddooooooooooooooooooooooooodd', '...dddddddddddddddddddddddd...']
B.sprite(CAT, {'o': '#B5B1BE', 's': '#85818F', 'd': '#6F6B79', 'w': '#F3EEE6', 'k': '#2A2430'}, 644, 133)
B.rect(640, 141, 6, 3, '#B5B1BE'); B.rect(638, 139, 4, 3, '#85818F')
# vines
def vine(L, x, y0, y1):
    for y in range(y0, y1):
        if R.random() < 0.3: x += pick([-1, 1])
        L.px(x, y, '#2C5A33')
        if y % 4 == 0:
            d = pick([-1, 1]); c = pick(['#3F7A45', '#4F9455', '#5FAE66', '#2C5A33'])
            L.rect(x + d * 2 - (1 if d < 0 else 0), y - 1, 3, 2, c); L.px(x + d * 3, y + 1, c)
for (x, y1) in [(22, 120), (58, 210), (112, 160), (150, 250), (182, 140), (538, 180), (590, 110), (700, 230), (668, 96)]: vine(B, x, 18, y1)
# hanging herbs
for x in (236, 252, 262, 458, 470, 486):
    B.rect(x, 16, 1, 8, '#C9A26B'); h = ri(14, 22)
    for i in range(h):
        w = 1 + min(i, h - i) // 3
        B.rect(x - w, 24 + i, w * 2 + 1, 1, pick(['#6F8A4A', '#5A7A3F', '#8A9A55', '#A0705A']))
# sill props
LANT = ['......kkkk......', '.....k....k.....', '.....k....k.....', '......kkkk......', '.....gggggg.....', '....gggggggg....', '...gGGGGGGGGg...', '...gkyyyyyykg...', '...gkyYYYYykg...', '...gkyYWWYykg...', '...gkyYWWYykg...', '...gkyYWWYykg...', '...gkyYWWYykg...', '...gkyYYYYykg...', '...gkyyyyyykg...', '...gGGGGGGGGg...', '....gggggggg....', '...gggggggggg...']
LP = {'k': '#4A3518', 'g': '#C9963A', 'G': '#8A6628', 'y': '#F0A23C', 'Y': '#F6C56B', 'W': '#FFF6D0'}; LE = {'y': 1, 'Y': 1, 'W': 1}
potplant(B, 246, wbot, True)
B.sprite(LANT, LP, 264, wbot - 18, 1, LE)
for (x, w, h, c) in [(284, 34, 7, '#A8404C'), (287, 28, 6, '#3F6A9E'), (285, 31, 6, '#4F9463')]:
    yb = wbot - sum(hh for (_, _, hh, _) in [(284, 34, 7, 0), (287, 28, 6, 0), (285, 31, 6, 0)][:[7, 6, 6].index(h) if False else 0])
yb = wbot
for (x, w, h, c) in [(284, 34, 7, '#A8404C'), (287, 28, 6, '#3F6A9E'), (285, 31, 6, '#4F9463')]:
    B.rect(x, yb - h, w, h, c); B.rect(x, yb - h, w, 1, sh(c, 1.4)); B.rect(x + w - 5, yb - h + 1, 5, h - 2, CREAM); B.rect(x + 5, yb - h + 2, 2, h - 3, GOLD); yb -= h
for (x, w, h, c) in [(404, 6, 30, '#7E55A0'), (410, 5, 26, '#C99A3E'), (415, 7, 34, '#B0424F'), (422, 5, 28, '#3F8A8F')]: book(B, x, wbot, w, h, c)
gx, gy = 444, wbot - 16
B.rect(gx - 5, wbot - 3, 11, 3, GOLDD); B.rect(gx - 1, wbot - 6, 3, 4, GOLDD)
B.ellipse(gx, gy, 9, 9, '#3F6A9E'); B.mask(((XX - gx) ** 2 + (YY - gy) ** 2 <= 81) & ((XX - gx + 3) ** 2 + (YY - gy + 3) ** 2 > 60), '#2F5080')
for (dx, dy, w, h) in [(-5, -4, 4, 3), (1, -1, 5, 4), (-3, 3, 3, 2)]: B.rect(gx + dx, gy + dy, w, h, '#4F9463')
ring = np.abs(np.sqrt((XX - gx) ** 2 + ((YY - gy) * 2.6) ** 2) - 11.5) <= 0.8
B.mask(ring, GOLD); ring2 = np.abs(np.sqrt(((XX - gx) * 2.6) ** 2 + (YY - gy) ** 2) - 11.5) <= 0.8; B.mask(ring2 & (YY < gy + 10), GOLDD)
potplant(B, 460, wbot, True)

# ---------- floor ----------
B.rect(0, 322, W, 158, '#8A5A38'); B.rect(0, 322, W, 3, '#2A1712'); B.dark(0, 325, W, 6, 0.6, 0.5)
for row, y in enumerate(range(326, H, 16)):
    xs = sorted([ri(0, W) for _ in range(7)])
    prev = 0
    for xe in xs + [W]:
        f = R.uniform(0.9, 1.1); B.rect(prev, y, xe - prev, 16, sh('#8A5A38', f)); B.rect(prev, y, 1, 16, '#4E2F1E'); B.px(prev + 3, y + 3, '#3E241A'); B.px(prev + 3, y + 12, '#3E241A')
        for _ in range(max(1, (xe - prev) // 26)): B.rect(prev + ri(4, max(5, xe - prev - 20)), y + ri(3, 13), ri(8, 30), 1, sh('#8A5A38', f * pick([0.8, 0.85, 1.18])))
        prev = xe
    B.rect(0, y, W, 1, '#4E2F1E'); B.rect(0, y + 1, W, 1, sh('#8A5A38', 1.15))
# rug
B.rect(176, 414, 368, 58, '#8E2A38'); B.rect(180, 418, 360, 50, '#A3303F'); B.rect(184, 422, 352, 42, '#8E2A38')
for x in range(184, 536, 12):
    for (yy) in (424, 458):
        B.rect(x + 3, yy, 6, 1, GOLD); B.rect(x + 5, yy - 2, 2, 5, GOLD)
B.rect(180, 418, 360, 1, GOLDD); B.rect(180, 467, 360, 1, GOLDD); B.rect(180, 418, 1, 50, GOLDD); B.rect(539, 418, 1, 50, GOLDD)
for y in range(414, 472, 3): B.rect(170, y, 6, 1, CREAM); B.rect(544, y, 6, 1, CREAM)
# hearth stones
B.rect(226, 392, 268, 50, '#4A4654')
for row in range(4):
    y = 393 + row * 12; x = 227 - (row % 2) * 14
    while x < 494:
        w = ri(22, 34); c = sh('#8A8494', R.uniform(0.82, 1.08))
        xa, xb = max(227, x), min(493, x + w - 1)
        if xb > xa:
            B.rect(xa, y, xb - xa, 11, c); B.rect(xa, y, xb - xa, 1, sh(c, 1.25)); B.rect(xa, y, 1, 11, sh(c, 1.15)); B.rect(xa, y + 10, xb - xa, 1, sh(c, 0.7)); B.rect(xb - 1, y, 1, 11, sh(c, 0.75))
            for _ in range(3): B.px(ri(xa + 2, max(xa + 3, xb - 3)), y + ri(2, 8), sh(c, 0.8))
        x += w
B.rect(226, 392, 268, 1, '#B5AFC0'); B.dark(226, 442, 268, 4, 0.5, 0.6)
# pot back rim + inside
pcx, rimy = 360, 290
B.ellipse(pcx, rimy, 86, 11, '#3A3944'); B.mask((((XX - pcx) / 86) ** 2 + ((YY - rimy) / 11) ** 2 <= 1) & (YY < rimy - 6), '#6A6978'); B.ellipse(pcx, rimy + 1, 79, 9, '#16151C')

# ---------- FRONT ----------
def phw(y): return 90 * max(0.0, 1 - abs((y - 336) / 46.0) ** 3) ** (1 / 3)
iron = [hx(c) for c in ['#16151C', '#22212B', '#2E2D38', '#3D3C49', '#55546200'[:7], '#74738A']]
for y in range(300, 382):
    hw = phw(y)
    for x in range(int(pcx - hw), int(pcx + hw) + 1):
        u = (x - pcx) / max(1, hw); v = (y - 336) / 46.0
        b = 0.50 - 0.34 * u - 0.20 * v + 0.42 * math.exp(-((u + 0.55) ** 2) / 0.02 - ((v + 0.25) ** 2) / 0.5) - 0.25 * max(0, abs(u) - 0.8) * 5
        b = min(0.999, max(0, b)); t = b * (len(iron) - 1); i = int(t); i = i + 1 if (t - i) > BAY[y % 4, x % 4] and i < len(iron) - 1 else i
        F.c[y, x] = iron[i]; F.a[y, x] = True
lip = (((XX - pcx) / 88) ** 2 + ((YY - rimy) / 12) ** 2 <= 1) & (YY >= rimy + 2)
F.mask(lip | ((np.abs(XX - pcx) <= 88) & (YY >= rimy + 2) & (YY <= rimy + 9) & (((XX - pcx) / 88) ** 2 + ((YY - rimy - 3) / 12) ** 2 <= 1.0)), '#3D3C49')
F.mask((np.abs(((XX - pcx) / 88) ** 2 + ((YY - rimy) / 12) ** 2 - 0.93) < 0.08) & (YY >= rimy + 2), '#8A899E')
F.mask((np.abs(((XX - pcx) / 88) ** 2 + ((YY - rimy - 5) / 12) ** 2 - 0.96) < 0.06) & (YY >= rimy + 6), '#16151C')
for x in range(pcx - 72, pcx + 73, 16):
    y = int(312 + 6 * (1 - ((x - pcx) / 80.0) ** 2)); F.rect(x, y, 3, 3, '#74738A'); F.rect(x + 1, y + 1, 2, 2, '#22212B')
for sgn in (-1, 1):
    hxp = pcx + sgn * 96
    ringm = (np.abs(np.sqrt(((XX - hxp) / 0.7) ** 2 + (YY - 330) ** 2) - 13) <= 1.6)
    F.mask(ringm, '#55546A'); F.mask(ringm & (XX < hxp), '#74738A'); F.rect(hxp - sgn * 8 - 2, 316, 5, 6, '#3D3C49')
for (lx, w) in [(pcx - 66, 9), (pcx + 57, 9), (pcx - 4, 9)]:
    F.rect(lx, 372, w, 24, '#16151C'); F.rect(lx, 372, 2, 24, '#3D3C49'); F.rect(lx - 2, 394, w + 4, 4, '#22212B')
# logs + embers
for (x, y, w, c) in [(304, 384, 112, '#6A3F27'), (316, 377, 88, '#5E3A24')]:
    F.rect(x, y, w, 9, c); F.rect(x, y, w, 1, sh(c, 1.4)); F.rect(x, y + 8, w, 1, sh(c, 0.6))
    for _ in range(12): F.rect(ri(x + 4, x + w - 14), y + ri(2, 6), ri(4, 12), 1, sh(c, 0.7))
    for xe in (x, x + w - 6): F.rect(xe, y, 6, 9, '#C08248'); F.rect(xe + 1, y + 2, 4, 5, '#A86C3C'); F.rect(xe + 2, y + 3, 2, 3, '#8A5633')
for _ in range(50): F.rect(ri(312, 406), ri(378, 392), ri(1, 4), 1, pick(['#F0A23C', '#F6C56B', '#D2502E', '#FFF6D0']), 1.0)
# left foreground: book stack, candle, crystal bowl
yb = 474
for (x, w, h, c) in [(26, 112, 16, '#7E55A0'), (34, 100, 15, '#A8404C'), (22, 106, 14, '#3F6A9E'), (40, 84, 12, '#4F9463')]:
    F.rect(x, yb - h, w, h, c); F.rect(x, yb - h, w, 2, sh(c, 1.4)); F.rect(x, yb - 2, w, 2, sh(c, 0.6)); F.rect(x + w - 12, yb - h + 3, 12, h - 6, CREAM)
    for yy in range(yb - h + 4, yb - 3, 2): F.rect(x + w - 11, yy, 10, 1, '#C9BE9E')
    F.rect(x + 8, yb - h + 2, 4, h - 4, GOLD); F.rect(x + 22, yb - h + 2, 2, h - 4, GOLD); F.rect(x + w - 30, yb - h // 2 - 1, 8, 3, GOLD); yb -= h
F.rect(56, yb - 4, 22, 4, GOLDD); F.rect(56, yb - 4, 22, 1, GOLD); F.rect(62, yb - 26, 9, 22, '#EFE6CC'); F.rect(68, yb - 26, 3, 22, '#C9BE9E'); F.rect(61, yb - 20, 1, 8, '#EFE6CC'); F.rect(66, yb - 30, 1, 4, '#3A2A1C')
F.sprite(['..o..', '.oyo.', '.oyo.', 'oyWyo', 'oyWyo', 'oyWyo', '.oyo.', '..b..'], {'o': '#F0A23C', 'y': '#F6C56B', 'W': '#FFF6D0', 'b': '#6FA0E0'}, 62, yb - 42, 2, {'o': 1, 'y': 1, 'W': 1, 'b': 1})
bm = (((XX - 172) / 30) ** 2 + ((YY - 446) / 22) ** 2 <= 1) & (YY >= 446)
F.mask(bm, '#8A5633'); F.mask(bm & (YY < 449), '#C08248'); F.mask(bm & (XX > 186), '#5E3A24'); F.rect(160, 466, 24, 4, '#5E3A24')
CRY = ['.....P......P.....', '....PpP....PpP....', '...PppP...PpppP...', '..PpLpP..PpLppP.P.', '.PpppPPPPpppppPPpP', 'PpLppPpLPpLpppPpLP', 'PppppPppPpppppPppP']
F.sprite(CRY, {'P': '#7A4AC8', 'p': '#A77BF0', 'L': '#E5D2FF'}, 146, 432, 3 if False else 2, {'p': 0.35, 'L': 0.6, 'P': 0.2})
# right foreground: crate + lantern, ink + quill, mortar
F.rect(630, 414, 78, 60, '#8A5633'); F.rect(630, 414, 78, 3, '#C08248'); F.rect(630, 414, 3, 60, '#B0733F'); F.rect(702, 414, 6, 60, '#5E3A24')
for y in (432, 452): F.rect(633, y, 69, 1, '#5E3A24'); F.rect(633, y + 1, 69, 1, '#A86C3C')
for (x, y) in [(636, 420), (696, 420), (636, 466), (696, 466), (636, 440), (696, 440)]: F.rect(x, y, 2, 2, '#3E241A')
F.rect(656, 438, 24, 8, GOLDD); F.rect(658, 440, 20, 4, '#3E241A')
F.sprite(LANT, LP, 652, 414 - 36, 2, LE)
F.rect(588, 448, 20, 20, '#2B2950'); F.rect(588, 448, 20, 2, '#55508E'); F.rect(588, 448, 2, 20, '#4A4690'); F.rect(592, 442, 12, 6, '#3A3878'); F.rect(590, 440, 16, 3, '#6A66B0'); F.rect(590, 466, 16, 2, '#1A1838')
for i in range(58):
    x = 598 + int(i * 0.55); y = 440 - i
    w = 1 if i < 10 else int(2 + 8 * math.sin((i - 10) / 48 * math.pi))
    F.px(x, y, '#C9BE9E')
    if i >= 10:
        for k in range(1, w + 1): F.px(x + k, y - k // 3, '#F3EEE6' if (k + i) % 4 else '#D9CDB8')
        for k in range(1, w): F.px(x - k, y + k // 3, '#D9CDB8' if (k + i) % 3 else '#B9AD8E')
mm_ = (((XX - 548) / 24) ** 2 + ((YY - 446) / 24) ** 2 <= 1) & (YY >= 446)
F.mask(mm_, '#6A6978'); F.mask(mm_ & (YY < 450), '#9A99AE'); F.mask(mm_ & (XX > 558), '#3D3C49'); F.rect(538, 468, 20, 4, '#3D3C49')
for i in range(26): F.rect(552 + i // 3, 444 - i, 4, 1, '#B0733F' if i < 20 else '#D99A5A')
# corner foliage
def leaf(L, x, y, ln, ang, c):
    a = math.radians(ang); dx, dy = math.cos(a), math.sin(a)
    for t in range(ln):
        hw = max(1, int(math.sin(t / ln * math.pi) * ln * 0.28))
        for k in range(-hw, hw + 1):
            px_, py_ = int(x + dx * t - dy * k), int(y + dy * t + dx * k)
            L.px(px_, py_, sh(c, 1.25) if k == 0 else (c if k > 0 else sh(c, 0.75)))
for _ in range(26):
    leaf(F, ri(-10, 70), ri(440, 500), ri(18, 34), ri(-80, -10), pick(['#2F6A3C', '#3F7A45', '#245030', '#4F9455']))
for _ in range(22):
    leaf(F, ri(650, 730), ri(440, 500), ri(18, 34), ri(-170, -100), pick(['#2F6A3C', '#3F7A45', '#245030', '#4F9455']))
for _ in range(18):
    leaf(F, ri(-8, 40), ri(14, 60), ri(12, 24), ri(20, 110), pick(['#2F6A3C', '#3F7A45', '#245030']))
for _ in range(14):
    leaf(F, ri(684, 728), ri(14, 50), ri(12, 22), ri(80, 160), pick(['#2F6A3C', '#3F7A45', '#245030']))

# ---------- lighting ----------
LIGHTS = [(200, 126, 120, 1.0, (1.0, 0.72, 0.40)), (520, 126, 120, 1.0, (1.0, 0.72, 0.40)), (272, 254, 80, 0.9, (1.0, 0.70, 0.36)), (672, 404, 150, 1.05, (1.0, 0.70, 0.36)), (66, 392, 130, 0.95, (1.0, 0.72, 0.40)),
          (360, 398, 250, 1.25, (1.0, 0.55, 0.26)), (95, 160, 200, 0.5, (1.0, 0.74, 0.44)), (625, 160, 200, 0.5, (1.0, 0.74, 0.44)), (150, 440, 90, 0.5, (0.7, 0.5, 1.0)), (360, 190, 190, 0.45, (0.35, 0.40, 0.95)), (360, 286, 120, 0.5, (0.45, 0.55, 1.0))]
def lit(L):
    amb = np.array([0.42, 0.34, 0.52])
    Lm = np.zeros((H, W, 3)) + amb
    for (lx, ly, rad, inten, col) in LIGHTS:
        d = np.sqrt((XX - lx) ** 2 + ((YY - ly) * 1.1) ** 2) / rad
        f = np.clip(1 - d, 0, 1) ** 1.7 * inten
        fq = np.floor(f * 7 + BAYF) / 7
        Lm += fq[..., None] * np.array(col)
    vg = np.clip((np.sqrt(((XX - 360) / 360.0) ** 2 + ((YY - 270) / 250.0) ** 2) - 0.78) * 1.4, 0, 0.42)
    vq = np.floor(vg * 6 + BAYF) / 6
    Lm *= (1 - vq)[..., None]
    out = L.c * Lm
    out = L.c * L.em[..., None] + out * (1 - L.em[..., None])
    return np.clip(out, 0, 255).astype(np.uint8)

b = lit(B); f = lit(F)
out = sys.argv[2]
Image.fromarray(b, 'RGB').save(out + 'back.png', optimize=True)
fa = np.dstack([f, (F.a * 255).astype(np.uint8)])
Image.fromarray(fa, 'RGBA').save(out + 'front.png', optimize=True)
comp = b.copy(); comp[F.a] = f[F.a]
Image.fromarray(comp, 'RGB').resize((W * 2, H * 2), Image.NEAREST).save(out + 'comp.png')
print('ok', len(ICONS))
