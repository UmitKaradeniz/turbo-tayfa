import * as THREE from 'three';

// Altın süpriz kutusu: "süpriz yolu" kestirmelerinin sonunda durur, çift haklı eşya verir.
// Görünüm pistin temasına göre değişir (def.shortcuts[].surprise.skin); hepsi kodla çizilir (dış varlık yok).
// Ayrıca yolun girişinde altın bir kemer ("?" tabelalı) durur.

const GOLD = 0xffc933;
const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.35, ...extra });
const glow = (color, k = 0.6) => std(color, { emissive: color, emissiveIntensity: k });
const gold = () => std(GOLD, { emissive: 0xb07a00, emissiveIntensity: 0.55, metalness: 0.8, roughness: 0.25 });
const mesh = (geo, mat, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
};

function radial() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.5)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function questionTexture(fg = '#ffd23f', bg = 'rgba(20,14,40,0.9)') {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.beginPath();
  g.roundRect(6, 6, 116, 116, 22);
  g.fill();
  g.lineWidth = 7;
  g.strokeStyle = fg;
  g.stroke();
  g.fillStyle = fg;
  g.font = '900 96px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('?', 64, 70);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function lathe(profile, mat) {
  return new THREE.Mesh(new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 20), mat);
}

// Her biri ~1.1 m yarıçaplı, merkezi orijinde bir Group döner
const SKINS = {
  // Açık hazine sandığı (Palmiye Koyu)
  chest() {
    const g = new THREE.Group();
    const wood = std(0x8a4f22, { metalness: 0.1 });
    g.add(mesh(new THREE.BoxGeometry(1.7, 0.9, 1.1), wood, 0, -0.2, 0));
    // Kapak arkadan menteşeli, geriye açık; içinde altın yığını
    const pivot = new THREE.Group();
    pivot.position.set(0, 0.25, -0.55);
    pivot.rotation.x = -1.15;
    const lid = mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.7, 16, 1, false, 0, Math.PI), wood, 0, 0, 0.55);
    lid.rotation.z = Math.PI / 2;
    pivot.add(lid);
    g.add(pivot);
    const pile = mesh(new THREE.SphereGeometry(0.5, 14, 10), gold(), 0, 0.2, 0);
    pile.scale.set(1.5, 0.55, 0.9);
    g.add(pile);
    for (const x of [-0.6, 0.6]) g.add(mesh(new THREE.BoxGeometry(0.16, 0.95, 1.14), gold(), x, -0.2, 0));
    g.add(mesh(new THREE.BoxGeometry(0.3, 0.3, 0.14), gold(), 0, 0.05, 0.6));
    return g;
  },
  // Kurdeleli hediye paketi (Şeker Diyarı, Kar Zirvesi)
  gift(c = {}) {
    const g = new THREE.Group();
    const box = std(c.box ?? 0xff5fa8, { metalness: 0.1 });
    const rib = std(c.ribbon ?? 0xffffff, { metalness: 0.1 });
    g.add(mesh(new THREE.BoxGeometry(1.5, 1.3, 1.5), box));
    g.add(mesh(new THREE.BoxGeometry(1.56, 1.36, 0.34), rib));
    g.add(mesh(new THREE.BoxGeometry(0.34, 1.36, 1.56), rib));
    for (const s of [-1, 1]) {
      const loop = mesh(new THREE.TorusGeometry(0.3, 0.09, 8, 16), rib, s * 0.3, 0.88, 0);
      loop.rotation.x = Math.PI / 2;
      loop.rotation.y = s * 0.5;
      g.add(loop);
    }
    g.add(mesh(new THREE.SphereGeometry(0.15, 10, 8), rib, 0, 0.78, 0));
    return g;
  },
  // Kristal kümesi (Volkan: magma, Ay: mavi, Kar: buz)
  crystal(c = {}) {
    const g = new THREE.Group();
    const mat = std(c.color ?? 0xff6a1a, { emissive: c.color ?? 0xff6a1a, emissiveIntensity: c.glow ?? 0.9, transparent: true, opacity: 0.92, roughness: 0.15, flatShading: true });
    const dims = [[0.42, 1.7, 0, 0, 0, 0], [0.3, 1.2, -0.5, -0.2, 0.1, 0.45], [0.3, 1.1, 0.5, -0.25, -0.1, -0.5], [0.24, 0.9, 0.1, -0.3, 0.5, -0.2]];
    for (const [r, h, x, y, z, tilt] of dims) {
      const m = mesh(new THREE.CylinderGeometry(0, r, h, 6, 1), mat, x, y + h / 2 - 0.55, z);
      m.rotation.z = tilt;
      g.add(m);
      const base = mesh(new THREE.CylinderGeometry(r, 0, h * 0.35, 6, 1), mat, x, y - 0.55 - h * 0.1, z);
      base.rotation.z = tilt;
      g.add(base);
    }
    return g;
  },
  // Neon "SÜRPRİZ" kutusu (Neon Şehir)
  neon() {
    const g = new THREE.Group();
    g.add(mesh(new THREE.BoxGeometry(1.5, 1.5, 1.5), std(0x1a1030, { metalness: 0.3 })));
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.56, 1.56, 1.56)), new THREE.LineBasicMaterial({ color: 0xff3fa4, toneMapped: false }));
    g.add(edges);
    const tex = questionTexture('#3fe0ff', 'rgba(10,6,30,0.95)');
    for (const [ry, x, z] of [[0, 0, 0.77], [Math.PI, 0, -0.77], [Math.PI / 2, 0.77, 0], [-Math.PI / 2, -0.77, 0]]) {
      const p = mesh(new THREE.PlaneGeometry(1.2, 1.2), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }), x, 0, z);
      p.rotation.y = ry;
      g.add(p);
    }
    return g;
  },
  // Anadolu çömleği (Kapadokya)
  pot() {
    const g = new THREE.Group();
    const clay = std(0xb5532b, { metalness: 0.05, roughness: 0.7 });
    g.add(lathe([[0.01, -0.8], [0.45, -0.75], [0.8, -0.3], [0.85, 0.1], [0.62, 0.5], [0.42, 0.72], [0.5, 0.86], [0.46, 0.9], [0.3, 0.8]], clay));
    const band = lathe([[0.84, 0.02], [0.86, 0.1], [0.84, 0.18], [0.8, 0.18], [0.82, 0.1], [0.8, 0.02]], gold());
    g.add(band);
    for (const s of [-1, 1]) {
      const h = mesh(new THREE.TorusGeometry(0.28, 0.07, 8, 14, Math.PI), clay, s * 0.52, 0.55, 0);
      h.rotation.z = s > 0 ? -0.5 : Math.PI + 0.5;
      g.add(h);
    }
    return g;
  },
  // Altın benekli dinozor yumurtası (Dinozor Vadisi)
  egg() {
    const g = new THREE.Group();
    const e = mesh(new THREE.SphereGeometry(0.8, 20, 16), std(0xffd45a, { emissive: 0x8a5a00, emissiveIntensity: 0.4, metalness: 0.5, roughness: 0.3 }));
    e.scale.set(1, 1.35, 1);
    g.add(e);
    const spot = std(0x2f9e5b, { metalness: 0.1 });
    for (const [x, y, z, r] of [[0.55, 0.25, 0.55, 0.2], [-0.5, 0.55, 0.5, 0.15], [0.2, -0.45, 0.75, 0.18], [-0.65, -0.2, 0.4, 0.13], [0.7, 0.75, 0.1, 0.12]]) g.add(mesh(new THREE.SphereGeometry(r, 10, 8), spot, x, y, z).translateZ(0));
    return g;
  },
  // Balon demeti + minik paket (Lunapark)
  balloons() {
    const g = new THREE.Group();
    const cols = [0xff4f9a, 0xffd23f, 0x3fa9ff];
    cols.forEach((col, k) => {
      const a = (k / 3) * Math.PI * 2;
      const b = mesh(new THREE.SphereGeometry(0.5, 16, 12), glow(col, 0.35), Math.cos(a) * 0.45, 0.65 + k * 0.08, Math.sin(a) * 0.45);
      b.scale.y = 1.2;
      g.add(b);
      g.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.0, 4), std(0xffffff), Math.cos(a) * 0.22, 0.05, Math.sin(a) * 0.22));
    });
    g.add(mesh(new THREE.BoxGeometry(0.7, 0.55, 0.7), std(0xff4f9a), 0, -0.65, 0));
    g.add(mesh(new THREE.BoxGeometry(0.74, 0.12, 0.2), gold(), 0, -0.65, 0));
    g.add(mesh(new THREE.BoxGeometry(0.2, 0.12, 0.74), gold(), 0, -0.65, 0));
    return g;
  },
  // Yeşil ruh feneri (Hayalet Mezarlığı)
  lantern() {
    const g = new THREE.Group();
    g.add(mesh(new THREE.CylinderGeometry(0.5, 0.42, 1.2, 8, 1, true), glow(0x6dff9a, 0.9)));
    g.add(mesh(new THREE.SphereGeometry(0.32, 12, 10), glow(0xd8ffe4, 1.4)));
    const dark = std(0x1d1a24, { metalness: 0.5 });
    g.add(mesh(new THREE.CylinderGeometry(0.58, 0.5, 0.18, 8), dark, 0, -0.68));
    g.add(mesh(new THREE.CylinderGeometry(0.28, 0.58, 0.3, 8), dark, 0, 0.72));
    const ring = mesh(new THREE.TorusGeometry(0.22, 0.05, 8, 14), gold(), 0, 1.02, 0);
    g.add(ring);
    return g;
  },
  // Uzay kapsülü (Ay Yolu)
  capsule() {
    const g = new THREE.Group();
    const hull = std(0xdfe6f2, { metalness: 0.6, roughness: 0.25 });
    g.add(mesh(new THREE.CapsuleGeometry(0.55, 0.9, 6, 16), hull));
    const win = mesh(new THREE.TorusGeometry(0.28, 0.07, 8, 16), gold(), 0, 0.15, 0.52);
    g.add(win);
    g.add(mesh(new THREE.CircleGeometry(0.22, 16), glow(0x3fa9ff, 0.9), 0, 0.15, 0.53));
    for (const a of [0, 2.1, 4.2]) {
      const fin = mesh(new THREE.BoxGeometry(0.08, 0.5, 0.45), std(0xff4a3a), Math.sin(a) * 0.62, -0.7, Math.cos(a) * 0.62);
      fin.rotation.y = a;
      g.add(fin);
    }
    return g;
  },
  // Bal küpü (Çam Vadisi)
  honey() {
    const g = new THREE.Group();
    g.add(lathe([[0.01, -0.75], [0.5, -0.7], [0.8, -0.25], [0.82, 0.15], [0.6, 0.55], [0.44, 0.62], [0.01, 0.62]], std(0xe39a1c, { emissive: 0x7a4500, emissiveIntensity: 0.35, roughness: 0.2, metalness: 0.15 })));
    g.add(mesh(new THREE.CylinderGeometry(0.5, 0.46, 0.2, 14), std(0x8a5a2b, { metalness: 0.05 }), 0, 0.72));
    g.add(mesh(new THREE.SphereGeometry(0.1, 8, 6), std(0xe39a1c), 0.5, 0.45, 0.32));
    g.add(mesh(new THREE.SphereGeometry(0.2, 8, 6), gold(), 0, 0.92));
    return g;
  },
  // Fırlayan jack-in-the-box (Oyuncak Odası)
  jack() {
    const g = new THREE.Group();
    g.add(mesh(new THREE.BoxGeometry(1.3, 0.9, 1.3), std(0x2f6fd6, { metalness: 0.1 }), 0, -0.55));
    for (const [x, z] of [[-0.45, 0], [0.45, 0], [0, -0.45], [0, 0.45]]) g.add(mesh(new THREE.BoxGeometry(x ? 0.18 : 1.34, 0.92, z ? 0.18 : 1.34), std(0xffd23f, { metalness: 0.1 }), 0, -0.55).translateX(0));
    for (let k = 0; k < 5; k++) g.add(mesh(new THREE.TorusGeometry(0.2, 0.04, 6, 12), std(0xcfd6e6, { metalness: 0.8 }), 0, 0.0 + k * 0.17, 0).rotateX(Math.PI / 2));
    g.add(mesh(new THREE.SphereGeometry(0.42, 16, 12), std(0xffd7b0, { metalness: 0.05 }), 0, 1.0));
    g.add(mesh(new THREE.ConeGeometry(0.4, 0.7, 12), std(0xff4f9a), 0, 1.6));
    g.add(mesh(new THREE.SphereGeometry(0.1, 8, 6), std(0xff3333), 0, 1.0, 0.4));
    return g;
  },
};

