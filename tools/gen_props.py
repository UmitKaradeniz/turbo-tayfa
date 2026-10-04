#!/usr/bin/env python3
"""Turbo Tayfa - dekor prop üretici (tools/gen_kart.py ile aynı mantık).

Çıktı: public/models/tayfa/*.glb
  - Doku yok: renkler vertex color (COLOR_0), tek malzeme, flat-shaded (yüz başına normal)
  - Taban y=0, Y yukarı. Oyun normalizedModel() ile zaten ortalıyor; ölçek yerleşimde verilir.
  - Boyutlar Kenney nature kit ile aynı mertebede (~1-1.4 birim), mevcut `scale` değerleri çalışır.
Kullanım: python3 tools/gen_props.py [çıktı_klasörü]
"""
import json, math, os, struct, sys
import numpy as np

# ---------------------------------------------------------------- renk
def H(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)])

def lin(c):
    return [(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4) for x in c]

def mix(a, b, t):
    return a * (1 - t) + b * t

# ---------------------------------------------------------------- geometri
class Mesh:
    def __init__(self):
        self.pos, self.nrm, self.col = [], [], []

    def _emit(self, a, b, c, col):
        n = np.cross(b - a, c - a)
        l = np.linalg.norm(n)
        if l < 1e-12:
            return
        n = n / l
        for p in (a, b, c):
            self.pos.append(p); self.nrm.append(n); self.col.append(col)

    def poly(self, verts, col, ref=None, two_sided=False):
        """Yelpaze üçgenleme. ref (iç nokta) verilirse yüzler ondan uzağa bakar;
        two_sided ise yüz yukarı bakacak şekilde yönlenir ve ters kopyası da eklenir."""
        v = [np.asarray(p, float) for p in verts]
        for i in range(1, len(v) - 1):
            a, b, c = v[0], v[i], v[i + 1]
            n = np.cross(b - a, c - a)
            if np.linalg.norm(n) < 1e-12:
                continue
            flip = False
            if two_sided:
                flip = n[1] < 0
            elif ref is not None:
                flip = np.dot(n, (a + b + c) / 3 - np.asarray(ref, float)) < 0
            if flip:
                b, c = c, b
            self._emit(a, b, c, col)
            if two_sided:
                self._emit(a, c, b, col)

    def transform(self, R):
        self.pos = [R @ p for p in self.pos]
        self.nrm = [R @ n for n in self.nrm]

    def translate(self, d):
        d = np.asarray(d, float)
        self.pos = [p + d for p in self.pos]

    def extend(self, o):
        self.pos += o.pos; self.nrm += o.nrm; self.col += o.col

def lathe(m, rings, n, col, rot=0.0):
    """rings: [(r, y, cx, cz)] alttan üste. col: tek renk ya da halka aralığı başına liste."""
    pts = [[(cx + r * math.cos(rot + 2 * math.pi * k / n), y, cz + r * math.sin(rot + 2 * math.pi * k / n))
            for k in range(n)] for r, y, cx, cz in rings]
    cl = lambda i: col[i] if isinstance(col, list) else col
    for i in range(len(rings) - 1):
        ref = ((rings[i][2] + rings[i + 1][2]) / 2, (rings[i][1] + rings[i + 1][1]) / 2, (rings[i][3] + rings[i + 1][3]) / 2)
        for k in range(n):
            j = (k + 1) % n
            m.poly([pts[i][k], pts[i][j], pts[i + 1][j], pts[i + 1][k]], cl(i), ref)
    if rings[0][0] > 1e-6:
        m.poly(pts[0], cl(0), (rings[1][2], rings[1][1], rings[1][3]))
    if rings[-1][0] > 1e-6:
        m.poly(pts[-1], cl(len(rings) - 2), (rings[-2][2], rings[-2][1], rings[-2][3]))

def box(m, x0, x1, y0, y1, z0, z1, col):
    c = ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
    P = lambda x, y, z: (x, y, z)
    for q in ([P(x0, y0, z0), P(x1, y0, z0), P(x1, y1, z0), P(x0, y1, z0)], [P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)],
              [P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1), P(x0, y1, z0)], [P(x1, y0, z0), P(x1, y0, z1), P(x1, y1, z1), P(x1, y1, z0)],
              [P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1)], [P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)]):
        m.poly(q, col, c)

def icosphere(sub):
    t = (1 + 5 ** 0.5) / 2
    v = [(-1, t, 0), (1, t, 0), (-1, -t, 0), (1, -t, 0), (0, -1, t), (0, 1, t), (0, -1, -t), (0, 1, -t), (t, 0, -1), (t, 0, 1), (-t, 0, -1), (-t, 0, 1)]
    f = [(0, 11, 5), (0, 5, 1), (0, 1, 7), (0, 7, 10), (0, 10, 11), (1, 5, 9), (5, 11, 4), (11, 10, 2), (10, 7, 6), (7, 1, 8),
         (3, 9, 4), (3, 4, 2), (3, 2, 6), (3, 6, 8), (3, 8, 9), (4, 9, 5), (2, 4, 11), (6, 2, 10), (8, 6, 7), (9, 8, 1)]
    v = [np.array(p, float) / np.linalg.norm(p) for p in v]
    for _ in range(sub):
        cache, nf = {}, []
        def mid(a, b):
            k = (min(a, b), max(a, b))
            if k not in cache:
                p = v[a] + v[b]; v.append(p / np.linalg.norm(p)); cache[k] = len(v) - 1
            return cache[k]
        for a, b, c in f:
            ab, bc, ca = mid(a, b), mid(b, c), mid(c, a)
            nf += [(a, ab, ca), (b, bc, ab), (c, ca, bc), (ab, bc, ca)]
        f = nf
    return v, f

