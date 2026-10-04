import * as THREE from 'three';
import { hasModels, cloneModel, normalizedModel } from './assets.js';

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
  // Oyuncak odasında yolu baştan başa kesen dev top: önce yolun üstünde çizgili uyarı şeridi yanıp söner
  ball: { ring: new THREE.Color(1.5, 0.35, 0.1), warn: 2.0, cross: 1.5 },
};

function stripeTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(255,255,255,0.22)';
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = 'rgba(255,255,255,0.95)';
  for (let k = -64; k < 128; k += 32) {
    g.beginPath();
    g.moveTo(k, 64);
    g.lineTo(k + 16, 64);
    g.lineTo(k + 16 + 64, 0);
    g.lineTo(k + 64, 0);
    g.closePath();
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// skin → GLB (public/models/hazard, tools/gen_hazards.py). Yüklü değilse aşağıdaki kodlu mesh yedek olarak çizilir.
// rolls: yuvarlanır (merkez orijinde, yarıçap ~1) | değilse zeminde sürüklenir (+X ileri). k: ballR başına ölçek
const HAZARD_MODEL = {
  beach: { key: 'hazard/hazard-beachball', k: 1, rolls: true },
  snow: { key: 'hazard/hazard-snowball', k: 1, rolls: true },
  rock: { key: 'hazard/hazard-rock', k: 0.95, rolls: true },
  lava: { key: 'hazard/hazard-lava-rock', k: 0.95, rolls: true },
  log: { key: 'hazard/hazard-log', k: 0.92, rolls: true },
  car: { key: 'hazard/hazard-taxi', k: 0.9 },
  ghost: { key: 'hazard/hazard-ghost', k: 0.8, float: 0.1 },
  crab: { key: 'hazard/hazard-crab', k: 0.6 }, // tools/gen_crab.py; yan yürür (gövde X'te geniş), yavaşlatır
};
export const hazardModelKeys = (def) => [...new Set((def.hazards ?? []).filter((h) => h.type === 'ball').map((h) => HAZARD_MODEL[h.skin ?? 'beach']?.key).filter(Boolean))];

function makeModelBall(radius, spec, skin) {
  const wrap = new THREE.Group();
  if (spec.rolls) {
    const mesh = cloneModel(spec.key).scene;
    mesh.scale.setScalar(radius * spec.k);
    wrap.add(mesh);
    wrap.userData.roller = mesh;
    return wrap;
  }
  const m = normalizedModel(spec.key);
  m.scale.setScalar(radius * spec.k);
  m.position.y = -radius * (1 - (spec.float ?? 0)); // top merkezi yerden radius yukarıda; model zemine otursun
  if (skin === 'ghost') {
    m.traverse((o) => {
      if (!o.isMesh) return;
      o.material = o.material.clone();
      Object.assign(o.material, { transparent: true, opacity: 0.88, emissive: new THREE.Color(0x88b4ff), emissiveIntensity: 0.55 });
    });
  }
  wrap.add(m);
  wrap.userData.roller = new THREE.Group(); // yuvarlanmaz
  return wrap;
}

// Yolu kesen yuvarlanan nesne. skin: 'beach' (dev plaj topu) | 'snow' (çığ topu) | 'rock' (kaya) | 'lava' (lav kayası) | 'log' (kütük) | 'car' (taksi) | 'ghost'
// Dönüş: yaw dönen sarmalayıcı grup; userData.roller yuvarlanma eksenindeki (yerel z) iç mesh
function makeBall(radius, skin = 'beach') {
  const spec = HAZARD_MODEL[skin];
  if (spec && hasModels([spec.key])) return makeModelBall(radius, spec, skin);
  const wrap = new THREE.Group();
  let mesh;
  if (skin === 'log') {
    const g = new THREE.CylinderGeometry(radius * 0.62, radius * 0.62, radius * 2.6, 14);
    g.rotateX(Math.PI / 2); // eksen yerel z
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 64;
    const x = c.getContext('2d');
    x.fillStyle = '#7a4e2c';
    x.fillRect(0, 0, 128, 64);
    x.fillStyle = '#5b381d';
    for (let i = 0; i < 18; i++) x.fillRect(Math.random() * 128, 0, 3, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
  } else if (skin === 'car') {
    const car = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(radius * 2.6, radius * 0.7, radius * 1.3), new THREE.MeshStandardMaterial({ color: 0xe23b36, roughness: 0.5 }));
    body.position.y = radius * 0.2;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(radius * 1.2, radius * 0.6, radius * 1.15), new THREE.MeshStandardMaterial({ color: 0x9fd3ff, roughness: 0.2, metalness: 0.2 }));
    cabin.position.set(-radius * 0.1, radius * 0.75, 0);
    const light = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.2, 1.4), toneMapped: false });
    for (const sz of [-1, 1]) {
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.2, radius * 0.22, radius * 0.28), light);
      h.position.set(radius * 1.31, radius * 0.25, sz * radius * 0.42);
      car.add(h);
    }
    car.add(body, cabin);
    car.position.y = -radius * 0.2;
    car.traverse((o) => (o.castShadow = true));
    wrap.add(car);
    wrap.userData.roller = new THREE.Group(); // araba yuvarlanmaz
    return wrap;
  } else if (skin === 'ghost') {
    // Hayalet: parlayan yarı saydam gövde, kuyruk ve siyah gözler; yuvarlanmaz, süzülür
    const ghost = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0xeaf6ff, emissive: 0x88b4ff, emissiveIntensity: 0.7, transparent: true, opacity: 0.88, roughness: 0.4 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.85, 18, 12), mat);
    body.scale.set(1, 1.15, 1);
    body.position.y = radius * 0.9;
    const tail = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.85, radius * 1.6, 14, 1, true), mat);
    tail.position.y = radius * 0.1;
    tail.rotation.x = Math.PI;
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0b0b18 });
    for (const sz of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.13, 8, 6), eyeMat);
      eye.position.set(radius * 0.72, radius * 1.05, sz * radius * 0.3);
      ghost.add(eye);
    }
    ghost.add(body, tail);
    ghost.position.y = -radius * 0.35;
    wrap.add(ghost);
    wrap.userData.roller = new THREE.Group();
    return wrap;
  } else if (skin === 'rock' || skin === 'lava') {
    const g = new THREE.IcosahedronGeometry(radius, 1);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setXYZ(i, pos.getX(i) * (0.88 + 0.24 * Math.sin(i * 7.3)), pos.getY(i) * (0.88 + 0.24 * Math.cos(i * 5.1)), pos.getZ(i) * (0.88 + 0.24 * Math.sin(i * 3.7)));
    g.computeVertexNormals();
    mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x6a5a52, emissive: 0x5c1606, emissiveIntensity: 0.45, flatShading: true, roughness: 1 }));
  } else if (skin === 'snow') {
    mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 1), new THREE.MeshStandardMaterial({ color: 0xf4f9ff, flatShading: true, roughness: 0.9 }));
  } else {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 128;
    const g = c.getContext('2d');
    const cols = ['#ff4b4b', '#ffffff', '#ffd23f', '#ffffff', '#3f8cff', '#ffffff'];
    cols.forEach((col, i) => {
      g.fillStyle = col;
      g.fillRect((i * 256) / cols.length, 0, 256 / cols.length + 1, 128);
    });
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 16), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45 }));
  }
  mesh.castShadow = true;
  wrap.add(mesh);
  wrap.userData.roller = mesh;
  return wrap;
}

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
  const stripeTex = stripeTexture();
  const ringGeo = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
  const colGeo = new THREE.CylinderGeometry(0.55, 0.85, 1, 14, 1, true).translate(0, 0.5, 0);
  const hazards = [];

  for (const d of list) {
    const i = Math.round(d.f * n) % n;
    const c = track.centerline[i];
    const r = track.rights[i];
    const pos = new THREE.Vector3(c.x + r.x * (d.lateral ?? 0), c.y + (d.lateral ?? 0) * (track.rolls[i] ?? 0), c.z + r.z * (d.lateral ?? 0));
    const style = STYLE[d.type];
    const h = { d, style, index: i, pos, lateral: d.lateral ?? 0, ballPos: new THREE.Vector3(), radius: d.radius ?? 4.2, period: d.period ?? 8, offset: d.offset ?? 0, lastCycle: -1 };

    h.ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ map: d.type === 'ball' ? stripeTex : ringTex, color: style.ring, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4, toneMapped: false }));
    // Renk paleti (şeker diyarında pembe, lunaparkta konfeti): d.colors = { ring, column, ember, hot, smoke } (r,g,b dizileri)
    if (d.colors) {
      const C = (a) => (a ? new THREE.Color(...a) : null);
      h.pal = { ring: C(d.colors.ring), column: C(d.colors.column), ember: C(d.colors.ember), hot: C(d.colors.hot), smoke: C(d.colors.smoke) };
      if (h.pal.ring) h.ring.material.color.copy(h.pal.ring);
    }
    h.ring.scale.setScalar(h.radius);
    h.ring.position.set(pos.x, pos.y + 0.06, pos.z);
    group.add(h.ring);

    if (d.type === 'ball') {
      // Top yolun sağ vektörü boyunca bir yandan öbür yana yuvarlanır
      h.right = track.rights[i];
      h.span = track.def.halfWidth + (d.overshoot ?? 8);
      h.dir = d.dir ?? 1;
      h.ballR = d.ballRadius ?? 2.6;
      h.radius = h.ballR + 0.9; // isabet yarıçapı
      const rot = Math.atan2(-h.right.z, h.right.x);
      h.ring.rotation.y = rot;
      h.ring.scale.set(h.span, 1, 2.6);
      h.ring.material.map.repeat.set(h.span / 2.2, 1.4);
      h.ball = makeBall(h.ballR, d.skin ?? 'beach');
      h.roller = h.ball.userData.roller;
      h.ball.visible = false;
      group.add(h.ball);
    } else if (d.type === 'geyser') {
      h.column = new THREE.Mesh(colGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(1.7, 0.42, 0.06), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }));
      if (h.pal?.column) h.column.material.color.copy(h.pal.column);
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
      fx.emitSpark(p, v, { life: 0.7 + Math.random() * 0.7, size: 0.4, sizeEnd: 0.06, color: Math.random() < 0.4 ? (h.pal?.hot ?? EMBER_HOT) : (h.pal?.ember ?? EMBER) });
      if (Math.random() < 0.5) fx.emitSmoke(p, v.clone().multiplyScalar(0.45), { life: 1.4 + Math.random(), size: 1.0, sizeEnd: 4.2, color: h.pal?.smoke ?? ASH, alpha: 0.55 });
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
        } else if (h.d.type === 'ball') {
          const cross = h.d.cross ?? S.cross; // geçiş süresi (yengeç yavaş yürür)
          const crossStart = h.period - cross;
          const warnStart = crossStart - S.warn;
          h.ball.visible = false;
          if (c >= crossStart) {
            const u = (c - crossStart) / cross;
            ring = 0.35;
            const lat = h.dir * (-h.span + 2 * h.span * u);
            h.ballPos.set(h.pos.x - h.lateral * h.right.x + h.right.x * lat, h.pos.y, h.pos.z - h.lateral * h.right.z + h.right.z * lat);
            h.ball.visible = true;
            h.ball.position.set(h.ballPos.x, h.ballPos.y + h.ballR, h.ballPos.z);
            h.roller.rotation.z = -lat / h.ballR;
            h.ball.rotation.y = Math.atan2(-h.right.z, h.right.x) + ((h.d.skin === 'car' || h.d.skin === 'ghost') && h.dir < 0 ? Math.PI : 0);
            if (h.d.skin === 'crab') {
              // Yan yürüyüş: küçük sekme ve sallanma
              const w = Math.sin(lat * 2.2);
              h.ball.position.y += Math.abs(w) * 0.18;
              h.ball.rotation.z = w * 0.07;
            }
            active = true;
          } else if (c >= warnStart) {
            const k = (c - warnStart) / S.warn;
            ring = 0.25 + 0.6 * k + 0.25 * Math.sin(k * k * 60);
          } else ring = 0;
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
          const hp = h.d.type === 'ball' ? h.ballPos : h.pos;
          const dx = kart.position.x - hp.x;
          const dz = kart.position.z - hp.z;
          if (dx * dx + dz * dz > h.radius * h.radius) continue;
          if (Math.abs(kart.position.y - h.pos.y) > 3.5) continue;
          const key = `${hazards.indexOf(h)}:${cycle}`;
          if (hitMemo.get(kart) === key) continue;
          hitMemo.set(kart, key);
          if (h.d.skin === 'crab') {
            // Yengeç: savurmaz, sadece yavaşlatır ve hafifçe sektirir
            kart.velocity.y = Math.max(kart.velocity.y, 4);
            kart.grounded = false;
            kart.speed *= 0.45;
            kart.velocity.x *= 0.45;
            kart.velocity.z *= 0.45;
            kart.events.push('bounce');
            continue;
          }
          kart.velocity.y = Math.max(kart.velocity.y, h.d.type === 'geyser' ? 9 : h.d.type === 'ball' ? 7 : 6);
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
        if (h.d.type === 'ball') continue; // top yolu baştan başa keser, şerit değiştirmek kurtarmaz
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
