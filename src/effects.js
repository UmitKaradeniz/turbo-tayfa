import * as THREE from 'three';
import { driftLevel } from './kart.js';

// Basit parçacık sistemi: tek bir THREE.Points, sabit havuz, CPU'da güncelleme.

export class Particles {
  constructor(max, { additive = false, gravity = 0, drag = 1.5, sharp = false } = {}) {
    this.max = max;
    this.gravity = gravity;
    this.drag = drag;
    this.next = 0;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.alpha = new Float32Array(max);
    this.size = new Float32Array(max);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.size0 = new Float32Array(max);
    this.size1 = new Float32Array(max);
    this.alpha0 = new Float32Array(max);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);

    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { scale: { value: 500 } },
      vertexShader: /* glsl */ `
        attribute float size; attribute float alpha; attribute vec3 color;
        uniform float scale;
        varying float vAlpha; varying vec3 vColor;
        void main() {
          vAlpha = alpha; vColor = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * scale / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying float vAlpha; varying vec3 vColor;
        void main() {
          float d = length(gl_PointCoord - 0.5) * 2.0;
          float a = ${sharp ? 'pow(max(1.0 - d, 0.0), 2.0)' : 'smoothstep(1.0, 0.2, d)'};
          if (a * vAlpha < 0.01) discard;
          gl_FragColor = vec4(vColor, a * vAlpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 2;
  }

  emit(p, v, { life = 1, size = 1, sizeEnd = size, color, alpha = 1 }) {
    const i = this.next;
    this.next = (this.next + 1) % this.max;
    this.pos.set([p.x, p.y, p.z], i * 3);
    this.vel.set([v.x, v.y, v.z], i * 3);
    this.col.set([color.r, color.g, color.b], i * 3);
    this.life[i] = this.maxLife[i] = life;
    this.size0[i] = size;
    this.size1[i] = sizeEnd;
    this.alpha0[i] = alpha;
  }

  update(dt, camera, viewportHeight) {
    this.material.uniforms.scale.value = viewportHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    const damp = Math.exp(-this.drag * dt);
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) {
        this.alpha[i] = 0;
        continue;
      }
      this.life[i] -= dt;
      const t = 1 - Math.max(0, this.life[i]) / this.maxLife[i];
      const k = i * 3;
      this.vel[k] *= damp;
      this.vel[k + 1] = this.vel[k + 1] * damp - this.gravity * dt;
      this.vel[k + 2] *= damp;
      this.pos[k] += this.vel[k] * dt;
      this.pos[k + 1] += this.vel[k + 1] * dt;
      this.pos[k + 2] += this.vel[k + 2] * dt;
      this.size[i] = this.size0[i] + (this.size1[i] - this.size0[i]) * t;
      this.alpha[i] = this.alpha0[i] * (1 - t) * Math.min(1, t * 8);
    }
    const a = this.points.geometry.attributes;
    a.position.needsUpdate = a.color.needsUpdate = a.alpha.needsUpdate = a.size.needsUpdate = true;
  }
}

// Kartlara bağlı efektler: drift dumanı + kıvılcımı, kum tozu, duvar kıvılcımı
const SPARK_COLORS = [
  new THREE.Color(0.5, 0.8, 3.0), // mavi
  new THREE.Color(3.0, 1.4, 0.3), // turuncu
  new THREE.Color(2.2, 0.6, 3.0), // mor
];
const SMOKE = new THREE.Color(0.95, 0.95, 0.97);
const DUST = new THREE.Color(0.93, 0.82, 0.6);
const WALL_SPARK = new THREE.Color(3.0, 2.2, 1.0);
const FLAME = [new THREE.Color(1.9, 0.55, 0.08), new THREE.Color(1.7, 1.05, 0.2)];
const STAR = new THREE.Color(3.0, 2.6, 0.6);
const BUBBLE = new THREE.Color(1.2, 2.4, 3.0);
const EMBER = new THREE.Color(3.0, 1.1, 0.25);
// Zemine göre tekerlerden fışkıran parçacıklar: çamur, su, bal, kar (duman) ve buz (parıltı)
const SURF_FX = {
  mud: { color: new THREE.Color(0.38, 0.26, 0.15), alpha: 0.7, up: 2.4, size: 0.7, rate: 40 },
  water: { color: new THREE.Color(0.85, 0.93, 1), alpha: 0.6, up: 3.2, size: 0.6, rate: 45 },
  honey: { color: new THREE.Color(0.95, 0.62, 0.12), alpha: 0.65, up: 1.6, size: 0.6, rate: 30 },
  snowdrift: { color: new THREE.Color(0.97, 0.98, 1), alpha: 0.7, up: 2.2, size: 0.8, rate: 40 },
  carpet: { color: new THREE.Color(0.8, 0.5, 0.45), alpha: 0.35, up: 1, size: 0.5, rate: 14 },
};
const ICE_SPARK = new THREE.Color(1.6, 2.2, 3.0);


export function createKartEffects(scene, quality) {
  const smoke = new Particles(Math.round(500 * quality.particles), { drag: 1.2, gravity: -1.2 });
  const sparks = new Particles(Math.round(300 * quality.particles), { additive: true, gravity: 18, drag: 0.8, sharp: true });
  scene.add(smoke.points, sparks.points);

  const _p = new THREE.Vector3();
  const _v = new THREE.Vector3();
  const rearLocal = [new THREE.Vector3(0.76, 0.15, -0.72), new THREE.Vector3(-0.76, 0.15, -0.72)];
  const exhaust = new THREE.Vector3(0, 0.55, -1.25);
  const burst = (pos, color, n, speed, up, size = 0.35, life = 0.45) => {
    for (let i = 0; i < n; i++) {
      _v.set((Math.random() - 0.5) * speed, up * (0.5 + Math.random()), (Math.random() - 0.5) * speed);
      sparks.emit(pos, _v, { life: life * (0.7 + Math.random() * 0.6), size, sizeEnd: 0.05, color });
    }
  };
  const rate = quality.particles;

  return {
    // Her karede her kart için
    kart(kart, dt) {
      const body = kart.model.body;
      const speed = Math.abs(kart.speed);
      for (const local of rearLocal) {
        _p.copy(local);
        body.localToWorld(_p);
        if (kart.drifting && kart.grounded) {
          if (Math.random() < 30 * dt * rate) {
            _v.set((Math.random() - 0.5) * 2, 0.8 + Math.random(), (Math.random() - 0.5) * 2);
            smoke.emit(_p, _v, { life: 0.8, size: 0.5, sizeEnd: 2.2, color: SMOKE, alpha: 0.32 });
          }
          const level = driftLevel(kart.driftTime);
          if (level > 0 && Math.random() < 55 * dt * rate) {
            const side = Math.sign(local.x) * kart.driftDir;
            _v.set(-kart.velocity.x * 0.1 + (Math.random() - 0.5) * 3, 2 + Math.random() * 3, -kart.velocity.z * 0.1 + (Math.random() - 0.5) * 3);
            sparks.emit(_p, _v, { life: 0.3 + Math.random() * 0.2, size: side > 0 ? 0.45 : 0.3, sizeEnd: 0.05, color: SPARK_COLORS[level - 1] });
          }
        } else if (kart.surface === 'hot' && kart.grounded && speed > 4) {
          // Kızgın zemin: tekerlerden turuncu kor kıvılcımları
          if (Math.random() < 28 * dt * rate) {
            _v.set((Math.random() - 0.5) * 3, 2.5 + Math.random() * 3, (Math.random() - 0.5) * 3);
            sparks.emit(_p, _v, { life: 0.4 + Math.random() * 0.3, size: 0.4, sizeEnd: 0.05, color: EMBER });
          }
        } else if (SURF_FX[kart.surface] && kart.grounded && speed > 4) {
          const f = SURF_FX[kart.surface];
          if (Math.random() < f.rate * dt * rate) {
            _v.set((Math.random() - 0.5) * 3, f.up * (0.6 + Math.random() * 0.8), (Math.random() - 0.5) * 3);
            smoke.emit(_p, _v, { life: 0.7, size: f.size, sizeEnd: f.size * 3, color: f.color, alpha: f.alpha });
          }
        } else if (kart.surface === 'ice' && kart.grounded && speed > 6) {
          if (Math.random() < 30 * dt * rate) {
            _v.set((Math.random() - 0.5) * 2, 1.5 + Math.random() * 2, (Math.random() - 0.5) * 2);
            sparks.emit(_p, _v, { life: 0.4, size: 0.3, sizeEnd: 0.05, color: ICE_SPARK });
          }
        } else if ((kart.surface === 'sand' || kart.surface === 'dirt') && speed > 5 && kart.boostTime <= 0 && Math.random() < 25 * dt * rate) {
          _v.set((Math.random() - 0.5) * 2, 1 + Math.random() * 1.5, (Math.random() - 0.5) * 2);
          smoke.emit(_p, _v, { life: 0.7, size: 0.5, sizeEnd: 1.9, color: DUST, alpha: 0.4 });
        }
      }
    },

    // Turbo alevi: egzozdan geriye doğru
    boostFlame(kart, dt) {
      if (kart.boostTime <= 0) return;
      const n = Math.ceil(70 * dt * rate);
      for (let i = 0; i < n; i++) {
        _p.copy(exhaust);
        kart.model.body.localToWorld(_p);
        _v.set(-Math.sin(kart.heading) * 6 + (Math.random() - 0.5) * 2, 0.5 + Math.random(), -Math.cos(kart.heading) * 6 + (Math.random() - 0.5) * 2);
        sparks.emit(_p, _v, { life: 0.2 + Math.random() * 0.1, size: 1.15, sizeEnd: 0.25, color: FLAME[i % 2] });
      }
    },

    // Kart olayları: mini-turbo, isabet, kalkanın patlaması
    event(kart, name) {
      _p.copy(kart.object.position).setY(kart.object.position.y + 1);
      if (name.startsWith('miniTurbo')) burst(_p, SPARK_COLORS[Number(name.slice(-1)) - 1], 18, 7, 4);
      else if (name === 'pad') burst(_p, SPARK_COLORS[1], 16, 8, 4);
      else if (name === 'bounce') burst(_p.setY(_p.y - 0.4), SPARK_COLORS[2], 20, 7, 5);
      else if (name === 'hit') burst(_p.setY(_p.y + 1), STAR, 22, 6, 6, 0.5, 0.7);
      else if (name === 'blocked') burst(_p, BUBBLE, 30, 9, 3, 0.45, 0.5);
    },

    // Duvara çarpma anında
    impact(position, normal, strength) {
      const n = Math.min(30, Math.round(strength * 1.5 * rate));
      for (let i = 0; i < n; i++) {
        _p.copy(position).addScaledVector(normal, -0.9).setY(position.y + 0.6);
        _v.set(normal.x * 4 + (Math.random() - 0.5) * 8, 2 + Math.random() * 5, normal.z * 4 + (Math.random() - 0.5) * 8);
        sparks.emit(_p, _v, { life: 0.25 + Math.random() * 0.25, size: 0.35, sizeEnd: 0.05, color: WALL_SPARK });
      }
    },

    // Tehlikeler (gayzer, meteor) ve yanardağ gösterisi için doğrudan yayıcılar
    emitSmoke(pos, vel, opts) {
      smoke.emit(pos, vel, opts);
    },
    emitSpark(pos, vel, opts) {
      sparks.emit(pos, vel, opts);
    },

    // Kum/toprak tozu rengi pist temasından
    setDust(rgb) {
      if (rgb) DUST.setRGB(rgb[0], rgb[1], rgb[2]);
    },

    update(dt, camera, viewportHeight) {
      smoke.update(dt, camera, viewportHeight);
      sparks.update(dt, camera, viewportHeight);
    },
  };
}
