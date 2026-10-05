// Mini harita: pistin kuşbakışı çizimi + hayvan kafası simgeleri (2D canvas).
// Seçenekler: theme 'glass' | 'themed' | 'plain', shortcuts 'two' | 'near' | 'dash'
// heads: { karakterId: canvas } (portraits.js renderHeads)

const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;
const mix = (a, b, t) => {
  const f = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
  const [r1, g1, b1] = f(a);
  const [r2, g2, b2] = f(b);
  return `rgb(${Math.round(r1 + (r2 - r1) * t)},${Math.round(g1 + (g2 - g1) * t)},${Math.round(b1 + (b2 - b1) * t)})`;
};

export function createMinimap(track, { size = 190, heads = {}, theme = 'glass', shortcuts: scMode = 'two' } = {}) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size * dpr;
  canvas.style.width = canvas.style.height = `${size}px`;
  const ctx = canvas.getContext('2d');

  // Pisti kutuya sığdır
  const pts = track.centerline;
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  const grow = (x, z) => {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  };
  for (const p of pts) grow(p.x, p.z);
  for (const sc of track.shortcuts ?? []) for (let d = 0; d <= sc.length; d += 6) grow(sc.pointAt(d).x, sc.pointAt(d).z);
  const pad = size < 100 ? 8 : 18;
  const scale = (size - pad * 2) / Math.max(maxX - minX, maxZ - minZ);
  const ox = (size - (maxX - minX) * scale) / 2;
  const oz = (size - (maxZ - minZ) * scale) / 2;
  const map = (x, z) => [(x - minX) * scale + ox, (z - minZ) * scale + oz];

  // Kısayol çizgileri (harita koordinatında) ve türü: B = süpriz yolu (altın kutulu), A = süre kazandıran
  const scLines = (track.shortcuts ?? []).map((sc) => {
    const line = [];
    for (let d = 0; d <= sc.length; d += 4) {
      const q = sc.pointAt(d);
      line.push(map(q.x, q.z));
    }
    const surprise = !!sc.def.surprise;
    const mid = map(sc.pointAt(sc.length * (surprise ? sc.def.surprise.f ?? 0.5 : 0.5)).x, sc.pointAt(sc.length * (surprise ? sc.def.surprise.f ?? 0.5 : 0.5)).z);
    const entry = sc.pointAt(sc.sA);
    return { line, surprise, mid, entry: { x: entry.x, z: entry.z } };
  });

  // Tema renkleri
  const pal = track.def?.palette ?? {};
  const ground = hex(pal.base ?? 0xf3d9a4);
  const water = hex(track.def?.water?.shallow ?? 0x3fe0d0);
  const roadFill = theme === 'themed' ? '#3a3f4a' : '#ffffff';
  const roadEdge = theme === 'plain' ? 'rgba(11,42,85,0.55)' : 'rgba(11,42,85,0.85)';

  // Pist çizimini bir kez önceden hazırla
  const base = document.createElement('canvas');
  base.width = base.height = size * dpr;
  const b = base.getContext('2d');
  b.scale(dpr, dpr);
  b.lineJoin = b.lineCap = 'round';
  const path = () => {
    b.beginPath();
    pts.forEach((p, i) => (i ? b.lineTo(...map(p.x, p.z)) : b.moveTo(...map(p.x, p.z))));
    b.closePath();
  };
  if (theme === 'glass' || theme === 'themed') {
    b.beginPath();
    b.roundRect(2, 2, size - 4, size - 4, 18);
    if (theme === 'glass') {
      b.fillStyle = 'rgba(8,28,64,0.62)';
      b.fill();
      b.lineWidth = 2;
      b.strokeStyle = 'rgba(255,255,255,0.25)';
      b.stroke();
    } else {
      b.fillStyle = mix(ground, '#000000', 0.12);
      b.fill();
      b.save();
      b.clip();
      for (const p of track.def?.ponds ?? []) {
        const [px, pz] = map(p.x, p.z);
        b.beginPath();
        b.arc(px, pz, p.r * scale, 0, Math.PI * 2);
        b.fillStyle = water;
        b.fill();
      }
      b.restore();
      b.lineWidth = 3;
      b.strokeStyle = 'rgba(11,42,85,0.9)';
      b.beginPath();
      b.roundRect(2, 2, size - 4, size - 4, 18);
      b.stroke();
    }
  }
  path();
  b.strokeStyle = roadEdge;
  b.lineWidth = theme === 'plain' ? 13 : 14;
  b.stroke();
  if (theme === 'themed') {
    // Bordür: kırmızı-beyaz kesik şerit
    path();
    b.setLineDash([4, 4]);
    b.lineCap = 'butt';
    b.strokeStyle = '#e23b36';
    b.lineWidth = 11;
    b.stroke();
    b.setLineDash([]);
    b.lineCap = 'round';
  }
  path();
  b.strokeStyle = roadFill;
  b.lineWidth = theme === 'themed' ? 7 : 8;
  b.stroke();
  // Başlangıç çizgisi
  const [sx, sz] = map(pts[0].x, pts[0].z);
  const r = track.rights[0];
  b.strokeStyle = theme === 'themed' ? '#ffffff' : '#111';
  b.lineWidth = 3;
  b.lineCap = 'butt';
  b.beginPath();
  b.moveTo(sx - r.x * 8, sz - r.z * 8);
  b.lineTo(sx + r.x * 8, sz + r.z * 8);
  b.stroke();

  const drawShortcut = (s, pulse) => {
    const c = ctx;
    c.save();
    c.lineJoin = c.lineCap = 'round';
    c.beginPath();
    s.line.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    if (scMode === 'dash') {
      c.setLineDash([5, 4]);
      c.lineCap = 'butt';
      c.strokeStyle = '#ffd23f';
      c.lineWidth = 3.5;
    } else if (s.surprise) {
      c.setLineDash([2, 5]);
      c.strokeStyle = '#c58cff';
      c.lineWidth = 4;
    } else {
      c.strokeStyle = '#ffc531';
      c.lineWidth = 4.5;
    }
    if (pulse) c.globalAlpha = 0.65 + 0.35 * pulse;
    c.stroke();
    c.restore();
    if (scMode === 'dash') return;
    // Simge: A = ⚡ (süre kazandırır), B = ? (altın kutu burada)
    const [mx, my] = s.mid;
    c.save();
    c.beginPath();
    c.arc(mx, my, 6.5, 0, Math.PI * 2);
    c.fillStyle = s.surprise ? '#8e44ff' : '#ff9d00';
    c.fill();
    c.lineWidth = 1.5;
    c.strokeStyle = '#fff';
    c.stroke();
    c.fillStyle = '#fff';
    c.font = '800 9px "Baloo 2", system-ui, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(s.surprise ? '?' : '⚡', mx, my + 0.5);
    c.restore();
  };

  const HEAD_R = 9;
  const drawHead = (d) => {
    const [x, y] = map(d.x, d.z);
    const rad = d.me ? HEAD_R + 2.5 : HEAD_R;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fillStyle = d.color;
    ctx.fill();
    ctx.clip();
    const img = heads[d.id];
    if (img) ctx.drawImage(img, x - rad, y - rad, rad * 2, rad * 2);
    ctx.restore();
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.lineWidth = d.me ? 3 : 2;
    ctx.strokeStyle = d.me ? '#ffd23f' : d.human ? '#ffffff' : '#0b2a55';
    ctx.stroke();
    // Sıra rozeti
    if (d.place) {
      const bx = x + rad * 0.75;
      const by = y + rad * 0.75;
      ctx.beginPath();
      ctx.arc(bx, by, 5.6, 0, Math.PI * 2);
      ctx.fillStyle = d.place === 1 ? '#ffd23f' : '#0b2a55';
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#fff';
      ctx.stroke();
      ctx.fillStyle = d.place === 1 ? '#0b2a55' : '#fff';
      ctx.font = '800 8px "Baloo 2", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(d.place), bx, by + 0.4);
    }
  };

  return {
    canvas,
    // dots: [{ x, z, id, color, me, human?, place? }]
    draw(dots, time = 0) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(base, 0, 0);
      ctx.scale(dpr, dpr);
      const me = dots.find((d) => d.me);
      track.shortcuts?.forEach((sc, i) => {
        const s = scLines[i];
        if (scMode === 'near') {
          // Yalnız oyuncu girişe 120 m yaklaşınca belirir (yanıp söner)
          if (!me || Math.hypot(me.x - s.entry.x, me.z - s.entry.z) > 120) return;
          drawShortcut(s, 0.5 + 0.5 * Math.sin(time * 6));
        } else drawShortcut(s, 0);
      });
      // Oyuncu en üstte, geri sıralar öndekilerin altında
      for (const d of [...dots].sort((a, b2) => b2.place - a.place || a.me - b2.me)) drawHead(d);
      for (const d of dots) if (d.me) drawHead(d);
    },
  };
}
