import './base.css';
import './hud.css';
import { hasModels } from '../assets.js';
import { CHARACTERS } from '../kartModel.js';
import { createPodium3d, PODIUM_MODELS } from './podium3d.js';

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
    <div id="hud-lap" class="hud-outline"><div class="lap"><small>TUR</small><span class="cur">1</span>/<span class="max">3</span></div><div class="time">0:00.000</div><div class="delta"></div></div>
    <button id="hud-pause" data-go="pause" aria-label="Duraklat"><i></i><i></i></button>
    <button id="hud-fs" class="fs-btn" data-go="fullscreen" aria-label="Tam ekran"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path class="fs-in" d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/><path class="fs-out" d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg></button>
    <div id="hud-item"><div class="slot"><img alt="" /></div><div class="key">E</div></div>
    <div id="hud-toast"></div>
    <div id="hud-coach"></div>
    <div id="hud-center"></div>
    <div id="hud-bothost"></div>
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
      <div class="reward" hidden></div>
      <div class="actions">
        <button class="tt-btn light" data-go="menu">⌂ Ana Menü</button>
        <button class="tt-btn primary" data-go="restart">↻ Tekrar Yarış</button>
        <button class="tt-btn primary" data-go="next" hidden>Sonraki Pist ▶</button>
      </div>
    </div>`;
  document.body.appendChild(results);

  // Pist önizlemesi (sonuç panelinin üst şeridi)
  // Yarış sonucunda şerit 3B podyum olur (rows verilirse); modeller yoksa ya da Zamana Karşı'da pist resmi
  const heroEl = results.querySelector('.hero');
  const stage = createPodium3d(heroEl);
  const setHero = (url, rows = null) => {
    const top = rows && hasModels(PODIUM_MODELS) ? rows.slice(0, 3).map((r) => CHARACTERS.find((c) => c.id === r.id)) : null;
    heroEl.classList.toggle('stage', !!top);
    results.querySelector('.podium').classList.toggle('has3d', !!top);
    if (top) {
      heroEl.hidden = false;
      stage.show(top);
      return;
    }
    stage.stop();
    heroEl.hidden = !url;
    if (url) heroEl.querySelector('img').src = url;
  };

  // Sonuç tablosu yerinde güncellenirken: giriş animasyonu bitince satır "settled" olur (yeniden sıralamada tekrar oynamaz)
  const popEl = (el) => {
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
  };
  results.addEventListener('animationend', (e) => {
    const t = e.target;
    if (e.animationName === 'tt-row' || e.animationName === 'tt-rise') t.classList.add('settled');
    else if (e.animationName === 'tt-cellpop') t.classList.remove('pop');
  });

  const $ = (s) => root.querySelector(s);
  const pos = $('#hud-position');
  const posNum = pos.querySelector('.num');
  const posTotal = pos.querySelector('.total');
  const lapCur = $('#hud-lap .cur');
  const lapMax = $('#hud-lap .max');
  const timeEl = $('#hud-lap .time');
  const deltaEl = $('#hud-lap .delta');
  let lastDelta = '';
  const center = $('#hud-center');
  const toasts = $('#hud-toast');
  const coachEl = $('#hud-coach');
  let coachTimer = null;
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

  const botHostEl = root.querySelector('#hud-bothost');
  return {
    // Çevrimiçi: botları kimin cihazı sürüyor (null = gizle)
    setBotHost(text, mine = false) {
      botHostEl.textContent = text || '';
      botHostEl.classList.toggle('show', !!text);
      botHostEl.classList.toggle('mine', !!mine);
    },
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
    // Kişisel rekora fark (sn); null = gizle
    setDelta(d) {
      const txt = d == null ? '' : `${d <= 0 ? '−' : '+'}${Math.abs(d).toFixed(2)}`;
      if (txt === lastDelta) return;
      lastDelta = txt;
      deltaEl.textContent = txt;
      deltaEl.classList.toggle('on', d != null);
      deltaEl.classList.toggle('up', d != null && d <= 0);
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
    // Altın kutudan gelen çift hak: yuvada "×2" rozeti
    setItemCount(n) {
      if (n > 1) itemSlot.dataset.n = n;
      else delete itemSlot.dataset.n;
    },
    setItem(kind, count = 0) {
      clearInterval(rouletteTimer);
      itemSlot.classList.remove('rolling');
      itemSlot.classList.toggle('has', !!kind);
      this.setItemCount(count);
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
    // Öğretici ipucu: üstte, yarı saydam, birkaç saniye görünür
    coach(text, ms = 4500) {
      coachEl.textContent = text;
      coachEl.classList.add('show');
      clearTimeout(coachTimer);
      coachTimer = setTimeout(() => coachEl.classList.remove('show'), ms);
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

    // rows: [{ id, name, time|null, me, right?, sub? }]  (right: sağdaki metin, yoksa süre; sub: altındaki küçük yazı)
    // cup: kupa sonucu { title, next: 'go' | 'wait' | null, waitText }
    showResults(rows, subtitle, preview = null, cup = null) {
      setHero(preview, rows);
      results.querySelector('h2').textContent = cup?.title ?? 'Yarış Bitti!';
      results.querySelector('.subtitle').textContent = subtitle;
      const primary = results.querySelector('.actions .primary:not([data-go="next"])');
      const next = results.querySelector('[data-go="next"]');
      next.hidden = !cup?.next;
      next.disabled = cup?.next === 'wait';
      next.textContent = cup?.next === 'wait' ? (cup.waitText ?? 'Bekleniyor…') : 'Sonraki Pist ▶';
      primary.hidden = !!cup?.next;
      if (cup?.restartLabel) primary.textContent = cup.restartLabel;
      else primary.textContent = primary.dataset.go === 'lobby' ? '⇠ Lobiye Dön' : '↻ Tekrar Yarış';
      // Bitmeyenler "yükleniyor…" gösterir; bitince yalnızca o hücre süreye döner (tablo yeniden çizilmez)
      const cellOf = (r) => {
        const v = r.right ?? (r.time == null ? null : formatTime(r.time));
        return v == null ? '<span class="wait">yükleniyor…</span>' : `${v}${r.sub ? ` <em>${r.sub}</em>` : ''}`;
      };
      const pending = (r) => r.right == null && r.time == null;
      const idsKey = rows.map((r) => r.id).sort().join();
      if (results.classList.contains('show') && results.dataset.kind === 'race' && results.dataset.ids === idsKey) {
        // Tablo açık ve aynı yarışçılar: yalnızca değişen parçaları güncelle
        const set = (el, prop, v) => {
          if (el[prop] !== v) el[prop] = v;
        };
        const podiumEls = results.querySelector('.podium').children;
        [rows[1], rows[0], rows[2]].forEach((r, k) => {
          const step = podiumEls[k];
          if (!r || !step?.classList.contains('step')) return;
          step.classList.toggle('me', !!r.me);
          step.dataset.id = r.id;
          const img = step.querySelector('img');
          if (img.getAttribute('src') !== portraits[r.id]) img.src = portraits[r.id];
          set(step.querySelector('.nm'), 'textContent', `${r.name}${r.me ? ' (Sen)' : ''}`);
          const small = step.querySelector('small');
          const html = cellOf(r);
          if (small.innerHTML !== html) {
            small.innerHTML = html;
            if (!pending(r)) popEl(small);
          }
        });
        const ol = results.querySelector('ol');
        const have = new Map([...ol.children].map((li) => [li.dataset.id, li]));
        const rest = rows.slice(3);
        const keep = new Set(rest.map((r) => r.id));
        for (const [id, li] of have) if (!keep.has(id)) li.remove();
        rest.forEach((r, i) => {
          let li = have.get(r.id);
          if (!li) {
            li = document.createElement('li');
            li.dataset.id = r.id;
            li.innerHTML = `<span class="pos"></span><img src="${portraits[r.id]}" alt="" /><span class="name"></span><span class="time"></span>`;
          }
          li.classList.toggle('me', !!r.me);
          set(li.querySelector('.pos'), 'textContent', `${i + 4}.`);
          const img = li.querySelector('img');
          if (img.getAttribute('src') !== portraits[r.id]) img.src = portraits[r.id];
          set(li.querySelector('.name'), 'textContent', `${r.name}${r.me ? ' (Sen)' : ''}`);
          const t = li.querySelector('.time');
          t.classList.toggle('pending', pending(r));
          const html = cellOf(r);
          if (t.innerHTML !== html) {
            const wasWaiting = t.querySelector('.wait');
            t.innerHTML = html;
            if (wasWaiting && !pending(r)) popEl(t);
          }
          if (ol.children[i] !== li) ol.insertBefore(li, ol.children[i] ?? null);
        });
        results.querySelector('.subtitle').textContent = subtitle;
        return;
      }
      results.dataset.kind = 'race';
      results.dataset.ids = idsKey;
      // İlk üç podyumda (2 - 1 - 3 dizilimi)
      const podium = [rows[1], rows[0], rows[2]]
        .map((r, k) => {
          if (!r) return '<div></div>';
          const place = [2, 1, 3][k];
          return `
            <div class="step s${place}${r.me ? ' me' : ''}" data-id="${r.id}" style="animation-delay:${0.1 + [0.25, 0, 0.4][k]}s">
              <img src="${portraits[r.id]}" alt="" />
              <div class="nm">${r.name}${r.me ? ' (Sen)' : ''}</div>
              <div class="block"><span>${place}</span><small>${cellOf(r)}</small></div>
            </div>`;
        })
        .join('');
      results.querySelector('.podium').innerHTML = podium;
      results.querySelector('ol').innerHTML = rows
        .slice(3)
        .map(
          (r, i) => `
          <li class="${r.me ? 'me' : ''}" data-id="${r.id}" style="animation-delay:${0.5 + i * 0.06}s">
            <span class="pos">${i + 4}.</span>
            <img src="${portraits[r.id]}" alt="" />
            <span class="name">${r.name}${r.me ? ' (Sen)' : ''}</span>
            <span class="time ${pending(r) ? 'pending' : ''}">${cellOf(r)}</span>
          </li>`,
        )
        .join('');
      results.classList.add('show');
    },
    // Zamana Karşı sonucu: toplam süre, tur süreleri, rekor rozetleri
    showTimeTrialResults({ track, preview = null, laps, total, bestTotal, bestLap, newTotal, newLap }) {
      setHero(preview);
      results.querySelector('h2').textContent = 'Zamana Karşı';
      results.dataset.kind = 'tt';
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
    // Yarış ödülü: "+N TP", kalemler ve seviye çubuğu (bar eski orandan yeniye dolar)
    showReward(rw) {
      const box = results.querySelector('.reward');
      const chips = rw.parts.map((p) => `<span${p.badge ? ' class="bd"' : ''}>${p.label} <b>+${p.tp}</b></span>`).join('');
      box.innerHTML = `
        <div class="rw-top"><span class="rw-gain">+${rw.gain} TP</span><span class="rw-lv">Seviye <b>${rw.before.level}</b></span></div>
        <div class="rw-bar"><i style="width:${rw.before.frac * 100}%"></i></div>
        <div class="rw-chips">${chips}</div>`;
      box.hidden = false;
      const bar = box.querySelector('.rw-bar i');
      const lv = box.querySelector('.rw-lv');
      setTimeout(() => {
        bar.style.width = `${(rw.levelUp ? 1 : rw.after.frac) * 100}%`;
      }, 700);
      if (rw.levelUp) {
        setTimeout(() => {
          lv.innerHTML = `Seviye <b>${rw.after.level}</b> 🎉`;
          lv.classList.add('up');
          bar.style.transition = 'none';
          bar.style.width = '0%';
          void bar.offsetWidth;
          bar.style.transition = '';
          bar.style.width = `${rw.after.frac * 100}%`;
        }, 1500);
      }
    },
    hideResults() {
      const rwBox = results.querySelector('.reward');
      rwBox.hidden = true;
      rwBox.innerHTML = '';
      stage.stop();
      delete results.dataset.kind;
      delete results.dataset.ids;
      results.querySelector('h2').textContent = 'Yarış Bitti!';
      results.querySelector('[data-go="next"]').hidden = true;
      results.querySelector('.actions .primary:not([data-go="next"])').hidden = false;
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
