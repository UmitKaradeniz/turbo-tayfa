import * as THREE from 'three';
import { createKartModel } from './kartModel.js';

// Kişisel rekorlar (pist başına en iyi tur + en iyi toplam süre) ve en iyi turun
// "hayalet" kaydı. Hepsi bu tarayıcıda saklanır (localStorage).

const KEY = 'tt-records';
const SAMPLE_DT = 0.1; // saniyede 10 örnek

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
}
const data = load();
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {}
}

// { bestLap, bestLapChar, totals: { [laps]: time }, ghost: { char, time, s: [[t,x,y,z,h,d], ...] } }
export function recordOf(trackId) {
  return data[trackId] ?? null;
}

// Yarış sonu: toplam süre rekoru mu? (tur sayısına göre ayrı tutulur)
export function submitTotal(trackId, laps, time) {
  const r = (data[trackId] ??= {});
  r.totals ??= {};
  const best = r.totals[laps];
  if (best != null && best <= time) return false;
  r.totals[laps] = time;
  save();
  return true;
}

// Oyuncunun turlarını kaydeder; rekor tur olursa hayaleti saklar
export function createGhostRecorder() {
  let samples = [];
  let acc = 0;
  let lapClock = 0;
  return {
    startLap() {
      samples = [];
      acc = SAMPLE_DT; // ilk karede hemen örnek al
      lapClock = 0;
    },
    sample(kart, dt) {
      lapClock += dt;
      acc += dt;
      if (acc < SAMPLE_DT) return;
      acc = 0;
      const p = kart.position;
      samples.push([+lapClock.toFixed(2), +p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2), +kart.heading.toFixed(3), kart.drifting ? kart.driftDir : 0]);
    },
    // Tur bitti: rekor mu? Rekorsa hayaleti kaydet. Dönüş: true = yeni tur rekoru
    finishLap(trackId, character, lapTime) {
      const r = (data[trackId] ??= {});
      const isRecord = r.bestLap == null || lapTime < r.bestLap;
      if (isRecord && samples.length > 20) {
        r.bestLap = lapTime;
        r.bestLapChar = character;
        r.ghost = { char: character, time: lapTime, s: samples };
        save();
      }
      this.startLap();
      return isRecord;
    },
  };
}

// Hayalet kart: kayıtlı turu yarı saydam bir kartla oynatır
export function createGhost(scene, character, ghost, bodyPath) {
  const model = createKartModel(character, bodyPath);
  model.root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = false;
    o.material = o.material.clone();
    o.material.transparent = true;
    o.material.opacity = 0.38;
    o.material.depthWrite = false;
    o.material.emissive?.setRGB(0.15, 0.35, 0.6);
  });
  scene.add(model.root);
  const s = ghost.s;
  let i = 0;
  const _q = new THREE.Quaternion();
  const UP = new THREE.Vector3(0, 1, 0);

  return {
    // t: tur başından beri geçen süre
    update(t, dt) {
      // Kayıt aralığının dışında (tur başlamadan / hayalet turu bitirdikten sonra) görünmez
      model.root.visible = t >= 0 && t <= s[s.length - 1][0];
      if (!model.root.visible) {
        i = 0;
        return;
      }
      while (i < s.length - 2 && s[i + 1][0] < t) i++;
      while (i > 0 && s[i][0] > t) i--;
      const a = s[i];
      const b = s[i + 1] ?? a;
      const k = b[0] > a[0] ? Math.min(1, Math.max(0, (t - a[0]) / (b[0] - a[0]))) : 0;
      model.root.position.set(a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k, a[3] + (b[3] - a[3]) * k);
      const h = a[4] + Math.atan2(Math.sin(b[4] - a[4]), Math.cos(b[4] - a[4])) * k;
      model.root.quaternion.copy(_q.setFromAxisAngle(UP, h));
      model.body.rotation.y = a[5] * 0.38; // drift açısı
      for (const w of model.wheels) w.rotation.x += dt * 30;
      model.update(dt);
    },
    dispose() {
      scene.remove(model.root);
    },
  };
}
