import { KART } from './config.js';

// Bot sürücü: orta çizgide ileriye bakan bir hedef noktayı kovalar; keskin
// virajlarda drift atıp mini-turbo alır, item kutularına yönelir, item kullanır
// ve yağ lekelerinden kaçar. Her botun kendi şerit tercihi ve yeteneği var.

// skillRange: [en düşük, en yüksek] hız/yetenek oranı (zorluk ayarından gelir)
export function createDriver(seed, skillRange = [0.9, 0.97]) {
  const rand = (k) => {
    const x = Math.sin(seed * 91.7 + k * 13.3) * 43758.5453;
    return x - Math.floor(x);
  };
  const skill = skillRange[0] + rand(1) * (skillRange[1] - skillRange[0]);
  return {
    skill,
    lane: (rand(2) - 0.5) * 7,
    phase: rand(3) * 10,
    time: 0,
    drifting: false,
    driftDir: 0,
    driftTimer: 0,
    itemHeld: 0, // item elde tutma süresi
    itemPatience: 1.5 + rand(4) * 4,
    driftSkill: Math.min(1, (skill - 0.8) * 5), // yetenekli bot daha çok drift atar
  };
}

// ctx (isteğe bağlı): { items, karts, positionOf }
export function driveInput(driver, kart, track, dt, ctx = null) {
  driver.time += dt;
  const n = track.count;
  const idx = kart.trackIndex < 0 ? 0 : kart.trackIndex;
  const speed = Math.max(0, kart.speed);
  const items = ctx?.items;

  // Hıza göre ileri bakış mesafesi (örnek cinsinden, 1 örnek ≈ 2.5 m)
  const look = Math.round(6 + speed * 0.28);
  let lane = driver.lane + Math.sin(driver.time * 0.35 + driver.phase) * 2;

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

  const i = (idx + look) % n;
  const p = track.centerline[i];
  const r = track.rights[i];
  const tx = p.x + r.x * lane;
  const tz = p.z + r.z * lane;
  const want = Math.atan2(tx - kart.position.x, tz - kart.position.z);
  const err = Math.atan2(Math.sin(want - kart.heading), Math.cos(want - kart.heading));

  // Viraj keskinliği (önümüzdeki en dar nokta)
  let radius = Infinity;
  for (let k = 2; k <= look + 6; k += 2) radius = Math.min(radius, track.turnRadius[(idx + k) % n]);
  const cornerLimit = Math.min(1, radius / 40 + 0.55);
  const target = KART.maxSpeed * driver.skill * cornerLimit;

  // Drift: keskin virajda viraj yönüne drift at, viraj bitince bırak (mini-turbo)
  const turnDir = Math.sign(err) || 1;
  if (!driver.drifting && radius < 34 && speed > 16 && Math.abs(err) > 0.08 && Math.random() < driver.driftSkill * 0.2) {
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

  if (items) decideItem(driver, kart, items, ctx, radius, dt, input);
  return input;
}

function decideItem(driver, kart, items, ctx, radius, dt, input) {
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
  switch (item) {
    case 'turbo':
      input.useItem = radius > 60 || patient;
      break;
    case 'coconut':
      if (ahead < 45) input.useItem = true;
      else if (behind < 14 && patient) {
        input.useItem = true;
        input.backward = true;
      } else if (driver.itemHeld > driver.itemPatience * 2.5) input.useItem = true;
      break;
    case 'oil':
      input.useItem = behind < 22 || driver.itemHeld > driver.itemPatience * 2;
      break;
    case 'shield': {
      // Yaklaşan hindistan cevizi varsa ya da öndeysek kalkanı aç
      let threat = false;
      for (const c of items.projectiles.values()) {
        if (c.owner !== kart && c.pos.distanceToSquared(kart.position) < 25 * 25) threat = true;
      }
      input.useItem = threat || place <= 2 || patient;
      break;
    }
  }
}
