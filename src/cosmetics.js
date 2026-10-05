// Kozmetikler: kart boyası ve drift/turbo izi. Hepsi kodla üretilir (dış dosya yok).
// Seviye (Turbo Puan) yükseldikçe açılır; seçim `progress.js` içinde saklanır.
import * as THREE from 'three';
import { levelInfo, selection } from './progress.js';

// ---------- Boyalar ----------
// hue: 0-1 renk tonu (yoksa ton korunur), sat/val: çarpan, metal/rough: malzeme, rainbow: ton zamanla döner
export const PAINTS = [
  { id: 'stock', name: 'Orijinal', lv: 1, swatch: ['#e9eef7', '#b8c4d8'] },
  { id: 'red', name: 'Kırmızı', lv: 2, hue: 0.0, sat: 1.05, val: 1.0, swatch: ['#ff5a4f', '#c01e1e'] },
  { id: 'blue', name: 'Mavi', lv: 3, hue: 0.6, sat: 1.0, val: 1.0, swatch: ['#4aa8ff', '#1553c9'] },
  { id: 'green', name: 'Yeşil', lv: 4, hue: 0.33, sat: 1.0, val: 1.0, swatch: ['#58e07a', '#1b8c3d'] },
  { id: 'yellow', name: 'Sarı', lv: 5, hue: 0.14, sat: 1.0, val: 1.1, swatch: ['#ffe14a', '#e0a800'] },
  { id: 'purple', name: 'Mor', lv: 6, hue: 0.76, sat: 1.0, val: 1.0, swatch: ['#b784ff', '#6429c9'] },
  { id: 'orange', name: 'Turuncu', lv: 7, hue: 0.07, sat: 1.05, val: 1.05, swatch: ['#ffa040', '#d9620a'] },
  { id: 'pink', name: 'Pembe', lv: 8, hue: 0.92, sat: 0.75, val: 1.2, swatch: ['#ff9ccf', '#e0489a'] },
  { id: 'teal', name: 'Turkuaz', lv: 9, hue: 0.5, sat: 1.0, val: 1.0, swatch: ['#3fe3d3', '#0b8f95'] },
  { id: 'black', name: 'Mat Siyah', lv: 10, sat: 0.12, val: 0.38, rough: 0.9, swatch: ['#4a4f58', '#16181c'] },
  { id: 'pearl', name: 'İnci', lv: 11, sat: 0.1, val: 1.6, swatch: ['#ffffff', '#d9e2f2'] },
  { id: 'silver', name: 'Gümüş', lv: 12, sat: 0.0, val: 1.25, metal: 0.95, rough: 0.22, swatch: ['#f2f5fa', '#8d98ab'] },
  { id: 'gold', name: 'Altın', lv: 14, hue: 0.125, sat: 0.85, val: 1.25, metal: 0.95, rough: 0.25, swatch: ['#ffe27a', '#c58a00'] },
  { id: 'rainbow', name: 'Gökkuşağı', lv: 16, rainbow: true, sat: 0.9, val: 1.1, swatch: ['#ff4b4b', '#ffd23f', '#2ee07a', '#1fb6ff', '#b784ff'] },
];

// Gökkuşağı boyası/izi için ortak zaman tonu (her karede `tickCosmetics` günceller)
const RAINBOW = { value: 0 };
let rbT = 0;
export function tickCosmetics(t) {
  RAINBOW.value = (t * 0.25) % 1;
  rbT = t;
}

export const paintOf = (id) => PAINTS.find((p) => p.id === id) ?? PAINTS[0];

// Köşe renkli (vcolor) gövde malzemelerinde canlı renklerin tonunu boyaya çevirir; gri/koyu parçalar (lastik, motor) kalır.
const GLSL = /* glsl */ `
  uniform vec4 uPaint; // x: ton (<0: ton değişmez), y: doygunluk çarpanı, z: parlaklık çarpanı, w: gökkuşağı (1)
  uniform float uRainbow;
  vec3 ttHsv2rgb(vec3 c) {
    vec3 p = abs(fract(c.xxx + vec3(1.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
    return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
  }
  vec3 ttRgb2hsv(vec3 c) {
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
    float d = q.x - min(q.w, q.y);
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + 1e-10)), d / (q.x + 1e-10), q.x);
  }
`;
const APPLY = /* glsl */ `
  {
    // Ton/doygunluk algısı sRGB'de daha doğru; köşe renkleri doğrusal olduğu için çevirip geri çeviriyoruz
    vec3 hsv = ttRgb2hsv(pow(max(diffuseColor.rgb, vec3(0.0)), vec3(1.0 / 2.2)));
    bool vivid = hsv.y > 0.3 && hsv.z > 0.3;
    bool light = hsv.y <= 0.3 && hsv.z > 0.6; // açık gri/beyaz gövde parçaları: gümüş/inci/siyah boyalarda da değişsin
    if (vivid || (light && uPaint.y < 0.5)) {
      float h = uPaint.w > 0.5 ? uRainbow : (uPaint.x >= 0.0 ? uPaint.x : hsv.x);
      hsv = vec3(h, clamp(hsv.y * uPaint.y, 0.0, 1.0), clamp(hsv.z * uPaint.z, 0.0, 1.0));
      diffuseColor.rgb = pow(ttHsv2rgb(hsv), vec3(2.2));
    }
  }
`;

