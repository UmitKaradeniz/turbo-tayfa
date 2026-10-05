import * as THREE from 'three';

// Kısayol: ana yoldan ayrılıp yine ana yola dönen ek bir yol. Kendi orta çizgisi,
// yüzey tipi (kum / toprak), isteğe bağlı rampa + çukur (atlama) ve hız tahtaları vardır.
// Pist tanımındaki `shortcuts` listesinden üretilir (bkz. src/tracks/*.js).

const UP = new THREE.Vector3(0, 1, 0);
const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// sd.follow: ana yolun bir bölümünü yandan, hemen yanında izleyen yol üretir (süpriz yolları).
// Yol ana yoldan çıkarken ve girerken çok uzun, yumuşak bir S çizer (geçiş boyu ≥ ~60 m, dönüş yarıçapı ≥ ~40 m);
// dalgalanma yok, yol hep ana yolun yanında kalır (diğer yarışçılar görünür).
// follow = { from, to (turun oranı), side (+1 sağ / -1 sol), lateral (m), tol }
const smoother = (t) => {
  t = Math.min(1, Math.max(0, t));
  return t * t * t * (t * (t * 6 - 15) + 10);
};

// Üç ardışık noktadan geçen çemberin yarıçapı (m); doğruya yakınsa Infinity
function minRadius(pts) {
  const v = pts.map(([x, z]) => new THREE.Vector3(x, 0, z));
  const curve = new THREE.CatmullRomCurve3(v, false, 'centripetal');
  const q = curve.getSpacedPoints(Math.max(8, Math.round(curve.getLength() / 6)));
  let min = Infinity;
  // Uçlar ana yolun üstünde (oranın eğriliği zaten ana yolun): yalnızca aradaki %76'ya bakılır
  const skip = Math.ceil(q.length * 0.12);
  for (let i = Math.max(1, skip); i < q.length - 1 - skip; i++) {
    const a = q[i - 1];
    const b = q[i];
    const c = q[i + 1];
    const cross = Math.abs((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x));
    if (cross < 1e-6) continue;
    min = Math.min(min, (a.distanceTo(b) * b.distanceTo(c) * a.distanceTo(c)) / (2 * cross));
  }
  return { min, length: curve.getLength() };
}

export function followPoints(follow, { points, rights, count }) {
  const { from, to, side = 1, lateral = 28 } = follow;
  const i0 = Math.round(from * count);
  const n = (Math.round(to * count) - i0 + count) % count;
  const step = 3;
  const M = Math.max(6, Math.round(n / step));
  let target = 0;
  for (let k = 1; k <= n; k++) target += points[(i0 + k) % count].distanceTo(points[(i0 + k - 1) % count]);
  const w = Math.min(95, target * 0.42) / target; // geçiş payı (bölümün oranı)
  const env = (u) => smoother(u / w) * smoother((1 - u) / w);
  const build = (L) => {
    const out = [];
    for (let m = 0; m <= M; m++) {
      const u = m / M;
      const idx = (i0 + Math.round(u * n)) % count;
      const lat = side * L * env(u);
      out.push([points[idx].x + rights[idx].x * lat, points[idx].z + rights[idx].z * lat]);
    }
    return out;
  };
  const pts = build(lateral);
  // Kıvrımlı ana yollarda ofset yol da kıvrımlanır: uçlar sabit, aradaki noktalar komşu ortalamasına çekilerek yumuşatılır
  for (let it = 0; it < (follow.smooth ?? 30); it++) {
    for (let m = 2; m < pts.length - 2; m++) {
      pts[m] = [pts[m][0] * 0.5 + (pts[m - 1][0] + pts[m + 1][0]) * 0.25, pts[m][1] * 0.5 + (pts[m - 1][1] + pts[m + 1][1]) * 0.25];
    }
  }
  const { min, length } = minRadius(pts);
  pts.follow = { len: length, target, L: lateral, minR: min };
  return pts;
}

