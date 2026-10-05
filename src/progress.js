// Turbo Puan (TP) ve seviye. Yalnızca bu tarayıcıda saklanır (localStorage); hesap yok.
const KEY = 'tt-progress';
const PLACE_TP = [100, 80, 65, 50, 40, 30, 25, 20];
const FIRST_TRACK_TP = 30;

function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || '{}');
    return {
      tp: Math.max(0, d.tp | 0),
      tracks: d.tracks && typeof d.tracks === 'object' ? d.tracks : {},
      sel: { paint: d.sel?.paint ?? 'stock', trail: d.sel?.trail ?? 'classic' },
    };
  } catch {
    return { tp: 0, tracks: {}, sel: { paint: 'stock', trail: 'classic' } };
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

// Bir yarış sonunda puan ver. `r`: { place, racers, timeTrial, newRecord, lapRecords, shortcuts, gold, trackId }
// Dönüş: { gain, parts: [{label, tp}], before, after, levelUp }
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
  const gain = parts.reduce((s, p) => s + p.tp, 0);
  const before = levelInfo();
  data.tp += gain;
  save();
  const after = levelInfo();
  return { gain, parts, before, after, levelUp: after.level > before.level };
}
