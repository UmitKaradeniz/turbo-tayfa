import * as THREE from 'three';

// Item görselleri. Kenney paketlerinde karşılığı olmadığı için kodla, düşük
// poligonlu stile uygun şekilde üretiliyor (döndürülmüş profil, köşeli yüzeyler).

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0, ...extra });

// "?" item kutusu: içten ışıyan, renk değiştiren kristal. İçinde "?" süzülür, çevresinde minik parıltılar
// döner, altında yumuşak bir ışık halkası vardır. Şekil/doku paylaşılır; renkler kutu başına animasyonlanır.
let boxAssets = null;
function getBoxAssets() {
  if (boxAssets) return boxAssets;
  const radial = (stops) => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 1, 32, 32, 31);
    for (const [o, col] of stops) grad.addColorStop(o, col);
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  };
  // "?" işareti
  const q = document.createElement('canvas');
  q.width = q.height = 128;
  const g = q.getContext('2d');
  g.font = '900 104px "Lilita One", "Arial Black", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = 14;
  g.strokeStyle = '#0b2a55';
  g.strokeText('?', 64, 70);
  g.fillStyle = '#ffffff';
  g.fillText('?', 64, 70);
  const qTex = new THREE.CanvasTexture(q);
  qTex.colorSpace = THREE.SRGBColorSpace;
  const geo = new THREE.IcosahedronGeometry(0.95, 0).scale(1, 1.3, 1);
  boxAssets = {
    geo,
    edges: new THREE.EdgesGeometry(geo),
    halo: new THREE.PlaneGeometry(4.2, 4.2).rotateX(-Math.PI / 2),
    haloTex: radial([[0, 'rgba(255,255,255,0.85)'], [0.35, 'rgba(255,255,255,0.35)'], [1, 'rgba(255,255,255,0)']]),
    sparkTex: radial([[0, 'rgba(255,255,255,1)'], [0.4, 'rgba(255,255,255,0.6)'], [1, 'rgba(255,255,255,0)']]),
    qTex,
  };
  return boxAssets;
}

const SPARKS = 5;
const WHITE = new THREE.Color(0xffffff);
export function createItemBox() {
  const A = getBoxAssets();
  const root = new THREE.Group();
  const crystal = new THREE.Group();
  const gem = new THREE.Mesh(
    A.geo,
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x4f8cff, emissiveIntensity: 0.6, transparent: true, opacity: 0.8, roughness: 0.1, metalness: 0.3, flatShading: true, side: THREE.DoubleSide, depthWrite: false }),
  );
  gem.castShadow = false;
  const edges = new THREE.LineSegments(A.edges, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, toneMapped: false }));
  crystal.add(gem, edges);

  const mark = new THREE.Sprite(new THREE.SpriteMaterial({ map: A.qTex, toneMapped: false, transparent: true, depthWrite: false }));
  mark.scale.set(1.3, 1.3, 1);
  mark.renderOrder = 3;

  const halo = new THREE.Mesh(
    A.halo,
    new THREE.MeshBasicMaterial({ map: A.haloTex, color: 0x4f8cff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -3, toneMapped: false }),
  );
  halo.position.y = -1.22;

  // Çevrede dönen parıltılar (tek Points nesnesi)
  const sparkPos = new Float32Array(SPARKS * 3);
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ map: A.sparkTex, size: 0.6, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  sparks.frustumCulled = false;

  root.add(crystal, mark, halo, sparks);

  const tint = new THREE.Color();
  // dt: saniye, time: toplam süre, hue: 0..1 döngü, i: kutu sırası (renk/faz farkı)
  root.userData.animate = (dt, time, hue, i) => {
    crystal.rotation.y += dt * 1.6;
    crystal.rotation.x = Math.sin(time * 1.5 + i) * 0.18;
    tint.setHSL(0.52 + ((hue + i * 0.07) % 1) * 0.42, 0.95, 0.55); // turkuaz → mor → pembe
    gem.material.emissive.copy(tint);
    gem.material.color.copy(tint).lerp(WHITE, 0.45);
    halo.material.color.copy(tint).multiplyScalar(0.6);
    sparks.material.color.setHSL(0.52 + ((hue + i * 0.07 + 0.25) % 1) * 0.42, 1, 0.82);
    mark.position.y = Math.sin(time * 2.4 + i) * 0.06;
    const pulse = 1 + Math.sin(time * 3 + i * 1.3) * 0.05;
    mark.scale.set(1.3 * pulse, 1.3 * pulse, 1);
    halo.scale.setScalar(0.92 + Math.sin(time * 2 + i) * 0.08);
    for (let k = 0; k < SPARKS; k++) {
      const a = time * (0.9 + k * 0.13) + (k * Math.PI * 2) / SPARKS + i;
      const r = 1.35 + Math.sin(time * 1.7 + k * 2) * 0.18;
      sparkPos[k * 3] = Math.cos(a) * r;
      sparkPos[k * 3 + 1] = Math.sin(time * 1.3 + k * 1.7) * 0.95;
      sparkPos[k * 3 + 2] = Math.sin(a) * r;
    }
    sparkGeo.attributes.position.needsUpdate = true;
  };
  root.userData.animate(0, 0, 0, 0);
  return root;
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
          // clamp şart: abs(dot) hassasiyetten 1'i aşarsa negatif tabanın üssü bazı GPU'larda NaN verir
          float f = pow(clamp(1.0 - abs(dot(vNormal, vView)), 0.0, 1.0), 2.5);
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
