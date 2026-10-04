"""Yengeç tehlikesi (hazard-crab.glb): kırmızı-turuncu low-poly yengeç. Gövde X ekseninde geniş (yan yürüyüş yönü = +X), yüzü +Z.
Kullanım: python tools/gen_crab.py [çıkış_klasörü]   (varsayılan public/models/hazard)
Bağımsız çalışır (yalnız gen_props'a bağlı)."""
import math, os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen_props import Mesh, H, mix, box, sphere, ellip, strut, write_glb


def crab():
    m = Mesh()
    SHELL, BELLY, DARK, WHITE = H('#e8442b'), H('#ffb36b'), H('#1c1c24'), H('#ffffff')
    TIP = mix(SHELL, H('#ffd0a0'), 0.35)
    # Gövde: yassı geniş kabuk + alt karın
    ellip(m, (0, 0.62, 0), (1.15, 0.5, 0.82), SHELL, 1)
    ellip(m, (0, 0.38, 0), (1.05, 0.28, 0.74), BELLY, 1)
    # Gözler: kısa saplar
    for s in (-1, 1):
        strut(m, (s * 0.38, 1.0, 0.62), (s * 0.4, 1.34, 0.66), 0.06, SHELL, 5)
        sphere(m, (s * 0.4, 1.4, 0.68), 0.15, WHITE, 0)
        sphere(m, (s * 0.4, 1.4, 0.82), 0.075, DARK, 0)
    # Kıskaçlar: kol + iki parçalı pençe, ön tarafta
    for s in (-1, 1):
        strut(m, (s * 0.95, 0.62, 0.6), (s * 1.35, 0.8, 1.12), 0.12, SHELL, 6)
        ellip(m, (s * 1.45, 0.88, 1.3), (0.42, 0.3, 0.38), SHELL, 1)
        ellip(m, (s * 1.28, 0.85, 1.6), (0.18, 0.12, 0.3), TIP, 0)
        ellip(m, (s * 1.62, 0.85, 1.6), (0.18, 0.12, 0.3), TIP, 0)
    # Bacaklar: her yanda 3, gövdeden dışa ve yere
    for s in (-1, 1):
        for k, z in enumerate((-0.45, -0.1, 0.25)):
            x0 = s * 1.0
            kneeX, kneeY = s * (1.55 + 0.1 * k), 0.85
            footX = s * (1.85 + 0.15 * k)
            strut(m, (x0, 0.55, z), (kneeX, kneeY, z - 0.1), 0.07, SHELL, 5)
            strut(m, (kneeX, kneeY, z - 0.1), (footX, 0.0, z - 0.2), 0.065, SHELL, 5)
            sphere(m, (footX, 0.04, z - 0.2), 0.08, TIP, 0)
    return m


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'models', 'hazard')
    os.makedirs(out, exist_ok=True)
    m = crab()
    write_glb(os.path.join(out, 'hazard-crab.glb'), 'hazard-crab', m)
    print('hazard-crab üçgen:', len(m.pos) // 3)
