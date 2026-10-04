#!/usr/bin/env python3
"""Turbo Tayfa - pist tehlikeleri (src/hazards.js makeBall skin'leri) için model seti.

Mevcut skin'ler kutu/küre/ikozahedron ile çiziliyor; bunlar aynı ölçü ve eksenlerle yerine geçer:
  yarıçap = 1 birim (oyun ballRadius ile ölçekler), yuvarlanma ekseni yerel Z, +X = ileri
  (araba/hayalet +X'e bakar), merkez orijinde (THREE küre/silindir gibi).
Çıktı: public/models/hazards/hazard-*.glb  (vertex color; hayalet yarı saydam, lav çatlakları emissive)
Kullanım: python3 tools/gen_hazards.py [çıktı_klasörü]
"""
import json, math, os, struct, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen_props import Mesh, H, lin, mix, lathe, box, sphere, ellip, strut, rot, icosphere
from gen_karts import convex, loftm, bx, lathe_z, cyl_z

def secx(x, hb, ht, yb, yt):
    return [(x, yb, -hb), (x, yb, hb), (x, yt, ht), (x, yt, -ht)]

def noise(p, seed, octaves=3):
    rng = np.random.default_rng(seed); v = 0.0
    for o in range(octaves):
        f = rng.normal(size=3); f = f / np.linalg.norm(f) * (1.6 * 2 ** o); ph = rng.uniform(0, 6.28)
        v += math.sin(float(f @ p) + ph) / (1.7 ** o)
    return v / 1.6

def lump(sub, rough, seed, colfn, scale=(1, 1, 1), faces_to=None):
    """Merkezli, gürültüyle bozulmuş küre. colfn(centroid, normal, rng) -> renk | (renk, parça_adı)."""
    v, f = icosphere(sub); rng = np.random.default_rng(seed + 99)
    V = [p * (1 + rough * noise(p, seed)) * np.array(scale) for p in v]
    for a, b, c in f:
        P = [V[a], V[b], V[c]]; cen = sum(P) / 3
        n = np.cross(P[1] - P[0], P[2] - P[0]); n /= np.linalg.norm(n) + 1e-12
        if np.dot(n, cen) < 0: n = -n
        r = colfn(cen, n, rng)
        part, col = (r if isinstance(r, tuple) and isinstance(r[0], str) else ('main', r))
        (faces_to[part] if faces_to else faces_to['main']).poly(P, col, (0, 0, 0))

# ---------------------------------------------------------------- modeller
def log():
    m = Mesh(); BK, BK2, PALE, RING = H('#6b4423'), H('#8a5a2f'), H('#ecc88e'), H('#c99a5a')
    prof = [(-1.3, .56), (-1.25, .62), (-.8, .64), (-.3, .6), (.2, .65), (.8, .62), (1.25, .62), (1.3, .56)]
    lathe_z(m, prof, 0, 0, [BK, BK2, BK, BK2, BK, BK2, BK], n=14)
    for e in (-1, 1):
        for k, (r, c) in enumerate([(.55, PALE), (.45, RING), (.35, PALE), (.25, RING), (.14, H('#8a5a2f'))]):
            z = e * (1.3 + .004 * (k + 1)); lathe_z(m, [(z, r), (z + e * .002, r)] if e > 0 else [(z + e * .002, r), (z, r)], 0, 0, [c], n=14)
    for z, deg in ((.55, 40), (-.6, 160), (.05, 250)):
        a = math.radians(deg); d = np.array([math.cos(a), math.sin(a), 0])
        strut(m, d * .6 + np.array([0, 0, z]), d * .82 + np.array([0, 0, z]), .08, BK2, 6)
        sphere(m, d * .84 + np.array([0, 0, z]), .075, PALE, 0)
    ellip(m, (math.cos(1.0) * .6, math.sin(1.0) * .6, -.2), (.2, .2, .45), H('#5f9b3a'), 1)  # yosun
    return [(m, {})]

