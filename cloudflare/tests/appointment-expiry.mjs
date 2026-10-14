import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import ts from 'typescript';

const source = readFileSync(new URL('../src/appointment-expiry.ts',import.meta.url),'utf8')
  .replace("import { recordExpiredAppointment } from './appointment-response-core';",
    `const recordExpiredAppointment = async (_env,id) => {
      globalThis.rejected.push(id); return {kind:'expired'};
    };`);
const compiled = ts.transpileModule(source,{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},
}).outputText;
const { processExpiredAppointments } = await import(`data:text/javascript,${encodeURIComponent(compiled)}`);

const db = new DatabaseSync(':memory:');
db.exec(`
  CREATE TABLE kejohanan(id INTEGER PRIMARY KEY,jenis_kejohanan TEXT);
  CREATE TABLE jadual_perlawanan(id INTEGER PRIMARY KEY,kejohanan_id INTEGER,tarikh TEXT,masa TEXT);
  CREATE TABLE lantikan_pengadil(id INTEGER PRIMARY KEY,jadual_id INTEGER,status TEXT,
    notif_hantar INTEGER,tarikh_notif TEXT);
  INSERT INTO kejohanan VALUES(1,'Liga'),(2,'Karnival');
  INSERT INTO jadual_perlawanan VALUES
    (1,2,'2099-12-01','18:00:00'),
    (2,2,'2026-10-01','10:00:00'),
    (3,1,'2099-12-01','18:00:00');
  INSERT INTO lantikan_pengadil VALUES
    (1,1,'Belum Jawab',1,'2026-10-01 09:00:00'),
    (2,1,'Belum Jawab',0,'2026-10-01 09:00:00'),
    (3,2,'Belum Jawab',1,'2026-10-01 09:00:00'),
    (4,1,'Diterima',1,'2026-10-01 09:00:00'),
    (5,3,'Belum Jawab',1,'2099-10-01 09:00:00');
`);
globalThis.rejected=[];
const env={
  APPOINTMENT_AUTO_REJECT_ENABLED:'0',STAGING_AUTH_ENABLED:'0',
  STAGING_WRITES_ENABLED:'0',APPOINTMENT_DELIVERY_ENABLED:'0',
  DB:{prepare:(sql)=>({bind:(...values)=>({all:async()=>({results:db.prepare(sql).all(...values)})})})},
};
assert.equal(await processExpiredAppointments(env),0);
assert.deepEqual(globalThis.rejected,[]);
Object.assign(env,{APPOINTMENT_AUTO_REJECT_ENABLED:'1',STAGING_AUTH_ENABLED:'1',
  STAGING_WRITES_ENABLED:'1',APPOINTMENT_DELIVERY_ENABLED:'1'});
assert.equal(await processExpiredAppointments(env),1);
assert.deepEqual(globalThis.rejected,[1],
  'Only notified, expired, unanswered appointments before kickoff are candidates');
console.log('appointment expiry: independent gate and SQL candidate filter passed');
