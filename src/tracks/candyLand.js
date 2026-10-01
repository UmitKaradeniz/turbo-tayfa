// "Şeker Diyarı" — pembe şekerden bir ülke: dev kekler, donutlar, lolipoplar ve dondurmalar arasında
// çikolata kaplı pist. Yolda çıkan pembe şeker fıskiyeleri kartları savurur; kısayol erimiş çikolata
// nehrini rampayla aşar. Kontrol noktaları: [x, z, yükseklik].

export default {
  id: 'candyLand',
  name: 'Şeker Diyarı',
  meta: 'Şeker · pasta · fıskiye',
  halfWidth: 8,
  curbWidth: 1,
  shoulder: 5,
  terrainSize: 700,
  shoreMargin: () => 80,
  outer: 'mountains',
  baseHeight: 0,
  ponds: [],
  noWater: true,
  noClouds: false,
  palette: { base: 0xffd2e6, shore: 0xf2b0cf, patch: 0xbff1d2, patchDark: 0xa2e5c3, shoulder: 0xffe4ef, cliff: 0xe3c4ff },
  roadStyle: { base: '#6e4029', blotchDark: '60,30,18', blotchLight: '150,96,62', line: '#ffe6f0', curbs: [0xffffff, 0xff6fa8] },
  dust: [1.0, 0.8, 0.9],
  sky: { top: 0x93d2ff, horizon: 0xffe0f0, fog: 0xffe6f2 },
  water: { shallow: 0xffd2e6, deep: 0xf2b0cf },
  light: { hemiSky: 0xfff1f8, hemiGround: 0xf0b9d4, hemi: 1.1, sun: 0xfff5ea, sunI: 2.6, sunDir: [-0.45, 0.7, 0.4], glow: 0xffe6f4, fogNear: 200, fogFar: 720 },
  control: [
    [-20, -140, 0.6], // başlangıç
    [85, -150, 0.6],
    [165, -100, 0.9],
    [190, -30, 1.6],
    [165, 40, 2.4],
    [110, 70, 2.8],
    [95, 125, 2.2],
    [30, 165, 1.4],
    [-55, 160, 0.9],
    [-110, 130, 0.8], // kısayol girişi
    [-175, 100, 1.2],
    [-220, 40, 1.8],
    [-215, -40, 1.4],
    [-165, -100, 0.9], // kısayol çıkışı
  ],

  // Pembe şeker fıskiyeleri: halka yanıp söner, sonra köpüklü şeker fışkırır
  hazards: [0.07, 0.22, 0.32, 0.4, 0.55, 0.68, 0.92].map((f, k) => ({
    type: 'geyser',
    f,
    lateral: k % 2 ? 3.5 : -3.5,
    radius: 4.2,
    period: 7 + (k % 3) * 0.5,
    offset: (k * 2.3) % 7,
    colors: { ring: [1.7, 0.45, 1.2], column: [1.8, 0.6, 1.4], ember: [2.3, 0.9, 1.7], hot: [2.6, 1.6, 2.2], smoke: [1.0, 0.82, 0.95] },
  })),

  // Kısayol: kurabiye yolu; ortasında erimiş çikolata nehrini aşan rampa var.
  shortcuts: [
    {
      id: 'chocoLeap',
      name: 'Çikolata Atlayışı',
      points: [[-110, 130], [-122, 88], [-135, 40], [-146, -8], [-156, -54], [-165, -100]],
      halfWidth: 4.4,
      surface: 'dirt',
      speed: 0.88,
      color: 0xd9a066,
      pads: [{ f: 0.14 }, { f: 0.86 }],
      jump: { at: [-135, 40], ramp: 12, height: 2.4, gap: 12, depth: 5.5, landing: 14, drop: 0.7, rampColor: 0xffffff, water: 0x6b3a22, fallText: 'Çikolataya battın! 🍫' },
      boxes: { at: 'landing', lateral: [-2, 2] },
      edge: { keys: ['food/cupcake', 'food/muffin', 'food/donut-sprinkles', 'food/cookie'], step: 6, scale: [14, 18] },
      botChance: 0.5,
      botMinSpeed: 22,
    },
  ],

  models: [
    'racing/barrierRed', 'racing/barrierWhite', 'racing/overheadLights', 'racing/flagCheckers', 'racing/grandStandCovered', 'racing/bannerTowerRed', 'racing/bannerTowerGreen',
    ...['cupcake', 'muffin', 'donut', 'donut-sprinkles', 'donut-chocolate', 'ice-cream', 'ice-cream-cup', 'sundae', 'lollypop', 'cake', 'cake-birthday', 'cookie', 'cookie-chocolate', 'candy-bar', 'popsicle', 'popsicle-chocolate', 'ginger-bread', 'strawberry', 'cherries', 'watermelon', 'pie', 'waffle', 'pancakes', 'pudding'].map((k) => `food/${k}`),
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

    // --- Başlangıç alanı ---
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
      for (const s of [sc.jump.rampA - 6, sc.jump.rampA + 2, sc.jump.pitB + 2]) {
        for (const side of [-1, 1]) {
          const f = ctx.shortcutAt(sc, s, side * (sc.halfWidth + 1.8));
          ctx.place('racing/flagCheckers', f.x, f.z, f.faceTrackY, 6);
        }
      }
    }
    // Yol kenarında lolipoplar: dizi halinde
    for (let i = 14; i < track.count; i += 16) {
      const side = (i / 16) % 2 ? 1 : -1;
      const c = ctx.along(i, side * (edge + 2));
      if (track.shortcutClearance(c.x, c.z) < 4) continue;
      ctx.place('food/lollypop', c.x, c.z, c.faceTrackY, 26 + rng() * 6);
    }

    // --- Dev tatlılar: üst üste binmesin diye çakışma denetimi ---
    const taken = [];
    const put = (keys, [a, b], fp, dMin, dMax, count) => {
      let placed = 0;
      for (let tries = 0; placed < count * ctx.density && tries < count * 120; tries++) {
        const x = (rng() * 2 - 1) * half;
        const z = (rng() * 2 - 1) * half;
        const d = terrain.roadDistAt(x, z);
        if (d < dMin || d > dMax) continue;
        if (track.shortcutClearance(x, z) < 10) continue;
        const s = a + rng() * (b - a);
        const r = fp * s;
        if (taken.some(([tx, tz, tr]) => (x - tx) ** 2 + (z - tz) ** 2 < (r + tr) ** 2)) continue;
        taken.push([x, z, r]);
        ctx.reserve(x, z, r);
        ctx.place(keys[Math.floor(rng() * keys.length)], x, z, rng() * Math.PI * 2, s);
        placed++;
      }
    };
    const bigCake = ctx.along(-6, outerSide * (edge + 70));
    ctx.place('food/cake-birthday', bigCake.x, bigCake.z, bigCake.faceTrackY, 40);
    taken.push([bigCake.x, bigCake.z, 18]);
    ctx.reserve(bigCake.x, bigCake.z, 18);
    const off = edge + 12;
    put(['food/cake', 'food/cake-birthday', 'food/pie'], [22, 30], 0.45, off + 8, 150, 8);
    put(['food/cupcake', 'food/muffin', 'food/pudding'], [36, 46], 0.2, off, 130, 14);
    put(['food/donut', 'food/donut-sprinkles', 'food/donut-chocolate'], [40, 52], 0.14, off, 130, 14);
    put(['food/ice-cream', 'food/ice-cream-cup', 'food/sundae'], [38, 50], 0.15, off, 130, 12);
    put(['food/lollypop'], [50, 66], 0.12, off, 130, 14);
    put(['food/popsicle', 'food/popsicle-chocolate'], [44, 56], 0.1, off, 130, 8);
    put(['food/waffle', 'food/pancakes', 'food/cookie', 'food/cookie-chocolate', 'food/ginger-bread'], [40, 60], 0.17, off, 130, 12);
    put(['food/strawberry', 'food/cherries'], [90, 120], 0.07, off, 130, 10);
    put(['food/watermelon', 'food/candy-bar'], [44, 56], 0.14, off, 140, 8);
  },
};
