import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Tüm glTF modelleri oyun başlamadan bir kez yüklenir, sonra klonlanarak kullanılır.
// Anahtar = 'klasör/dosya' (örn. 'nature/tree_palmTall').

const loader = new GLTFLoader();
const cache = new Map();

export async function loadModels(keys, onProgress) {
  let done = 0;
  await Promise.all(
    keys.map(async (key) => {
      const gltf = await loader.loadAsync(`/models/${key}.glb`);
      gltf.scene.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
          tuneMaterial(o.material);
        }
      });
      cache.set(key, gltf);
      onProgress?.(++done / keys.length);
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
export function instancedModel(key, matrices, { castShadow = true, frost = false } = {}) {
  const group = new THREE.Group();
  if (!matrices.length) return group;
  const model = normalizedModel(key);
  model.updateMatrixWorld(true);
  model.traverse((child) => {
    if (!child.isMesh) return;
    const im = new THREE.InstancedMesh(child.geometry, frost ? frosted(child.material) : child.material, matrices.length);
    matrices.forEach((m, i) => im.setMatrixAt(i, _m.multiplyMatrices(m, child.matrixWorld)));
    im.castShadow = castShadow;
    im.receiveShadow = true;
    im.computeBoundingSphere();
    group.add(im);
  });
  return group;
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
