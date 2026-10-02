import * as THREE from 'three';
import { normalizedModel } from './assets.js';

// Gece şehri dekoru: Kenney City Kit binaları (gece pencereleri ışıldar), neon tabelalar ve sokak lambaları.

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
  g.font = "700 48px 'Fredoka', 'Arial Black', sans-serif";
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
    const y = base.y;
    const head = ctx.along(i, side * (hw + track.def.curbWidth + 0.6));
    poles.push(new THREE.Matrix4().makeTranslation(base.x, y, base.z));
    heads.push(new THREE.Vector3(head.x, y + 7.6, head.z));
    const pool = ctx.along(i, side * hw * 0.3);
    pools.push(new THREE.Matrix4().makeTranslation(pool.x, pool.y + 0.045, pool.z));
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

// --- Kenney City Kit (Commercial) modelleriyle şehir ---
const abc = 'abcdefghijklmn'.split('');
export const CITY_NEAR = abc.map((c) => `city/building-${c}`);
export const CITY_TALL = 'abcde'.split('').map((c) => `city/building-skyscraper-${c}`);
export const CITY_FAR = [...abc.map((c) => `city/low-detail-building-${c}`), 'city/low-detail-building-wide-a', 'city/low-detail-building-wide-b'];
export const CITY_MODELS = [...CITY_NEAR, ...CITY_TALL, ...CITY_FAR];

const sizeCache = new Map();
const sizeOf = (key) => {
  if (!sizeCache.has(key)) sizeCache.set(key, normalizedModel(key).userData.size.clone());
  return sizeCache.get(key);
};

// Binalar yolun iki yanında üç sıra: yakın orta boy, ortada gökdelenler karışık, arkada silüet.
// Ön yüz (+Z) yola bakar. Gece için pencereler ışıldar (ctx.glow).
export function buildModelBuildings(ctx, { max = 130, skip = () => false } = {}) {
  const { track, rng } = ctx;
  const terrain = track.terrain;
  ctx.glow(2.2, ...CITY_MODELS);
  const rows = [
    { depth: 9, pools: [CITY_NEAR], scale: [11, 13.5] },
    { depth: 34, pools: [CITY_NEAR, CITY_TALL], scale: [12, 15] },
    { depth: 62, pools: [CITY_TALL, CITY_FAR, CITY_FAR], scale: [15, 20] },
  ];
  const placed = [];
  const fronts = [];
  const total = Math.round(max * ctx.density);
  const n = track.count;

  const consider = (i, side, row) => {
    const R = rows[row];
    const pool = R.pools[Math.floor(rng() * R.pools.length)];
    const key = pool[Math.floor(rng() * pool.length)];
    const sz = sizeOf(key);
    const far = pool === CITY_FAR;
    const s = R.scale[0] + rng() * (R.scale[1] - R.scale[0]) * (far ? 1.25 : 1);
    const w = sz.x * s;
    const d = sz.z * s;
    const p = ctx.along(i, side * (track.edge + R.depth + d / 2 + rng() * 4));
    const half = Math.hypot(w, d) / 2;
    if (terrain.landAt(p.x, p.z) < 8) return;
    if (terrain.roadDistAt(p.x, p.z) < track.edge + half * 0.85) return;
    if (track.shortcutClearance(p.x, p.z) < half + 6) return;
    if (skip(p, i)) return;
    for (const q of placed) if ((q.x - p.x) ** 2 + (q.z - p.z) ** 2 < (q.r + half + 2.5) ** 2) return;
    placed.push({ x: p.x, z: p.z, r: half });
    ctx.reserve(p.x, p.z, half + 3);
    const y = Math.min(terrain.heightAt(p.x, p.z), track.centerline[i % n].y) - 0.3;
    ctx.place(key, p.x, p.z, p.faceTrackY, s, y);
    if (row === 0) fronts.push({ x: p.x, z: p.z, y, w, d, h: sz.y * s, ry: p.faceTrackY });
  };

  for (let row = 0; row < rows.length; row++) {
    for (let i = 0; i < n; i += 3) {
      for (const side of [-1, 1]) {
        if (placed.length >= total) break;
        consider((i + row * 2) % n, side, row);
      }
    }
  }

  // Neon tabelalar: ön sıradaki bazı binaların yola bakan yüzünde
  const signGeo = new THREE.PlaneGeometry(9, 3.4);
  const step = Math.max(1, Math.floor(fronts.length / 14));
  fronts.forEach((b, k) => {
    if (k % step) return;
    const [word, color] = WORDS[((k / step) | 0) % WORDS.length];
    const mesh = new THREE.Mesh(signGeo, new THREE.MeshBasicMaterial({ map: neonTexture(word, color), transparent: true, toneMapped: false, color: new THREE.Color(1.4, 1.4, 1.4) }));
    const dx = Math.sin(b.ry);
    const dz = Math.cos(b.ry);
    const off = b.d / 2 + 0.5;
    mesh.position.set(b.x + dx * off, b.y + Math.min(b.h * 0.55, 8) + (k % 3) * 1.2, b.z + dz * off);
    mesh.rotation.y = b.ry;
    ctx.addObject(mesh);
  });
  return placed.length;
}
