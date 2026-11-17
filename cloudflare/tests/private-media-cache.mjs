import assert from 'node:assert/strict';
import {bundle,openDatabase,sessionCookie} from './_harness.mjs';
const {privateMedia}=await bundle("export {privateMedia} from '../src/private-media';");
const {db,DB,close}=openDatabase([]);
const original=Object.getOwnPropertyDescriptor(globalThis,'caches'),entries=new Map(),reads=[],heads=[],pending=[];let fail=false;
Object.defineProperty(globalThis,'caches',{configurable:true,value:{default:{async match(key){if(fail)throw Error('cache unavailable');return entries.get(key.url)?.clone();},async put(key,value){if(fail)throw Error('cache unavailable');entries.set(key.url,new Response(await value.arrayBuffer(),{headers:value.headers}));}}}});
const object=key=>({body:new Response('image:'+key).body,size:('image:'+key).length,httpEtag:'"'+key+'"',writeHttpMetadata(headers){headers.set('Content-Type','image/png');}});
const env={DB,STAGING_AUTH_ENABLED:'1',MEDIA:{async get(key){reads.push(key);return object(key);},async head(key){heads.push(key);return object(key);}}};
const ctx={waitUntil:p=>pending.push(p)};
async function read(key,cookie,method='GET',extra={}){const request=new Request('https://refpahang.test/uploads/'+key+'?noise='+Math.random(),{method,headers:{...(cookie?{Cookie:cookie}:{}),...extra}});const r=await privateMedia(request,env,new URL(request.url).pathname,ctx);await Promise.all(pending.splice(0));return r;}
try{
 const admin=db.prepare("SELECT id FROM users WHERE role='Admin' AND aktif=1 LIMIT 1").get();
 const member=db.prepare("SELECT id FROM users WHERE role='Pengadil' AND aktif=1 LIMIT 1").get();assert(admin&&member);
 const adminCookie=await sessionCookie(db,admin.id),memberCookie=await sessionCookie(db,member.id);
 db.prepare("UPDATE kejohanan SET logo_kiri='/uploads/logos/cost-test.png' WHERE id=(SELECT MIN(id) FROM kejohanan)").run();
 db.prepare("UPDATE users SET url_gambar_profil='/uploads/profiles/cost-test.png' WHERE id=?").run(member.id);
 for(const key of ['logos/cost-test.png','profiles/cost-test.png']){
  let r=await read(key,memberCookie);assert.equal(r.headers.get('X-Media-Cache'),'MISS');const etag=r.headers.get('ETag');await r.arrayBuffer();const before=reads.length;
  for(let n=0;n<10;n++){r=await read(key,n%2?adminCookie:memberCookie);assert.equal(r.headers.get('X-Media-Cache'),'HIT');assert.equal(r.headers.get('Cache-Control'),'private, no-store');await r.arrayBuffer();}
  assert.equal(reads.length,before,'Ten authorized requests do not read R2 again');
  r=await read(key,memberCookie,'HEAD');assert.equal(r.status,200);assert.equal(r.headers.get('X-Media-Cache'),'HIT');assert.equal(await r.text(),'');assert.equal(heads.length,0);
  r=await read(key,memberCookie,'GET',{'If-None-Match':etag});assert.equal(r.status,304);assert.equal(reads.length,before);
  assert.equal((await read(key,null)).status,401,'A warm private cache still requires login');
 }
 db.exec("UPDATE kejohanan SET logo_kiri=NULL WHERE logo_kiri='/uploads/logos/cost-test.png'");
 assert.equal((await read('logos/cost-test.png',memberCookie)).status,403,'Withdrawn logo cannot be served from warm cache');
 const before=reads.length;for(let n=0;n<2;n++){const r=await read('applications/private-receipt.png',adminCookie);assert.equal(r.headers.get('X-Media-Cache'),'BYPASS');await r.arrayBuffer();}
 assert.equal(reads.length,before+2,'Receipts are never stored in the shared image cache');
 fail=true;assert.equal((await read('profiles/cost-test.png',memberCookie)).status,200,'Cache outage falls back to authorized R2 retrieval');
 console.log('RefPahang media: profiles/logos 10 repeat reads avoid R2, HEAD/304, per-request login/authorization, withdrawal, private receipt bypass and cache outages passed.');
}finally{close();if(original)Object.defineProperty(globalThis,'caches',original);else delete globalThis.caches;}
