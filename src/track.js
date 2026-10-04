import * as THREE from 'three';
import { buildShortcut } from './shortcut.js';

// Kapalı bir orta çizgiden (centerline) pist üretir: yol, bordür, başlangıç
// işaretleri, ada zemini, sınırlar, zemin sorgusu ve grid pozisyonları.
// Pist tanımı (src/tracks/*.js) sadece kontrol noktaları ve birkaç ölçü verir.

const UP = new THREE.Vector3(0, 1, 0);
const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Tümsek/çukur dizisi: def.bumps = [{ f: [başlangıç, bitiş] (turun oranı), amp (m), period (m) }]
function applyBumps(points, def, segLen) {
  const count = points.length;
  for (const b of def.bumps ?? []) {
    const i0 = Math.round(b.f[0] * count);
    const i1 = Math.round(b.f[1] * count);
    const ramp = Math.max(4, Math.round((b.period / segLen) * 0.75));
    for (let i = i0; i <= i1; i++) {
      const env = smoothstep(i0, i0 + ramp, i) * smoothstep(i1, i1 - ramp, i);
      points[((i % count) + count) % count].y += b.amp * Math.sin((2 * Math.PI * (i - i0) * segLen) / b.period) * env;
    }
  }
}

// Sadece orta çizgi (menüdeki pist küçük resmi için; zemin üretmez)
export function trackOutline(def) {
  const curve = new THREE.CatmullRomCurve3(def.control.map(([x, z, y]) => new THREE.Vector3(x, y, z)), true, 'centripetal');
  const count = Math.round(curve.getLength() / 2.5);
  const centerline = curve.getSpacedPoints(count).slice(0, count);
  applyBumps(centerline, def, curve.getLength() / count);
  const rights = centerline.map((p, i) => {
    const f = centerline[(i + 1) % count].clone().sub(centerline[(i - 1 + count) % count]).setY(0).normalize();
    return f.cross(UP).normalize();
  });
  return { centerline, rights, length: curve.getLength() };
}

