// Built Angular screens with private HTTP fixtures; no production decisions.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {readFile,mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const root=new URL('../../frontend/dist/frontend/browser/',import.meta.url).pathname;
const out=new URL('../../output/pp-applications/',import.meta.url).pathname;
await mkdir(out,{recursive:true});
const row={id:604,nama_penuh:'PEMOHON PP UJIAN',jenis_borang:'pengadil_berdaftar',
  jenis_pengadil:'Pegawai Pembangunan',jenis_permohonan:'Pegawai Pembangunan',
  application_category:'pegawai_pembangunan',tahun_permohonan:2027,status:'Menunggu Admin',
  district_nama:'Persatuan Bolasepak Daerah Rompin',tarikh_hantar:'2026-11-20 16:26:34'};
const writes=[],queries=[],checks=[];
const server=createServer(async(req,res)=>{try{
  const url=new URL(req.url,'http://localhost');let body,type='application/json';
  if(url.pathname==='/api/session.php')body={authenticated:true,user_id:1,user_email:'fixture@example.invalid',
    user_role:'Admin',nama_penuh:'ADMIN UJIAN',password_changed:1};
  else if(url.pathname==='/api/application-settings.php')body={error:false,years:{berdaftar:2027,penilai:2027,bertulis:2026,kelas1:2026}};
  else if(url.pathname==='/api/admin-users.php')body={error:false,users:[],persatuan:[]};
  else if(url.pathname==='/api/admin-profile.php')body={error:false,profile:{nama_penuh:'ADMIN UJIAN'}};
  else if(url.pathname==='/api/admin-dashboard-tasks.php')body={error:false,tasks:{pending_applications:1}};
  else if(url.pathname==='/api/admin-dashboard-stats.php')body={error:false,stats:{year:2027,
    application_years:{pegawai_pembangunan:2027},applications_by_type:{pegawai_pembangunan:{total:1,pending:1,approved:0}}}};
  else if(url.pathname==='/api/admin-applications.php'){
    queries.push(Object.fromEntries(url.searchParams));
    const type=url.searchParams.get('type');
    body={error:false,applications:!type||type==='pp'?[{...row}]:[]};
  }else if(url.pathname==='/api/admin-approve.php'){
    const chunks=[];for await(const chunk of req)chunks.push(chunk);
    const input=JSON.parse(Buffer.concat(chunks));writes.push(input);
    row.status=input.action==='approve'?'Lengkap':'Ditolak';body={error:false,message:'Keputusan disimpan.'};
  }else if(url.pathname.startsWith('/api/'))body={error:false,data:[],notifications:[],unread_count:0};
  else{
    let file=path.resolve(root,'.'+url.pathname);if(!file.startsWith(root))throw Error('Path');
    try{body=await readFile(file);}catch{file=path.join(root,'index.html');body=await readFile(file);}
    type=({'.js':'application/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'}[path.extname(file)]??'application/octet-stream');
  }
  res.writeHead(200,{'Content-Type':type});res.end(type==='application/json'?JSON.stringify(body):body);
}catch(e){res.writeHead(500);res.end(e.message);}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
const profile=await mkdtemp(path.join(os.tmpdir(),'ref-pp-'));
const chrome=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',[
  '--headless','--disable-gpu','--hide-scrollbars','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','about:blank',
],{stdio:['ignore','ignore','pipe']});
let ws;
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
  const host="document.querySelector('app-admin-applications')";
  const click=async label=>{const expression=`[...${host}.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)}&&!b.disabled&&b.getClientRects().length)`;
    await wait(expression);await ev(`${expression}.click()`);};
  const navigate=async route=>{await send('Page.navigate',{url:base+route});};
  assert.ok(process.env.AXE_PATH,'Set AXE_PATH to axe-core/axe.min.js.');
  await send('Page.enable');await send('Runtime.enable');
  await send('Page.addScriptToEvaluateOnNewDocument',{source:await readFile(process.env.AXE_PATH,'utf8')});
  async function inspect(name,width){
    assert.equal(await ev('document.documentElement.scrollWidth>innerWidth+1'),false,`${name}: horizontal overflow at ${width}`);
    const violations=await ev(`axe.run(${host},{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}}).then(r=>r.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})))`);
    checks.push({name,width,violations});
    await writeFile(path.join(out,'browser-checks.json'),JSON.stringify({checks,writes,queries},null,2));
    assert.deepEqual(violations,[],name+' accessibility');
    const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(path.join(out,`${name}-${width}.png`),Buffer.from(shot.data,'base64'));
  }
  for(const width of [1280,390]){
    row.status='Menunggu Admin';
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<500});
    await navigate('/admin');await wait(`document.querySelector('app-admin-dashboard')?.textContent.includes('PEMOHON PP UJIAN')`);
    const link="[...document.querySelectorAll('a')].find(a=>a.textContent.includes('Pegawai Pembangunan')&&a.href.includes('type=pp'))";
    await wait(link);assert.ok((await ev(`${link}.href`)).includes('year=2027'));
    await ev(`${link}.click()`);await wait(`${host}?.textContent.includes('PEMOHON PP UJIAN')`);
    assert.ok(queries.some(q=>q.type==='pp'&&q.year==='2027'));
    await inspect('pp-list',width);
    assert.equal(await ev(`[...${host}.querySelectorAll('button')].some(b=>['Seminar','Ujian'].includes(b.textContent.trim())&&b.getClientRects().length)`),false);
    const decision=width<500?"[...document.querySelectorAll('app-admin-applications button')].find(b=>b.textContent.trim()==='Lulus/Tolak'&&b.getClientRects().length)"
      :`${host}.querySelector('button[aria-label="Lulus/Tolak: Lulus atau tolak permohonan"]')`;
    await ev(`${decision}.click()`);await click('Lulus');await inspect('pp-approve',width);await click('Luluskan');
    await wait(`${host}?.textContent.includes('Diluluskan')&&!${host}.textContent.includes('Luluskan Permohonan')`);
    assert.deepEqual(writes.at(-1),{permohonan_id:604,action:'approve',notes:''});
    row.status='Menunggu Admin';await navigate('/admin/permohonan?type=pp');await wait(`${host}?.textContent.includes('PEMOHON PP UJIAN')`);
    assert.equal(queries.at(-1).year,'2027','PP uses the annual session by default');
    await ev(`${decision}.click()`);await click('Tolak');
    await ev(`(()=>{const f=${host}.querySelector('textarea');f.value='Dokumen tidak lengkap';f.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await inspect('pp-reject',width);await click('Tolak');
    await wait(`${host}?.textContent.includes('Ditolak')&&!${host}.textContent.includes('Tolak Permohonan')`);
    assert.deepEqual(writes.at(-1),{permohonan_id:604,action:'reject',notes:'Dokumen tidak lengkap'});
    await click('Pengadil Berdaftar');await wait(`${host}?.textContent.includes('Tiada Rekod')`);
    assert.equal(await ev(`${host}.textContent.includes('PEMOHON PP UJIAN')`),false);
  }
  await writeFile(path.join(out,'browser-checks.json'),JSON.stringify({checks,writes,queries},null,2));
  console.log('PP portal: desktop/phone dashboard link, annual tab, approve/reject and referee separation; zero WCAG AA violations or overflow.');
}finally{
  ws?.close();chrome.kill();await new Promise(r=>chrome.once('exit',r));
  await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});await new Promise(r=>server.close(r));
}
