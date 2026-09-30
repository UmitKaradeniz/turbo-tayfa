import * as THREE from 'three';
import { instancedModel } from './assets.js';

// Pist dekoru: modeller önce "yerleşim listesine" eklenir, sonunda her model
// için tek bir InstancedMesh grubu üretilir (yüzlerce palmiye = birkaç çizim çağrısı).

const UP = new THREE.Vector3(0, 1, 0);

export function buildDecor(track, decorate, density = 1) {
  const placements = new Map();
  const noShadow = new Set();
  const frost = new Set();
  const extras = [];
  const reserved = [];
  const { terrain } = track;
  let seed = 20260929;
  const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const _p = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  const _s = new THREE.Vector3();

  const ctx = {
    rng,
    track,
    density,

    // Bir modeli yerleştir. scale sayı ya da Vector3 olabilir; y verilmezse zemine oturur.
    place(key, x, z, rotY = 0, scale = 1, y = null) {
      const m = new THREE.Matrix4().compose(
        _p.set(x, y ?? terrain.heightAt(x, z), z),
        _q.setFromAxisAngle(UP, rotY),
        typeof scale === 'number' ? _s.setScalar(scale) : _s.copy(scale),
      );
      if (!placements.has(key)) placements.set(key, []);
      placements.get(key).push(m);
    },

    noShadow(...keys) {
      keys.forEach((k) => noShadow.add(k));
    },

    // Bu modeller karlı görünür (kış pistleri)
    frost(...keys) {
      keys.forEach((k) => frost.add(k));
    },

    // Hazır bir 3B nesneyi (bina, tabela vb.) dekora ekle
    addObject(obj) {
      extras.push(obj);
    },

    // Bu çemberin içine rastgele dekor koyma
    reserve(x, z, r) {
      reserved.push([x, z, r]);
    },

    // Pistin i. örneğinde, yanal ofsetteki nokta ve yönler
    along(i, lateral = 0) {
      const n = track.count;
      const k = ((Math.round(i) % n) + n) % n;
      const p = track.centerline[k];
      const r = track.rights[k];
      const f = track.forwards[k];
      return {
        x: p.x + r.x * lateral,
        z: p.z + r.z * lateral,
        forwardY: Math.atan2(f.x, f.z), // modelin +Z'si pist yönüne baksın
        acrossY: Math.atan2(-r.z, r.x), // modelin +X'i pistin sağına baksın
        faceTrackY: Math.atan2(-r.x * Math.sign(lateral), -r.z * Math.sign(lateral)), // +Z piste dönük
      };
    },

    // Kısayolun s metresindeki nokta (yanal ofset: + sağ) ve yönler
    shortcutAt(sc, s, lateral = 0) {
      const p = sc.pointAt(s, lateral);
      return { ...p, acrossY: Math.atan2(-p.rz, p.rx), faceTrackY: Math.atan2(-p.rx * Math.sign(lateral || 1), -p.rz * Math.sign(lateral || 1)) };
    },

    // Adaya rastgele serpiştir. where(land, roadDist, x, z) true dönerse yerleşir.
    scatter({ keys, count, scale: [a, b], where }) {
      const target = Math.round(count * density);
      const half = terrain.size / 2 - 5;
      let placed = 0;
      for (let tries = 0; placed < target && tries < target * 60; tries++) {
        const x = (rng() * 2 - 1) * half;
        const z = (rng() * 2 - 1) * half;
        if (!where(terrain.landAt(x, z), terrain.roadDistAt(x, z), x, z)) continue;
        if (track.shortcutClearance(x, z) < 5) continue; // kısayol yolu açık kalsın
        if (reserved.some(([rx, rz, rr]) => (x - rx) ** 2 + (z - rz) ** 2 < rr * rr)) continue;
        ctx.place(keys[Math.floor(rng() * keys.length)], x, z, rng() * Math.PI * 2, a + rng() * (b - a));
        placed++;
      }
    },
  };

  placeBarriers(ctx, track);
  placeShortcutEdges(ctx, track);
  decorate(ctx);

  const group = new THREE.Group();
  group.userData.byKey = new Map();
  for (const [key, matrices] of placements) {
    const g = instancedModel(key, matrices, { castShadow: !noShadow.has(key), frost: frost.has(key) });
    group.userData.byKey.set(key, g);
    group.add(g);
  }
  for (const o of extras) group.add(o);
  return group;
}

// Pistin iki yanına kırmızı-beyaz bariyer dizisi. Dar virajların iç tarafında
// bariyer hattı kendi üstüne katlanacağı için oralar atlanır.
function placeBarriers(ctx, track) {
  const PIECE = 2; // metre
  const offset = track.edge + 0.55;
  for (const side of [-1, 1]) {
    const line = [];
    for (let i = 0; i < track.count; i++) {
      const tight = track.innerSide[i] === side && track.turnRadius[i] < offset + 4;
      const p = track.centerline[i];
      const r = track.rights[i];
      line.push(tight ? null : new THREE.Vector2(p.x + r.x * offset * side, p.z + r.z * offset * side));
    }
    let carry = 0;
    let piece = 0;
    for (let i = 0; i < line.length; i++) {
      const a = line[i];
      const b = line[(i + 1) % line.length];
      if (!a || !b) {
        carry = 0;
        continue;
      }
      const seg = b.clone().sub(a);
      const len = seg.length();
      const rotY = Math.atan2(-seg.y, seg.x);
      let d = carry;
      for (; d < len; d += PIECE) {
        const t = Math.min(1, (d + PIECE / 2) / len);
        const bx = a.x + seg.x * t;
        const bz = a.y + seg.y * t;
        if (track.shortcutClearance(bx, bz) < 2) continue; // kısayol girişinde bariyer yok
        ctx.place(piece++ % 2 ? 'racing/barrierWhite' : 'racing/barrierRed', bx, bz, rotY, 8);
      }
      carry = d - len;
    }
  }
}

// Kısayolun iki kenarına doğal "duvar" (kaya, kütük vb.): sc.def.edge = { keys, step, scale }
function placeShortcutEdges(ctx, track) {
  for (const sc of track.shortcuts) {
    const e = sc.def.edge;
    if (!e) continue;
    let k = 0;
    for (let s = 0; s <= sc.length; s += e.step ?? 4) {
      for (const side of [-1, 1]) {
        const p = sc.pointAt(s, side * (sc.halfAt(s) + 0.9));
        // Ana yol koridorunun ve çukurun içine koyma
        if (track.closest(p.x, p.z).dist < track.edge + 1) continue;
        if (sc.jump && s > sc.jump.pitA - 1 && s < sc.jump.pitB + 1) continue;
        const key = e.keys[(k++ + (side > 0 ? 1 : 0)) % e.keys.length];
        const [a, b] = e.scale ?? [4, 6];
        // aligned: model yolun yönüne hizalı (bariyer gibi uzun parçalar)
        const rot = e.aligned ? Math.atan2(-p.fz, p.fx) : ctx.rng() * Math.PI * 2;
        ctx.place(key, p.x, p.z, rot, a + ctx.rng() * (b - a));
      }
    }
  }
}