export function buildTrack(def, detail = {}) {
  const hw = def.halfWidth;
  const curb = def.curbWidth;
  const edge = hw + curb + def.shoulder; // bariyerin iç yüzü

  // --- Orta çizgi örnekleri ---
  const curve = new THREE.CatmullRomCurve3(
    def.control.map(([x, z, y]) => new THREE.Vector3(x, y, z)),
    true,
    'centripetal',
  );
  const length = curve.getLength();
  const count = Math.round(length / 2.5);
  const segLen = length / count;
  const points = curve.getSpacedPoints(count).slice(0, count);
  applyBumps(points, def, segLen);
  const forwards = [];
  const rights = [];
  for (let i = 0; i < count; i++) {
    const f = points[(i + 1) % count].clone().sub(points[(i - 1 + count) % count]).normalize();
    forwards.push(f);
    rights.push(new THREE.Vector3(f.x, 0, f.z).normalize().cross(UP).normalize());
  }
  const at = (i) => ((i % count) + count) % count;

  // Her örnekte dönüşün iç tarafı ve yarıçapı (iç bariyer katlanmasın diye)
  const innerSide = [];
  const turnRadius = [];
  for (let i = 0; i < count; i++) {
    const a = forwards[at(i - 3)];
    const b = forwards[at(i + 3)];
    const cross = a.x * b.z - a.z * b.x;
    const angle = Math.acos(Math.min(1, (a.x * b.x + a.z * b.z) / Math.hypot(a.x, a.z) / Math.hypot(b.x, b.z)));
    turnRadius.push(angle < 1e-4 ? Infinity : (6 * segLen) / angle);
    innerSide.push(cross < 0 ? -1 : 1); // sol dönüşte iç taraf = -sağ
  }

  // --- Yatık virajlar: def.bank = [{ f: [başlangıç, bitiş] (turun oranı), deg }] ---
  // rolls[i] = yanal eğim (yükselme / yanal mesafe, + sağ kenar yüksek). Viraj iç kenarı alçalır.
  const rolls = new Float32Array(count);
  for (const b of def.bank ?? []) {
    const i0 = Math.round(b.f[0] * count);
    const i1 = Math.round(b.f[1] * count);
    let side = 0;
    for (let i = i0; i <= i1; i++) side += innerSide[at(i)];
    const ramp = Math.max(6, Math.round((i1 - i0) * 0.3));
    const tanA = Math.tan((b.deg * Math.PI) / 180) * (side >= 0 ? -1 : 1);
    for (let i = i0; i <= i1; i++) rolls[at(i)] += tanA * smoothstep(i0, i0 + ramp, i) * smoothstep(i1, i1 - ramp, i);
  }

  // --- En yakın orta çizgi noktası (hint verilirse sadece çevresine bakar) ---
  // Segment verileri düz dizilerde: zemin üretiminde on binlerce kez çağrılıyor
  const segAx = new Float64Array(count);
  const segAz = new Float64Array(count);
  const segDx = new Float64Array(count);
  const segDz = new Float64Array(count);
  const segInv = new Float64Array(count);
  for (let i = 0; i < count; i++) {
    const a = points[i];
    const b = points[at(i + 1)];
    segAx[i] = a.x;
    segAz[i] = a.z;
    segDx[i] = b.x - a.x;
    segDz[i] = b.z - a.z;
    segInv[i] = 1 / (segDx[i] * segDx[i] + segDz[i] * segDz[i]);
  }
  function closest(x, z, hint = -1) {
    let best = Infinity;
    let bi = 0;
    let bt = 0;
    const from = hint >= 0 ? hint - 12 : 0;
    const to = hint >= 0 ? hint + 12 : count - 1;
    for (let k = from; k <= to; k++) {
      const i = k < 0 ? k + count : k >= count ? k - count : k;
      const dx = segDx[i];
      const dz = segDz[i];
      const rx = x - segAx[i];
      const rz = z - segAz[i];
      let t = (rx * dx + rz * dz) * segInv[i];
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
    if (hint >= 0 && best > 900) return closest(x, z, -1); // ipucu penceresi pistten uzakta (kısayol): her yere bak
    const a = points[bi];
    const b = points[bi + 1 < count ? bi + 1 : 0];
    const px = segAx[bi] + segDx[bi] * bt;
    const pz = segAz[bi] + segDz[bi] * bt;
    const r = rights[bi];
    return {
      index: bi,
      t: bt,
      x: px,
      z: pz,
      y: a.y + (b.y - a.y) * bt,
      roll: rolls[bi] + (rolls[bi + 1 < count ? bi + 1 : 0] - rolls[bi]) * bt,
      lateral: (x - px) * r.x + (z - pz) * r.z,
      dist: Math.sqrt(best),
    };
  }

  function insideLoop(x, z) {
    let inside = false;
    for (let i = 0, j = count - 1; i < count; j = i++) {
      const a = points[i];
      const b = points[j];
      if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
    }
    return inside;
  }

  // Kısayol giriş/çıkışında yatık viraj yok (bağlantı düzgün kalsın)
  for (const sd of def.shortcuts ?? []) {
    for (const p of [sd.points[0], sd.points[sd.points.length - 1]]) {
      const ci = closest(p[0], p[1]).index;
      for (let k = -14; k <= 14; k++) rolls[at(ci + k)] *= smoothstep(4, 14, Math.abs(k));
    }
  }

  const group = new THREE.Group();

  // --- Yol ---
  const road = new THREE.Mesh(
    ribbon(points, rights, count, [
      [-hw, 0],
      [hw, 0],
    ], segLen / 16, null, true, rolls),
    new THREE.MeshStandardMaterial({ map: asphaltTexture(def.roadStyle), roughness: 0.92, ...(detail.detailRoad && def.roadTex ? { normalMap: tileTexture(def.roadTex, [(2 * hw) / 3, 16 / 3]), normalScale: new THREE.Vector2(0.6, 0.6) } : {}) }),
  );
  road.receiveShadow = true;
  group.add(road);

  // --- Bordürler (yoldan hafif yüksek, dışa doğru kuma iner) ---
  const curbMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, flatShading: true });
  const curbColors = def.roadStyle?.curbs ?? [0xffffff, 0xe23b36];
  const stripe = (i) => (i % 2 ? curbColors[0] : curbColors[1]);
  for (const side of [-1, 1]) {
    const profile = side < 0
      ? [[-hw - curb, -0.12], [-hw - curb * 0.35, 0.07], [-hw, 0.07]]
      : [[hw, 0.07], [hw + curb * 0.35, 0.07], [hw + curb, -0.12]];
    const mesh = new THREE.Mesh(ribbon(points, rights, count, profile, 0, stripe, true, rolls), curbMat);
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  // --- Başlangıç çizgisi ve grid işaretleri (yol üstüne çıkartma) ---
  const decalLen = 70; // metre, başlangıç çizgisinin arkasına doğru
  const decalSegs = Math.round(decalLen / segLen);
  const decalPoints = [];
  const decalRights = [];
  const decalRolls = [];
  for (let k = decalSegs; k >= 0; k--) {
    decalPoints.push(points[at(-k + 2)].clone().add(new THREE.Vector3(0, 0.015, 0)));
    decalRights.push(rights[at(-k + 2)]);
    decalRolls.push(rolls[at(-k + 2)]);
  }
  const decalLength = decalSegs * segLen;
  const gridSlotDist = (k) => 10 + Math.floor(k / 2) * 7 + (k % 2) * 3.5;
  const decal = new THREE.Mesh(
    ribbon(decalPoints, decalRights, decalPoints.length - 1, [[-hw, 0], [hw, 0]], 1 / (decalPoints.length - 1), null, false, decalRolls),
    new THREE.MeshStandardMaterial({
      map: startDecalTexture(hw, decalLength, 2 * segLen, gridSlotDist),
      transparent: true,
      roughness: 0.9,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    }),
  );
  decal.receiveShadow = true;
  group.add(decal);

  // --- Zemin bölgeleri: yolun bir kısmında farklı zemin (kızgın zemin, çamur, buz, su, bal, halı, hız şeridi, trambolin) ---
  // def.zones: [{ type, f: [başlangıç, bitiş] (turun oranı), lateral: [sol, sağ] (metre), speed?, grip?, color? }]
  // (eski def.hotZones: type 'hot' sayılır)
  const ZONE_TYPES = {
    hot: { surface: 'hot', speed: 0.72, bad: true },
    mud: { surface: 'mud', speed: 0.55, bad: true },
    water: { surface: 'water', speed: 0.68, bad: true },
    honey: { surface: 'honey', speed: 0.42, bad: true },
    carpet: { surface: 'carpet', speed: 0.78, bad: true },
    snow: { surface: 'snowdrift', speed: 0.62, bad: true },
    ice: { surface: 'ice', speed: 1, grip: 0.2, bad: true },
    wet: { surface: 'ice', speed: 1, grip: 0.45, bad: true },
    boardwalk: { surface: 'boardwalk', speed: 1, bad: false }, // ahşap iskele: yavaşlatmaz, tıkırtı sesi (audio.js)
    boost: { surface: 'road', pad: { boost: 0.9 }, bad: false },
    bounce: { surface: 'road', bounce: 11, bad: false },
    dune: { surface: 'road', bounce: 13.5, bad: false }, // kum tepesi rampası: fırlatır; def.airBoost pistlerinde uçuş sonrası turbo
  };
  const zones = [...(def.hotZones ?? []).map((z) => ({ type: 'hot', ...z })), ...(def.zones ?? [])].map((z) => ({
    type: z.type,
    ...ZONE_TYPES[z.type],
    from: Math.round(z.f[0] * count),
    to: Math.round(z.f[1] * count),
    l0: Math.min(...z.lateral),
    l1: Math.max(...z.lateral),
    ...(z.speed != null && { speed: z.speed }),
    ...(z.grip != null && { grip: z.grip }),
    color: z.color,
  }));
  const hotZones = zones.filter((z) => z.bad); // botların kaçındığı zeminler
  const zoneAt = (index, lateral) => {
    for (const z of zones) if (index >= z.from && index <= z.to && lateral >= z.l0 && lateral <= z.l1) return z;
    return null;
  };
  const zoneMeshes = zones.map((z) => {
    const pts = [];
    const rts = [];
    const rls = [];
    for (let i = z.from; i <= z.to; i++) {
      rls.push(rolls[at(i)]);
      pts.push(points[at(i)].clone().add(new THREE.Vector3(0, 0.03, 0)));
      rts.push(rights[at(i)]);
    }
    const glow = z.type === 'hot' || z.type === 'boost' || z.type === 'bounce';
    const tex = z.type === 'hot' ? crackTexture(z.l1 - z.l0, (z.to - z.from) * segLen) : zoneTexture(z, z.l1 - z.l0, (z.to - z.from) * segLen);
    const material = glow
      ? new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, color: z.type === 'hot' ? new THREE.Color(1.6, 1.3, 1.1) : new THREE.Color(1.4, 1.4, 1.4), toneMapped: false })
      : new THREE.MeshLambertMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 });
    const mesh = new THREE.Mesh(ribbon(pts, rts, pts.length - 1, [[z.l0, 0], [z.l1, 0]], 1 / (pts.length - 1), null, false, rls), material);
    mesh.receiveShadow = !glow;
    mesh.userData.type = z.type;
    group.add(mesh);
    return mesh;
  });
  const hotMeshes = zoneMeshes.filter((m) => m.userData.type === 'hot');

  // --- Kısayollar (orta çizgiden ayrılıp geri dönen ek yollar) ---
  const shortcuts = (def.shortcuts ?? []).map((sd, k) => buildShortcut(sd, k, { closest, edge, count }));

  // --- Ada zemini (yükseklik ızgarası) ---
  const terrain = buildTerrain(def, { closest, insideLoop, edge, count, shortcuts, detail: detail.detailGround ? def.groundTex : null });
  group.add(terrain.mesh);
  for (const sc of shortcuts) {
    sc.terrain = terrain;
    group.add(...sc.buildMeshes(terrain));
  }

  // --- Checkpointler (sayım Aşama 3'te) ---
  const checkpoints = [];
  const cpCount = 12;
  for (let k = 0; k < cpCount; k++) {
    const i = Math.floor((k / cpCount) * count);
    checkpoints.push({ index: i, position: points[i].clone(), forward: forwards[i].clone() });
  }

  const _n = new THREE.Vector3();
  const _tr = new THREE.Vector3();

  return {
    def,
    group,
    terrain,
    length,
    count,
    segLen,
    edge,
    centerline: points,
    forwards,
    rights,
    innerSide,
    rolls,
    turnRadius,
    checkpoints,
    closest,
    insideLoop,
    shortcuts,
    zones,
    hotZones,
    hotMeshes,

    // Kısayol koridoruna uzaklık - yarım genişlik (negatif: koridorun içinde). Dekor/bariyer için.
    shortcutClearance(x, z) {
      let best = Infinity;
      for (const sc of shortcuts) {
        const n = sc.nearest(x, z);
        if (n) best = Math.min(best, n.d - sc.halfAt(n.s));
      }
      return best;
    },

    // Kart bir atlama çukurunda mı? (kısayoldaki dere/uçurum: düşen kart geri alınır)
    inPit(pos) {
      for (const sc of shortcuts) {
        if (!sc.jump) continue;
        const n = sc.nearest(pos.x, pos.z);
        if (n && n.d <= sc.halfWidth + 2 && n.s > sc.jump.pitA + 1 && n.s < sc.jump.pitB - 1 && pos.y < sc.bedY(n.s) - 1.8) return sc;
      }
      return null;
    },

    // Grid pozisyonu k (0 = pol pozisyonu)
    gridSlot(k) {
      const back = gridSlotDist(k);
      const i = at(-Math.round(back / segLen));
      const lateral = (k % 2 ? 1 : -1) * hw * 0.42;
      const p = points[i].clone().addScaledVector(rights[i], lateral);
      return { position: p, heading: Math.atan2(forwards[i].x, forwards[i].z) };
    },

    // Zemin yüksekliği, normali ve yüzey tipi.
    // index: en yakın ana orta çizgi örneği (arama ipucu); pathIndex: yarış ilerlemesi için
    // örnek (kısayolda giriş ile çıkış arasında düzgünce ilerler, böylece ilerleme sıçramaz).
    groundAt(pos, hint = -1) {
      const c = closest(pos.x, pos.z, hint);
      const a = Math.abs(c.lateral);
      if (a <= hw + curb) {
        const f = forwards[c.index];
        const r = rights[c.index];
        if (c.roll) _n.crossVectors(_tr.set(r.x, c.roll, r.z), f).normalize();
        else _n.crossVectors(r, f).normalize();
        const base = c.y + c.lateral * c.roll;
        const y = a <= hw ? base : base + (a - hw < curb * 0.35 ? 0.07 : THREE.MathUtils.lerp(0.07, -0.12, (a - hw - curb * 0.35) / (curb * 0.65)));
        const hz = a <= hw && zones.length ? zoneAt(c.index, c.lateral) : null;
        // Su taşan yol (su seviyesi y=0): suyun içinden geçmek hızı %10 keser
        const flooded = !def.noWater && y < 0.1;
        return { y, normal: _n, surface: flooded && !hz ? 'water' : hz ? hz.surface : a <= hw ? 'road' : 'curb', index: c.index, pathIndex: c.index, shortcut: false, ramp: null, pad: hz?.pad ?? null, speed: hz ? hz.speed : flooded ? 0.9 : null, grip: hz?.grip ?? null, bounce: hz?.bounce ?? 0 };
      }
      const y = terrain.heightAt(pos.x, pos.z);
      terrain.normalAt(pos.x, pos.z, _n);
      const g = { y, normal: _n, surface: 'sand', index: c.index, pathIndex: c.index, shortcut: false, ramp: null, pad: null, speed: null };
      for (const sc of shortcuts) {
        const n = sc.nearest(pos.x, pos.z);
        if (!n || n.d > sc.halfAt(n.s) + 0.5) continue;
        g.surface = sc.surface;
        g.speed = sc.def.speed ?? null;
        if (n.s >= sc.sA && n.s <= sc.sB) {
          g.shortcut = true;
          g.pathIndex = sc.virtualIndex(n.s);
        }
        if (sc.jump && n.s >= sc.jump.rampA && n.s <= sc.jump.rampB && n.d <= sc.halfWidth) {
          g.ramp = { slope: sc.jump.height / (sc.jump.rampB - sc.jump.rampA), tx: n.tx, tz: n.tz };
        }
        for (const pad of sc.pads) if (n.d <= pad.halfWidth && Math.abs(n.s - pad.s) <= pad.length / 2) g.pad = pad;
        break;
      }
      return g;
    },

    // Kartı bariyerlerin içinde tutar. Çarpışma olursa duvar normalini döner.
    // Geçerli alan = ana yol koridoru + kısayol koridorları (birleşim); dışındaysa en az itmeyle içeri alınır.
    constrain(pos, radius, hint = -1) {
      const c = closest(pos.x, pos.z, hint);
      const limit = edge - radius;
      if (Math.abs(c.lateral) <= limit) return null;
      const r = rights[c.index];
      const s = Math.sign(c.lateral);
      let push = Math.abs(c.lateral) - limit;
      for (const sc of shortcuts) {
        const n = sc.nearest(pos.x, pos.z);
        if (!n) continue;
        const scLimit = sc.halfAt(n.s) - radius;
        if (n.d <= scLimit) return null; // kısayol koridorunun içinde
        const scPush = n.d - scLimit;
        if (scPush < push) {
          const nx = (n.px - pos.x) / n.d;
          const nz = (n.pz - pos.z) / n.d;
          pos.x += nx * scPush;
          pos.z += nz * scPush;
          return new THREE.Vector3(nx, 0, nz);
        }
      }
      pos.x -= r.x * push * s;
      pos.z -= r.z * push * s;
      return new THREE.Vector3(-r.x * s, 0, -r.z * s);
    },
  };
}

