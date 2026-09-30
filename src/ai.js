import { KART } from './config.js';

// Bot sürücü: orta çizgide ileriye bakan bir hedef noktayı kovalar; keskin
// virajlarda drift atıp mini-turbo alır, item kutularına yönelir, item kullanır
// ve yağ lekelerinden kaçar. Davranışın ince ayarı kişiliğe göre değişir.

// attack: saldırı itemlerini ne kadar hevesle kullanır · defend: savunmaya ne kadar önem verir
// drift: drift sıklığı · wander: şerit değiştirme · patience: item'ı ne kadar tutar · emote: tepki sıklığı
export const PERSONALITIES = {
  aggressive: { label: 'Agresif', shortcut: 0.85, attack: 1, defend: 0.3, drift: 1.25, wander: 1.4, patience: 0.5, emote: 0.6 },
  clean: { label: 'Temiz', shortcut: 0.2, attack: 0.3, defend: 1, drift: 0.8, wander: 0.35, patience: 2.2, emote: 0.2 },
  balanced: { label: 'Dengeli', shortcut: 0.5, attack: 0.65, defend: 0.65, drift: 0.95, wander: 1, patience: 1, emote: 0.35 },
  sneaky: { label: 'Kurnaz', shortcut: 1, attack: 0.75, defend: 0.6, drift: 1, wander: 0.9, patience: 1.2, emote: 0.45, sneaky: true },
  sleepy: { label: 'Uykucu', shortcut: 0.15, attack: 0.5, defend: 0.7, drift: 0.85, wander: 0.6, patience: 1.5, emote: 0.3, sleepy: true },
  chatty: { label: 'Geveze', shortcut: 0.6, attack: 0.9, defend: 0.4, drift: 1.1, wander: 1.2, patience: 0.7, emote: 1 },
};

// skillRange: [en düşük, en yüksek] hız/yetenek oranı (zorluk ayarından gelir)
export function createDriver(seed, skillRange = [0.9, 0.97], personality = 'balanced') {
  const rand = (k) => {
    const x = Math.sin(seed * 91.7 + k * 13.3) * 43758.5453;
    return x - Math.floor(x);
  };
  const p = PERSONALITIES[personality] ?? PERSONALITIES.balanced;
  const skill = skillRange[0] + rand(1) * (skillRange[1] - skillRange[0]);
  return {
    p,
    skill,
    lane: (rand(2) - 0.5) * 7 * (0.6 + 0.4 * p.wander),
    phase: rand(3) * 10,
    time: 0,
    drifting: false,
    driftDir: 0,
    driftTimer: 0,
    sc: null, // şu an izlenen kısayol
    scChoice: {}, // kısayol id → bu turda karar (true/false)
    itemHeld: 0, // item elde tutma süresi
    itemPatience: (1.5 + rand(4) * 4) * p.patience,
    driftSkill: Math.min(1, (skill - 0.8) * 5), // yetenekli bot daha çok drift atar
  };
}

// Bot olaylara emojiyle tepki verir mi? Dönüş: emoji sırası ya da -1
// olay: 'hitOther' (birini vurdu) · 'gotHit' (vuruldu) · 'win' (birinci bitirdi) · 'go' (start)
const EVENT_EMOTE = { hitOther: 1, gotHit: 2, win: 4, go: 5 };
export function botEmote(driver, event) {
  const chance = { hitOther: 0.8, gotHit: 0.6, win: 1, go: 0.25 }[event] * driver.p.emote;
  return Math.random() < chance ? EVENT_EMOTE[event] : -1;
}

