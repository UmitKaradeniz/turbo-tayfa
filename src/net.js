// Sunucu bağlantısı: WebSocket, otomatik yeniden bağlanma, sunucu saati senkronu.
// Oyun mantığı bilmez; mesajları `on(type, fn)` ile dağıtır.

const SESSION_KEY = 'tt-session'; // { code, token } — sayfa yenilenince odaya geri dön

export class Net {
  constructor() {
    this.ws = null;
    this.handlers = {};
    this.offset = 0; // sunucu saati - yerel saat (ms)
    this.rtt = 0;
    this.connected = false;
    this.wanted = false; // bağlı kalmak istiyor muyuz (odadayken true)
    this.retry = 0;
    this.id = null;
    this.code = null;
    this.token = null;
    this.queue = [];
  }

  on(type, fn) {
    (this.handlers[type] ??= []).push(fn);
  }

  emit(type, msg) {
    for (const fn of this.handlers[type] ?? []) fn(msg);
  }

  serverNow() {
    return performance.timeOrigin + performance.now() + this.offset;
  }

  get session() {
    try {
      return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
    } catch {
      return null;
    }
  }

  saveSession() {
    try {
      if (this.code && this.token) sessionStorage.setItem(SESSION_KEY, JSON.stringify({ code: this.code, token: this.token }));
      else sessionStorage.removeItem(SESSION_KEY);
    } catch {}
  }

  connect() {
    this.wanted = true;
    if (this.ws && this.ws.readyState <= 1) return;
    const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
    const ws = new WebSocket(url);
    this.ws = ws;
    ws.onopen = () => {
      this.connected = true;
      this.retry = 0;
      this.sync();
      // Kopmadan önce odadaysak aynı oyuncu olarak geri dön
      if (this.code && this.token) this.sendNow({ type: 'resume', code: this.code, token: this.token });
      for (const m of this.queue.splice(0)) this.sendNow(m);
      this.emit('open');
    };
    ws.onmessage = (e) => {
      let msg;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
      if (msg.type === 'pong') return this.onPong(msg);
      if (msg.type === 'welcome') {
        this.id = msg.id;
        this.code = msg.code;
        this.token = msg.token;
        this.saveSession();
      }
      if (msg.type === 'error' && msg.code === 'no-resume') {
        this.code = this.token = null;
        this.saveSession();
      }
      this.emit(msg.type, msg);
    };
    ws.onclose = () => {
      const was = this.connected;
      this.connected = false;
      if (was) this.emit('disconnect');
      if (this.wanted) {
        // Artan bekleme ile yeniden dene (0.5s, 1s, 2s … en çok 5s)
        const delay = Math.min(5000, 500 * 2 ** this.retry++);
        setTimeout(() => this.wanted && this.connect(), delay);
      }
    };
  }

  // Oda ile ilgili mesajlar bağlantı yoksa kuyruğa alınır
  send(msg) {
    if (this.connected) this.sendNow(msg);
    else {
      this.queue.push(msg);
      this.connect();
    }
  }

  sendNow(msg) {
    if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(msg));
  }

  // Sık gönderilen, kaybolması sorun olmayan mesajlar (kart durumu)
  sendVolatile(msg) {
    if (this.connected) this.sendNow(msg);
  }

  leave() {
    this.sendNow({ type: 'leave' });
    this.wanted = false;
    this.code = this.token = this.id = null;
    this.saveSession();
    this.queue.length = 0;
    this.ws?.close();
  }

  // Saat senkronu: birkaç ping atıp en düşük gecikmeli olanı kullan
  sync() {
    this.samples = [];
    for (let i = 0; i < 5; i++) setTimeout(() => this.sendNow({ type: 'ping', t: performance.now() }), i * 150);
    clearInterval(this.syncTimer);
    this.syncTimer = setInterval(() => this.sendNow({ type: 'ping', t: performance.now() }), 5000);
  }

  onPong({ t, server }) {
    const nowPerf = performance.now();
    const rtt = nowPerf - t;
    const offset = server - (performance.timeOrigin + t + rtt / 2);
    this.samples.push({ rtt, offset });
    if (this.samples.length > 8) this.samples.shift();
    const best = this.samples.reduce((a, b) => (b.rtt < a.rtt ? b : a));
    this.offset = best.offset;
    this.rtt = best.rtt;
  }
}
