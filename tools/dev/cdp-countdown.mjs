// Geri sayım takılma ölçümü: gerçek (headless) Chrome, CDP üzerinden. Kullanım: node cdp-countdown.mjs <track> <cpuRate>
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';

const track = process.argv[2] || 'palmCove';
const cpu = Number(process.argv[3] || 1);
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
const out = await ev(`(async()=>{ window.__go=()=>1;
  const sl=(ms)=>new Promise(r=>setTimeout(r,ms)); const T=window.__tt; if(!T) return {error:'no __tt'};
  const click=(f)=>{const b=[...document.querySelectorAll('button')].find(f); b&&b.click(); return !!b;};
  // gesture gibi: ses bağlamını aç
  window.dispatchEvent(new Event('pointerdown')); await sl(1500);
  const log={frames:[],long:[],gaps:[]}; const info=T.renderer.info;
  try{ new PerformanceObserver(l=>{for(const e of l.getEntries()) log.long.push({t:Math.round(e.startTime),d:Math.round(e.duration)});}).observe({entryTypes:['longtask']}); }catch(e){}
  click(b=>b.dataset.go==='quick'&&b.offsetParent); await sl(400);
  click(b=>b.parentElement?.dataset.seg==='laps'&&b.dataset.v==='1');
  click(b=>b.dataset.go==='wiz-next'&&b.offsetParent); await sl(150);
  click(b=>b.dataset.go==='wiz-next'&&b.offsetParent); await sl(300);
  const tb=document.querySelector('.tt-track[data-track="${track}"]'); tb&&tb.click(); await sl(2500);
  click(b=>b.dataset.go==='wiz-next'&&b.offsetParent); await sl(300);
  let last=performance.now(), gl=performance.now(); window.__rec=true;
  (function tick(){ const now=performance.now(); log.frames.push({t:now,dt:now-last,prog:info.programs?.length??0,tex:info.memory.textures,geo:info.memory.geometries}); last=now; if(window.__rec) requestAnimationFrame(tick); })();
  const gi=setInterval(()=>{ const n=performance.now(); log.gaps.push(n-gl); gl=n; },5);
  const ev2=[]; const P=()=>Math.round(performance.now());
  const rs=T.renderer.setSize.bind(T.renderer); T.renderer.setSize=function(...a){ const t0=performance.now(); const r=rs(...a); ev2.push({e:'setSize',t:P(),ms:Math.round(performance.now()-t0)}); return r; };
  const dec=AudioContext.prototype.decodeAudioData; AudioContext.prototype.decodeAudioData=function(buf,...a){ const t=P(), sz=buf.byteLength; const r=dec.call(this,buf,...a); r.then(b=>ev2.push({e:'decoded',t:P(),start:t,ms:P()-t,mb:+(sz/1048576).toFixed(2),pcmMB:+(b.length*b.numberOfChannels*4/1048576).toFixed(1)})); return r; };
  const ts=AudioBufferSourceNode.prototype.start; AudioBufferSourceNode.prototype.start=function(...a){ const t0=performance.now(); const r=ts.apply(this,a); const d=performance.now()-t0; if(d>8) ev2.push({e:'srcStart',t:P(),ms:Math.round(d)}); return r; };
  for(const C of [WebGLRenderingContext,WebGL2RenderingContext]){ const ti=C.prototype.texImage2D; C.prototype.texImage2D=function(...a){ const t0=performance.now(); const r=ti.apply(this,a); const d=performance.now()-t0; if(d>15) ev2.push({e:'texImage2D',t:P(),ms:Math.round(d),w:a[3]&&a[3].width||a[3],h:a[4]&&a[4].height}); return r; }; const cp=C.prototype.linkProgram; C.prototype.linkProgram=function(...a){ const t0=performance.now(); const r=cp.apply(this,a); ev2.push({e:'linkProgram',t:P(),ms:Math.round(performance.now()-t0)}); return r; }; }
  const hc=document.querySelector('#hud-center'); const mo=new MutationObserver(()=>ev2.push({e:'hudCenter',t:P(),txt:(hc.textContent||'').trim().slice(0,12)})); mo.observe(hc,{childList:true,subtree:true,characterData:true});
  const from=performance.now(); click(b=>b.dataset.go==='start'&&b.offsetParent);
  const t0=performance.now(); while(!(T.race&&T.race.started)&&performance.now()-t0<20000) await sl(40);
  const goMs=Math.round(performance.now()-from); ev2.push({e:'GO',t:P()}); await sl(400); window.__rec=false; clearInterval(gi);
  const seg=log.frames.filter(x=>x.t>=from); const gaps=log.gaps.filter(Boolean);
  return {ev:ev2.map(x=>({...x,t:x.t-Math.round(from)})), track:'${track}', goMs, frames:seg.length, maxDt:Math.round(Math.max(0,...seg.map(x=>x.dt))), slow:seg.filter(x=>x.dt>250).map(x=>({at:Math.round(x.t-from),dt:Math.round(x.dt),prog:x.prog,tex:x.tex})), progDelta:seg.length?seg[seg.length-1].prog-seg[0].prog:null, texDelta:seg.length?seg[seg.length-1].tex-seg[0].tex:null, maxGap:Math.round(Math.max(0,...gaps)), gapsOver100:gaps.filter(g=>g>100).length, long:log.long.filter(x=>x.t>=from).map(x=>({at:Math.round(x.t-from),d:x.d}))};
})()`);
const prof=(await send('Profiler.stop')).result.profile;
const nodes=new Map(prof.nodes.map(n=>[n.id,n])); const total={}; const t=prof.startTime; let acc=prof.startTime; const byWin={};
const fromAbs=null;
const sampleTimes=[]; for(let i=0;i<prof.samples.length;i++){ acc+=prof.timeDeltas[i]; sampleTimes.push(acc); }
out._profStart=prof.startTime; out._profEnd=prof.endTime;
const fn=(id)=>{const n=nodes.get(id); const c=n.callFrame; return (c.functionName||'(anon)')+' '+(c.url||'').split('/').slice(-2).join('/')+':'+c.lineNumber;};
for(let i=0;i<prof.samples.length;i++){ const k=fn(prof.samples[i]); const dt=prof.timeDeltas[i]/1000; total[k]=(total[k]||0)+dt; }
out.top=Object.entries(total).sort((a,b)=>b[1]-a[1]).slice(0,14).map(([k,v])=>k+' '+Math.round(v)+'ms');
out._samples=prof.samples.length;
console.log(JSON.stringify({ cpu, ...out }));
ws.close(); chrome.kill();
process.exit(0);
