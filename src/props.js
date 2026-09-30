import * as THREE from 'three';

// Küçük yordamsal dekor nesneleri (model dosyası gerektirmez).

let parts = null;

// Kardan adam: üç kar topu, havuç burun, kömür gözler, kırmızı atkı
export function createSnowman(scale = 1) {
  if (!parts) {
    parts = {
      white: new THREE.MeshStandardMaterial({ color: 0xf6f9ff, roughness: 0.9, flatShading: true }),
      coal: new THREE.MeshStandardMaterial({ color: 0x22242b, roughness: 0.8 }),
      carrot: new THREE.MeshStandardMaterial({ color: 0xff8a1f, roughness: 0.7 }),
      scarf: new THREE.MeshStandardMaterial({ color: 0xe23b36, roughness: 0.8 }),
      ball: new THREE.IcosahedronGeometry(1, 1),
      nose: new THREE.ConeGeometry(0.12, 0.55, 6),
      eye: new THREE.SphereGeometry(0.07, 6, 6),
      ring: new THREE.TorusGeometry(0.5, 0.11, 6, 12),
    };
  }
  const p = parts;
  const g = new THREE.Group();
  const add = (geo, mat, x, y, z, s = 1) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.scale.setScalar(s);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    return m;
  };
  add(p.ball, p.white, 0, 0.95, 0, 0.95);
  add(p.ball, p.white, 0, 2.2, 0, 0.72);
  add(p.ball, p.white, 0, 3.2, 0, 0.5);
  const nose = add(p.nose, p.carrot, 0, 3.2, 0.55);
  nose.rotation.x = Math.PI / 2;
  add(p.eye, p.coal, -0.18, 3.34, 0.42);
  add(p.eye, p.coal, 0.18, 3.34, 0.42);
  for (let i = 0; i < 3; i++) add(p.eye, p.coal, 0, 2.5 - i * 0.35, 0.68 - i * 0.05, 1.2);
  const ring = add(p.ring, p.scarf, 0, 2.85, 0);
  ring.rotation.x = Math.PI / 2;
  g.scale.setScalar(scale);
  return g;
}