// Karta boya uygula (model: createKartModel çıktısı). Malzemeler kart başına kopyalanır.
export function applyPaint(kartObject, paintId) {
  const p = paintOf(paintId);
  kartObject.traverse((o) => {
    if (!o.isMesh || o.name === 'character') return;
    const mats = [].concat(o.material);
    // Yalnız köşe renkli gövde malzemesi (hayvan 'colormap' dokusu boyanmaz)
    if (!mats.some((m) => m.vertexColors)) return;
    const orig = o.userData.origMat ?? (o.userData.origMat = o.material);
    if (p.id === 'stock') {
      o.material = orig;
      return;
    }
    const m = (Array.isArray(orig) ? orig[0] : orig).clone();
    const u = { value: new THREE.Vector4(p.hue ?? -1, p.sat ?? 1, p.val ?? 1, p.rainbow ? 1 : 0) };
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uPaint = u;
      shader.uniforms.uRainbow = RAINBOW;
      shader.fragmentShader = shader.fragmentShader
        .replace('void main() {', `${GLSL}\nvoid main() {`)
        .replace('#include <color_fragment>', `#include <color_fragment>\n${APPLY}`);
    };
    m.customProgramCacheKey = () => 'tt-paint';
    if (p.metal != null) m.metalness = p.metal;
    if (p.rough != null) m.roughness = p.rough;
    m.needsUpdate = true;
    o.material = m;
  });
}

// ---------- İzler (drift kıvılcımı, mini-turbo patlaması ve turbo alevi renkleri) ----------
const C = (r, g, b) => new THREE.Color(r, g, b);
export const TRAILS = [
  { id: 'classic', name: 'Klasik', lv: 1, swatch: ['#80ccff', '#ff9a30', '#c070ff'] },
  { id: 'violet', name: 'Mor Büyü', lv: 3, sparks: [C(1.6, 0.6, 3), C(2.4, 0.7, 3), C(3, 1.1, 3)], flame: [C(1.3, 0.3, 2), C(2, 0.7, 2.6)], swatch: ['#a05cff', '#d58cff', '#ff9cf0'] },
  { id: 'toxic', name: 'Zehir', lv: 5, sparks: [C(0.4, 2.2, 0.5), C(1.2, 3, 0.3), C(2.4, 3, 0.5)], flame: [C(0.3, 1.6, 0.2), C(1.1, 2, 0.2)], swatch: ['#3cff6a', '#9dff2f', '#e6ff4a'] },
  { id: 'ice', name: 'Buz', lv: 7, sparks: [C(1.2, 2.2, 3), C(1.8, 2.8, 3), C(2.6, 3, 3)], flame: [C(0.8, 1.6, 2.6), C(1.6, 2.2, 3)], swatch: ['#8fd8ff', '#c6efff', '#ffffff'] },
  { id: 'candy', name: 'Şeker', lv: 9, sparks: [C(3, 0.8, 1.6), C(3, 1.6, 2.2), C(2.4, 2.8, 3)], flame: [C(2.2, 0.5, 1.2), C(2.8, 1.2, 1.9)], swatch: ['#ff5fa8', '#ff9ccf', '#a0f0ff'] },
  { id: 'gold', name: 'Altın', lv: 11, sparks: [C(3, 2.2, 0.5), C(3, 2.6, 0.9), C(3, 3, 1.8)], flame: [C(2.4, 1.4, 0.2), C(3, 2.3, 0.6)], swatch: ['#ffc83a', '#ffe27a', '#fff6c8'] },
  { id: 'ghost', name: 'Hayalet', lv: 13, sparks: [C(1.6, 1.8, 2.2), C(2.2, 2.4, 2.8), C(3, 3, 3)], flame: [C(1.5, 1.6, 2), C(2.4, 2.6, 3)], swatch: ['#c9d2e6', '#e8edf8', '#ffffff'] },
  { id: 'rainbow', name: 'Gökkuşağı', lv: 15, rainbow: true, swatch: ['#ff4b4b', '#ffd23f', '#2ee07a', '#1fb6ff', '#b784ff'] },
];
export const trailOf = (id) => TRAILS.find((t) => t.id === id) ?? TRAILS[0];

const _rb = new THREE.Color();
// Gökkuşağı izi: her çağrıda bir sonraki ton (parçacıklar renkli şerit olur)
export function rainbowColor(offset = 0) {
  _rb.setHSL((rbT * 0.6 + offset + Math.random() * 0.08) % 1, 1, 0.55);
  return _rb.multiplyScalar(2.6);
}

// Oyuncunun seçtiği kozmetikler; seviyesi yetmeyen seçim varsayılana düşer
export function activeCosmetics() {
  const lv = levelInfo().level;
  const s = selection();
  const paint = paintOf(s.paint);
  const trail = trailOf(s.trail);
  return { paint: paint.lv <= lv ? paint.id : 'stock', trail: trail.lv <= lv ? trail.id : 'classic' };
}
