// "Dinozor Vadisi" — devasa dinozorların otladığı tarih öncesi bir vadi. Yamaçlardan yuvarlanan kayalar,
// dinozor ayak darbeleri, bataklık ve dere geçidi var; kısayol bir yarığı rampayla aşar.
// Kontrol noktaları: [x, z, yükseklik]. (Quaternius Dinosaur + Ultimate Nature paketleri)

const TREES = ['nat2/CommonTree_1', 'nat2/CommonTree_2', 'nat2/CommonTree_3', 'nat2/PalmTree_1', 'nat2/PalmTree_2', 'nat2/PalmTree_3', 'nat2/Willow_1', 'nat2/Willow_2', 'nat2/Willow_3', 'nat2/PineTree_1', 'nat2/PineTree_2'];
const DEAD = ['nat2/Willow_Dead_1', 'nat2/Willow_Dead_2', 'nat2/Willow_Dead_3', 'nat2/CommonTree_Dead_1', 'nat2/CommonTree_Dead_2'];
const BUSHES = ['nat2/Bush_1', 'nat2/Bush_2', 'nat2/BushBerries_1', 'nat2/BushBerries_2', 'nat2/Plant_1', 'nat2/Plant_2', 'nat2/Plant_3', 'nat2/Grass_2'];
const ROCKS = ['nat2/Rock_1', 'nat2/Rock_2', 'nat2/Rock_3', 'nat2/Rock_Moss_1', 'nat2/Rock_Moss_2', 'nat2/Rock_Moss_3'];
const DINOS = ['dino/Trex', 'dino/Triceratops', 'dino/Stegosaurus', 'dino/Apatosaurus', 'dino/Parasaurolophus', 'dino/Velociraptor'];