def taxi():
    m = Mesh(); YL, DK, BL, CH, RD = H('#ffc82e'), H('#1c1c24'), H('#9fd8ff'), H('#d5dae6'), H('#e03030')
    loftm(m, [secx(-1.3, .6, .55, -.15, .33), secx(-1.0, .65, .65, -.15, .5), secx(1.0, .65, .65, -.15, .5), secx(1.3, .6, .55, -.15, .3)], YL)
    loftm(m, [secx(-.8, .62, .52, .5, 1.0), secx(.45, .62, .52, .5, 1.0)], YL)
    for s in (-1, 1):
        bx(m, -.6, .3, .56, .94, s * .615 if s > 0 else -.635, s * .635 if s > 0 else -.615, BL)
    bx(m, .44, .5, .55, .95, -.5, .5, BL); bx(m, -.82, -.78, .55, .95, -.5, .5, BL)
    bx(m, -.1, .3, 1.0, 1.15, -.27, .27, H('#fff6ee')); bx(m, -.1, .3, 1.1, 1.13, -.275, .275, DK)
    for i in range(12):
        x0 = -1.15 + i * .2
        for r in range(2):
            c = DK if (i + r) % 2 == 0 else H('#fff6ee')
            bx(m, x0, x0 + .2, .0 + r * .12, .12 + r * .12, .652, .664, c); bx(m, x0, x0 + .2, .0 + r * .12, .12 + r * .12, -.664, -.652, c)
    for s in (-1, 1):
        bx(m, 1.3, 1.34, .08, .32, s * .42 - .14, s * .42 + .14, H('#fff8c8'))
        bx(m, -1.34, -1.3, .12, .3, s * .42 - .12, s * .42 + .12, RD)
    bx(m, 1.3, 1.42, -.15, -.02, -.6, .6, CH); bx(m, -1.42, -1.3, -.15, -.02, -.6, .6, CH)
    for x in (-.85, .85):
        for z in (-.66, .66):
            w = Mesh(); lathe(w, [(.26, -.11, 0, 0), (.28, -.09, 0, 0), (.28, .09, 0, 0), (.26, .11, 0, 0)], 10, DK)
            lathe(w, [(.14, .11, 0, 0), (.14, .115, 0, 0)], 8, CH)
            w.transform(rot('x', math.pi / 2)); w.translate((x, .02, z)); m.extend(w)
    return [(m, {})]

def ghost():
    body, eyes = Mesh(), Mesh(); n = 12
    prof = [(.80, -.72, -.30), (.92, -.2, 0), (.9, .5, 0), (.8, 1.1, 0), (.56, 1.55, 0), (.22, 1.8, 0)]
    rings = []
    for i, (r, y, dy) in enumerate(prof):
        rings.append([(r * math.cos(2 * math.pi * k / n), y + (dy if (k % 2 == 0 and i == 0) else 0), r * math.sin(2 * math.pi * k / n)) for k in range(n)])
    top = H('#eaf6ff'); low = H('#a9c8ff')
    for i in range(len(rings) - 1):
        col = mix(low, top, i / (len(rings) - 2))
        for k in range(n):
            j = (k + 1) % n
            body.poly([rings[i][k], rings[i][j], rings[i + 1][j], rings[i + 1][k]], col, (0, .6, 0))
    body.poly(rings[-1], top, (0, .6, 0))
    for s in (-1, 1):
        ellip(body, (0, .55, s * .95), (.16, .1, .3), mix(low, top, .5), 1)
        ellip(eyes, (.72, 1.05, s * .3), (.1, .17, .1), H('#0b0b18'), 1)
        ellip(eyes, (.80, .8, s * .5), (.05, .08, .08), H('#ff9bb5'), 0)
    ellip(eyes, (.84, .72, 0), (.07, .12, .08), H('#0b0b18'), 1)
    return [(body, {'alpha': .88, 'emissive': [.37, .5, .7]}), (eyes, {})]

def rock():
    m = Mesh()
    def col(c, n, r):
        if n[1] > .55 and r.random() > .25: return mix(H('#5f9b3a'), H('#8bc34a'), r.random() * .6)   # yosun
        t = (c[1] + 1) / 2; return mix(H('#6e655e'), H('#a79d94'), t * .8 + .2 * r.random())
    lump(1, .22, 7, col, (1, .88, 1.05), {'main': m})
    return [(m, {})]

def lava_rock():
    m, cr = Mesh(), Mesh()
    def col(c, n, r):
        vein = abs(math.sin(c[0] * 4.2 + c[1] * 2.6 + 1.3) * math.cos(c[2] * 3.7 - c[1] * 1.9)) < .13
        if vein: return ('crack', mix(H('#ff8a1a'), H('#ffd23c'), r.random()))
        return ('main', mix(H('#2b2528'), H('#5a4a48'), r.random() * .7 + (.25 if n[1] > .5 else 0)))
    lump(2, .2, 21, col, (1, .9, 1.0), {'main': m, 'crack': cr})
    return [(m, {}), (cr, {'emissive': [1.0, .4, .1]})]

def snowball():
    m = Mesh()
    def col(c, n, r):
        t = (c[1] + 1) / 2; return mix(H('#bcd4ee'), H('#ffffff'), t * .85 + .1 * r.random())
    lump(2, .1, 33, col, faces_to={'main': m})
    for i, (a, b) in enumerate(((.9, .4), (2.4, -.3), (4.0, .5), (5.3, -.1))):
        d = np.array([math.cos(a) * math.cos(b), math.sin(b), math.sin(a) * math.cos(b)])
        if i % 2 == 0: ellip(m, d * .97, (.14, .1, .14), H('#5a5550'), 1)
        else: strut(m, d * .85, d * 1.3, .03, H('#6b4423'), 5)
    return [(m, {})]

