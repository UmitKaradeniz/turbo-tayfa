import * as THREE from 'three';
import { cloneModel } from '../assets.js';

// Sonuç ekranı podyumu: finish_podium üzerinde ilk 3 hayvan dans eder, 1.'nin başında trophy_cup döner, konfeti yağar.
// Ayrı küçük bir WebGL sahnesi; yalnız sonuç tablosu açıkken çizilir.
export const PODIUM_MODELS = ['tayfa/finish_podium', 'tayfa/trophy_cup'];

const S = 2.2; // podyum ölçeği (model ~0.84 m genişliğinde)
const STEPS = [
  { x: -0.4, h: 0.42 + 0.04, turn: 0.35 }, // 2.
  { x: 0, h: 0.6 + 0.04, turn: 0 }, // 1.
  { x: 0.4, h: 0.3 + 0.04, turn: -0.35 }, // 3.
];
const CONFETTI = 70;
const CONFETTI_COLORS = [0xff5c7a, 0xffd23f, 0x4fc3f7, 0x7ed957, 0xb48cff, 0xffa24c].map((c) => new THREE.Color(c));

export function createPodium3d(host) {
  const canvas = document.createElement('canvas');
  host.appendChild(canvas);
  let renderer = null;
  let scene = null;
  let camera = null;
  let raf = 0;
  let last = 0;
  let key = '';
  let mixers = [];
  let trophy = null;
  let trophyBaseY = 0;
  let winner = null;
  let confetti = null;
  const confettiSpeed = new Float32Array(CONFETTI);

  const init = () => {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x9fb6d6, 1.7));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(3, 6, 6);
    scene.add(sun);
    camera = new THREE.PerspectiveCamera(30, 2, 0.1, 60);
    camera.position.set(0, 2.4, 7.6);
    camera.lookAt(0, 1.85, 0);

    const pos = new Float32Array(CONFETTI * 3);
    const col = new Float32Array(CONFETTI * 3);
    for (let i = 0; i < CONFETTI; i++) {
      CONFETTI_COLORS[i % CONFETTI_COLORS.length].toArray(col, i * 3);
      confettiSpeed[i] = 0.9 + Math.random() * 1.3;
      pos[i * 3] = (Math.random() - 0.5) * 8;
      pos[i * 3 + 1] = Math.random() * 5;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 3;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    confetti = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.16, vertexColors: true }));
    confetti.frustumCulled = false;
    scene.add(confetti);
  };

  const resize = () => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (!w || !h) return false;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    return true;
  };

  const clearStage = () => {
    for (const o of [...scene.children]) if (o.userData.stage) scene.remove(o);
    mixers = [];
    trophy = winner = null;
  };

  // characters: [1., 2., 3.] (eksik olabilir)
  const build = (characters) => {
    clearStage();
    const stage = new THREE.Group();
    stage.userData.stage = true;
    const podium = cloneModel('tayfa/finish_podium').scene;
    podium.scale.setScalar(S);
    stage.add(podium);
    // STEPS sırası: 2., 1., 3.
    const order = [characters[1], characters[0], characters[2]];
    order.forEach((c, k) => {
      if (!c) return;
      const { scene: pet, animations } = cloneModel(c.pet);
      pet.scale.setScalar(0.72);
      pet.position.set(STEPS[k].x * S, STEPS[k].h * S, 0);
      pet.rotation.y = STEPS[k].turn;
      const mixer = new THREE.AnimationMixer(pet);
      const clip = animations.find((a) => a.name === 'dance') ?? animations.find((a) => a.name === 'idle');
      if (clip) mixer.clipAction(clip).play().time = k * 0.37;
      mixers.push(mixer);
      stage.add(pet);
      if (k === 1) winner = pet;
    });
    if (winner) {
      trophy = cloneModel('tayfa/trophy_cup').scene;
      trophy.scale.setScalar(S * 0.45);
      const top = new THREE.Box3().setFromObject(winner).max.y;
      trophyBaseY = top + 0.15;
      trophy.position.set(0, trophyBaseY, 0);
      stage.add(trophy);
    }
    scene.add(stage);
  };

  const frame = (t) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((t - last) / 1000 || 0, 0.05);
    last = t;
    if (!resize()) return;
    for (const m of mixers) m.update(dt);
    if (trophy) {
      trophy.rotation.y += dt * 1.8;
      trophy.position.y = trophyBaseY + Math.sin(t / 380) * 0.1;
    }
    if (winner) winner.position.y = STEPS[1].h * S + Math.abs(Math.sin(t / 330)) * 0.12;
    const p = confetti.geometry.attributes.position;
    for (let i = 0; i < CONFETTI; i++) {
      let y = p.getY(i) - confettiSpeed[i] * dt;
      if (y < 0) y += 5.5;
      p.setY(i, y);
      p.setX(i, p.getX(i) + Math.sin(t / 500 + i) * dt * 0.5);
    }
    p.needsUpdate = true;
    renderer.render(scene, camera);
  };

  return {
    // Aynı ilk üçte yeniden kurmaz
    show(characters) {
      if (!renderer) init();
      const k = characters.map((c) => c?.id).join();
      if (k !== key) {
        key = k;
        build(characters);
      }
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    },
    stop() {
      cancelAnimationFrame(raf);
      raf = 0;
      key = '';
    },
  };
}
