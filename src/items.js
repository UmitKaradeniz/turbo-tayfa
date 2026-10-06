import * as THREE from 'three';
import { createItemBox, createCoconut, createSlick, createBubble, createGull, createParrot, createGullDrop, createGiftBox, createSplatBlob } from './itemModels.js';
import { createGoldBox, createSurpriseArch } from './goldBox.js';

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
  gull: { name: 'Martı Pisliği' },
  parrot: { name: 'Papağan Hırsızı' },
};

// Sıraya göre olasılıklar: öndekine savunma, arkadakine hız ve saldırı
const ROLL_TABLE = [
  { upTo: 0.2, weights: { shield: 0.35, oil: 0.4, coconut: 0.2, turbo: 0.05 } },
  { upTo: 0.6, weights: { coconut: 0.26, turbo: 0.2, shield: 0.16, gull: 0.16, parrot: 0.12, oil: 0.1 } },
  { upTo: 1.01, weights: { turbo: 0.3, coconut: 0.22, parrot: 0.18, gull: 0.16, shield: 0.08, oil: 0.06 } },
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
const GOLD_RESPAWN = 10; // altın süpriz kutusu (çift hak)
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
const GULL_TIME = 4; // martı pisliğinin etkisi (sn)
const GULL_DROP_AT = 1.15; // martı yaklaşıp damlayı bıraktığı an
const PARROT_OUT = 0.8; // papağanın hedefe varış süresi
const PARROT_BACK = 0.9; // dönüş süresi

const UP = new THREE.Vector3(0, 1, 0);

export function createItemSystem({ scene, track, send, isOwned, idOf, kartById, onRoll, onUse, onHit, fx = null, onGull, onSteal, onLoot, onNoTarget }) {
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
      const pos = p.clone().addScaledVector(r, lateral).setY(p.y + lateral * (track.rolls[index] ?? 0) + 1.3);
      mesh.position.copy(pos);
      scene.add(mesh);
      boxes.push({ index, lateral, pos, mesh, active: true, respawn: 0 });
    }
  }

  // Kısayol ödülü: kısayolun içindeki ek kutular (botlar bunlara yönelmez)
  for (const sc of track.shortcuts) {
    const b = sc.def.boxes;
    if (!b) continue;
    const s0 = b.at === 'landing' && sc.jump ? sc.jump.pitB + 7 : b.at === 'mid' ? sc.length * 0.45 : (b.f ?? 0.5) * sc.length;
    for (const lateral of b.lateral) {
      const q = sc.pointAt(s0, lateral);
      const pos = new THREE.Vector3(q.x, q.y + 1.3, q.z);
      const mesh = createItemBox();
      mesh.position.copy(pos);
      scene.add(mesh);
      boxes.push({ index: -1, lateral, pos, mesh, active: true, respawn: 0 });
    }
  }

  // Süpriz yolu: girişte altın kemer, sonda tek altın kutu (çift hak)
  const extras = [];
  for (const sc of track.shortcuts) {
    const sp = sc.def.surprise;
    if (!sp) continue;
    const arch = createSurpriseArch(sc.halfWidth);
    const a = sc.pointAt(sc.sA + 6);
    arch.position.set(a.x, a.y, a.z);
    arch.rotation.y = Math.atan2(-a.fx, -a.fz); // yerel X ekseni yolun sağ vektörüne bakar
    scene.add(arch);
    extras.push(arch);
    const q = sc.pointAt(sc.length * (sp.f ?? 0.5));
    const pos = new THREE.Vector3(q.x, q.y + 1.5, q.z);
    const mesh = createGoldBox(sp.skin);
    mesh.position.copy(pos);
    scene.add(mesh);
    boxes.push({ index: -1, lateral: 0, pos, mesh, active: true, respawn: 0, gold: true });
  }

  const projectiles = new Map(); // id → coconut
  const slicks = new Map(); // id → oil
  const held = new Map(); // kart → { item, rolling }
  const bubbles = new Map(); // kart → mesh
  const fxs = []; // geçici görseller: martı, papağan {update(dt) → yaşıyor mu, dispose()}
  const seen = new Set(); // uzaktan gelen anlık eşya mesajları bir kez uygulanır
  const ctx = { karts: [], positionOf: () => 1 };
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


  // ---- Martı / papağan / fil ----
  const targetAhead = (kart) => {
    const p = ctx.positionOf(kart);
    if (p <= 1) return null;
    return ctx.karts.find((k) => k !== kart && ctx.positionOf(k) === p - 1) ?? null;
  };
  const _a = new THREE.Vector3();
  const _b = new THREE.Vector3();

  // Martı: hedefin arkasından yaklaşır, üstünde damlayı bırakır, çekilip gider. Etki damla düştüğü anda uygulanır
  // (kalkan açmak için kısa bir fırsat var).
  function applyGull(target) {
    const gull = createGull();
    gull.scale.setScalar(2.1);
    const drop = createGullDrop();
    drop.scale.setScalar(1.8);
    drop.visible = false;
    scene.add(gull, drop);
    let t = 0;
    let dropped = false;
    const dropPos = new THREE.Vector3();
    fxs.push({
      update(dt) {
        t += dt;
        const fx0 = Math.sin(target.heading);
        const fz0 = Math.cos(target.heading);
        const base = target.object.position;
        // yaklaşma: arkadan yüksekten → üstte süzülme → ileri doğru yükselip çekilme
        const k = Math.min(1, t / GULL_DROP_AT);
        const away = Math.max(0, t - GULL_DROP_AT - 0.2);
        const behind = (1 - k) * 15 - away * 22;
        const side = (1 - k) * -4 + away * 3;
        const h = 3.8 + (1 - k) * 4 + away * 9;
        gull.position.set(base.x - fx0 * behind + fz0 * side, base.y + h, base.z - fz0 * behind - fx0 * side);
        gull.rotation.set(Math.sin(t * 4) * 0.08, target.heading + (away > 0 ? -0.5 : 0), Math.sin(t * 3) * 0.12);
        gull.userData.flap(t + 3);
        if (!dropped && t >= GULL_DROP_AT) {
          dropped = true;
          drop.visible = true;
          dropPos.copy(gull.position);
          drop.userData.t0 = t;
        }
        if (dropped) {
          // damla hedefin kokpitine düşer
          const fall = Math.min(1, (t - drop.userData.t0) / 0.32);
          _b.set(base.x, base.y + 1.5, base.z);
          drop.position.lerpVectors(dropPos, _b, fall * fall);
          if (fall >= 1 && !drop.userData.hit) {
            drop.userData.hit = true;
            drop.visible = false;
            splatBurst(target);
            addSplat(target, GULL_TIME - 0.4);
            if (isOwned(target)) {
              if (target.shieldTime > 0) {
                target.shieldTime = 0;
                target.events.push('blocked');
                onGull?.(target, false);
              } else {
                target.gullTime = GULL_TIME;
                onGull?.(target, true);
              }
            }
          }
        }
        return t < GULL_DROP_AT + 1.9;
      },
      dispose() {
        scene.remove(gull, drop);
      },
    });
  }
  // Kartın başına yapışan leke: etki süresince görünür
  function addSplat(kart, life) {
    const blob = createSplatBlob();
    kart.object.add(blob);
    let t = 0;
    fxs.push({
      update(dt) {
        t += dt;
        blob.scale.setScalar((t < 0.18 ? 0.3 + (t / 0.18) * 0.9 : t < 0.3 ? 1.2 - ((t - 0.18) / 0.12) * 0.2 : 1));
        blob.userData.animate(t);
        return t < life;
      },
      dispose() {
        kart.object.remove(blob);
      },
    });
  }
  function splatBurst(kart) {
    if (!fx) return;
    const p = new THREE.Vector3(kart.object.position.x, kart.object.position.y + 1.4, kart.object.position.z);
    for (let i = 0; i < 16; i++) {
      const v = new THREE.Vector3((Math.random() - 0.5) * 6, 2 + Math.random() * 4, (Math.random() - 0.5) * 6);
      fx.emitSpark(p, v, { life: 0.5 + Math.random() * 0.3, size: 0.5, sizeEnd: 0.1, color: new THREE.Color(Math.random() < 0.7 ? 0xf4fff0 : 0xb7e08a) });
    }
  }

  // Papağan: hırsızdan hedefe uçar; hedefin cihazı elindeki eşyayı çalar; geri dönerken hediyeyi getirir
  function applyParrot(thief, target) {
    const bird = createParrot();
    bird.scale.setScalar(1.9);
    const gift = createGiftBox();
    gift.scale.setScalar(1.7);
    gift.visible = false;
    scene.add(bird, gift);
    let t = 0;
    let resolved = false;
    fxs.push({
      update(dt) {
        t += dt;
        const A = thief.object.position;
        const B = target.object.position;
        const out = t < PARROT_OUT;
        const k = out ? t / PARROT_OUT : Math.min(1, (t - PARROT_OUT) / PARROT_BACK);
        const e = k * k * (3 - 2 * k);
        const from = out ? A : B;
        const to = out ? B : A;
        bird.position.set(from.x + (to.x - from.x) * e, from.y + 2.6 + Math.sin(k * Math.PI) * 1.6, from.z + (to.z - from.z) * e);
        const dir = out ? _a.subVectors(B, A) : _a.subVectors(A, B);
        bird.rotation.set(0, Math.atan2(dir.x, dir.z), Math.sin(t * 5) * 0.15);
        bird.userData.flap(t);
        gift.visible = !out;
        gift.position.set(bird.position.x, bird.position.y - 1.2, bird.position.z);
        gift.rotation.y = t * 3;
        if (!resolved && t >= PARROT_OUT) {
          resolved = true;
          stealGameplay(thief, target);
          if (fx) {
            for (let i = 0; i < 12; i++) fx.emitSpark(B, new THREE.Vector3((Math.random() - 0.5) * 7, 3 + Math.random() * 4, (Math.random() - 0.5) * 7), { life: 0.5, size: 0.45, sizeEnd: 0.08, color: new THREE.Color(Math.random() < 0.5 ? 0xe8332c : 0xffc21a) });
          }
        }
        return t < PARROT_OUT + PARROT_BACK + 0.2;
      },
      dispose() {
        scene.remove(bird, gift);
      },
    });
  }
  // Hedefin cihazında: kalkan engeller, yoksa eşya çalınır (boş elliyse hırsıza küçük bir turbo)
  function stealGameplay(thief, target) {
    if (!isOwned(target)) return;
    if (target.shieldTime > 0) {
      target.shieldTime = 0;
      target.events.push('blocked');
      onSteal?.(thief, target, 'blocked');
      return;
    }
    const h = held.get(target);
    let item = null;
    let uses = 1;
    if (h && h.rolling <= 0) {
      held.delete(target);
      item = h.item;
      uses = h.uses ?? 1;
    }
    onSteal?.(thief, target, item ? 'stolen' : 'empty');
    if (isOwned(thief)) giveLoot(thief, item, uses);
    else send({ type: 'item', kind: 'loot', id: `${idOf(target)}:${++counter}`, owner: idOf(target), to: idOf(thief), item, uses });
  }
  function giveLoot(thief, item, uses) {
    if (item && !held.has(thief)) {
      held.set(thief, { item, rolling: 0.7, uses });
      onLoot?.(thief, item, uses);
    } else thief.boost(1.2); // boş elli / elindekini bırakmayan hırsız: küçük bir turbo
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
      if ((h.item === 'gull' || h.item === 'parrot') && !targetAhead(kart)) {
        onNoTarget?.(kart);
        return false;
      }
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
        case 'gull': {
          const t = targetAhead(kart);
          applyGull(t);
          send({ type: 'item', kind: 'gull', id: newId(kart), owner, target: idOf(t) });
          break;
        }
        case 'parrot': {
          const t = targetAhead(kart);
          applyParrot(kart, t);
          send({ type: 'item', kind: 'parrot', id: newId(kart), owner, target: idOf(t) });
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
      const left = (h.uses ?? 1) - 1;
      if (left > 0) held.set(kart, { item: h.item, rolling: 0, uses: left });
      onUse?.(kart, h.item, left);
      return true;
    },

    // Başka cihazdan gelen mesajlar
    receive(msg) {
      if (msg.type === 'item') {
        if (projectiles.has(msg.id) || slicks.has(msg.id)) return;
        if (msg.kind === 'coconut') spawnCoconut(msg);
        else if (msg.kind === 'oil') spawnSlick(msg);
        else if (['gull', 'parrot', 'loot'].includes(msg.kind)) {
          if (seen.has(msg.id)) return;
          seen.add(msg.id);
          if (msg.kind === 'gull') {
            const t = kartById(msg.target);
            if (t) applyGull(t);
          } else if (msg.kind === 'parrot') {
            const thief = kartById(msg.owner);
            const t = kartById(msg.target);
            if (thief && t) applyParrot(thief, t);
          } else {
            const th = kartById(msg.to);
            if (th && isOwned(th)) giveLoot(th, msg.item ?? null, Math.max(1, msg.uses | 0));
          }
        }
      } else if (msg.type === 'hit') {
        removeThing(msg.id);
      } else if (msg.type === 'box') {
        const b = boxes[msg.i];
        if (b) {
          b.active = false;
          b.respawn = b.gold ? GOLD_RESPAWN : BOX_RESPAWN;
        }
      }
    },

    // Sabit fizik adımında
    update(dt, karts, positionOf) {
      time += dt;
      ctx.karts = karts;
      ctx.positionOf = positionOf;
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
          b.respawn = b.gold ? GOLD_RESPAWN : BOX_RESPAWN;
          let item = rollItem(positionOf(kart), karts.length);
          if (b.gold) while (item === 'oil') item = rollItem(positionOf(kart), karts.length); // altın kutu yağ vermez
          const uses = b.gold ? 2 : 1;
          held.set(kart, { item, rolling: ROLL_TIME, uses });
          onRoll?.(kart, item, uses);
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
        b.mesh.position.y = b.pos.y + Math.sin(time * 2 + i * 0.7) * 0.15;
        if (b.mesh.visible) b.mesh.userData.animate(dt, time, hue, i);
      }
      for (let i = fxs.length - 1; i >= 0; i--) {
        if (!fxs[i].update(dt)) {
          fxs[i].dispose();
          fxs.splice(i, 1);
        }
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
      for (const m of extras) scene.remove(m);
      for (const m of bubbles.values()) scene.remove(m);
      bubbles.clear();
    },

    reset() {
      for (const id of [...projectiles.keys(), ...slicks.keys()]) removeThing(id);
      held.clear();
      for (const f of fxs) f.dispose();
      fxs.length = 0;
      seen.clear();
      for (const b of boxes) {
        b.active = true;
        b.respawn = 0;
      }
    },
  };
  return api;
}
