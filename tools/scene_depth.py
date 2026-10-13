# 메인 화면 배경(atelier-back.png)의 원근 버전을 만듭니다.
# tools/scene.py의 도우미와 원래 안쪽 벽 그림(창문·배너·책장)을 그대로 가져와 안쪽 벽으로 쓰고,
# 양옆 벽·바닥·천장을 평면 그림으로 그린 뒤 1점 투시로 투영합니다. 앞 레이어(atelier-front.png)는 scene.py가 만든 것을 그대로 씁니다.
#
# 실행 (저장소 루트에서):  python tools/scene_depth.py apps/web/public/assets/ [미리보기.png] [--time=all]
#   첫 인자 폴더에 배경을 쓰고, 둘째 인자를 주면 앞 레이어까지 합친 2배 미리보기를 저장합니다.
#   --time: night(기본, atelier-back.png) · morning · noon · sunset (atelier-back-<time>.png) · all(네 장 모두).
#   시간대마다 창밖(하늘·해/달·구름·산·성·호수)과 조명만 바뀌고, 방 안의 물건은 같은 모습입니다.
# 주의: scene.py를 줄 번호로 잘라 실행하므로 scene.py를 고치면 아래 seg(...) 줄 번호도 맞춰야 합니다.
import sys, math
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = str(Path(__file__).resolve().parents[1])
ARGS = [a for a in sys.argv[1:] if not a.startswith('--')]
TIME = next((a.split('=', 1)[1] for a in sys.argv[1:] if a.startswith('--time=')), 'night')
OUT = ARGS[0] if ARGS else './'
PREVIEW = ARGS[1] if len(ARGS) > 1 else None
if TIME == 'all':
    import subprocess
    for t in ('night', 'morning', 'noon', 'sunset'):
        pv = [PREVIEW.replace('.png', f'-{t}.png')] if PREVIEW else []
        subprocess.run([sys.executable, __file__, OUT, *pv, f'--time={t}'], check=True)
    sys.exit(0)

# 시간대별 창밖 색과 조명. night는 기본 그림 그대로입니다.
SUN = {'morning': (300, 150), 'noon': (420, 52), 'sunset': (412, 196)}
WINDOW_SKY = {
    'morning': dict(sky=['#5C7FC0', '#6F92CC', '#86A6D6', '#A3B9DE', '#C3C9E0', '#E1CCD8', '#F2CFC4', '#F8D8B8', '#FBE3BE'], sun='#FFF1C8', halo='#F8D2B0',
                    cloud=('#FFFFFF', '#F3DCE0'), ridge=('#8A98C0', '#F0F0F8', '#6E80A8', '#55688E'), castle='#4A4E72', lights=False,
                    lake=['#9AB4DC', '#86A2D0', '#7290C2', '#6280B4'], ripple=['#B6CCEA', '#7E9AC8', '#A8BEE2'], glint='#FBE3BE', pine='#2E4A5A'),
    'noon': dict(sky=['#3E7FD0', '#4A8AD6', '#579ADC', '#68A8E2', '#7AB6E8', '#8EC4EC', '#A6D2F0', '#BEDFF2', '#D2E9F4'], sun='#FFFBE8', halo='#CFE6FF',
                 cloud=('#FFFFFF', '#E4EEF8'), ridge=('#7FA0C8', '#FFFFFF', '#5E8A6E', '#46704F'), castle='#4E5A78', lights=False,
                 lake=['#6FA6DC', '#5A94D0', '#4A84C4', '#3C74B4'], ripple=['#9CC6EE', '#4E88C8', '#86B8E8'], glint='#FFFFFF', pine='#2E5A40'),
    'sunset': dict(sky=['#2A2858', '#3E3270', '#5E3C84', '#8A4A8C', '#B85A82', '#DE7070', '#F08C5E', '#F7A858', '#FBC468'], sun='#FFC070', halo='#F08060',
                   cloud=('#F6B08A', '#C86A7A'), ridge=('#6A4A80', '#F0A8A0', '#4E3866', '#3A2850'), castle='#2A1E40', lights=True,
                   lake=['#C87A80', '#A45E78', '#7A4A6C', '#56385A'], ripple=['#E89A86', '#8E5070', '#D88878'], glint='#FBC468', pine='#2A1E36'),
}
LIGHTING = {  # 주변광, 창문 빛, 창문에서 바닥으로 오는 빛, 촛불·등불 세기, 거리 안개, 가장자리 어둡게
    'night':   dict(amb=(0.40, 0.32, 0.51), win=(0.35, 0.40, 0.95), winI=0.85, winR=210, flr=(0.45, 0.55, 1.0), flrI=0.45, candle=1.0, fog=0.5, vg=0.48),
    'sunset':  dict(amb=(0.56, 0.42, 0.46), win=(1.0, 0.55, 0.38), winI=1.0, winR=250, flr=(1.0, 0.55, 0.40), flrI=0.6, candle=0.85, fog=0.4, vg=0.42),
    'morning': dict(amb=(0.66, 0.60, 0.66), win=(1.0, 0.86, 0.78), winI=0.9, winR=260, flr=(1.0, 0.85, 0.75), flrI=0.55, candle=0.45, fog=0.3, vg=0.32),
    'noon':    dict(amb=(0.80, 0.76, 0.74), win=(1.0, 0.97, 0.92), winI=1.0, winR=300, flr=(1.0, 0.95, 0.90), flrI=0.6, candle=0.3, fog=0.25, vg=0.26),
}[TIME]
SRC = open(ROOT + '/tools/scene.py', encoding='utf8').read().split('\n')
seg = lambda a, b: '\n'.join(SRC[a - 1:b])
sys.argv = ['scene.py', ROOT + '/apps/web/src/pixel.ts', OUT]
g = {}
exec(seg(1, 63), g)  # helpers, palette, Layer, W/H grids

