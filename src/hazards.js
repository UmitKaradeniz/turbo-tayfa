import * as THREE from 'three';
import { hasModels, normalizedModel } from './assets.js';

// Zamanlı pist tehlikeleri: Volkan'da gayzerler, Ay'da meteorlar.
// Zamanlama yarış saatinden (race.clock) hesaplanır; çevrimiçinde saat herkeste aynı olduğu için
// her cihaz aynı anda aynı olayı görür. İsabeti yalnızca kendi sürdüğü kartlar için o cihaz işler
// (item isabetleriyle aynı mantık: karta sahip olan cihaz savrulmayı uygular).
//
// def.hazards: [{ type: 'geyser' | 'meteor', f (turun oranı), lateral (m), radius (m), period (s), offset (s) }]

const EMBER = new THREE.Color(2.2, 0.65, 0.1);
const EMBER_HOT = new THREE.Color(2.6, 1.3, 0.3);
const ASH = new THREE.Color(0.22, 0.2, 0.2);
const DUST = new THREE.Color(0.75, 0.72, 0.7);
const STYLE = {
  geyser: { ring: new THREE.Color(1.7, 0.36, 0.05), warn: 1.6, burst: 1.0, hit: 0.75, tall: 11 },
  meteor: { ring: new THREE.Color(1.0, 0.1, 0.08), warn: 2.2, fall: 0.6, hit: 0.5, impact: 0.7 },
};

function ringTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 62);
  grad.addColorStop(0, 'rgba(255,255,255,0.22)');
  grad.addColorStop(0.7, 'rgba(255,255,255,0.3)');
  grad.addColorStop(0.82, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.92, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export function createHazards({ scene, track, fx, quality }) {
  const list = track.def.hazards ?? [];
  const rate = quality?.particles ?? 1;
  const n = track.count;
  const group = new THREE.Group();
  const ringTex = ringTexture();
  const ringGeo = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
  const colGeo = new THREE.CylinderGeometry(0.55, 0.85, 1, 14, 1, true).translate(0, 0.5, 0);
  const hazards = [];

  for (const d of list) {
    const i = Math.round(d.f * n) % n;
    const c = track.centerline[i];
    const r = track.rights[i];
    const pos = new THREE.Vector3(c.x + r.x * (d.lateral ?? 0), c.y, c.z + r.z * (d.lateral ?? 0));
    const style = STYLE[d.type];
    const h = { d, style, index: i, pos, lateral: d.lateral ?? 0, radius: d.radius ?? 4.2, period: d.period ?? 8, offset: d.offset ?? 0, lastCycle: -1 };

    h.ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ map: ringTex, color: style.ring, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4, toneMapped: false }));
    h.ring.scale.setScalar(h.radius);
    h.ring.position.set(pos.x, pos.y + 0.06, pos.z);
    group.add(h.ring);

    if (d.type === 'geyser') {
      h.column = new THREE.Mesh(colGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(1.7, 0.42, 0.06), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }));
      h.column.position.copy(pos);
      h.column.visible = false;
      group.add(h.column);
    } else {
      h.rock = makeMeteor();
      h.rock.visible = false;
      group.add(h.rock);
    }
    hazards.push(h);
  }
  scene.add(group);

  // Bu kart bu döngüde zaten vuruldu mu (kart → hazard kimliği:döngü)
  const hitMemo = new Map();
  let time = 0;

  const phaseOf = (h, t) => {
    const x = t + h.offset;
    const cycle = Math.floor(x / h.period);
    return { c: x - cycle * h.period, cycle };
  };

  function burstEmbers(h, count, up, spread) {
    const k = Math.ceil(count * rate);
    for (let s = 0; s < k; s++) {
      const a = Math.random() * Math.PI * 2;
      const rr = Math.random() * h.radius * 0.6;
      const p = new THREE.Vector3(h.pos.x + Math.cos(a) * rr, h.pos.y + 0.3, h.pos.z + Math.sin(a) * rr);
      const v = new THREE.Vector3((Math.random() - 0.5) * spread, up * (0.6 + Math.random() * 0.7), (Math.random() - 0.5) * spread);
      fx.emitSpark(p, v, { life: 0.7 + Math.random() * 0.7, size: 0.4, sizeEnd: 0.06, color: Math.random() < 0.4 ? EMBER_HOT : EMBER });
      if (Math.random() < 0.5) fx.emitSmoke(p, v.clone().multiplyScalar(0.45), { life: 1.4 + Math.random(), size: 1.0, sizeEnd: 4.2, color: ASH, alpha: 0.55 });
    }
  }

  return {
    hazards,

    reset() {
      hitMemo.clear();
      for (const h of hazards) h.lastCycle = -1;
    },

    // clock: yarış saati (geri sayımda negatif). owned(kart): bu cihaz kartı sürüyor mu.
    update(clock, dt, karts, owned) {
      time = Math.max(0, clock);
      for (const h of hazards) {
        const { c, cycle } = phaseOf(h, time);
        const S = h.style;
        let ring = 0;
        let active = false; // isabet penceresi
        if (h.d.type === 'geyser') {
          const warnStart = h.period - S.warn - S.burst;
          const burstStart = h.period - S.burst;
          if (c >= burstStart) {
            const u = (c - burstStart) / S.burst;
            ring = 0.9;
            active = u < S.hit / S.burst;
            // Patlama: sütun önce hızla yükselir, sonra söner
            h.column.visible = true;
            const grow = Math.min(1, u * 5);
            h.column.scale.set(h.radius * 0.85, S.tall * grow, h.radius * 0.85);
            h.column.material.opacity = 0.5 * (1 - u * u);
            if (u < 0.85) burstEmbers(h, 6 * dt * 60 * (1 - u * 0.6), 16, 4);
            if (cycle !== h.lastCycle) {
              h.lastCycle = cycle;
              burstEmbers(h, 34, 20, 7);
            }
          } else {
            h.column.visible = false;
            if (c >= warnStart) {
              const u = (c - warnStart) / S.warn;
              ring = 0.35 + 0.5 * u + 0.25 * Math.sin(u * u * 50);
              h.ring.scale.setScalar(h.radius * (0.92 + 0.08 * Math.sin(u * 30)));
            } else ring = 0.16 + 0.05 * Math.sin(time * 2 + h.index); // sönmüş çatlak, hafif kızıl parıltı
          }
          if (!(c >= warnStart && c < burstStart)) h.ring.scale.setScalar(h.radius);
        } else {
          // Meteor: önce yere düşen uyarı halkası, sonra yukarıdan çarpma, ardından duman
          const fallStart = h.period - S.fall;
          const warnStart = fallStart - S.warn;
          h.rock.visible = false;
          if (c >= fallStart) {
            const u = (c - fallStart) / S.fall;
            ring = 0.9;
            h.ring.scale.setScalar(h.radius * (1.1 - 0.15 * u));
            h.rock.visible = true;
            const y = h.pos.y + 90 * (1 - u) * (1 - u) + 1;
            h.rock.position.set(h.pos.x - 28 * (1 - u), y, h.pos.z + 10 * (1 - u));
            h.rock.rotation.x += dt * 6;
            h.rock.rotation.z += dt * 4;
            const tail = new THREE.Vector3(h.rock.position.x, h.rock.position.y, h.rock.position.z);
            for (let s = 0; s < Math.ceil(3 * rate); s++) {
              fx.emitSpark(tail, new THREE.Vector3((Math.random() - 0.5) * 3 + 14, 6 + Math.random() * 4, (Math.random() - 0.5) * 3 - 5), { life: 0.5, size: 1.2, sizeEnd: 0.2, color: EMBER });
              fx.emitSmoke(tail, new THREE.Vector3(0, 1, 0), { life: 1.1, size: 1.4, sizeEnd: 4, color: DUST, alpha: 0.45 });
            }
          } else if (c >= warnStart) {
            const u = (c - warnStart) / S.warn;
            ring = 0.3 + 0.55 * u + 0.2 * Math.sin(u * u * 40);
            h.ring.scale.setScalar(h.radius * (1.25 - 0.15 * u));
          } else if (c < S.impact) {
            const u = c / S.impact;
            ring = 0.5 * (1 - u);
            h.ring.scale.setScalar(h.radius * (1 + u * 0.5));
            active = c < S.hit;
            if (cycle !== h.lastCycle) {
              h.lastCycle = cycle;
              burstEmbers(h, 30, 14, 12);
              for (let s = 0; s < Math.ceil(20 * rate); s++) {
                const a = Math.random() * Math.PI * 2;
                const p = new THREE.Vector3(h.pos.x, h.pos.y + 0.4, h.pos.z);
                fx.emitSmoke(p, new THREE.Vector3(Math.cos(a) * 9, 1 + Math.random() * 2, Math.sin(a) * 9), { life: 1.6, size: 1.2, sizeEnd: 5, color: DUST, alpha: 0.55 });
              }
            }
          } else ring = 0;
        }
        h.ring.material.opacity = Math.min(1, ring);

        // İsabet
        if (!active) continue;
        for (const kart of karts) {
          if (!kart.active || !owned(kart)) continue;
          const dx = kart.position.x - h.pos.x;
          const dz = kart.position.z - h.pos.z;
          if (dx * dx + dz * dz > h.radius * h.radius) continue;
          if (Math.abs(kart.position.y - h.pos.y) > 3.5) continue;
          const key = `${hazards.indexOf(h)}:${cycle}`;
          if (hitMemo.get(kart) === key) continue;
          hitMemo.set(kart, key);
          kart.velocity.y = Math.max(kart.velocity.y, h.d.type === 'geyser' ? 9 : 6);
          kart.grounded = false;
          kart.spinOut();
        }
      }
    },

    // Botlar için şerit: önündeki tehlikelerden ve kızgın zeminden kaçın (bazı botlar dikkatsiz)
    avoidLane(idx, lane, driver) {
      if (((driver?.phase ?? 0) % 1) < 0.25) return lane; // dikkatsiz bot
      const hw = track.def.halfWidth - 1.6;
      for (const h of hazards) {
        const ahead = (h.index - idx + n) % n;
        if (ahead > 28) continue;
        if (Math.abs(lane - h.lateral) < h.radius + 1.6) {
          const side = lane >= h.lateral ? 1 : -1;
          let target = h.lateral + side * (h.radius + 2);
          if (Math.abs(target) > hw) target = h.lateral - side * (h.radius + 2);
          lane = Math.max(-hw, Math.min(hw, target));
        }
      }
      for (const z of track.hotZones) {
        const ahead = (z.from - idx + n) % n;
        const inside = idx >= z.from && idx <= z.to;
        if (!inside && ahead > 26) continue;
        if (lane > z.l0 - 1.6 && lane < z.l1 + 1.6) {
          const left = z.l0 - 2.4;
          const right = z.l1 + 2.4;
          const canL = left >= -hw;
          const canR = right <= hw;
          if (canL && (!canR || lane - z.l0 < z.l1 - lane)) lane = left;
          else if (canR) lane = right;
        }
      }
      return lane;
    },

    // Kızgın zemin çatlaklarını nabız gibi parlat
    animate(t) {
      const k = 1.25 + 0.3 * Math.sin(t * 2.2);
      for (const m of track.hotMeshes) m.material.color.setRGB(1.6 * k, 1.3 * k, 1.1 * k);
    },

    dispose() {
      scene.remove(group);
      group.traverse((o) => {
        if (o.material && o.material.map !== ringTex) o.material.dispose?.();
      });
      ringGeo.dispose();
      colGeo.dispose();
      ringTex.dispose();
    },
  };
}

function makeMeteor() {
  if (hasModels(['space/meteor'])) {
    const m = normalizedModel('space/meteor');
    m.scale.setScalar(3.4);
    return m;
  }
  const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 1), new THREE.MeshStandardMaterial({ color: 0x4a4540, emissive: 0xff5a1a, emissiveIntensity: 0.9, flatShading: true }));
  return mesh;
}
