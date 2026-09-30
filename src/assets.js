import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Tüm glTF modelleri oyun başlamadan bir kez yüklenir, sonra klonlanarak kullanılır.
// Anahtar = 'klasör/dosya' (örn. 'nature/tree_palmTall').

const loader = new GLTFLoader();
const cache = new Map();

// Bu modellerin hepsi zaten yüklü mü?
export function hasModels(keys) {
  return keys.every((k) => cache.has(k));
}

export async function loadModels(keys, onProgress) {
  let done = 0;
  const todo = [...new Set(keys)].filter((k) => !cache.has(k));
  if (!todo.length) return onProgress?.(1);
  await Promise.all(
    todo.map(async (key) => {
      const gltf = await loader.loadAsync(`/models/${key}.glb`);
      gltf.scene.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
          tuneMaterial(o.material);
        }
      });
      cache.set(key, gltf);
      onProgress?.(++done / todo.length);
    }),
  );
}

// Kenney malzemeleri biraz parlak geliyor; çizgi film görünümü için matlaştır
function tuneMaterial(mat) {
  for (const m of Array.isArray(mat) ? mat : [mat]) {
    m.metalness = 0;
    m.roughness = Math.max(m.roughness ?? 1, 0.7);
    if (m.map) m.map.anisotropy = 4;
  }
}

// Modelin bir kopyası (animasyon klipleriyle birlikte)
export function cloneModel(key) {
  const gltf = cache.get(key);
  if (!gltf) throw new Error(`Model yüklenmedi: ${key}`);
  return { scene: gltf.scene.clone(true), animations: gltf.animations };
}

// Tabanı y=0'da, XZ'de ortalanmış bir kopya. Pist dekoru için.
export function normalizedModel(key) {
  const { scene } = cloneModel(key);
  const box = new THREE.Box3().setFromObject(scene);
  const center = box.getCenter(new THREE.Vector3());
  scene.position.set(-center.x, -box.min.y, -center.z);
  const wrapper = new THREE.Group();
  wrapper.add(scene);
  wrapper.userData.size = box.getSize(new THREE.Vector3());
  return wrapper;
}

// Aynı modelden çok sayıda kopyayı tek çizim çağrısıyla göstermek için:
// modeldeki her mesh için bir InstancedMesh üretir.
const _m = new THREE.Matrix4();
export function instancedModel(key, matrices, { castShadow = true, frost = false, glow = 0, tint = null } = {}) {
  const group = new THREE.Group();
  if (!matrices.length) return group;
  const model = normalizedModel(key);
  model.updateMatrixWorld(true);
  model.traverse((child) => {
    if (!child.isMesh) return;
    const im = new THREE.InstancedMesh(child.geometry, frost ? frosted(child.material) : glow ? glowing(child.material, glow) : tint ? tinted(child.material, tint) : child.material, matrices.length);
    matrices.forEach((m, i) => im.setMatrixAt(i, _m.multiplyMatrices(m, child.matrixWorld)));
    im.castShadow = castShadow;
    im.receiveShadow = true;
    im.computeBoundingSphere();
    group.add(im);
  });
  return group;
}

// Renk ve ışıma değiştirilmiş kopya: volkan kayaları koyulaşır, kor gibi içten kızarır
function tinted(mat, t) {
  const out = (Array.isArray(mat) ? mat : [mat]).map((m) => {
    const c = m.clone();
    if (t.color != null) c.color.multiply(new THREE.Color(t.color));
    if (t.emissive != null) {
      c.emissive = new THREE.Color(t.emissive);
      c.emissiveIntensity = t.intensity ?? 0.5;
    }
    return c;
  });
  return Array.isArray(mat) ? out : out[0];
}

// Karla kaplanmış görünüm: malzeme kopyası + açık mavimsi beyaz ışıma
function frosted(mat) {
  const out = (Array.isArray(mat) ? mat : [mat]).map((m) => {
    const c = m.clone();
    c.emissive = new THREE.Color(0xd4e4f8);
    c.emissiveIntensity = 0.5;
    return c;
  });
  return Array.isArray(mat) ? out : out[0];
}

// Gece binaları: paletteki cam renkleri (mavi tonlar) sıcak sarı ışık olur, duvarlar loş kalır
const glowCache = new WeakMap();
function windowGlowTexture(map) {
  if (glowCache.has(map)) return glowCache.get(map);
  const img = map.image;
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const data = g.getImageData(0, 0, c.width, c.height);
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const gg = d[i + 1];
    const b = d[i + 2];
    // Mavi/mor tonlar cam sayılır; grimsi duvar renkleri (r≈g≈b) sönük kalır
    if (b > r + 30 && b > 190 - 40) [d[i], d[i + 1], d[i + 2]] = b > 240 ? [255, 236, 190] : r > 150 ? [255, 120, 230] : [255, 206, 120];
    else d[i] = d[i + 1] = d[i + 2] = 0;
  }
  g.putImageData(data, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.flipY = map.flipY;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.channel = map.channel;
  glowCache.set(map, tex);
  return tex;
}

function glowing(mat, intensity) {
  const out = (Array.isArray(mat) ? mat : [mat]).map((m) => {
    const c = m.clone();
    c.emissive = new THREE.Color(0xffffff);
    c.emissiveMap = c.map ? windowGlowTexture(c.map) : null;
    c.emissiveIntensity = intensity;
    c.color = new THREE.Color(0x68729f);
    return c;
  });
  return Array.isArray(mat) ? out : out[0];
}
