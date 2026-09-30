// Ağ üzerinden kart durumu: kodlama, arabellek ve interpolasyon.
// Uzak kartlar ~100 ms geriden, iki anlık görüntü arasında yumuşatılarak gösterilir.

export const INTERP_DELAY = 110; // ms
const MAX_EXTRAPOLATE = 250; // ms

const r2 = (v) => Math.round(v * 100) / 100;

export function encodeState(kart, entry, serverNow) {
  return {
    t: Math.round(serverNow),
    p: [r2(kart.position.x), r2(kart.position.y), r2(kart.position.z)],
    h: Math.round(kart.heading * 1000) / 1000,
    v: [r2(kart.velocity.x), r2(kart.velocity.y), r2(kart.velocity.z)],
    st: r2(kart.steer),
    dd: kart.drifting ? kart.driftDir : 0,
    dt: r2(kart.driftTime),
    pr: r2(entry.progress),
    l: entry.lapsDone,
    bo: kart.boostTime > 0 ? 1 : 0,
    sp: r2(kart.spinTime),
    sh: kart.shieldTime > 0 ? 1 : 0,
  };
}

export class RemoteBuffer {
  constructor() {
    this.snaps = [];
    this.lastReceived = 0;
  }

  push(s) {
    if (!s || typeof s.t !== 'number') return;
    const last = this.snaps[this.snaps.length - 1];
    if (last && s.t <= last.t) return; // eski / tekrar
    this.snaps.push(s);
    if (this.snaps.length > 30) this.snaps.shift();
    this.lastReceived = performance.now();
  }

  get stale() {
    return performance.now() - this.lastReceived > 2500;
  }

  // renderTime (sunucu saati) için interpole edilmiş durum
  sample(renderTime) {
    const s = this.snaps;
    if (!s.length) return null;
    if (renderTime <= s[0].t) return s[0];
    for (let i = s.length - 1; i >= 0; i--) {
      if (s[i].t <= renderTime) {
        const a = s[i];
        const b = s[i + 1];
        if (!b) {
          // Yeni veri gelmedi: hızla biraz ileri tahmin et
          const ahead = Math.min(MAX_EXTRAPOLATE, renderTime - a.t) / 1000;
          return { ...a, p: [a.p[0] + a.v[0] * ahead, a.p[1], a.p[2] + a.v[2] * ahead] };
        }
        const t = (renderTime - a.t) / (b.t - a.t);
        return {
          ...b,
          p: [a.p[0] + (b.p[0] - a.p[0]) * t, a.p[1] + (b.p[1] - a.p[1]) * t, a.p[2] + (b.p[2] - a.p[2]) * t],
          h: a.h + Math.atan2(Math.sin(b.h - a.h), Math.cos(b.h - a.h)) * t,
          v: [a.v[0] + (b.v[0] - a.v[0]) * t, a.v[1] + (b.v[1] - a.v[1]) * t, a.v[2] + (b.v[2] - a.v[2]) * t],
          st: a.st + (b.st - a.st) * t,
        };
      }
    }
    return s[0];
  }
}

// Interpole edilmiş durumu karta uygula (fizik çalıştırmadan)
export function applyRemoteState(kart, s, track) {
  kart.position.set(s.p[0], s.p[1], s.p[2]);
  kart.prevPosition.copy(kart.position);
  kart.heading = kart.prevHeading = s.h;
  kart.velocity.set(s.v[0], s.v[1], s.v[2]);
  kart.steer = s.st;
  kart.drifting = s.dd !== 0;
  kart.driftDir = s.dd;
  kart.driftTime = s.dt;
  kart.boostTime = s.bo ? 0.1 : 0;
  kart.spinTime = s.sp ?? 0;
  kart.shieldTime = s.sh ? 1 : 0;
  kart.speed = kart.velocity.x * Math.sin(kart.heading) + kart.velocity.z * Math.cos(kart.heading);
  const g = track.groundAt(kart.position, kart.trackIndex);
  kart.trackIndex = g.index;
  kart.pathIndex = g.pathIndex;
  kart.onShortcut = g.shortcut;
  kart.grounded = kart.position.y <= g.y + 0.3;
  kart.groundNormal.copy(g.normal);
  kart.surface = g.surface;
}

