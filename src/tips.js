// Bağlamsal ipuçları: her biri yalnızca bir kez gösterilir (bu tarayıcıda hatırlanır). Az ve kısa tutulur.
const KEY = 'tt-tips';
function load() {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) || '[]'));
  } catch {
    return new Set();
  }
}
const seen = load();

// İpucu daha önce gösterilmediyse true döner ve gösterildi diye işaretler
export function tipOnce(id) {
  if (seen.has(id)) return false;
  seen.add(id);
  try {
    localStorage.setItem(KEY, JSON.stringify([...seen]));
  } catch {}
  return true;
}
