// Production Angular assets with isolated API fixtures. No live accounts/writes.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {readFile,mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
const root=new URL('../../frontend/dist/frontend/browser/',import.meta.url).pathname;
const out=new URL('../../output/c13-access/',import.meta.url).pathname;await mkdir(out,{recursive:true});
const match='01234567-1234-1234-1234-0123456789ab';let eligible=true;
const dashboard=()=>({c13:eligible?[{match_id:match,appointment_id:1,label:'03 · ALFA lwn BRAVO',submitted:false}]:[],
 view:'pengadil',year:2026,name:'PENGADIL UJIAN',totals:{},monthly:[],upcoming:[],responses:[],recent:[],registrations:[],announcements:[],ranking:[],applications:{},positions:[],minimum_matches:20,can_referee:true,can_ra:false});
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');let body,type='application/json';
 if(url.pathname==='/api/session.php')body=JSON.stringify({authenticated:true,user_id:1,user_email:'test@example.invalid',user_role:'Pengadil',nama_penuh:'PENGADIL UJIAN',can_referee:1,can_ra:0,password_changed:1});
 else if(url.pathname==='/api/portal-dashboard.php')body=JSON.stringify({error:false,data:dashboard()});
 else if(url.pathname==='/api/tugasan.php')body=JSON.stringify({error:false,data:[
  {id:1,jawatan:'Pengadil',status:'Diterima',no_perlawanan:'03',nama_kejohanan:'JFA',jenis_kejohanan:'Liga',tarikh:'2026-11-01',masa:'17:00',pasukan_home:'ALFA',pasukan_away:'BRAVO',c13_match_id:eligible?match:null},
  {id:2,jawatan:'Pegawai ke4',status:'Diterima',no_perlawanan:'04',nama_kejohanan:'JFA',tarikh:'2026-11-01',masa:'21:00',pasukan_home:'CHARLIE',pasukan_away:'DELTA',c13_match_id:null}],stats:{total:2,diterima:2}});
 else if(url.pathname.startsWith('/api/'))body=JSON.stringify({error:false,data:[],notifications:[],unread_count:0});
 else {let file=path.resolve(root,'.'+url.pathname);if(!file.startsWith(root))throw Error('Path');try{body=await readFile(file);}catch{file=path.join(root,'index.html');body=await readFile(file);}type=({'.js':'application/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.woff2':'font/woff2','.svg':'image/svg+xml'}[path.extname(file)]??'application/octet-stream');}
 res.writeHead(200,{'Content-Type':type});res.end(body);
 }catch(e){res.writeHead(500);res.end(e.message);}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`,profile=await mkdtemp(path.join(os.tmpdir(),'ref-c13-'));
const chrome=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless','--disable-gpu','--hide-scrollbars','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','about:blank'],{stdio:['ignore','ignore','pipe']});let ws;
try {
 const endpoint=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Chrome timeout')),15000);chrome.stderr.on('data',b=>{const m=b.toString().match(/DevTools listening on (ws:\/\/\S+)/);if(m){clearTimeout(timer);resolve(m[1]);}});});
 const targets=await(await fetch(`http://127.0.0.1:${new URL(endpoint).port}/json`)).json();ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
 let seq=0;const pending=new Map();ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 const ev=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value;};
 const wait=async expression=>{for(let i=0;i<150;i++){if(await ev(expression))return;await new Promise(r=>setTimeout(r,80));}throw Error('Wait failed: '+expression+' '+await ev('document.body.innerText.slice(0,1500)'));};
 await send('Page.enable');await send('Runtime.enable');
 if(process.env.C13_AXE_PATH)await send('Page.addScriptToEvaluateOnNewDocument',{source:await readFile(process.env.C13_AXE_PATH,'utf8')});
 for(const width of [1280,390]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<500});
  for(const route of ['/pengadil','/pengadil/tugasan']){
   await send('Page.navigate',{url:base+route});
   await wait("[...document.querySelectorAll('a')].some(a=>a.textContent.includes('Isi C13')&&a.getBoundingClientRect().width>0)");
   const links=await ev("[...document.querySelectorAll('a[href*=\"jfa-c13.php\"]')].filter(a=>a.getBoundingClientRect().width>0).map(a=>({href:a.getAttribute('href'),text:a.textContent}))");
   assert.equal(links.length,1);assert(links[0].href.includes('match='+match));
   assert.equal(await ev('document.documentElement.scrollWidth>innerWidth+1'),false,'No horizontal overflow '+route+' '+width);
   if(process.env.C13_AXE_PATH){const violations=await ev("axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}}).then(r=>r.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})))");assert.deepEqual(violations,[],JSON.stringify(violations));}
   const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(path.join(out,(route.endsWith('tugasan')?'tasks':'dashboard')+'-'+width+'.png'),Buffer.from(shot.data,'base64'));
  }
 }
 eligible=false;await send('Page.navigate',{url:base+'/pengadil'});await wait("document.querySelector('#action-title')");
 assert.equal(await ev("document.querySelectorAll('a[href*=\"jfa-c13.php\"]').length"),0,'No action without an eligible R appointment');
 console.log('C13 Angular browser: dashboard and task actions at desktop/phone widths, exact match links, role eligibility, overflow and accessibility passed.');
} finally {ws?.close();chrome.kill();await new Promise(r=>setTimeout(r,200));await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});await new Promise(r=>server.close(r));}
