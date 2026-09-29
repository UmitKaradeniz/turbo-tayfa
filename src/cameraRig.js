import * as THREE from 'three';
import { CAMERA, KART } from './config.js';

// İki mod: 'chase' (yarışta kartı arkadan takip) ve 'orbit' (menüde kartın
// etrafında yavaşça dönme). Mod değişince kamera eski konumundan yumuşakça geçer.
export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.mode = 'chase';
    this.heading = 0;
    this.trauma = 0; // 0..1, sarsıntı miktarı
    this.shakeEnabled = true;
    this.time = 0;
    this.orbitAngle = 0;
    this.orbitFocus = new THREE.Vector3();
    this.target = new THREE.Vector3();
    this.desired = new THREE.Vector3();
    this.blend = 1;
    this.blendDuration = 1;
    this.fromPos = new THREE.Vector3();
    this.fromQuat = new THREE.Quaternion();
  }

  // Mevcut kamera konumundan yeni moda geçiş başlat
  transition(mode, duration = 1.2) {
    this.fromPos.copy(this.camera.position);
    this.fromQuat.copy(this.camera.quaternion);
    this.mode = mode;
    this.blend = 0;
    this.blendDuration = duration;
  }

  snapTo(kart) {
    this.heading = kart.heading;
    this.blend = 1;
    this.update(1, kart, true);
  }

  shake(amount) {
    if (this.shakeEnabled) this.trauma = Math.min(1, this.trauma + amount);
  }

  update(dt, kart, instant = false) {
    this.time += dt;
    if (this.mode === 'orbit') this.updateOrbit(dt, kart, instant);
    else this.updateChase(dt, kart, instant);

    // Mod geçişi: eski konumdan yeni hedefe yumuşak geçiş
    if (this.blend < 1) {
      this.blend = Math.min(1, this.blend + dt / this.blendDuration);
      const t = this.blend * this.blend * (3 - 2 * this.blend);
      this.camera.position.lerpVectors(this.fromPos, this.camera.position, t);
      this.camera.quaternion.slerpQuaternions(this.fromQuat, this.camera.quaternion, t);
    }
  }

  updateOrbit(dt, kart, instant) {
    const p = kart.object.position;
    this.orbitFocus.lerp(p, instant ? 1 : 1 - Math.exp(-4 * dt));
    this.orbitAngle += dt * 0.18;
    const a = kart.heading + 0.9 + Math.sin(this.orbitAngle) * 0.75;
    // Dikey (dar) ekranda kart sığsın diye uzaklaş
    const dist = 6.5 * Math.max(1, 1.25 / this.camera.aspect);
    this.desired.set(this.orbitFocus.x + Math.sin(a) * dist, this.orbitFocus.y + 2.2, this.orbitFocus.z + Math.cos(a) * dist);
    this.camera.position.lerp(this.desired, instant ? 1 : 1 - Math.exp(-3 * dt));
    this.target.set(this.orbitFocus.x, this.orbitFocus.y + 1.1, this.orbitFocus.z);
    this.camera.lookAt(this.target);
    this.setFov(58, dt, instant);
    this.heading = kart.heading;
  }

  updateChase(dt, kart, instant) {
    const pos = kart.object.position;

    // Kamera yönü kartın yönünü biraz gecikmeyle izler (drift'te kartın yan dönüşü görünür)
    let d = kart.heading - this.heading;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.heading += d * (instant ? 1 : 1 - Math.exp(-CAMERA.headingSharpness * dt));

    const fx = Math.sin(this.heading);
    const fz = Math.cos(this.heading);
    this.desired.set(pos.x - fx * CAMERA.distance, pos.y + CAMERA.height, pos.z - fz * CAMERA.distance);
    const k = instant ? 1 : 1 - Math.exp(-CAMERA.followSharpness * dt);
    this.camera.position.lerp(this.desired, k);

    this.target.set(pos.x + fx * CAMERA.lookAhead, pos.y + CAMERA.lookHeight, pos.z + fz * CAMERA.lookAhead);
    this.camera.lookAt(this.target);

    // Sarsıntı
    if (this.trauma > 0) {
      const s = this.trauma * this.trauma;
      const t = this.time * 40;
      this.camera.rotation.z += Math.sin(t * 1.3) * 0.03 * s;
      this.camera.position.x += Math.sin(t * 1.7 + 1) * 0.25 * s;
      this.camera.position.y += Math.sin(t * 2.1 + 2) * 0.2 * s;
      this.trauma = Math.max(0, this.trauma - dt * 1.8);
    }

    // Hız hissi için FOV
    const speedRatio = Math.min(1, Math.max(0, kart.speed) / KART.maxSpeed);
    this.setFov(CAMERA.baseFov + (CAMERA.maxFov - CAMERA.baseFov) * speedRatio * speedRatio, dt, instant);
  }

  setFov(fov, dt, instant) {
    if (Math.abs(fov - this.camera.fov) > 0.01) {
      this.camera.fov += (fov - this.camera.fov) * (instant ? 1 : 1 - Math.exp(-4 * dt));
      this.camera.updateProjectionMatrix();
    }
  }
}
