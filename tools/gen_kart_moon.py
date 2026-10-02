"""Turbo Tayfa - Ay Yolu temalı kart üretici.

Oyunun sözleşmesi (src/kartModel.js):
  - GLB, +Z ileri, Y yukarı
  - 'wheel-front-left/right', 'wheel-back-left/right' düğümleri (X ekseninde döner)
  - 'character' düğümü = sürücü koltuğu (kod hayvanı buraya oturtur, düğümü gizler)
  - tekerlek yarıçapı ~0.21 (kod 0.21 * 2 ile dönüş hızını hesaplar)
Renkler vertex color olarak gömülür (doku yok), flat-shaded.
"""
import json, math, struct, sys
import numpy as np

# ---------------------------------------------------------------- renk
def hex2lin(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4) for x in c]

# ---------------------------------------------------------------- geometri
class Mesh:
    def __init__(self):
        self.pos, self.nrm, self.col = [], [], []

    def poly(self, verts, color, centroid):
        """Dışbükey parçanın bir yüzü; merkeze göre dışarı bakacak şekilde yönlendirilir."""
        v = [np.array(p, float) for p in verts]
        n = np.cross(v[1] - v[0], v[2] - v[0])
        if np.linalg.norm(n) < 1e-12:
            return
        if np.dot(n, np.mean(v, axis=0) - centroid) < 0:
            v = v[::-1]
            n = -n
        n = n / np.linalg.norm(n)
        for i in range(1, len(v) - 1):
            for p in (v[0], v[i], v[i + 1]):
                self.pos.append(p); self.nrm.append(n); self.col.append(color)

    def convex(self, polys, color, mirror=False):
        for flip in ((False, True) if mirror else (False,)):
            ps = [[(-x if flip else x, y, z) for x, y, z in poly] for poly in polys]
            allv = np.array([p for poly in ps for p in poly], float)
            c = allv.mean(axis=0)
            for poly in ps:
                self.poly(poly, color, c)

def loft(sections):
    """Ardışık kesitler (her biri aynı sayıda köşe) arası yan yüzler + uç kapakları."""
    polys = []
    n = len(sections[0])
    for a, b in zip(sections, sections[1:]):
        for i in range(n):
            j = (i + 1) % n
            polys.append([a[i], a[j], b[j], b[i]])
    polys.append(list(sections[0]))
    polys.append(list(sections[-1]))
    return polys

def sec(z, hb, ht, yb, yt, xo=0.0):
    """Z'deki yamuk kesit: alt yarı genişlik hb, üst yarı genişlik ht, y aralığı yb..yt."""
    return [(-hb + xo, yb, z), (hb + xo, yb, z), (ht + xo, yt, z), (-ht + xo, yt, z)]

def box(x0, x1, y0, y1, z0, z1):
    cx, hx = (x0 + x1) / 2, (x1 - x0) / 2
    return loft([sec(z0, hx, hx, y0, y1, cx), sec(z1, hx, hx, y0, y1, cx)])

def ring(n, r, axis, at, rot=0.0, ry=None):
    """Eksene dik düzlemde n köşeli halka. axis: 'x' veya 'z'."""
    ry = r if ry is None else ry
    pts = []
    for i in range(n):
        a = rot + 2 * math.pi * i / n
        u, w = r * math.cos(a), ry * math.sin(a)
        pts.append((at, u, w) if axis == 'x' else (u, w, at))
    return pts

def prism_x(n, rings, rot=0.0):
    """X ekseninde: rings = [(x, r), ...]"""
    return loft([ring(n, r, 'x', x, rot) for x, r in rings])

def prism_z(n, rings, cx=0.0, cy=0.0, rot=0.0, ry_scale=1.0):
    out = []
    for z, r in rings:
        pts = ring(n, r, 'z', z, rot, r * ry_scale)
        out.append([(x + cx, y + cy, zz) for x, y, zz in pts])
    return loft(out)

# ---------------------------------------------------------------- palet
PAL = dict(
    hull='#e9edf3', hull2='#b9c3d1', dark='#2a3040', darker='#141824', tire='#1d2029',
    glow='#5ae8ff', warm='#ffb347', white='#ffffff', red='#ff3b3b',
)

def extrude_x(profile, x0, x1):
    """(z, y) profilini X boyunca x0..x1 arası kalınlaştırır (dışbükey profil)."""
    polys = [[(x0, y, z) for z, y in profile], [(x1, y, z) for z, y in profile]]
    n = len(profile)
    for i in range(n):
        j = (i + 1) % n
        polys.append([(x0, profile[i][1], profile[i][0]), (x0, profile[j][1], profile[j][0]),
                      (x1, profile[j][1], profile[j][0]), (x1, profile[i][1], profile[i][0])])
    return polys

def extrude_y(profile, y0, y1):
    """(x, z) profilini Y boyunca kalınlaştırır (yatay kanat)."""
    polys = [[(x, y0, z) for x, z in profile], [(x, y1, z) for x, z in profile]]
    n = len(profile)
    for i in range(n):
        j = (i + 1) % n
        polys.append([(profile[i][0], y0, profile[i][1]), (profile[j][0], y0, profile[j][1]),
                      (profile[j][0], y1, profile[j][1]), (profile[i][0], y1, profile[i][1])])
    return polys