// ctx (isteğe bağlı): { items, karts, positionOf, progressOf }
export function driveInput(driver, kart, track, dt, ctx = null) {
  const p = driver.p;
  driver.time += dt;
  const n = track.count;
  const idx = kart.trackIndex < 0 ? 0 : kart.trackIndex;
  const speed = Math.max(0, kart.speed);
  const items = ctx?.items;
  const progress = ctx?.progressOf?.(kart) ?? 0.5; // yarışın ne kadarı bitti (0..1)

  // Hıza göre ileri bakış mesafesi (örnek cinsinden, 1 örnek ≈ 2.5 m)
  const look = Math.round(6 + speed * 0.28);
  let lane = driver.lane + Math.sin(driver.time * 0.35 + driver.phase) * 2 * p.wander;

  if (items) {
    // Elinde item yoksa yaklaşan kutu sırasına yönel
    if (!items.heldItem(kart) && !items.isRolling(kart)) {
      for (const row of items.rows) {
        const ahead = (row - idx + n) % n;
        if (ahead > 2 && ahead < 28) {
          let best = null;
          for (const b of items.boxes) {
            if (b.index === row && b.active && (!best || Math.abs(b.lateral - lane) < Math.abs(best.lateral - lane))) best = b;
          }
          if (best) lane = best.lateral;
        }
      }
    }
    // Önündeki yağ lekesinden kaç
    for (const s of items.slicks.values()) {
      const c = track.closest(s.pos.x, s.pos.z, idx);
      const ahead = (c.index - idx + n) % n;
      if (ahead < 14 && Math.abs(c.lateral - lane) < 3.5) lane = c.lateral + (c.lateral > 0 ? -5 : 5);
    }
  }

  const scTarget = shortcutTarget(driver, kart, track, idx, n, speed, look);
  const i = (idx + look) % n;
  const cp = track.centerline[i];
  const r = track.rights[i];
  const tx = scTarget ? scTarget.x : cp.x + r.x * lane;
  const tz = scTarget ? scTarget.z : cp.z + r.z * lane;
  const want = Math.atan2(tx - kart.position.x, tz - kart.position.z);
  const err = Math.atan2(Math.sin(want - kart.heading), Math.cos(want - kart.heading));

  // Viraj keskinliği (önümüzdeki en dar nokta)
  let radius = Infinity;
  if (!scTarget) for (let k = 2; k <= look + 6; k += 2) radius = Math.min(radius, track.turnRadius[(idx + k) % n]);
  const cornerLimit = Math.min(1, radius / 40 + 0.55);
  // Uykucu: ilk turlarda yavaş, son turda uyanır
  const skill = p.sleepy ? driver.skill + (progress < 0.34 ? -0.05 : progress > 0.66 ? 0.05 : 0) : driver.skill;
  const target = KART.maxSpeed * skill * cornerLimit;

  // Drift: keskin virajda viraj yönüne drift at, viraj bitince bırak (mini-turbo)
  const turnDir = Math.sign(err) || 1;
  if (!driver.drifting && radius < 34 && speed > 16 && Math.abs(err) > 0.08 && Math.random() < driver.driftSkill * 0.2 * p.drift) {
    driver.drifting = true;
    driver.driftDir = turnDir;
    driver.driftTimer = 0;
  }
  if (driver.drifting) {
    driver.driftTimer += dt;
    if (radius > 50 || driver.driftTimer > 2.8 || speed < 10 || turnDir !== driver.driftDir) driver.drifting = false;
  }

  const input = {
    throttle: speed < target || kart.boostTime > 0 ? 1 : 0,
    brake: 0,
    steer: Math.max(-1, Math.min(1, err * 2.6)),
    drift: driver.drifting,
    useItem: false,
    backward: false,
  };
  if (driver.drifting) input.steer = driver.driftDir * Math.min(1, 0.4 + Math.abs(err) * 3);

  if (items) decideItem(driver, kart, items, ctx, radius, progress, dt, input);
  return input;
}