// Orta çizgiye paralel şerit. profile: [[yanal ofset, yükseklik], ...] soldan sağa.
// colorAt verilirse her segment düz renk alır; verilmezse UV üretilir (u: enine, v: segment başına vPerSeg).
function ribbon(points, rights, segments, profile, vPerSeg, colorAt = null, closed = true, rolls = null) {
  const pos = [];
  const uv = [];
  const col = [];
  const c = new THREE.Color();
  const vert = (i, k) => {
    const p = points[i];
    const r = rights[i];
    const [off, h] = profile[k];
    return [p.x + r.x * off, p.y + h + (rolls ? off * rolls[i] : 0), p.z + r.z * off];
  };
  const w0 = profile[0][0];
  const w1 = profile[profile.length - 1][0];
  for (let i = 0; i < segments; i++) {
    const j = closed ? (i + 1) % points.length : i + 1;
    if (colorAt) c.setHex(colorAt(i));
    for (let k = 0; k < profile.length - 1; k++) {
      const a0 = vert(i, k);
      const a1 = vert(i, k + 1);
      const b0 = vert(j, k);
      const b1 = vert(j, k + 1);
      pos.push(...a0, ...a1, ...b1, ...a0, ...b1, ...b0);
      if (colorAt) {
        for (let n = 0; n < 6; n++) col.push(c.r, c.g, c.b);
      } else {
        const u0 = (profile[k][0] - w0) / (w1 - w0);
        const u1 = (profile[k + 1][0] - w0) / (w1 - w0);
        const v0 = i * vPerSeg;
        const v1 = (i + 1) * vPerSeg;
        uv.push(u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (colorAt) geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  else geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  return geo;
}

// --- Ada zemini ---
function buildTerrain(def, { closest, insideLoop, edge, count, shortcuts = [], detail = null }) {
  const size = def.terrainSize;
  const res = 200;
  const n = res + 1;
  const cell = size / res;
  const half = size / 2;
  const heights = new Float32Array(n * n);
  const land = new Float32Array(n * n); // + kara içi, - deniz (metre cinsinden yaklaşık)
  const roadDist = new Float32Array(n * n);
  const colors = new Float32Array(n * n * 3);

  // Renk paleti pist tanımından (varsayılan: kumsal)
  const pal = { base: 0xf3d9a4, shore: 0xd8b47a, patch: 0x86c94f, patchDark: 0x5ea93f, shoulder: 0xf3d9a4, cliff: 0xb9a58a, ...def.palette };
  const C = Object.fromEntries(Object.entries(pal).map(([k, v]) => [k, new THREE.Color(v)]));
  const col = new THREE.Color();
  const mountains = def.outer === 'mountains';
  const baseH = def.baseHeight ?? 0;

  const dune = (x, z) => Math.sin(x * 0.045) * Math.sin(z * 0.052) * 0.5 + Math.sin(x * 0.11 + z * 0.07) * 0.25;
  const patch = (x, z) => Math.sin(x * 0.031 + 1.3) * Math.cos(z * 0.027 - 0.4) + Math.sin(x * 0.07 - z * 0.05) * 0.35;
  const ridge = (x, z) => Math.sin(x * 0.021) * Math.cos(z * 0.018 + 1) + Math.sin(x * 0.053 + z * 0.041) * 0.5;

  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = -half + i * cell;
      const z = -half + j * cell;
      const c = closest(x, z);
      const t = c.index / count;
      // sOuter: pist alanının kıyısına/eteğine uzaklık; sPond: göllerin kıyısına uzaklık (içeride negatif)
      const sOuter = insideLoop(x, z) ? c.dist + def.shoreMargin(t) : def.shoreMargin(t) - c.dist;
      let sPond = Infinity;
      for (const p of def.ponds ?? []) sPond = Math.min(sPond, Math.hypot(x - p.x, z - p.z) - p.r);

      let h;
      let s; // dekor için "karalık": + kara, - su (dağlık pistte dağ eteği de kara sayılır)
      if (mountains) {
        // Vadi: taban hafif dalgalı, göle doğru iner, dışarıda dağ yamacına yükselir
        h = baseH + dune(x, z) * 0.8;
        if (sPond < 30) h = Math.min(h, sPond < 0 ? Math.max(-5, sPond * 0.25) : sPond * 0.12);
        if (sOuter < 0) h += Math.min(45, -sOuter * 0.35) * (0.8 + 0.3 * ridge(x, z));
        s = sPond < 0 ? -1000 : Math.min(sOuter, sPond);
      } else {
        s = Math.min(sOuter, sPond);
        // Ada: kıyıda denize iner, içeride kumullar
        h = s > 0 ? Math.min(1.1, s * 0.09) + dune(x, z) * smoothstep(0, 30, s) : Math.max(-6, s * 0.2);
      }
      // Yolun yüksekliğine doğru tepecikler
      h += Math.max(0, c.y - 0.6 - baseH) * smoothstep(def.hillReach ?? 90, 20, c.dist) * smoothstep(-5, 10, Math.min(sOuter, sPond));

      // Yol çevresini yolun yüksekliğine düzle (kenar şeridi)
      const w = 1 - smoothstep(edge + 1.5, edge + 16, c.dist);
      h = THREE.MathUtils.lerp(h, c.y + Math.max(-edge, Math.min(edge, c.lateral)) * c.roll - 0.15, w);

      // Ay kraterleri: yola yaklaşmadan önce kaybolan çanak + yükselmiş kenar (def.craters: { x, z, r, depth })
      let craterShade = 0;
      for (const cr of def.craters ?? []) {
        const d = Math.hypot(x - cr.x, z - cr.z) / cr.r;
        if (d > 1.6) continue;
        const free = 1 - w; // yolun düzleştirdiği şeritte çukur açma
        const bowl = d < 1 ? (1 - d * d) : 0;
        const rim = Math.exp(-(((d - 1) / 0.22) ** 2)) * 0.22;
        h += (-cr.depth * bowl + cr.depth * rim) * free;
        craterShade = Math.max(craterShade, bowl * free);
      }

      // Kısayol: yatağı düzle, çukur/rampa gibi özellikleri işle
      let pathMix = 0;
      let pathTint = null;
      for (const sc of shortcuts) {
        const q = sc.sample(x, z);
        if (!q) continue;
        h = THREE.MathUtils.lerp(h, q.bed, q.w * smoothstep(edge, edge + 4, c.dist)); // ana yolun kenarını kısayol yatağına gömme
        if (q.path > pathMix) {
          pathMix = q.path;
          pathTint = q.tint;
        }
      }

      const k = j * n + i;
      heights[k] = h;
      land[k] = s;
      roadDist[k] = c.dist;

      // Renk: kıyı, taban, çim adacıkları, dağ kayası, yol kenarı şeridi
      const patchAmount = smoothstep(8, 22, Math.min(sOuter, sPond)) * smoothstep(-0.35, 0.15, patch(x, z)) * smoothstep(edge + 3, edge + 10, c.dist);
      col.copy(C.base).lerp(C.shore, 1 - smoothstep(0.1, 0.9, h));
      col.lerp(patchAmount > 0.5 ? C.patchDark : C.patch, patchAmount);
      if (mountains && sOuter < 0) col.lerp(C.cliff, smoothstep(-8, -40, sOuter) * (0.6 + 0.4 * smoothstep(-0.2, 0.6, patch(x * 2, z * 2))));
      col.lerp(C.shoulder, 1 - smoothstep(edge + 1, edge + 5, c.dist));
      if (craterShade > 0) col.multiplyScalar(1 - 0.28 * craterShade);
      if (pathTint) col.lerp(pathTint, pathMix);
      colors[k * 3] = col.r;
      colors[k * 3 + 1] = col.g;
      colors[k * 3 + 2] = col.b;
    }
  }

  const geo = new THREE.PlaneGeometry(size, size, res, res);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let k = 0; k < p.count; k++) p.setY(k, heights[k]);
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true });
  if (detail) addGroundDetail(terrainMat, detail);
  const mesh = new THREE.Mesh(geo, terrainMat);
  mesh.receiveShadow = true;

  const sample = (arr, x, z) => {
    const fx = Math.min(res - 1e-3, Math.max(0, (x + half) / cell));
    const fz = Math.min(res - 1e-3, Math.max(0, (z + half) / cell));
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const tx = fx - i;
    const tz = fz - j;
    const a = arr[j * n + i];
    const b = arr[j * n + i + 1];
    const c = arr[(j + 1) * n + i];
    const d = arr[(j + 1) * n + i + 1];
    return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
  };

  return {
    mesh,
    size,
    res,
    heights,
    heightAt: (x, z) => sample(heights, x, z),
    landAt: (x, z) => sample(land, x, z),
    roadDistAt: (x, z) => sample(roadDist, x, z),
    normalAt(x, z, out) {
      const e = cell * 0.5;
      const hx = sample(heights, x + e, z) - sample(heights, x - e, z);
      const hz = sample(heights, x, z + e) - sample(heights, x, z - e);
      return out.set(-hx, 2 * e, -hz).normalize();
    },
  };
}

