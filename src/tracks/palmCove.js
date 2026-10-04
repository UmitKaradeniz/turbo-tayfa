// "Palmiye Koyu" — Turbo Tayfa'nın ilk pisti. Tropikal bir adada sahil boyunca
// uzun bir düzlük, tepeye tırmanan S virajları, bir firkete ve lagün kenarı.
// Kontrol noktaları: [x, z, yükseklik]. Pist bu noktalardan geçen kapalı bir eğridir.

export default {
  id: 'palmCove',
  name: 'Palmiye Koyu',
  kartBody: 'karts/kart-palmCove', // haritaya özel araç gövdesi (tools/gen_kart.py)
  meta: 'Tropikal sahil · lagün',
  dust: [0.93, 0.82, 0.6],
  sky: { top: 0x3d9df2, horizon: 0xcdeeff, fog: 0xc4e8fb },
  skyTex: { id: 'kloofendal_48d_partly_cloudy_puresky', az: 0.5983, mix: 0.3 }, // Poly Haven (CC0) gökyüzü; Düşük kalitede kapalı
  water: { shallow: 0x3fe0d0, deep: 0x1673c9 },
  groundTex: { tex: 'sand', scale: 0.14, strength: 0.9 }, // ambientCG (CC0) detay dokusu; sadece Yüksek kalite
  roadTex: 'asphalt_n', // yol normal haritası (ambientCG, CC0); Orta/Yüksek kalite
  halfWidth: 8,
  curbWidth: 1,
  shoulder: 5, // bordür ile bariyer arasındaki kum şeridi
  terrainSize: 560,
  // Pistin dışında kıyıya kadar kalan kara genişliği (t: 0..1 pist boyunca konum)
  shoreMargin: (t) => 46 - 18 * Math.cos(t * Math.PI * 2 * 3),
  ponds: [{ x: -40, z: -8, r: 34 }], // iç lagün
  control: [
    [-40, 95, 0.6], // başlangıç düzlüğü (sahil)
    [20, 95, 0.6],
    [75, 92, 0.6],
    [118, 70, 0.8],
    [135, 30, 1.2],
    [120, -8, 2.2], // S virajları tepeye tırmanır
    [135, -45, 4.0],
    [122, -85, 5.2],
    [98, -115, 5.4], // firkete
    [58, -118, 4.8],
    [38, -88, 3.6],
    [6, -64, 2.4],
    [-30, -82, 1.6], // lagün kenarı
    [-65, -95, 1.0],
    [-110, -80, 0.8],
    [-140, -35, 0.7],
    [-134, 10, 0.7], // batı sahili boyunca geniş yay
    [-118, 55, 0.6],
    [-88, 86, 0.6],
  ],

  // Dağ-bayır: tepe dönüşlerinde yol içe yatar, batı sahili düzlüğünde kumul dalgaları var
  bank: [{ f: [0.17, 0.26], deg: 7 }, { f: [0.41, 0.5], deg: 8 }],
  bumps: [{ f: [0.72, 0.84], amp: 0.45, period: 40 }],

  // Kısayol: firketeyi kesen dar bir kum yolu. Kumda kart yavaşlar; ama hız tahtaları ve
  // turbo (kumda yavaşlamaz) ile yol yarıya yakın kısalır. Ortasında bir sıra item kutusu var.
  shortcuts: [
    {
      id: 'sandCut',
      name: 'Kum Kısayolu',
      points: [[132, 19], [118, 10], [90, -8], [60, -27], [30, -45], [8, -59], [-4, -66]],
      halfWidth: 4.6,
      surface: 'sand',
      speed: 0.53, // derin kum: normal kumdan biraz daha yavaş
      color: 0xc99b5d,
      pads: [{ f: 0.55, boost: 0.8 }],
      boxes: { at: 'mid', lateral: [-2.4, 0, 2.4] },
      edge: { keys: ['nature/rock_largeA', 'nature/rock_largeB', 'nature/plant_bushLarge', 'nature/rock_largeC'], step: 5, scale: [4, 7] },
      botChance: 0.55,
    },
  ],

  // Dekor listesindeki tüm modeller (yükleme ekranı bunları önceden yükler)
  // Zemin bölgeleri: sığ su geçidi (yavaşlatır, sıçratır) ve ortada hız şeridi
  zones: [
    { type: 'boardwalk', f: [0.015, 0.095], lateral: [-8.2, 8.2] }, // başlangıç düzlüğü ahşap iskele
    { type: 'water', f: [0.67, 0.715], lateral: [-8, 8] },
    { type: 'boost', f: [0.86, 0.875], lateral: [-2.6, 2.6] },
  ],

  // Sahil yengeçleri: yolu yavaşça yan yürüyerek keser (çarpan yavaşlar); önce çizgili uyarı şeridi yanar
  hazards: [
    { type: 'ball', skin: 'crab', ballRadius: 1.9, f: 0.1, period: 14, offset: 4, dir: 1, cross: 4.6 },
    { type: 'ball', skin: 'crab', ballRadius: 1.9, f: 0.9, period: 13, offset: 9, dir: -1, cross: 4.6 },
    { type: 'ball', skin: 'crab', ballRadius: 1.9, f: 0.965, period: 15, offset: 2, dir: 1, cross: 4.6 },
  ],

  models: [
    'tayfa/palm_tropic', 'tayfa/beach_umbrella', 'tayfa/rock_boulder_a', 'tayfa/rock_boulder_b', 'tayfa/rock_boulder_c',
    'racing/barrierRed', 'racing/barrierWhite', 'racing/overheadLights', 'racing/flagCheckers',
    'racing/grandStandCovered', 'racing/bannerTowerRed', 'racing/bannerTowerGreen', 'racing/lightPostModern',
    'racing/billboard', 'racing/tent', 'racing/tentClosedLong',
    'nature/tree_palmTall', 'nature/tree_palmBend', 'nature/tree_palmShort', 'nature/tree_palmDetailedTall',
    'nature/tree_palmDetailedShort', 'nature/rock_largeA', 'nature/rock_largeB', 'nature/rock_largeC',
    'nature/rock_tallA', 'nature/plant_bushLarge', 'nature/plant_bush', 'nature/grass_large', 'nature/grass',
    'nature/flower_redA', 'nature/flower_yellowA', 'nature/platform_beach', 'nature/canoe',
    'nature/tent_detailedOpen', 'nature/campfire_stones', 'nature/log', 'nature/statue_head',
    ...['ship-pirate-large', 'ship-pirate-medium', 'ship-small', 'ship-wreck', 'boat-row-small', 'boat-row-large', 'structure-platform-dock',
      'tower-complete-large', 'castle-wall', 'barrel', 'crate', 'crate-bottles', 'chest', 'cannon', 'flag-pirate-high',
      'palm-bend', 'palm-straight', 'palm-detailed-bend', 'palm-detailed-straight', 'rocks-sand-a', 'rocks-sand-b', 'rocks-sand-c',
    ].map((k) => `pirate/${k}`),
  ],

  decorate(ctx) {
    const { track, rng } = ctx;
    const hw = this.halfWidth;
    const edge = track.edge;
    const p0 = ctx.along(0, 30);
    const seaSide = track.insideLoop(p0.x, p0.z) ? -1 : 1;
    const landSide = -seaSide;

    // --- Başlangıç alanı ---
    const gantry = ctx.along(0, 0);
    ctx.place('racing/overheadLights', gantry.x, gantry.z, gantry.acrossY, (2 * (hw + 1) + 3) / 1.26, track.centerline[0].y - 0.15);
    for (const s of [-1, 1]) {
      const f = ctx.along(1, s * (hw + 3));
      ctx.place('racing/flagCheckers', f.x, f.z, f.faceTrackY, 7);
    }

    // Tribünler (kara tarafında, piste dönük)
    for (let k = -2; k <= 2; k++) {
      const g = ctx.along(k * 5, landSide * (edge + 7));
      ctx.place('racing/grandStandCovered', g.x, g.z, g.faceTrackY, 10);
      ctx.reserve(g.x, g.z, 12);
    }
    // Seyirciler: bariyerin hemen arkasında iki sıra, kol sallarlar
    ctx.crowdRow(-24, 24, landSide * (edge + 2.2), { every: 2, rows: 2, rowGap: 1.6, scale: 2.4 });
    // Çadırlar tribünlerin iki ucunda
    for (const k of [-16, 16]) {
      const t = ctx.along(k, landSide * (edge + 8));
      ctx.place('racing/tentClosedLong', t.x, t.z, t.faceTrackY, 8);
      ctx.reserve(t.x, t.z, 10);
    }

    // Düzlük boyunca bayrak kuleleri ve lambalar
    for (let k = -28; k <= 28; k += 7) {
      if (Math.abs(k) < 4) continue;
      const b = ctx.along(k, seaSide * (edge + 2.5));
      ctx.place(k % 2 ? 'racing/bannerTowerRed' : 'racing/bannerTowerGreen', b.x, b.z, b.faceTrackY, 9);
      const l = ctx.along(k + 3, seaSide * (edge + 2));
      ctx.place('racing/lightPostModern', l.x, l.z, l.faceTrackY, 11);
    }

    // Lagün kenarında reklam panoları (özgün "tankco" logosu Kenney'in hayali markası)
    for (let k = 0; k < 4; k++) {
      const i = Math.round(track.count * (0.56 + k * 0.035));
      const outer = -track.innerSide[i];
      const b = ctx.along(i, outer * (edge + 4));
      ctx.place('racing/billboard', b.x, b.z, b.faceTrackY, 9);
      ctx.reserve(b.x, b.z, 8);
    }

    // --- Sahil: iskeleler, kanolar, kamp ---
    const shore = (i, side) => {
      // pistten dışarı doğru yürüyüp kıyı çizgisini bul
      for (let d = edge + 6; d < 120; d += 1.5) {
        const p = ctx.along(i, side * d);
        if (track.terrain.landAt(p.x, p.z) < 0) return { ...p, d };
      }
      return null;
    };
    for (const i of [Math.round(track.count * 0.03), Math.round(track.count * 0.93)]) {
      const s = shore(i, seaSide);
      if (!s) continue;
      const dock = ctx.along(i, seaSide * (s.d + 6));
      for (let k = 0; k < 4; k++) {
        const p = ctx.along(i, seaSide * (s.d - 2 + k * 6));
        ctx.place('nature/platform_beach', p.x, p.z, p.acrossY, 7, 0.35);
      }
      ctx.place('nature/canoe', dock.x + 6, dock.z + 3, rng() * 6, 6, 0.1);
      const camp = ctx.along(i + 6, seaSide * (s.d - 12));
      ctx.place('nature/tent_detailedOpen', camp.x, camp.z, camp.faceTrackY, 6);
      ctx.place('nature/campfire_stones', camp.x + 6, camp.z - 5, 0, 6);
      ctx.place('nature/log', camp.x + 10, camp.z - 2, 1.2, 6);
      ctx.reserve(camp.x, camp.z, 14);
    }

    // Tepedeki taş kafalar (firketenin iç tarafı)
    const hill = Math.round(track.count * 0.37);
    for (let k = 0; k < 3; k++) {
      const h = ctx.along(hill + k * 6, track.innerSide[hill] * (edge + 16 + k * 3));
      ctx.place('nature/statue_head', h.x, h.z, h.faceTrackY + (k - 1) * 0.4, 7 + k);
      ctx.reserve(h.x, h.z, 8);
    }

    // Kısayol girişi ve çıkışında bayrak kuleleri
    for (const sc of track.shortcuts) {
      for (const s of [4, sc.length - 4]) {
        for (const side of [-1, 1]) {
          const b = ctx.shortcutAt(sc, s, side * (sc.halfAt(s) + 3));
          ctx.place(s < 10 ? 'racing/bannerTowerGreen' : 'racing/bannerTowerRed', b.x, b.z, b.faceTrackY, 9);
        }
      }
    }

    // --- Korsan dokusu: limanda gemiler, batık, tekneler, iskele, kale kulesi, fıçılar ---
    const terrain = track.terrain;
    const ships = ['pirate/ship-pirate-large', 'pirate/ship-pirate-medium', 'pirate/ship-small', 'pirate/ship-wreck'];
    let shipN = 0;
    for (const f of [0.02, 0.08, 0.14, 0.9, 0.96]) {
      const i = Math.round(track.count * f);
      const s = shore(i, seaSide);
      if (!s) continue;
      for (const extra of [26, 44]) {
        const p = ctx.along(i, seaSide * (s.d + extra + (shipN % 3) * 6));
        if (terrain.landAt(p.x, p.z) > -7) continue; // yeterince derin su değil
        const key = ships[shipN++ % ships.length];
        ctx.place(key, p.x, p.z, rng() * Math.PI * 2, key.includes('wreck') ? 2.6 : 2.3, key.includes('wreck') ? -1.2 : -0.5);
        ctx.reserve(p.x, p.z, 16);
        break;
      }
    }
    for (const i of [Math.round(track.count * 0.03), Math.round(track.count * 0.93)]) {
      const s = shore(i, seaSide);
      if (!s) continue;
      for (let k = 0; k < 3; k++) {
        const d = ctx.along(i + 6, seaSide * (s.d + 4 + k * 5));
        ctx.place('pirate/boat-row-small', d.x + 4, d.z + k * 2, rng() * 6, 3.2, 0.05);
      }
      const camp = ctx.along(i + 3, seaSide * (s.d - 8));
      ctx.place('pirate/barrel', camp.x, camp.z, 0, 3.2);
      ctx.place('pirate/crate', camp.x + 3, camp.z + 1.5, 0.5, 3.2);
      ctx.place('pirate/crate-bottles', camp.x + 5, camp.z - 2, 1.2, 3.2);
      ctx.place('pirate/chest', camp.x - 3, camp.z + 2.5, -0.4, 3.2);
      ctx.reserve(camp.x, camp.z, 8);
    }
    // Kale kulesi ve toplar: pistin iç tarafında yüksek bir noktada
    {
      const i = Math.round(track.count * 0.62);
      const tower = ctx.along(i, track.innerSide[i] * (edge + 34));
      ctx.place('pirate/tower-complete-large', tower.x, tower.z, tower.faceTrackY, 3.4);
      for (let k = 0; k < 3; k++) {
        const w = ctx.along(i + (k - 1) * 8, track.innerSide[i] * (edge + 26));
        ctx.place('pirate/castle-wall', w.x, w.z, w.acrossY, 3);
        ctx.reserve(w.x, w.z, 6);
      }
      const c = ctx.along(i + 12, track.innerSide[i] * (edge + 21));
      ctx.place('pirate/cannon', c.x, c.z, c.faceTrackY + Math.PI, 3.6);
      ctx.reserve(tower.x, tower.z, 12);
    }
    // Kısayol girişinde korsan bayrakları
    for (const sc of track.shortcuts) {
      for (const side of [-1, 1]) {
        const f = ctx.shortcutAt(sc, 8, side * (sc.halfAt(8) + 5));
        ctx.place('pirate/flag-pirate-high', f.x, f.z, f.faceTrackY, 3.2);
      }
    }

    // --- Doğa ---
    ctx.noShadow('nature/grass', 'nature/grass_large', 'nature/flower_redA', 'nature/flower_yellowA');
    const off = (d, m) => d > edge + m;
    ctx.scatter({
      keys: ['nature/tree_palmTall', 'nature/tree_palmBend', 'nature/tree_palmShort', 'nature/tree_palmDetailedTall', 'nature/tree_palmDetailedShort'],
      count: 320,
      scale: [7, 11],
      where: (s, d) => s > 1.5 && s < 45 && off(d, 5),
    });
    ctx.scatter({ keys: ['pirate/palm-bend', 'pirate/palm-detailed-straight', 'pirate/palm-straight', 'pirate/palm-detailed-bend'], count: 90, scale: [2.3, 3.3], where: (s, d) => s > 2.5 && s < 45 && off(d, 5) });
    ctx.scatter({ keys: ['nature/rock_largeA', 'nature/rock_largeB', 'nature/rock_largeC'], count: 120, scale: [4, 10], where: (s, d) => s > -5 && s < 2 && off(d, 4) });
    ctx.scatter({ keys: ['nature/rock_tallA'], count: 25, scale: [6, 10], where: (s, d) => s > 20 && off(d, 10) });
    ctx.scatter({ keys: ['nature/plant_bushLarge', 'nature/plant_bush'], count: 260, scale: [6, 9], where: (s, d) => s > 12 && off(d, 3) });
    ctx.scatter({ keys: ['nature/grass_large', 'nature/grass'], count: 520, scale: [5, 8], where: (s, d) => s > 5 && off(d, 1.5) });
    ctx.scatter({ keys: ['nature/flower_redA', 'nature/flower_yellowA'], count: 300, scale: [4, 6], where: (s, d) => s > 16 && off(d, 3) });

    // --- Özel props (public/models/tayfa, tools/gen_props.py) ---
    ctx.scatter({ keys: ['tayfa/palm_tropic'], count: 130, scale: [9, 13], where: (s, d) => s > 1.5 && s < 45 && off(d, 5) });
    ctx.scatter({ keys: ['tayfa/beach_umbrella'], count: 40, scale: [5, 6.5], where: (s, d) => s > 0.3 && s < 3 && off(d, 5) });
    ctx.scatter({ keys: ['tayfa/rock_boulder_a', 'tayfa/rock_boulder_b', 'tayfa/rock_boulder_c'], count: 60, scale: [6, 12], where: (s, d) => s > -5 && s < 2 && off(d, 4) });
  },
};
