// Yarış kuralları: geri sayım, ilerleme, tur, sıralama, bitiş.
// Sadece mantık, DOM yok. Olaylar `on` ile dinlenir.
//
// İlerleme: kartın en yakın orta çizgi örneğindeki değişim toplanarak kesintisiz
// bir sayı elde edilir (örnek cinsinden). Başlangıç çizgisi = 0, her tur = track.count.
// Bariyerler kısa yolu fiziksel olarak engellediği için bu yeterli; checkpointler
// kurtarma noktası ve sunucu doğrulaması (Aşama 5) için tutulur.

export const COUNTDOWN = 3; // saniye

export class Race {
  // isOwned(kart): bu cihaz o kartın bitişine karar verebilir mi? (çevrimiçide
  // sadece kendi kartı ve oda sahibiyse botlar; diğerlerinin bitişi sunucudan gelir)
  constructor(track, karts, { laps = 3, isOwned = () => true } = {}) {
    this.track = track;
    this.laps = laps;
    this.isOwned = isOwned;
    this.state = 'countdown'; // countdown → racing → finished
    this.clock = -COUNTDOWN - 0.6; // negatif: geri sayım
    this.listeners = {};
    this.finishOrder = [];
    this.entries = karts.map((kart) => ({
      kart,
      progress: 0,
      lastIndex: -1,
      lapsDone: 0,
      lapStart: 0,
      lapTimes: [],
      finishTime: null,
      serverPlace: null, // çevrimiçi: sunucunun onayladığı sıra
      checkpoint: -1, // son geçilen checkpoint (kurtarma için)
      wrongWayTime: 0,
      wrongWay: false,
    }));
    for (const e of this.entries) this.initProgress(e);
  }

  on(event, fn) {
    (this.listeners[event] ??= []).push(fn);
  }

  emit(event, ...args) {
    for (const fn of this.listeners[event] ?? []) fn(...args);
  }

  initProgress(e) {
    const { track } = this;
    const c = track.closest(e.kart.position.x, e.kart.position.z);
    e.lastIndex = c.index;
    // Grid başlangıç çizgisinin arkasında: ilerleme negatif başlar
    e.progress = c.index > track.count / 2 ? c.index - track.count : c.index;
  }

  get started() {
    return this.state !== 'countdown';
  }

  // Sabit fizik adımında, kartlar hareket ettikten sonra çağrılır
  update(dt) {
    const prev = this.clock;
    this.clock += dt;

    if (this.state === 'countdown') {
      // 3, 2, 1 anonsları
      for (let n = COUNTDOWN; n >= 1; n--) if (prev < -n && this.clock >= -n) this.emit('countdown', n);
      if (this.clock >= 0) {
        this.state = 'racing';
        this.emit('go');
      }
      return;
    }

    const { track } = this;
    const n = track.count;
    for (const e of this.entries) {
      const idx = e.kart.trackIndex;
      if (idx < 0) continue;
      let d = idx - e.lastIndex;
      if (d > n / 2) d -= n;
      if (d < -n / 2) d += n;
      e.progress += d;
      e.lastIndex = idx;

      if (e.finishTime !== null || !this.isOwned(e.kart)) continue;

      // Checkpoint
      const cpSpacing = n / track.checkpoints.length;
      const cp = Math.floor(e.progress / cpSpacing);
      if (cp > e.checkpoint) e.checkpoint = cp;

      // Tur
      const laps = Math.floor(e.progress / n);
      if (laps > e.lapsDone && e.progress >= 0) {
        e.lapsDone = laps;
        if (laps >= 1) {
          const lapTime = this.clock - e.lapStart;
          e.lapTimes.push(lapTime);
          e.lapStart = this.clock;
          this.emit('lap', e, lapTime);
        }
        if (e.lapsDone >= this.laps) {
          e.finishTime = this.clock;
          this.finishOrder.push(e);
          this.emit('finish', e, this.finishOrder.length);
        } else if (e.lapsDone === this.laps - 1) {
          this.emit('finalLap', e);
        }
      }

      // Ters yön: pist yönünün tersine 1 saniyeden fazla gidiyorsa
      const f = track.forwards[idx];
      const along = e.kart.velocity.x * f.x + e.kart.velocity.z * f.z;
      e.wrongWayTime = along < -3 ? e.wrongWayTime + dt : 0;
      const wrong = e.wrongWayTime > 1;
      if (wrong !== e.wrongWay) {
        e.wrongWay = wrong;
        this.emit('wrongWay', e, wrong);
      }
    }

    if (this.state === 'racing' && this.finishOrder.length === this.entries.length) {
      this.finish();
    }
  }

  finish() {
    if (this.state !== 'finished') {
      this.state = 'finished';
      this.emit('allFinished');
    }
  }

  // Sunucudan gelen bitiş (çevrimiçi). Kendi kartımız için sadece resmi sırayı kaydeder.
  applyFinish(kart, time, place) {
    const e = this.entryOf(kart);
    if (!e) return;
    e.serverPlace = place;
    if (e.finishTime === null) {
      e.finishTime = time;
      e.lapsDone = this.laps;
      this.finishOrder.push(e);
      this.emit('finish', e, place);
    }
    // Resmi sıralamaya göre diz (onaylanmamışlar sona, kendi sürelerine göre)
    this.finishOrder.sort((a, b) => (a.serverPlace ?? 99) - (b.serverPlace ?? 99) || a.finishTime - b.finishTime);
  }

  // Yeniden bağlanınca kaldığımız yerden devam
  restore(kart, progress, lapsDone) {
    const e = this.entryOf(kart);
    if (!e) return;
    e.progress = progress;
    e.lapsDone = lapsDone;
    e.lastIndex = kart.trackIndex;
  }

  // Güncel sıralama: bitirenler bitiş sırasına göre, diğerleri ilerlemeye göre
  standings() {
    const running = this.entries.filter((e) => e.finishTime === null).sort((a, b) => b.progress - a.progress);
    return [...this.finishOrder, ...running];
  }

  positionOf(kart) {
    return this.standings().findIndex((e) => e.kart === kart) + 1;
  }

  entryOf(kart) {
    return this.entries.find((e) => e.kart === kart);
  }

  // Son checkpoint'in biraz gerisinde, pist ortasında kurtarma noktası
  respawnPoint(kart) {
    const e = this.entryOf(kart);
    const { track } = this;
    const n = track.count;
    const cpSpacing = n / track.checkpoints.length;
    const sample = Math.max(0, e.checkpoint) * cpSpacing;
    const i = ((Math.round(sample) % n) + n) % n;
    const f = track.forwards[i];
    return { position: track.centerline[i].clone(), heading: Math.atan2(f.x, f.z) };
  }
}
