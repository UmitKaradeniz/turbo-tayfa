// Modül parçalarından küçük yapılar kuran yardımcılar (Kenney Holiday Kit / Fantasy Town Kit).
// Parçalar 1×1 birimlik hücrelerdir; dış yüzleri +Z'ye bakar ve hücre kenarında (z = 0.5) durur.

const rotate = (x, z, a) => [x * Math.cos(a) + z * Math.sin(a), -x * Math.sin(a) + z * Math.cos(a)];

// pieces: [{ key, x, z, rot, y? }] hücre birimi cinsinden; yerleşim: dünya konumu (cx, cz), yön ry, ölçek s
export function placePieces(ctx, pieces, cx, cz, baseY, ry, s) {
  for (const p of pieces) {
    const [dx, dz] = rotate(p.x * s, p.z * s, ry);
    ctx.place(p.key, cx + dx, cz + dz, ry + (p.rot ?? 0), s, baseY + (p.y ?? 0) * s);
  }
}

const H = Math.PI / 2;

// Holiday Kit ahşap kulübe: W hücre genişliğinde, 1 hücre derinliğinde, ön yüzde kapı ve pencereler
export function cabinPieces(W = 1, { doorAt = Math.floor(W / 2) } = {}) {
  const P = 'holiday/';
  const out = [];
  const x0 = -(W - 1) / 2;
  for (let i = 0; i < W; i++) {
    const x = x0 + i;
    out.push({ key: P + (i === doorAt ? 'cabin-doorway' : 'cabin-window-a'), x, z: 0 });
    out.push({ key: P + (i % 2 ? 'cabin-window-b' : 'cabin-wall'), x, z: 0, rot: Math.PI });
  }
  // çatı: her hücreye bir kar kaplı beşik çatı (sırt çizgisi derinlik yönünde)
  for (let i = 0; i < W; i++) out.push({ key: P + 'cabin-roof-snow', x: x0 + i - 0.15, z: 0, y: 1, rot: 0 });
  const left = x0;
  const right = x0 + W - 1;
  out.push({ key: P + 'cabin-wall', x: right, z: 0, rot: H });
  out.push({ key: P + 'cabin-window-b', x: left, z: 0, rot: -H });
  out.push({ key: P + 'cabin-corner', x: left, z: 0, rot: 0 });
  out.push({ key: P + 'cabin-corner', x: right, z: 0, rot: H });
  out.push({ key: P + 'cabin-corner', x: right, z: 0, rot: Math.PI });
  out.push({ key: P + 'cabin-corner', x: left, z: 0, rot: -H });
  return out;
}

// Fantasy Town Kit kır evi: W hücre uzunluğunda, 1 hücre derinliğinde. Parçaların dış yüzü yerel +X'te durur.
// Ön yüz yerel +Z (kapı orta hücrede). Çatı hücre başına bir beşik çatı, uçlarda baca.
export function cottagePieces(W = 1) {
  const P = 'fantasy/';
  const out = [];
  const x0 = -(W - 1) / 2;
  for (let i = 0; i < W; i++) {
    const x = x0 + i;
    out.push({ key: P + (i === Math.floor(W / 2) ? 'wall-wood-door' : 'wall-wood-window-shutters'), x, z: 0, rot: -H });
    out.push({ key: P + 'wall-wood-window-small', x, z: 0, rot: H });
    out.push({ key: P + 'roof-gable', x, z: 0, y: 1, rot: 0 });
  }
  out.push({ key: P + 'wall-wood', x: x0 + W - 1, z: 0, rot: 0 });
  out.push({ key: P + 'wall-wood-window-shutters', x: x0, z: 0, rot: Math.PI });
  return out;
}