def beachball():
    m = Mesh(); cols = [H('#ff4b4b'), H('#ffffff'), H('#ffd23f'), H('#ffffff'), H('#3f8cff'), H('#ffffff')]
    C, Rn = 24, 10
    P = lambda t, p: (math.sin(p) * math.cos(t), math.sin(p) * math.sin(t), math.cos(p))
    for r in range(Rn):
        p0, p1 = math.pi * r / Rn, math.pi * (r + 1) / Rn
        cap = r == 0 or r == Rn - 1
        for c in range(C):
            t0, t1 = 2 * math.pi * c / C, 2 * math.pi * (c + 1) / C
            col = H('#ffffff') if cap else cols[(c * 6) // C]
            m.poly([P(t0, p0), P(t1, p0), P(t1, p1), P(t0, p1)] if not cap else ([P(t0, p0), P(t1, p0), P(t1, p1), P(t0, p1)]), col, (0, 0, 0))
    for e in (-1, 1):
        lathe_z(m, [(e * 1.0 - e * .005, .0), (e * 1.0, .0)], 0, 0, [H('#ff4b4b')], n=6) if False else None
        b = Mesh(); lathe(b, [(.12, 0, 0, 0), (.09, .04, 0, 0)], 8, H('#ff4b4b'))
        b.transform(rot('x', math.pi / 2 if e > 0 else -math.pi / 2)); b.translate((0, 0, e * .995)); m.extend(b)
    return [(m, {})]

HAZARDS = {'hazard-log': log, 'hazard-taxi': taxi, 'hazard-ghost': ghost, 'hazard-rock': rock,
           'hazard-lava-rock': lava_rock, 'hazard-snowball': snowball, 'hazard-beachball': beachball}

# ---------------------------------------------------------------- GLB (çok malzemeli)
def write_glb(path, name, parts):
    chunks, views, acc, prims, mats = [], [], [], [], []
    def add(arr, ctype, typ, target, mm=False):
        d = arr.tobytes(); off = sum(len(c) for c in chunks); chunks.append(d + b'\0' * (-len(d) % 4))
        views.append({'buffer': 0, 'byteOffset': off, 'byteLength': len(d), 'target': target})
        a = {'bufferView': len(views) - 1, 'componentType': ctype, 'count': len(arr), 'type': typ}
        if mm: a['min'] = arr.min(axis=0).tolist(); a['max'] = arr.max(axis=0).tolist()
        acc.append(a); return len(acc) - 1
    tris = 0
    for i, (m, o) in enumerate(parts):
        pos = np.array(m.pos, np.float32); nrm = np.array(m.nrm, np.float32); col = np.array([lin(c) for c in m.col], np.float32); tris += len(pos) // 3
        ap = add(pos, 5126, 'VEC3', 34962, True); an = add(nrm, 5126, 'VEC3', 34962); ac = add(col, 5126, 'VEC3', 34962); ai = add(np.arange(len(pos), dtype=np.uint32), 5125, 'SCALAR', 34963)
        mat = {'name': f'{name}-{i}', 'doubleSided': True, 'pbrMetallicRoughness': {'baseColorFactor': [1, 1, 1, o.get('alpha', 1.0)], 'metallicFactor': 0.0, 'roughnessFactor': 0.85}}
        if 'alpha' in o: mat['alphaMode'] = 'BLEND'
        if 'emissive' in o: mat['emissiveFactor'] = o['emissive']
        mats.append(mat); prims.append({'attributes': {'POSITION': ap, 'NORMAL': an, 'COLOR_0': ac}, 'indices': ai, 'material': i})
    g = {'asset': {'version': '2.0', 'generator': 'turbo-tayfa gen_hazards'}, 'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [{'name': name, 'mesh': 0}],
         'meshes': [{'name': name, 'primitives': prims}], 'materials': mats, 'accessors': acc, 'bufferViews': views}
    binb = b''.join(chunks); g['buffers'] = [{'byteLength': len(binb)}]
    j = json.dumps(g, separators=(',', ':')).encode(); j += b' ' * (-len(j) % 4)
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(j) + 8 + len(binb)))
        f.write(struct.pack('<II', len(j), 0x4E4F534A) + j); f.write(struct.pack('<II', len(binb), 0x004E4942) + binb)
    return tris

if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else 'public/models/hazards'
    os.makedirs(out, exist_ok=True)
    for name, fn in HAZARDS.items():
        print(name, 'üçgen:', write_glb(os.path.join(out, name + '.glb'), name, fn()))