def build(accent='#ff5a3c', glow='#5ae8ff'):
    P = {k: hex2lin(v) for k, v in PAL.items()}
    A, G = hex2lin(accent), hex2lin(glow)
    body = Mesh()

    # ---- alt şasi / etek ----
    body.convex(loft([sec(-0.62, 0.30, 0.30, 0.10, 0.18), sec(0.62, 0.24, 0.24, 0.10, 0.18)]), P['darker'])
    # yan plazma şeritleri (zemin ışığı)
    body.convex(box(0.285, 0.31, 0.085, 0.12, -0.10, 0.14), G, mirror=True)

    # ---- orta küvet: ALÇAK, hayvan içine oturur ----
    body.convex(box(-0.22, 0.22, 0.17, 0.23, -0.46, 0.28), P['dark'])               # kokpit zemini
    body.convex(loft([sec(-0.46, 0.0, 0.0, 0, 0)][:0] or [
        [(0.19, 0.17, -0.46), (0.29, 0.17, -0.46), (0.29, 0.31, -0.46), (0.19, 0.31, -0.46)],
        [(0.19, 0.17, 0.26), (0.29, 0.17, 0.26), (0.29, 0.31, 0.26), (0.19, 0.31, 0.26)]]), P['hull'], mirror=True)  # yan eşikler
    body.convex(box(0.21, 0.28, 0.31, 0.325, -0.42, 0.22), A, mirror=True)           # eşik vurgu şeridi

    # ---- burun: alçak, sivri kama ----
    body.convex(loft([sec(0.26, 0.30, 0.25, 0.17, 0.33),
                      sec(0.62, 0.20, 0.12, 0.17, 0.26),
                      sec(0.88, 0.05, 0.03, 0.17, 0.21)]), P['hull'])
    body.convex(loft([sec(0.30, 0.06, 0.045, 0.325, 0.335), sec(0.62, 0.04, 0.03, 0.255, 0.263), sec(0.87, 0.02, 0.015, 0.208, 0.214)]), A)
    body.convex(box(-0.04, 0.04, 0.17, 0.215, 0.875, 0.905), G)                       # burun ucu ışığı

    # ---- ön kanat: dar, koyu, küçük uç plakalar ----
    body.convex(box(-0.44, 0.44, 0.13, 0.165, 0.72, 0.86), P['dark'])
    body.convex(box(0.43, 0.46, 0.12, 0.20, 0.71, 0.87), A, mirror=True)

    # ---- yan podlar (tekerlekler arasında, açılı) ----
    body.convex(loft([
        [(0.30, 0.17, -0.12), (0.46, 0.17, -0.12), (0.43, 0.40, -0.12), (0.30, 0.40, -0.12)],
        [(0.30, 0.17, 0.15), (0.46, 0.17, 0.15), (0.43, 0.33, 0.15), (0.30, 0.33, 0.15)]]), P['hull'], mirror=True)
    body.convex(loft([
        [(0.43, 0.26, -0.12), (0.465, 0.26, -0.12), (0.46, 0.32, -0.12), (0.425, 0.32, -0.12)],
        [(0.43, 0.26, 0.15), (0.465, 0.26, 0.15), (0.46, 0.30, 0.15), (0.425, 0.30, 0.15)]]), A, mirror=True)
    body.convex(box(0.32, 0.42, 0.22, 0.28, 0.15, 0.175), G, mirror=True)           # pod ön ışığı

    # ---- arka motor bloğu ----
    body.convex(loft([sec(-0.46, 0.27, 0.22, 0.17, 0.54),
                      sec(-0.62, 0.25, 0.17, 0.17, 0.52),
                      sec(-0.72, 0.22, 0.13, 0.17, 0.42)]), P['hull'])
    body.convex(loft([sec(-0.47, 0.05, 0.04, 0.535, 0.545), sec(-0.62, 0.045, 0.035, 0.515, 0.525)]), A)  # sırt şeridi
    body.convex(box(0.215, 0.275, 0.30, 0.46, -0.58, -0.50), P['dark'], mirror=True)  # yan hava girişi
    body.convex(box(-0.15, 0.15, 0.36, 0.395, -0.725, -0.715), P['red'])              # stop şeridi

    # ---- plazma nozulları ----
    for sx in (-0.11, 0.11):
        body.convex(prism_z(6, [(-0.70, 0.08), (-0.77, 0.10), (-0.80, 0.105)], cx=sx, cy=0.27, rot=math.pi / 6), P['dark'])
        body.convex(prism_z(6, [(-0.795, 0.07), (-0.815, 0.07)], cx=sx, cy=0.27, rot=math.pi / 6), G)

    # ---- kuyruk yüzgeci (uzay gemisi gibi) ----
    body.convex(extrude_x([(-0.46, 0.52), (-0.72, 0.46), (-0.80, 0.92), (-0.66, 0.92)], -0.025, 0.025), P['hull2'])
    body.convex(extrude_x([(-0.665, 0.84), (-0.795, 0.84), (-0.80, 0.92), (-0.66, 0.92)], -0.03, 0.03), A)

    # ---- delta kanatçıklar ----
    body.convex(extrude_y([(0.22, -0.50), (0.56, -0.72), (0.56, -0.80), (0.22, -0.76)], 0.48, 0.515), P['hull2'], mirror=True)
    body.convex(box(0.54, 0.57, 0.47, 0.56, -0.82, -0.74), A, mirror=True)

    # ---- anten + çanak (sol arka) ----
    body.convex(box(-0.265, -0.24, 0.52, 0.90, -0.56, -0.535), P['hull2'])
    body.convex(prism_z(6, [(-0.60, 0.0), (-0.525, 0.10)], cx=-0.2525, cy=0.92, rot=0.3), P['white'])

    # ---- tekerlekler: 8 köşeli, keskin ----
    R, W = 0.215, 0.20

    def wheel(side):
        m = Mesh()
        n, rot, h = 8, math.pi / 8, W / 2
        m.convex(prism_x(n, [(-h, R * 0.84), (-h + 0.04, R), (h - 0.04, R), (h, R * 0.84)], rot), P['tire'])
        m.convex(prism_x(n, [(h - 0.01, R * 0.64), (h + 0.035, R * 0.52)], rot), P['hull2'])
        m.convex(prism_x(6, [(h + 0.034, R * 0.30), (h + 0.06, R * 0.24)]), G)
        m.convex(prism_x(n, [(-h + 0.01, R * 0.62), (-h - 0.02, R * 0.5)], rot), P['dark'])
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

