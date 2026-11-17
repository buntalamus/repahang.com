// Built Angular UI with isolated API fixtures; this test never contacts production.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {readFile,mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
const root=new URL('../../frontend/dist/frontend/browser/',import.meta.url).pathname;
const out=new URL('../../output/approval-errors-qa/',import.meta.url).pathname;
await mkdir(out,{recursive:true});
let stage='Menunggu PP Daerah',approvalAttempts=0;
const application=()=>({id:540,nama_penuh:'PENILAI UJIAN',jenis_borang:'penilai_berdaftar',application_category:'penilai_berdaftar',
  jenis_pengadil:'Penilai Pengadil',tahun_permohonan:2027,status:stage,district_nama:'Persatuan Bolasepak Daerah Temerloh',
  tarikh_hantar:'2026-11-02 09:06:52',no_kp:'000000000000',emel:'test@example.invalid'});
const server=createServer(async(req,res)=>{try{
  const url=new URL(req.url,'http://localhost');let body,type='application/json',status=200;
  if(url.pathname==='/api/session.php')body={authenticated:true,user_id:1,user_email:'admin@example.invalid',user_role:'Admin',nama_penuh:'ADMIN UJIAN',password_changed:1};
  else if(url.pathname==='/api/demo-info.php'){status=404;body={error:true,message:'Tidak dijumpai.'};}
  else if(url.pathname==='/api/application-settings.php')body={error:false,years:{berdaftar:2027,penilai:2027,bertulis:2026,kelas1:2026}};
  else if(url.pathname==='/api/admin-applications.php')body={error:false,applications:[application()]};
  else if(url.pathname==='/api/admin-users.php')body={error:false,users:[],persatuan:[]};
  else if(url.pathname==='/api/admin-approve.php'){
    approvalAttempts++;status=409;body={error:true,code:'APPLICATION_STATE_CONFLICT',message:'Permohonan masih menunggu pengesahan PP Daerah sebelum boleh diluluskan atau ditolak oleh Admin.',
      status_workflow:'Menunggu PP Daerah',next_action:'Minta PP Daerah mengesahkan permohonan dahulu. Selepas itu muat semula senarai untuk kelulusan Admin.'};
  }else if(url.pathname.startsWith('/api/'))body={error:false,data:[],notifications:[],unread_count:0};
  else {
    let file=path.resolve(root,'.'+url.pathname);if(!file.startsWith(root))throw Error('Invalid path');
    try{body=await readFile(file);}catch{file=path.join(root,'index.html');body=await readFile(file);}
    type=({'.js':'application/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.woff2':'font/woff2','.svg':'image/svg+xml'}[path.extname(file)]??'application/octet-stream');
  }
  res.writeHead(status,{'Content-Type':type,'X-Request-ID':'qa-approval-540'});res.end(type==='application/json'?JSON.stringify(body):body);
}catch(error){res.writeHead(500);res.end(error.message);}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
const profile=await mkdtemp(path.join(os.tmpdir(),'ref-approval-errors-'));
const chrome=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',[
  '--headless','--disable-gpu','--hide-scrollbars','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','about:blank',
],{stdio:['ignore','ignore','pipe']});
let ws;
const checks=[];
try {
  const endpoint=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Chrome timeout')),15000);chrome.stderr.on('data',buffer=>{const match=buffer.toString().match(/DevTools listening on (ws:\/\/\S+)/);if(match){clearTimeout(timer);resolve(match[1]);}});});
  const targets=await(await fetch(`http://127.0.0.1:${new URL(endpoint).port}/json`)).json();
  ws=new WebSocket(targets.find(target=>target.type==='page').webSocketDebuggerUrl);
  await new Promise(resolve=>ws.addEventListener('open',resolve,{once:true}));
  let sequence=0;const pending=new Map();
  ws.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id){const promise=pending.get(message.id);pending.delete(message.id);message.error?promise.reject(Error(message.error.message)):promise.resolve(message.result);}});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description??result.exceptionDetails.text);return result.result.value;};
  const wait=async expression=>{for(let attempt=0;attempt<150;attempt++){if(await evaluate(expression))return;await new Promise(resolve=>setTimeout(resolve,80));}throw Error('Wait failed: '+expression+' '+await evaluate("(document.body?.innerText||'').slice(0,1400)"));};
  const click=async condition=>{await wait(`[...document.querySelectorAll('button')].some(button=>button.getBoundingClientRect().width>0&&(${condition}))`);await evaluate(`[...document.querySelectorAll('button')].find(button=>button.getBoundingClientRect().width>0&&(${condition})).click()`);};
  await send('Page.enable');await send('Runtime.enable');
  const axePath=process.env.REFPAHANG_AXE_PATH;
  if(axePath)await send('Page.addScriptToEvaluateOnNewDocument',{source:await readFile(axePath,'utf8')});
  for(const width of [1280,390]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<500});
    stage='Menunggu PP Daerah';
    await send('Page.navigate',{url:base+'/admin/permohonan-ra'});
    await wait("(document.body?.innerText||'').includes('PENILAI UJIAN')");
    assert.equal(await evaluate("document.querySelectorAll('app-toast [role=alert]').length"),0,'expected demo 404 must not show a false error');
    const buttons=await evaluate("[...document.querySelectorAll('button')].filter(button=>button.getBoundingClientRect().width>0&&((button.getAttribute('title')||'').includes('PP Daerah')||button.textContent.trim()==='Lulus/Tolak')).map(button=>({disabled:button.disabled,title:button.title}))");
    assert.equal(buttons.length,1);assert.equal(buttons[0].disabled,true);
    assert.ok(await evaluate("(document.body?.innerText||'').includes('Menunggu PP Daerah')&&(document.body?.innerText||'').includes('Perlu pengesahan PP Daerah dahulu.')"));
    assert.equal(approvalAttempts,checks.length,'a blocked review must not submit an approval request');
    const pendingShot=await send('Page.captureScreenshot',{format:'png'});
    await writeFile(path.join(out,`pending-${width}.png`),Buffer.from(pendingShot.data,'base64'));

    // A stale Admin-ready page receives the current PP status from the server.
    stage='Menunggu Admin';await send('Page.navigate',{url:base+'/admin/permohonan-ra'});
    await wait("(document.body?.innerText||'').includes('PENILAI UJIAN')");
    await click("(button.getAttribute('aria-label')||'')==='Lulus atau tolak permohonan'||button.textContent.trim()==='Lulus/Tolak'");
    await click("button.textContent.trim()==='Lulus'");
    await click("button.textContent.trim()==='Luluskan'");
    await wait("document.querySelector('app-toast [role=alert]')?.innerText.includes('Sebab:')");
    await evaluate("Promise.all(document.querySelector('app-toast').getAnimations({subtree:true}).map(animation=>animation.finished.catch(()=>{}))).then(()=>true)");
    const notice=await evaluate("document.querySelector('app-toast [role=alert]').innerText");
    for(const required of ['Gagal meluluskan permohonan','menunggu pengesahan PP Daerah','Status semasa: Menunggu PP Daerah','Tindakan: Minta PP Daerah','permohonan #540','qa-approval-540'])assert.ok(notice.includes(required),required);
    assert.equal(await evaluate("document.querySelectorAll('app-toast [role=alert]').length"),1,'one failure must produce one toast');
    const layout=await evaluate("(()=>{const node=document.querySelector('app-toast [role=alert]');const rect=node.getBoundingClientRect();return {left:rect.left,right:rect.right,width:innerWidth,scroll:document.documentElement.scrollWidth,whiteSpace:getComputedStyle(node.querySelector('span.flex-1')).whiteSpace};})()");
    assert.ok(layout.left>=0&&layout.right<=width,'toast must fit the viewport '+JSON.stringify(layout));
    assert.ok(layout.scroll<=width+1,'no horizontal overflow');assert.equal(layout.whiteSpace,'pre-line');
    let accessibility=[];
    if(axePath){accessibility=await evaluate("axe.run(document.querySelector('app-toast')).then(result=>result.violations.map(({id,impact,description,nodes})=>({id,impact,description,nodes:nodes.map(node=>node.target)})))");assert.deepEqual(accessibility,[],'toast accessibility');}
    const screenshot=await send('Page.captureScreenshot',{format:'png'});
    await writeFile(path.join(out,`error-${width}.png`),Buffer.from(screenshot.data,'base64'));
    const beforeClose=await evaluate("document.querySelector('app-toast [role=alert]').innerText");
    await click("button.getAttribute('aria-label')==='Tutup notifikasi'");
    await wait("!document.querySelector('app-toast [role=alert]')");
    checks.push({width,status:'passed',layout,accessibility,notice:beforeClose});
  }
  await writeFile(path.join(out,'browser-checks.json'),JSON.stringify({approvalAttempts,checks},null,2));
  console.log('PASS: desktop/mobile Penilai review labels and disabled actions; stale approval shows one complete, dismissible toast; no overflow; '+(process.env.REFPAHANG_AXE_PATH?'zero axe violations.':'axe not configured.'));
} finally {
  ws?.close();chrome.kill();await new Promise(resolve=>chrome.once('exit',resolve));
  await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});await new Promise(resolve=>server.close(resolve));
}