def sphere(m, center, r, col, sub=1):
    v, f = icosphere(sub)
    c = np.asarray(center, float)
    for a, b, d in f:
        m.poly([c + v[a] * r, c + v[b] * r, c + v[d] * r], col, c)

# ---------------------------------------------------------------- modeller
def palm():
    m = Mesh()
    A, B, GD, GL, CO = H('#b07a40'), H('#8f5c2d'), H('#1c8a3e'), H('#62cc4c'), H('#5b3a1e')
    N, TH = 10, 1.25
    rings = []
    for i in range(N):
        t = i / (N - 1)
        rings.append((0.09 - 0.032 * t, TH * t, 0.30 * t ** 1.7, 0.0))
    lathe(m, rings, 7, [A if i % 2 == 0 else B for i in range(N - 1)])
    lx, base_y = rings[-1][2], TH + 0.02
    for k in range(9):
        phi = 2 * math.pi * k / 9 + 0.25
        L = 0.72 + 0.1 * (k % 3) / 2
        d = np.array([math.cos(phi), 0, math.sin(phi)]); side = np.array([-d[2], 0, d[0]])
        stations = []
        for s in range(9):
            t = s / 8
            w = (0.17 * math.sin(math.pi * t ** 0.7) + 0.012) * (1.0 if s % 2 == 0 else 0.8)  # tırtıklı yaprak
            c = np.array([lx, base_y, 0]) + d * (L * t) + np.array([0, 0.22 * t - 0.42 * t * t, 0])
            stations.append((c, w, t))
        for (c0, w0, t0), (c1, w1, t1) in zip(stations, stations[1:]):
            col = mix(GD, GL, (t0 + t1) / 2 * 0.9 + (0.08 if k % 2 else 0))
            up = np.array([0, 1, 0])
            r0, r1 = c0 + up * w0 * 0.22, c1 + up * w1 * 0.22
            m.poly([c0 + side * w0, r0, r1, c1 + side * w1], col, two_sided=True)
            m.poly([r0, c0 - side * w0, c1 - side * w1, r1], col, two_sided=True)
    for k in range(3):
        a = 2 * math.pi * k / 3 + 0.6
        sphere(m, (lx + 0.075 * math.cos(a), TH - 0.04, 0.075 * math.sin(a)), 0.05, CO, 0)
    return m

def boulder(seed, base, light, scale=(1.0, 0.72, 1.1), rough=0.2):
    m = Mesh()
    rng = np.random.default_rng(seed)
    v, f = icosphere(1)
    sc = np.array(scale) * 0.5  # birim: ~1 m, Kenney kaya boyutuna yakın
    V = []
    for p in v:
        q = p * (1 + rng.uniform(-rough, rough)) * sc
        q[1] = max(q[1], -0.45 * sc[1])  # düz taban
        V.append(q)
    ys = [q[1] for q in V]; y0, y1 = min(ys), max(ys)
    for a, b, c in f:
        P = [V[a], V[b], V[c]]
        cen = sum(P) / 3
        n = np.cross(P[1] - P[0], P[2] - P[0])
        n = n / (np.linalg.norm(n) + 1e-12)
        if np.dot(n, cen) < 0:
            n = -n
        t = (cen[1] - y0) / (y1 - y0)
        k = float(np.clip(0.55 * t + 0.45 * max(n[1], 0) + rng.uniform(-0.08, 0.08), 0, 1))
        m.poly(P, mix(base, light, k), (0, 0, 0))
    m.translate((0, -y0, 0))
    return m

def pine():
    m = Mesh()
    lathe(m, [(0.07, 0.0, 0, 0), (0.05, 0.3, 0, 0)], 6, H('#6b4423'))
    tiers = [(0.50, 0.22, 0.52), (0.42, 0.52, 0.48), (0.34, 0.80, 0.44), (0.25, 1.06, 0.40)]
    lo, hi = H('#1b6a3a'), H('#45b556')
    for i, (r, b, h) in enumerate(tiers):
        t = i / (len(tiers) - 1)
        lathe(m, [(r, b, 0, 0), (r * 0.6, b + h * 0.5, 0, 0), (0.0, b + h, 0, 0)], 7, [mix(lo, hi, t * 0.9), mix(lo, hi, t * 0.9 + 0.1)], rot=i * 0.45)
    return m

def umbrella(tilt=10):
    m = Mesh()
    lathe(m, [(0.15, 0.0, 0, 0), (0.05, 0.07, 0, 0)], 10, H('#e9cf94'))
    top = Mesh()
    lathe(top, [(0.022, 0.0, 0, 0), (0.022, 1.02, 0, 0)], 6, H('#ebe3d2'))
    RED, WHT, YEL = H('#ee3b3b'), H('#fff4e2'), H('#ffc93c')
    n = 8
    ang = lambda k: 2 * math.pi * k / n
    ring = lambda r, y, k: (r * math.cos(ang(k)), y, r * math.sin(ang(k)))
    for k in range(n):
        col = RED if k % 2 == 0 else WHT
        top.poly([(0, 1.1, 0), ring(0.3, 1.03, k), ring(0.3, 1.03, k + 1)], col, (0, 0.5, 0))
        top.poly([ring(0.3, 1.03, k), ring(0.62, 0.86, k), ring(0.62, 0.86, k + 1), ring(0.3, 1.03, k + 1)], col, (0, 0.5, 0))
        top.poly([ring(0.62, 0.86, k), ring(0.6, 0.8, k), ring(0.6, 0.8, k + 1), ring(0.62, 0.86, k + 1)], col, (0, 0.5, 0))  # etek
    sphere(top, (0, 1.12, 0), 0.04, YEL, 0)
    a = math.radians(tilt)
    top.transform(np.array([[math.cos(a), -math.sin(a), 0], [math.sin(a), math.cos(a), 0], [0, 0, 1]]))
    m.extend(top)
    return m

