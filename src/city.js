import * as THREE from 'three';

// Gece şehri dekoru: yordamsal binalar (yanan pencereler), neon tabelalar ve sokak lambaları.
// Hiç model dosyası gerekmez; tüm dokular canvas ile üretilir.

const CELL = 32; // bir pencere dokusu karesi = 32 m (8×8 pencere, pencere başına 4 m)
const UP = new THREE.Vector3(0, 1, 0);

function windowTextures() {
  const size = 256;
  const make = (emissiveOnly) => {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    g.fillStyle = emissiveOnly ? '#000' : '#2b3048';
    g.fillRect(0, 0, size, size);
    let seed = 42; // iki doku aynı rastgele düzeni kullansın
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const r = rnd();
        const lit = r < 0.5;
        const cyan = r > 0.5 && r < 0.6;
        const col = lit ? '#ffd98a' : cyan ? '#8fe3ff' : null;
        if (emissiveOnly && !col) continue;
        g.fillStyle = emissiveOnly ? col : col ?? '#161a2b';
        g.fillRect(x * 32 + 7, y * 32 + 6, 18, 20);
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  };
  return { map: make(false), emissive: make(true) };
}

// Yan yüzleri pencere karesine, üst/alt yüzü düz cepheye eşleyen kutu
function buildingGeometry(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  // BoxGeometry yüz sırası: +x, -x, +y, -y, +z, -z (yüz başına 4 köşe)
  const scale = [[d, h], [d, h], null, null, [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      if (!scale[f]) uv.setXY(i, 0.02, 0.02);
      else uv.setXY(i, (uv.getX(i) * scale[f][0]) / CELL, (uv.getY(i) * scale[f][1]) / CELL);
    }
  }
  g.translate(0, h / 2, 0);
  return g;
}

const WORDS = [
  ['TURBO', '#ff3fa4'], ['KAHVE', '#ffd23f'], ['PİZZA', '#ff7a2f'], ['OTEL', '#3fe0ff'],
  ['DİSKO', '#b06bff'], ['24 SAAT', '#7dff6a'], ['BAR', '#ff3fa4'], ['TAYFA', '#3fe0ff'],
];

function neonTexture(word, color) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(8,10,24,0.85)';
  g.beginPath();
  g.roundRect(4, 4, 248, 88, 16);
  g.fill();
  g.strokeStyle = color;
  g.lineWidth = 5;
  g.shadowColor = color;
  g.shadowBlur = 14;
  g.stroke();
  g.font = "48px 'Lilita One', 'Arial Black', sans-serif";
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#fff';
  g.shadowBlur = 18;
  g.fillText(word, 128, 50);
  g.fillText(word, 128, 50);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function radialTexture(stops) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 1, 32, 32, 31);
  for (const [o, col] of stops) grad.addColorStop(o, col);
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// Binalar: yolun iki yanında sıralar halinde, yola paralel; uzaktakiler daha yüksek
export function buildBuildings(ctx, { max = 130, rowsDepth = [10, 36, 62], skip = () => false } = {}) {
  const { track, rng } = ctx;
  const terrain = track.terrain;
  const tex = windowTextures();
  const mat = new THREE.MeshStandardMaterial({ map: tex.map, emissive: 0xffffff, emissiveMap: tex.emissive, emissiveIntensity: 1.15, roughness: 0.85 });

  const sizes = [[12, 12], [16, 16], [20, 15], [14, 22]];
  const heights = [[18, 30], [30, 46], [44, 66]];
  const variants = new Map(); // "wi|hi" → { geo, list: [{ matrix, color }] }
  const placed = [];
  const tints = [0xb8c0e0, 0x9aa6d6, 0xc9b8e6, 0xa4c9d9, 0xe0c0b8, 0xffffff];
  const n = track.count;
  const total = Math.round(max * ctx.density);

  const consider = (i, side, row) => {
    const [w, d] = sizes[Math.floor(rng() * sizes.length)];
    const [h0, h1] = heights[row];
    const h = h0 + Math.round(rng() * (h1 - h0));
    const lateral = side * (track.edge + rowsDepth[row] + w / 2 + rng() * 5); // genişlik (w) yola dik
    const p = ctx.along(i, lateral);
    const half = Math.hypot(w, d) / 2;
    if (terrain.landAt(p.x, p.z) < 8) return;
    if (terrain.roadDistAt(p.x, p.z) < track.edge + half * 0.85) return;
    if (track.shortcutClearance(p.x, p.z) < half + 6) return;
    if (skip(p, i)) return;
    for (const q of placed) if ((q.x - p.x) ** 2 + (q.z - p.z) ** 2 < (q.r + half + 2.5) ** 2) return;
    placed.push({ x: p.x, z: p.z, r: half });
    ctx.reserve(p.x, p.z, half + 3);
    const key = `${w}x${d}x${h}`;
    if (!variants.has(key)) variants.set(key, { geo: buildingGeometry(w, h, d), list: [] });
    // Yol yönüne paralel: modelin genişliği yolun yönünde
    const rotY = p.forwardY;
    const y = Math.min(terrain.heightAt(p.x, p.z), track.centerline[i % n].y) - 0.4;
    variants.get(key).list.push({ m: new THREE.Matrix4().compose(new THREE.Vector3(p.x, y, p.z), new THREE.Quaternion().setFromAxisAngle(UP, rotY), new THREE.Vector3(1, 1, 1)), c: new THREE.Color(tints[Math.floor(rng() * tints.length)]) });
    return { p, w, d, h, side, rotY };
  };

  const rows = [];
  for (let row = 0; row < rowsDepth.length; row++) {
    for (let i = 0; i < n; i += 4) {
      for (const side of [-1, 1]) {
        if (placed.length >= total) break;
        const r = consider((i + row * 2) % n, side, row);
        if (r && row === 0) rows.push(r);
      }
    }
  }

  const group = new THREE.Group();
  for (const { geo, list } of variants.values()) {
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((b, k) => {
      im.setMatrixAt(k, b.m);
      im.setColorAt(k, b.c);
    });
    im.castShadow = true;
    im.receiveShadow = true;
    im.computeBoundingSphere();
    group.add(im);
  }
  ctx.addObject(group);

  // Neon tabelalar: ön sıradaki bazı binaların yola bakan yüzünde
  const signGeo = new THREE.PlaneGeometry(11, 4.1);
  const step = Math.max(1, Math.floor(rows.length / 14));
  rows.forEach((b, k) => {
    if (k % step) return;
    const [word, color] = WORDS[(k / step) % WORDS.length | 0];
    const mesh = new THREE.Mesh(signGeo, new THREE.MeshBasicMaterial({ map: neonTexture(word, color), transparent: true, toneMapped: false, color: new THREE.Color(1.4, 1.4, 1.4) }));
    // yola bakan yön: modelin yerel +X ekseni pistin solu; bina sağdaysa (side=1) yol onun +X yanındadır
    const dir = new THREE.Vector3(Math.cos(b.rotY), 0, -Math.sin(b.rotY)).multiplyScalar(b.side);
    const faceOffset = b.w / 2 + 0.25;
    mesh.position.set(b.p.x + dir.x * faceOffset, terrainY(terrain, b.p, track) + 9 + (k % 3) * 2.5, b.p.z + dir.z * faceOffset);
    mesh.rotation.y = Math.atan2(dir.x, dir.z);
    ctx.addObject(mesh);
  });
  return placed.length;
}