# ---------- original back wall art onto a texture ----------
g['B'] = g['Layer'](); g['F'] = g['Layer']()
exec(seg(66, 84).replace('322', '480'), g)    # plank wall (extended down)
exec(seg(85, 178).replace('cx, ay, RR, wbot = 360, 122, 96, 262', 'cx, ay, RR, wbot = 360, 134, 114, 262'), g)  # window (bigger) + sill + cabinet
# richer night sky: milky way band, denser stars, twinkling cross stars, a shooting star (only on untouched sky pixels)
exec('''
sky = glass & (B.c == SKY).all(-1)
x0b, y0b, x1b, y1b = cx - RR, ay - RR + 46, cx + RR, ay + 62
L2 = math.hypot(x1b - x0b, y1b - y0b)
dist = np.abs((XX - x0b) * (y1b - y0b) - (YY - y0b) * (x1b - x0b)) / L2
band = sky & (dist < 17) & (BAYF < 0.55 - dist / 40)
B.c[band] = np.clip(SKY[band] * 1.35 + 12, 0, 255)
core = sky & (dist < 6) & (BAYF < 0.4)
B.c[core] = np.clip(SKY[core] * 1.6 + 20, 0, 255)
for _ in range(170):
    t = R.random(); x = int(x0b + (x1b - x0b) * t + R.uniform(-15, 15)); y = int(y0b + (y1b - y0b) * t + R.uniform(-15, 15))
    if 0 <= x < W and 0 <= y < H and sky[y, x]: B.px(x, y, pick(['#C4C0F5', '#9A96E0', '#EFE3C8', '#6E69C0']), 1.0)
for _ in range(160):
    x = cx + ri(-RR, RR); y = ri(ay - RR + 2, 210)
    if sky[y, x]: B.px(x, y, pick(['#EFE3C8', '#C4C0F5', '#9A96E0', '#6E69C0', '#5A55A8']), 1.0)
for (x, y) in [(284, 82), (330, 50), (452, 150), (300, 160), (392, 74), (436, 98)]:
    if not sky[y, x]: continue
    for d in (1, 2, 3):
        c = '#FBF3DC' if d < 3 else '#9A96E0'
        for (dx, dy) in ((d, 0), (-d, 0), (0, d), (0, -d)): B.px(x + dx, y + dy, c, 1.0)
    for (dx, dy) in ((1, 1), (1, -1), (-1, 1), (-1, -1)): B.px(x + dx, y + dy, '#C4C0F5', 1.0)
    halo = sky & (((XX - x) ** 2 + (YY - y) ** 2) <= 36) & (BAYF < 0.25)
    B.c[halo] = np.clip(B.c[halo] * 1.3 + 10, 0, 255)
    B.px(x, y, '#FFFFFF', 1.0)
for i in range(30):
    x, y = 344 - i, 40 + i // 2
    if sky[y, x]: B.px(x, y, ['#FFFFFF', '#FBF3DC', '#C4C0F5', '#9A96E0', '#6E69C0'][min(4, i // 6)], 1.0)
''', g)
if TIME != 'night':
    # 낮 시간대 창밖은 밤 창문 위에 다시 그립니다. 난수 상태를 되돌려 방 안 물건은 밤과 똑같이 둡니다.
    P = WINDOW_SKY[TIME]; sx, sy = SUN[TIME]
    wsrc = seg(85, 178).replace('cx, ay, RR, wbot = 360, 122, 96, 262', 'cx, ay, RR, wbot = 360, 134, 114, 262')
    for a, b in [
        ("['#0A0A20', '#0E0E2C', '#14133C', '#1C1A4E', '#272463', '#35307A', '#463D90', '#5E4FA4', '#7A62B0']", repr(P['sky'])),
        ('for _ in range(220):', 'for _ in range(0):'),
        ('for (x, y) in [(300, 60), (438, 118), (286, 132), (332, 44), (420, 168), (392, 96), (316, 100)]:', 'for (x, y) in []:'),
        ('mm = ((XX - 418) ** 2 + (YY - 56) ** 2 <= 14 * 14) & ~((XX - 411) ** 2 + (YY - 51) ** 2 <= 13 * 13) & glass', f'mm = ((XX - {sx}) ** 2 + (YY - {sy}) ** 2 <= 13 * 13) & glass'),
        ('halo = ((XX - 418) ** 2 + (YY - 56) ** 2 <= 24 * 24) & glass & (BAYF < 0.3)', f'halo = ((XX - {sx}) ** 2 + (YY - {sy}) ** 2 <= 26 * 26) & glass & (BAYF < 0.45)'),
        ("B.mask(halo, '#2A2870', 1.0); B.mask(mm, '#F6ECC4', 1.0)", f"B.mask(halo, '{P['halo']}', 1.0); B.mask(mm, '{P['sun']}', 1.0)"),
        ("'#3F3A8C' if i < 2 else '#2E2A72'", f"'{P['cloud'][0]}' if i < 2 else '{P['cloud'][1]}'"),
        ("ridge(46, 22, '#3D3884', '#8580C8', 1.0); ridge(30, 14, '#2B2768', None, 2.4); ridge(14, 8, '#1B1947', None, 4.1)",
         f"ridge(46, 22, '{P['ridge'][0]}', '{P['ridge'][1]}', 1.0); ridge(30, 14, '{P['ridge'][2]}', None, 2.4); ridge(14, 8, '{P['ridge'][3]}', None, 4.1)"),
        ("CS = '#100F2A'", f"CS = '{P['castle']}'"),
        ("B.vgrad(lake, 228, wbot, ['#231F5C', '#1C1A4E', '#15143E', '#100F30'], 1.0)", f"B.vgrad(lake, 228, wbot, {P['lake']!r}, 1.0)"),
        ("pick(['#2E2B70', '#3A3684', '#17153E'])", f"pick({P['ripple']!r})"),
        ("B.rect(414 + ri(-4, 2), y + 1, ri(4, 10), 1, '#D9CFA8', 1.0)", f"B.rect({sx - 4} + ri(-4, 2), y + 1, ri(4, 10), 1, '{P['glint']}', 1.0)"),
        ("col='#0A0920'", f"col='{P['pine']}'"),
    ]:
        assert a in wsrc, a[:50]
        wsrc = wsrc.replace(a, b)
    if not P['lights']:  # 낮에는 성의 불빛과 호수의 따뜻한 반사가 없습니다
        wsrc = wsrc.replace("'#F6C56B', 1.0)", "CS, 1.0)").replace("[(326, '#C9963A'), (346, '#B88A3A'), (306, '#B88A3A')]", f"[(326, '{P['ripple'][0]}'), (346, '{P['ripple'][0]}'), (306, '{P['ripple'][0]}')]")
    st = g['R'].getstate(); exec(wsrc, g); g['R'].setstate(st)