def cone():
    m = Mesh()
    box(m, -0.19, 0.19, 0.0, 0.03, -0.19, 0.19, H('#2e2f3a'))
    O, W = H('#ff6a1a'), H('#f6f6f6')
    prof = [(0.145, 0.03), (0.12, 0.13), (0.10, 0.22), (0.08, 0.31), (0.045, 0.45)]
    lathe(m, [(r, y, 0, 0) for r, y in prof], 8, [O, W, W, O], rot=math.pi / 8)
    return m

# ---------------------------------------------------------------- GLB yazıcı
def write_glb(path, name, m):
    pos = np.array(m.pos, np.float32); nrm = np.array(m.nrm, np.float32)
    col = np.array([lin(c) for c in m.col], np.float32); idx = np.arange(len(pos), dtype=np.uint32)
    chunks, views, acc = [], [], []
    def add(arr, ctype, typ, target, mm=False):
        d = arr.tobytes(); off = sum(len(c) for c in chunks); chunks.append(d + b'\0' * (-len(d) % 4))
        views.append({'buffer': 0, 'byteOffset': off, 'byteLength': len(d), 'target': target})
        a = {'bufferView': len(views) - 1, 'componentType': ctype, 'count': len(arr), 'type': typ}
        if mm: a['min'] = pos.min(axis=0).tolist(); a['max'] = pos.max(axis=0).tolist()
        acc.append(a); return len(acc) - 1
    ap = add(pos, 5126, 'VEC3', 34962, True); an = add(nrm, 5126, 'VEC3', 34962); ac = add(col, 5126, 'VEC3', 34962); ai = add(idx, 5125, 'SCALAR', 34963)
    binb = b''.join(chunks)
    g = {'asset': {'version': '2.0', 'generator': 'turbo-tayfa gen_props'}, 'scene': 0, 'scenes': [{'nodes': [0]}],
         'nodes': [{'name': name, 'mesh': 0}],
         'meshes': [{'name': name, 'primitives': [{'attributes': {'POSITION': ap, 'NORMAL': an, 'COLOR_0': ac}, 'indices': ai, 'material': 0}]}],
         'materials': [{'name': 'tayfa', 'doubleSided': True, 'pbrMetallicRoughness': {'baseColorFactor': [1, 1, 1, 1], 'metallicFactor': 0.0, 'roughnessFactor': 0.85}}],
         'accessors': acc, 'bufferViews': views, 'buffers': [{'byteLength': len(binb)}]}
    j = json.dumps(g, separators=(',', ':')).encode(); j += b' ' * (-len(j) % 4)
    with open(path, 'wb') as f:
        f.write(struct.pack('<4sII', b'glTF', 2, 12 + 8 + len(j) + 8 + len(binb)))
        f.write(struct.pack('<I4s', len(j), b'JSON') + j + struct.pack('<I4s', len(binb), b'BIN\0') + binb)


# ---------------------------------------------------------------- set 2: Neon Şehir + Lunapark
def rot(axis, a):
    c, s = math.cos(a), math.sin(a)
    if axis == 'x': return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])
    if axis == 'y': return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])

def strut(m, a, b, r, col, n=6):
    """a'dan b'ye silindirik çubuk."""
    a, b = np.asarray(a, float), np.asarray(b, float)
    d = b - a; L = np.linalg.norm(d)
    t = Mesh(); lathe(t, [(r, 0, 0, 0), (r, L, 0, 0)], n, col)
    d = d / L; y = np.array([0, 1, 0]); ax = np.cross(y, d)
    if np.linalg.norm(ax) > 1e-9:
        ax /= np.linalg.norm(ax); ang = math.acos(np.clip(np.dot(y, d), -1, 1))
        K = np.array([[0, -ax[2], ax[1]], [ax[2], 0, -ax[0]], [-ax[1], ax[0], 0]])
        t.transform(np.eye(3) + math.sin(ang) * K + (1 - math.cos(ang)) * K @ K)
    elif d[1] < 0:
        t.transform(rot('x', math.pi))
    t.translate(a); m.extend(t)

def street_lamp():
    m = Mesh(); D, G = H('#4a4e63'), H('#9aa0b8')
    lathe(m, [(0.11, 0, 0, 0), (0.08, 0.08, 0, 0), (0.045, 0.16, 0, 0), (0.035, 1.25, 0, 0)], 8, [D, G, G])
    strut(m, (0, 1.22, 0), (0.28, 1.36, 0), 0.03, G)
    box(m, 0.14, 0.52, 1.30, 1.37, -0.08, 0.08, D)
    box(m, 0.18, 0.48, 1.285, 1.30, -0.06, 0.06, H('#fff0b8'))  # parlak lamba
    sphere(m, (0, 1.27, 0), 0.05, H('#ff4fd8'), 0)  # neon top
    return m

def neon_billboard():
    m = Mesh(); D, G = H('#2b2d3a'), H('#4a4e63')
    box(m, -0.52, -0.46, 0, 0.95, -0.03, 0.03, G); box(m, 0.46, 0.52, 0, 0.95, -0.03, 0.03, G)
    box(m, -0.65, 0.65, 0.95, 1.55, -0.05, 0.05, D)
    box(m, -0.6, 0.6, 1.0, 1.5, 0.05, 0.065, H('#10132b'))
    for i, c in enumerate(['#ff3fd0', '#22e8ff', '#ffe33b', '#ff3fd0']):
        box(m, -0.5, 0.5, 1.05 + i * 0.105, 1.12 + i * 0.105, 0.065, 0.085, H(c))
    box(m, -0.5, -0.38, 1.0, 1.5, 0.065, 0.085, H('#22e8ff'))
    return m

