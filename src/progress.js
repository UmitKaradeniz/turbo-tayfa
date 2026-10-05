// Turbo Puan (TP), seviye, sayaçlar ve başarımlar. Yalnızca bu tarayıcıda saklanır (localStorage); hesap yok.
import { ACHIEVEMENTS } from './achievements.js';
import { dayNumber } from './daily.js';

const KEY = 'tt-progress';
const PLACE_TP = [100, 80, 65, 50, 40, 30, 25, 20];
const FIRST_TRACK_TP = 30;
const STAT_KEYS = ['finished', 'wins', 'podiums', 'streak', 'bestStreak', 'shortcuts', 'gold', 'hits', 'lapRecords', 'records', 'mt3', 'cups', 'bigCups', 'onlineRaces', 'onlineWins', 'styled', 'dailies', 'bestDaily'];

function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || '{}');
    const stats = { trackWins: d.stats?.trackWins && typeof d.stats.trackWins === 'object' ? d.stats.trackWins : {} };
    for (const k of STAT_KEYS) stats[k] = Math.max(0, d.stats?.[k] | 0);
    return {
      tp: Math.max(0, d.tp | 0),
      tracks: d.tracks && typeof d.tracks === 'object' ? d.tracks : {},
      sel: { paint: d.sel?.paint ?? 'stock', trail: d.sel?.trail ?? 'classic' },
      stats,
      ach: d.ach && typeof d.ach === 'object' ? d.ach : {},
      daily: { done: d.daily?.done ?? null, last: d.daily?.last ?? null, streak: Math.max(0, d.daily?.streak | 0) },
    };
  } catch {
    return { tp: 0, tracks: {}, sel: { paint: 'stock', trail: 'classic' }, stats: Object.fromEntries([...STAT_KEYS.map((k) => [k, 0]), ['trackWins', {}]]), ach: {}, daily: { done: null, last: null, streak: 0 } };
  }
}
const data = load();
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* depolama kapalı: sessizce geç */
  }
}

// Seviye L'ye geçmek için gereken TP: 200 + 30*L (1→2: 230, 2→3: 260 ...); seviye 16 ≈ 6600 TP ≈ 60 yarış
const need = (level) => 200 + 30 * level;

// Toplam TP'den seviye, o seviyedeki ilerleme ve çubuk oranı
export function levelInfo(tp = data.tp) {
  let level = 1;
  let left = tp;
  while (left >= need(level)) {
    left -= need(level);
    level++;
  }
  return { level, cur: left, need: need(level), frac: left / need(level) };
}

export const totalTp = () => data.tp;

// Seçili kozmetikler: { paint, trail }. Kilidi açık mı kontrolü cosmetics.js'te (seviye gerekir).
export const selection = () => ({ ...data.sel });
export function setSelection(kind, id) {
  data.sel[kind] = id;
  save();
}

// ---------- Günlük meydan okuma ----------
// Bugün tamamlandı mı ve ardışık gün serisi (dün tamamlandıysa seri sürer)
export function dailyState(key) {
  const d = data.daily;
  const alive = d.last && dayNumber(key) - dayNumber(d.last) <= 1;
  return { done: d.done === key, streak: alive ? d.streak : 0 };
}
export const dailyReward = (streak) => 120 + 20 * Math.min(streak - 1, 5);

// ---------- Başarımlar ----------
let trackTotal = 13; // main.js pist sayısını bildirir (Gezgin başarımı)
export const setTrackTotal = (n) => (trackTotal = n);
const statsView = () => ({ ...data.stats, tracks: data.tracks, level: levelInfo().level });

// Yeni açılanları kaydeder, TP'lerini ekler; zincirleme (TP seviye başarımını açabilir) birkaç tur döner
function unlockNew(ctx, parts) {
  const fresh = [];
  for (let round = 0; round < 3; round++) {
    const s = statsView();
    const got = ACHIEVEMENTS.filter((a) => !data.ach[a.id] && a.test(s, ctx, { tracks: trackTotal }));
    if (!got.length) break;
    for (const a of got) {
      data.ach[a.id] = Date.now();
      data.tp += a.tp;
      parts.push({ label: `${a.icon} ${a.name}`, tp: a.tp, badge: true });
      fresh.push(a);
    }
  }
  return fresh;
}