exec(seg(179, 195).replace('(212, 476)', '(186, 494)'), g)  # banners only, moved out for the bigger window (no back-wall sconces)
exec(seg(203, 367).replace('shelf(0, 190)', 'shelf(0, 174)').replace('shelf(530, 190,', 'shelf(546, 174,'), g)                          # shelves, cat, vines, herbs, sill props
BACK = g['B']
exec('''
B.rect(0, 322, W, 158, '#5E3A28')
for x in range(0, W, 60):
    B.rect(x + 6, 336, 48, 132, '#53321F'); B.rect(x + 6, 336, 48, 1, '#3A211C'); B.rect(x + 6, 467, 48, 1, '#7A4A2E')
B.rect(0, 322, W, 6, WOOD); B.rect(0, 322, W, 1, '#C08248'); B.rect(0, 470, W, 10, WOODD)
''', g)

W, H = g['W'], g['H']
Layer, sh, hx, ri, pick, R = g['Layer'], g['sh'], g['hx'], g['ri'], g['pick'], g['R']
XX, YY, BAYF = g['XX'], g['YY'], g['BAYF']
GOLD, GOLDD, CREAM = g['GOLD'], g['GOLDD'], g['CREAM']
WOOD, WOODD, WOODDD = g['WOOD'], g['WOODD'], g['WOODDD']

# ---------- camera ----------
VX, VY = 360, 212          # vanishing point
TOPH, BOTH = VY, H - VY    # ceiling/floor distance at the near plane
FOC = 480                  # world px per unit depth at near plane
ZB = 1.75                   # back wall depth (near plane = 1)
DEPTH = int(FOC * (ZB - 1))  # side-wall texture length (576)