def vending():
    m = Mesh(); B = H('#e8384f')
    box(m, -0.3, 0.3, 0, 1.1, -0.2, 0.2, B)
    box(m, -0.3, 0.3, 1.1, 1.14, -0.22, 0.22, H('#a8203a'))
    box(m, -0.22, 0.06, 0.35, 1.0, 0.2, 0.225, H('#ffe9a8'))  # aydınlık vitrin
    for r in range(3):
        for c in range(2):
            box(m, -0.2 + c * 0.12, -0.12 + c * 0.12, 0.45 + r * 0.17, 0.55 + r * 0.17, 0.225, 0.24, [H('#3fd0ff'), H('#ff9d2e'), H('#7bdc4a')][r])
    box(m, 0.12, 0.24, 0.65, 0.95, 0.2, 0.225, H('#2b2d3a'))
    box(m, -0.22, 0.22, 0.12, 0.26, 0.2, 0.225, H('#2b2d3a'))
    return m

def tire_stack():
    m = Mesh(); K, W = H('#26262e'), H('#f4f4f4')
    for i in range(3):
        y = i * 0.16; r = 0.2
        lathe(m, [(r * 0.86, y, 0, 0), (r, y + 0.03, 0, 0), (r, y + 0.13, 0, 0), (r * 0.86, y + 0.16, 0, 0)], 8, [K, K if i != 2 else K, K], rot=i * 0.4)
    lathe(m, [(0.176, 0.485, 0, 0), (0.15, 0.50, 0, 0)], 8, W)
    lathe(m, [(0.2, 0.165, 0, 0), (0.205, 0.17, 0, 0), (0.205, 0.20, 0, 0), (0.2, 0.205, 0, 0)], 8, H('#e8384f'))
    return m

def balloons():
    m = Mesh(); cols = ['#ff4f6d', '#ffc93c', '#3fd0ff', '#7bdc4a', '#b06bff']
    pts = [(0.0, 1.25, 0.0), (0.24, 1.1, 0.1), (-0.22, 1.12, 0.08), (0.08, 1.0, -0.22), (-0.1, 1.05, 0.22)]
    for p, c in zip(pts, cols):
        v, f = icosphere(1); cen = np.array(p); sc = np.array([0.16, 0.2, 0.16])
        col = H(c)
        for a, b, d in f:
            m.poly([cen + v[a] * sc, cen + v[b] * sc, cen + v[d] * sc], col, cen)
        sphere(m, (p[0], p[1] - 0.2, p[2]), 0.025, col * 0.8, 0)  # düğüm
        strut(m, (p[0], p[1] - 0.21, p[2]), (0, 0.12, 0), 0.007, H('#f2f2f2'), 4)
    lathe(m, [(0.11, 0, 0, 0), (0.09, 0.09, 0, 0), (0.0, 0.12, 0, 0)], 8, H('#7a5a3a'))
    return m

def ferris():
    m = Mesh(); R, HUB, W = 0.75, 1.0, 0.07
    FR, GR, PIN = H('#f5f5f5'), H('#4a4e63'), [H(c) for c in ['#ff4f6d', '#ffc93c', '#3fd0ff', '#7bdc4a']]
    for s in (-1, 1):
        z = s * W
        n = 16; ring = [(R * math.cos(2 * math.pi * k / n), HUB + R * math.sin(2 * math.pi * k / n), z) for k in range(n + 1)]
        for a, b in zip(ring, ring[1:]): strut(m, a, b, 0.018, FR, 5)
        for k in range(0, n, 2): strut(m, (0, HUB, z), ring[k], 0.012, GR, 4)
        strut(m, (0, HUB, z), (0.0, 0.02, s * 0.42), 0.03, GR, 5)
    strut(m, (0, HUB, -0.16), (0, HUB, 0.16), 0.07, H('#e8384f'), 8)
    for k in range(8):
        a = 2 * math.pi * k / 8; cx, cy = R * math.cos(a), HUB + R * math.sin(a)
        strut(m, (cx, cy, -W), (cx, cy - 0.02, W), 0.01, GR, 4)
        box(m, cx - 0.08, cx + 0.08, cy - 0.2, cy - 0.06, -W - 0.01, W + 0.01, PIN[k % 4])
        box(m, cx - 0.09, cx + 0.09, cy - 0.06, cy - 0.04, -W - 0.015, W + 0.015, H('#fff4e2'))
    box(m, -0.4, 0.4, 0, 0.04, -0.5, 0.5, H('#7a7f94'))
    return m

def popcorn():
    m = Mesh(); R, Wt, Y = H('#e8384f'), H('#fff4e2'), H('#ffd23c')
    for i in range(6):
        box(m, -0.3 + i * 0.1, -0.2 + i * 0.1, 0.18, 0.55, -0.22, 0.22, R if i % 2 == 0 else Wt)
    box(m, -0.34, 0.34, 0.55, 0.6, -0.26, 0.26, H('#2b2d3a'))
    box(m, -0.28, 0.28, 0.6, 0.98, -0.2, 0.2, H('#bfe8ff'))   # cam vitrin
    for k in range(9):
        a = 2 * math.pi * k / 9
        sphere(m, (0.1 * math.cos(a) * (k % 3 + 1) / 2, 0.63 + 0.03 * (k % 3), 0.08 * math.sin(a) * (k % 3 + 1) / 2), 0.05, [H('#fff0b3'), H('#ffe07a')][k % 2], 0)
    for k in range(6):  # sivri çatı
        a0, a1 = 2 * math.pi * k / 6, 2 * math.pi * (k + 1) / 6
        r = 0.42
        m.poly([(0, 1.2, 0), (r * math.cos(a0), 0.98, r * math.sin(a0) * 0.7), (r * math.cos(a1), 0.98, r * math.sin(a1) * 0.7)], R if k % 2 == 0 else Wt, (0, 0.9, 0))
    for sx in (-0.34, 0.34):
        w = Mesh(); lathe(w, [(0.14, -0.03, 0, 0), (0.14, 0.03, 0, 0)], 10, H('#2b2d3a')); w.transform(rot('z', math.pi / 2)); w.translate((sx, 0.14, 0)); m.extend(w)
    strut(m, (0.3, 0.2, -0.22), (0.62, 0.25, -0.22), 0.025, H('#7a7f94'), 5)
    sphere(m, (0, 1.22, 0), 0.04, Y, 0)
    return m

