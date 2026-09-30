import * as THREE from 'three';

// Volkan Adası'nın ortasındaki yanardağ: koyu koni, yamaçtan inen lav akıntıları, kraterde parlayan lav.
// createVolcanoShow: periyodik patlama (kor yağmuru + kül bulutu); tuzak değil, sadece görsel.

const RING = [ // [yarıçap oranı, yükseklik oranı]
  [1.0, 0], [0.88, 0.1], [0.72, 0.26], [0.56, 0.45], [0.41, 0.64], [0.29, 0.82], [0.22, 0.94], [0.2, 1.0], [0.14, 0.93], [0.0, 0.88],
];
const SEGS = 40;

const wobble = (a, k) => 1 + 0.09 * Math.sin(a * 3 + k * 1.7) + 0.05 * Math.sin(a * 7 - k * 2.3) + 0.03 * Math.sin(a * 13 + k);

export function buildVolcano({ x, z, radius = 80, height = 80, y = -1.5 }) {
  const group = new THREE.Group();
  group.position.set(x, y, z);

  const pos = [];
  const col = [];
  const idx = [];
  const c = new THREE.Color();
  const dark = new THREE.Color(0x2b2523);
  const rock = new THREE.Color(0x4a3a33);
  const hot = new THREE.Color(0x7a2d18);
  const vert = (s, k) => {
    const a = (s / SEGS) * Math.PI * 2;
    const [rf, hf] = RING[k];
    const w = wobble(a, k);
    return [Math.cos(a) * radius * rf * w, height * hf * (0.96 + 0.06 * Math.sin(a * 5 + k)), Math.sin(a) * radius * rf * w];
  };
  for (let k = 0; k < RING.length; k++) {
    for (let s = 0; s <= SEGS; s++) {
      pos.push(...vert(s % SEGS, k));
      c.copy(dark).lerp(rock, 0.5 + 0.5 * Math.sin(s * 1.7 + k * 2.1)).lerp(hot, Math.max(0, RING[k][1] - 0.7) * 2.2);
      col.push(c.r, c.g, c.b);
    }
  }
  const row = SEGS + 1;
  for (let k = 0; k < RING.length - 1; k++) {
    for (let s = 0; s < SEGS; s++) {
      const a = k * row + s;
      idx.push(a, a + row, a + 1, a + 1, a + row, a + row + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const body = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true, side: THREE.DoubleSide }));
  group.add(body);

  // Lav akıntıları: kraterden eteğe doğru ince, parlak şeritler
  const lavaMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.8, 0.95, 0.15), toneMapped: false, side: THREE.DoubleSide, fog: true });
  const streams = 7;
  for (let n = 0; n < streams; n++) {
    const sIdx = Math.round(((n + 0.3 * Math.sin(n * 4.1)) / streams) * SEGS) % SEGS;
    const from = 7 - (n % 3); // kraterden ne kadar aşağıdan başlasın
    const to = n % 2 ? 1 : 2;
    const sp = [];
    const si = [];
    let m = 0;
    for (let k = from; k >= to; k--) {
      const [px, py, pz] = vert(sIdx, k);
      const len = Math.hypot(px, pz) || 1;
      const out = 0.7; // yüzeyin biraz dışına
      const wdt = 1.3 + (from - k) * 0.55 + 0.4 * Math.sin(n + k);
      const tx = -pz / len;
      const tz = px / len;
      sp.push(px + (px / len) * out - tx * wdt, py + 0.2, pz + (pz / len) * out - tz * wdt, px + (px / len) * out + tx * wdt, py + 0.2, pz + (pz / len) * out + tz * wdt);
      if (m > 0) si.push((m - 1) * 2, (m - 1) * 2 + 1, m * 2, m * 2, (m - 1) * 2 + 1, m * 2 + 1);
      m++;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    g.setIndex(si);
    group.add(new THREE.Mesh(g, lavaMat));
  }

  // Kraterdeki lav gölü
  const crater = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.17, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.0, 1.6, 0.35), toneMapped: false }));
  crater.position.y = height * 0.93;
  group.add(crater);

  // Krater üstünde parlak ışık halesi
  const glowTex = (() => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const g = cv.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 2, 32, 32, 31);
    gr.addColorStop(0, 'rgba(255,190,90,0.95)');
    gr.addColorStop(0.35, 'rgba(255,100,30,0.45)');
    gr.addColorStop(1, 'rgba(255,60,0,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(cv);
  })();
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0.8 }));
  glow.position.y = height * 1.03;
  glow.scale.setScalar(radius * 1.5);
  group.add(glow);

  group.userData = { glow, crater: new THREE.Vector3(x, y + height * 0.95, z), radius };
  return group;
}

// Periyodik patlama: kor fışkırır, koyu kül bulutu yükselir; aralarda kraterden ince duman
export function createVolcanoShow({ fx, def, quality }) {
  const v = def.volcano;
  const rate = quality?.particles ?? 1;
  const top = new THREE.Vector3(v.x, (v.y ?? -1.5) + v.height * 0.97, v.z);
  const EMBER = new THREE.Color(3.0, 1.2, 0.3);
  const ASH = new THREE.Color(0.2, 0.18, 0.18);
  const period = v.period ?? 12;
  const erupt = 3;
  const p = new THREE.Vector3();
  const vel = new THREE.Vector3();
  let acc = 0;
  let smokeAcc = 0;
  return {
    erupting: (t) => (Math.max(0, t) + 4) % period > period - erupt,
    update(t, dt, glow) {
      const c = (Math.max(0, t) + 4) % period;
      const active = c > period - erupt;
      const u = active ? (c - (period - erupt)) / erupt : 0;
      if (glow) glow.material.opacity = 0.6 + 0.25 * Math.sin(t * 1.3) + (active ? 0.4 * Math.sin(u * Math.PI) : 0);
      // İnce sürekli duman
      smokeAcc += dt * (active ? 26 : 5) * rate;
      while (smokeAcc >= 1) {
        smokeAcc -= 1;
        p.set(top.x + (Math.random() - 0.5) * v.radius * 0.25, top.y, top.z + (Math.random() - 0.5) * v.radius * 0.25);
        vel.set((Math.random() - 0.5) * 3 + 2, 7 + Math.random() * 5, (Math.random() - 0.5) * 3);
        fx.emitSmoke(p, vel, { life: 6 + Math.random() * 3, size: 6, sizeEnd: 34, color: ASH, alpha: active ? 0.75 : 0.5 });
      }
      if (!active) return;
      acc += dt * 60 * rate * Math.sin(u * Math.PI);
      while (acc >= 1) {
        acc -= 1;
        p.set(top.x + (Math.random() - 0.5) * 6, top.y, top.z + (Math.random() - 0.5) * 6);
        const a = Math.random() * Math.PI * 2;
        const sp = 6 + Math.random() * 18;
        vel.set(Math.cos(a) * sp, 28 + Math.random() * 34, Math.sin(a) * sp);
        fx.emitSpark(p, vel, { life: 2.2 + Math.random() * 1.2, size: 1.8, sizeEnd: 0.3, color: EMBER });
      }
    },
  };
}
