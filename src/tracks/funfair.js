// "Lunapark" — hız trenlerinin, dönme dolapların ve kurulu tezgâhların arasında kıvrılan bir eğlence parkı.
// Konfeti fıskiyeleri yolu tehlikeli yapar; kısayol vagon rayını rampayla aşar.
// Kontrol noktaları: [x, z, yükseklik].

export default {
  id: 'funfair',
  name: 'Lunapark',
  kartBody: 'karts/kart-funfair', // haritaya özel araç gövdesi (tools/gen_kart.py)
  meta: 'Hız treni · tezgâh · konfeti',
  halfWidth: 8,
  curbWidth: 1,
  shoulder: 5,
  terrainSize: 780,
  shoreMargin: () => 80,
  outer: 'mountains',
  baseHeight: 0,
  ponds: [],
  noWater: true,
  palette: { base: 0x9ad66c, shore: 0x7fbf55, patch: 0xf0cf8b, patchDark: 0xe0b472, shoulder: 0xd9d4ba, cliff: 0xc7a0e8 },
  roadStyle: { base: '#4a4f63', blotchDark: '30,34,52', blotchLight: '120,126,150', line: '#ffd23f', curbs: [0xffd23f, 0xff4f9a] },
  dust: [0.85, 0.82, 0.7],
  sky: { top: 0x5f9cff, horizon: 0xfff0cc, fog: 0xfff0d4 },
  skyTex: { id: 'sunflowers_puresky', az: 0.6473, mix: 0.3 }, // Poly Haven (CC0) gökyüzü; Düşük kalitede kapalı
  water: { shallow: 0xfff0cc, deep: 0xffe0a8 },
  light: { hemiSky: 0xfff3dc, hemiGround: 0x8fbf6a, hemi: 1.05, sun: 0xfff1d6, sunI: 2.9, sunDir: [-0.5, 0.6, 0.45], glow: 0xffedc4, fogNear: 220, fogFar: 760 },
  control: [
    [-20, 150, 1], // başlangıç
    [100, 160, 1.5],
    [185, 95, 2.5], // kısayol girişi
    [240, 58, 6], // zincir yokuşu: hız treninin tırmanışı
    [268, -10, 10],
    [240, -84, 14], // zirve
    [165, -115, 6], // kısayol çıkışı (dik inişin ortası)
    [95, -135, 1.8],
    [10, -140, 1.5],
    [-70, -125, 1.5],
    [-135, -85, 1],
    [-185, -20, 1.5],
    [-175, 50, 2],
    [-125, 105, 1.2],
  ],

  // Konfeti fıskiyeleri: mavi-mor halka parlayınca renkli konfeti fışkırır, içindeki kart savrulur
  hazards: [0.06, 0.3, 0.38, 0.55, 0.64, 0.86, 0.95].map((f, k) => ({
    type: 'geyser',
    f,
    lateral: k % 2 ? 3.5 : -3.5,
    radius: 4.2,
    period: 7 + (k % 3) * 0.5,
    offset: (k * 2.7) % 7,
    colors: { ring: [0.5, 0.9, 1.8], column: [0.7, 1.2, 1.9], ember: [1.4, 1.2, 2.6], hot: [2.6, 2.2, 0.9], smoke: [0.85, 0.9, 1.0] },
  })),

  // Kısayol: hız treni raylarının altından geçen yol; ortasında vagon boşluğunu aşan rampa var.
  hillReach: 130,
  // Hız treni: dik inişin virajında yol içe yatar, ardından iki deve hörgücü tümseği
  bank: [{ f: [0.42, 0.52], deg: 8 }],
  bumps: [{ f: [0.55, 0.65], amp: 1.3, period: 36 }],

  shortcuts: [
    {
      id: 'railLeap',
      name: 'Ray Atlayışı',
      points: [[185, 95], [189, 55], [185, 15], [180, -25], [172, -70], [165, -115]],
      halfWidth: 4.4,
      surface: 'dirt',
      speed: 0.85,
      color: 0xc9b98a,
      pads: [{ f: 0.5 }],
      jump: { at: [185, 15], ramp: 12, height: 2.4, gap: 12, depth: 5.5, landing: 14, drop: 0.7, rampColor: 0xff4f9a, water: 0x30344d, fallText: 'Ray boşluğuna düştün! 🎢' },
      boxes: { at: 'landing', lateral: [-2, 2] },
      edge: { keys: ['coaster/bench', 'coaster/trash', 'coaster/flowers', 'coaster/tree'], step: 6, scale: [7, 10] },
      botChance: 0.5,
      botMinSpeed: 22,
    },
    // Süpriz yolu: ana yolla aynı uzunlukta; sonunda altın kutu (çift hak)
    {
      id: 'circusTent',
      name: 'Cambaz Çadırı',
      follow: { from: 0.576, to: 0.752, side: -1, lateral: 24 },
      halfWidth: 3.8,
      surface: 'dirt',
      speed: 0.94,
      color: 0xc96a9a,
      surprise: { skin: 'balloons', f: 0.78 },
      edge: { keys: ['tayfa/balloon_bunch', 'coaster/flowers', 'tayfa/popcorn_cart', 'coaster/bench'], step: 5, scale: [6, 9] },
      botChance: 0.2,
    },
  ],

  // Zemin bölgeleri: hız şeritleri ve hız treni trambolini
  zones: [
    { type: 'boost', f: [0.1, 0.115], lateral: [-2.6, 2.6], color: '#ff4f9a' },
    { type: 'bounce', f: [0.68, 0.692], lateral: [-3.2, 3.2], color: '#ff4fd8' },
    { type: 'boost', f: [0.71, 0.725], lateral: [-2.6, 2.6], color: '#ffd23f' },
  ],

  models: [
    'tayfa/ferris_wheel', 'tayfa/popcorn_cart', 'tayfa/balloon_bunch',
    'racing/barrierRed', 'racing/barrierWhite', 'racing/overheadLights', 'racing/flagCheckers', 'racing/grandStandCovered', 'racing/bannerTowerRed', 'racing/bannerTowerGreen',
    ...['park-entrance', 'stall-drinks', 'stall-food', 'stall-information', 'station-gate', 'ride-entrance', 'coaster-steel-looping', 'coaster-steel-straight-hill-complete', 'coaster-wood-looping', 'coaster-mouse-looping', 'coaster-train', 'coaster-train-wooden', 'train-monorail', 'tree', 'tree-large', 'flowers', 'grass', 'bench', 'trash', 'support-large', 'coaster-steel-straight', 'coaster-wood-straight', 'coaster-monorail-looping', 'coaster-flume-looping'].map((k) => `coaster/${k}`),
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
    // Park girişi: başlangıç alanının arkasında
    const entrance = ctx.along(-6, innerSide * (edge + 24));
    ctx.place('coaster/park-entrance', entrance.x, entrance.z, entrance.faceTrackY, 9);
    ctx.reserve(entrance.x, entrance.z, 18);
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
    // Yol boyunca bankolar, çöp kutuları ve çiçekler
    for (let i = 12; i < track.count; i += 14) {
      const side = (i / 14) % 2 ? 1 : -1;
      const c = ctx.along(i, side * (edge + 2.2));
      if (track.shortcutClearance(c.x, c.z) < 4) continue;
      ctx.place(['coaster/bench', 'coaster/trash', 'coaster/flowers'][Math.floor(rng() * 3)], c.x, c.z, c.faceTrackY, 6 + rng() * 2);
    }

    // --- Dev lunapark: hız treni halkaları, tezgâhlar, ağaçlar (çakışma denetimli) ---
    const taken = [];
    const put = (keys, [a, b], fp, dMin, dMax, count) => {
      let placed = 0;
      for (let tries = 0; placed < count * ctx.density && tries < count * 120; tries++) {
        const x = (rng() * 2 - 1) * half;
        const z = (rng() * 2 - 1) * half;
        const d = terrain.roadDistAt(x, z);
        if (d < dMin || d > dMax) continue;
        if (track.shortcutClearance(x, z) < 12) continue;
        const s = a + rng() * (b - a);
        const r = fp * s;
        if (taken.some(([tx, tz, tr]) => (x - tx) ** 2 + (z - tz) ** 2 < (r + tr) ** 2)) continue;
        taken.push([x, z, r]);
        ctx.reserve(x, z, r);
        ctx.place(keys[Math.floor(rng() * keys.length)], x, z, rng() * Math.PI * 2, s);
        placed++;
      }
    };
    const off = edge + 12;
    put(['coaster/coaster-steel-looping', 'coaster/coaster-wood-looping', 'coaster/coaster-mouse-looping', 'coaster/coaster-monorail-looping', 'coaster/coaster-flume-looping'], [11, 14], 0.45, off + 25, 150, 7);
    put(['coaster/coaster-steel-straight-hill-complete'], [11, 14], 0.9, off + 20, 150, 5);
    put(['coaster/stall-drinks', 'coaster/stall-food', 'coaster/stall-information'], [9, 12], 0.55, off - 2, 120, 12);
    put(['coaster/ride-entrance', 'coaster/station-gate'], [9, 12], 0.7, off + 4, 130, 6);
    put(['coaster/coaster-train', 'coaster/coaster-train-wooden', 'coaster/train-monorail'], [8, 10], 0.65, off, 130, 7);
    put(['coaster/tree-large', 'coaster/tree'], [11, 15], 0.4, off - 4, 140, 40);
    put(['coaster/flowers', 'coaster/grass'], [8, 12], 0.5, off - 6, 130, 18);
    ctx.noShadow('coaster/flowers', 'coaster/grass');

    // --- Özel props (public/models/tayfa, tools/gen_props.py) ---
    put(['tayfa/ferris_wheel'], [22, 26], 0.5, off + 30, 150, 2);
    put(['tayfa/popcorn_cart'], [6, 8], 0.6, off - 2, 120, 8);
    put(['tayfa/balloon_bunch'], [7, 10], 0.5, off - 4, 120, 14);
  },
};