# ---------------------------------------------------------------- set 3: Şeker Diyarı + Oyuncak Odası
def ellip(m, c, sc, col, sub=1):
    v, f = icosphere(sub); c = np.asarray(c, float); sc = np.asarray(sc, float)
    for a, b, d in f:
        m.poly([c + v[a] * sc, c + v[b] * sc, c + v[d] * sc], col, c)

def candy_cane():
    m = Mesh(); RED, WHT = H('#e8283f'), H('#fff6ee'); r = 0.05; seg = 0; L = 1.0; n = 10
    for i in range(n):
        strut(m, (0, L * i / n, 0), (0, L * (i + 1) / n + 0.003, 0), r, RED if seg % 2 == 0 else WHT, 8); seg += 1
    R, cy = 0.17, L
    pts = [(R - R * math.cos(math.pi * k / 7), cy + R * math.sin(math.pi * k / 7), 0) for k in range(8)]
    pts = [(p[0] - 0.0, p[1], 0) for p in pts]
    for a, b in zip(pts, pts[1:]):
        strut(m, a, b, r, RED if seg % 2 == 0 else WHT, 8); seg += 1
    sphere(m, pts[-1], r, RED if seg % 2 == 0 else WHT, 0)
    return m

def gumdrops():
    m = Mesh(); cols = ['#ff4f6d', '#ffc93c', '#3fd0ff', '#7bdc4a', '#b06bff']
    spots = [(0, 0, 1.0), (0.3, 0.12, 0.8), (-0.28, 0.1, 0.85), (0.08, -0.3, 0.7), (-0.1, 0.32, 0.75)]
    for (x, z, sc), c in zip(spots, cols):
        g = Mesh(); col = H(c)
        prof = [(0.17, 0.0), (0.19, 0.05), (0.16, 0.15), (0.11, 0.23), (0.05, 0.28)]
        lathe(g, [(r * sc, y * sc, 0, 0) for r, y in prof], 9, [col, col, mix(col, H('#ffffff'), 0.25), mix(col, H('#ffffff'), 0.45)], rot=x)
        for k in range(5):  # şeker kristali noktaları
            a = 2 * math.pi * k / 5
            sphere(g, (0.13 * sc * math.cos(a), 0.12 * sc, 0.13 * sc * math.sin(a)), 0.012, H('#ffffff'), 0)
        g.translate((x, 0, z)); m.extend(g)
    return m

def swirl_lollipop():
    m = Mesh(); WH = H('#fff6ee'); cy, R, T = 0.98, 0.34, 0.05; n = 12
    cols = [H('#ff4f9a'), H('#fff6ee'), H('#3fd0ff'), H('#fff6ee')]
    lathe(m, [(0.028, 0, 0, 0), (0.028, cy - 0.02, 0, 0)], 6, WH)
    rings = [0.0, 0.11, 0.22, R]; tw = [0.0, 0.5, 1.0, 1.5]
    P = lambda i, k, z: (rings[i] * math.cos(2 * math.pi * k / n + tw[i]), cy + rings[i] * math.sin(2 * math.pi * k / n + tw[i]), z)
    c = (0, cy, 0)
    for i in range(3):
        for k in range(n):
            col = cols[(k + i) % 4]
            m.poly([P(i, k, T), P(i + 1, k, T), P(i + 1, k + 1, T), P(i, k + 1, T)], col, c)
    for k in range(n):
        col = cols[k % 4]
        m.poly([P(3, k, T), P(3, k + 1, T), P(3, k + 1, -T), P(3, k, -T)], col, c)
    m.poly([P(3, k, -T) for k in range(n)], H('#ffd0e6'), c)
    return m

def alphabet_block():
    m = Mesh(); W, h = H('#e8b872'), 0.25
    box(m, -h, h, 0, 2 * h, -h, h, W)
    cols = [H('#e8384f'), H('#3f8cff'), H('#ffc93c'), H('#4cc760'), H('#b06bff')]
    q = 0.17; y0, y1 = h - q, h + q; e = 0.008
    box(m, -q, q, y0, y1, h, h + e, cols[0]); box(m, -q, q, y0, y1, -h - e, -h, cols[1])
    box(m, h, h + e, y0, y1, -q, q, cols[2]); box(m, -h - e, -h, y0, y1, -q, q, cols[3]); box(m, -q, q, 2 * h, 2 * h + e, -q, q, cols[4])
    W2 = H('#fff6ee'); t = 0.025   # harf: "A" benzeri
    box(m, -0.07, -0.07 + t * 1.6, y0 + 0.03, y1 - 0.03, h + e, h + 2 * e, W2); box(m, 0.07 - t * 1.6, 0.07, y0 + 0.03, y1 - 0.03, h + e, h + 2 * e, W2)
    box(m, -0.07, 0.07, y1 - 0.03 - t * 1.6, y1 - 0.03, h + e, h + 2 * e, W2); box(m, -0.06, 0.06, h - 0.01, h + 0.01 + t, h + e, h + 2 * e, W2)
    m.transform(rot('y', math.radians(18)))
    return m

