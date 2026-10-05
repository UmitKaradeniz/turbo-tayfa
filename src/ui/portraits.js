import * as THREE from 'three';
import { cloneModel } from '../assets.js';

// Karakter portreleri: her hayvanı küçük bir sahnede çizip PNG'ye çevirir.
// Ayrı resim dosyası gerekmez; menü, lobi ve sonuç ekranında kullanılır.
export function renderPortraits(renderer, characters, size = 256) {
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9fb6d6, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(2, 3, 4);
  scene.add(key);

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(1.4, 1.35, 3.3);
  camera.lookAt(0, 0.78, 0);

  const target = new THREE.WebGLRenderTarget(size, size, { samples: 4 });
  target.texture.colorSpace = THREE.SRGBColorSpace;
  const pixels = new Uint8Array(size * size * 4);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(size, size);

  const prevClear = renderer.getClearAlpha();
  renderer.setClearColor(0x000000, 0);
  const result = {};
  for (const c of characters) {
    const { scene: pet } = cloneModel(c.pet);
    pet.rotation.y = 0.25;
    scene.add(pet);
    renderer.setRenderTarget(target);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.readRenderTargetPixels(target, 0, 0, size, size, pixels);
    // WebGL satırları alttan üste okur → ters çevir
    for (let y = 0; y < size; y++) {
      image.data.set(pixels.subarray((size - 1 - y) * size * 4, (size - y) * size * 4), y * size * 4);
    }
    ctx.putImageData(image, 0, 0);
    result[c.id] = canvas.toDataURL('image/png');
    scene.remove(pet);
  }
  renderer.setRenderTarget(null);
  renderer.setClearColor(0x000000, prevClear);
  target.dispose();
  return result;
}

// Mini harita kafaları: her hayvanın yalnız kafası (küçük yuvarlak simge). Kafa yüksekliği, gövde kutusunun oranı.
const HEAD_FRAC = { giraffe: 0.26, elephant: 0.5, penguin: 0.46, parrot: 0.5, bunny: 0.5, koala: 0.5, cow: 0.48, tiger: 0.5, lion: 0.5, dog: 0.48, cat: 0.5, fox: 0.5, monkey: 0.5, panda: 0.5 };
export function renderHeads(renderer, characters, size = 96) {
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9fb6d6, 1.8));
  const key = new THREE.DirectionalLight(0xffffff, 2.0);
  key.position.set(1.5, 3, 4);
  scene.add(key);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 30);
  const target = new THREE.WebGLRenderTarget(size, size, { samples: 4 });
  target.texture.colorSpace = THREE.SRGBColorSpace;
  const pixels = new Uint8Array(size * size * 4);
  const work = document.createElement('canvas');
  work.width = work.height = size;
  const wctx = work.getContext('2d');
  const image = wctx.createImageData(size, size);
  const prevClear = renderer.getClearAlpha();
  renderer.setClearColor(0x000000, 0);
  const result = {};
  for (const c of characters) {
    const { scene: pet } = cloneModel(c.pet);
    pet.rotation.y = 0.2;
    scene.add(pet);
    pet.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(pet);
    const h = box.max.y - box.min.y;
    const headH = h * (HEAD_FRAC[c.id] ?? 0.5);
    const half = Math.max(headH, Math.min(box.max.x - box.min.x, headH * 1.3)) * 0.55;
    const cx = (box.min.x + box.max.x) / 2;
    const cy = box.max.y - headH / 2;
    camera.left = -half;
    camera.right = half;
    camera.top = half;
    camera.bottom = -half;
    camera.updateProjectionMatrix();
    camera.position.set(cx + 1.2, cy + 1.0, 6);
    camera.lookAt(cx, cy, 0);
    renderer.setRenderTarget(target);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.readRenderTargetPixels(target, 0, 0, size, size, pixels);
    for (let y = 0; y < size; y++) image.data.set(pixels.subarray((size - 1 - y) * size * 4, (size - y) * size * 4), y * size * 4);
    wctx.putImageData(image, 0, 0);
    const out = document.createElement('canvas');
    out.width = out.height = size;
    out.getContext('2d').drawImage(work, 0, 0);
    result[c.id] = out;
    scene.remove(pet);
  }
  renderer.setRenderTarget(null);
  renderer.setClearColor(0x000000, prevClear);
  target.dispose();
  return result;
}
