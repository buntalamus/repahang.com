// Smoke test of a demo seed through the full Worker (src/index.ts), as the
// browser would use it. Usage (Node 22):
//   REFPAHANG_TEST_SNAPSHOT=<demo_base.sqlite> node --no-warnings demo/smoke.mjs
import assert from 'node:assert/strict';
import {readdirSync,readFileSync} from 'node:fs';
import {bundle,openDatabase} from '../tests/_harness.mjs';

if (!process.env.REFPAHANG_TEST_SNAPSHOT) throw new Error('Set REFPAHANG_TEST_SNAPSHOT to the demo base sqlite');
const worker=await bundle(`export {default} from '../src/index';`);
const migrations=readdirSync(new URL('../migrations',import.meta.url)).filter(f=>f.endsWith('.sql')).map(f=>f.slice(0,-4)).sort();
const {db,DB,close}=openDatabase(migrations);
const accounts=JSON.parse(readFileSync(new URL('./accounts.json',import.meta.url),'utf8'));
const outbound=[];
const realFetch=globalThis.fetch;
globalThis.fetch=async(url)=>{outbound.push(String(url));return new Response('{"ok":true}',{headers:{'Content-Type':'application/json'}});};
const emails=[];
const ORIGIN='https://demo.refpahang.com';
const PRODUCTION={fetch:async()=>new Response('{"enabled":true}',{headers:{'Content-Type':'application/json'}})};
const env={DB,PRODUCTION,BASE_URL:ORIGIN,DEMO_MODE:'1',DEMO_RELAY_SECRET:'x',STAGING_AUTH_ENABLED:'1',STAGING_WRITES_ENABLED:'1',
  APPOINTMENT_DELIVERY_ENABLED:'1',REPORT_DELIVERY_ENABLED:'1',BULK_EMAIL_ENABLED:'1',MAILBOX_SEND_ENABLED:'1',
  PUSH_ENABLED:'0',TELEGRAM_BOT_TOKEN:'123:demo',
  MAIL_ADMIN_USER:'admin@refpahang.com',MAIL_ADMIN_NAME:'Admin',MAIL_DAFTAR_USER:'daftar@refpahang.com',MAIL_DAFTAR_NAME:'Daftar',
  MAIL_LANTIKAN_USER:'lantikan@refpahang.com',MAIL_LANTIKAN_NAME:'Lantikan',MAIL_SUPPORT_USER:'support@refpahang.com',
  MAIL_SUPPORT_NAME:'Support',MAIL_PENGESAHAN_USER:'pengesahan@refpahang.com',MAIL_PENGESAHAN_NAME:'Pengesahan',
  EMAIL:{send:async(message)=>{emails.push(message);return {messageId:'x'};}},
  MEDIA:{get:async()=>null,put:async()=>null,head:async()=>null},ASSETS:{fetch:async()=>new Response('')}};
const ctx={waitUntil:()=>{},passThroughOnException:()=>{}};
const request=async(path,{method='GET',cookie,body}={})=>{
  const response=await worker.default.fetch(new Request(ORIGIN+path,{method,headers:{Origin:ORIGIN,
    ...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{})}),env,ctx);
  const text=await response.text();
  let json=null;try{json=JSON.parse(text);}catch{}
  return {status:response.status,json,text,cookie:response.headers.get('Set-Cookie')?.split(';')[0]};
};
const one=(sql,...values)=>db.prepare(sql).get(...values);

