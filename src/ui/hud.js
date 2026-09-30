import './base.css';
import './hud.css';

// Yarış içi arayüz (DOM). Oyun mantığından sadece okur; olaylarla güncellenir.

export function formatTime(t) {
  if (t == null || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(3).padStart(6, '0')}`;
}

export function createHud({ portraits, minimap, itemIcons }) {
  const root = document.createElement('div');
  root.id = 'hud';
  root.innerHTML = `
    <div id="hud-position" class="hud-outline"><span class="num">1</span><span class="suffix">.</span><span class="total">/8</span></div>
    <div id="hud-lap" class="hud-outline"><div class="lap"><small>TUR</small><span class="cur">1</span>/<span class="max">3</span></div><div class="time">0:00.000</div></div>
    <button id="hud-pause" data-go="pause" aria-label="Duraklat">❚❚</button>
    <div id="hud-item"><div class="slot"><img alt="" /></div><div class="key">E</div></div>
    <div id="hud-toast"></div>
    <div id="hud-center"></div>
    <div id="hud-wrongway">⟲ TERS YÖN</div>
    <div id="hud-map"></div>
    <div id="hud-speed">
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <path class="bg" d="M 24.6 95.4 A 50 50 0 1 1 95.4 95.4" pathLength="100" />
        <path class="fg" d="M 24.6 95.4 A 50 50 0 1 1 95.4 95.4" pathLength="100" />
      </svg>
      <div class="v hud-outline">0</div><div class="u">km/sa</div>
    </div>
  `;
  document.body.appendChild(root);
  const mapHolder = root.querySelector('#hud-map');
  if (minimap) mapHolder.appendChild(minimap.canvas);

  const results = document.createElement('div');
  results.id = 'results';
  results.className = 'tt-screen';
  results.innerHTML = `
    <div class="panel">
      <div class="hero"><img alt="" /></div>
      <h2>Yarış Bitti!</h2>
      <p class="subtitle"></p>
      <div class="podium"></div>
      <ol></ol>
      <div class="actions">
        <button class="tt-btn light" data-go="menu">⌂ Ana Menü</button>
        <button class="tt-btn primary" data-go="restart">↻ Tekrar Yarış</button>
      </div>
    </div>`;
  document.body.appendChild(results);

  // Pist önizlemesi (sonuç panelinin üst şeridi)
  const setHero = (url) => {
    const hero = results.querySelector('.hero');
    hero.hidden = !url;
    if (url) hero.querySelector('img').src = url;
  };

  const $ = (s) => root.querySelector(s);
  const pos = $('#hud-position');
  const posNum = pos.querySelector('.num');
  const posTotal = pos.querySelector('.total');
  const lapCur = $('#hud-lap .cur');
  const lapMax = $('#hud-lap .max');
  const timeEl = $('#hud-lap .time');
  const center = $('#hud-center');
  const toasts = $('#hud-toast');
  const wrongWay = $('#hud-wrongway');
  const speedFg = $('#hud-speed .fg');
  const speedV = $('#hud-speed .v');
  let lastPos = 0;
  let lastSpeed = -1;
  const itemSlot = $('#hud-item');
  const itemImg = itemSlot.querySelector('img');
  let rouletteTimer = null;

  const banner = (text, cls = '') => {
    const el = document.createElement('div');
    el.className = `banner hud-outline ${cls}`;
    el.textContent = text;
    center.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  };

  return {
    show(visible) {
      root.classList.toggle('show', visible);
    },
    // Zamana Karşı: sıra ve item yuvası gizli
    setTimeTrial(on) {
      root.classList.toggle('tt-mode', on);
    },
    setPosition(p, total) {
      if (p !== lastPos) {
        posNum.textContent = p;
        posTotal.textContent = `/${total}`;
        pos.classList.toggle('p1', p === 1);
        pos.classList.remove('bump');
        void pos.offsetWidth; // animasyonu yeniden başlat
        pos.classList.add('bump');
        lastPos = p;
      }
    },
    setLap(cur, max) {
      lapCur.textContent = cur;
      lapMax.textContent = max;
    },
    setTime(t) {
      timeEl.textContent = formatTime(t);
    },
    setSpeed(kmh, ratio, boosting = false) {
      const v = Math.round(kmh);
      if (v === lastSpeed) return;
      lastSpeed = v;
      speedV.textContent = v;
      speedFg.style.strokeDashoffset = 100 - Math.min(1, ratio) * 100;
      speedFg.classList.toggle('boost', boosting);
    },
    // Kutudan item çıkınca ikonlar rulet gibi döner, sonra seçilene durur
    setMinimap(map) {
      mapHolder.replaceChildren(map.canvas);
    },
    itemRoulette(final, duration = 1.1, onTick = null, onLand = null) {
      clearInterval(rouletteTimer);
      const kinds = Object.keys(itemIcons);
      let k = 0;
      const started = performance.now();
      itemSlot.classList.add('rolling', 'has');
      itemImg.src = itemIcons[kinds[0]];
      rouletteTimer = setInterval(() => {
        if (performance.now() - started >= duration * 1000) {
          clearInterval(rouletteTimer);
          onLand?.();
          itemImg.src = itemIcons[final];
          itemSlot.classList.remove('rolling');
          itemSlot.classList.remove('land');
          void itemSlot.offsetWidth;
          itemSlot.classList.add('land');
          return;
        }
        itemImg.src = itemIcons[kinds[k++ % kinds.length]];
        if (k % 2) onTick?.();
      }, 70);
    },
    setItem(kind) {
      clearInterval(rouletteTimer);
      itemSlot.classList.remove('rolling');
      itemSlot.classList.toggle('has', !!kind);
      if (kind) itemImg.src = itemIcons[kind];
      else itemImg.removeAttribute('src');
    },
    boostBanner(text) {
      banner(text, 'boost small');
    },
    countdown(n) {
      banner(String(n));
    },
    go() {
      banner('BAŞLA!', 'go');
    },
    finalLap() {
      banner('SON TUR!', 'final small');
    },
    finish(place) {
      banner(place === 1 ? 'BİRİNCİ!' : 'BİTİŞ!', 'finish');
    },
    // best: bu yarışın en iyi turu · record: kişisel tur rekoru
    lapToast(lap, time, best, record = false) {
      const el = document.createElement('div');
      el.className = `toast${best || record ? ' best' : ''}${record ? ' record' : ''}`;
      el.textContent = `Tur ${lap}  ${formatTime(time)}${record ? '  🏆 REKOR' : best ? '  ★' : ''}`;
      toasts.appendChild(el);
      el.addEventListener('animationend', () => el.remove());
    },
    // Kısa bildirim ('warn': turuncu)
    toast(text, kind = '') {
      const el = document.createElement('div');
      el.className = `toast ${kind}`;
      el.textContent = text;
      toasts.appendChild(el);
      el.addEventListener('animationend', () => el.remove());
    },
    wrongWay(show) {
      wrongWay.classList.toggle('show', show);
    },

    // rows: [{ id, name, color, time|null, best|null, me }]
    showResults(rows, subtitle, preview = null) {
      setHero(preview);
      results.querySelector('.subtitle').textContent = subtitle;
      // İlk üç podyumda (2 - 1 - 3 dizilimi)
      const podium = [rows[1], rows[0], rows[2]]
        .map((r, k) => {
          if (!r) return '<div></div>';
          const place = [2, 1, 3][k];
          return `
            <div class="step s${place}${r.me ? ' me' : ''}" style="animation-delay:${0.1 + [0.25, 0, 0.4][k]}s">
              <img src="${portraits[r.id]}" alt="" />
              <div class="nm">${r.name}${r.me ? ' (Sen)' : ''}</div>
              <div class="block"><span>${place}</span><small>${r.time == null ? '—' : formatTime(r.time)}</small></div>
            </div>`;
        })
        .join('');
      results.querySelector('.podium').innerHTML = podium;
      results.querySelector('ol').innerHTML = rows
        .slice(3)
        .map(
          (r, i) => `
          <li class="${r.me ? 'me' : ''}" style="animation-delay:${0.5 + i * 0.06}s">
            <span class="pos">${i + 4}.</span>
            <img src="${portraits[r.id]}" alt="" />
            <span class="name">${r.name}${r.me ? ' (Sen)' : ''}</span>
            <span class="time ${r.time == null ? 'pending' : ''}">${r.time == null ? 'yarışıyor…' : formatTime(r.time)}</span>
          </li>`,
        )
        .join('');
      results.classList.add('show');
    },
    // Zamana Karşı sonucu: toplam süre, tur süreleri, rekor rozetleri
    showTimeTrialResults({ track, preview = null, laps, total, bestTotal, bestLap, newTotal, newLap }) {
      setHero(preview);
      results.querySelector('h2').textContent = 'Zamana Karşı';
      results.querySelector('.subtitle').textContent = `${track} · ${laps.length} tur`;
      results.querySelector('.podium').innerHTML = `
        <div class="tt-total${newTotal ? ' record' : ''}">
          <div class="big">${formatTime(total)}</div>
          <div class="badge">${newTotal ? '🏆 YENİ REKOR!' : `Rekor: ${formatTime(bestTotal)}`}</div>
        </div>`;
      const fastest = Math.min(...laps);
      results.querySelector('ol').innerHTML = laps
        .map(
          (t, i) => `
          <li class="${t === fastest ? 'me' : ''}" style="animation-delay:${0.3 + i * 0.08}s">
            <span class="pos">${i + 1}.</span><span></span>
            <span class="name">Tur ${i + 1}${t === fastest && newLap ? ' · 🏆 tur rekoru' : ''}</span>
            <span class="time">${formatTime(t)}</span>
          </li>`,
        )
        .join('') + `<li style="animation-delay:${0.3 + laps.length * 0.08}s"><span class="pos">★</span><span></span><span class="name">En iyi tur rekorun</span><span class="time">${formatTime(bestLap)}</span></li>`;
      results.classList.add('show');
    },
    hideResults() {
      results.querySelector('h2').textContent = 'Yarış Bitti!';
      results.classList.remove('show');
    },
    // Çevrimiçi yarışta "Tekrar Yarış" yerine lobiye dönülür
    setOnline(on) {
      const btn = results.querySelector('.actions .primary');
      btn.dataset.go = on ? 'lobby' : 'restart';
      btn.textContent = on ? '⇠ Lobiye Dön' : '↻ Tekrar Yarış';
      results.querySelector('[data-go="menu"]').textContent = on ? '⌂ Odadan Çık' : '⌂ Ana Menü';
    },
    get resultsOpen() {
      return results.classList.contains('show');
    },
    reset() {
      center.innerHTML = '';
      toasts.innerHTML = '';
      wrongWay.classList.remove('show');
      this.setItem(null);
      lastPos = 0;
      lastSpeed = -1;
      this.hideResults();
    },
  };
}