const terrainY = (terrain, p, track) => terrain.heightAt(p.x, p.z);

// Sokak lambaları: direk + parlak başlık + ışık halkası (yola sürülen yumuşak ışık lekesi)
export function buildStreetLamps(ctx, { every = 8, skip = () => false } = {}) {
  const { track } = ctx;
  const hw = track.def.halfWidth;
  const n = track.count;
  const poles = [];
  const heads = [];
  const pools = [];
  for (let i = 0; i < n; i += every) {
    const side = (i / every) % 2 ? 1 : -1;
    const base = ctx.along(i, side * (hw + track.def.curbWidth + 2.2));
    if (track.shortcutClearance(base.x, base.z) < 3 || skip(i)) continue;
    const y = track.centerline[i].y;
    const head = ctx.along(i, side * (hw + track.def.curbWidth + 0.6));
    poles.push(new THREE.Matrix4().makeTranslation(base.x, y, base.z));
    heads.push(new THREE.Vector3(head.x, y + 7.6, head.z));
    const pool = ctx.along(i, side * hw * 0.3);
    pools.push(new THREE.Matrix4().makeTranslation(pool.x, y + 0.045, pool.z));
  }

  const group = new THREE.Group();
  const poleMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.14, 0.2, 7.6, 6).translate(0, 3.8, 0), new THREE.MeshStandardMaterial({ color: 0x2a2f3d, roughness: 0.6, metalness: 0.4 }), poles.length);
  poles.forEach((m, k) => poleMesh.setMatrixAt(k, m));
  poleMesh.castShadow = true;
  group.add(poleMesh);

  const headMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.5, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.1, 1.5), toneMapped: false }), heads.length);
  heads.forEach((v, k) => headMesh.setMatrixAt(k, new THREE.Matrix4().makeTranslation(v.x, v.y, v.z)));
  group.add(headMesh);

  // Başlıkların etrafında parıltı (tek Points nesnesi)
  const glowGeo = new THREE.BufferGeometry().setFromPoints(heads);
  const glow = new THREE.Points(glowGeo, new THREE.PointsMaterial({ map: radialTexture([[0, 'rgba(255,230,170,0.95)'], [0.3, 'rgba(255,210,130,0.45)'], [1, 'rgba(255,190,90,0)']]), size: 7, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: true }));
  glow.frustumCulled = false;
  group.add(glow);

  // Yerdeki ışık lekeleri
  const poolGeo = new THREE.PlaneGeometry(17, 17).rotateX(-Math.PI / 2);
  const poolMat = new THREE.MeshBasicMaterial({ map: radialTexture([[0, 'rgba(255,214,140,0.5)'], [0.5, 'rgba(255,190,110,0.18)'], [1, 'rgba(255,180,90,0)']]), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -3 });
  const poolMesh = new THREE.InstancedMesh(poolGeo, poolMat, pools.length);
  pools.forEach((m, k) => poolMesh.setMatrixAt(k, m));
  poolMesh.frustumCulled = false;
  group.add(poolMesh);

  ctx.addObject(group);
  return poles.length;
}