def rubber_duck():
    m = Mesh(); Y, O, K = H('#ffd21e'), H('#ff8a1a'), H('#1c1c24')
    ellip(m, (0, 0.2, 0), (0.24, 0.19, 0.3), Y, 1)
    ellip(m, (0, 0.2, -0.27), (0.07, 0.07, 0.1), mix(Y, H('#ffffff'), 0.1), 0)  # kuyruk
    ellip(m, (0, 0.46, 0.1), (0.15, 0.15, 0.15), Y, 1)
    for sx in (-1, 1):
        ellip(m, (sx * 0.22, 0.22, -0.03), (0.04, 0.1, 0.17), mix(Y, H('#e8a800'), 0.35), 0)  # kanat
        sphere(m, (sx * 0.075, 0.5, 0.235), 0.022, K, 0)  # göz
    box(m, -0.07, 0.07, 0.425, 0.465, 0.23, 0.36, O)  # gaga
    return m

def spinning_top():
    m = Mesh(); R, Y, B, W = H('#e8384f'), H('#ffc93c'), H('#3f8cff'), H('#fff6ee')
    prof = [(0.0, 0.0), (0.04, 0.04), (0.18, 0.15), (0.3, 0.27), (0.3, 0.33), (0.22, 0.42), (0.1, 0.5), (0.05, 0.54)]
    lathe(m, [(r, y, 0, 0) for r, y in prof], 10, [W, R, R, Y, B, B, Y])
    lathe(m, [(0.05, 0.54, 0, 0), (0.04, 0.58, 0, 0), (0.04, 0.74, 0, 0)], 6, H('#e8b872'))
    sphere(m, (0, 0.78, 0), 0.07, R, 1)
    m.transform(rot('z', math.radians(6)))
    return m

def toy_train():
    m = Mesh(); BL, RD, YL, K = H('#3f8cff'), H('#e8384f'), H('#ffc93c'), H('#2b2d3a')
    box(m, -0.17, 0.17, 0.1, 0.18, -0.38, 0.4, BL)
    b = Mesh(); lathe(b, [(0.14, 0.0, 0, 0), (0.15, 0.1, 0, 0), (0.15, 0.55, 0, 0), (0.12, 0.6, 0, 0)], 10, [RD, RD, mix(RD, H('#ffffff'), 0.2)])
    b.transform(rot('x', math.pi / 2)); b.translate((0, 0.3, -0.1)); m.extend(b)
    ch = Mesh(); lathe(ch, [(0.05, 0, 0, 0), (0.05, 0.12, 0, 0), (0.08, 0.15, 0, 0), (0.08, 0.2, 0, 0)], 8, [K, K, K]); ch.translate((0, 0.42, 0.28)); m.extend(ch)
    box(m, -0.19, 0.19, 0.18, 0.56, -0.38, -0.12, YL); box(m, -0.22, 0.22, 0.56, 0.6, -0.42, -0.08, RD)
    box(m, -0.195, -0.19, 0.32, 0.46, -0.34, -0.2, H('#bfe8ff')); box(m, 0.19, 0.195, 0.32, 0.46, -0.34, -0.2, H('#bfe8ff'))
    box(m, -0.12, 0.12, 0.1, 0.2, 0.4, 0.46, K)  # tampon
    sphere(m, (0, 0.3, 0.38), 0.05, YL, 0)  # far
    for z, r in ((-0.26, 0.12), (0.12, 0.09), (0.3, 0.09)):
        for sx in (-1, 1):
            w = Mesh(); lathe(w, [(r, -0.025, 0, 0), (r, 0.025, 0, 0)], 10, K); w.transform(rot('z', math.pi / 2))
            w.translate((sx * 0.2, r, z)); m.extend(w)
            hub = Mesh(); lathe(hub, [(r * 0.45, -0.03, 0, 0), (r * 0.45, 0.03, 0, 0)], 6, YL); hub.transform(rot('z', math.pi / 2)); hub.translate((sx * 0.215, r, z)); m.extend(hub)
    return m

# ---------------------------------------------------------------- set 4: Yarış alanı
def start_arch():
    m = Mesh(); P, D, W, K = H('#e8384f'), H('#2b2d3a'), H('#fff6ee'), H('#15151c')
    for sx in (-1, 1):
        box(m, sx * 1.2 - 0.09, sx * 1.2 + 0.09, 0, 1.2, -0.09, 0.09, P)
        box(m, sx * 1.2 - 0.16, sx * 1.2 + 0.16, 0, 0.06, -0.16, 0.16, D)
        box(m, sx * 1.2 - 0.1, sx * 1.2 + 0.1, 0.5, 0.56, -0.1, 0.1, W)  # beyaz bant
    box(m, -1.3, 1.3, 1.1, 1.4, -0.1, 0.1, D)
    n, cw = 13, 2.4 / 13
    for r in range(2):
        for c in range(n):
            x0 = -1.2 + c * cw
            box(m, x0, x0 + cw, 1.12 + r * 0.13, 1.12 + (r + 1) * 0.13, 0.1, 0.115, W if (r + c) % 2 == 0 else K)
    for i, c in enumerate(['#ff3b3b', '#ffd23c', '#4cff6a']):
        box(m, -0.05 + (i - 1) * 0.0, 0.05, 0, 0, 0, 0, H(c)) if False else None
        sphere(m, ((i - 1) * 0.28, 1.5, 0), 0.09, H(c), 1)
    box(m, -0.45, 0.45, 1.4, 1.43, -0.07, 0.07, D)
    return m

