import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { DatabaseSync } from 'node:sqlite';

const source = readFileSync(new URL('../src/appointment-audit.ts',import.meta.url),'utf8')
  .replace("import { currentUser, json } from './auth';",
    `const currentUser = async () => globalThis.auditUser;
     const json = (value,status=200) => Response.json(value,{status});`)
  .replace("import { notifyAcceptanceOverride } from './lantikan-notify';",
    'const notifyAcceptanceOverride = async () => {};')
  .replace("import { boundedJson } from './request';",
    'const boundedJson = async (request) => request.json();')
  .replace("import { wroteRow } from './d1-changes';",
    'const wroteRow = (result) => Number(result?.meta.changes ?? 0) > 0;')
  .replace("import { guardStatement, runGuarded } from './php/guard';",'')
  .replace("import { auditMetaFrom, getLantikanAuditSnapshot, lantikanAuditStatement } from './php/lantikan-audit';",'')
  .replace(`import { createPortalNotification, generatePenilaianToken, historySyncStatements,
  isAcceptedKupCrewComplete, isKupPosition, markMatchDispatchedIfComplete,
  notifyCompleteKupCrew } from './php/lantikan-helper';`,'');
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
      if(sql.includes('SET notif_hantar=1')) {
        globalThis.auditSnapshot.notif_hantar=1;
        globalThis.auditSnapshot.tarikh_notif='2026-10-14 10:00:00';
      }
      if(sql.includes('INSERT INTO lantikan_audit_log')) insertedAudit={sql,params};
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
assert.equal((await appointmentAudit(post({action:'mark_manual_delivery',lantikan_id:12}),env)).status,409);
assert.equal((await appointmentAudit(post({action:'admin_override_acceptance',lantikan_id:12}),env)).status,503);
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
assert.match(insertedAudit.sql,/direct_links_prepared/);
assert.match(insertedAudit.sql,/json_object\('accept_url'/);
assert.equal(insertedAudit.params.at(-4),6,'Admin ID is recorded in the batch');
assert.equal(insertedAudit.params.at(-1),12,'Audit refers to the same appointment');
assert.equal(preparedData.data.lantikan.notif_hantar,1,
  'Preparing links must not change an existing delivery flag');

// Execute the captured D1 batch against SQLite so the audit SQL, bindings and
// token visibility within one transaction are verified rather than mocked.
const sqlDb=new DatabaseSync(':memory:');
sqlDb.exec(`
  CREATE TABLE lantikan_pengadil (id INTEGER PRIMARY KEY,jadual_id INTEGER,pengadil_id INTEGER,
    pengadil_luar_id INTEGER,jawatan TEXT,status TEXT,komen TEXT,notif_hantar INTEGER,
    tg_notif_hantar INTEGER,tarikh_notif TEXT,email_token TEXT,penilaian_token TEXT);
  CREATE TABLE jadual_perlawanan (id INTEGER PRIMARY KEY,kejohanan_id INTEGER,status TEXT);
  CREATE TABLE pengadil_luar (id INTEGER PRIMARY KEY,nama TEXT,emel TEXT,no_tel TEXT,
    telegram_chat_id INTEGER,tg_link_token TEXT);
  CREATE TABLE users (id INTEGER PRIMARY KEY,nama_penuh TEXT,email TEXT,no_telefon TEXT,
    telegram_chat_id INTEGER,tg_link_token TEXT);
  CREATE TABLE lantikan_audit_log (id INTEGER PRIMARY KEY,event_key TEXT,lantikan_id INTEGER,
    jadual_id INTEGER,kejohanan_id INTEGER,pengadil_id INTEGER,pengadil_luar_id INTEGER,
    jawatan TEXT,nama_pegawai TEXT,emel_pegawai TEXT,no_telefon_pegawai TEXT,
    event_type TEXT,channel TEXT,event_status TEXT,link_url TEXT,details_json TEXT,
    actor_type TEXT,actor_user_id INTEGER,ip_address TEXT,user_agent TEXT,created_at TEXT);
  INSERT INTO jadual_perlawanan VALUES (9,2,'Aktif');
  INSERT INTO pengadil_luar (id,nama,emel,no_tel) VALUES (3,'Pegawai A','a@example.test','0123456789');
  INSERT INTO lantikan_pengadil (id,jadual_id,pengadil_luar_id,jawatan,status,notif_hantar)
    VALUES (12,9,3,'Pengadil','Belum Jawab',0);
`);
const batchSql=[];
const sqlEnv={...env,DB:{
  prepare:(sql)=>({bind:(...params)=>({
    first:async()=>sqlDb.prepare(sql).get(...params)??null,
    all:async()=>({results:sqlDb.prepare(sql).all(...params)}),
    run:async()=>({meta:{changes:Number(sqlDb.prepare(sql).run(...params).changes)}}),
    sql,params,
  })}),
  batch:async(statements)=>{
    sqlDb.exec('BEGIN');
    try {
      const results=statements.map(({sql,params})=>{
        batchSql.push(sql);
        const info=sqlDb.prepare(sql).run(...params);
        return {meta:{changes:Number(info.changes)}};
      });
      sqlDb.exec('COMMIT');
      return results;
    } catch(error){sqlDb.exec('ROLLBACK');throw error;}
  },
}};
const sqlPrepared=await appointmentAudit(post({action:'prepare_links',lantikan_id:12}),sqlEnv);
assert.equal(sqlPrepared.status,200);
assert.equal(batchSql.length,4);
const sqlRow=sqlDb.prepare('SELECT * FROM lantikan_audit_log WHERE lantikan_id=12').get();
const sqlLinks=JSON.parse(sqlRow.details_json);
assert.equal(sqlLinks.accept_url,(await sqlPrepared.json()).data.links.accept_url);
assert.match(sqlLinks.telegram_link_url,/^https:\/\/t\.me\/refpahang_bot\?start=/);
assert.equal(sqlRow.actor_user_id,6);
assert.equal(sqlDb.prepare('SELECT notif_hantar FROM lantikan_pengadil WHERE id=12').get().notif_hantar,0);
const marked=await appointmentAudit(post({action:'mark_manual_delivery',lantikan_id:12}),sqlEnv);
assert.equal(marked.status,200);
assert.equal(sqlDb.prepare('SELECT notif_hantar FROM lantikan_pengadil WHERE id=12').get().notif_hantar,1);
const manualEvent=sqlDb.prepare("SELECT details_json,link_url FROM lantikan_audit_log WHERE event_type='manual_delivery_confirmed'").get();
assert.deepEqual(JSON.parse(manualEvent.details_json),{delivery_type:'appointment',deadline_started:true});
assert.match(manualEvent.link_url,/action=accept$/);
assert.equal((await appointmentAudit(post({action:'mark_manual_delivery',lantikan_id:12}),sqlEnv)).status,409,
  'The appointment reply deadline cannot be restarted');
sqlDb.exec("UPDATE lantikan_pengadil SET status='Diterima',jawatan='Penilai Pengadil',penilaian_token='ra-token' WHERE id=12");
assert.equal((await appointmentAudit(post({action:'mark_manual_delivery',lantikan_id:12,delivery_type:'ra_form'}),sqlEnv)).status,200);
const raEvent=sqlDb.prepare("SELECT details_json,link_url FROM lantikan_audit_log WHERE event_type='manual_delivery_confirmed' ORDER BY id DESC LIMIT 1").get();
assert.deepEqual(JSON.parse(raEvent.details_json),{delivery_type:'ra_form',deadline_started:false});
assert.match(raEvent.link_url,/penilaian-borang\.html\?token=ra-token$/);
assert.equal((await appointmentAudit(post({action:'mark_manual_delivery',lantikan_id:12,delivery_type:'telegram_link'}),sqlEnv)).status,200);
sqlDb.exec('UPDATE pengadil_luar SET telegram_chat_id=12345 WHERE id=3');
assert.equal((await appointmentAudit(post({action:'mark_manual_delivery',lantikan_id:12,delivery_type:'telegram_link'}),sqlEnv)).status,409);
assert.equal((await appointmentAudit(post({action:'mark_manual_delivery',lantikan_id:12,delivery_type:'wrong'}),sqlEnv)).status,400);
console.log('appointment audit: Admin GET, copy, prepare links, redaction and write gates passed');