export function buildShortcut(sd, id, { closest, edge, count, points, rights }) {
  if (sd.follow && !sd.points) {
    const pts = followPoints(sd.follow, { points, rights, count });
    // Ana yoldan kısaysa hız çarpanı süreyi eşitler (yalnız yavaş yüzeylerde etkili: kum/toprak/çamur)
    sd = { ...sd, points: pts, followInfo: pts.follow, speed: sd.speed ?? Math.min(1, Math.max(0.8, pts.follow.len / pts.follow.target)) };
  }
  const halfWidth = sd.halfWidth ?? 4.5;
  const blend = sd.blend ?? 9;
  const surface = sd.surface ?? 'sand';
  const pathColor = new THREE.Color(sd.color ?? 0xd3aa6c);
  const flare = sd.flare ?? 10; // giriş/çıkışta huni: ağız geniş, içerisi dar
  const flareLen = sd.flareLen ?? 42;

  // --- Orta çizgi örnekleri (yaklaşık 1.5 m aralıkla) ---
  const curve = new THREE.CatmullRomCurve3(sd.points.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
  const N = Math.max(8, Math.round(curve.getLength() / 1.5));
  const pts = curve.getSpacedPoints(N);
  const px = new Float64Array(N + 1);
  const pz = new Float64Array(N + 1);
  const cum = new Float64Array(N + 1);
  for (let i = 0; i <= N; i++) {
    px[i] = pts[i].x;
    pz[i] = pts[i].z;
    if (i) cum[i] = cum[i - 1] + Math.hypot(px[i] - px[i - 1], pz[i] - pz[i - 1]);
  }
  const length = cum[N];
  const tanX = new Float64Array(N + 1);
  const tanZ = new Float64Array(N + 1);
  for (let i = 0; i <= N; i++) {
    const a = Math.max(0, i - 1);
    const b = Math.min(N, i + 1);
    const l = Math.hypot(px[b] - px[a], pz[b] - pz[a]) || 1;
    tanX[i] = (px[b] - px[a]) / l;
    tanZ[i] = (pz[b] - pz[a]) / l;
  }

  // Yatak yüksekliği: uçlar ana yola oturur, arası doğrusal
  const c0 = closest(px[0], pz[0]);
  const c1 = closest(px[N], pz[N]);
  const bedY = (s) => THREE.MathUtils.lerp(c0.y, c1.y, s / length) - 0.1;

  // Ana yol koridorunun dışında kalan aralık [sA, sB]; ilerleme bu aralıkta sanal ilerler
  let iA = -1;
  let iB = -1;
  for (let i = 0; i <= N; i++) {
    if (closest(px[i], pz[i]).dist >= edge) {
      if (iA < 0) iA = i;
      iB = i;
    }
  }
  const cA = closest(px[iA], pz[iA]);
  const cB = closest(px[iB], pz[iB]);
  const aIdx = cA.index + cA.t;
  let bIdx = cB.index + cB.t;
  if (bIdx < aIdx - count / 2) bIdx += count;
  if (bIdx > aIdx + count / 2) bIdx -= count;
  const sA = cum[iA];
  const sB = cum[iB];

  // Kutu, sınır ve arama için sınırlayıcı kutu
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i <= N; i++) {
    minX = Math.min(minX, px[i]);
    maxX = Math.max(maxX, px[i]);
    minZ = Math.min(minZ, pz[i]);
    maxZ = Math.max(maxZ, pz[i]);
  }
  const pad = halfWidth + flare + Math.max(blend, 30);
  minX -= pad;
  maxX += pad;
  minZ -= pad;
  maxZ += pad;

  const halfAt = (s) => halfWidth + flare * (1 - smoothstep(0, flareLen, Math.min(s, length - s)));

  const hit = { d: 0, s: 0, px: 0, pz: 0, tx: 0, tz: 1 };
  function nearest(x, z) {
    if (x < minX || x > maxX || z < minZ || z > maxZ) return null;
    let best = Infinity;
    let bi = 0;
    let bt = 0;
    for (let i = 0; i < N; i++) {
      const dx = px[i + 1] - px[i];
      const dz = pz[i + 1] - pz[i];
      const rx = x - px[i];
      const rz = z - pz[i];
      let t = (rx * dx + rz * dz) / (dx * dx + dz * dz);
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const ex = rx - dx * t;
      const ez = rz - dz * t;
      const d = ex * ex + ez * ez;
      if (d < best) {
        best = d;
        bi = i;
        bt = t;
      }
    }
    hit.d = Math.sqrt(best);
    hit.s = cum[bi] + (cum[bi + 1] - cum[bi]) * bt;
    hit.px = px[bi] + (px[bi + 1] - px[bi]) * bt;
    hit.pz = pz[bi] + (pz[bi + 1] - pz[bi]) * bt;
    hit.tx = tanX[bi];
    hit.tz = tanZ[bi];
    return hit;
  }

  // --- Atlama: rampa → çukur → alçak iniş alanı ---
  let jump = null;
  let jumpDef = sd.jump;
  if (jumpDef) {
    const n = nearest(jumpDef.at[0], jumpDef.at[1]);
    const rampA = n.s;
    const rampB = rampA + jumpDef.ramp;
    const pitB = rampB + jumpDef.gap;
    const landB = pitB + jumpDef.landing;
    jump = {
      rampA, rampB, pitA: rampB, pitB, landB,
      height: jumpDef.height, depth: jumpDef.depth, drop: jumpDef.drop ?? 0.6,
      rampColor: new THREE.Color(jumpDef.rampColor ?? 0xb5773f),
    };
  }
  const extra = (s) => {
    if (!jump || s < jump.rampA || s > jump.landB) return 0;
    if (s <= jump.rampB) return (jump.height * (s - jump.rampA)) / (jump.rampB - jump.rampA);
    if (s <= jump.pitB) return -jump.depth;
    const u = (s - jump.pitB) / (jump.landB - jump.pitB);
    return -jump.drop * (1 - smoothstep(0.4, 1, u));
  };

  const pads = (sd.pads ?? []).map((p) => ({
    s: p.f * length,
    length: p.length ?? 6,
    width: p.width ?? 4.4,
    halfWidth: (p.width ?? 4.4) / 2,
    boost: p.boost ?? 0.75,
  }));

  const sc = {
    id: sd.id ?? `sc${id}`,
    def: sd,
    halfWidth,
    halfAt,
    surface,
    length,
    sA,
    sB,
    // Kısayolun ana yoldan çıktığı / döndüğü taraf (-1 sol, +1 sağ): bariyer boşluğu yalnız bu tarafta açılır
    sideA: Math.sign(cA.lateral) || 1,
    sideB: Math.sign(cB.lateral) || 1,
    jump,
    pads,
    terrain: null,
    nearest,
    bedY,
    // Ana yoldaki giriş / çıkış örnekleri (bot ve dekor için)
    entryIndex: Math.round(aIdx) % count,
    exitIndex: ((Math.round(bIdx) % count) + count) % count,

    // Yarış ilerlemesi için sanal örnek: girişten çıkışa düzgünce ilerler
    virtualIndex(s) {
      const u = Math.min(1, Math.max(0, (s - sA) / (sB - sA)));
      const v = aIdx + (bIdx - aIdx) * u;
      return ((Math.round(v) % count) + count) % count;
    },

    // Yol boyunca s metredeki nokta (+ sağa yanal ofset)
    pointAt(s, lateral = 0) {
      s = Math.min(length, Math.max(0, s));
      let lo = 0;
      let hi = N;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (cum[mid] <= s) lo = mid;
        else hi = mid;
      }
      const t = (s - cum[lo]) / (cum[hi] - cum[lo] || 1);
      const x0 = px[lo] + (px[hi] - px[lo]) * t;
      const z0 = pz[lo] + (pz[hi] - pz[lo]) * t;
      const tx = tanX[lo] + (tanX[hi] - tanX[lo]) * t;
      const tz = tanZ[lo] + (tanZ[hi] - tanZ[lo]) * t;
      const l = Math.hypot(tx, tz) || 1;
      const fx = tx / l;
      const fz = tz / l;
      // sağ = f x UP (ana yolla aynı yön)
      const rx = -fz;
      const rz = fx;
      const x = x0 + rx * lateral;
      const z = z0 + rz * lateral;
      return { x, z, y: sc.terrain ? sc.terrain.heightAt(x, z) : bedY(s), fx, fz, rx, rz, yaw: Math.atan2(fx, fz), s };
    },

    // Arazi üretimi için: (x,z) noktasında yatak yüksekliği, ağırlık ve renk
    sample(x, z) {
      const n = nearest(x, z);
      if (!n) return null;
      const hw = halfAt(n.s);
      if (n.d > hw + blend) return null;
      const w = 1 - smoothstep(hw + 1, hw + blend, n.d);
      const win = 1 - smoothstep(hw - 0.5, hw + 2.5, n.d);
      const bed = bedY(n.s) + extra(n.s) * win;
      const path = 1 - smoothstep(hw - 1.2, hw + 1, n.d);
      const onRamp = jump && n.s >= jump.rampA - 1 && n.s <= jump.rampB + 1;
      return { w, bed, path, tint: onRamp ? jump.rampColor : pathColor };
    },

    // Hız tahtaları ve çukurdaki dere gibi ek görseller
    buildMeshes(terrain) {
      const out = [];
      const q = new THREE.Quaternion();
      const yaw = new THREE.Quaternion();
      const nrm = new THREE.Vector3();
      if (pads.length) {
        const tex = padTexture();
        const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
        for (const p of pads) {
          const c = sc.pointAt(p.s);
          const geo = new THREE.PlaneGeometry(p.width, p.length).rotateX(-Math.PI / 2);
          const m = new THREE.Mesh(geo, mat);
          terrain.normalAt(c.x, c.z, nrm);
          q.setFromUnitVectors(UP, nrm);
          yaw.setFromAxisAngle(UP, Math.atan2(-c.fx, -c.fz));
          m.quaternion.copy(q).multiply(yaw);
          m.position.set(c.x, terrain.heightAt(c.x, c.z) + 0.08, c.z);
          out.push(m);
        }
      }
      if (jump && jumpDef.water !== false) {
        const mid = sc.pointAt((jump.pitA + jump.pitB) / 2);
        const geo = new THREE.PlaneGeometry(2 * halfWidth + 3, jump.pitB - jump.pitA + 2).rotateX(-Math.PI / 2);
        const water = new THREE.Mesh(
          geo,
          jumpDef.lava
            ? new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 0.9, 0.2), toneMapped: false })
            : new THREE.MeshStandardMaterial({ color: jumpDef.water ?? 0x3aa6d8, transparent: true, opacity: 0.88, roughness: 0.25, metalness: 0.1 }),
        );
        water.rotation.y = Math.atan2(-mid.fx, -mid.fz);
        water.position.set(mid.x, sc.bedY(mid.s) - jump.depth + 1.4, mid.z);
        water.receiveShadow = true;
        out.push(water);
      }
      return out;
    },
  };
  return sc;
}

// Sarı-mor oklu hız tahtası dokusu
function padTexture() {
  const w = 128;
  const h = 256;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(20,20,70,0.92)';
  g.beginPath();
  g.roundRect(4, 4, w - 8, h - 8, 18);
  g.fill();
  g.strokeStyle = '#ffd23f';
  g.lineWidth = 6;
  g.stroke();
  g.lineJoin = 'round';
  for (let k = 0; k < 3; k++) {
    const y = 60 + k * 62;
    g.fillStyle = k === 2 ? '#ffd23f' : k === 1 ? '#ffb02e' : '#ff8a1f';
    g.beginPath();
    g.moveTo(w / 2, y - 34);
    g.lineTo(w - 20, y + 4);
    g.lineTo(w - 44, y + 4);
    g.lineTo(w / 2, y - 14);
    g.lineTo(44, y + 4);
    g.lineTo(20, y + 4);
    g.closePath();
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}
