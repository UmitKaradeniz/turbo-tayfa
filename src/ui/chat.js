import './chat.css';
import { EMOTES } from '../emotes.js';

// Sohbet: lobide panel, yarışta sol tarafta kısa süreli mesaj akışı + Enter ile yazma.
// Emoji çubuğu: yarışta hızlı tepkiler (klavyede 1-6).

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function createChat({ colorOf, onSend, onEmote }) {
  // --- Lobi paneli ---
  const panel = document.createElement('div');
  panel.className = 'tt-card chat-card';
  panel.hidden = true;
  panel.innerHTML = `
    <h3>Sohbet</h3>
    <div class="log" aria-live="polite"></div>
    <form class="row"><input class="tt-input" maxlength="120" placeholder="Bir şey yaz…" autocomplete="off" /><button class="tt-btn" type="submit" aria-label="Gönder">➤</button></form>`;
  const log = panel.querySelector('.log');
  const lobbyInput = panel.querySelector('input');
  panel.querySelector('form').addEventListener('submit', (e) => {
    e.preventDefault();
    send(lobbyInput);
  });

  // --- Yarış içi ---
  const feed = document.createElement('div');
  feed.id = 'hud-chat';
  const raceForm = document.createElement('form');
  raceForm.id = 'race-chat';
  raceForm.innerHTML = '<input class="tt-input" maxlength="120" placeholder="Mesaj yaz, Enter ile gönder" autocomplete="off" />';
  const raceInput = raceForm.querySelector('input');
  raceForm.addEventListener('submit', (e) => {
    e.preventDefault();
    send(raceInput);
    closeRaceInput();
  });
  raceInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeRaceInput();
    e.stopPropagation();
  });

  const bar = document.createElement('div');
  bar.id = 'emote-bar';
  bar.innerHTML = EMOTES.map((e, i) => `<button data-emote="${i}" aria-label="Tepki ${e}">${e}<small>${i + 1}</small></button>`).join('');
  bar.addEventListener('click', (e) => {
    const b = e.target.closest('[data-emote]');
    if (b) onEmote(Number(b.dataset.emote));
  });

  document.body.append(feed, raceForm, bar);

  let online = false;
  let racing = false;

  function send(input) {
    const text = input.value.trim();
    input.value = '';
    if (text) onSend(text);
  }
  function openRaceInput() {
    raceForm.classList.add('show');
    raceInput.focus();
  }
  function closeRaceInput() {
    raceForm.classList.remove('show');
    raceInput.blur();
  }

  // Yarışta Enter: yazma kutusunu aç; 1-6: tepki
  window.addEventListener('keydown', (e) => {
    if (!racing || e.target instanceof HTMLInputElement) return;
    if (e.key === 'Enter' && online) {
      e.preventDefault();
      openRaceInput();
    } else if (/^Digit[1-6]$/.test(e.code)) onEmote(Number(e.code.slice(5)) - 1);
  });

  const line = (m) => {
    if (m.sys) return `<div class="msg sys">${esc(m.text)}</div>`;
    return `<div class="msg"><b style="color:${colorOf(m.character)}">${esc(m.name)}</b> ${esc(m.text)}</div>`;
  };

  return {
    panel, // lobi ekranına yerleştirilir
    add(m) {
      log.insertAdjacentHTML('beforeend', line(m));
      while (log.children.length > 60) log.firstElementChild.remove();
      log.scrollTop = log.scrollHeight;
      if (racing) {
        const el = document.createElement('div');
        el.innerHTML = line(m);
        const node = el.firstElementChild;
        feed.appendChild(node);
        setTimeout(() => node.classList.add('fade'), 6000);
        setTimeout(() => node.remove(), 6600);
        while (feed.children.length > 5) feed.firstElementChild.remove();
      }
    },
    setHistory(list) {
      log.innerHTML = list.map(line).join('');
      log.scrollTop = log.scrollHeight;
    },
    clear() {
      log.innerHTML = '';
      feed.innerHTML = '';
    },
    setOnline(v) {
      online = v;
      panel.hidden = !v;
    },
    // Yarış başladı / bitti: emoji çubuğu ve mesaj akışı sadece yarışta
    setRacing(v) {
      racing = v;
      bar.classList.toggle('show', v);
      feed.classList.toggle('show', v);
      if (!v) {
        closeRaceInput();
        feed.innerHTML = '';
      }
    },
    get typing() {
      return document.activeElement === raceInput;
    },
  };
}
