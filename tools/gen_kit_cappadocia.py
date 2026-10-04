#!/usr/bin/env python3
"""Turbo Tayfa - Kapadokya pist donanımı (kemer, bayrak, kuleler, bariyerler, tribün).

gen_props.py ile aynı mantık: vertex color, flat-shaded, tek malzeme. Ölçüler Racing Kit donanımıyla aynı mertebede
(kemer ~1.26 geniş, bayrak/kule ~1.2 yüksek, bariyer 0.26×0.18, tribün ~1.12×1.1); +X piste sağ, +Z piste dönük.
Çıktı: public/models/kits/cappadocia/{gantry,flag,towerA,towerB,barrierA,barrierB,stand}.glb
Kullanım: python3 tools/gen_kit_cappadocia.py [çıktı_klasörü]
"""
import math, os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen_props import Mesh, H, box, lathe, sphere, strut, write_glb, mix

SAND, SAND2 = H('#e2bf93'), H('#cfa77a')
STONE_D = H('#7a5a44')   # şapka / koyu taş
CREAM = H('#f3e4c4')
RED, TEAL, GOLD, INK = H('#c2452d'), H('#1f8a8a'), H('#f0b429'), H('#2b2420')
KILIM = [H('#c2452d'), H('#f0b429'), H('#1f6f8b'), H('#f3e4c4')]


def pillar(m, cx, cz, h, r0, r1, cap_r, jitter=0.0, sides=9):
    """Peribacası biçimli taş sütun: gövde + koyu şapka. Tepe y = h*1.1."""
    rings = [(r0, 0), (r0 * 0.88, h * 0.2), (r1 * 1.15, h * 0.55), (r1, h * 0.85), (r1 * 0.95, h)]
    lathe(m, [(r, y, cx, cz) for r, y in rings], sides, [SAND, SAND2, SAND, SAND2])
    top = h
    lathe(m, [(r1 * 0.95, top, cx, cz), (cap_r * 0.9, top + h * 0.02, cx, cz), (cap_r, top + h * 0.05, cx, cz), (cap_r * 0.85, top + h * 0.1, cx, cz), (cap_r * 0.4, top + h * 0.16, cx, cz), (0.0, top + h * 0.18, cx, cz)],
          sides, [STONE_D, H('#5e4433'), STONE_D, H('#5e4433'), STONE_D])


def checker(m, x0, x1, y0, y1, z, cols=10, rows=2, depth=0.004, dz=1):
    """Damalı şerit (z düzleminde)."""
    w, h = (x1 - x0) / cols, (y1 - y0) / rows
    for i in range(cols):
        for j in range(rows):
            c = INK if (i + j) % 2 else CREAM
            box(m, x0 + i * w, x0 + (i + 1) * w, y0 + j * h, y0 + (j + 1) * h, z, z + depth * dz, c) if dz > 0 else \
                box(m, x0 + i * w, x0 + (i + 1) * w, y0 + j * h, y0 + (j + 1) * h, z + depth * dz, z, c)


def arch(m, cx, y0, w, h, z, col, depth=0.01, n=10):
    """Yarım daire tepeli kapı/pencere nişi (z düzleminde dolu yüzey, +z'ye bakar)."""
    r = w / 2
    box(m, cx - r, cx + r, y0, y0 + h - r, z, z + depth, col)
    c = np.array([cx, y0 + h - r, z + depth])
    for k in range(n):
        a0, a1 = math.pi * k / n, math.pi * (k + 1) / n
        m.poly([c, c + np.array([r * math.cos(a0), r * math.sin(a0), 0]), c + np.array([r * math.cos(a1), r * math.sin(a1), 0])][::-1], col, c + np.array([0, 0, 1]))


# ---------------------------------------------------------------- start kemeri
def gantry():
    m = Mesh()
    for s in (-1, 1):
        pillar(m, s * 0.52, 0, 0.62, 0.1, 0.065, 0.12)
    # taş kiriş + damalı bant
    box(m, -0.64, 0.64, 0.58, 0.78, -0.075, 0.075, SAND)
    box(m, -0.64, 0.64, 0.74, 0.8, -0.085, 0.085, STONE_D)
    for z, dz in ((0.075, 1), (-0.075, -1)):
        checker(m, -0.56, 0.56, 0.62, 0.7, z, cols=14, rows=2, dz=dz)
    # sarkan start lambaları (parlak)
    for i, x in enumerate((-0.3, -0.15, 0.0, 0.15, 0.3)):
        strut(m, (x, 0.58, 0), (x, 0.52, 0), 0.008, INK, 4)
        sphere(m, (x, 0.49, 0), 0.04, H('#ff3b30') if i < 4 else H('#3dd16f'), 1)
    # sütun tepelerinde sancak
    for s in (-1, 1):
        x = s * 0.52
        strut(m, (x, 0.74, 0), (x, 0.9, 0), 0.008, INK, 4)
        m.poly([(x, 0.9, 0), (x + 0.1 * s, 0.86, 0), (x, 0.82, 0)], RED, (x, 0.86, 0.3))
        m.poly([(x, 0.82, 0), (x + 0.1 * s, 0.86, 0), (x, 0.9, 0)], RED, (x, 0.86, -0.3))
    return m


