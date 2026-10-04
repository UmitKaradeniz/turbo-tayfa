import * as THREE from 'three';

// Seyirciler: küp kafalı, kol sallayan basit figürler. spectators: [{ x, y, z, rot, scale }]. Hepsi 3 InstancedMesh (kafa, gövde, kollar) → 3 çizim çağrısı.
// Kol sallama köşe gölgelendiricisinde (uTime); CPU maliyeti yok. Gölge düşürmez. Yerleşim decor.js `ctx.crowdRow`.

const SHIRTS = ['#ff5a5f', '#ffd23f', '#3fc1c9', '#8a6cf0', '#ff9f43', '#38c172', '#ffffff', '#ff6fb5'];
const SKINS = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];
const ARM_LEN = 0.6;
const uTime = { value: 0 };

// Pivotu üst ucunda olan kol (aşağı sarkar)
const armGeometry = () => new THREE.BoxGeometry(0.15, ARM_LEN, 0.15).translate(0, -ARM_LEN / 2, 0);

export function buildCrowd(spectators) {
  const n = spectators.length;
  const group = new THREE.Group();
  const heads = new THREE.InstancedMesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), new THREE.MeshLambertMaterial(), n);
  const bodies = new THREE.InstancedMesh(new THREE.BoxGeometry(0.52, 1.0, 0.32).translate(0, 0.5, 0), new THREE.MeshLambertMaterial(), n);
  const armGeo = armGeometry();
  const arms = new THREE.InstancedMesh(armGeo, new THREE.MeshLambertMaterial(), n * 2);
  const phase = new Float32Array(n * 2 * 3); // (faz, hız, taraf) kol başına
  const base = new THREE.Matrix4();
  const local = new THREE.Matrix4();
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const UP = new THREE.Vector3(0, 1, 0);
  const pos = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const color = new THREE.Color();
  let seed = 4242; // sabit tohum: dekorun ana rng dizisini bozmaz, her yüklemede aynı kalabalık
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pick = (a) => a[Math.floor(rnd() * a.length)];

  spectators.forEach((p, i) => {
    const s = { ...p, shirt: pick(SHIRTS), skin: pick(SKINS), phase: rnd() * 6.28, speed: 3 + rnd() * 2.5 };
    base.compose(pos.set(s.x, s.y, s.z), q.setFromAxisAngle(UP, s.rot), sc.setScalar(s.scale));
    bodies.setMatrixAt(i, base);
    bodies.setColorAt(i, color.set(s.shirt));
    heads.setMatrixAt(i, m.multiplyMatrices(base, local.makeTranslation(0, 1.25, 0)));
    heads.setColorAt(i, color.set(s.skin));
    for (const side of [-1, 1]) {
      const k = i * 2 + (side > 0 ? 1 : 0);
      arms.setMatrixAt(k, m.multiplyMatrices(base, local.makeTranslation(side * 0.34, 0.95, 0)));
      arms.setColorAt(k, color.set(s.shirt));
      phase.set([s.phase + (side > 0 ? 0 : 0.9), s.speed, side], k * 3);
    }
  });
  armGeo.setAttribute('aArm', new THREE.InstancedBufferAttribute(phase, 3));

  // Kol açısı: 0.15 (aşağı) ile ~2.7 rad (yukarı) arası dalga; tepe noktasında biraz bekler
  arms.material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aArm;\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float w = sin(uTime * aArm.y + aArm.x) * 0.5 + 0.5;
        float a = aArm.z * (0.15 + 2.55 * smoothstep(0.15, 0.85, w));
        float ca = cos(a);
        float sa = sin(a);
        transformed.xy = vec2(ca * transformed.x - sa * transformed.y, sa * transformed.x + ca * transformed.y);`,
      );
  };
  arms.onBeforeRender = () => {
    uTime.value = performance.now() * 0.001;
  };

  for (const mesh of [heads, bodies, arms]) {
    mesh.frustumCulled = false; // sayı az; kol gölgelendirici hareketi sınır kürenin dışına taşabilir, hep çiz
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    group.add(mesh);
  }
  return group;
}
