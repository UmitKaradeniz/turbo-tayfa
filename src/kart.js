import * as THREE from 'three';
import { KART, SLOPE } from './config.js';
import { createKartModel } from './kartModel.js';
import { defaultVehicleFor } from './vehicles.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Far ışığı süzmesi (gece/gün batımı pistleri): iki hafif koni, ucu karta yakın parlak, uzağa doğru sönük. Tek mesh, ortak geometri.
let _beamGeo = null;
const _beamMats = new Map();
function beamGeometry() {
  if (_beamGeo) return _beamGeo;
  const L = 13;
  const cones = [-0.6, 0.6].map((x) => {
    const g = new THREE.ConeGeometry(1.7, L, 14, 1, true).translate(0, -L / 2, 0); // tepe orijinde, taban -Y'de
    const pos = g.attributes.position;
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const t = Math.min(1, -pos.getY(i) / L);
      const k = (1 - t) * (1 - t);
      col.set([k * 1.0, k * 0.92, k * 0.62], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g.rotateX(-Math.PI / 2 + 0.05).translate(x, 0.55, 1.3); // +Z'ye bak, hafif aşağı; ön lamba konumu
  });
  _beamGeo = mergeGeometries(cones);
  return _beamGeo;
}
const beamMaterial = (k) => {
  if (!_beamMats.has(k)) _beamMats.set(k, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.11 * k, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  return _beamMats.get(k);
};

// Arcade kart fiziği. Gerçek bir fizik motoru yok: hız vektörü, yön açısı
// ve pistten sorgulanan zemin yüksekliği yeterli. heading = 0 iken kart +Z yönüne bakar.

const UP = new THREE.Vector3(0, 1, 0);
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _q = new THREE.Quaternion();
const SPIN_INPUT = { throttle: 0, brake: 0, steer: 0, drift: false };
const _qYaw = new THREE.Quaternion();
const _probe = new THREE.Vector3();

// Drift kademesi: kıvılcım rengi ve mini-turbo süresi buna göre (0 = yok)
// Hızı kısan zeminler (hız oranı yüzeyden gelir; yoksa varsayılan)
const AIR_BOOST_MIN = 0.7; // s: bu kadar havada kalınca iniş turbosu
const SLOW_SURFACES = new Set(['sand', 'dirt', 'hot', 'mud', 'water', 'honey', 'carpet', 'snowdrift']);

// Eğime (grade, + yokuş) göre hız sınırı çarpanı
export function slopeSpeedMul(grade) {
  return grade >= 0 ? Math.max(SLOPE.upMin, 1 - grade * SLOPE.upLoss) : Math.min(SLOPE.downMax, 1 - grade * SLOPE.downGain);
}

export function driftLevel(driftTime) {
  if (driftTime > KART.miniTurbo[2].after) return 3;
  if (driftTime > KART.miniTurbo[1].after) return 2;
  if (driftTime > KART.miniTurbo[0].after) return 1;
  return 0;
}

export class Kart {
  constructor(character) {
    this.character = character;
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.heading = 0;
    this.steer = 0; // yumuşatılmış direksiyon (-1..1)
    this.speed = 0; // ileri yöndeki hız (geri giderken negatif)
    this.grounded = true;
    this.groundNormal = UP.clone();
    this.surface = 'road';
    this.surfaceSpeed = null; // kısayolun kendi yüzey hız çarpanı (yoksa null)
    this.surfaceGrip = 1; // buzlu zeminde < 1: kart kayar
    this.grade = 0; // baktığı yöndeki eğim (+ yokuş, - iniş), yumuşatılmış
    this.crestCool = 0; // tepe atlayışından sonra yeniden havalanmayı engelleyen bekleme
    this.trackIndex = -1; // en yakın orta çizgi örneği (arama ipucu)
    this.pathIndex = -1; // yarış ilerlemesi için örnek (kısayolda sanal, bkz. track.groundAt)
    this.onShortcut = false;
    this.fallTime = 0; // atlama çukuruna düştükten beri geçen süre
    this.drifting = false;
    this.driftDir = 0;
    this.driftTime = 0; // mini-turbo kademesi için
    this.wallNormal = null;
    this.boostTime = 0; // turbo (item, mini-turbo, başlangıç)
    this.spinTime = 0; // isabet sonrası savrulma
    this.shieldTime = 0; // balon kalkan
    this.events = []; // 'miniTurbo', 'hit', 'blocked' … (ses/efekt için, her karede boşaltılır)

    // Görsel interpolasyon için bir önceki fizik adımı
    this.prevPosition = new THREE.Vector3();
    this.prevHeading = 0;

    this.wheelSpin = 0;
    this.visualTilt = new THREE.Quaternion();
    this.visualDriftYaw = 0;

    this.airTime = 0; // havada geçen süre (def.airBoost pistlerinde uzun uçuş inişte turbo verir)
    this.bodyOverride = null;
    this.vehicle = defaultVehicleFor(character);
    this.stats = this.vehicle.stats; // araç sınıfı çarpanları (bkz. vehicles.js)
    this.model = createKartModel(character, this.vehicle.body);
    this.object = this.model.root;
  }

  setVehicle(vehicle) {
    if (!vehicle || vehicle === this.vehicle) return;
    this.vehicle = vehicle;
    this.stats = vehicle.stats;
    this.model.setBody(this.bodyOverride ?? vehicle.body);
  }

  // Pistin özel kart gövdesi (örn. Ay Yolu): seçilen araç sınıfının görünümünü geçersiz kılar, istatistikler kalır
  setBodyOverride(path) {
    this.bodyOverride = path ?? null;
    this.model.setBody(this.bodyOverride ?? this.vehicle.body);
  }

  // Far ışığı süzmesi: k = şiddet çarpanı (0 kapalı)
  setBeams(k) {
    if (!k) {
      if (this.beams) this.beams.visible = false;
      return;
    }
    if (!this.beams) {
      this.beams = new THREE.Mesh(beamGeometry(), beamMaterial(k));
      this.beams.frustumCulled = false;
      this.beams.renderOrder = 3;
      this.object.add(this.beams);
    }
    this.beams.material = beamMaterial(k);
    this.beams.visible = true;
  }

  reset(position, heading) {
    this.position.copy(position);
    this.prevPosition.copy(position);
    this.heading = this.prevHeading = heading;
    this.velocity.set(0, 0, 0);
    this.speed = 0;
    this.steer = 0;
    this.drifting = false;
    this.trackIndex = -1;
    this.pathIndex = -1;
    this.onShortcut = false;
    this.fallTime = 0;
    this.grade = 0;
    this.crestCool = 0;
    this.airTime = 0;
    this.boostTime = this.spinTime = this.shieldTime = 0;
  }

  boost(seconds) {
    this.boostTime = Math.max(this.boostTime, seconds);
  }

  // İsabet: kalkan varsa onu patlatır, yoksa kart savrulur. Sonucu döner.
  spinOut() {
    if (this.shieldTime > 0) {
      this.shieldTime = 0;
      this.events.push('blocked');
      return 'blocked';
    }
    if (this.spinTime > 0) return 'already';
    this.spinTime = KART.spinDuration;
    this.drifting = false;
    this.boostTime = 0;
    this.velocity.multiplyScalar(0.35);
    this.events.push('hit');
    return 'hit';
  }

  // Sabit adımlı fizik güncellemesi. Çarpışma şiddetini döner (kamera sarsıntısı için).
  step(dt, input, track) {
    this.prevPosition.copy(this.position);
    this.prevHeading = this.heading;
    this.crestCool = Math.max(0, this.crestCool - dt);
    this.airTime = this.grounded ? 0 : this.airTime + dt;

    // Savrulurken kontrol yok
    if (this.spinTime > 0) {
      this.spinTime = Math.max(0, this.spinTime - dt);
      input = SPIN_INPUT;
    }
    this.shieldTime = Math.max(0, this.shieldTime - dt);
    this.boostTime = Math.max(0, this.boostTime - dt);

    // Direksiyon: dijital girdiyi yumuşat
    this.steer += (input.steer - this.steer) * Math.min(1, KART.steerResponse * dt);

    const control = this.grounded ? 1 : KART.airControl;

    // Drift başlat / bitir
    if (input.drift && !this.drifting && this.grounded && this.speed > KART.driftMinSpeed && Math.abs(input.steer) > 0) {
      this.drifting = true;
      this.driftDir = Math.sign(input.steer);
      this.driftTime = 0;
    }
    if (this.drifting && (!input.drift || this.speed < KART.driftMinSpeed * 0.6)) {
      // Drift bilerek bırakıldıysa kademeye göre mini-turbo
      const level = !input.drift && this.grounded ? driftLevel(this.driftTime) : 0;
      if (level > 0) {
        this.boost(KART.miniTurbo[level - 1].boost);
        this.events.push('miniTurbo' + level);
      } else if (!input.drift && this.grounded && this.driftTime > 0.25) {
        this.events.push('driftShort'); // çok kısa bırakıldı: nitro yok (oyuncuya ipucu için)
      }
      this.drifting = false;
      this.driftDir = 0;
    }
    if (this.drifting) this.driftTime += dt;

    // Dönüş
    let turn = this.steer;
    if (this.drifting) {
      // Drift sırasında kart hep drift yönüne döner; direksiyon sadece keskinliği ayarlar
      const t = (this.steer * this.driftDir + 1) / 2; // 0: karşı yön, 1: drift yönü
      turn = this.driftDir * THREE.MathUtils.lerp(KART.driftTurnMin, KART.driftTurnMax, t);
    }
    const absSpeed = Math.abs(this.speed);
    // Gaza/frene basarken çok düşük hızda da biraz dönebilsin (duvardan kurtulmak için)
    const pedal = input.throttle > 0 || input.brake > 0;
    const lowSpeedFactor = Math.max(pedal ? KART.minSteer : 0, Math.min(1, absSpeed / KART.steerFullSpeed));
    const highSpeedFactor = THREE.MathUtils.lerp(1, KART.highSpeedSteer, Math.min(1, absSpeed / KART.maxSpeed));
    const direction = this.speed >= 0 ? 1 : -1;
    this.heading += turn * KART.steerRate * this.stats.handling * lowSpeedFactor * highSpeedFactor * direction * control * dt;

    // Hızı yeni yöne göre ileri ve yan bileşenlere ayır
    _fwd.set(Math.sin(this.heading), 0, Math.cos(this.heading));
    _right.set(-Math.cos(this.heading), 0, Math.sin(this.heading));
    let forward = this.velocity.x * _fwd.x + this.velocity.z * _fwd.z;
    let lateral = this.velocity.x * _right.x + this.velocity.z * _right.z;

    // Kumda en yüksek hız düşer
    // Turbo varken kum yavaşlatmaz
    const offroad = SLOW_SURFACES.has(this.surface);
    const boosting = this.boostTime > 0;
    const topSpeed = KART.maxSpeed * this.stats.speed;
    let maxSpeed = boosting ? topSpeed * KART.boostSpeed : offroad ? topSpeed * (this.surfaceSpeed ?? (this.surface === 'dirt' ? KART.dirtSpeed : KART.offroadSpeed)) : topSpeed;

    // Eğim: yokuşta hız sınırı düşer ve kart geri çekilir; inişte sınır aşılır
    const n = this.groundNormal;
    const grade = this.grounded ? -(n.x * _fwd.x + n.z * _fwd.z) / Math.max(0.3, n.y) : 0;
    this.grade += (grade - this.grade) * Math.min(1, 8 * dt);
    maxSpeed *= slopeSpeedMul(this.grade);

    // İleri/geri ivme
    if (this.grounded) {
      if (input.throttle > 0 && forward >= -0.5) {
        if (forward < maxSpeed) forward = Math.min(maxSpeed, forward + KART.accel * this.stats.accel * input.throttle * dt);
      } else if (input.brake > 0 && forward > 0.5) {
        forward -= KART.brake * input.brake * dt;
      } else if (input.brake > 0) {
        forward -= KART.reverseAccel * input.brake * dt;
      } else if (input.throttle > 0) {
        forward += KART.brake * dt; // geri giderken gaz = fren
      } else {
        const drag = KART.coastDrag * (this.surface === 'sand' ? 2 : 1) * dt;
        forward = Math.abs(forward) <= drag ? 0 : forward - Math.sign(forward) * drag;
      }
      if (boosting && forward < maxSpeed) forward = Math.min(maxSpeed, forward + KART.boostAccel * dt);
      forward -= this.grade * SLOPE.gravityPull * (track.def?.gravity ?? 1) * dt; // Ay'da çekim zayıf
      // Hız sınırının üstündeyse (kuma girince, turbo bitince) yumuşakça yavaşla
      if (forward > maxSpeed) forward = Math.max(maxSpeed, forward - KART.offroadDrag * dt);
      forward = Math.max(forward, -KART.maxReverse);

      // Yan kaymayı sönümle (drift'te daha az). Sönen yan hızın çoğu ileri hıza
      // aktarılır; böylece virajda ve drift'te kart hızını kaybetmez (arcade hissi).
      const before = lateral;
      lateral *= Math.exp(-(this.drifting ? KART.driftGrip : KART.grip) * (1 + (this.stats.handling - 1) * 0.5) * this.surfaceGrip * dt);
      if (forward > 0) {
        const gained = (before * before - lateral * lateral) * KART.slideKeep;
        forward = Math.min(Math.max(maxSpeed, forward), Math.sqrt(forward * forward + gained));
      }
    }

    const vy = this.velocity.y - KART.gravity * (track.def?.gravity ?? 1) * dt; // Ay pistinde daha hafif
    this.velocity.set(_fwd.x * forward + _right.x * lateral, vy, _fwd.z * forward + _right.z * lateral);
    this.position.addScaledVector(this.velocity, dt);

    // Pist sınırı (bariyerler)
    let impact = 0;
    this.wallNormal = track.constrain(this.position, KART.radius, this.trackIndex);
    const normal = this.wallNormal;
    if (normal) {
      const vn = this.velocity.dot(normal);
      if (vn < 0) {
        this.velocity.addScaledVector(normal, -vn * (1 + KART.wallBounce));
        this.velocity.multiplyScalar(1 - KART.wallSpeedLoss * Math.min(1, -vn / KART.maxSpeed));
        impact = -vn;
        if (impact > 6) this.drifting = false;
      }
      // Burnu duvara dönükse kartı duvar boyunca hizala (duvarda takılmayı önler)
      _fwd.set(Math.sin(this.heading), 0, Math.cos(this.heading));
      if (_fwd.dot(normal) < 0) {
        const s = _fwd.x * normal.z - _fwd.z * normal.x >= 0 ? 1 : -1;
        const target = Math.atan2(normal.z * s, -normal.x * s);
        const d = Math.atan2(Math.sin(target - this.heading), Math.cos(target - this.heading));
        this.heading += d * 0.15;
      }
    }

    // Zemin
    this.updateGround(track);

    _fwd.set(Math.sin(this.heading), 0, Math.cos(this.heading));
    this.speed = this.velocity.x * _fwd.x + this.velocity.z * _fwd.z;
    return impact;
  }

  updateGround(track) {
    // Tepe/tümsek: yol, serbest düşüşten hızlı alçalıyorsa (dikey ivme < -g * crestG) kart havalanır.
    // Yolun yüksekliği kartın önünde ve arkasında örneklenir (groundAt ortak nesne döndürdüğü için asıl sorgudan önce).
    let lift = -1;
    if (this.grounded && this.crestCool <= 0 && this.speed > 12) {
      const d = Math.max(4, this.speed * 0.15);
      const fx = Math.sin(this.heading) * d;
      const fz = Math.cos(this.heading) * d;
      const y0 = track.groundAt(_probe.set(this.position.x, 0, this.position.z), this.trackIndex).y;
      const yF = track.groundAt(_probe.set(this.position.x + fx, 0, this.position.z + fz), this.trackIndex).y;
      const yB = track.groundAt(_probe.set(this.position.x - fx, 0, this.position.z - fz), this.trackIndex).y;
      const accel = ((yF - 2 * y0 + yB) / (d * d)) * this.speed * this.speed;
      if (accel < -KART.gravity * (track.def?.gravity ?? 1) * SLOPE.crestG) lift = Math.max(0, ((yF - yB) / (2 * d)) * this.speed) + SLOPE.crestHop * Math.min(1, this.speed / 25); // eğri yalnız yüzeyden ayrılmaya yetmez: arcade zıplama payı
    }
    const g = track.groundAt(this.position, this.trackIndex);
    this.trackIndex = g.index;
    this.pathIndex = g.pathIndex;
    this.onShortcut = g.shortcut;
    const snap = this.grounded ? KART.snapDistance : 0.01;
    const crest = lift >= 0 && !g.ramp && !g.bounce;
    // Zeminin altına girdiyse (rampa yukarı çıkarken) her durumda yüzeye oturt
    if (crest) {
      this.position.y = g.y;
      this.velocity.y = lift;
      this.grounded = false;
      this.crestCool = 0.6;
      this.events.push('crest');
    } else if (this.position.y <= g.y + snap && (this.velocity.y <= 0.5 || this.position.y < g.y)) {
      this.position.y = g.y;
      const air = this.grounded ? 0 : this.airTime;
      this.airTime = 0;
      // Rampada dikey hız korunur: rampanın ucundan kart eğim kadar yukarı fırlar
      this.velocity.y = g.ramp ? Math.max(0, g.ramp.slope * (this.velocity.x * g.ramp.tx + this.velocity.z * g.ramp.tz)) : 0;
      this.grounded = true;
      this.groundNormal.copy(g.normal);
      this.surface = g.surface;
      this.surfaceSpeed = g.speed ?? null;
      this.surfaceGrip = g.grip ?? 1;
      if (g.bounce) {
        // Trambolin: kart havaya fırlar
        this.velocity.y = g.bounce;
        this.grounded = false;
        this.events.push('bounce');
      }
      // Uzun uçuştan sonra iniş: turbo (savrulan karta yok; yalnız def.airBoost pistleri)
      if (air > AIR_BOOST_MIN && this.spinTime <= 0 && !g.bounce && track.def?.airBoost) {
        this.boost(Math.min(1.2, 0.5 + (air - AIR_BOOST_MIN) * 0.9));
        this.events.push('airBoost');
      }
      if (g.pad) {
        if (this.boostTime < 0.3) this.events.push('pad');
        this.boost(g.pad.boost);
      }
    } else {
      this.grounded = false;
    }
  }

  // Görseli iki fizik adımı arasında interpole ederek güncelle (her karede)
  updateVisual(alpha, dt) {
    const o = this.object;
    o.position.lerpVectors(this.prevPosition, this.position, alpha);
    const heading = lerpAngle(this.prevHeading, this.heading, alpha);

    // Zemin eğimine hizala
    _q.setFromUnitVectors(UP, this.grounded ? this.groundNormal : UP);
    this.visualTilt.slerp(_q, 1 - Math.exp(-10 * dt));
    _qYaw.setFromAxisAngle(UP, heading);
    o.quaternion.copy(this.visualTilt).multiply(_qYaw);

    const { body, steerWheels, wheels, wheelRadius } = this.model;

    // Drift'te gövde dönüş yönüne biraz daha açılır; virajda dışa yatar
    const targetDriftYaw = this.drifting ? this.driftDir * 0.38 : 0;
    this.visualDriftYaw += (targetDriftYaw - this.visualDriftYaw) * (1 - Math.exp(-8 * dt));
    // Savrulma: gövde iki tur döner
    const spin = this.spinTime > 0 ? (1 - this.spinTime / KART.spinDuration) * Math.PI * 4 : 0;
    const speedRatio = Math.min(1, Math.abs(this.speed) / KART.maxSpeed);
    // Kumda hafif titreme
    const bump = (this.surface === 'sand' || this.surface === 'dirt') && this.grounded ? Math.sin(performance.now() * 0.05) * 0.015 * speedRatio : 0;
    body.rotation.set(bump, this.visualDriftYaw + spin, -this.steer * 0.07 * speedRatio - this.visualDriftYaw * 0.15);

    for (const w of steerWheels) w.rotation.y = this.steer * 0.45;
    this.wheelSpin += (this.speed * dt) / wheelRadius;
    for (const w of wheels) w.rotation.x = this.wheelSpin;

    this.model.update(dt);
  }
}

// Kartlar birbirinin içinden geçmesin: daireler gibi it, hızları normal boyunca paylaştır.
// movable(kart) false ise (ağdan gelen uzak kart) o kart itilmez, diğeri tamamen itilir.
export function resolveKartCollisions(karts, onHit, movable = () => true) {
  const minDist = KART.radius * 2;
  for (let i = 0; i < karts.length; i++) {
    for (let j = i + 1; j < karts.length; j++) {
      const a = karts[i];
      const b = karts[j];
      const dx = b.position.x - a.position.x;
      const dz = b.position.z - a.position.z;
      const d2 = dx * dx + dz * dz;
      if (d2 >= minDist * minDist || d2 < 1e-6) continue;
      if (Math.abs(b.position.y - a.position.y) > 1.5) continue;
      const ma = movable(a);
      const mb = movable(b);
      if (!ma && !mb) continue;
      const d = Math.sqrt(d2);
      const nx = dx / d;
      const nz = dz / d;
      // İtme payı: ikisi de hareketliyse yarı yarıya, değilse hepsi hareketli olana
      const wa = ma && mb ? (b.stats?.weight ?? 1) / ((a.stats?.weight ?? 1) + (b.stats?.weight ?? 1)) : ma ? 1 : 0; // ağır kart daha az itilir
      const wb = 1 - wa;
      const overlap = minDist - d;
      a.position.x -= nx * overlap * wa;
      a.position.z -= nz * overlap * wa;
      b.position.x += nx * overlap * wb;
      b.position.z += nz * overlap * wb;
      // Birbirine yaklaşıyorlarsa normal yöndeki hızları değiş tokuş et (hafif esnek)
      const rel = (b.velocity.x - a.velocity.x) * nx + (b.velocity.z - a.velocity.z) * nz;
      if (rel < 0) {
        const k = -rel * 1.2;
        a.velocity.x -= nx * k * wa;
        a.velocity.z -= nz * k * wa;
        b.velocity.x += nx * k * wb;
        b.velocity.z += nz * k * wb;
        onHit?.(a, b, -rel);
      }
    }
  }
}

function lerpAngle(a, b, t) {
  let d = b - a;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  return a + d * t;
}