try {
  const info=await request('/api/demo-info.php');
  assert.equal(info.status,200);
  const cookies={};
  for (const account of accounts) {
    const login=await request('/api/login.php',{method:'POST',body:{email:account.emel,password:account.kata_laluan}});
    assert.equal(login.status,200,`${account.emel}: ${login.text.slice(0,200)}`);
    assert.ok(login.cookie,`${account.emel} gets a session`);
    cookies[account.emel]=login.cookie;
    const data=login.json.data;
    console.log(`login ${account.peranan.padEnd(22)} -> ${data.role} ${data.redirect_url} (referee=${data.can_referee}, ra=${data.can_ra})`);
  }
  const admin=cookies['admin@demo.refpahang.com'];
  const referee=cookies['pengadil@demo.refpahang.com'];

  // Read-only pages used by each role answer without errors.
  for (const [who,path] of [['admin','/api/admin-dashboard-tasks.php'],['admin','/api/admin-dashboard-stats.php'],
    ['penilai@demo.refpahang.com','/api/penilai-dashboard.php'],['pengadil@demo.refpahang.com','/api/portal-dashboard.php'],
    ['pengadil@demo.refpahang.com','/api/tugasan.php'],['penilai@demo.refpahang.com','/api/tugasan.php'],
    ['pp@demo.refpahang.com','/api/pp-applications.php'],['pp@demo.refpahang.com','/api/pp-dashboard-overview.php']]) {
    const cookie=who==='admin'?admin:cookies[who];
    const page=await request(path,{cookie});
    assert.equal(page.status,200,`${who} ${path}: ${page.text.slice(0,200)}`);
  }

  // The shared referee has an appointment to answer: accepting it works.
  const pending=one(`SELECT lp.id FROM lantikan_pengadil lp JOIN users u ON u.id=lp.pengadil_id
    WHERE u.email='pengadil@demo.refpahang.com' AND lp.status='Belum Jawab'`);
  assert.ok(pending,'seeded pending appointment');
  const accepted=await request('/api/lantikan-jawab.php',{method:'POST',cookie:referee,body:{action:'accept',lantikan_id:pending.id}});
  assert.equal(accepted.status,200,accepted.text.slice(0,200));
  assert.equal(one('SELECT status FROM lantikan_pengadil WHERE id=?',pending.id).status,'Diterima');

  // Admin staffs an upcoming cup match from the pool and notifies the crew.
  const cup=one(`SELECT jp.id,jp.kejohanan_id FROM jadual_perlawanan jp JOIN kejohanan k ON k.id=jp.kejohanan_id
    WHERE k.nama='PIALA DEMO PAHANG 2026' ORDER BY jp.id LIMIT 1`);
  const pool=db.prepare(`SELECT u.id,u.jenis_pengadil FROM pool_pengadil p JOIN users u ON u.id=p.pengadil_id
    WHERE p.kejohanan_id=? AND u.role='Pengadil' ORDER BY u.id`).all(cup.kejohanan_id);
  const ra=one(`SELECT u.id FROM pool_pengadil p JOIN users u ON u.id=p.pengadil_id
    WHERE p.kejohanan_id=? AND u.role='Penilai' ORDER BY u.id LIMIT 1`,cup.kejohanan_id);
  const crew=[['Pengadil',pool[0].id],['Penolong Pengadil 1',pool[1].id],['Penolong Pengadil 2',pool[2].id],['Penilai Pengadil',ra.id]];
  for (const [jawatan,id] of crew) {
    const assigned=await request('/api/lantikan.php',{method:'POST',cookie:admin,body:{jadual_id:cup.id,pengadil_id:id,jawatan}});
    assert.equal(assigned.status,200,`${jawatan}: ${assigned.text.slice(0,300)}`);
  }
  const before=Number(one('SELECT count(*) AS n FROM demo_outbox').n);
  const notified=await request('/api/lantikan.php',{method:'POST',cookie:admin,body:{action:'notify',jadual_id:cup.id}});
  assert.equal(notified.status,200,notified.text.slice(0,300));
  const kept=db.prepare('SELECT channel,recipient,subject FROM demo_outbox WHERE id>? ORDER BY id').all(before);
  console.log(`notify: ${kept.length} messages kept in demo_outbox`,kept.slice(0,4).map(r=>`${r.channel}:${r.subject}`));
  assert.ok(kept.some(r=>r.channel==='telegram'),'appointment Telegram is kept for fictional officials');
  assert.equal(one('SELECT status FROM jadual_perlawanan WHERE id=?',cup.id).status,'Disahkan');

  // Nothing left the Worker towards Telegram or a real mailbox.
  assert.deepEqual(outbound.filter(url=>url.includes('api.telegram.org')),[],'no Telegram API call for fictional chats');
  assert.deepEqual(emails.map(m=>typeof m.to==='string'?m.to:m.to.email),[],'no email to fictional addresses');

  const outbox=await request('/api/admin-demo-outbox.php',{cookie:admin});
  assert.equal(outbox.status,200);
  assert.ok(outbox.json.total>=kept.length);
  console.log('demo smoke: ok');
} finally {
  globalThis.fetch=realFetch;
  close();
}