def tire_wall():
    m = Mesh(); K = H('#1d1d24'); cols = [H('#e8384f'), H('#fff6ee')]
    for row in range(2):
        cnt = 4 - row
        for i in range(cnt):
            x = (i - (cnt - 1) / 2) * 0.4; y = 0.2 + row * 0.34
            t = Mesh(); c = cols[(i + row) % 2]
            lathe(t, [(0.12, -0.11, 0, 0), (0.2, -0.08, 0, 0), (0.2, 0.08, 0, 0), (0.12, 0.11, 0, 0)], 10, [c, K, c], rot=0.3 * i)
            t.transform(rot('x', math.pi / 2)); t.translate((x, y, 0)); m.extend(t)
    return m

def chevron_sign():
    m = Mesh(); D, Yl, K = H('#4a4e63'), H('#ffcc1a'), H('#15151c')
    for sx in (-0.38, 0.38): box(m, sx - 0.025, sx + 0.025, 0, 0.55, -0.025, 0.025, D)
    box(m, -0.55, 0.55, 0.45, 1.15, -0.03, 0.03, K)
    box(m, -0.5, 0.5, 0.5, 1.1, 0.03, 0.045, Yl)
    for cx in (-0.28, 0.0, 0.28):
        for pts in ([(-0.07, -0.19), (0.03, -0.19), (0.12, 0), (0.02, 0)], [(0.02, 0), (0.12, 0), (0.03, 0.19), (-0.07, 0.19)]):
            m.poly([(cx + x, 0.8 + y, 0.047) for x, y in pts], K, (0, 0.8, -1))
    return m

def flag_pole():
    m = Mesh(); G, W, K = H('#ffd23c'), H('#fff6ee'), H('#15151c')
    lathe(m, [(0.1, 0, 0, 0), (0.06, 0.06, 0, 0), (0.025, 0.12, 0, 0), (0.025, 1.45, 0, 0)], 8, [H('#6a6f84'), H('#cfd3e0'), H('#cfd3e0')])
    sphere(m, (0, 1.48, 0), 0.045, G, 1)
    nx, ny, fw, fh = 8, 5, 0.75, 0.5
    for i in range(nx):
        for j in range(ny):
            pts = []
            for a, b in ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1)):
                x = 0.03 + fw * a / nx; z = 0.07 * math.sin(a * 0.9) * (a / nx); y = 1.42 - fh * b / ny
                pts.append((x, y, z))
            m.poly(pts, W if (i + j) % 2 == 0 else K, two_sided=True)
    return m

def hay_bale():
    m = Mesh(); S, S2, B = H('#e7c35a'), H('#d4a940'), H('#c0392b')
    t = Mesh()
    lathe(t, [(0.28, -0.25, 0, 0), (0.32, -0.2, 0, 0), (0.32, -0.05, 0, 0), (0.335, -0.02, 0, 0), (0.335, 0.02, 0, 0), (0.32, 0.05, 0, 0), (0.32, 0.2, 0, 0), (0.28, 0.25, 0, 0)], 10, [S, S2, B, B, B, S2, S], rot=0.2)
    t.transform(rot('z', math.pi / 2)); t.translate((0, 0.335, 0)); m.extend(t)
    return m

def trophy():
    m = Mesh(); GD, GL, WD = H('#d9a21b'), H('#ffd84a'), H('#5a3a22')
    box(m, -0.2, 0.2, 0, 0.1, -0.2, 0.2, WD); box(m, -0.15, 0.15, 0.1, 0.15, -0.15, 0.15, mix(WD, H('#ffffff'), 0.1))
    lathe(m, [(0.12, 0.15, 0, 0), (0.05, 0.19, 0, 0), (0.04, 0.34, 0, 0), (0.07, 0.38, 0, 0), (0.11, 0.42, 0, 0), (0.2, 0.62, 0, 0), (0.24, 0.8, 0, 0)], 10, [GD, GL, GD, GL, GD, GL])
    for sx in (-1, 1):
        a = [(sx * 0.2, 0.7, 0), (sx * 0.31, 0.68, 0), (sx * 0.34, 0.58, 0), (sx * 0.27, 0.5, 0), (sx * 0.17, 0.52, 0)]
        for p, q in zip(a, a[1:]): strut(m, p, q, 0.022, GD, 5)
    sphere(m, (0, 0.88, 0), 0.07, GL, 1)
    return m

def podium():
    m = Mesh(); BL, W = H('#3f6cff'), H('#fff6ee')
    steps = [(-0.4, 0.42, H('#c9cfda'), 2), (0.0, 0.6, H('#ffd23c'), 1), (0.4, 0.3, H('#cd7f32'), 3)]
    for x, h, top, num in steps:
        box(m, x - 0.2, x + 0.2, 0, h, -0.2, 0.2, BL)
        box(m, x - 0.21, x + 0.21, h, h + 0.04, -0.21, 0.21, top)
        for k in range(num):
            bx = x + (k - (num - 1) / 2) * 0.09
            box(m, bx - 0.025, bx + 0.025, h * 0.35, h * 0.35 + 0.14, 0.2, 0.212, W)
    return m

def chimney(seed, h, base, neck, cap, cols, sides=9):
    """Peribacası: sütun gövde + koyu şapka. h: boy, base/neck/cap: yarıçaplar."""
    rng = np.random.RandomState(seed); m = Mesh(); BODY, BODY2, CAP, CAP2 = cols
    ys = [0, 0.12, 0.3, 0.5, 0.68, 0.8]
    rs = [base, base * 0.82, base * 0.62 + neck * 0.38, neck * 1.25, neck * 1.05, neck]
    rings = [(r * (1 + rng.uniform(-0.05, 0.05)), y * h, rng.uniform(-0.01, 0.01) * h, rng.uniform(-0.01, 0.01) * h) for r, y in zip(rs, ys)]
    lathe(m, rings, sides, [BODY, BODY2, BODY, BODY2, BODY], rot=rng.uniform(0, 1))
    top = 0.8 * h
    lathe(m, [(neck, top, 0, 0), (cap * 0.85, top + 0.02 * h, 0, 0), (cap, top + 0.07 * h, 0, 0), (cap * 0.9, top + 0.13 * h, 0, 0), (cap * 0.5, top + 0.2 * h, 0, 0), (0.0, top + 0.23 * h, 0, 0)],
          sides, [CAP2, CAP, CAP2, CAP, CAP], rot=rng.uniform(0, 1))
    return m

