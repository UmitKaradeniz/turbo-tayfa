// Mini harita: pistin kuşbakışı çizimi + kart noktaları (2D canvas).

export function createMinimap(track, size = 170) {
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
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
  }
  const pad = 14;
  const scale = (size - pad * 2) / Math.max(maxX - minX, maxZ - minZ);
  const ox = (size - (maxX - minX) * scale) / 2;
  const oz = (size - (maxZ - minZ) * scale) / 2;
  const map = (x, z) => [(x - minX) * scale + ox, (z - minZ) * scale + oz];

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
  path();
  b.strokeStyle = 'rgba(11,42,85,0.55)';
  b.lineWidth = 13;
  b.stroke();
  path();
  b.strokeStyle = '#ffffff';
  b.lineWidth = 7;
  b.stroke();
  // Başlangıç çizgisi
  const [sx, sz] = map(pts[0].x, pts[0].z);
  const r = track.rights[0];
  b.strokeStyle = '#111';
  b.lineWidth = 3;
  b.lineCap = 'butt';
  b.beginPath();
  b.moveTo(sx - r.x * 7, sz - r.z * 7);
  b.lineTo(sx + r.x * 7, sz + r.z * 7);
  b.stroke();

  return {
    canvas,
    // dots: [{ x, z, color, me }]
    draw(dots) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(base, 0, 0);
      ctx.scale(dpr, dpr);
      // Oyuncu en üstte çizilsin
      for (const d of [...dots].sort((a, b2) => a.me - b2.me)) {
        const [x, y] = map(d.x, d.z);
        ctx.beginPath();
        ctx.arc(x, y, d.me ? 6.5 : 4.5, 0, Math.PI * 2);
        ctx.fillStyle = d.color;
        ctx.fill();
        ctx.lineWidth = d.me ? 2.5 : 1.5;
        ctx.strokeStyle = d.me ? '#ffd23f' : '#0b2a55';
        ctx.stroke();
      }
    },
  };
}
