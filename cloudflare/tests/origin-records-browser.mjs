// Built Angular UI, private fixtures, no production accounts or writes.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {readFile,mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const root=new URL('../../frontend/dist/frontend/browser/',import.meta.url).pathname;
const out=new URL('../../output/origin-records/',import.meta.url).pathname;
await mkdir(out,{recursive:true});
let role='Pengadil';let row;let records;const writes=[];
function reset(){row={id:1,user_id:80,referee_name:'PENGADIL UJIAN',origin_state:'Selangor',transfer_date:'2026-09-01',
  date_from:'2026-01-01',date_to:'2026-08-31',status:'requested',expires_on:'2026-12-16',revision:0,
  verifier_name:'PP Negeri Asal',proof_name:'buku-log.pdf',review_notes:'',notes:'Buku log pengadil'};
  records=[{id:1,tarikh:'2026-01-02',masa:'16:30',home_team:'ALFA',away_team:'BRAVO',nama_kejohanan:'Liga Asal',jenis:'Liga',tempat:'Padang Asal',jawatan:'Pengadil'}];}
reset();
const server=createServer(async(req,res)=>{try{
  const url=new URL(req.url,'http://localhost');let body,type='application/json',status=200;
  if(url.pathname==='/api/session.php')body={authenticated:true,user_id:role==='Admin'?1:80,user_email:'fixture@example.invalid',user_role:role,
    nama_penuh:'PENGADIL UJIAN',can_referee:role==='Admin'?0:1,can_ra:0,password_changed:1};
  else if(url.pathname==='/api/rekod-negeri-asal.php'){
    if(req.method==='POST'){
      const chunks=[];for await(const chunk of req)chunks.push(chunk);
      const input=JSON.parse(Buffer.concat(chunks));writes.push(input);
      assert.equal(input.revision,row.revision);
      const state={grant:'open',submit:'submitted',accept:'accepted',reject:'rejected',revoke:'revoked'}[input.action];
      if(state)row.status=state;
      if(input.action==='add_record')records.push({...input,id:records.length+1});
      row.revision++;row.review_notes=input.notes??'';
      body={error:false,message:'Perubahan disimpan.'};
    }else if(url.searchParams.has('id'))body={error:false,request:{...row,access_active:row.status==='open'&&row.expires_on>='2026-11-16'},records};
    else body={error:false,requests:[{...row,record_count:records.length}],states:['Selangor','Johor'],positions:['Pengadil','Penolong Pengadil 1','Penolong Pengadil 2','Pengadil Ke-4'],
      today:'2026-11-16',pagination:{page:1,total_pages:1}};
  }else if(url.pathname.startsWith('/api/'))body={error:false,data:[],notifications:[],unread_count:0};
  else{
    let file=path.resolve(root,'.'+url.pathname);if(!file.startsWith(root))throw Error('Path');
    try{body=await readFile(file);}catch{file=path.join(root,'index.html');body=await readFile(file);}
    type=({'.js':'application/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'}[path.extname(file)]??'application/octet-stream');
  }
  res.writeHead(status,{'Content-Type':type});res.end(type==='application/json'?JSON.stringify(body):body);
}catch(e){res.writeHead(500);res.end(e.message);}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
const profile=await mkdtemp(path.join(os.tmpdir(),'ref-origin-'));
const chrome=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',[
  '--headless','--disable-gpu','--hide-scrollbars','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','about:blank',
],{stdio:['ignore','ignore','pipe']});
let ws;const checks=[];
try{
  const endpoint=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Chrome timeout')),15000);
    chrome.stderr.on('data',b=>{const match=b.toString().match(/DevTools listening on (ws:\/\/\S+)/);if(match){clearTimeout(timer);resolve(match[1]);}});});
  const targets=await(await fetch(`http://127.0.0.1:${new URL(endpoint).port}/json`)).json();
  ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
  let sequence=0;const pending=new Map();
  ws.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
  const ev=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value;};
  const wait=async expression=>{for(let i=0;i<150;i++){if(await ev(`Boolean(${expression})`))return;await new Promise(r=>setTimeout(r,80));}throw Error('Wait: '+expression+' '+await ev('document.body.innerText.slice(-2000)'));};
  const host="document.querySelector('app-origin-records')";
  const click=async label=>{const expression=`[...${host}.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)}&&!b.disabled)`;
    await wait(expression);await ev(`${expression}.click()`);};
  const field=async(control,value)=>ev(`(()=>{const f=${host}.querySelector('[formcontrolname="${control}"]');f.value=${JSON.stringify(value)};f.dispatchEvent(new Event(f.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`);
  const open=async()=>{await wait(`${host}?.textContent.includes('1 rekod')||${host}?.textContent.includes('2 rekod')`);await click('Buka');await wait(`${host}?.textContent.includes('PP Negeri Asal')`);};
  const navigate=async route=>{await send('Page.navigate',{url:base+route});await wait(`${host}&&!${host}.querySelector('p[role="status"]')&&${host}.textContent.includes('Selangor')`);};
  const axe=process.env.ORIGIN_AXE_PATH;
  assert.ok(axe,'Set ORIGIN_AXE_PATH to axe-core/axe.min.js to verify WCAG AA.');
  await send('Page.enable');await send('Runtime.enable');
  await send('Page.addScriptToEvaluateOnNewDocument',{source:await readFile(axe,'utf8')});
  async function inspect(name,width){
    await wait(`${host}.getAttribute('aria-busy')!=='true'`);
    assert.equal(await ev('document.documentElement.scrollWidth>innerWidth+1'),false,`${name}: horizontal overflow at ${width}`);
    assert.equal(await ev(`(()=>{const r=${host}.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1;})()`),true,`${name}: content clipped at ${width}`);
    const violations=await ev(`axe.run(${host},{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}}).then(r=>r.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})))`);
    assert.deepEqual(violations,[],name+' accessibility');
    if(name==='admin-review')await ev(`[...${host}.querySelectorAll('h2')].find(h=>h.textContent==='Kawalan Admin').scrollIntoView({block:'start'})`);
    const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(path.join(out,`${name}-${width}.png`),Buffer.from(shot.data,'base64'));
    checks.push({name,width,accessibility:violations,overflow:false});
  }
  for(const width of [1280,390]){
    reset();await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<500});
    role='Pengadil';await navigate('/pengadil/rekod-negeri-asal');await inspect('owner-list',width);
    await click('Mohon akses khas');await inspect('request-form',width);
    assert.equal(await ev(`${host}.querySelectorAll('input[type="file"]').length`),1);
    await click('Batal');
    role='Admin';await navigate('/admin/rekod-negeri-asal');await open();await inspect('admin-access',width);
    await click('Buka akses khas');await wait(`${host}.textContent.includes('Kemas kini akses')`);
    assert.equal(writes.at(-1).action,'grant');assert.equal(writes.at(-1).date_to,'2026-08-31');
    role='Pengadil';await navigate('/pengadil/rekod-negeri-asal');await open();await inspect('owner-open',width);
    assert.equal(await ev(`${host}.textContent.includes('Kawalan Admin')`),false);
    for(const [control,value]of Object.entries({tarikh:'2026-03-01',jenis:'Liga',nama_kejohanan:'Liga Selangor',home_team:'CHARLIE',away_team:'DELTA',tempat:'Padang Selangor',jawatan:'Pengadil Ke-4'}))await field(control,value);
    await click('Simpan rekod draf');await wait(`${host}.textContent.includes('CHARLIE lwn DELTA')`);
    assert.equal(writes.at(-1).tarikh,'2026-03-01');assert.equal(writes.at(-1).action,'add_record');
    await click('Hantar 2 rekod kepada Admin');await wait(`${host}.textContent.includes('Menunggu semakan Admin')`);
    assert.equal(await ev(`${host}.textContent.includes('Tambah rekod perlawanan')`),false);
    role='Admin';await navigate('/admin/rekod-negeri-asal');await open();await inspect('admin-review',width);
    await field('notes','Buku log dan pengesahan PP negeri asal disemak.');
    await click('Terima semua 2 rekod selepas semakan bukti');await wait(`${host}.textContent.includes('Rekod dikunci')`);
    assert.equal(writes.at(-1).action,'accept');await inspect('accepted',width);
    assert.equal(await ev(`${host}.textContent.includes('Kawalan Admin')`),false);
    role='PP Daerah';await navigate('/pp-daerah/rekod-negeri-asal');await open();
    assert.equal(await ev(`${host}.textContent.includes('Kawalan Admin')`),false);await inspect('pp-personal',width);
    row.status='open';row.expires_on='2026-11-01';role='Pengadil';await navigate('/pengadil/rekod-negeri-asal');await open();
    await inspect('expired-access',width);assert.equal(await ev(`${host}.textContent.includes('Tambah rekod perlawanan')`),false);
  }
  await writeFile(path.join(out,'browser-checks.json'),JSON.stringify({checks,actions:writes.map(r=>({action:r.action,revision:r.revision}))},null,2));
  console.log(`Origin portal: ${checks.length} desktop/phone views; request form, Admin grant, historical entry, submit, acceptance, PP personal-only, expiry; zero WCAG AA violations and no page overflow.`);
}finally{
  ws?.close();chrome.kill();await new Promise(r=>chrome.once('exit',r));
  await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});await new Promise(r=>server.close(r));
}
