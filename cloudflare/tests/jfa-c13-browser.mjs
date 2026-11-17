// Production Angular assets with isolated API fixtures. No live accounts/writes.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {readFile,mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
const root=new URL('../../frontend/dist/frontend/browser/',import.meta.url).pathname;
const out=new URL('../../output/c13-access/',import.meta.url).pathname;await mkdir(out,{recursive:true});
const match='01234567-1234-1234-1234-0123456789ab';let eligible=true,role='Pengadil';
const dashboard=()=>({c13:eligible?[{match_id:match,appointment_id:1,label:'03 · ALFA lwn BRAVO',submitted:false,c12:{id:'21234567-1234-1234-1234-0123456789ab',revision:1,amendment_number:0}}]:[],
 view:'pengadil',year:2026,name:'PENGADIL UJIAN',totals:{},monthly:[],upcoming:[],responses:[],recent:[],registrations:[],announcements:[],ranking:[],applications:{},positions:[],minimum_matches:20,can_referee:true,can_ra:false});
// A real one-page PDF for the embedded preview fixture.
const pdfObjects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Contents 4 0 R >>','<< /Length 0 >>\nstream\n\nendstream'];
let previewPdf='%PDF-1.4\n';const pdfOffsets=[0];
for(const [i,object] of pdfObjects.entries()){pdfOffsets.push(Buffer.byteLength(previewPdf));previewPdf+=`${i+1} 0 obj\n${object}\nendobj\n`;}
const xrefOffset=Buffer.byteLength(previewPdf);previewPdf+='xref\n0 5\n0000000000 65535 f \n'+pdfOffsets.slice(1).map(offset=>String(offset).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');let body,type='application/json';
 if(url.pathname==='/api/session.php')body=JSON.stringify({authenticated:true,user_id:1,user_email:'test@example.invalid',user_role:role,nama_penuh:'PENGADIL UJIAN',can_referee:1,can_ra:0,password_changed:1});
 else if(url.pathname==='/api/jfa-c13.php'&&url.searchParams.has('mode')){type='application/pdf';body=previewPdf;}
 else if(url.pathname==='/api/jfa-c13.php'&&url.searchParams.get('view')==='admin')body=JSON.stringify({data:{records:[{id:'record-old',match_id:match,match_number:'03',recorded_at:1793509100,scheduled_start:1793509200,referee_name:'PENGADIL UJIAN',venue_name:'Padang Ujian',tournament_name:'LIGA JFA',home_name:'ALFA',away_name:'BRAVO'},{id:'record',match_id:match,match_number:'03',recorded_at:1793509200,scheduled_start:1793509200,referee_name:'PENGADIL UJIAN',venue_name:'Padang Ujian',tournament_name:'LIGA JFA',home_name:'ALFA',away_name:'BRAVO'}],c12Records:[{id:'21234567-1234-1234-1234-0123456789ab',match_id:match,form_type:'MATCH_SUMMARY_C12',match_number:'03',recorded_at:1793509201,scheduled_start:1793509200,venue_name:'Padang Ujian',tournament_name:'LIGA JFA',home_name:'ALFA',away_name:'BRAVO',revision:1,amendment_number:0}]}});
 else if(url.pathname==='/api/portal-dashboard.php')body=JSON.stringify({error:false,data:dashboard()});
 else if(url.pathname==='/api/tugasan.php')body=JSON.stringify({error:false,data:[
  {id:1,jawatan:'Pengadil',status:'Diterima',no_perlawanan:'03',nama_kejohanan:'JFA',jenis_kejohanan:'Liga',tarikh:'2026-11-01',masa:'17:00',pasukan_home:'ALFA',pasukan_away:'BRAVO',c13_match_id:eligible?match:null,c12_document_id:eligible?'21234567-1234-1234-1234-0123456789ab':null},
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
   assert.equal(links.length,2);assert(links.some(l=>l.text.includes('C12')&&l.href.includes('form=C12')&&l.href.includes('document=21234567-1234-1234-1234-0123456789ab')));assert(links[0].href.includes('match='+match));
   assert.equal(await ev('document.documentElement.scrollWidth>innerWidth+1'),false,'No horizontal overflow '+route+' '+width);
   await ev('document.fonts.ready.then(()=>true)');
  if(process.env.C13_AXE_PATH){const violations=await ev("axe.run(document.querySelector('app-c13-reports')??document.querySelector('.portal-page')??document.querySelector('app-pengadil-tugasan'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}}).then(r=>r.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})))");assert.deepEqual(violations,[],JSON.stringify(violations));}
   const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(path.join(out,(route.endsWith('tugasan')?'tasks':'dashboard')+'-'+width+'.png'),Buffer.from(shot.data,'base64'));
  }
 }
 eligible=false;await send('Page.navigate',{url:base+'/pengadil'});await wait("document.querySelector('#action-title')");
 assert.equal(await ev("document.querySelectorAll('a[href*=\"jfa-c13.php\"]').length"),0,'No action without an eligible R appointment');
 role='Admin';
 for(const width of [1280,390]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<500});
  await send('Page.navigate',{url:base+'/admin/lantikan'});
  await wait("[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Laporan Perlawanan'))");
  const tabs=await ev("[...document.querySelectorAll('button')].filter(b=>b.textContent.includes('Laporan Perlawanan')).map(b=>b.textContent)");assert.equal(tabs.length,1);
  await ev("[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Laporan Perlawanan')).click()");
  await wait("!!document.querySelector('app-c13-reports a[href*=record]')");
  assert((await ev("document.querySelector('app-c13-reports').textContent")).includes('Rasmi'));
  assert((await ev("document.querySelector('app-c13-reports a[href*=record]').getAttribute('href')")).includes('view=admin&match='+match));
  assert((await ev("document.querySelector('app-c13-reports a[href*=document]').getAttribute('href')")).includes('form=C12&document='));
  assert.deepEqual(await ev("[...document.querySelectorAll('app-c13-reports thead th')].map(t=>t.textContent.trim())"),['Bil','Nama perlawanan','Padang','Masa','C12','C13']);
  assert.equal(await ev("document.querySelectorAll('app-c13-reports tbody tr').length"),1,'Both forms share the match row');
  const actions=await ev("[...document.querySelectorAll('app-c13-reports a')].filter(a=>a.getClientRects().length&&!a.closest('details:not([open])')).map(a=>a.getAttribute('href'))");
  assert.equal(actions.filter(href=>href.includes('mode=download')).length,2,'Only current forms shown initially');
  assert.equal(actions.filter(href=>href.includes('record=record-old')).length,0,'Older C13 stays in history');
  assert((await ev("document.querySelector('app-c13-reports summary').textContent")).includes('Salinan terdahulu (1)'));
  for(const form of ['C12','C13']){
   await ev(`(()=>{const button=document.querySelector('app-c13-reports button[aria-label="Preview ${form} perlawanan 03"]');button.focus();button.click();})()`);
   await wait("!!document.querySelector('app-c13-reports dialog[open] iframe')");
   const frame=await ev("document.querySelector('app-c13-reports dialog iframe').getAttribute('src')");
   assert(frame.includes('mode=preview'));
   assert(frame.includes(form==='C12'?'document=21234567':'record=record'));
   assert.equal(await ev("document.activeElement.textContent.trim()"),'Tutup','Modal focuses its close button');
   if(process.env.C13_AXE_PATH){assert.deepEqual(await ev("axe.run(document.querySelector('app-c13-reports dialog'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}}).then(r=>r.violations.map(v=>v.id))"),[]);}
   if(form==='C13'){const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(path.join(out,'admin-preview-modal-'+width+'.png'),Buffer.from(shot.data,'base64'));}
   await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
   await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
   await wait("!document.querySelector('app-c13-reports dialog[open]')");
   assert.equal(await ev("document.activeElement.getAttribute('aria-label')"),`Preview ${form} perlawanan 03`,'Focus returns to Preview');
   await wait("document.querySelectorAll('app-c13-reports dialog iframe').length===0");
  }
  await ev("document.querySelector('app-c13-reports summary').click()");
  await wait("!!document.querySelector('app-c13-reports details[open]')");
  assert.equal(await ev("[...document.querySelectorAll('app-c13-reports details a')].filter(a=>a.getClientRects().length&&a.href.includes('record=record-old')).length"),1);
  await ev("document.querySelector('app-c13-reports summary').click()");
  assert.equal(await ev('document.documentElement.scrollWidth>innerWidth+1'),false,'Table scrolls within its container');
  assert((await ev("document.querySelector('app-c13-reports tbody').textContent")).includes('Padang Ujian'));
  if(process.env.C13_AXE_PATH){const violations=await ev("axe.run(document.querySelector('app-c13-reports'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}}).then(r=>r.violations.map(v=>v.id))");assert.deepEqual(violations,[]);}
  const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(path.join(out,'admin-reports-'+width+'.png'),Buffer.from(shot.data,'base64'));
  await ev("(()=>{const input=document.querySelector('app-c13-reports input');input.value='C12';input.dispatchEvent(new Event('input',{bubbles:true}));})()");await wait("document.querySelectorAll('app-c13-reports tbody tr').length===1");assert((await ev("document.querySelector('app-c13-reports tbody').textContent")).includes('ALFA lwn BRAVO'));
 }
 console.log('C12/C13 Angular browser: dashboard and task actions at desktop/phone widths, exact match links, role eligibility, overflow and accessibility passed.');
} finally {ws?.close();chrome.kill();await new Promise(r=>setTimeout(r,200));await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});await new Promise(r=>server.close(r));}