// Kısayola girme kararı ve kısayol üzerinde hedef nokta. Kısayoldayken ana yol hedefi yerine
// kısayolun orta çizgisindeki ileri bir noktayı döner (yoksa null).
function shortcutTarget(driver, kart, track, idx, n, speed, look) {
  const list = track.shortcuts;
  if (!list.length) return null;
  if (driver.sc) {
    const sc = driver.sc;
    const h = sc.nearest(kart.position.x, kart.position.z);
    // Kısayoldan çıktı ya da bitişe yaklaştı → ana yola dön
    if (!h || h.d > sc.halfWidth + 14 || h.s > sc.length - 5 || kart.spinTime > 0) {
      driver.sc = null;
      return null;
    }
    return sc.pointAt(h.s + 6 + speed * 0.32);
  }
  for (const sc of list) {
    const ahead = (sc.entryIndex - idx + n) % n;
    if (ahead > 60 && ahead < n - 6) {
      delete driver.scChoice[sc.id]; // giriş geçildi / uzakta: sonraki tur için sıfırla
      continue;
    }
    if (ahead > 40 && ahead < n - 6) continue;
    if (driver.scChoice[sc.id] === undefined) driver.scChoice[sc.id] = Math.random() < driver.p.shortcut * (sc.def.botChance ?? 0.5) * 1.4;
    if (!driver.scChoice[sc.id]) continue;
    // Atlama varsa yeterli hızla girmeli
    if (sc.def.botMinSpeed && speed < sc.def.botMinSpeed && ahead < 20) continue;
    if (ahead <= 20 || ahead >= n - 6) {
      driver.sc = sc;
      return sc.pointAt(6 + speed * 0.32);
    }
  }
  return null;
}

function decideItem(driver, kart, items, ctx, radius, progress, dt, input) {
  const p = driver.p;
  const item = items.heldItem(kart);
  if (!item) {
    driver.itemHeld = 0;
    return;
  }
  driver.itemHeld += dt;
  const place = ctx.positionOf(kart);
  const fx = Math.sin(kart.heading);
  const fz = Math.cos(kart.heading);
  // En yakın önündeki / arkasındaki rakip
  let ahead = Infinity;
  let behind = Infinity;
  for (const other of ctx.karts) {
    if (other === kart || !other.active) continue;
    const dx = other.position.x - kart.position.x;
    const dz = other.position.z - kart.position.z;
    const along = dx * fx + dz * fz;
    const side = Math.abs(dx * fz - dz * fx);
    if (along > 0 && side < 4) ahead = Math.min(ahead, along);
    if (along < 0 && side < 5) behind = Math.min(behind, -along);
  }
  const patient = driver.itemHeld > driver.itemPatience;
  const bored = driver.itemHeld > driver.itemPatience * 2.5;
  switch (item) {
    case 'turbo':
      // Uykucu turbosunu son tura saklar
      if (p.sleepy && progress < 0.66) break;
      input.useItem = radius > 60 || patient;
      break;
    case 'coconut': {
      const range = 15 + 45 * p.attack; // agresif uzaktan da atar
      if (p.sneaky && behind < 20) {
        input.useItem = true;
        input.backward = true;
      } else if (ahead < range) input.useItem = true;
      else if (behind < 14 && (patient || p.defend > 0.8)) {
        input.useItem = true;
        input.backward = true;
      } else if (bored) input.useItem = true;
      break;
    }
    case 'oil':
      // Kurnaz: virajdan hemen önce bırakır; diğerleri arkadaki rakibe göre
      if (p.sneaky) input.useItem = (radius < 35 && behind < 45) || bored;
      else input.useItem = behind < 10 + 22 * p.attack || bored;
      break;
    case 'shield': {
      // Yaklaşan hindistan cevizi varsa ya da (savunmacıysa) öndeyse kalkanı aç
      let threat = false;
      for (const c of items.projectiles.values()) {
        if (c.owner !== kart && c.pos.distanceToSquared(kart.position) < 25 * 25) threat = true;
      }
      input.useItem = threat || (p.defend > 0.6 && place <= 3) || bored;
      break;
    }
  }
}