export function achievementList() {
  const s = statsView();
  return ACHIEVEMENTS.map((a) => ({ ...a, done: !!data.ach[a.id], progress: a.prog ? a.prog(s, { tracks: trackTotal }) : null }));
}

// Anlık olaylar (yarış dışı): Garaj seçimi vb. Yeni açılan başarımların listesini döner.
export function bumpStat(key, n = 1) {
  data.stats[key] = (data.stats[key] ?? 0) + n;
  const parts = [];
  const fresh = unlockNew(null, parts);
  save();
  return { fresh, tp: parts.reduce((t, p) => t + p.tp, 0) };
}

// Kupa kazanıldı (kind: 'cup' | 'bigCup')
export function recordCupWin(kind) {
  data.stats[kind === 'bigCup' ? 'bigCups' : 'cups']++;
  const parts = [];
  const fresh = unlockNew(null, parts);
  save();
  return { fresh, tp: parts.reduce((t, p) => t + p.tp, 0) };
}

// Bir yarış sonunda puan ver ve sayaçları işle.
// `r`: { place, racers, timeTrial, newRecord, lapRecords, shortcuts, gold, hits, mt3, online, humans, trackId }
// Dönüş: { gain, parts: [{label, tp, badge?}], before, after, levelUp }
export function awardRace(r) {
  const parts = [];
  if (r.timeTrial) {
    parts.push({ label: 'Bitiş', tp: 40 });
    if (r.newRecord) parts.push({ label: 'Yeni rekor', tp: 60 });
  } else {
    // Az yarışçılı yarışta alt sıraların puanı kırpılır: 1. her zaman 100
    const idx = Math.min(r.place - 1, PLACE_TP.length - 1);
    parts.push({ label: `${r.place}. sıra`, tp: PLACE_TP[idx] });
    if (r.newRecord) parts.push({ label: 'Yeni rekor', tp: 25 });
  }
  if (r.lapRecords) parts.push({ label: 'Tur rekoru', tp: 15 * Math.min(r.lapRecords, 3) });
  if (r.shortcuts) parts.push({ label: 'Kısayol', tp: 5 * Math.min(r.shortcuts, 4) });
  if (r.gold) parts.push({ label: 'Altın kutu', tp: 10 * Math.min(r.gold, 3) });
  if (r.trackId && !data.tracks[r.trackId]) {
    data.tracks[r.trackId] = 1;
    parts.push({ label: 'İlk kez bu pist', tp: FIRST_TRACK_TP });
  }

  // Sayaçlar
  const st = data.stats;
  const won = !r.timeTrial && r.place === 1;
  st.finished++;
  if (!r.timeTrial) {
    if (r.place <= 3) st.podiums++;
    st.streak = won ? st.streak + 1 : 0;
    st.bestStreak = Math.max(st.bestStreak, st.streak);
    if (won) {
      st.wins++;
      if (r.trackId) st.trackWins[r.trackId] = 1;
    }
  }
  st.shortcuts += r.shortcuts ?? 0;
  st.gold += r.gold ?? 0;
  st.hits += r.hits ?? 0;
  st.lapRecords += r.lapRecords ?? 0;
  st.mt3 += r.mt3 ?? 0;
  if (r.newRecord) st.records++;
  if (r.online) {
    st.onlineRaces++;
    if (won && r.humans > 0) st.onlineWins++;
  }

  // Günlük meydan okuma hedefi tutturuldu (günde bir kez ödül)
  if (r.dailyKey && r.dailyOk && data.daily.done !== r.dailyKey) {
    const streak = dailyState(r.dailyKey).streak + 1;
    data.daily = { done: r.dailyKey, last: r.dailyKey, streak };
    st.dailies++;
    st.bestDaily = Math.max(st.bestDaily, streak);
    parts.push({ label: `📅 Günlük görev (${streak}. gün)`, tp: dailyReward(streak) });
  }

  const before = levelInfo();
  data.tp += parts.reduce((t, p) => t + p.tp, 0);
  unlockNew(r, parts);
  save();
  const after = levelInfo();
  return { gain: parts.reduce((t, p) => t + p.tp, 0), parts, before, after, levelUp: after.level > before.level };
}
