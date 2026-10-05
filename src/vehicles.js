// Araç sınıfları: karakterden bağımsız seçilir. `stats` çarpanlardır (1 = temel kart).
// Dengeli tutuldu: bir yönde kazanılan başka yönde kaybedilir; hepsi aynı pistte birkaç saniye içinde bitirir.
// speed = en yüksek hız, accel = ivmelenme, handling = dönüş keskinliği ve tutuş, weight = çarpışmada itilmeye direnç.
export const VEHICLES = [
  { id: 'balanced', name: 'Dengeli', desc: 'Her yerde idare eder', body: 'karts/kart-oozi', stats: { speed: 1.005, accel: 1, handling: 1, weight: 1 } },
  { id: 'agile', name: 'Çevik', desc: 'Hafif ve keskin dönüşlü, çarpışmada sekmeye açık', body: 'karts/kart-oopi', stats: { speed: 1.005, accel: 1.1, handling: 1.12, weight: 0.8 } },
  { id: 'rocket', name: 'Roket', desc: 'Hızlı gider, kalkışta ve virajda zorlanır', body: 'karts/kart-oobi', stats: { speed: 1.005, accel: 0.9, handling: 0.9, weight: 1 } },
  { id: 'heavy', name: 'Ağır', desc: 'Rakipleri iter, yavaş kalkar', body: 'karts/kart-oodi', stats: { speed: 1.003, accel: 0.88, handling: 0.9, weight: 1.4 } },
  { id: 'sprint', name: 'Atak', desc: 'Çok çabuk hızlanır, tepe hızı düşük', body: 'karts/kart-ooli', stats: { speed: 1, accel: 1.2, handling: 1, weight: 0.9 } },
];

export const VEHICLE_IDS = VEHICLES.map((v) => v.id);
export const VEHICLE_BY_ID = Object.fromEntries(VEHICLES.map((v) => [v.id, v]));

// Karakterin eski (görünüşe bağlı) aracı: seçim yapılmadıysa bu kullanılır, böylece mevcut oyuncular aynı kartı görür.
export const defaultVehicleFor = (character) => VEHICLES.find((v) => v.body === character.kart) ?? VEHICLES[0];

export const vehicleOf = (id, character) => VEHICLE_BY_ID[id] ?? defaultVehicleFor(character);

// Seçim ekranı çubukları 0..1: temel kart (1.0) yarım dolu, çarpan arttıkça uzar
export const statBar = (value) => Math.max(0.1, Math.min(1, 0.5 + (value - 1) * 1.25));
