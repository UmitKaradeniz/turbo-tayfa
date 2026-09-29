import * as THREE from 'three';
import { createItemBox, createCoconut, createSlick, createBubble } from './itemModels.js';

// Item sistemi: kutular, sıraya göre dağıtım, hindistan cevizi mermisi, yağ lekesi,
// kalkan ve turbo.
//
// Ağ modeli (tek oyunculuda da aynı yol): bir kartın fiziğini hangi cihaz
// çalıştırıyorsa (owned) o kartın item kullanımına ve ona gelen isabete o cihaz
// karar verir, sonucu `send` ile duyurur. Diğer cihazlar `receive` ile uygular.
// Böylece isabet, vurulanın ekranında gördüğüyle birebir aynıdır.

export const ITEMS = {
  turbo: { name: 'Turbo Şişesi' },
  shield: { name: 'Balon Kalkan' },
  coconut: { name: 'Hindistan Cevizi' },
  oil: { name: 'Yağ Lekesi' },
};

// Sıraya göre olasılıklar: öndekine savunma, arkadakine hız ve saldırı
const ROLL_TABLE = [
  { upTo: 0.2, weights: { shield: 0.35, oil: 0.4, coconut: 0.2, turbo: 0.05 } },
  { upTo: 0.6, weights: { coconut: 0.35, turbo: 0.25, shield: 0.2, oil: 0.2 } },
  { upTo: 1.01, weights: { turbo: 0.5, coconut: 0.35, shield: 0.1, oil: 0.05 } },
];

export function rollItem(place, total) {
  const f = total > 1 ? (place - 1) / (total - 1) : 0;
  const { weights } = ROLL_TABLE.find((r) => f <= r.upTo);
  let x = Math.random();
  for (const [item, w] of Object.entries(weights)) {
    if ((x -= w) <= 0) return item;
  }
  return 'turbo';
}

const BOX_RESPAWN = 3;
const BOX_RADIUS = 2.1;
const ROLL_TIME = 1.1;
const TURBO_TIME = 1.5;
const SHIELD_TIME = 8;
const COCONUT_SPEED = 46;
const COCONUT_LIFE = 6;
const COCONUT_BOUNCES = 3;
const HIT_RADIUS = 1.7;
const SLICK_LIFE = 20;
const SLICK_RADIUS = 2.0;
const OWNER_IMMUNE = 0.5;

const UP = new THREE.Vector3(0, 1, 0);

