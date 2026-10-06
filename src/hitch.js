// Takılma (hitch) ölçer: bir kare beklenenden çok uzun sürdüyse nedenini ayırır.
//  mantık = fizik/oyun güncellemesi (JS), çizim = postfx.render (shader derleme, GPU gönderimi), gc = JS yığını düştü (çöp toplama).
// Hiçbir şeyi değiştirmez; yalnızca ölçer. Özet: `window.__hitch()` ve FPS satırında "takılma N".

const THRESH = 45; // ms: bundan uzun kare takılma sayılır (60 FPS = 16.7)
const KEEP = 40;
const list = []; // { race: yarış sn, ms, logic, draw, gc: MB (negatif=düştü), notes }
let t0 = 0;
let t1 = 0;
let prevNow = 0;
let prevHeap = 0;
let notes = [];
let prevNotes = [];
let active = false; // yalnız yarış başladıktan sonra ve duraklatılmamışken say
let total = 0;
let worst = 0;

const heapMB = () => (performance.memory ? performance.memory.usedJSHeapSize / 1048576 : 0);

export const hitch = {
  // Eşya/olay gibi takılma sebebi olabilecek anları işaretle (bu ve önceki karede olanlar rapora girer)
  note(label) {
    if (notes.length < 6 && !notes.includes(label)) notes.push(label);
  },
  begin(now, on) {
    t0 = performance.now();
    active = on && prevNow > 0;
    this.gap = active ? now - prevNow : 0;
    prevNow = now;
  },
  mid() {
    t1 = performance.now();
  },
  end(raceTime) {
    if (!active) {
      notes = [];
      return;
    }
    const t2 = performance.now();
    const gap = this.gap;
    if (gap > THRESH) {
      const heap = heapMB();
      const e = {
        race: +raceTime.toFixed(1),
        ms: Math.round(gap),
        logic: Math.round(t1 - t0),
        draw: Math.round(t2 - t1),
        gc: prevHeap ? +(heap - prevHeap).toFixed(1) : 0,
        notes: [...new Set([...prevNotes, ...notes])].join(','),
      };
      total++;
      worst = Math.max(worst, e.ms);
      list.push(e);
      if (list.length > KEEP) list.shift();
    }
    prevHeap = heapMB();
    prevNotes = notes;
    notes = [];
  },
  reset() {
    list.length = 0;
    total = 0;
    worst = 0;
    prevNow = 0;
  },
  get total() {
    return total;
  },
  get worst() {
    return worst;
  },
  list,
  // Sebebi tahmini: çizim uzunsa shader/GPU, mantık uzunsa JS, yığın düştüyse çöp toplama, ikisi de kısaysa tarayıcı/sistem
  cause(e) {
    if (e.gc < -1.5) return 'çöp';
    if (e.draw > e.logic && e.draw > 20) return 'çizim';
    if (e.logic > 20) return 'mantık';
    return 'sistem';
  },
  summary() {
    const by = {};
    for (const e of list) by[this.cause(e)] = (by[this.cause(e)] || 0) + 1;
    const top = [...list].sort((a, b) => b.ms - a.ms).slice(0, 3).map((e) => `${e.ms}ms@${e.race}s ${this.cause(e)}(${e.logic}/${e.draw}${e.notes ? ' ' + e.notes : ''})`);
    return `takılma ${total} (en kötü ${worst}ms) ${JSON.stringify(by)} ${top.join(' | ')}`;
  },
};
window.__hitch = () => ({ total, worst, summary: hitch.summary(), list });