# ---------------------------------------------------------------- GLB yazıcı
def write_glb(path, name, body, wheels, seat):
    bin_chunks, views, accessors, meshes, nodes = [], [], [], [], []

    def add_buf(arr, target=None):
        data = arr.tobytes()
        off = sum(len(c) for c in bin_chunks)
        bin_chunks.append(data + b'\x00' * (-len(data) % 4))
        v = {'buffer': 0, 'byteOffset': off, 'byteLength': len(data)}
        if target: v['target'] = target
        views.append(v)
        return len(views) - 1

    def add_acc(arr, ctype, typ, minmax=False):
        vi = add_buf(arr, 34962)
        a = {'bufferView': vi, 'componentType': ctype, 'count': len(arr), 'type': typ}
        if minmax:
            a['min'] = arr.min(axis=0).tolist(); a['max'] = arr.max(axis=0).tolist()
        accessors.append(a)
        return len(accessors) - 1

    def add_mesh(m, mname):
        pos = np.array(m.pos, np.float32); nrm = np.array(m.nrm, np.float32); col = np.array(m.col, np.float32)
        idx = np.arange(len(pos), dtype=np.uint32)
        a_pos = add_acc(pos, 5126, 'VEC3', True)
        a_nrm = add_acc(nrm, 5126, 'VEC3')
        a_col = add_acc(col, 5126, 'VEC3')
        vi = add_buf(idx, 34963)
        accessors.append({'bufferView': vi, 'componentType': 5125, 'count': len(idx), 'type': 'SCALAR'})
        meshes.append({'name': mname, 'primitives': [{
            'attributes': {'POSITION': a_pos, 'NORMAL': a_nrm, 'COLOR_0': a_col},
            'indices': len(accessors) - 1, 'material': 0}]})
        return len(meshes) - 1

    nodes.append({'name': name, 'mesh': add_mesh(body, name), 'children': []})
    for wname, (t, wm) in wheels.items():
        nodes.append({'name': wname, 'mesh': add_mesh(wm, wname), 'translation': list(t)})
        nodes[0]['children'].append(len(nodes) - 1)
    st, sm = seat
    nodes.append({'name': 'character', 'mesh': add_mesh(sm, 'character'), 'translation': list(st)})
    nodes[0]['children'].append(len(nodes) - 1)

    gltf = {
        'asset': {'version': '2.0', 'generator': 'turbo-tayfa moonkart generator'},
        'scene': 0, 'scenes': [{'name': name, 'nodes': [0]}], 'nodes': nodes, 'meshes': meshes,
        'materials': [{'name': 'moon', 'pbrMetallicRoughness': {
            'baseColorFactor': [1, 1, 1, 1], 'metallicFactor': 0.0, 'roughnessFactor': 0.85}}],
        'accessors': accessors, 'bufferViews': views,
    }
    binary = b''.join(bin_chunks)
    gltf['buffers'] = [{'byteLength': len(binary)}]
    js = json.dumps(gltf, separators=(',', ':')).encode()
    js += b' ' * (-len(js) % 4)
    total = 12 + 8 + len(js) + 8 + len(binary)
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, total))
        f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
        f.write(struct.pack('<II', len(binary), 0x004E4942)); f.write(binary)
    tris = sum(len(m.pos) for m in [body] + [w[1] for w in wheels.values()]) // 3
    return tris

if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else 'kart-moon-balanced.glb'
    body, wheels, seat = build()
    print(out, 'üçgen:', write_glb(out, 'kart-moon-balanced', body, wheels, seat))