export function createItemSystem({ scene, track, send, isOwned, idOf, kartById, onRoll, onUse, onHit }) {
  let enabled = true; // Zamana Karşı modunda kutular kapalı
  // --- Kutular: pist boyunca 3 sıra, her sırada 5 kutu ---
  const boxes = [];
  const rows = [0.16, 0.47, 0.77].map((f) => Math.round(f * track.count));
  const hw = track.def.halfWidth;
  for (const index of rows) {
    const p = track.centerline[index];
    const r = track.rights[index];
    for (let k = -2; k <= 2; k++) {
      const lateral = k * hw * 0.36;
      const mesh = createItemBox();
      const pos = p.clone().addScaledVector(r, lateral).setY(p.y + 1.3);
      mesh.position.copy(pos);
      scene.add(mesh);
      boxes.push({ index, lateral, pos, mesh, active: true, respawn: 0 });
    }
  }

  const projectiles = new Map(); // id → coconut
  const slicks = new Map(); // id → oil
  const held = new Map(); // kart → { item, rolling }
  const bubbles = new Map(); // kart → mesh
  let counter = 0;
  let time = 0;
  const newId = (kart) => `${idOf(kart)}:${++counter}`;
  const _v = new THREE.Vector3();

  function spawnCoconut({ id, owner, p, v }) {
    const mesh = createCoconut();
    mesh.position.set(p[0], p[1], p[2]);
    scene.add(mesh);
    projectiles.set(id, {
      id,
      owner: kartById(owner),
      pos: mesh.position,
      vel: new THREE.Vector3(v[0], 0, v[2]),
      age: 0,
      bounces: 0,
      index: -1,
      mesh,
    });
  }

  function spawnSlick({ id, owner, p }) {
    const mesh = createSlick();
    mesh.position.set(p[0], p[1] + 0.04, p[2]);
    mesh.rotation.z = Math.random() * Math.PI * 2;
    scene.add(mesh);
    slicks.set(id, { id, owner: kartById(owner), pos: mesh.position, age: 0, mesh });
  }

  function removeThing(id) {
    for (const map of [projectiles, slicks]) {
      const t = map.get(id);
      if (t) {
        scene.remove(t.mesh);
        map.delete(id);
      }
    }
  }

  // Bizim kartımız (ya da sürdüğümüz bot) bir şeye çarptı
  function hit(kart, thing) {
    removeThing(thing.id);
    const result = kart.spinOut();
    onHit?.(kart, thing.owner, result);
    send({ type: 'hit', id: thing.id, target: idOf(kart) });
  }

  const api = {
    boxes,
    rows,
    projectiles,
    slicks,

    heldItem(kart) {
      const h = held.get(kart);
      return h && h.rolling <= 0 ? h.item : null;
    },
    isRolling(kart) {
      return (held.get(kart)?.rolling ?? 0) > 0;
    },
    setEnabled(v) {
      enabled = v;
    },
    // Test/geliştirme: karta doğrudan item ver
    give(kart, item) {
      held.set(kart, { item, rolling: 0 });
    },

    // Kart item'ını kullanır (backward: fren basılıysa geriye atar)
    use(kart, backward = false) {
      const h = held.get(kart);
      if (!h || h.rolling > 0 || kart.spinTime > 0) return false;
      held.delete(kart);
      const f = _v.set(Math.sin(kart.heading), 0, Math.cos(kart.heading));
      const owner = idOf(kart);
      switch (h.item) {
        case 'turbo':
          kart.boost(TURBO_TIME);
          break;
        case 'shield':
          kart.shieldTime = SHIELD_TIME;
          break;
        case 'coconut': {
          const dir = backward ? -1 : 1;
          const start = kart.position.clone().addScaledVector(f, dir * 2.8);
          const speed = backward ? 22 : Math.max(0, kart.speed) + COCONUT_SPEED;
          const msg = { type: 'item', kind: 'coconut', id: newId(kart), owner, p: [start.x, kart.position.y + 0.55, start.z], v: [f.x * dir * speed, 0, f.z * dir * speed] };
          spawnCoconut(msg);
          send(msg);
          break;
        }
        case 'oil': {
          const back = kart.position.clone().addScaledVector(f, -3.2);
          const msg = { type: 'item', kind: 'oil', id: newId(kart), owner, p: [back.x, kart.position.y, back.z] };
          spawnSlick(msg);
          send(msg);
          break;
        }
      }
      onUse?.(kart, h.item);
      return true;
    },

    // Başka cihazdan gelen mesajlar
    receive(msg) {
      if (msg.type === 'item') {
        if (projectiles.has(msg.id) || slicks.has(msg.id)) return;
        if (msg.kind === 'coconut') spawnCoconut(msg);
        else if (msg.kind === 'oil') spawnSlick(msg);
      } else if (msg.type === 'hit') {
        removeThing(msg.id);
      } else if (msg.type === 'box') {
        const b = boxes[msg.i];
        if (b) {
          b.active = false;
          b.respawn = BOX_RESPAWN;
        }
      }
    },

    // Sabit fizik adımında
    update(dt, karts, positionOf) {
      time += dt;
      // Kutular: yeniden doğma + bizim kartlarımızın toplaması
      for (const [i, b] of boxes.entries()) {
        if (!enabled) break;
        if (!b.active) {
          b.respawn -= dt;
          if (b.respawn <= 0) b.active = true;
          continue;
        }
        for (const kart of karts) {
          if (!isOwned(kart) || held.has(kart)) continue;
          if (kart.position.distanceToSquared(b.pos) > BOX_RADIUS * BOX_RADIUS + 1) continue;
          b.active = false;
          b.respawn = BOX_RESPAWN;
          const item = rollItem(positionOf(kart), karts.length);
          held.set(kart, { item, rolling: ROLL_TIME });
          onRoll?.(kart, item);
          send({ type: 'box', i });
          break;
        }
      }
      for (const h of held.values()) h.rolling -= dt;

      // Hindistan cevizleri: pist boyunca ilerler, bariyerden seker
      for (const c of projectiles.values()) {
        c.age += dt;
        c.pos.addScaledVector(c.vel, dt);
        const wall = track.constrain(c.pos, 0.5, c.index);
        if (wall) {
          const vn = c.vel.dot(wall);
          if (vn < 0) c.vel.addScaledVector(wall, -2 * vn);
          c.bounces++;
        }
        const g = track.groundAt(c.pos, c.index);
        c.index = g.index;
        c.pos.y = g.y + 0.55;
        c.mesh.rotation.x += dt * 14;
        if (c.age > COCONUT_LIFE || c.bounces > COCONUT_BOUNCES) {
          removeThing(c.id);
          continue;
        }
        for (const kart of karts) {
          if (!isOwned(kart) || kart.spinTime > 0) continue;
          if (kart === c.owner && c.age < OWNER_IMMUNE) continue;
          if (kart.position.distanceToSquared(c.pos) < HIT_RADIUS * HIT_RADIUS) {
            hit(kart, c);
            break;
          }
        }
      }

      // Yağ lekeleri
      for (const s of slicks.values()) {
        s.age += dt;
        if (s.age > SLICK_LIFE) {
          removeThing(s.id);
          continue;
        }
        for (const kart of karts) {
          if (!isOwned(kart) || kart.spinTime > 0) continue;
          if (kart === s.owner && s.age < 1.5) continue;
          const dx = kart.position.x - s.pos.x;
          const dz = kart.position.z - s.pos.z;
          if (dx * dx + dz * dz < SLICK_RADIUS * SLICK_RADIUS && Math.abs(kart.position.y - s.pos.y) < 1.5) {
            hit(kart, s);
            break;
          }
        }
      }
    },

    // Her karede: kutu animasyonu, kalkan balonları
    animate(dt, karts) {
      const hue = (performance.now() * 0.0001) % 1;
      for (const [i, b] of boxes.entries()) {
        const target = b.active && enabled ? 1 : 0;
        const s = b.mesh.scale.x + (target - b.mesh.scale.x) * Math.min(1, dt * 8);
        b.mesh.scale.setScalar(Math.max(0.001, s));
        b.mesh.visible = s > 0.02;
        b.mesh.rotation.y += dt * 1.2;
        b.mesh.rotation.x = Math.sin(time * 1.5 + i) * 0.25;
        b.mesh.position.y = b.pos.y + Math.sin(time * 2 + i * 0.7) * 0.15;
        b.mesh.material.emissive.setHSL(0.55 + ((hue + i * 0.07) % 1) * 0.35, 0.9, 0.5); // mavi → mor → pembe
      }
      for (const kart of karts) {
        let bubble = bubbles.get(kart);
        const on = kart.shieldTime > 0 && kart.object.visible;
        if (on && !bubble) {
          bubble = createBubble();
          scene.add(bubble);
          bubbles.set(kart, bubble);
        }
        if (bubble) {
          bubble.visible = on;
          bubble.position.copy(kart.object.position).addScaledVector(UP, 1.2);
          bubble.material.uniforms.time.value = time;
        }
      }
    },

    // Pist değişince her şeyi sahneden kaldır
    dispose() {
      this.reset();
      for (const b of boxes) scene.remove(b.mesh);
      for (const m of bubbles.values()) scene.remove(m);
      bubbles.clear();
    },

    reset() {
      for (const id of [...projectiles.keys(), ...slicks.keys()]) removeThing(id);
      held.clear();
      for (const b of boxes) {
        b.active = true;
        b.respawn = 0;
      }
    },
  };
  return api;
}
