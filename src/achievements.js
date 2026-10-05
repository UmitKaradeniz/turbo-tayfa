// Başarımlar. `s` = kalıcı sayaçlar (progress.js stats), `c` = bu yarışın bilgisi (yoksa null).
// prog(s): [şimdiki, hedef] — listede ilerleme çubuğu için. tp: açılınca verilen Turbo Puan.
const count = (o) => Object.keys(o ?? {}).length;
const goal = (key, n) => (s) => [Math.min(s[key] ?? 0, n), n];

export const ACHIEVEMENTS = [
  { id: 'first_finish', icon: '🏁', name: 'İlk Bitiş', desc: 'Bir yarışı bitir.', tp: 30, test: (s) => s.finished >= 1, prog: goal('finished', 1) },
  { id: 'first_win', icon: '🥇', name: 'İlk Zafer', desc: 'Bir yarışı 1. bitir.', tp: 60, test: (s) => s.wins >= 1, prog: goal('wins', 1) },
  { id: 'podium5', icon: '🏆', name: 'Kürsü Sakini', desc: 'Toplam 5 kez ilk üçe gir.', tp: 60, test: (s) => s.podiums >= 5, prog: goal('podiums', 5) },
  { id: 'wins10', icon: '👑', name: 'Şampiyon Adayı', desc: 'Toplam 10 yarış kazan.', tp: 120, test: (s) => s.wins >= 10, prog: goal('wins', 10) },
  { id: 'streak3', icon: '🔥', name: 'Seri Galibiyet', desc: 'Art arda 3 yarış kazan.', tp: 100, test: (s) => s.bestStreak >= 3, prog: goal('bestStreak', 3) },
  { id: 'races25', icon: '🐺', name: 'Pist Kurdu', desc: 'Toplam 25 yarış bitir.', tp: 100, test: (s) => s.finished >= 25, prog: goal('finished', 25) },
  { id: 'explorer', icon: '🗺️', name: 'Gezgin', desc: 'Tüm pistlerde en az bir yarış bitir.', tp: 150, test: (s, c, all) => count(s.tracks) >= all.tracks, prog: (s, all) => [Math.min(count(s.tracks), all.tracks), all.tracks] },
  { id: 'rulers', icon: '🧭', name: 'Hâkim', desc: '5 farklı pistte 1. ol.', tp: 120, test: (s) => count(s.trackWins) >= 5, prog: (s) => [Math.min(count(s.trackWins), 5), 5] },
  { id: 'shortcut25', icon: '⚡', name: 'Kestirmeci', desc: 'Toplam 25 kez kısayola gir.', tp: 80, test: (s) => s.shortcuts >= 25, prog: goal('shortcuts', 25) },
  { id: 'shortcut_race', icon: '🧠', name: 'Yol Bilen', desc: 'Tek yarışta 3 kez kısayola gir.', tp: 60, test: (s, c) => (c?.shortcuts ?? 0) >= 3 },
  { id: 'gold10', icon: '🎁', name: 'Altın Avcısı', desc: 'Toplam 10 altın kutu al.', tp: 80, test: (s) => s.gold >= 10, prog: goal('gold', 10) },
  { id: 'gold_race', icon: '💰', name: 'Servet', desc: 'Tek yarışta 2 altın kutu al.', tp: 60, test: (s, c) => (c?.gold ?? 0) >= 2 },
  { id: 'hits10', icon: '🎯', name: 'Nişancı', desc: 'Rakiplere toplam 10 isabet ettir.', tp: 80, test: (s) => s.hits >= 10, prog: goal('hits', 10) },
  { id: 'hits_race', icon: '💥', name: 'Vurucu', desc: 'Tek yarışta 3 isabet ettir.', tp: 60, test: (s, c) => (c?.hits ?? 0) >= 3 },
  { id: 'lap10', icon: '⏱️', name: 'Hız Tutkunu', desc: 'Toplam 10 tur rekoru kır.', tp: 80, test: (s) => s.lapRecords >= 10, prog: goal('lapRecords', 10) },
  { id: 'record', icon: '📈', name: 'Rekortmen', desc: 'Bir pistte toplam süre rekorunu kır.', tp: 80, test: (s) => s.records >= 1, prog: goal('records', 1) },
  { id: 'purple10', icon: '🟣', name: 'Mor Ustası', desc: 'Toplam 10 kez mor (3. kademe) mini-turbo yap.', tp: 80, test: (s) => s.mt3 >= 10, prog: goal('mt3', 10) },
  { id: 'cup', icon: '🥤', name: 'Kupa Sahibi', desc: 'Turbo Kupası\'nı kazan.', tp: 120, test: (s) => s.cups >= 1, prog: goal('cups', 1) },
  { id: 'bigcup', icon: '🏅', name: 'Büyük Kupa', desc: 'Büyük Kupa\'yı kazan.', tp: 200, test: (s) => s.bigCups >= 1, prog: goal('bigCups', 1) },
  { id: 'online1', icon: '🌐', name: 'Tayfa Zamanı', desc: 'Çevrimiçi bir yarış bitir.', tp: 50, test: (s) => s.onlineRaces >= 1, prog: goal('onlineRaces', 1) },
  { id: 'online_win', icon: '🤝', name: 'Odanın Efendisi', desc: 'Gerçek oyuncuların olduğu çevrimiçi yarışı kazan.', tp: 120, test: (s) => s.onlineWins >= 1, prog: goal('onlineWins', 1) },
  { id: 'painter', icon: '🎨', name: 'Boyacı', desc: 'Garaj\'dan bir boya ya da iz seç.', tp: 30, test: (s) => s.styled >= 1, prog: goal('styled', 1) },
  { id: 'level5', icon: '⭐', name: 'Deneyimli', desc: 'Seviye 5\'e ulaş.', tp: 60, test: (s) => s.level >= 5, prog: (s) => [Math.min(s.level, 5), 5] },
  { id: 'level10', icon: '🌟', name: 'Usta', desc: 'Seviye 10\'a ulaş.', tp: 120, test: (s) => s.level >= 10, prog: (s) => [Math.min(s.level, 10), 10] },
];
