import * as THREE from 'three';

// Gökyüzü, ışıklar, sis ve su. Renkler pist tanımından gelir (setTrack).

const SKY_TOP = new THREE.Color(0x3d9df2);
const SKY_HORIZON = new THREE.Color(0xcdeeff);
export const SUN_DIR = new THREE.Vector3(-0.5, 0.62, 0.5).normalize();

export function createEnvironment(scene, quality) {
  scene.background = SKY_HORIZON.clone();
  scene.fog = new THREE.Fog(0xc4e8fb, 160, 620);

  // --- Gökyüzü kubbesi ---
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(900, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: SKY_TOP },
        horizon: { value: SKY_HORIZON },
        sunDir: { value: SUN_DIR },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir;
        varying vec3 vDir;
        void main() {
          float h = max(vDir.y, 0.0);
          vec3 col = mix(horizon, top, pow(h, 0.55));
          float sun = max(dot(vDir, sunDir), 0.0);
          col += vec3(1.0, 0.92, 0.75) * (pow(sun, 350.0) * 3.0 + pow(sun, 12.0) * 0.18);
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }),
  );
  sky.renderOrder = -1;
  sky.frustumCulled = false;
  scene.add(sky);

  // Basit bulutlar: yumuşak beyaz kümeler (düşük poligon küreler yerine düz billboard'lar)
  const clouds = createClouds();
  scene.add(clouds);

  // --- Işıklar ---
  const hemi = new THREE.HemisphereLight(0xd6efff, 0xe9cf9c, 0.95);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff0d8, 3.1);
  sun.castShadow = quality.shadows;
  if (quality.shadows) {
    sun.shadow.mapSize.set(quality.shadowSize, quality.shadowSize);
    const s = 42;
    Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 220 });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.04;
    sun.shadow.radius = 3;
  }
  scene.add(sun, sun.target);

  // --- Su (pist değişince yeniden kurulur) ---
  let water = null;

  return {
    sun,
    // Pist değişti: gökyüzü, sis ve su renklerini + su derinlik haritasını güncelle
    setTrack(def, terrain) {
      const sky2 = def.sky ?? {};
      SKY_TOP.set(sky2.top ?? 0x3d9df2);
      SKY_HORIZON.set(sky2.horizon ?? 0xcdeeff);
      scene.background.copy(SKY_HORIZON);
      scene.fog.color.set(sky2.fog ?? 0xc4e8fb);
      if (water) {
        scene.remove(water);
        water.geometry.dispose();
        water.material.uniforms.heightMap.value.dispose();
        water.material.dispose();
      }
      water = createWater(terrain, def.water);
      scene.add(water);
    },
    update(dt, focus, camera) {
      if (water) water.material.uniforms.time.value += dt;
      // Gölge kamerası odağı takip etsin (texel'e hizalı, titreme olmasın)
      const step = (42 * 2) / (quality.shadowSize || 1024);
      const fx = Math.round(focus.x / step) * step;
      const fz = Math.round(focus.z / step) * step;
      sun.target.position.set(fx, focus.y, fz);
      sun.position.set(fx, focus.y, fz).addScaledVector(SUN_DIR, 120);
      sky.position.copy(camera.position);
      clouds.position.set(camera.position.x, 0, camera.position.z);
    },
  };
}

function createWater(terrain, colors = {}) {
  // Zemin yüksekliğini dokuya çevir: sığlık ve köpük hesabı için
  const n = terrain.res + 1;
  const data = new Uint8Array(n * n);
  for (let k = 0; k < n * n; k++) data[k] = Math.max(0, Math.min(255, ((terrain.heights[k] + 6) / 8) * 255));
  const heightTex = new THREE.DataTexture(data, n, n, THREE.RedFormat, THREE.UnsignedByteType);
  heightTex.magFilter = THREE.LinearFilter;
  heightTex.minFilter = THREE.LinearFilter;
  heightTex.needsUpdate = true;

  const geo = new THREE.PlaneGeometry(2400, 2400, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    fog: true,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        time: { value: 0 },
        heightMap: { value: heightTex },
        terrainSize: { value: terrain.size },
        shallow: { value: new THREE.Color(colors.shallow ?? 0x3fe0d0) },
        deep: { value: new THREE.Color(colors.deep ?? 0x1673c9) },
        foam: { value: new THREE.Color(0xffffff) },
      },
    ]),
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      #include <fog_pars_vertex>
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        vec4 mvPosition = viewMatrix * world;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform float time; uniform sampler2D heightMap; uniform float terrainSize;
      uniform vec3 shallow; uniform vec3 deep; uniform vec3 foam;
      varying vec3 vWorld;
      #include <fog_pars_fragment>
      void main() {
        vec2 uv = vWorld.xz / terrainSize + 0.5;
        float h = -6.0;
        if (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) h = texture2D(heightMap, uv).r * 8.0 - 6.0;
        float depth = max(-h, 0.0);

        float w1 = sin(vWorld.x * 0.21 + time * 1.3) * sin(vWorld.z * 0.17 - time * 1.1);
        float w2 = sin((vWorld.x + vWorld.z) * 0.08 - time * 0.7);
        vec3 col = mix(shallow, deep, smoothstep(0.2, 4.5, depth + w2 * 0.3));

        // Kıyı köpüğü: sığlıkta, dalgalarla ileri geri
        float edge = 0.35 + 0.18 * sin(time * 1.6 + vWorld.x * 0.07 + vWorld.z * 0.05);
        float foamAmt = 1.0 - smoothstep(edge * 0.4, edge, depth + w1 * 0.06);
        col = mix(col, foam, foamAmt * 0.9);

        // Hafif dalga ışığı (eğik iki dalganın çarpımı)
        float ga = sin(dot(vWorld.xz, vec2(0.23, 0.11)) + time * 1.4);
        float gb = sin(dot(vWorld.xz, vec2(-0.13, 0.27)) - time * 1.1);
        col *= 0.95 + 0.07 * ga * gb;

        float alpha = mix(0.55, 1.0, smoothstep(0.0, 3.5, depth));
        alpha = max(alpha, foamAmt);
        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0;
  mesh.renderOrder = 1;
  return mesh;
}

// Uzakta süzülen yumuşak bulutlar (canvas dokulu sprite'lar)
function createClouds() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const blobs = [[64, 72, 38], [36, 80, 26], [92, 80, 28], [52, 56, 26], [80, 58, 22]];
  for (const [x, y, r] of blobs) {
    const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.85)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const group = new THREE.Group();
  const mat = new THREE.SpriteMaterial({ map: tex, fog: false, depthWrite: false, transparent: true, opacity: 0.95 });
  for (let i = 0; i < 14; i++) {
    const s = new THREE.Sprite(mat);
    const a = (i / 14) * Math.PI * 2 + Math.random() * 0.3;
    const d = 520 + Math.random() * 180;
    s.position.set(Math.cos(a) * d, 90 + Math.random() * 90, Math.sin(a) * d);
    const size = 140 + Math.random() * 120;
    s.scale.set(size * 1.8, size, 1);
    group.add(s);
  }
  return group;
}
