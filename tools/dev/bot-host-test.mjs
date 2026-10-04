// Bot sürücüsü seçimi testi: node tools/dev/bot-host-test.mjs <port>
import WebSocket from 'ws';
const port = process.argv[2];
const mk = (q) => new Promise((res) => { const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?${q}`); ws.msgs = []; ws.on('message', (d) => ws.msgs.push(JSON.parse(d))); ws.on('open', () => res(ws)); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const last = (ws, t) => [...ws.msgs].reverse().find((m) => m.type === t);
const J = (o) => JSON.stringify(o);
async function scenario(hostPerf, bPerf) {
  const a = await mk('create=1'); a.send(J({ type: 'create', name: 'A', character: 'fox' })); await sleep(250);
  const code = last(a, 'room').code;
  const b = await mk('c=' + code); b.send(J({ type: 'join', code, name: 'B', character: 'panda' })); await sleep(250);
  a.send(J({ type: 'ping', t: 1, ...hostPerf })); b.send(J({ type: 'ping', t: 1, ...bPerf }));
  b.send(J({ type: 'ready', ready: true })); await sleep(150);
  a.send(J({ type: 'start', trackCount: 600 })); await sleep(300);
  const st = last(a, 'start'); const ids = { a: last(a, 'welcome').id, b: last(b, 'welcome').id };
  const who = st.botHostId === ids.a ? 'oda sahibi' : st.botHostId === ids.b ? 'B' : '?';
  const bot = st.entrants.find((e) => e.bot).id;
  const other = who === 'oda sahibi' ? b : a; const driver = who === 'oda sahibi' ? a : b;
  other.send(J({ type: 'state', s: { pr: 1 }, bots: [{ id: bot, s: { pr: 1, x: 'yetkisiz' } }] })); await sleep(120);
  const leaked = last(a, 'states')?.list.some((x) => x.id === bot);
  driver.send(J({ type: 'state', s: { pr: 1 }, bots: [{ id: bot, s: { pr: 1 } }] })); await sleep(120);
  const ok = last(a, 'states')?.list.some((x) => x.id === bot);
  driver.close(); await sleep(300);
  const rv = last(other, 'room');
  const after = rv.botHostId === (who === 'oda sahibi' ? ids.b : ids.a) ? 'devredildi' : 'devredilmedi';
  console.log(`oda sahibi ${JSON.stringify(hostPerf)} B ${JSON.stringify(bPerf)} → bot sürücüsü: ${who} | yetkisiz bot kabul: ${!!leaked} | sürücü bot kabul: ${!!ok} | kopunca: ${after}`);
  other.close();
}
await scenario({ fps: 58, rtt: 40 }, { fps: 60, rtt: 30 });
await scenario({ fps: 12, rtt: 300 }, { fps: 55, rtt: 60 });
await scenario({ fps: 40, rtt: 90 }, { fps: 50, rtt: 70 });
process.exit(0);
