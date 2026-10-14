import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/appointment-audit.ts',import.meta.url),'utf8')
  .replace("import { currentUser, json } from './auth';",
    `const currentUser = async () => globalThis.auditUser;
     const json = (value,status=200) => Response.json(value,{status});`)
  .replace("import { boundedJson } from './request';",
    'const boundedJson = async (request) => request.json();');
const compiled = ts.transpileModule(source,{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},
}).outputText;
const { appointmentAudit } = await import(`data:text/javascript,${encodeURIComponent(compiled)}`);

const snapshot={
  lantikan_id:12,jadual_id:9,kejohanan_id:2,pengadil_id:null,
  pengadil_luar_id:3,jawatan:'Pengadil',no_telefon_pegawai:'0123456789',
  status:'Ditolak',komen:'Ditolak automatik - tiada jawapan dalam tempoh',
  notif_hantar:1,tg_notif_hantar:0,tarikh_notif:'2026-10-01 09:00:00',
  email_token:'old-token',penilaian_token:null,tg_link_token:'link-token',
  telegram_chat_id:null,nama_pegawai:'Pegawai A',emel_pegawai:'a@example.test',
  jadual_status:'Aktif',
};
let dbReads=0;
let insertedAudit=null;
const env={BASE_URL:'https://staging.example.test/',TELEGRAM_BOT_USERNAME:'refpahang_bot',
  STAGING_WRITES_ENABLED:'0',
  DB:{prepare:(sql)=>({bind:(...params)=>({sql,params,
    first:async()=>{dbReads++;return globalThis.auditSnapshot;},
    all:async()=>{dbReads++;return {results:[{id:1,event_type:'appointment_auto_rejected',
      channel:'system',event_status:'success',link_url:null,details_json:'{"reason":"timeout"}',
      actor_type:'system',actor_user_id:null,ip_address:null,created_at:'2026-10-01 12:00:00'}]};},
    run:async()=>{insertedAudit={sql,params};return {meta:{changes:1}};},
  })}),batch:async(statements)=>{
    for(const {sql,params} of statements){
      if(sql.includes('SET email_token=') && globalThis.auditSnapshot.status==='Belum Jawab'
          && !globalThis.auditSnapshot.email_token) globalThis.auditSnapshot.email_token=params[0];
      if(sql.includes('SET tg_link_token=') && !globalThis.auditSnapshot.tg_link_token)
        globalThis.auditSnapshot.tg_link_token=params[0];
      if(sql.includes('SET penilaian_token=') && globalThis.auditSnapshot.status==='Diterima'
          && globalThis.auditSnapshot.jawatan==='Penilai Pengadil'
          && !globalThis.auditSnapshot.penilaian_token)
        globalThis.auditSnapshot.penilaian_token=params[0];
    }
    return statements.map(()=>({meta:{changes:1}}));
  }},
};
const url='https://staging.example.test/api/lantikan-audit.php?lantikan_id=12';
globalThis.auditUser=null;
globalThis.auditSnapshot=snapshot;
assert.equal((await appointmentAudit(new Request(url),env)).status,401);
globalThis.auditUser={id:5,role:'Pengadil'};
assert.equal((await appointmentAudit(new Request(url),env)).status,403);
assert.equal(dbReads,0,'Non-Admin must not query audit data');
globalThis.auditUser={id:6,role:'Admin'};
assert.equal((await appointmentAudit(new Request(url.replace('12','x')),env)).status,400);
globalThis.auditSnapshot=null;
assert.equal((await appointmentAudit(new Request(url),env)).status,404);
globalThis.auditSnapshot=snapshot;
const response=await appointmentAudit(new Request(url),env);
assert.equal(response.status,200);
const payload=await response.json();
assert.equal(payload.data.lantikan.can_admin_override_acceptance,true);
assert.equal(payload.data.links.accept_url,null,'Rejected appointment must have no reply URL');
assert.equal(payload.data.links.telegram_link_url,
  'https://t.me/refpahang_bot?start=link-token');
assert.deepEqual(payload.data.events[0].details,{reason:'timeout'});
assert.equal('details_json' in payload.data.events[0],false);
env.TELEGRAM_BOT_USERNAME=undefined;
const withoutBot=await (await appointmentAudit(new Request(url),env)).json();
assert.equal(withoutBot.data.links.telegram_link_url,null,
  'Staging must not default to the live Telegram bot');
env.TELEGRAM_BOT_USERNAME='refpahang_bot';
assert.equal((await appointmentAudit(new Request(url,{method:'POST'}),env)).status,503,
  'Admin mutations stay unavailable until fully ported');
env.STAGING_WRITES_ENABLED='1';
const post=(body)=>new Request(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
assert.equal((await appointmentAudit(post({action:'record_copy',lantikan_id:12,link_type:'bad'}),env)).status,400);
assert.equal((await appointmentAudit(post({action:'mark_manual_delivery',lantikan_id:12}),env)).status,503);
assert.equal(insertedAudit,null);
globalThis.auditSnapshot={...snapshot,status:'Diterima'};
assert.equal((await appointmentAudit(post({action:'record_copy',lantikan_id:12,link_type:'accept_url'}),env)).status,409);
assert.equal(insertedAudit,null,'Inactive link must not be logged');
globalThis.auditSnapshot={...snapshot,status:'Belum Jawab'};
const copied=await appointmentAudit(post({action:'record_copy',lantikan_id:12,link_type:'accept_url'}),env);
assert.equal(copied.status,200);
assert.match(insertedAudit.sql,/INSERT INTO lantikan_audit_log/);
assert.equal(insertedAudit.params[0],12);
assert.equal(insertedAudit.params[9],'direct_link_copied');
assert.match(insertedAudit.params[10],/action=accept$/);
assert.deepEqual(JSON.parse(insertedAudit.params[11]),{link_type:'accept_url'});
assert.equal(insertedAudit.params[12],6,'Admin ID is recorded');
insertedAudit=null;
globalThis.auditSnapshot={...snapshot,status:'Belum Jawab',email_token:null,tg_link_token:null};
const prepared=await appointmentAudit(post({action:'prepare_links',lantikan_id:12}),env);
assert.equal(prepared.status,200);
const preparedData=await prepared.json();
assert.match(globalThis.auditSnapshot.email_token,/^[a-f0-9]{64}$/);
assert.match(globalThis.auditSnapshot.tg_link_token,/^[a-f0-9]{64}$/);
assert.match(preparedData.data.links.accept_url,/action=accept$/);
assert.equal(insertedAudit.params[9],'direct_links_prepared');
assert.deepEqual(JSON.parse(insertedAudit.params[11]),preparedData.data.links);
assert.equal(preparedData.data.lantikan.notif_hantar,1,
  'Preparing links must not change an existing delivery flag');
console.log('appointment audit: Admin GET, copy, prepare links, redaction and write gates passed');