# ---------- side wall texture (bays of bookcases) ----------
def side_texture(seed):
    R.seed(seed)
    L = Layer()
    L.rect(0, 0, W, H, '#4A2C24')
    bay = DEPTH // 3
    ys = [112, 194, 276, 358]
    for b in range(3):
        x0 = b * bay + 18; w = bay - 18
        L.rect(x0, 24, w, 400, '#3A2420')
        for xx in range(x0 + 10, x0 + w, 24): L.rect(xx, 30, 1, 390, '#2E1A15')
        for y in ys:
            L.dark(x0, y - 62, w, 14, 0.55, 0.6)
            x = x0 + 8; lim = x0 + w - 8
            while x < lim - 5:
                t = R.random(); room = lim - x
                if t < 0.34:
                    for _ in range(ri(2, 6)):
                        bw = ri(4, 8)
                        if x + bw > lim: break
                        g['book'](L, x, y, bw, ri(28, 50), pick(g['bookC'])); x += bw
                    x += ri(0, 2)
                elif t < 0.62 and room > 30:
                    bw = min(ri(30, 44), room); g['gbox'](L, x, y, bw, ri(38, 54), pick(g['boxC'])); x += bw + ri(1, 3)
                elif t < 0.82:
                    k = R.random()
                    x += (g['flask'](L, x, y, pick(g['liq'])) if k < 0.4 else g['vial'](L, x, y, pick(g['liq'])) if k < 0.75 else g['jar'](L, x, y)) + ri(1, 3)
                elif t < 0.9 and room > 10: x += g['candle'](L, x, y) + ri(1, 3)
                elif t < 0.96 and room > 14: x += g['potplant'](L, x, y) + ri(2, 4)
                elif room > 10: x += g['figurine'](L, x, y) + ri(2, 4)
                else: x += 3
        for y in ys:
            L.rect(x0, y, w, 7, WOOD); L.rect(x0, y, w, 1, '#C08248'); L.rect(x0, y + 6, w, 1, WOODDD); L.dark(x0, y + 7, w, 4, 0.5, 0.7)
        L.rect(x0, 420, w, 60, '#7A4A2E'); L.rect(x0, 420, w, 2, '#A86C3C')
        for i in range(2):
            dx = x0 + 8 + i * (w - 16) // 2; dw = (w - 16) // 2 - 4
            L.rect(dx, 428, dw, 44, '#6A3F27'); L.rect(dx + 4, 432, dw - 8, 36, '#74462B'); L.rect(dx + (dw - 8 if i == 0 else 5), 446, 3, 5, GOLD)
    # pilasters with sconces between bays
    for b in range(4):
        px = min(b * bay, DEPTH - 18)
        L.rect(px, 0, 18, H, WOOD); L.rect(px, 0, 2, H, '#B0733F'); L.rect(px + 16, 0, 2, H, WOODDD)
        L.rect(px - 3, 24, 24, 8, '#A86C3C'); L.rect(px - 3, 452, 24, 28, '#5E3A24')
        sx = px + 9
        L.rect(sx - 7, 214, 15, 3, GOLD); L.rect(sx - 2, 217, 5, 9, GOLDD)
        L.rect(sx - 3, 194, 7, 20, '#EFE6CC'); L.rect(sx + 2, 194, 2, 20, '#C9BE9E')
        L.sprite(['..o..', '.oyo.', 'oyWyo', 'oyWyo', '.oyo.'], {'o': '#F0A23C', 'y': '#F6C56B', 'W': '#FFF6D0'}, sx - 2, 188, 1, {'o': 1, 'y': 1, 'W': 1})
    # crown molding
    L.rect(0, 0, DEPTH, 24, '#5E3A24'); L.rect(0, 20, DEPTH, 2, '#8A5633'); L.rect(0, 22, DEPTH, 2, '#2A1712')
    for (x, y1) in [(40, 150), (150, 110), (260, 190), (430, 140), (520, 170)]: g['vine'](L, x + ri(-10, 10), 24, y1)
    return L

LW, RW = side_texture(5), side_texture(17)
# a hanging banner on each wall, in the middle bay
for L, c in ((LW, '#A3303F'), (RW, '#2F6A4C')):
    x0 = DEPTH // 3 + 70
    L.rect(x0 - 4, 30, 44, 3, GOLD)
    for i in range(36):
        hh = int(150 + (abs(i - 17.5) - 5) * 1.8)
        L.rect(x0 + i, 33, 1, hh, sh(c, [1.0, 1.06, 1.0, 0.92, 0.84, 0.92][i % 6]))
        L.px(x0 + i, 33 + hh - 1, GOLD)
    L.sprite(g['MEEP'], {'m': GOLD}, x0 + 9, 80, 2)

# ---------- floor texture (u: world x, v: depth) ----------
FL = Layer()
FL.rect(0, 0, W, H, '#8A5A38')
R.seed(3)
for u0 in range(0, W, 24):
    v = -ri(0, 120)
    while v < H:
        ln = ri(90, 200); f = R.uniform(0.86, 1.12)
        FL.rect(u0, v, 24, ln, sh('#8A5A38', f)); FL.rect(u0, v, 24, 1, '#4E2F1E')
        for _ in range(3): FL.rect(u0 + ri(3, 20), v + ri(4, max(5, ln - 30)), 1, ri(10, 30), sh('#8A5A38', f * pick([0.8, 0.86, 1.16])))
        v += ln
    FL.rect(u0, 0, 1, H, '#4E2F1E'); FL.rect(u0 + 1, 0, 1, H, sh('#8A5A38', 1.12))
# runner rug down the middle
FL.rect(250, 10, 220, 330, '#8E2A38'); FL.rect(256, 16, 208, 318, '#A3303F'); FL.rect(264, 24, 192, 302, '#8E2A38')
for v in range(30, 320, 14):
    for u in (272, 444): FL.rect(u, v + 3, 6, 1, GOLD); FL.rect(u + 2, v + 1, 2, 5, GOLD)