// --- Detay dokuları (public/tex/, ambientCG CC0): orta gri = nötr, parlaklık çarpanı olarak biner ---
const texCache = new Map();
function tileTexture(name, repeat = [1, 1], { color = false } = {}) {
  const key = `${name}|${repeat}`;
  if (!texCache.has(key)) {
    const tex = new THREE.TextureLoader().load(`/tex/${name}.jpg`);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat[0], repeat[1]);
    tex.anisotropy = 4;
    if (!color) tex.colorSpace = THREE.NoColorSpace;
    texCache.set(key, tex);
  }
  return texCache.get(key);
}

// Arazi: dünya XZ düzleminde iki ölçekte tile'lanan detay parlaklığı + dik yamaçlarda kaya detayı.
// cfg: { tex: 'grass'|'sand'|..., rock?: 'rock', scale (1/metre), strength, rockStrength }
function addGroundDetail(material, cfg) {
  const detail = tileTexture(`detail_${cfg.tex}`);
  const rock = cfg.rock ? tileTexture(`detail_${cfg.rock}`) : null;
  const scale = cfg.scale ?? 0.12;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uDetail = { value: detail };
    shader.uniforms.uRock = { value: rock ?? detail };
    shader.uniforms.uScale = { value: scale };
    shader.uniforms.uStrength = { value: cfg.strength ?? 0.9 };
    shader.uniforms.uRockStrength = { value: rock ? (cfg.rockStrength ?? 1.4) : 0 };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos; uniform sampler2D uDetail; uniform sampler2D uRock; uniform float uScale; uniform float uStrength; uniform float uRockStrength;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec2 duv = vWPos.xz * uScale;
          float det = texture2D(uDetail, duv).r + texture2D(uDetail, duv * 0.29 + 0.37).r - 1.0;
          diffuseColor.rgb *= 1.0 + det * uStrength;
          vec3 fn = normalize(cross(dFdx(vWPos), dFdy(vWPos)));
          float steep = smoothstep(0.45, 0.8, 1.0 - abs(fn.y));
          float rd = texture2D(uRock, vWPos.xz * uScale * 0.5 + vWPos.y * 0.07).r + texture2D(uRock, vWPos.zx * uScale * 0.5).r - 1.0;
          diffuseColor.rgb *= 1.0 + rd * uRockStrength * steep;
        }`);
  };
}

// --- Prosedürel dokular ---
function asphaltTexture(style = {}) {
  const { base = '#5b606b', blotchDark = '40,44,52', blotchLight = '110,116,126', line = '#f4f4f0' } = style;
  const w = 256;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  // Hafif lekeler ve tanecikler
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = `rgba(${Math.random() < 0.5 ? blotchDark : blotchLight},${0.05 + Math.random() * 0.06})`;
    ctx.beginPath();
    ctx.ellipse(Math.random() * w, Math.random() * h, 10 + Math.random() * 40, 10 + Math.random() * 60, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 5000; i++) {
    const v = 70 + Math.random() * 80;
    ctx.fillStyle = `rgba(${v},${v},${v + 8},0.35)`;
    ctx.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5);
  }
  // Kenar çizgileri
  ctx.fillStyle = line;
  ctx.fillRect(w * 0.025, 0, w * 0.022, h);
  ctx.fillRect(w * 0.953, 0, w * 0.022, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

function startDecalTexture(hw, length, lineAt, slotDist) {
  const pxPerM = 16;
  const w = Math.round(hw * 2 * pxPerM);
  const h = Math.round(length * pxPerM);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  // v=0 arkada, v=1 başlangıç çizgisinin 2 segment ilerisi.
  const yOf = (metersFromEnd) => metersFromEnd * pxPerM;
  // Dama bandı
  const cells = 16;
  const cw = w / cells;
  const bandY = yOf(lineAt) - cw;
  for (let row = 0; row < 2; row++) {
    for (let k = 0; k < cells; k++) {
      ctx.fillStyle = (k + row) % 2 ? '#111' : '#fafafa';
      ctx.fillRect(k * cw, bandY + row * (cw / 2), cw, cw / 2);
    }
  }
  // Grid kutuları
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 4;
  for (let k = 0; k < 8; k++) {
    const y = yOf(lineAt + slotDist(k));
    const cx = w / 2 + (k % 2 ? 1 : -1) * hw * 0.42 * pxPerM;
    const bw = 3.2 * pxPerM;
    ctx.beginPath();
    ctx.moveTo(cx - bw / 2, y + 1.2 * pxPerM);
    ctx.lineTo(cx - bw / 2, y - 1.6 * pxPerM);
    ctx.lineTo(cx + bw / 2, y - 1.6 * pxPerM);
    ctx.lineTo(cx + bw / 2, y + 1.2 * pxPerM);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  // flipY: kanvasın üstü v=1'e (şeridin ön ucuna) denk gelir; yOf ön uçtan ölçer
  return tex;
}

// Kızgın zemin dokusu: koyu kızıl zemin üzerinde parlayan lav çatlakları (kenarlar yumuşakça kaybolur)
function crackTexture(width, length) {
  const pxPerM = 12;
  const w = Math.max(32, Math.round(width * pxPerM));
  const h = Math.max(64, Math.round(length * pxPerM));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  let seed = 4242;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  g.fillStyle = 'rgba(40,10,6,0.78)';
  g.fillRect(0, 0, w, h);
  // Kızgın lekeler
  for (let i = 0; i < w * h / 900; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    const r = 6 + rnd() * 26;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(255,110,20,0.5)');
    gr.addColorStop(1, 'rgba(255,60,0,0)');
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Çatlaklar: dallanan kırık çizgiler
  g.lineCap = 'round';
  for (let k = 0; k < Math.round(w * h / 2600); k++) {
    let x = rnd() * w;
    let y = rnd() * h;
    let a = rnd() * Math.PI * 2;
    const segs = 4 + Math.floor(rnd() * 6);
    for (const [lw, col] of [[7, 'rgba(255,90,10,0.55)'], [3, 'rgba(255,190,60,0.95)']]) {
      g.strokeStyle = col;
      g.lineWidth = lw;
      g.beginPath();
      g.moveTo(x, y);
      let px = x;
      let py = y;
      let pa = a;
      seed = seed * 7 % 2147483647;
      for (let j = 0; j < segs; j++) {
        pa += (rnd() - 0.5) * 1.3;
        px += Math.cos(pa) * (10 + rnd() * 16);
        py += Math.sin(pa) * (10 + rnd() * 16);
        g.lineTo(px, py);
      }
      g.stroke();
    }
  }
  // Kenarlarda şeffaflaş (yola yumuşak otursun)
  g.globalCompositeOperation = 'destination-in';
  const mask = g.createLinearGradient(0, 0, w, 0);
  mask.addColorStop(0, 'rgba(0,0,0,0)');
  mask.addColorStop(0.12, 'rgba(0,0,0,1)');
  mask.addColorStop(0.88, 'rgba(0,0,0,1)');
  mask.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = mask;
  g.fillRect(0, 0, w, h);
  const mask2 = g.createLinearGradient(0, 0, 0, h);
  mask2.addColorStop(0, 'rgba(0,0,0,0)');
  mask2.addColorStop(0.06, 'rgba(0,0,0,1)');
  mask2.addColorStop(0.94, 'rgba(0,0,0,1)');
  mask2.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = mask2;
  g.fillRect(0, 0, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// Zemin bölgesi dokuları (çamur, buz, su, bal, halı, hız şeridi, trambolin)
function zoneTexture(z, width, length) {
  const pxPerM = 10;
  const w = Math.max(32, Math.round(width * pxPerM));
  const h = Math.max(64, Math.round(length * pxPerM));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  let seed = 777 + z.from;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const blobs = (n, rMin, rMax, color) => {
    for (let i = 0; i < n; i++) {
      const x = rnd() * w;
      const y = rnd() * h;
      const r = rMin + rnd() * (rMax - rMin);
      g.fillStyle = color;
      g.beginPath();
      g.ellipse(x, y, r, r * (0.5 + rnd() * 0.5), rnd() * 3, 0, Math.PI * 2);
      g.fill();
    }
  };
  if (z.type === 'mud') {
    g.fillStyle = 'rgba(78,54,32,0.95)';
    g.fillRect(0, 0, w, h);
    blobs((w * h) / 1800, 8, 28, 'rgba(52,34,20,0.7)');
    blobs((w * h) / 3500, 6, 16, 'rgba(120,90,56,0.45)');
    blobs((w * h) / 5000, 10, 24, 'rgba(110,130,140,0.35)'); // su birikintileri
  } else if (z.type === 'ice' || z.type === 'wet') {
    const wet = z.type === 'wet';
    g.fillStyle = wet ? 'rgba(40,60,110,0.38)' : 'rgba(205,235,255,0.6)';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = wet ? 'rgba(180,210,255,0.5)' : 'rgba(255,255,255,0.75)';
    g.lineWidth = 3;
    for (let i = 0; i < (w * h) / 2500; i++) {
      const x = rnd() * w;
      const y = rnd() * h;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (rnd() - 0.5) * 40, y + 20 + rnd() * 60);
      g.stroke();
    }
    blobs((w * h) / 4000, 10, 30, wet ? 'rgba(160,200,255,0.25)' : 'rgba(255,255,255,0.35)');
  } else if (z.type === 'water') {
    g.fillStyle = 'rgba(60,150,220,0.62)';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(210,240,255,0.7)';
    g.lineWidth = 2.5;
    for (let i = 0; i < (w * h) / 1500; i++) {
      const x = rnd() * w;
      const y = rnd() * h;
      g.beginPath();
      g.ellipse(x, y, 10 + rnd() * 16, 3 + rnd() * 4, 0, 0, Math.PI * 2);
      g.stroke();
    }
  } else if (z.type === 'honey') {
    g.fillStyle = 'rgba(232,148,28,0.86)';
    g.fillRect(0, 0, w, h);
    blobs((w * h) / 2500, 10, 30, 'rgba(255,200,80,0.5)');
    blobs((w * h) / 4000, 6, 14, 'rgba(160,90,10,0.4)');
  } else if (z.type === 'snow') {
    g.fillStyle = 'rgba(246,250,255,0.95)';
    g.fillRect(0, 0, w, h);
    blobs((w * h) / 1600, 10, 30, 'rgba(255,255,255,1)');
    blobs((w * h) / 2600, 8, 20, 'rgba(200,220,240,0.6)');
  } else if (z.type === 'carpet') {
    g.fillStyle = 'rgba(196,58,72,0.97)';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,214,120,0.9)';
    g.lineWidth = 3;
    for (let x = -h; x < w + h; x += 26) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x + h, h);
      g.stroke();
      g.beginPath();
      g.moveTo(x + h, 0);
      g.lineTo(x, h);
      g.stroke();
    }
  } else if (z.type === 'boost') {
    g.fillStyle = 'rgba(10,14,40,0.8)';
    g.fillRect(0, 0, w, h);
    g.fillStyle = z.color ?? '#ffd23f';
    for (let y = h - 14; y > 14; y -= 46) {
      g.beginPath();
      g.moveTo(w / 2, y - 26);
      g.lineTo(w * 0.8, y + 4);
      g.lineTo(w * 0.8, y + 18);
      g.lineTo(w / 2, y - 8);
      g.lineTo(w * 0.2, y + 18);
      g.lineTo(w * 0.2, y + 4);
      g.closePath();
      g.fill();
    }
  } else if (z.type === 'bounce') {
    g.fillStyle = 'rgba(40,10,70,0.7)';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = z.color ?? '#ff4fd8';
    g.lineWidth = 6;
    const r = Math.min(w, h) * 0.38;
    for (const k of [1, 0.66, 0.33]) {
      g.beginPath();
      g.arc(w / 2, h / 2, r * k, 0, Math.PI * 2);
      g.stroke();
    }
  } else if (z.type === 'dune') {
    // Kum tepesi rampası: sarı kum, ileri bakan açık renk oklar, dalga çizgileri
    g.fillStyle = 'rgba(232,186,92,0.97)';
    g.fillRect(0, 0, w, h);
    blobs((w * h) / 2500, 8, 22, 'rgba(255,224,150,0.5)');
    g.strokeStyle = 'rgba(170,118,48,0.55)';
    g.lineWidth = 3;
    for (let y = 12; y < h; y += 22) {
      g.beginPath();
      g.moveTo(0, y);
      g.quadraticCurveTo(w / 2, y - 7, w, y);
      g.stroke();
    }
    g.fillStyle = 'rgba(255,248,214,0.92)';
    for (let y = h - 16; y > 16; y -= 40) {
      g.beginPath();
      g.moveTo(w / 2, y - 24);
      g.lineTo(w * 0.78, y + 4);
      g.lineTo(w * 0.78, y + 16);
      g.lineTo(w / 2, y - 6);
      g.lineTo(w * 0.22, y + 16);
      g.lineTo(w * 0.22, y + 4);
      g.closePath();
      g.fill();
    }
  }
  if (z.type === 'boardwalk') {
    // Yola dik tahtalar (her biri ~3 m), koyu aralıklar, çivi sırası; kenarları keskin (yumuşak maske yok)
    const plank = 30;
    const base = ['#b98a55', '#c39560', '#ad7f4b', '#bf8f5a'];
    for (let y = 0; y < h; y += plank) {
      g.fillStyle = base[Math.floor(rnd() * base.length)];
      g.fillRect(0, y, w, plank);
      g.fillStyle = 'rgba(70,42,20,0.35)';
      for (let k = 0; k < 5; k++) g.fillRect(rnd() * w, y + 3 + rnd() * (plank - 8), 20 + rnd() * 60, 1.5); // damar
      g.fillStyle = 'rgba(40,24,10,0.85)';
      g.fillRect(0, y, w, 2.5); // aralık
      g.fillStyle = 'rgba(50,34,20,0.9)';
      for (const x of [7, w - 7]) g.fillRect(x, y + plank / 2 - 1.5, 3, 3); // çiviler
    }
    const wood = new THREE.CanvasTexture(canvas);
    wood.colorSpace = THREE.SRGBColorSpace;
    wood.anisotropy = 8;
    return wood;
  }
  // Kenarlar yumuşakça kaybolsun
  g.globalCompositeOperation = 'destination-in';
  const mask = g.createLinearGradient(0, 0, w, 0);
  mask.addColorStop(0, 'rgba(0,0,0,0)');
  mask.addColorStop(0.1, 'rgba(0,0,0,1)');
  mask.addColorStop(0.9, 'rgba(0,0,0,1)');
  mask.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = mask;
  g.fillRect(0, 0, w, h);
  const mask2 = g.createLinearGradient(0, 0, 0, h);
  mask2.addColorStop(0, 'rgba(0,0,0,0)');
  mask2.addColorStop(0.05, 'rgba(0,0,0,1)');
  mask2.addColorStop(0.95, 'rgba(0,0,0,1)');
  mask2.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = mask2;
  g.fillRect(0, 0, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}
