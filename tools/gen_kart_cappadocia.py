#!/usr/bin/env python3
"""Turbo Tayfa - Kapadokya aracı: "Balon Sepeti". Hasır sepet gövde, bakır gaz tüpleri ve brülör,
sırtında flamalı mini sıcak hava balonu, kilim şeritli kenarlar.
Sözleşme tools/gen_kart.py ile aynı (+Z ileri, wheel-* düğümleri, 'character' koltuk).
Çıktı: public/models/karts/kart-cappadocia.glb
Kullanım: python3 tools/gen_kart_cappadocia.py [çıktı.glb]
"""
import math, os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen_kart import Mesh, loft, sec, box, prism_x, prism_z, extrude_x, hex2lin, write_glb

PAL = {k: hex2lin(v) for k, v in dict(
    wicker='#c8914f', wicker2='#a87238', wood='#5b3a24', cream='#f3e4c4', red='#c2452d', teal='#1f8a8a', gold='#f0b429',
    copper='#c97a3c', copper2='#9a5528', dark='#2b2420', tire='#34261d', flame='#ff9a2e', rope='#e8dcc0',
).items()}
BAND = [PAL['red'], PAL['cream'], PAL['teal'], PAL['gold'], PAL['red'], PAL['cream']]


def rings_y(n, rings):
    """Dikey eksende: rings = [(y, r), ...] → y boyunca halka dizisi (balon gövdesi için)."""
    return [[(r * math.cos(2 * math.pi * i / n), y, r * math.sin(2 * math.pi * i / n)) for i in range(n)] for y, r in rings]


