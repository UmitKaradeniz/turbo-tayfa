// Pist kurulum süresi ölçümü (eşzamanlı buildTrackNow, aşama aşama). Dev sunucusu :3000'de çalışmalı.
// Kullanım: node tools/dev/cdp-trackbuild.mjs [cpuYavaşlatma=1] [kalite=low] [pist,pist,...]
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';

const cpu = Number(process.argv[2] || 1);
const q = process.argv[3] || 'low';
const only = process.argv[4]?.split(',');
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
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.on('open', r));
let id = 0; const pending = new Map();
ws.on('message', (d) => { const m = JSON.parse(d); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expression) => { const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); return r.result?.exceptionDetails ? { error: r.result.exceptionDetails.exception?.description } : r.result?.result?.value; };

await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 412, height: 820, deviceScaleFactor: 1, mobile: true });
if (cpu > 1) await send('Emulation.setCPUThrottlingRate', { rate: cpu });
await send('Page.navigate', { url: `http://localhost:3000/?q=${q}&nopause` });
for (let i = 0; i < 60 && !(await ev('!!window.__tt')); i++) await sleep(1000);
await sleep(2000);
const prof = process.argv[5] === 'prof';
const verify = process.argv[5] === 'verify';
if (prof) { await send('Profiler.enable'); await send('Profiler.setSamplingInterval', { interval: 500 }); await send('Profiler.start'); }
const rows = await ev(`(async()=>{
  const sl=(ms)=>new Promise(r=>setTimeout(r,ms)); const T=window.__tt; if(!T) return {error:'no __tt'};
  const click=(f)=>{const b=[...document.querySelectorAll('button')].find(f); b&&b.click(); return !!b;};
  window.dispatchEvent(new Event('pointerdown')); await sl(800);
  click(b=>b.dataset.go==='quick'&&b.offsetParent); await sl(400);
  click(b=>b.dataset.go==='wiz-next'&&b.offsetParent); await sl(150);
  click(b=>b.dataset.go==='wiz-next'&&b.offsetParent); await sl(300);
  const ids=[...document.querySelectorAll('.tt-track')].map(b=>b.dataset.track).filter(t=>!${JSON.stringify(only ?? null)}||${JSON.stringify(only ?? [])}.includes(t));
  const out=[];
  for(const tid of ids){
    const b=document.querySelector('.tt-track[data-track="'+tid+'"]'); b.click();
    const t0=performance.now(); while(performance.now()-t0<30000){ await sl(100); if(window.__tt.lastBuild?.id===tid) break; }
    const lb=window.__tt.lastBuild; if(lb&&lb.id===tid) out.push({id:tid,total:lb.total,...lb.phases});
    if(${verify}&&lb&&lb.id===tid){ // ızgara closest/insideLoop ≡ brute force mu?
      const tr=window.__tt.track, P=tr.centerline, n=P.length; let bad=0, badIn=0; const N=4000;
      let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9; for(const p of P){x0=Math.min(x0,p.x);x1=Math.max(x1,p.x);z0=Math.min(z0,p.z);z1=Math.max(z1,p.z);}
      for(let k=0;k<N;k++){ const x=x0-150+Math.random()*(x1-x0+300), z=z0-150+Math.random()*(z1-z0+300);
        let best=Infinity,bi=0; for(let i=0;i<n;i++){ const a=P[i],b=P[(i+1)%n]; const dx=b.x-a.x,dz=b.z-a.z,rx=x-a.x,rz=z-a.z; let t=(rx*dx+rz*dz)/(dx*dx+dz*dz); t=t<0?0:t>1?1:t; const ex=rx-dx*t,ez=rz-dz*t,d=ex*ex+ez*ez; if(d<best){best=d;bi=i;} }
        const c=tr.closest(x,z); if(c.index!==bi && Math.abs(c.dist-Math.sqrt(best))>1e-6) bad++;
        let ins=false; for(let i=0,j=n-1;i<n;j=i++){ const a=P[i],b=P[j]; if(a.z>z!==b.z>z && x<((b.x-a.x)*(z-a.z))/(b.z-a.z)+a.x) ins=!ins; }
        if(ins!==tr.insideLoop(x,z)) badIn++; }
      out[out.length-1].bad=bad+'/'+badIn;
    }
    await sl(300);
  }
  return out;
})()`);
if (!Array.isArray(rows)) console.log(JSON.stringify(rows));
else {
  const cols = ['id', 'total', 'temizlik', 'pist', 'dekor', 'ortam', 'oyun nesneleri', 'harita', 'shader+doku', 'bad'];
  console.log(`cpu x${cpu} · kalite ${q}\n` + cols.join('\t'));
  for (const r of rows) console.log(cols.map((c) => r[c] ?? '').join('\t'));
}
if (prof) {
  const p = (await send('Profiler.stop')).result.profile;
  const nodes = new Map(p.nodes.map((n) => [n.id, n])); const tot = {};
  for (let i = 0; i < p.samples.length; i++) { const c = nodes.get(p.samples[i]).callFrame; const k = `${c.functionName || '(anon)'} ${(c.url || '').split('/').slice(-2).join('/')}:${c.lineNumber}`; tot[k] = (tot[k] || 0) + p.timeDeltas[i] / 1000; }
  console.log('--- en çok CPU (öz süre, ms)');
  for (const [k, v] of Object.entries(tot).sort((a, b) => b[1] - a[1]).slice(0, 16)) console.log(Math.round(v), k);
}
ws.close(); chrome.kill(); process.exit(0);