export default {
  id: 'dinoValley',
  name: 'Dinozor Vadisi',
  kartBody: 'karts/kart-dinoValley', // haritaya özel araç gövdesi (tools/gen_kart.py)
  meta: 'Tarih öncesi · bataklık · kaya',
  groundTex: { tex: 'grass', rock: 'rock', scale: 0.13, strength: 1.0 }, // ambientCG (CC0) detay dokusu; sadece Yüksek kalite
  roadTex: 'asphalt_n', // yol normal haritası (ambientCG, CC0); Orta/Yüksek kalite
  halfWidth: 8,
  curbWidth: 1,
  shoulder: 5,
  terrainSize: 780,
  shoreMargin: () => 90,
  outer: 'mountains',
  baseHeight: 0,
  ponds: [{ x: 0, z: 0, r: 32 }], // vadinin ortasındaki göl
  palette: { base: 0x7bb35a, shore: 0x5a9145, patch: 0x95c961, patchDark: 0x7aae4a, shoulder: 0xc2ad78, cliff: 0x8f7c5a },
  roadStyle: { base: '#8c6a47', blotchDark: '62,40,22', blotchLight: '178,136,92', line: '#f3e6c3', curbs: [0xf3e6c3, 0x8a5a2e] },
  dust: [0.78, 0.66, 0.46],
  sky: { top: 0x5aa8e4, horizon: 0xffe8b4, fog: 0xf1e2b6 },
  skyTex: { id: 'qwantani_late_afternoon_puresky', az: 0.6289, mix: 0.45 }, // Poly Haven (CC0) gökyüzü; Düşük kalitede kapalı
  water: { shallow: 0x7ee0b8, deep: 0x2a8f7e },
  light: { hemiSky: 0xfff0d0, hemiGround: 0x7a9a50, hemi: 1.05, sun: 0xfff0d6, sunI: 2.8, sunDir: [-0.45, 0.65, 0.4], glow: 0xffe9bc, fogNear: 200, fogFar: 740 },
  control: [
    // Yükseklik profili: start düzlüğü (7 m) → göl çanağına iniş → Dev Sırt tırmanışı (16 m) → dik iniş → dinozor izi tümsekleri
    [179, 46, 7],
    [110, 75, 6.8],
    [54, 75, 6],
    [28, 101, 4.6],
    [-12, 157, 2.2],
    [-81, 180, -0.25], // dere geçidi: yol suyun altında kalır (hız %10 düşer)
    [-129, 133, 0.8], // vadi tabanı (bataklık), tırmanış başlıyor
    [-120, 57, 7],
    [-92, 9, 12.5],
    [-102, -26, 15], // sırt zirvesi
    [-123, -67, 13.5], // kısayol girişi
    [-115, -161, 3.5],
    [-50, -178, 1.2],
    [13, -128, 1], // kısayol çıkışı
    [38, -84, 1.6],
    [73, -75, 2.2],
    [142, -68, 3.2],
    [197, -20, 5],
  ],
  hillReach: 150, // yol yükseldikçe çevresindeki yamaç da yola kadar yükselir
  // Uzun virajlarda yol içe yatar (iç kenar alçalır)
  bank: [{ f: [0.2, 0.32], deg: 7 }, { f: [0.58, 0.71], deg: 11 }],
  // Son düzlükte art arda çukur-tümsek ("dinozor izi")
  bumps: [{ f: [0.455, 0.505], amp: 1.6, period: 30 }, { f: [0.8, 0.93], amp: 1.6, period: 34 }], // 1. sırt zirvesinde atlayış, 2. dinozor izi

  // Zemin bölgeleri: ana yolda zorunlu bataklık
  zones: [{ type: 'mud', f: [0.322, 0.352], lateral: [-8, 8] }],

  hazards: [
    // Yamaçlardan yuvarlanan kayalar
    { type: 'ball', skin: 'rock', ballRadius: 2.6, f: 0.08, period: 12, offset: 3, dir: 1 },
    { type: 'ball', skin: 'rock', ballRadius: 2.6, f: 0.27, period: 11, offset: 7, dir: -1 },
    { type: 'ball', skin: 'rock', ballRadius: 2.6, f: 0.9, period: 12, offset: 1, dir: 1 },
    // Dinozor ayak darbeleri: halka kızarır, toprak ve toz fışkırır
    ...[0.22, 0.41, 0.6, 0.67, 0.84].map((f, k) => ({
      type: 'geyser',
      f,
      lateral: k % 2 ? 3.5 : -3.5,
      radius: 4.4,
      period: 7.5 + (k % 3) * 0.5,
      offset: (k * 2.4) % 7,
      colors: { ring: [1.5, 0.85, 0.3], column: [1.4, 0.95, 0.45], ember: [1.4, 1.0, 0.5], hot: [1.9, 1.5, 0.8], smoke: [0.62, 0.5, 0.34] },
    })),
  ],

  // Kısayol: iki dinozor ayağı arasından geçen yarık yolu; ortada çatlağı aşan rampa var.
  shortcuts: [
    {
      id: 'ravineLeap',
      name: 'Yarık Atlayışı',
      points: [[-123, -67], [-89, -82], [-55, -98], [-21, -113], [13, -128]],
      halfWidth: 4.4,
      surface: 'dirt',
      speed: 0.78,
      color: 0x8a7248,
      jump: { at: [-55, -98], ramp: 12, height: 2.4, gap: 12, depth: 5.5, landing: 14, drop: 0.7, rampColor: 0xa8884e, water: 0x3a3a2a, fallText: 'Yarığa düştün! 🦖' },
      boxes: { at: 'landing', lateral: [-2, 2] },
      edge: { keys: ['nat2/Rock_1', 'nat2/Rock_2', 'nat2/Rock_Moss_1', 'nat2/Rock_Moss_2'], step: 5, scale: [4, 6.5] },
      botChance: 0.5,
      botMinSpeed: 22,
    },
    // Süpriz yolu: ana yolla aynı uzunlukta; sonunda altın kutu (çift hak)
    {
      id: 'nest',
      name: 'Yumurta Yuvası',
      follow: { from: 0.104, to: 0.286, side: 1, lateral: 24 },
      halfWidth: 3.8,
      surface: 'dirt',
      speed: 0.94,
      color: 0x8a7a4a,
      surprise: { skin: 'egg', f: 0.78 },
      edge: { keys: ['nat2/Rock_Moss_1', 'nat2/Rock_Moss_2', 'nat2/Cactus_1', 'nat2/Plant_2'], step: 5, scale: [4, 7] },
      botChance: 0.2,
    },
  ],

  models: [
    'racing/barrierRed', 'racing/barrierWhite', 'racing/overheadLights', 'racing/flagCheckers', 'racing/grandStandCovered', 'racing/bannerTowerRed', 'racing/bannerTowerGreen',
    ...TREES, ...DEAD, ...BUSHES, ...ROCKS, 'nat2/Cactus_1', 'nat2/Cactus_2', ...DINOS,
  ],

  decorate(ctx) {
    const { track, rng } = ctx;
    const hw = this.halfWidth;
    const edge = track.edge;
    const terrain = track.terrain;
    const probe = ctx.along(0, 30);
    const outerSide = track.insideLoop(probe.x, probe.z) ? -1 : 1;
    const innerSide = -outerSide;
    const half = terrain.size / 2 - 8;

    // --- Başlangıç ---
    const gantry = ctx.along(0, 0);
    ctx.place('racing/overheadLights', gantry.x, gantry.z, gantry.acrossY, (2 * (hw + 1) + 3) / 1.26, track.centerline[0].y - 0.15);
    for (const s of [-1, 1]) {
      const f = ctx.along(1, s * (hw + 3));
      ctx.place('racing/flagCheckers', f.x, f.z, f.faceTrackY, 7);
    }
    for (let k = -2; k <= 1; k++) {
      const g = ctx.along(k * 5, outerSide * (edge + 7));
      ctx.place('racing/grandStandCovered', g.x, g.z, g.faceTrackY, 10);
      ctx.reserve(g.x, g.z, 12);
    }
    for (let k = -26; k <= 26; k += 8) {
      if (Math.abs(k) < 4) continue;
      const b = ctx.along(k, innerSide * (edge + 2.5));
      ctx.place(k % 16 ? 'racing/bannerTowerGreen' : 'racing/bannerTowerRed', b.x, b.z, b.faceTrackY, 9);
    }
    for (const sc of track.shortcuts) {
      for (const s of [4, sc.length - 4]) {
        for (const side of [-1, 1]) {
          const b = ctx.shortcutAt(sc, s, side * (sc.halfAt(s) + 3));
          ctx.place(s < 10 ? 'racing/bannerTowerGreen' : 'racing/bannerTowerRed', b.x, b.z, b.faceTrackY, 9);
        }
      }
      for (const s of sc.jump ? [sc.jump.rampA - 6, sc.jump.rampA + 2, sc.jump.pitB + 2] : []) {
        for (const side of [-1, 1]) {
          const f = ctx.shortcutAt(sc, s, side * (sc.halfWidth + 1.8));
          ctx.place('racing/flagCheckers', f.x, f.z, f.faceTrackY, 6);
        }
      }
    }

    // --- Dev dinozorlar ve bitki örtüsü (çakışma denetimli) ---
    const taken = [];
    const put = (keys, [a, b], fp, dMin, dMax, count, opts = {}) => {
      let placed = 0;
      for (let tries = 0; placed < count * ctx.density && tries < count * 120; tries++) {
        const x = (rng() * 2 - 1) * half;
        const z = (rng() * 2 - 1) * half;
        const d = terrain.roadDistAt(x, z);
        if (d < dMin || d > dMax) continue;
        if (terrain.landAt(x, z) < 4) continue; // gölün içine koyma
        if (track.shortcutClearance(x, z) < 10) continue;
        const s = a + rng() * (b - a);
        const r = fp * s;
        if (taken.some(([tx, tz, tr]) => (x - tx) ** 2 + (z - tz) ** 2 < (r + tr) ** 2)) continue;
        taken.push([x, z, r]);
        ctx.reserve(x, z, r);
        ctx.place(keys[Math.floor(rng() * keys.length)], x, z, opts.face ? Math.atan2(-x, -z) + (rng() - 0.5) * 1.2 : rng() * Math.PI * 2, s);
        placed++;
      }
    };
    const off = edge + 6;
    put(['dino/Trex'], [1.0, 1.25], 0.4, off + 40, 160, 3, { face: true });
    put(['dino/Triceratops', 'dino/Stegosaurus'], [1.0, 1.4], 0.4, off + 34, 150, 6, { face: true });
    put(['dino/Apatosaurus'], [0.9, 1.2], 0.45, off + 50, 170, 2, { face: true });
    put(['dino/Parasaurolophus', 'dino/Velociraptor'], [1.4, 2.2], 0.45, off + 14, 120, 8, { face: true });
    put(TREES, [5.5, 9], 0.45, off + 2, 140, 120);
    put(DEAD, [5, 8], 0.4, off + 6, 130, 24);
    put(ROCKS, [5, 11], 0.5, off, 130, 60);
    put(BUSHES, [4, 8], 0.5, off - 2, 100, 90);
    put(['nat2/Cactus_1', 'nat2/Cactus_2'], [6, 9], 0.4, off + 8, 120, 6);
  },
};
