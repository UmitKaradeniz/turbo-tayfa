// Araç sınıfı dengesi ölçümü. Kullanım: dev sunucuda (?q=low) ana menüdeyken tarayıcıda çalıştır (javascript_tool),
// ~3 dk sonra window.__vehSummary() sınıf başına ortalama sırayı verir (oyuncu hariç botlar; ideal ≈ 4.5 hepsi).
// Her yarışta araç sınıfı kaydırılarak (shift) tüm karta atanır; otopilot + simulate ile hızlı koşar.
window.__veh = [];
window.runVeh = async (shift) => {
  const V = await import('/src/vehicles.js');
  document.querySelector('[data-go="random"]').click();
  for (let i = 0; i < 60 && !(window.__tt.race && window.__tt.race.clock < 0); i++) await new Promise((r) => setTimeout(r, 300));
  const tt = window.__tt;
  const race = tt.race;
  tt.autopilot(true);
  const ids = V.VEHICLES.map((v) => v.id);
  const cls = race.entries.map((e, i) => ids[(i + shift) % 5]);
  race.entries.forEach((e, i) => e.kart.setVehicle(V.VEHICLE_BY_ID[cls[i]]));
  const order = race.entries.map((e) => e.kart);
  let g = 0;
  while (race.state !== 'finished' && g++ < 200) tt.simulate(5);
  const st = race.standings().map((e) => order.indexOf(e.kart));
  window.__veh.push({ cls, place: order.map((_, i) => st.indexOf(i) + 1), laps: race.laps });
  [...document.querySelectorAll('button')].find((b) => /Ana Menü/.test(b.textContent))?.click();
  await new Promise((r) => setTimeout(r, 1500));
};
window.__vehSummary = (arr = window.__veh) => {
  const a = {};
  for (const r of arr) r.cls.forEach((c, i) => {
    if (i === 4) return; // oyuncu yuvası (farklı beceri)
    (a[c] ??= { s: 0, n: 0, w: 0 });
    a[c].s += r.place[i];
    a[c].n++;
    if (r.place[i] === 1) a[c].w++;
  });
  return Object.fromEntries(Object.entries(a).map(([k, v]) => [k, `${(v.s / v.n).toFixed(2)} (${v.w} galibiyet/${v.n})`]));
};
window.__vehLoop = (async () => { for (let k = 0; k < 40; k++) await window.runVeh(k % 5); })();