# ---------------------------------------------------------------- bayrak
def flag():
    m = Mesh()
    box(m, -0.07, 0.07, 0, 0.05, -0.04, 0.04, SAND2)
    box(m, -0.05, 0.05, 0.05, 0.08, -0.03, 0.03, SAND)
    strut(m, (0, 0.08, 0), (0, 1.26, 0), 0.014, H('#6b4a34'), 6)
    sphere(m, (0, 1.27, 0), 0.025, GOLD, 1)
    # damalı bayrak (hafif dalgalı)
    cols, rows, w, h = 6, 4, 0.04, 0.035
    for i in range(cols):
        for j in range(rows):
            c = INK if (i + j) % 2 else CREAM
            wave = 0.012 * math.sin(i * 0.9)
            x0, y0 = 0.02 + i * w, 1.1 + j * h
            box(m, x0, x0 + w, y0, y0 + h, -0.006 + wave, 0.006 + wave, c)
    return m


# ---------------------------------------------------------------- bayrak kuleleri
def tower(banner, trim):
    m = Mesh()
    pillar(m, 0, 0, 0.78, 0.14, 0.075, 0.15)
    # tepe: ince direk + altın hilal topuzu
    strut(m, (0, 0.92, 0), (0, 1.12, 0), 0.01, INK, 4)
    sphere(m, (0, 1.14, 0), 0.03, GOLD, 1)
    # asılı flama (iki yüzlü, sivri uçlu), +z yüzünde altın şerit
    top, bot, hw = 0.74, 0.34, 0.075
    for z, dz in ((0.085, 1), (-0.085, -1)):
        quad = [(-hw, top, z), (hw, top, z), (hw, bot + 0.05, z), (0, bot, z), (-hw, bot + 0.05, z)]
        c = (0, 0.55, z + 0.3 * dz)
        m.poly(quad if dz > 0 else quad[::-1], banner, c)
        m.poly([(-hw, top - 0.04, z + 0.002 * dz), (hw, top - 0.04, z + 0.002 * dz), (hw, top - 0.08, z + 0.002 * dz), (-hw, top - 0.08, z + 0.002 * dz)] if dz > 0 else
               [(-hw, top - 0.08, z + 0.002 * dz), (hw, top - 0.08, z + 0.002 * dz), (hw, top - 0.04, z + 0.002 * dz), (-hw, top - 0.04, z + 0.002 * dz)], trim, c)
    return m


# ---------------------------------------------------------------- bariyerler
def barrier(body, top):
    m = Mesh()
    # üst üste iki sıra yonca taş blok
    for i in range(3):
        x0 = -0.13 + i * 0.0867
        box(m, x0 + 0.003, x0 + 0.0837, 0, 0.1, -0.06, 0.06, body if i % 2 == 0 else mix(body, H('#000000'), 0.06))
    box(m, -0.13, 0.13, 0.1, 0.14, -0.055, 0.055, top)
    box(m, -0.12, 0.12, 0.14, 0.18, -0.045, 0.045, mix(top, H('#ffffff'), 0.15))
    return m


# ---------------------------------------------------------------- tribün
def stand():
    m = Mesh()
    # kayaya oyulmuş arka duvar: nişli kemerler
    box(m, -0.56, 0.56, 0, 1.0, -0.54, -0.38, SAND)
    box(m, -0.56, 0.56, 0.98, 1.04, -0.55, -0.37, STONE_D)
    for x in (-0.38, -0.13, 0.13, 0.38):
        arch(m, x, 0.18, 0.15, 0.5, -0.38, INK)
        arch(m, x, 0.7, 0.1, 0.22, -0.38, H('#3b2a22'))
    # oturma kademeleri (kilim şeritli), arkaya doğru yükselir
    for i in range(4):
        z1 = 0.4 - i * 0.19
        box(m, -0.56, 0.56, 0, 0.07 + i * 0.09, z1 - 0.19, z1, SAND2)
        for k in range(8):
            box(m, -0.56 + k * 0.14, -0.56 + (k + 1) * 0.14, 0.07 + i * 0.09, 0.075 + i * 0.09, z1 - 0.19, z1, KILIM[(k + i) % 4])
    # kenar taş duvarlar
    for s_ in (-1, 1):
        box(m, min(s_ * 0.53, s_ * 0.59), max(s_ * 0.53, s_ * 0.59), 0, 0.28, -0.38, 0.42, SAND)
    # çadır gölgelik: ön taş direkler + çizgili örtü
    for sx in (-1, 1):
        strut(m, (sx * 0.52, 0.0, 0.42), (sx * 0.52, 1.0, 0.42), 0.022, H('#6b4a34'), 6)
    n = 12
    for k in range(n):
        c = RED if k % 2 == 0 else CREAM
        x0, x1 = -0.58 + k * 1.16 / n, -0.58 + (k + 1) * 1.16 / n
        # eğimli çatı: arkadan (yüksek) öne (alçak)
        m.poly([(x0, 1.1, -0.45), (x1, 1.1, -0.45), (x1, 1.02, 0.46), (x0, 1.02, 0.46)], c, (0, 2, 0))
        m.poly([(x0, 1.02, 0.46), (x1, 1.02, 0.46), (x1, 0.97, 0.46), (x0, 0.97, 0.46)], c, (0, 1, 3))  # saçak
    sphere(m, (0, 1.14, -0.45), 0.04, GOLD, 1)
    return m


MODELS = {'gantry': gantry, 'flag': flag, 'towerA': lambda: tower(RED, GOLD), 'towerB': lambda: tower(TEAL, GOLD),
          'barrierA': lambda: barrier(H('#cf6a45'), CREAM), 'barrierB': lambda: barrier(CREAM, TEAL), 'stand': stand}

if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else 'public/models/kits/cappadocia'
    os.makedirs(out, exist_ok=True)
    for name, fn in MODELS.items():
        m = fn()
        ymin = min(p[1] for p in m.pos)
        m.translate((0, -ymin, 0))
        write_glb(os.path.join(out, name + '.glb'), 'cappadocia-' + name, m)
        print('yazıldı', name)
