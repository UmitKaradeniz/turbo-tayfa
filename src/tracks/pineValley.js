import { placePieces, cottagePieces } from '../props.js';

// "Çam Vadisi" — dağlarla çevrili bir vadide çam ormanı, göl kenarı ve kamp alanı.
// Tepeye tırmanan uzun bir yokuş, oradan inen virajlı bir iniş ve göl kıyısında şikan.
// Kontrol noktaları: [x, z, yükseklik].

export default {
  id: 'pineValley',
  name: 'Çam Vadisi',
  kartBody: 'karts/kart-pineValley', // haritaya özel araç gövdesi (tools/gen_kart.py)
  meta: 'Orman · göl · tepe',
  groundTex: { tex: 'grass', rock: 'rock', scale: 0.13, strength: 1.0 }, // ambientCG (CC0) detay dokusu; sadece Yüksek kalite
  roadTex: 'asphalt_n', // yol normal haritası (ambientCG, CC0); Orta/Yüksek kalite
  halfWidth: 8,
  curbWidth: 1,
  shoulder: 5,
  terrainSize: 600,
  shoreMargin: () => 90, // pistin dışında geniş kara, sonra dağ yamacı
  outer: 'mountains', // pist alanının dışı denize inmek yerine dağa yükselir
  baseHeight: 1.2,
  ponds: [{ x: 18, z: -52, r: 30 }], // iç göl
  palette: { base: 0x7cc452, shore: 0x8a6a45, patch: 0x5a9e3c, patchDark: 0x467f2f, shoulder: 0xa8825a, cliff: 0x9aa0a8 },
  dust: [0.62, 0.5, 0.36],
  sky: { top: 0x4a8fd6, horizon: 0xd9eef8, fog: 0xcfe6f2 },
  skyTex: { id: 'kloofendal_38d_partly_cloudy_puresky', az: 0.6289, mix: 0.35 }, // Poly Haven (CC0) gökyüzü; Düşük kalitede kapalı
  water: { shallow: 0x5cc9bd, deep: 0x1d5f8c },
  control: [
    [-60, -112, 1.4], // başlangıç düzlüğü (göl kıyısı)
    [0, -114, 1.4],
    [60, -108, 1.8],
    [110, -84, 3.2],
    [138, -40, 6],
    [132, 6, 10.5], // tepeye tırmanış
    [104, 42, 13.5],
    [64, 54, 14], // zirve
    [30, 34, 11.5], // iniş ve S virajları
    [6, 8, 8],
    [-24, 16, 7],
    [-42, 54, 6],
    [-82, 88, 4.5],
    [-128, 72, 3],
    [-152, 22, 2],
    [-148, -40, 1.6],
    [-120, -94, 1.4],
  ],

  hillReach: 120, // yol yükseldikçe çevresindeki yamaç da yola kadar yükselir
  // Dağ-bayır: inişteki S virajlarında yol içe yatar, orman düzlüğünde kök tümsekleri var
  bank: [{ f: [0.5, 0.57], deg: 9 }, { f: [0.64, 0.74], deg: 10 }],
  bumps: [{ f: [0.8, 0.92], amp: 0.5, period: 28 }],

  // Kısayol: tepeden inişteki S virajlarını kesen toprak yol. Rampadan (en az ~21 m/s ile) çıkan kart derenin
  // üzerinden uçar; yetmezse dereye düşüp son checkpoint'e döner. İniş alanında item kutuları var.
  shortcuts: [
    {
      id: 'ridgeJump',
      name: 'Tepe Atlayışı',
      points: [[67, 54], [40, 59], [0, 66], [-30, 72], [-64, 78]],
      halfWidth: 5,
      surface: 'dirt',
      color: 0x9c7649,
      jump: { at: [20, 62.6], ramp: 12, height: 2.4, gap: 12, depth: 5.5, landing: 14, drop: 0.7, rampColor: 0xb9803f, water: 0x4fb6d9 },
      boxes: { at: 'landing', lateral: [-2.2, 2.2] },
      edge: { keys: ['nature/log_stack', 'nature/rock_largeA', 'nature/stump_round', 'nature/rock_largeB'], step: 5, scale: [4, 6.5] },
      botChance: 0.5,
      botMinSpeed: 22,
    },
  ],

  // Zemin bölgeleri: ana yolda zorunlu bataklık (2-3 sn yavaşlatır) ve ortada hız şeridi
  zones: [
    { type: 'mud', f: [0.24, 0.29], lateral: [-8, 8] },
    { type: 'boost', f: [0.86, 0.875], lateral: [-2.6, 2.6] },
  ],

  // Yamaçtan yuvarlanan kütükler: çizgili uyarı şeridi yanıp sönünce kütük yolu bir yandan öbür yana geçer
  hazards: [
    { type: 'ball', skin: 'log', ballRadius: 2.3, f: 0.69, period: 11, offset: 3, dir: 1 },
    { type: 'ball', skin: 'log', ballRadius: 2.3, f: 0.91, period: 12, offset: 8, dir: -1 },
  ],

  models: [
    'tayfa/pine_cartoon', 'tayfa/rock_boulder_a', 'tayfa/rock_boulder_b', 'tayfa/rock_boulder_c', 'tayfa/hay_bale',
    'racing/barrierRed', 'racing/barrierWhite', 'racing/overheadLights', 'racing/flagCheckers', 'racing/grandStandCovered',
    'racing/bannerTowerRed', 'racing/bannerTowerGreen', 'racing/tentClosedLong',
    'nature/tree_pineTallA', 'nature/tree_pineTallB', 'nature/tree_pineRoundA', 'nature/tree_pineRoundC',
    'nature/tree_pineDefaultA', 'nature/tree_cone', 'nature/tree_detailed', 'nature/rock_tallA', 'nature/rock_tallB',
    'nature/rock_largeA', 'nature/rock_largeB', 'nature/stump_round', 'nature/log_stack', 'nature/log',
    'nature/mushroom_red', 'nature/mushroom_redGroup', 'nature/plant_bush', 'nature/plant_bushLarge', 'nature/grass_large',
    'nature/grass', 'nature/flower_purpleA', 'nature/flower_yellowA', 'nature/tent_detailedOpen', 'nature/tent_smallOpen',
    'nature/campfire_stones', 'nature/canoe', 'nature/platform_beach', 'nature/statue_obelisk',
    ...['fountain-round', 'stall-red', 'stall-green', 'cart', 'lantern', 'banner-red', 'banner-green', 'tree', 'tree-high', 'tree-high-round', 'tree-crooked',
      'rock-large', 'rock-wide', 'wall-wood', 'wall-wood-door', 'wall-wood-window-shutters', 'wall-wood-window-small', 'roof-gable',
    ].map((k) => `fantasy/${k}`),
  ],

  decorate(ctx) {
    const { track } = ctx;
    const hw = this.halfWidth;
    const edge = track.edge;
    const probe = ctx.along(0, 30);
    const outerSide = track.insideLoop(probe.x, probe.z) ? -1 : 1;
    const innerSide = -outerSide;

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
    for (let k = -24; k <= 24; k += 8) {
      if (Math.abs(k) < 4) continue;
      const b = ctx.along(k, innerSide * (edge + 2.5));
      ctx.place(k % 16 ? 'racing/bannerTowerGreen' : 'racing/bannerTowerRed', b.x, b.z, b.faceTrackY, 9);
    }

    // --- Göl kıyısında kamp ---
    const lake = this.ponds[0];
    for (let k = 0; k < 3; k++) {
      const a = 2.3 + k * 0.45;
      const x = lake.x + Math.cos(a) * (lake.r + 8);
      const z = lake.z + Math.sin(a) * (lake.r + 8);
      ctx.place(k === 1 ? 'nature/tent_detailedOpen' : 'nature/tent_smallOpen', x, z, -a + Math.PI / 2, 6);
      ctx.reserve(x, z, 8);
    }
    ctx.place('nature/campfire_stones', lake.x + Math.cos(2.75) * (lake.r + 16), lake.z + Math.sin(2.75) * (lake.r + 16), 0, 6);
    ctx.place('nature/log', lake.x + Math.cos(2.95) * (lake.r + 18), lake.z + Math.sin(2.95) * (lake.r + 18), 1.1, 6);
    ctx.place('nature/canoe', lake.x + 6, lake.z + 4, 0.8, 6, 0.1);
    for (let k = 0; k < 4; k++) {
      const x = lake.x + Math.cos(4.1) * (lake.r - 3 + k * 5);
      const z = lake.z + Math.sin(4.1) * (lake.r - 3 + k * 5);
      ctx.place('nature/platform_beach', x, z, -4.1, 7, 0.35);
    }

    // Tepede dikilitaş (manzara noktası)
    const top = Math.round(track.count * 0.36);
    const o = ctx.along(top, track.innerSide[top] * (edge + 14));
    ctx.place('nature/statue_obelisk', o.x, o.z, 0, 9);
    ctx.reserve(o.x, o.z, 8);

    // Kısayol girişi/çıkışı ve rampada bayraklar
    for (const sc of track.shortcuts) {
      for (const s of [4, sc.length - 4]) {
        for (const side of [-1, 1]) {
          const b = ctx.shortcutAt(sc, s, side * (sc.halfAt(s) + 3));
          ctx.place(s < 10 ? 'racing/bannerTowerGreen' : 'racing/bannerTowerRed', b.x, b.z, b.faceTrackY, 9);
        }
      }
      if (sc.jump) {
        for (const s of [sc.jump.rampA - 6, sc.jump.rampA + 2, sc.jump.pitB + 2]) {
          for (const side of [-1, 1]) {
            const f = ctx.shortcutAt(sc, s, side * (sc.halfWidth + 1.8));
            ctx.place('racing/flagCheckers', f.x, f.z, f.faceTrackY, 6);
          }
        }
      }
    }

    // --- Köy meydanı: çeşme, tezgâhlar, kır evleri, fenerler (Fantasy Town Kit) ---
    {
      const terrain = track.terrain;
      const vi = Math.round(track.count * 0.1);
      const vc = ctx.along(vi, outerSide * (edge + 46));
      if (terrain.landAt(vc.x, vc.z) > 12) {
        ctx.place('fantasy/fountain-round', vc.x, vc.z, 0, 6);
        ctx.reserve(vc.x, vc.z, 34);
        const facing = (x, z) => Math.atan2(vc.x - x, vc.z - z); // yerel +Z merkeze baksın
        for (let k = 0; k < 6; k++) {
          const a = k * ((Math.PI * 2) / 6) + 0.35;
          const x = vc.x + Math.cos(a) * 25;
          const z = vc.z + Math.sin(a) * 25;
          if (terrain.landAt(x, z) < 8) continue;
          placePieces(ctx, cottagePieces(1 + (k % 2)), x, z, terrain.heightAt(x, z), facing(x, z), 6.5);
        }
        for (let k = 0; k < 4; k++) {
          const a = k * (Math.PI / 2) + 0.8;
          const x = vc.x + Math.cos(a) * 12;
          const z = vc.z + Math.sin(a) * 12;
          ctx.place(k % 2 ? 'fantasy/stall-green' : 'fantasy/stall-red', x, z, facing(x, z), 5.5);
          const lx = vc.x + Math.cos(a + 0.8) * 10;
          const lz = vc.z + Math.sin(a + 0.8) * 10;
          ctx.place('fantasy/lantern', lx, lz, 0, 5);
        }
        ctx.place('fantasy/cart', vc.x + 15, vc.z - 4, 0.6, 5);
        ctx.place('fantasy/cart', vc.x - 14, vc.z + 6, 2.2, 5);
      }
      // Yol boyunca köy bayrakları
      for (let k = -1; k <= 1; k += 2) {
        const b = ctx.along(vi + k * 6, outerSide * (edge + 2.2));
        ctx.place(k < 0 ? 'fantasy/banner-red' : 'fantasy/banner-green', b.x, b.z, b.acrossY + (outerSide > 0 ? 0 : Math.PI), 6);
      }
    }

    // --- Orman ---
    ctx.noShadow('nature/grass', 'nature/grass_large', 'nature/flower_purpleA', 'nature/flower_yellowA', 'nature/mushroom_red');
    const off = (d, m) => d > edge + m;
    ctx.scatter({
      keys: ['nature/tree_pineTallA', 'nature/tree_pineTallB', 'nature/tree_pineRoundA', 'nature/tree_pineRoundC', 'nature/tree_pineDefaultA', 'nature/tree_cone'],
      count: 420,
      scale: [7, 12],
      where: (s, d) => s > -40 && off(d, 5),
    });
    ctx.scatter({ keys: ['fantasy/tree', 'fantasy/tree-high', 'fantasy/tree-high-round', 'fantasy/tree-crooked'], count: 110, scale: [4.2, 6], where: (s, d) => s > -30 && d > edge + 4 });
    ctx.scatter({ keys: ['nature/tree_detailed'], count: 40, scale: [7, 10], where: (s, d) => s > 5 && off(d, 7) });
    ctx.scatter({ keys: ['nature/rock_tallA', 'nature/rock_tallB'], count: 70, scale: [8, 16], where: (s, d) => s < -5 && off(d, 12) });
    ctx.scatter({ keys: ['nature/rock_largeA', 'nature/rock_largeB'], count: 60, scale: [4, 9], where: (s, d) => off(d, 4) });
    ctx.scatter({ keys: ['nature/stump_round', 'nature/log_stack', 'nature/log'], count: 50, scale: [5, 7], where: (s, d) => s > 0 && off(d, 4) });
    ctx.scatter({ keys: ['nature/mushroom_red', 'nature/mushroom_redGroup'], count: 90, scale: [4, 7], where: (s, d) => s > 0 && off(d, 3) });
    ctx.scatter({ keys: ['nature/plant_bushLarge', 'nature/plant_bush'], count: 200, scale: [6, 9], where: (s, d) => off(d, 3) });
    ctx.scatter({ keys: ['nature/grass_large', 'nature/grass'], count: 520, scale: [5, 8], where: (s, d) => s > -20 && off(d, 1.5) });
    ctx.scatter({ keys: ['nature/flower_purpleA', 'nature/flower_yellowA'], count: 260, scale: [4, 6], where: (s, d) => s > 0 && off(d, 3) });

    // --- Özel props (public/models/tayfa, tools/gen_props.py) ---
    ctx.scatter({ keys: ['tayfa/pine_cartoon'], count: 160, scale: [8, 13], where: (s, d) => s > -40 && off(d, 5) });
    ctx.scatter({ keys: ['tayfa/rock_boulder_a', 'tayfa/rock_boulder_b', 'tayfa/rock_boulder_c'], count: 50, scale: [6, 12], where: (s, d) => off(d, 4) });
    ctx.scatter({ keys: ['tayfa/hay_bale'], count: 40, scale: [4, 5], where: (s, d) => s > 0 && d > edge + 2 && d < edge + 14 });
  },
};