// Kısayol tanımındaki surprise.skin → [üretici, seçenekler]
const SKIN_PRESETS = {
  chest: ['chest'],
  gift: ['gift', { box: 0xff5fa8, ribbon: 0xffffff }],
  xmas: ['gift', { box: 0xd8263a, ribbon: 0xffd23f }],
  magma: ['crystal', { color: 0xff6a1a, glow: 1.1 }],
  moon: ['crystal', { color: 0x4fb0ff, glow: 0.9 }],
  ice: ['crystal', { color: 0x9fe6ff, glow: 0.55 }],
  neon: ['neon'],
  pot: ['pot'],
  egg: ['egg'],
  balloons: ['balloons'],
  lantern: ['lantern'],
  capsule: ['capsule'],
  honey: ['honey'],
  jack: ['jack'],
};

let sparkTex = null;
let haloTex = null;
const SPARKS = 7;

export function createGoldBox(skin = 'chest') {
  sparkTex ??= radial();
  haloTex ??= radial();
  const [kind, opts] = SKIN_PRESETS[skin] ?? SKIN_PRESETS.chest;
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.add(SKINS[kind](opts));
  body.scale.setScalar(1.15);
  root.add(body);

  const halo = new THREE.Mesh(
    new THREE.PlaneGeometry(4.6, 4.6).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: haloTex, color: GOLD, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -3, toneMapped: false }),
  );
  halo.position.y = -1.22;
  const sparkPos = new Float32Array(SPARKS * 3);
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ map: sparkTex, color: 0xffe27a, size: 0.7, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  sparks.frustumCulled = false;
  root.add(halo, sparks);

  root.userData.animate = (dt, time, hue, i) => {
    body.rotation.y += dt * 1.1;
    body.position.y = Math.sin(time * 2.2 + i) * 0.08;
    halo.scale.setScalar(0.95 + Math.sin(time * 2.4 + i) * 0.1);
    for (let k = 0; k < SPARKS; k++) {
      const a = time * (1.1 + k * 0.1) + (k * Math.PI * 2) / SPARKS;
      const r = 1.5 + Math.sin(time * 1.9 + k * 2) * 0.2;
      sparkPos[k * 3] = Math.cos(a) * r;
      sparkPos[k * 3 + 1] = Math.sin(time * 1.5 + k * 1.9) * 1.05;
      sparkPos[k * 3 + 2] = Math.sin(a) * r;
    }
    sparkGeo.attributes.position.needsUpdate = true;
  };
  root.userData.animate(0, 0, 0, 0);
  return root;
}

// Süpriz yolunun girişindeki altın kemer: iki direk, üstte parlayan kiriş ve "?" tabelası
export function createSurpriseArch(halfWidth) {
  const g = new THREE.Group();
  const w = halfWidth + 1.1;
  for (const s of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(0.5, 4.6, 0.5), gold(), s * w, 2.3, 0));
  g.add(mesh(new THREE.BoxGeometry(2 * w + 0.5, 0.45, 0.5), glow(GOLD, 0.9), 0, 4.6, 0));
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), new THREE.MeshBasicMaterial({ map: questionTexture(), toneMapped: false, side: THREE.DoubleSide }));
  sign.position.y = 6.0;
  g.add(sign);
  g.add(mesh(new THREE.BoxGeometry(0.12, 0.9, 0.12), gold(), 0, 5.0, 0));
  return g;
}