FL.rect(256, 16, 208, 1, GOLDD); FL.rect(256, 333, 208, 1, GOLDD); FL.rect(256, 16, 1, 318, GOLDD); FL.rect(463, 16, 1, 318, GOLDD)
# loose parchment sheets scattered flat on the floor at random angles (some overlap)
R.seed(31)
def sheet(u, v, w, h, ang):
    ca, sa = math.cos(ang), math.sin(ang)
    dx, dy = XX - u, YY - v; rx = dx * ca + dy * sa; ry = -dx * sa + dy * ca
    m = (np.abs(rx) < w / 2) & (np.abs(ry) < h / 2)
    sd = ((np.abs((XX - u - 2) * ca + (YY - v - 2) * sa) < w / 2) & (np.abs(-(XX - u - 2) * sa + (YY - v - 2) * ca) < h / 2)) & ~m
    FL.mask(sd, '#3E241A'); FL.mask(m, pick(['#D9CDB0', '#E3D8BC', '#CFC2A2']))
    FL.mask(m & (np.abs(np.abs(ry) - h / 2) < 1.2), '#B5A888')
    for k in range(-h // 2 + 6, h // 2 - 4, 5):
        FL.mask(m & (np.abs(ry - k) < 0.6) & (rx > -w / 2 + 4) & (rx < w / 2 - 4 - ri(0, 12)), '#8A7A60')
for (u0, u1, n) in ((492, 640, 6), (90, 220, 3)):
    for _ in range(n):
        sheet(ri(u0, u1), ri(110, 340), ri(44, 66), ri(34, 50), R.uniform(-0.7, 0.7))
FL.rect(588, 300, 44, 9, '#C9B994'); FL.rect(588, 300, 44, 1, '#E8DCC0'); FL.rect(585, 299, 4, 11, '#8A5633'); FL.rect(631, 299, 4, 11, '#8A5633')  # rolled scroll

# ---------- ceiling texture ----------
CL = Layer()
CL.rect(0, 0, W, H, '#3A2218')
for u in range(0, W, 30): CL.rect(u, 0, 1, H, '#2A1712')
for v in range(0, H, 96):
    CL.rect(0, v, W, 20, '#5E3A24'); CL.rect(0, v + 18, W, 2, '#2A1712'); CL.rect(0, v, W, 2, '#8A5633')
for u in (0, W - 26): CL.rect(u, 0, 26, H, '#5E3A24'); CL.rect(u + (24 if u == 0 else 0), 0, 2, H, '#8A5633')

# ---------- back wall: downsample the flat art by ZB ----------
bw, bh = int(round(W / ZB)), int(round(H / ZB))
bx0, by0 = VX - bw // 2, VY - int(round(TOPH / ZB))
src_c, src_e = BACK.c, BACK.em
cand_c, cand_e, valid = [], [], []
for dy in range(3):
    for dx in range(3):
        yi = np.minimum((np.arange(bh)[:, None] * ZB).astype(int) + dy, H - 1)
        xi = np.minimum((np.arange(bw)[None, :] * ZB).astype(int) + dx, W - 1)
        ok = (yi < ((np.arange(bh)[:, None] + 1) * ZB)) & (xi < ((np.arange(bw)[None, :] + 1) * ZB))
        cand_c.append(src_c[yi, xi]); cand_e.append(src_e[yi, xi]); valid.append(np.broadcast_to(ok, (bh, bw)))
cc = np.stack(cand_c); ce = np.stack(cand_e); vv = np.stack(valid)
mean = (cc * vv[..., None]).sum(0) / vv.sum(0)[..., None]
dist = ((cc - mean) ** 2).sum(-1) - ce * 1e5  # keep bright emissive pixels (stars, flames)
dist[~vv] = np.inf
pickk = dist.argmin(0)
backc = np.take_along_axis(cc, pickk[None, ..., None], 0)[0]
backe = np.take_along_axis(ce, pickk[None], 0)[0]

# ---------- projection ----------
S = Layer(); Z = np.full((H, W), ZB)
x = XX.astype(float) + 0.5; y = YY.astype(float) + 0.5
sl = np.where(x < VX, (VX - x) / VX, -1); sr = np.where(x > VX, (x - VX) / (W - VX), -1)
sf = np.where(y > VY, (y - VY) / BOTH, -1); sc = np.where(y < VY, (VY - y) / TOPH, -1)
ss = np.stack([sl, sr, sf, sc]); plane = ss.argmax(0); smax = ss.max(0)
isback = smax < 1 / ZB
def sample(tex, u, v, m):
    ui = np.clip(u.astype(int), 0, W - 1); vi = np.clip(v.astype(int), 0, H - 1)
    S.c[m] = tex.c[vi[m], ui[m]]; S.em[m] = tex.em[vi[m], ui[m]]
D = FOC / np.maximum(smax, 1e-6)
m = (plane == 0) & ~isback; sample(LW, D - FOC, (y - VY) / np.maximum(smax, 1e-6) + TOPH, m)
m = (plane == 1) & ~isback; sample(RW, DEPTH - (D - FOC), (y - VY) / np.maximum(smax, 1e-6) + TOPH, m)
m = (plane == 2) & ~isback; sample(FL, (x - VX) / np.maximum(smax, 1e-6) + VX, D - FOC, m)
m = (plane == 3) & ~isback; sample(CL, (x - VX) / np.maximum(smax, 1e-6) + VX, D - FOC, m)
Z[~isback] = 1 / smax[~isback]
mb = isback & (XX >= bx0) & (XX < bx0 + bw) & (YY >= by0) & (YY < by0 + bh)
S.c[mb] = backc[(YY - by0)[mb], (XX - bx0)[mb]]; S.em[mb] = backe[(YY - by0)[mb], (XX - bx0)[mb]]
S.a[:] = True
# corner edges (wall/floor/ceiling seams) for crisper depth
for (px, py) in [(bx0, by0), (bx0 + bw, by0), (bx0, by0 + bh), (bx0 + bw, by0 + bh)]:
    ex, ey = (0 if px < VX else W), (0 if py < VY else H)
    n = int(max(abs(ex - px), abs(ey - py)))
    for i in range(n):
        S.px(px + (ex - px) * i / n, py + (ey - py) * i / n, '#24140F')

# ---------- hanging lanterns ----------
def scaled_sprite(rows, pal, em, cx, top, sc):
    h, w = len(rows), len(rows[0])
    for yy in range(int(h * sc)):
        for xx in range(int(w * sc)):
            ch = rows[int(yy / sc)][int(xx / sc)]
            if ch in pal: S.px(cx - w * sc / 2 + xx, top + yy, pal[ch], em.get(ch, 0))
lamps = []
for (dd, wx) in ((160, -170), (160, 170), (300, -170), (300, 170)):
    s = FOC / (FOC + dd); cyl = VY - TOPH * s; lx = VX + wx * s
    hang = 70 * s; sc = 2.4 * s
    S.rect(lx, cyl, 1, hang, '#2A1712')
    scaled_sprite(g['LANT'], g['LP'], g['LE'], lx, cyl + hang, sc)
    lamps.append((lx, cyl + hang + 10 * sc, 100 * s, 0.55 * LIGHTING['candle'], (1.0, 0.70, 0.38)))

# ---------- floor props deeper in the room ----------
def grab(draw):
    T = Layer(); draw(T)
    ys, xs = np.where(T.a)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    return T.c[y0:y1, x0:x1].copy(), T.a[y0:y1, x0:x1].copy(), T.em[y0:y1, x0:x1].copy()
def place(sp, X, Dd):
    c, a, e = sp; s = FOC / Dd
    h, w = a.shape; nh, nw = max(1, round(h * s)), max(1, round(w * s))
    yi = (np.arange(nh) / s).astype(int).clip(0, h - 1); xi = (np.arange(nw) / s).astype(int).clip(0, w - 1)
    top, left = round(VY + BOTH * s - nh), round(VX + X * s - nw / 2)
    for j in range(nh):
        yy = top + j
        if not 0 <= yy < H: continue
        for i in range(nw):
            xx = left + i
            if 0 <= xx < W and a[yi[j], xi[i]]:
                S.c[yy, xx] = c[yi[j], xi[i]]; S.em[yy, xx] = e[yi[j], xi[i]]; Z[yy, xx] = Dd / FOC
    return (VX + X * s, top, s)
def box_stack(L, n=4):
    x, yy, bw = 330, 400, ri(54, 66)
    for _ in range(n):
        bh = ri(10, 13); c = pick(g['boxC']); off = ri(-4, 4)
        L.rect(x + off, yy - bh, bw, bh, c); L.rect(x + off, yy - bh, bw, 1, sh(c, 1.45)); L.rect(x + off, yy - 1, bw, 1, sh(c, 0.6)); L.rect(x + off + bw - 6, yy - bh, 6, bh, sh(c, 0.55))
        L.rect(x + off + 5, yy - bh + 3, 16, bh - 6, CREAM); L.rect(x + off + 25, yy - bh + bh // 2 - 1, 3, 3, GOLD)
        yy -= bh
    g['figurine'](L, x + ri(8, bw - 18), yy)
def book_pile(L):
    yb = 400
    for (x, w, h, c) in [(320, 74, 11, '#7E55A0'), (326, 64, 10, '#A8404C'), (318, 70, 10, '#3F6A9E'), (330, 54, 9, '#4F9463')]:
        L.rect(x, yb - h, w, h, c); L.rect(x, yb - h, w, 1, sh(c, 1.4)); L.rect(x, yb - 1, w, 1, sh(c, 0.6)); L.rect(x + w - 9, yb - h + 2, 9, h - 4, CREAM); L.rect(x + 6, yb - h + 2, 3, h - 4, GOLD); yb -= h
    g['candle'](L, 348, yb)
def crate(L):
    L.rect(320, 352, 70, 48, '#8A5633'); L.rect(320, 352, 70, 3, '#C08248'); L.rect(320, 352, 3, 48, '#B0733F'); L.rect(384, 352, 6, 48, '#5E3A24')
    for y in (366, 382): L.rect(323, y, 61, 1, '#5E3A24'); L.rect(323, y + 1, 61, 1, '#A86C3C')
    for (u, v) in ((326, 344), (346, 340), (366, 345)): L.rect(u, v, 14, 8, pick(g['boxC'])); L.rect(u, v, 14, 1, CREAM)
def candelabra(L):
    L.rect(352, 396, 18, 4, GOLDD); L.rect(355, 392, 12, 4, GOLD); L.rect(360, 300, 3, 92, GOLDD); L.rect(359, 300, 1, 92, GOLD)
    L.rect(344, 300, 34, 3, GOLD)
    for cx_ in (344, 359, 374):
        L.rect(cx_ - 1, 284, 6, 16, '#EFE6CC'); L.rect(cx_ + 3, 284, 2, 16, '#C9BE9E')
        L.sprite(['.o.', 'oyo', 'oWo', 'oWo', '.o.'], {'o': '#F0A23C', 'y': '#F6C56B', 'W': '#FFF6D0'}, cx_, 278, 1, {'o': 1, 'y': 1, 'W': 1})
def chest(L):
    L.rect(318, 362, 84, 38, '#7A4A2E'); L.rect(316, 352, 88, 12, '#8A5633'); L.rect(316, 352, 88, 2, '#C08248'); L.rect(318, 398, 84, 2, '#4A2B1C')
    for u in (326, 392): L.rect(u, 352, 5, 48, GOLDD); L.rect(u, 352, 1, 48, GOLD)
    L.rect(354, 364, 12, 10, GOLD); L.rect(358, 368, 4, 4, '#3E241A')
def plant(L): g['potplant'](L, 340, 400, True); g['potplant'](L, 362, 400)
props = [  # (draw, world x, depth past the near plane)
    (box_stack, -296, 170), (crate, -300, 250), (chest, -288, 320),
    (candelabra, 312, 250), (lambda L: box_stack(L, 5), 292, 320),
]
prop_lights = []
for draw, X, dd in sorted(props, key=lambda t: -t[2]):
    R.seed(int(dd) + int(X))
    cx_, top, s = place(grab(draw), X, FOC + dd)
    if draw is candelabra: prop_lights.append((cx_, top + 6 * s, 80 * s, 0.5 * LIGHTING['candle'], (1.0, 0.70, 0.38)))

# dice dropped around the floor (different faces, sized by depth)
PIPS = {1: [(3, 3)], 2: [(1, 1), (5, 5)], 3: [(1, 1), (3, 3), (5, 5)], 4: [(1, 1), (1, 5), (5, 1), (5, 5)], 5: [(1, 1), (1, 5), (3, 3), (5, 1), (5, 5)], 6: [(1, 1), (1, 3), (1, 5), (5, 1), (5, 3), (5, 5)]}
def die(L, col, pip, shade, face):
    rows = [list('.wwwww.'), list('wwwwwww'), list('wwwwwww'), list('wwwwwww'), list('wwwwwww'), list('swwwwws'), list('.sssss.')]
    for (r, c) in PIPS[face]: rows[r][c] = 'p'
    L.sprite([''.join(r) for r in rows], {'w': col, 'p': pip, 's': shade}, 350, 379, 3)
DICE = [('#EFE6CC', '#A3303F', '#B5A888'), ('#2F6A4C', '#E0B15A', '#1E4632'), ('#A3303F', '#EFE3C8', '#6E1E2A'), ('#3F6A9E', '#EFE3C8', '#2A4A70')]
R.seed(57)
spots = [(ri(160, 300), ri(130, 300)) for _ in range(5)] + [(ri(-260, -170), ri(140, 290)) for _ in range(2)]
for (X, dd) in sorted(spots, key=lambda t: -t[1]):
    col, pip, shade = pick(DICE)
    place(grab(lambda L: die(L, col, pip, shade, ri(1, 6))), X, FOC + dd)

# card garland swags along both ceiling edges
SUITS = {
    'H': (['.x.x.', 'xxxxx', 'xxxxx', '.xxx.', '..x..'], '#C0303F'),
    'D': (['..x..', '.xxx.', 'xxxxx', '.xxx.', '..x..'], '#C0303F'),
    'S': (['..x..', '.xxx.', 'xxxxx', '..x..', '.xxx.'], '#2A2430'),
    'C': (['.xxx.', '.xxx.', 'xxxxx', 'x.x.x', '..x..'], '#2A2430'),
}
R.seed(77)
for side in (-1, 1):
    for (d0, d1) in ((30, 200), (200, DEPTH - 10)):
        pts = []
        for i in range(61):
            t = i / 60; Dd = FOC + d0 + (d1 - d0) * t; s_ = FOC / Dd
            Yw = -TOPH + 22 + 38 * math.sin(math.pi * t)
            pts.append((VX + side * 292 * s_, VY + Yw * s_, s_))
        for (xa, ya, _), (xb, yb, _) in zip(pts, pts[1:]):
            n = max(1, int(max(abs(xb - xa), abs(yb - ya))))
            for k in range(n + 1): S.px(xa + (xb - xa) * k / n, ya + (yb - ya) * k / n, '#C9A26B')
        for j, i in enumerate(range(6, 58, 12)):  # ~5 cards per swag, spaced like a real garland
            cx_, cy_, s_ = pts[i]; w = max(5, round(15 * s_)); h = max(7, round(21 * s_))
            x0_, y0_ = round(cx_ - w / 2), round(cy_)
            S.rect(x0_, y0_, w, h, '#8A7A60'); S.rect(x0_ + 1, y0_ + 1, w - 2, h - 2, '#F3EEE6')
            rows, col = SUITS['HSDC'[(j + (side > 0)) % 4]]
            if w >= 9:  # full suit pixel art in the middle, tiny pips in two corners
                ox, oy = x0_ + (w - 5) // 2, y0_ + (h - 5) // 2
                for yy, row in enumerate(rows):
                    for xx, ch in enumerate(row):
                        if ch == 'x': S.px(ox + xx, oy + yy, col)
                S.px(x0_ + 2, y0_ + 2, col); S.px(x0_ + w - 3, y0_ + h - 3, col)
            else:  # far cards: a small blob in the suit color
                S.rect(x0_ + w // 2 - 1, y0_ + h // 2 - 1, 2, 2, col)

# fire pit under the cauldron: ash bed + a ring of rounded stones (front-layer logs sit on top)
R.seed(13)
fcx, fcy = 360, 396
ash = (((XX - fcx) / 66) ** 2 + ((YY - fcy) / 9) ** 2) <= 1
S.mask(ash, '#3A3640'); S.mask(ash & (BAYF < 0.35), '#2A2630')
for _ in range(40): S.px(fcx + ri(-58, 58), fcy + ri(-6, 6), pick(['#C9602E', '#F0A23C', '#55505E', '#55505E']), 0.6)
def stone(x, y, w, h):
    m = (((XX - x) / (w / 2)) ** 2 + ((YY - y) / (h / 2)) ** 2) <= 1
    c = sh('#6E687A', R.uniform(0.85, 1.1))
    S.mask(m, c); S.mask(m & (YY < y - h / 4), sh(c, 1.25)); S.mask(m & (YY > y + h / 4), sh(c, 0.65))
    S.mask(m & (XX > x + w / 4) & (YY > y), sh(c, 0.55))
stones = []
for (rx_, ry_, dy_, n_, sz) in ((70, 8, -4, 13, (14, 20)), (76, 11, 1, 16, (12, 17))):  # back row then front row -> a low mound
    for k in range(n_):  # lower half of the ring plus the sides (the back is hidden by the cauldron)
        ang = math.radians(-12 + k * 204 / (n_ - 1))
        stones.append((fcx + rx_ * math.cos(ang) + ri(-3, 3), fcy + dy_ + ry_ * math.sin(ang) + ri(-1, 1), ri(*sz), ri(8, 11)))
for (x_, y_, w_, h_) in sorted(stones, key=lambda t: t[1]): stone(x_, y_, w_, h_)
for _ in range(5): stone(fcx + pick([-1, 1]) * ri(82, 96), fcy + ri(2, 8), ri(6, 9), ri(4, 6))  # a few loose stones
S.dark(fcx - 90, fcy + 10, 180, 4, 0.6, 0.5)  # contact shadow on the carpet

# pot back rim + inside (the front layer's cauldron sits on top of this)
exec(seg(399, 400).replace('B.', 'S.'), {**g, 'S': S})

# ---------- lighting with depth fog ----------
def wall_pt(u, v, right):
    d = FOC + (DEPTH - u if right else u); s = FOC / d
    return (VX + (1 if right else -1) * VX * s, VY + (v - TOPH) * s, s)
LIGHTS = [(360, 398, 310, 1.45, (1.0, 0.55, 0.26)), (360, 300, 300, 0.35, (1.0, 0.66, 0.40)), (66, 392, 130, 0.95 * LIGHTING['candle'], (1.0, 0.72, 0.40)), (672, 404, 150, 1.05 * LIGHTING['candle'], (1.0, 0.70, 0.36)), (150, 440, 90, 0.5, (0.7, 0.5, 1.0)),
          (VX, by0 + 190 / ZB, LIGHTING['winR'], LIGHTING['winI'], LIGHTING['win']), (VX, 330, 150, LIGHTING['flrI'], LIGHTING['flr']),
          ] + lamps + prop_lights
bay = DEPTH // 3
for b in range(4):
    for right in (False, True):
        u = min(b * bay, DEPTH - 18) + 9
        px_, py_, s = wall_pt(DEPTH - u if right else u, 192, right)
        LIGHTS.append((px_, py_, 80 * s, 0.45 * LIGHTING['candle'], (1.0, 0.72, 0.40)))
amb = np.array(LIGHTING['amb'])
Lm = np.zeros((H, W, 3)) + amb
for (lx, ly, rad, inten, col) in LIGHTS:
    d = np.sqrt((XX - lx) ** 2 + ((YY - ly) * 1.1) ** 2) / rad
    f = np.clip(1 - d, 0, 1) ** 1.7 * inten
    Lm += (np.floor(f * 7 + BAYF) / 7)[..., None] * np.array(col)
fog = np.clip((Z - 1) / (ZB - 1), 0, 1)
fq = np.floor(fog * LIGHTING['fog'] * 6 + BAYF) / 6
Lm *= (1 - fq)[..., None]
vg = np.clip((np.sqrt(((XX - 360) / 360.0) ** 2 + ((YY - 300) / 260.0) ** 2) - 0.45) * 1.3, 0, LIGHTING['vg'])  # darker toward the edges so the cauldron and window carry the light
Lm *= (1 - np.floor(vg * 6 + BAYF) / 6)[..., None]
out = S.c * Lm
out = S.c * S.em[..., None] + out * (1 - S.em[..., None])
back = np.clip(out, 0, 255).astype(np.uint8)

Image.fromarray(back, 'RGB').save(str(Path(OUT) / ('atelier-back.png' if TIME == 'night' else f'atelier-back-{TIME}.png')))
front = np.array(Image.open(ROOT + '/apps/web/public/assets/atelier-front.png').convert('RGBA'))
comp = back.copy(); a = front[..., 3] > 0; comp[a] = front[..., :3][a]
if PREVIEW: Image.fromarray(comp).resize((W * 2, H * 2), Image.NEAREST).save(PREVIEW)
print('ok')
