// Kullanım: node check.mjs palmCove [baz]   → eğim, kısayol, item/hazard/zone konumları
import { trackOutline } from 'file:///C:/Users/dkara/turbo-tayfa/src/track.js';
const ids = process.argv.slice(2).filter((a) => !a.startsWith('-'));
for (const id of ids) {
  const def = (await import(`file:///C:/Users/dkara/turbo-tayfa/src/tracks/${id}.js?${Math.random()}`)).default;
  const o = trackOutline(def);
  const cl = o.centerline;
  const n = cl.length;
  const L = o.length;
  const seg = L / n;
  const k = Math.round(10 / seg); // 10 m pencere
  const grade = (i) => {
    const a = cl[(i - k + n) % n];
    const b = cl[(i + k) % n];
    return (b.y - a.y) / Math.hypot(b.x - a.x, b.z - a.z);
  };
  let mx = 0, mxi = 0, sum = 0;
  const steep = [];
  for (let i = 0; i < n; i++) {
    const g = grade(i);
    sum += Math.abs(g);
    if (Math.abs(g) > Math.abs(mx)) { mx = g; mxi = i; }
    if (Math.abs(g) > 0.13) steep.push((i / n).toFixed(3));
  }
  const ys = cl.map((p) => p.y);
  console.log(`\n=== ${id}  len ${Math.round(L)}  y ${Math.min(...ys).toFixed(1)}..${Math.max(...ys).toFixed(1)}  maxGrade ${(mx * 100).toFixed(1)}% @${(mxi / n).toFixed(3)}  avg ${((sum / n) * 100).toFixed(1)}%  steep>13%: ${steep.length ? steep[0] + '..' + steep[steep.length - 1] + ' (' + steep.length + ')' : '-'}`);
  const at = (f) => `${f}:${(grade(Math.round(f * n) % n) * 100).toFixed(0)}%/y${cl[Math.round(f * n) % n].y.toFixed(1)}`;
  console.log('  item rows   ', [0.16, 0.47, 0.77].map(at).join('  '));
  console.log('  hazards     ', (def.hazards ?? []).map((h) => at(h.f)).join('  '));
  console.log('  zones       ', [...(def.zones ?? []), ...(def.hotZones ?? [])].map((z) => `${z.type ?? 'hot'} ${z.f.join('-')} g${(grade(Math.round(((z.f[0] + z.f[1]) / 2) * n) % n) * 100).toFixed(0)}%`).join('  '));
  const near = (x, z) => { let b = 0, bd = 1e9; cl.forEach((p, i) => { const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; b = i; } }); return [b, bd]; };
  for (const sc of def.shortcuts ?? []) {
    const P = sc.points;
    const [a] = near(P[0][0], P[0][1]);
    const [b] = near(P[P.length - 1][0], P[P.length - 1][1]);
    const y0 = cl[a].y, y1 = cl[b].y;
    let total = 0;
    for (let i = 1; i < P.length; i++) total += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
    // kısayol boyunca bed yüksekliği (doğrusal) ile yakındaki ana yol yüksekliği farkı
    let worst = 0, wf = 0, acc = 0;
    for (let i = 1; i < P.length; i++) {
      const sl = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
      for (let t = 0; t < 1; t += 0.1) {
        const x = P[i - 1][0] + (P[i][0] - P[i - 1][0]) * t, z = P[i - 1][1] + (P[i][1] - P[i - 1][1]) * t;
        const s = acc + sl * t;
        const [m, d] = near(x, z);
        if (s < 18 || s > total - 18 || d > 22) continue;
        const bed = y0 + (y1 - y0) * (s / total);
        const dy = Math.abs(cl[m].y - bed) * (d < 22 ? 1 : 0);
        if (dy > worst) { worst = dy; wf = (m / n).toFixed(3); }
      }
      acc += sl;
    }
    console.log(`  shortcut ${sc.id}  ${(a / n).toFixed(3)}→${(b / n).toFixed(3)}  y ${y0.toFixed(1)}→${y1.toFixed(1)}  len ${Math.round(total)}  slope ${(((y1 - y0) / total) * 100).toFixed(0)}%  yakın ana yol farkı ${worst.toFixed(1)} m @${wf}`);
  }
}
