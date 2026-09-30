// Oynanış ayarları tek yerde. Birimler: metre, saniye, radyan.

export const PHYSICS_HZ = 60;

export const KART = {
  radius: 1.2, // duvar çarpışması için kartın yarıçapı
  maxSpeed: 30, // ~108 km/s
  maxReverse: 9,
  accel: 20,
  brake: 38,
  reverseAccel: 14,
  coastDrag: 5, // gaz bırakınca yavaşlama

  steerRate: 2.3, // tam direksiyonda dönüş hızı (rad/s)
  steerResponse: 9, // direksiyonun hedefe yaklaşma hızı
  steerFullSpeed: 9, // bu hızın altında dönüş orantılı olarak azalır
  highSpeedSteer: 0.56, // en yüksek hızda dönüş çarpanı (drift virajda avantaj sağlasın)
  minSteer: 0.35, // pedala basılıyken durağan dönüş oranı
  airControl: 0.3,

  grip: 9, // yan kaymayı ne kadar hızlı sönümler
  driftGrip: 3.2,
  slideKeep: 0.9, // sönen yan hızın ileri hıza aktarılan oranı
  driftMinSpeed: 9,
  driftTurnMin: 0.45, // drift yönündeki en düşük dönüş oranı
  driftTurnMax: 1.15, // drift yönündeki en yüksek dönüş oranı

  gravity: 32,
  snapDistance: 0.35, // yokuş aşağı inerken zemine yapışma mesafesi

  wallBounce: 0.25,
  wallSpeedLoss: 0.35,

  offroadSpeed: 0.55, // kumda en yüksek hız çarpanı
  dirtSpeed: 0.85, // sıkışmış toprak kısayollarda çarpan
  offroadDrag: 28, // hız sınırının üstündeyken yavaşlama (m/s²)

  boostSpeed: 1.3, // turbo sırasında en yüksek hız çarpanı
  boostAccel: 45,
  // Drift süresi (s) → mini-turbo süresi (s); kıvılcım mavi / turuncu / mor
  miniTurbo: [
    { after: 0.55, boost: 0.6 },
    { after: 1.3, boost: 1.1 },
    { after: 2.3, boost: 1.6 },
  ],
  startBoost: 1.2, // geri sayımda doğru anda gaz
  spinDuration: 1.3,
};

export const CAMERA = {
  distance: 7.2,
  height: 3.4,
  lookAhead: 6,
  lookHeight: 1.5,
  followSharpness: 12,
  headingSharpness: 5,
  baseFov: 70,
  maxFov: 82,
};
