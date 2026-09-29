import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Item görselleri. Kenney paketlerinde karşılığı olmadığı için kodla, düşük
// poligonlu stile uygun şekilde üretiliyor (döndürülmüş profil, köşeli yüzeyler).

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0, ...extra });

// "?" item kutusu: yarı saydam, gökkuşağı tonlarında dönen küp
export function createItemBox() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 128, 128);
  g.addColorStop(0, '#4fd8ff');
  g.addColorStop(0.5, '#8f7bff');
  g.addColorStop(1, '#ff6fc8');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  // İç kısım daha açık (cam gibi)
  const inner = ctx.createRadialGradient(64, 64, 10, 64, 64, 60);
  inner.addColorStop(0, 'rgba(255,255,255,0.75)');
  inner.addColorStop(1, 'rgba(255,255,255,0.15)');
  ctx.fillStyle = inner;
  ctx.fillRect(12, 12, 104, 104);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 6;
  ctx.strokeRect(9, 9, 110, 110);
  ctx.font = '900 92px "Lilita One", "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#0b2a55';
  ctx.strokeText('?', 64, 70);
  ctx.fillStyle = '#ffffff';
  ctx.fillText('?', 64, 70);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;

  const box = new THREE.Mesh(
    new RoundedBoxGeometry(1.5, 1.5, 1.5, 3, 0.28),
    new THREE.MeshStandardMaterial({ map: tex, color: 0xffffff, transparent: true, opacity: 0.92, roughness: 0.2, emissive: 0x3aa8ff, emissiveIntensity: 0.18 }),
  );
  box.castShadow = true;
  return box;
}

// Turbo şişesi: turuncu gövde, beyaz etiket, gri kapak
export function createBottle() {
  const g = new THREE.Group();
  const profile = [
    [0, 0], [0.34, 0], [0.4, 0.08], [0.42, 0.55], [0.36, 0.72], [0.16, 0.86], [0.14, 1.02], [0, 1.02],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const body = new THREE.Mesh(new THREE.LatheGeometry(profile, 14), mat(0xff6a1a, { roughness: 0.3, flatShading: true }));
  const label = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.24, 14, 1, true), mat(0xffffff, { side: THREE.DoubleSide }));
  label.position.y = 0.33;
  const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.435, 0.435, 0.08, 14, 1, true), mat(0xffd23f, { side: THREE.DoubleSide }));
  bolt.position.y = 0.33;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.14, 10), mat(0x5a6273, { flatShading: true }));
  cap.position.y = 1.07;
  g.add(body, label, bolt, cap);
  return g;
}

// Hindistan cevizi: köşeli kahverengi top, üç koyu "göz"
export function createCoconut() {
  const g = new THREE.Group();
  const geo = new THREE.IcosahedronGeometry(0.5, 1);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) * 1.12); // hafif oval
  geo.computeVertexNormals();
  const shell = new THREE.Mesh(geo, mat(0x7a4a26, { flatShading: true, roughness: 0.9 }));
  shell.castShadow = true;
  g.add(shell);
  const eye = new THREE.IcosahedronGeometry(0.075, 0);
  const eyeMat = mat(0x2b1a0e, { flatShading: true });
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    const e = new THREE.Mesh(eye, eyeMat);
    e.position.set(Math.cos(a) * 0.13, 0.53, Math.sin(a) * 0.13);
    g.add(e);
  }
  return g;
}

// Yağ lekesi: yolda parlak, gökkuşağı yansımalı koyu leke (çıkartma)
let slickTexture = null;
function getSlickTexture() {
  if (slickTexture) return slickTexture;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(28,20,40,0.95)';
  ctx.shadowColor = 'rgba(28,20,40,0.6)';
  ctx.shadowBlur = 6;
  ctx.beginPath();
  for (let i = 0; i <= 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    const r = 44 + Math.sin(a * 3 + 0.5) * 7 + Math.cos(a * 5) * 3;
    const x = 64 + Math.cos(a) * r;
    const y = 64 + Math.sin(a) * r;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.fill();
  ctx.shadowBlur = 0;
  // Gökkuşağı yansıması
  const g = ctx.createLinearGradient(30, 30, 100, 100);
  g.addColorStop(0, 'rgba(255,80,200,0.35)');
  g.addColorStop(0.5, 'rgba(80,220,255,0.3)');
  g.addColorStop(1, 'rgba(255,230,80,0.3)');
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(58, 56, 30, 9, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(78, 76, 12, 3.5, -0.6, 0, Math.PI * 2);
  ctx.fill();
  slickTexture = new THREE.CanvasTexture(canvas);
  slickTexture.colorSpace = THREE.SRGBColorSpace;
  return slickTexture;
}
export function createSlick() {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(4.6, 4.6),
    new THREE.MeshStandardMaterial({ map: getSlickTexture(), transparent: true, roughness: 0.15, polygonOffset: true, polygonOffsetFactor: -4 }),
  );
  m.rotation.x = -Math.PI / 2;
  m.receiveShadow = true;
  return m;
}

// İkon için yağ damlası
export function createDrop() {
  const profile = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const y = t * 1.1;
    const r = Math.sin(Math.PI * Math.min(1, t * 1.15)) * 0.42 * (1 - t * 0.55);
    profile.push(new THREE.Vector2(Math.max(0, r), y));
  }
  return new THREE.Mesh(new THREE.LatheGeometry(profile, 14), mat(0x2a1d3d, { roughness: 0.15, flatShading: true }));
}

// Balon kalkan: kenarları parlayan, hafif dalgalanan saydam küre
export function createBubble() {
  const m = new THREE.Mesh(
    new THREE.IcosahedronGeometry(2.3, 3),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { time: { value: 0 }, color: { value: new THREE.Color(0.5, 0.9, 1.4) } },
      vertexShader: /* glsl */ `
        uniform float time;
        varying vec3 vNormal; varying vec3 vView;
        void main() {
          vec3 p = position * (1.0 + 0.03 * sin(time * 6.0 + position.y * 3.0));
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vNormal = normalize(normalMatrix * normal);
          vView = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 color;
        varying vec3 vNormal; varying vec3 vView;
        void main() {
          float f = pow(1.0 - abs(dot(vNormal, vView)), 2.5);
          gl_FragColor = vec4(color * (0.5 + f * 1.5), 0.12 + f * 0.75);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }),
  );
  m.renderOrder = 3;
  return m;
}

// HUD ikonları için modeller (portre çizici ile resme çevrilir)
export const ITEM_ICON_MODELS = {
  turbo: () => createBottle(),
  shield: () => {
    const b = createBubble();
    b.scale.setScalar(0.25);
    b.position.y = 0.5;
    const g = new THREE.Group();
    g.add(b);
    return g;
  },
  coconut: () => {
    const c = createCoconut();
    c.position.y = 0.5;
    return c;
  },
  oil: () => createDrop(),
};
