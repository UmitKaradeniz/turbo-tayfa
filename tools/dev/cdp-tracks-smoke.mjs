// Geri sayım takılma ölçümü: gerçek (headless) Chrome, CDP üzerinden. Kullanım: node cdp-countdown.mjs <track> <cpuRate>
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';

const track='palmCove'; const cpu=1;
const port = 9333 + Math.floor(Math.random() * 300);
const dir = mkdtempSync(join(tmpdir(), 'tt-cdp-'));
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, '--window-size=412,820',
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required',
  '--no-first-run', '--no-default-browser-check', 'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let targets;
for (let i = 0; i < 60; i++) {
  try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.find((t) => t.type === 'page')) break; } catch {}
  await sleep(250);
}
const page = targets.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.on('open', r));
let id = 0; const pending = new Map();
ws.on('message', (d) => { const m = JSON.parse(d); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expression) => { const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (r.result?.exceptionDetails) return { error: r.result.exceptionDetails.exception?.description?.slice(0, 300) }; return r.result?.result?.value; };

await send('Page.enable'); await send('Runtime.enable'); await send('Profiler.enable'); await send('Profiler.setSamplingInterval',{interval:400});
await send('Emulation.setDeviceMetricsOverride', { width: 412, height: 820, deviceScaleFactor: 1, mobile: true });
if (cpu > 1) await send('Emulation.setCPUThrottlingRate', { rate: cpu });
await send('Page.navigate', { url: 'http://localhost:3000/?q=low&nopause' });
await sleep(9000);
await send('Profiler.start'); const profT0=Date.now();


const errs=[]; ws.on('message',(d)=>{ const m=JSON.parse(d); if(m.method==='Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.exception?.description?.slice(0,160)); if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error') errs.push(m.params.args.map(a=>a.value||a.description).join(' ').slice(0,160)); });
const out = await ev(`(async()=>{
  const sl=(ms)=>new Promise(r=>setTimeout(r,ms)); const T=window.__tt; const click=(f)=>{const b=[...document.querySelectorAll('button')].find(f); b&&b.click(); return !!b;};
  click(b=>b.dataset.go==='quick'&&b.offsetParent); await sl(400);
  click(b=>b.dataset.go==='wiz-next'&&b.offsetParent); await sl(150); click(b=>b.dataset.go==='wiz-next'&&b.offsetParent); await sl(300);
  const ids=[...document.querySelectorAll('.tt-track')].map(b=>b.dataset.track); const res={};
  for(const id of ids){ document.querySelector('.tt-track[data-track="'+id+'"]').click(); const t0=performance.now(); while((!T.track||T.track.def?.id!==id)&&performance.now()-t0<12000) await sl(100); await sl(150);
    const act=T.karts.filter(k=>k.active); const names=[...new Set(act.map(k=>k.model.body.children[0]?.name))]; res[id]=names.join('|')+' w'+[...new Set(act.map(k=>k.model.wheels.length+'/'+k.model.steerWheels.length))].join(',')+' r'+act[0].model.wheelRadius.toFixed(2); }
  return res;
})()`);
console.log(JSON.stringify(out,null,0)); console.log('errors', JSON.stringify(errs.slice(0,4)));
ws.close(); chrome.kill(); process.exit(0);
