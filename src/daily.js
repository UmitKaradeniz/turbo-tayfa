// Günlük meydan okuma: tarihe göre (yerel gün) herkes için aynı pist + hedef. Sunucu gerekmez.

export const dateKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const dayNumber = (key) => Math.round(Date.parse(`${key}T12:00:00Z`) / 86400000);

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Hedef türleri: ok(sonuç) sonuç = { place, shortcuts, gold, hits, mt3 }
const GOALS = [
  { id: 'win', text: () => 'Yarışı 1. bitir', ok: (r) => r.place === 1, diff: 'normal' },
  { id: 'podium', text: () => 'İlk 3\'e gir', ok: (r) => r.place <= 3, diff: 'hard' },
  { id: 'shortcut', text: (n) => `${n} kez kısayola gir ve ilk 5'te bitir`, n: [2, 3], ok: (r, n) => r.shortcuts >= n && r.place <= 5, diff: 'normal' },
  { id: 'gold', text: () => 'Altın kutu al ve ilk 5\'te bitir', ok: (r) => r.gold >= 1 && r.place <= 5, diff: 'normal' },
  { id: 'hits', text: (n) => `${n} rakibe isabet ettir ve ilk 5'te bitir`, n: [2, 3], ok: (r, n) => r.hits >= n && r.place <= 5, diff: 'normal' },
  { id: 'purple', text: (n) => `${n} kez mor (3. kademe) mini-turbo yap ve ilk 4'te bitir`, n: [2, 3], ok: (r, n) => r.mt3 >= n && r.place <= 4, diff: 'normal' },
];

// trackIds: oynanabilir pist kimlikleri. Aynı gün herkes için aynı sonucu döner.
export function dailyChallenge(trackIds, key = dateKey()) {
  const rand = rng(dayNumber(key) * 2654435761);
  const track = trackIds[Math.floor(rand() * trackIds.length)];
  const goal = GOALS[Math.floor(rand() * GOALS.length)];
  const n = goal.n ? goal.n[Math.floor(rand() * goal.n.length)] : 0;
  const laps = rand() < 0.5 ? 2 : 3;
  return { key, track, laps, difficulty: goal.diff, goal: goal.id, n, text: goal.text(n) };
}

export const dailyDone = (ch, result) => GOALS.find((g) => g.id === ch.goal)?.ok(result, ch.n) ?? false;