def chimney_a():
    return chimney(3, 1.0, 0.24, 0.07, 0.15, [H('#e2bf93'), H('#cfa77a'), H('#7a5a44'), H('#5e4433')])

def chimney_b():
    m = chimney(5, 1.0, 0.22, 0.065, 0.14, [H('#dcb88c'), H('#c89f72'), H('#7a5a44'), H('#5e4433')])
    t = chimney(8, 0.62, 0.17, 0.055, 0.11, [H('#e6c89e'), H('#d2ac80'), H('#8a6650'), H('#664a38')], 8)
    t.translate((0.3, 0, 0.1)); m.extend(t)
    return m

def chimney_c():
    return chimney(11, 0.8, 0.28, 0.1, 0.22, [H('#ecd0a4'), H('#d8b588'), H('#6f5240'), H('#54392b')], 10)

def mesa():
    """Düz tepeli kumtaşı kaya (kanyon duvarı / kaya kütlesi)."""
    rng = np.random.RandomState(21); m = Mesh()
    C1, C2, TOP = H('#d9a273'), H('#c0845a'), H('#a8734f')
    rings = []
    for r, y in [(0.5, 0), (0.46, 0.18), (0.42, 0.4), (0.4, 0.62), (0.36, 0.85), (0.34, 1.0)]:
        rings.append((r * rng.uniform(0.94, 1.06), y, rng.uniform(-0.02, 0.02), rng.uniform(-0.02, 0.02)))
    lathe(m, rings, 7, [C1, C2, C1, C2, C1], rot=0.3)
    lathe(m, [(0.34, 1.0, 0, 0), (0.33, 1.05, 0, 0), (0.0, 1.05, 0, 0)], 7, TOP, rot=0.3)
    return m

def hot_air_balloon():
    m = Mesh()
    pal = [H(c) for c in ('#ff4f6d', '#ffd23c', '#ffffff', '#3fb7ff', '#ff8a2a', '#ffffff')]
    prof = [(0.0, 2.02), (0.2, 1.97), (0.38, 1.8), (0.48, 1.55), (0.5, 1.3), (0.45, 1.05), (0.32, 0.86), (0.2, 0.76)]
    N = 12
    for k in range(N):
        a0, a1 = 2 * math.pi * k / N, 2 * math.pi * (k + 1) / N
        c = pal[k % len(pal)]
        for i in range(len(prof) - 1):
            (r0, y0), (r1, y1) = prof[i], prof[i + 1]
            q = [(r0 * math.cos(a0), y0, r0 * math.sin(a0)), (r0 * math.cos(a1), y0, r0 * math.sin(a1)),
                 (r1 * math.cos(a1), y1, r1 * math.sin(a1)), (r1 * math.cos(a0), y1, r1 * math.sin(a0))]
            if r0 < 1e-6: q = [q[0], q[2], q[3]]
            m.poly(q, c * (1.0 - 0.1 * (i % 2)), (0, 1.3, 0))
    W = H('#7a5232')
    box(m, -0.1, 0.1, 0.2, 0.38, -0.1, 0.1, W)
    for sx in (-1, 1):
        for sz in (-1, 1):
            strut(m, (sx * 0.09, 0.38, sz * 0.09), (sx * 0.18 * 0.9, 0.78, sz * 0.18 * 0.9), 0.008, H('#e8e0d0'), 4)
    sphere(m, (0, 0.66, 0), 0.035, H('#ff7a1a'), 0)
    return m

MODELS = {
    'chimney_a': chimney_a, 'chimney_b': chimney_b, 'chimney_c': chimney_c, 'mesa': mesa, 'hot_air_balloon': hot_air_balloon,
    'palm_tropic': palm,
    'rock_boulder_a': lambda: boulder(11, H('#6f7480'), H('#bcc1cb')),
    'rock_boulder_b': lambda: boulder(23, H('#b98c55'), H('#ecca90'), (1.1, 0.65, 0.95)),
    'rock_boulder_c': lambda: boulder(37, H('#3a3640'), H('#6e6678'), (0.9, 0.85, 1.0), 0.25),
    'pine_cartoon': pine,
    'beach_umbrella': umbrella,
    'traffic_cone': cone,
    'street_lamp_neon': street_lamp,
    'neon_billboard': neon_billboard,
    'vending_machine': vending,
    'tire_stack': tire_stack,
    'balloon_bunch': balloons,
    'ferris_wheel': ferris,
    'popcorn_cart': popcorn,
    'candy_cane': candy_cane,
    'gumdrop_cluster': gumdrops,
    'swirl_lollipop': swirl_lollipop,
    'alphabet_block': alphabet_block,
    'rubber_duck': rubber_duck,
    'spinning_top': spinning_top,
    'toy_train': toy_train,
    'start_arch': start_arch,
    'tire_wall': tire_wall,
    'chevron_sign': chevron_sign,
    'flag_pole': flag_pole,
    'hay_bale': hay_bale,
    'trophy_cup': trophy,
    'finish_podium': podium,
}

if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else 'public/models/tayfa'
    os.makedirs(out, exist_ok=True)
    for name, fn in MODELS.items():
        m = fn()
        ymin = min(p[1] for p in m.pos)
        m.translate((0, -ymin, 0))
        write_glb(os.path.join(out, name + '.glb'), name, m)
        print('yazıldı', name)
