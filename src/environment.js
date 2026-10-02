import * as THREE from 'three';

// Gökyüzü, ışıklar, sis ve su. Renkler pist tanımından gelir (setTrack).

const SKY_TOP = new THREE.Color(0x3d9df2);
const SKY_HORIZON = new THREE.Color(0xcdeeff);
export const SUN_DIR = new THREE.Vector3(-0.5, 0.62, 0.5).normalize();
const SUN_GLOW = new THREE.Color(1.0, 0.92, 0.75);

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
        glow: { value: SUN_GLOW },
        skyTex: { value: null }, // Poly Haven gökyüzü (public/sky/*.jpg), yoksa gradyan
        useTex: { value: 0 },
        texMix: { value: 0.3 },
        texDim: { value: 1 },
        texRot: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 glow;
        uniform sampler2D skyTex; uniform float useTex; uniform float texMix; uniform float texDim; uniform float texRot;
        varying vec3 vDir;
        void main() {
          float h = max(vDir.y, 0.0);
          vec3 col = mix(horizon, top, pow(h, 0.55));
          if (useTex > 0.5) {
            // Ekvirektangüler gökyüzü: güneşi pistin ışık yönüne döndür, ufuk bandını sis rengine karıştır, palete yaklaştır
            float a = atan(vDir.z, vDir.x) - texRot;
            float el = asin(clamp(vDir.y, -1.0, 1.0));
            vec2 uv = vec2(a / 6.2831853 + 0.5, clamp((0.5 - el / 3.14159265) / 0.56, 0.0, 1.0));
            vec3 t = texture2D(skyTex, uv).rgb * texDim;
            t = mix(t, col, texMix);
            col = mix(col, t, smoothstep(0.0, 0.3, vDir.y));
          }
          float sun = max(dot(vDir, sunDir), 0.0);
          col += glow * (pow(sun, 350.0) * 3.0 + pow(sun, 12.0) * 0.18) * (1.0 - 0.75 * useTex);
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
  const stars = createStars();
  scene.add(stars);
  // Uzay pistleri: gökyüzünde büyük mavi Dünya
  const earth = createEarth();
  scene.add(earth);
  const snow = createSnow(Math.max(0.3, quality.particles ?? 1));
  scene.add(snow.points);
  // Kor parçacıkları: yanardağ pistinde yukarı doğru süzülen kıvılcımlar
  const embers = createSnow(Math.max(0.3, quality.particles ?? 1) * 0.5, { rise: true, size: 0.22, color: 0xff8a30, additive: true, opacity: 0.95 });
  scene.add(embers.points);

  // --- Işıklar ---
  const hemi = new THREE.HemisphereLight(0xd6efff, 0xe9cf9c, 0.95);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff0d8, 3.1);
  const skyU = sky.material.uniforms;
  const skyCache = new Map();
  let skyWanted = null;
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

  function loadSky(id) {
    if (!skyCache.has(id)) {
      skyCache.set(
        id,
        new Promise((resolve) => {
          new THREE.TextureLoader().load(
            `/sky/${id}.jpg`,
            (tex) => {
              tex.colorSpace = THREE.SRGBColorSpace;
              tex.flipY = false;
              tex.wrapS = THREE.RepeatWrapping;
              tex.generateMipmaps = false;
              tex.minFilter = THREE.LinearFilter;
              resolve(tex);
            },
            undefined,
            () => resolve(null),
          );
        }),
      );
    }
    return skyCache.get(id);
  }

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

      // Işık ve atmosfer (gece / kış pistleri için); tanımda yoksa gündüz varsayılanları
      const L = def.light ?? {};
      hemi.color.set(L.hemiSky ?? 0xd6efff);
      hemi.groundColor.set(L.hemiGround ?? 0xe9cf9c);
      hemi.intensity = L.hemi ?? 0.95;
      sun.color.set(L.sun ?? 0xfff0d8);
      sun.intensity = L.sunI ?? 3.1;
      SUN_DIR.set(...(L.sunDir ?? [-0.5, 0.62, 0.5])).normalize();
      SUN_GLOW.set(L.glow ?? 0xffebbf);
      scene.fog.near = L.fogNear ?? 160;
      scene.fog.far = L.fogFar ?? 620;
      clouds.visible = !def.night && !def.noClouds && !def.space;
      // Gerçek gökyüzü dokusu (Orta/Yüksek kalite): yüklenince gradyanın yerini alır, yapay bulutlar gizlenir
      skyU.useTex.value = 0;
      skyWanted = quality.sky && def.skyTex ? def.skyTex : null;
      if (skyWanted) {
        const want = skyWanted;
        loadSky(want.id).then((tex) => {
          if (skyWanted !== want || !tex) return;
          skyU.skyTex.value = tex;
          skyU.texMix.value = want.mix ?? 0.3;
          skyU.texDim.value = want.dim ?? 1;
          skyU.texRot.value = Math.atan2(SUN_DIR.z, SUN_DIR.x) - want.az;
          skyU.useTex.value = 1;
          clouds.visible = false;
        });
      }
      earth.visible = !!def.space;
      if (water) water.visible = !def.noWater;
      stars.visible = !!def.night || !!def.space;
      // Kar yağışı (beyaz) ya da kül yağışı (koyu, yavaş)
      snow.points.visible = !!def.snow || !!def.ash;
      snow.style(def.ash ? { color: 0x55504d, size: 0.5, opacity: 0.7, speed: 0.45 } : { color: 0xffffff, size: 0.3, opacity: 0.9, speed: 1 });
      embers.points.visible = !!def.embers;
    },
    update(dt, focus, camera) {
      if (water) water.material.uniforms.time.value += dt;
      if (snow.points.visible) snow.update(dt, camera);
      if (embers.points.visible) embers.update(dt, camera);
      if (stars.visible) stars.position.copy(camera.position);
      if (earth.visible) earth.position.copy(camera.position);
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
        lava: { value: colors.lava ? 1 : 0 },
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
      uniform vec3 shallow; uniform vec3 deep; uniform vec3 foam; uniform float lava;
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
        if (lava > 0.5) {
          // Lav: yavaş akan sıcak damarlar, kıyıda soğuyup kararan kabuk
          float n = sin(vWorld.x * 0.12 + time * 0.35) * sin(vWorld.z * 0.14 - time * 0.3)
                  + 0.6 * sin((vWorld.x + vWorld.z) * 0.07 + time * 0.25)
                  + 0.35 * sin(vWorld.x * 0.33 - time * 0.7) * sin(vWorld.z * 0.31 + time * 0.55);
          vec3 lv = mix(deep, shallow, smoothstep(-0.5, 1.1, n));
          lv = mix(lv, vec3(1.0, 0.85, 0.35), smoothstep(0.85, 1.4, n) * 0.6);
          float crust = 1.0 - smoothstep(0.0, 0.9, depth + 0.3 * w2);
          lv = mix(lv, vec3(0.05, 0.02, 0.015), crust * 0.8);
          gl_FragColor = vec4(lv * 1.25, 1.0);
        }
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


// Dünya: gökyüzünde asılı duran mavi-yeşil küre (canvas dokusu), çevresinde ince hale
function createEarth() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#1d5fc2';
  g.fillRect(0, 0, 512, 256);
  let seed = 99;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  // Kıtalar: üst üste bindirilmiş yeşil-kahve lekeler
  for (let i = 0; i < 46; i++) {
    const x = rnd() * 512;
    const y = 30 + rnd() * 196;
    const r = 10 + rnd() * 34;
    g.fillStyle = rnd() < 0.6 ? 'rgba(74,156,78,0.92)' : 'rgba(160,140,86,0.9)';
    g.beginPath();
    g.ellipse(x, y, r * 1.4, r, rnd() * Math.PI, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = 'rgba(245,250,255,0.95)';
  g.fillRect(0, 0, 512, 16);
  g.fillRect(0, 240, 512, 16);
  // Bulutlar
  for (let i = 0; i < 70; i++) {
    g.fillStyle = `rgba(255,255,255,${0.2 + rnd() * 0.35})`;
    g.beginPath();
    g.ellipse(rnd() * 512, rnd() * 256, 14 + rnd() * 40, 3 + rnd() * 7, 0, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const group = new THREE.Group();
  const globe = new THREE.Mesh(new THREE.SphereGeometry(110, 40, 24), new THREE.MeshBasicMaterial({ map: tex, fog: false }));
  globe.rotation.set(0.4, 2.2, 0.35);
  const halo = document.createElement('canvas');
  halo.width = halo.height = 128;
  const hg = halo.getContext('2d');
  const grad = hg.createRadialGradient(64, 64, 40, 64, 64, 64);
  grad.addColorStop(0, 'rgba(120,180,255,0.55)');
  grad.addColorStop(1, 'rgba(120,180,255,0)');
  hg.fillStyle = grad;
  hg.fillRect(0, 0, 128, 128);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(halo), transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
  glow.scale.setScalar(300);
  group.add(glow, globe);
  group.position.set(0, 0, 0);
  globe.position.set(0, 0, 0);
  // Gökyüzünde sabit bir yön
  group.children.forEach((o) => o.position.set(-150, 150, -560));
  group.renderOrder = -1;
  group.traverse((o) => { o.renderOrder = -1; o.frustumCulled = false; });
  group.visible = false;
  return group;
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

// Gece gökyüzü: küçük sabit yıldızlar
function createStars() {
  const n = 420;
  const pos = new Float32Array(n * 3);
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2;
    const y = 0.08 + rnd() * 0.92;
    const r = Math.sqrt(1 - y * y);
    pos.set([Math.cos(a) * r * 850, y * 850, Math.sin(a) * r * 850], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xdfe8ff, size: 2.2, sizeAttenuation: false, fog: false, depthWrite: false, transparent: true, opacity: 0.9 }));
  stars.frustumCulled = false;
  stars.renderOrder = -1;
  stars.visible = false;
  return stars;
}

// Kar yağışı: kameranın etrafında dönen küçük bir küp hacimde süzülen parçacıklar
function createSnow(scale, { rise = false, size = 0.3, color = 0xffffff, additive = false, opacity = 0.9 } = {}) {
  const n = Math.round(650 * scale);
  const SIZE = 56;
  const pos = new Float32Array(n * 3);
  const speed = new Float32Array(n);
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < n; i++) {
    pos.set([(rnd() - 0.5) * SIZE, rnd() * SIZE * 0.6 - 8, (rnd() - 0.5) * SIZE], i * 3);
    speed[i] = 1.6 + rnd() * 2.2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const material = new THREE.PointsMaterial({ map: flakeTexture(), color, size, sizeAttenuation: true, depthWrite: false, transparent: true, opacity, alphaTest: 0.05, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
  const points = new THREE.Points(geo, material);
  points.frustumCulled = false;
  points.visible = false;
  let t = 0;
  let k = 1; // hız çarpanı
  return {
    points,
    // Pist değişince görünümü ayarla (kar ↔ kül)
    style(s) {
      material.color.set(s.color);
      material.size = s.size;
      material.opacity = s.opacity;
      k = s.speed;
    },
    update(dt, camera) {
      t += dt;
      const a = geo.attributes.position;
      const dir = rise ? 1 : -1;
      for (let i = 0; i < n; i++) {
        let y = a.getY(i) + dir * speed[i] * k * dt * (rise ? 0.7 : 1);
        if (!rise && y < -8) y += SIZE * 0.6;
        if (rise && y > SIZE * 0.6 - 8) y -= SIZE * 0.6;
        a.setY(i, y);
        a.setX(i, a.getX(i) + Math.sin(t * 0.7 + i) * 0.35 * dt);
      }
      a.needsUpdate = true;
      points.position.copy(camera.position);
    },
  };
}

// Yuvarlak, yumuşak kenarlı kar tanesi dokusu
function flakeTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(16, 16, 1, 16, 16, 15);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.8)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}
