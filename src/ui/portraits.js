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
