// "Oyuncak Odası" — dev bir çocuk odasının zemininde, koca kanepelerin, kitaplıkların ve oyuncakların arasında
// turuncu bir oyuncak pisti. Yolu baştan başa kesen dev plaj topları, kutulardan geçen bir kısayol var.
// Kontrol noktaları: [x, z, yükseklik].

export default {
  id: 'toyRoom',
  name: 'Oyuncak Odası',
  meta: 'Dev oda · oyuncaklar · top',
  halfWidth: 8,
  curbWidth: 1,
  shoulder: 5,
  terrainSize: 640,
  shoreMargin: () => 92,
  outer: 'mountains',
  baseHeight: 0,
  ponds: [],
  noWater: true,
  noClouds: true,
  // Ahşap parke zemin, halı lekeleri (kırmızı "çim adacıkları"), duvar kâğıdı renginde yamaçlar
  palette: { base: 0xcf9f68, shore: 0xb98454, patch: 0xd35f5b, patchDark: 0xb54a4a, shoulder: 0xd9ad78, cliff: 0xbcd7f0 },
  roadStyle: { base: '#e0692a', blotchDark: '130,44,10', blotchLight: '255,176,96', line: '#ffffff', curbs: [0xffffff, 0x2f6fd6] },
  dust: [0.85, 0.72, 0.55],
  sky: { top: 0xbfdcff, horizon: 0xfff0dc, fog: 0xf6e8d6 },
  water: { shallow: 0xffdcb0, deep: 0xffc98c },
  light: { hemiSky: 0xfff3e0, hemiGround: 0xd8b088, hemi: 1.05, sun: 0xfff0d8, sunI: 2.5, sunDir: [-0.5, 0.75, 0.3], glow: 0xffe9cc, fogNear: 200, fogFar: 720 },
  control: [
    [-20, 140, 0.6], // başlangıç
    [95, 145, 0.6],
    [170, 115, 0.8],
    [195, 50, 1.5],
    [165, -15, 2.2],
    [105, -40, 2.6],
    [70, -85, 1.8],
    [15, -125, 1],
    [-55, -115, 0.6],
    [-105, -70, 0.6], // kısayol girişi
    [-175, -60, 0.8],
    [-190, 10, 1.4],
    [-150, 70, 1.8], // kısayol çıkışı
    [-90, 110, 1],
  ],

  // Dev plaj topları: uyarı şeridi yanıp söner, sonra top yolu bir yandan öbür yana yuvarlanır.
  hazards: [
    { type: 'ball', f: 0.08, period: 11, offset: 2, dir: 1 },
    { type: 'ball', f: 0.3, period: 12, offset: 6, dir: -1 },
    { type: 'ball', f: 0.39, period: 10.5, offset: 9, dir: 1 },
    { type: 'ball', f: 0.56, period: 11.5, offset: 4, dir: -1 },
    { type: 'ball', f: 0.72, period: 12, offset: 1, dir: 1 },
    { type: 'ball', f: 0.93, period: 10, offset: 7, dir: -1 },
  ],

  // Kısayol: halıdan kutuların arasına dalan yol; ortada oyuncak sandığını aşan rampa var.
  shortcuts: [
    {
      id: 'boxLeap',
      name: 'Kutu Geçidi',
      points: [[-105, -70], [-112, -36], [-119, -2], [-128, 30], [-140, 52], [-150, 70]],
      halfWidth: 4.4,
      surface: 'dirt',
      speed: 0.9,
      color: 0xc9975e,
      pads: [{ f: 0.15 }, { f: 0.85 }],
      jump: { at: [-119, -2], ramp: 12, height: 2.4, gap: 12, depth: 5.5, landing: 14, drop: 0.7, rampColor: 0x2f6fd6, water: 0x3b7be0, fallText: 'Oyuncak sandığına düştün! 📦' },
      boxes: { at: 'landing', lateral: [-2, 2] },
      edge: { keys: ['furniture/cardboardBoxClosed', 'furniture/cardboardBoxOpen', 'furniture/books'], step: 6, scale: [16, 22] },
      botChance: 0.5,
      botMinSpeed: 22,
    },
  ],

  // Zemin bölgeleri: halı (yavaşlatır) ve oyuncak trambolini
  zones: [
    { type: 'carpet', f: [0.19, 0.23], lateral: [-8, 8] },
    { type: 'bounce', f: [0.245, 0.257], lateral: [-3.2, 3.2], color: '#ffd23f' },
  ],

  models: [
    'racing/barrierRed', 'racing/barrierWhite', 'racing/flagCheckers', 'racing/grandStandCovered', 'racing/bannerTowerRed', 'racing/bannerTowerGreen',
    ...['gate-finish', 'item-cone', 'vehicle-drag-racer', 'vehicle-monster-truck', 'vehicle-racer', 'vehicle-racer-low', 'vehicle-speedster', 'vehicle-suv', 'vehicle-truck', 'vehicle-vintage-racer', 'track-road-narrow-looping', 'supports'].map((k) => `toy/${k}`),
    ...['bear', 'books', 'pillow', 'pillowBlue', 'pillowLong', 'bookcaseClosed', 'bookcaseOpen', 'bookcaseClosedWide', 'bedSingle', 'bedDouble', 'bedBunk', 'loungeSofa', 'loungeSofaLong', 'loungeDesignSofa', 'loungeChair', 'tableRound', 'table', 'tableCoffee', 'desk', 'chair', 'lampRoundFloor', 'lampSquareFloor', 'lampRoundTable', 'plantSmall1', 'pottedPlant', 'radio', 'speaker', 'televisionVintage', 'televisionModern', 'cardboardBoxClosed', 'cardboardBoxOpen', 'rugRound', 'rugRectangle', 'rugSquare', 'cabinetTelevision', 'sideTable', 'stoolBar'].map((k) => `furniture/${k}`),
    ...['bevel-lq-brick-2x4', 'bevel-lq-brick-2x2', 'bevel-lq-brick-1x4', 'bevel-lq-brick-2x8', 'bevel-lq-brick-slope-2x2', 'bevel-lq-plate-2x8', 'bevel-lq-brick-1x1-round'].map((k) => `bricks/${k}`),
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

    // --- Başlangıç: oyuncak bitiş kapısı, bayraklar, tribünler ---
    const gantry = ctx.along(0, 0);
    ctx.place('toy/gate-finish', gantry.x, gantry.z, gantry.acrossY, (2 * (hw + 1) + 3) / 1.55, track.centerline[0].y - 0.05);
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
    // Kısayol girişi/çıkışı ve rampa
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
    // Yol kenarında dizili oyuncak konileri (virajlarda ve düzlüklerde ikişer ikişer)
    for (let i = 10; i < track.count; i += 18) {
      const side = (i / 18) % 2 ? 1 : -1;
      const c = ctx.along(i, side * (edge + 1.8));
      if (track.shortcutClearance(c.x, c.z) < 4) continue;
      ctx.place('toy/item-cone', c.x, c.z, rng() * 6, 11);
    }

    // --- Dev eşyalar: üst üste binmesin diye basit çakışma denetimi ---
    const taken = [];
    const put = (keys, [a, b], fp, dMin, dMax, count, opts = {}) => {
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
        ctx.place(keys[Math.floor(rng() * keys.length)], x, z, opts.face ? Math.atan2(-x, -z) + (rng() - 0.5) * 0.6 : rng() * Math.PI * 2, s, opts.lift != null ? terrain.heightAt(x, z) + opts.lift : null);
        placed++;
      }
    };
    // Başlangıç alanında dev oyuncak ayı
    const bearPos = ctx.along(-4, outerSide * (edge + 70));
    ctx.place('furniture/bear', bearPos.x, bearPos.z, bearPos.faceTrackY, 46);
    taken.push([bearPos.x, bearPos.z, 26]);
    ctx.reserve(bearPos.x, bearPos.z, 26);

    const off = edge + 14;
    put(['furniture/loungeSofa', 'furniture/loungeSofaLong', 'furniture/loungeDesignSofa'], [22, 30], 0.6, off - 2, 150, 8, { face: true });
    put(['furniture/bookcaseClosed', 'furniture/bookcaseOpen', 'furniture/bookcaseClosedWide'], [26, 34], 0.5, off + 2, 160, 12, { face: true });
    put(['furniture/bedSingle', 'furniture/bedDouble', 'furniture/bedBunk'], [13, 17], 1.1, off + 8, 170, 4);
    put(['furniture/table', 'furniture/tableRound', 'furniture/tableCoffee', 'furniture/desk'], [22, 30], 0.6, off - 2, 150, 8);
    put(['furniture/lampRoundFloor', 'furniture/lampSquareFloor'], [26, 34], 0.25, off, 130, 10);
    put(['furniture/televisionVintage', 'furniture/televisionModern', 'furniture/cabinetTelevision'], [26, 34], 0.5, off, 150, 5, { face: true });
    put(['furniture/bear'], [36, 46], 0.6, off + 20, 160, 3, { face: true });
    put(['furniture/pillow', 'furniture/pillowBlue', 'furniture/pillowLong'], [28, 38], 0.55, off, 120, 12);
    put(['furniture/books'], [30, 42], 0.5, off, 120, 14);
    put(['furniture/cardboardBoxClosed', 'furniture/cardboardBoxOpen'], [22, 30], 0.5, off, 120, 12);
    put(['furniture/pottedPlant', 'furniture/plantSmall1'], [24, 34], 0.35, off, 130, 9);
    put(['furniture/radio', 'furniture/speaker', 'furniture/sideTable', 'furniture/stoolBar'], [28, 38], 0.4, off + 6, 140, 7);
    // Oyuncak arabalar (parklanmış)
    put(['toy/vehicle-drag-racer', 'toy/vehicle-monster-truck', 'toy/vehicle-racer', 'toy/vehicle-racer-low', 'toy/vehicle-speedster', 'toy/vehicle-suv', 'toy/vehicle-truck', 'toy/vehicle-vintage-racer'], [6.5, 8.5], 0.6, off - 4, 120, 14);
    // Halılar: yola yakın olanlar zemine yatık
    put(['furniture/rugRound', 'furniture/rugRectangle', 'furniture/rugSquare'], [70, 110], 0.5, off + 4, 150, 6, { lift: 0.14 });
    // Dev LEGO benzeri blok kuleleri
    const brickKeys = ['bricks/bevel-lq-brick-2x4', 'bricks/bevel-lq-brick-2x2', 'bricks/bevel-lq-brick-1x4', 'bricks/bevel-lq-brick-2x8', 'bricks/bevel-lq-brick-slope-2x2', 'bricks/bevel-lq-plate-2x8', 'bricks/bevel-lq-brick-1x1-round'];
    ctx.tint({ color: 0xff5a4a }, 'bricks/bevel-lq-brick-2x4', 'bricks/bevel-lq-brick-1x1-round');
    ctx.tint({ color: 0x3f8cff }, 'bricks/bevel-lq-brick-2x2', 'bricks/bevel-lq-plate-2x8');
    ctx.tint({ color: 0xffd23f }, 'bricks/bevel-lq-brick-1x4');
    ctx.tint({ color: 0x4cd06a }, 'bricks/bevel-lq-brick-2x8');
    ctx.tint({ color: 0xff9a2e }, 'bricks/bevel-lq-brick-slope-2x2');
    const heightOf = { 'bricks/bevel-lq-brick-2x4': 0.11, 'bricks/bevel-lq-brick-2x2': 0.11, 'bricks/bevel-lq-brick-1x4': 0.11, 'bricks/bevel-lq-brick-2x8': 0.11, 'bricks/bevel-lq-brick-slope-2x2': 0.11, 'bricks/bevel-lq-plate-2x8': 0.05, 'bricks/bevel-lq-brick-1x1-round': 0.11 };
    let stacks = 0;
    for (let tries = 0; stacks < 16 * ctx.density && tries < 2000; tries++) {
      const x = (rng() * 2 - 1) * half;
      const z = (rng() * 2 - 1) * half;
      const d = terrain.roadDistAt(x, z);
      if (d < off + 4 || d > 130 || track.shortcutClearance(x, z) < 10) continue;
      if (taken.some(([tx, tz, tr]) => (x - tx) ** 2 + (z - tz) ** 2 < (tr + 10) ** 2)) continue;
      taken.push([x, z, 10]);
      ctx.reserve(x, z, 10);
      const S = 34 + rng() * 10;
      const base = terrain.heightAt(x, z);
      let y = base;
      const rot = rng() * Math.PI;
      const levels = 2 + Math.floor(rng() * 4);
      for (let k = 0; k < levels; k++) {
        const key = brickKeys[Math.floor(rng() * brickKeys.length)];
        ctx.place(key, x + (rng() - 0.5) * 3, z + (rng() - 0.5) * 3, rot + (rng() < 0.5 ? 0 : Math.PI / 2) + (rng() - 0.5) * 0.3, S, y);
        y += heightOf[key] * S;
      }
      stacks++;
    }
    // Dev oyuncak looping parçası (sadece dekor) ve köprü ayakları
    const lp = ctx.along(Math.round(track.count * 0.5), -track.innerSide[Math.round(track.count * 0.5)] * (edge + 75));
    ctx.place('toy/track-road-narrow-looping', lp.x, lp.z, lp.faceTrackY, 13);
    ctx.reserve(lp.x, lp.z, 32);
    ctx.noShadow('furniture/rugRound', 'furniture/rugRectangle', 'furniture/rugSquare');
  },
};