def build():
    P = PAL
    body = Mesh()

    # ---- ahşap kızak şasi ----
    body.convex(loft([sec(-0.64, 0.29, 0.29, 0.10, 0.18), sec(0.64, 0.23, 0.23, 0.10, 0.18)]), P['wood'])
    body.convex(box(0.285, 0.31, 0.085, 0.12, -0.10, 0.14), P['gold'], mirror=True)  # yan altın şerit

    # ---- hasır sepet: alçak küvet, hayvan içine oturur ----
    body.convex(box(-0.22, 0.22, 0.17, 0.23, -0.46, 0.28), P['wicker2'])  # kokpit zemini
    body.convex(loft([
        [(0.19, 0.17, -0.46), (0.31, 0.17, -0.46), (0.31, 0.31, -0.46), (0.19, 0.31, -0.46)],
        [(0.19, 0.17, 0.26), (0.31, 0.17, 0.26), (0.31, 0.31, 0.26), (0.19, 0.31, 0.26)]]), P['wicker'], mirror=True)  # yan duvarlar
    # hasır örgü çizgileri (yatay şeritler)
    for y in (0.21, 0.25, 0.29):
        body.convex(box(0.305, 0.318, y, y + 0.012, -0.46, 0.26), P['wicker2'], mirror=True)
    body.convex(box(0.2, 0.32, 0.31, 0.335, -0.46, 0.26), P['red'], mirror=True)  # kilim kenar şeridi
    for k in range(7):  # kenar şeridinde krem eşkenar desen
        z = -0.42 + k * 0.1
        body.convex(box(0.225, 0.295, 0.335, 0.343, z, z + 0.04), P['cream'], mirror=True)

    # ---- burun: yuvarlatılmış sepet ucu + bakır top ----
    body.convex(loft([sec(0.26, 0.32, 0.27, 0.17, 0.33), sec(0.62, 0.22, 0.14, 0.17, 0.27), sec(0.86, 0.07, 0.05, 0.17, 0.22)]), P['wicker'])
    body.convex(loft([sec(0.30, 0.07, 0.05, 0.325, 0.335), sec(0.62, 0.05, 0.035, 0.265, 0.273), sec(0.85, 0.025, 0.02, 0.215, 0.222)]), P['red'])
    body.convex(prism_z(8, [(0.86, 0.045), (0.92, 0.055), (0.97, 0.03)], cx=0, cy=0.195, rot=math.pi / 8), P['copper'])

    # ---- ön tampon: bakır boru ----
    body.convex(box(-0.42, 0.42, 0.14, 0.17, 0.74, 0.84), P['copper2'])
    body.convex(box(0.41, 0.45, 0.13, 0.2, 0.73, 0.85), P['gold'], mirror=True)

    # ---- yan podlar: kilim kaplı çamurluklar ----
    body.convex(loft([
        [(0.31, 0.17, -0.12), (0.47, 0.17, -0.12), (0.44, 0.38, -0.12), (0.31, 0.38, -0.12)],
        [(0.31, 0.17, 0.15), (0.47, 0.17, 0.15), (0.44, 0.31, 0.15), (0.31, 0.31, 0.15)]]), P['wicker'], mirror=True)
    body.convex(loft([
        [(0.435, 0.27, -0.12), (0.475, 0.27, -0.12), (0.465, 0.33, -0.12), (0.43, 0.33, -0.12)],
        [(0.435, 0.27, 0.15), (0.475, 0.27, 0.15), (0.465, 0.30, 0.15), (0.43, 0.30, 0.15)]]), P['teal'], mirror=True)

    # ---- arka gövde: sepet arkalığı ----
    body.convex(loft([sec(-0.46, 0.28, 0.24, 0.17, 0.50), sec(-0.62, 0.26, 0.19, 0.17, 0.48), sec(-0.72, 0.22, 0.15, 0.17, 0.40)]), P['wicker'])
    body.convex(loft([sec(-0.47, 0.06, 0.05, 0.495, 0.505), sec(-0.62, 0.05, 0.04, 0.475, 0.485)]), P['red'])
    for y in (0.26, 0.33, 0.40):
        body.convex(box(-0.285, 0.285, y, y + 0.012, -0.725, -0.715), P['wicker2'])

    # ---- bakır gaz tüpleri + brülör ----
    for sx in (-0.15, 0.15):
        body.convex(prism_z(10, [(-0.74, 0.09), (-0.70, 0.11), (-0.40, 0.11), (-0.36, 0.09)], cx=sx, cy=0.40, rot=0.1), P['copper'])
        body.convex(prism_z(10, [(-0.60, 0.115), (-0.56, 0.115)], cx=sx, cy=0.40, rot=0.1), P['copper2'])  # bant
        body.convex(prism_z(6, [(-0.74, 0.05), (-0.80, 0.07), (-0.84, 0.08)], cx=sx, cy=0.30, rot=0.2), P['dark'])  # nozul
        body.convex(prism_z(6, [(-0.835, 0.05), (-0.86, 0.05)], cx=sx, cy=0.30, rot=0.2), P['flame'])  # alev ucu
    body.convex(box(-0.15, 0.15, 0.50, 0.53, -0.58, -0.50), P['copper2'])  # tüpleri bağlayan boru

    # ---- balon direği + mini sıcak hava balonu ----
    mast_x, mast_z = 0.0, -0.58
    body.convex(box(mast_x - 0.012, mast_x + 0.012, 0.5, 1.02, mast_z - 0.012, mast_z + 0.012), P['wood'])
    prof = [(1.0, 0.0), (1.05, 0.07), (1.16, 0.115), (1.28, 0.13), (1.38, 0.105), (1.45, 0.05), (1.47, 0.0)]  # (y, r) alttan üste
    secs = rings_y(8, [(y, r) for y, r in prof[:-1]])
    for i in range(len(secs) - 1):
        c = BAND[i % len(BAND)]
        a = [(x + mast_x, y, z + mast_z) for x, y, z in secs[i]]
        b = [(x + mast_x, y, z + mast_z) for x, y, z in secs[i + 1]]
        body.convex(loft([a, b]), c)
    body.convex(loft([[(x + mast_x, y, z + mast_z) for x, y, z in secs[-1]],
                      [(mast_x + 0.02 * math.cos(2 * math.pi * i / 8), 1.47, mast_z + 0.02 * math.sin(2 * math.pi * i / 8)) for i in range(8)]]), BAND[len(secs) % len(BAND)])
    # tepe flaması (sivri kuyruklu, iki yüzlü)
    body.convex(box(mast_x - 0.006, mast_x + 0.006, 1.47, 1.62, mast_z - 0.006, mast_z + 0.006), P['dark'])
    fy, fz = 1.61, mast_z
    tri = [(0.0, fy, fz), (0.0, fy - 0.07, fz), (0.0, fy - 0.035, fz - 0.17)]
    for dx in (0.004, -0.004):
        body.poly([(dx, y, z) for _, y, z in tri], P['red'], (dx * 100, fy - 0.04, fz - 0.06))

    # ---- tekerlekler: geniş, 8 köşeli; bakır jant ----
    R, W = 0.215, 0.20

    def wheel(side):
        m = Mesh()
        n, rot, h = 8, math.pi / 8, W / 2
        m.convex(prism_x(n, [(-h, R * 0.86), (-h + 0.04, R), (h - 0.04, R), (h, R * 0.86)], rot), P['tire'])
        m.convex(prism_x(n, [(h - 0.01, R * 0.66), (h + 0.035, R * 0.54)], rot), P['copper'])
        m.convex(prism_x(6, [(h + 0.034, R * 0.30), (h + 0.06, R * 0.24)]), P['gold'])
        m.convex(prism_x(n, [(-h + 0.01, R * 0.62), (-h - 0.02, R * 0.5)], rot), P['copper2'])
        if side < 0:
            m2 = Mesh()
            for i in range(0, len(m.pos), 3):
                tri = [np.array([-p[0], p[1], p[2]]) for p in m.pos[i:i + 3]][::-1]
                nn = np.cross(tri[1] - tri[0], tri[2] - tri[0]); nn /= np.linalg.norm(nn)
                for p in tri:
                    m2.pos.append(p); m2.nrm.append(nn); m2.col.append(m.col[i])
            return m2
        return m

    wheels = {
        'wheel-front-right': ((-0.40, 0.215, 0.38), wheel(-1)),
        'wheel-front-left': ((0.40, 0.215, 0.38), wheel(1)),
        'wheel-back-right': ((-0.40, 0.215, -0.36), wheel(-1)),
        'wheel-back-left': ((0.40, 0.215, -0.36), wheel(1)),
    }
    seat = Mesh()
    seat.convex(box(-0.02, 0.02, -0.02, 0.02, -0.02, 0.02), P['dark'])
    return body, wheels, ((0.0, 0.28, -0.07), seat)


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else 'public/models/karts/kart-cappadocia.glb'
    body, wheels, seat = build()
    print(out, 'üçgen:', write_glb(out, 'kart-cappadocia', body, wheels, seat))
