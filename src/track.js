import * as THREE from 'three';

// Kapalı bir orta çizgiden (centerline) pist üretir: yol, bordür, başlangıç
// işaretleri, ada zemini, sınırlar, zemin sorgusu ve grid pozisyonları.
// Pist tanımı (src/tracks/*.js) sadece kontrol noktaları ve birkaç ölçü verir.

const UP = new THREE.Vector3(0, 1, 0);
const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Sadece orta çizgi (menüdeki pist küçük resmi için; zemin üretmez)
export function trackOutline(def) {
  const curve = new THREE.CatmullRomCurve3(def.control.map(([x, z, y]) => new THREE.Vector3(x, y, z)), true, 'centripetal');
  const count = Math.round(curve.getLength() / 2.5);
  const centerline = curve.getSpacedPoints(count).slice(0, count);
  const rights = centerline.map((p, i) => {
    const f = centerline[(i + 1) % count].clone().sub(centerline[(i - 1 + count) % count]).setY(0).normalize();
    return f.cross(UP).normalize();
  });
  return { centerline, rights, length: curve.getLength() };
}

export function buildTrack(def) {
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

  const group = new THREE.Group();

  // --- Yol ---
  const road = new THREE.Mesh(
    ribbon(points, rights, count, [
      [-hw, 0],
      [hw, 0],
    ], segLen / 16),
    new THREE.MeshStandardMaterial({ map: asphaltTexture(), roughness: 0.92 }),
  );
  road.receiveShadow = true;
  group.add(road);

  // --- Bordürler (yoldan hafif yüksek, dışa doğru kuma iner) ---
  const curbMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, flatShading: true });
  const stripe = (i) => (i % 2 ? 0xffffff : 0xe23b36);
  for (const side of [-1, 1]) {
    const profile = side < 0
      ? [[-hw - curb, -0.12], [-hw - curb * 0.35, 0.07], [-hw, 0.07]]
      : [[hw, 0.07], [hw + curb * 0.35, 0.07], [hw + curb, -0.12]];
    const mesh = new THREE.Mesh(ribbon(points, rights, count, profile, 0, stripe), curbMat);
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  // --- Başlangıç çizgisi ve grid işaretleri (yol üstüne çıkartma) ---
  const decalLen = 70; // metre, başlangıç çizgisinin arkasına doğru
  const decalSegs = Math.round(decalLen / segLen);
  const decalPoints = [];
  const decalRights = [];
  for (let k = decalSegs; k >= 0; k--) {
    decalPoints.push(points[at(-k + 2)].clone().add(new THREE.Vector3(0, 0.015, 0)));
    decalRights.push(rights[at(-k + 2)]);
  }
  const decalLength = decalSegs * segLen;
  const gridSlotDist = (k) => 10 + Math.floor(k / 2) * 7 + (k % 2) * 3.5;
  const decal = new THREE.Mesh(
    ribbon(decalPoints, decalRights, decalPoints.length - 1, [[-hw, 0], [hw, 0]], 1 / (decalPoints.length - 1), null, false),
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

  // --- Ada zemini (yükseklik ızgarası) ---
  const terrain = buildTerrain(def, { closest, insideLoop, edge, count });
  group.add(terrain.mesh);

  // --- Checkpointler (sayım Aşama 3'te) ---
  const checkpoints = [];
  const cpCount = 12;
  for (let k = 0; k < cpCount; k++) {
    const i = Math.floor((k / cpCount) * count);
    checkpoints.push({ index: i, position: points[i].clone(), forward: forwards[i].clone() });
  }

  const _n = new THREE.Vector3();

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
    turnRadius,
    checkpoints,
    closest,
    insideLoop,

    // Grid pozisyonu k (0 = pol pozisyonu)
    gridSlot(k) {
      const back = gridSlotDist(k);
      const i = at(-Math.round(back / segLen));
      const lateral = (k % 2 ? 1 : -1) * hw * 0.42;
      const p = points[i].clone().addScaledVector(rights[i], lateral);
      return { position: p, heading: Math.atan2(forwards[i].x, forwards[i].z) };
    },

    // Zemin yüksekliği, normali ve yüzey tipi
    groundAt(pos, hint = -1) {
      const c = closest(pos.x, pos.z, hint);
      const a = Math.abs(c.lateral);
      if (a <= hw + curb) {
        const f = forwards[c.index];
        const r = rights[c.index];
        _n.crossVectors(r, f).normalize();
        const y = a <= hw ? c.y : c.y + (a - hw < curb * 0.35 ? 0.07 : THREE.MathUtils.lerp(0.07, -0.12, (a - hw - curb * 0.35) / (curb * 0.65)));
        return { y, normal: _n, surface: a <= hw ? 'road' : 'curb', index: c.index };
      }
      const y = terrain.heightAt(pos.x, pos.z);
      terrain.normalAt(pos.x, pos.z, _n);
      return { y, normal: _n, surface: 'sand', index: c.index };
    },

    // Kartı bariyerlerin içinde tutar. Çarpışma olursa duvar normalini döner.
    constrain(pos, radius, hint = -1) {
      const c = closest(pos.x, pos.z, hint);
      const limit = edge - radius;
      if (Math.abs(c.lateral) <= limit) return null;
      const r = rights[c.index];
      const s = Math.sign(c.lateral);
      const push = Math.abs(c.lateral) - limit;
      pos.x -= r.x * push * s;
      pos.z -= r.z * push * s;
      return new THREE.Vector3(-r.x * s, 0, -r.z * s);
    },
  };
}

// Orta çizgiye paralel şerit. profile: [[yanal ofset, yükseklik], ...] soldan sağa.
// colorAt verilirse her segment düz renk alır; verilmezse UV üretilir (u: enine, v: segment başına vPerSeg).
function ribbon(points, rights, segments, profile, vPerSeg, colorAt = null, closed = true) {
  const pos = [];
  const uv = [];
  const col = [];
  const c = new THREE.Color();
  const vert = (i, k) => {
    const p = points[i];
    const r = rights[i];
    const [off, h] = profile[k];
    return [p.x + r.x * off, p.y + h, p.z + r.z * off];
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
function buildTerrain(def, { closest, insideLoop, edge, count }) {
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
      h += Math.max(0, c.y - 0.6 - baseH) * smoothstep(90, 20, c.dist) * smoothstep(-5, 10, Math.min(sOuter, sPond));

      // Yol çevresini yolun yüksekliğine düzle (kenar şeridi)
      const w = 1 - smoothstep(edge + 1.5, edge + 16, c.dist);
      h = THREE.MathUtils.lerp(h, c.y - 0.15, w);

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
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }));
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

// --- Prosedürel dokular ---
function asphaltTexture() {
  const w = 256;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#5b606b';
  ctx.fillRect(0, 0, w, h);
  // Hafif lekeler ve tanecikler
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '40,44,52' : '110,116,126'},${0.05 + Math.random() * 0.06})`;
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
  ctx.fillStyle = '#f4f4f0';
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
