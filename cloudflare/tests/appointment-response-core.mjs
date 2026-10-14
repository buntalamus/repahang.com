import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const source = readFileSync(fileURLToPath(new URL('../src/appointment-response-core.ts', import.meta.url)), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const { recordAppointmentReply } = await import(`data:text/javascript,${encodeURIComponent(compiled)}`);
const db = new DatabaseSync(':memory:');
db.exec(`
  CREATE TABLE users(id INTEGER PRIMARY KEY,nama_penuh TEXT,email TEXT,no_telefon TEXT,
    persatuan_id INTEGER,role TEXT,aktif INTEGER,telegram_chat_id INTEGER);
  CREATE TABLE pengadil_luar(id INTEGER PRIMARY KEY,nama TEXT,emel TEXT,no_tel TEXT,telegram_chat_id INTEGER);
  CREATE TABLE kejohanan(id INTEGER PRIMARY KEY,nama TEXT,jenis_kejohanan TEXT);
  CREATE TABLE jadual_perlawanan(id INTEGER PRIMARY KEY,kejohanan_id INTEGER,tarikh TEXT,
    masa TEXT,kategori TEXT,peringkat TEXT,tempat TEXT,pasukan_home TEXT,pasukan_away TEXT);
  CREATE TABLE lantikan_pengadil(id INTEGER PRIMARY KEY,jadual_id INTEGER,pengadil_id INTEGER,
    pengadil_luar_id INTEGER,jawatan TEXT,status TEXT,komen TEXT,tarikh_jawab TEXT,
    status_dikemaskini_at TEXT,notif_hantar INTEGER,tarikh_notif TEXT,tg_token TEXT,
    email_token TEXT,penilaian_token TEXT);
  CREATE TABLE lantikan_audit_log(id INTEGER PRIMARY KEY,event_key TEXT UNIQUE,lantikan_id INTEGER,
    jadual_id INTEGER,kejohanan_id INTEGER,pengadil_id INTEGER,pengadil_luar_id INTEGER,
    jawatan TEXT,nama_pegawai TEXT,emel_pegawai TEXT,no_telefon_pegawai TEXT,
    event_type TEXT,channel TEXT,event_status TEXT,details_json TEXT,actor_type TEXT,
    actor_user_id INTEGER,created_at TEXT);
  CREATE TABLE perlawanan(id INTEGER PRIMARY KEY,user_id INTEGER,lantikan_id INTEGER UNIQUE,
    tarikh TEXT,masa TEXT,jenis TEXT,nama_kejohanan TEXT,tempat TEXT,home_team TEXT,
    away_team TEXT,jawatan TEXT,head_referee_id INTEGER,assistant_referee_1_id INTEGER,
    assistant_referee_2_id INTEGER,fourth_official_id INTEGER,status_pp TEXT,created_at TEXT,
    skor_ft_home INTEGER);
  CREATE TABLE notifications(id INTEGER PRIMARY KEY,user_id INTEGER,type TEXT,subject TEXT,
    message TEXT,created_at TEXT);
  INSERT INTO users VALUES
    (1,'Pengadil Utama','r@example.com','011',10,'Pengadil',1,1001),
    (2,'Penolong Satu','ar1@example.com','012',10,'Pengadil',1,1002),
    (3,'Penolong Dua','ar2@example.com','013',10,'Pengadil',1,1003),
    (4,'Penilai','ra@example.com','014',10,'Penilai',1,1004),
    (5,'Admin','admin@example.com','015',NULL,'Admin',1,1005),
    (6,'PP','pp@example.com','016',10,'PP Daerah',1,1006);
  INSERT INTO kejohanan VALUES(1,'Kejohanan Pahang','Liga');
  INSERT INTO pengadil_luar VALUES(10,'Pengadil Luar','luar@example.com','017',1010);
  INSERT INTO jadual_perlawanan VALUES
    (1,1,'2026-12-01','18:00:00','Dewasa','Akhir','Padang Pahang','A','B'),
    (2,1,'2026-12-01','20:00:00','Dewasa','Akhir','Padang Pahang','C','D');
  INSERT INTO lantikan_pengadil VALUES
    (1,1,1,NULL,'Pengadil','Belum Jawab',NULL,NULL,NULL,0,NULL,NULL,'email-1',NULL),
    (2,1,2,NULL,'Penolong Pengadil 1','Diterima',NULL,NULL,NULL,0,NULL,NULL,NULL,NULL),
    (3,1,3,NULL,'Penolong Pengadil 2','Belum Jawab',NULL,NULL,NULL,0,NULL,NULL,'email-3',NULL),
    (4,1,4,NULL,'Penilai Pengadil','Belum Jawab',NULL,NULL,NULL,0,NULL,NULL,'email-4',NULL),
    (5,2,1,NULL,'Pengadil','Belum Jawab',NULL,NULL,NULL,1,'2026-10-01 09:00:00',NULL,'email-5',NULL),
    (6,2,3,NULL,'Penolong Pengadil 2','Belum Jawab',NULL,NULL,NULL,0,NULL,'tg-6','email-6',NULL),
    (7,2,NULL,10,'Pegawai ke4','Belum Jawab',NULL,NULL,NULL,0,NULL,NULL,'email-7',NULL);
  INSERT INTO perlawanan(user_id,lantikan_id,tarikh,status_pp,created_at,skor_ft_home)
    VALUES(2,2,'2026-12-01','Disahkan','2026-10-01 10:00:00',4);
`);

class Statement {
  constructor(sql, values = []) { this.sql = sql; this.values = values; }
  bind(...values) { return new Statement(this.sql, values); }
  first() { return db.prepare(this.sql).get(...this.values) ?? null; }
  run() {
    const result = db.prepare(this.sql).run(...this.values);
    return { meta: { changes: result.changes } };
  }
}
let beforeBatch = null;
const env = { DB: {
  prepare: (sql) => new Statement(sql),
  batch: async (statements) => {
    if (beforeBatch) { const callback = beforeBatch; beforeBatch = null; callback(); }
    db.exec('BEGIN');
    try {
      const results = statements.map((statement) => statement.run());
      db.exec('COMMIT');
      return results;
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  },
} };
const scalar = (sql) => db.prepare(sql).get();

assert.deepEqual(await recordAppointmentReply(env,1,'accept','',{kind:'user',value:99},99),
  { kind:'not_found' });
const accepted = await recordAppointmentReply(env,1,'accept','',{kind:'user',value:1},1);
assert.equal(accepted.kind,'answered');
assert.equal(accepted.status,'Diterima');
assert.equal(scalar('SELECT COUNT(*) AS n FROM perlawanan WHERE lantikan_id IN (1,2)').n,2);
assert.equal(scalar('SELECT skor_ft_home AS n FROM perlawanan WHERE lantikan_id=2').n,4,
  'Existing match scores must survive crew refresh');
assert.equal(scalar('SELECT head_referee_id AS n FROM perlawanan WHERE lantikan_id=2').n,1);
assert.deepEqual(await recordAppointmentReply(env,1,'accept','',{kind:'user',value:1},1),
  { kind:'already_answered' });
assert.equal(scalar('SELECT COUNT(*) AS n FROM lantikan_audit_log WHERE lantikan_id=1').n,1);
assert.equal(scalar('SELECT COUNT(*) AS n FROM notifications WHERE user_id=1').n,1);

const rejected = await recordAppointmentReply(env,3,'reject','Sakit',{kind:'email',value:'email-3'});
assert.equal(rejected.status,'Ditolak');
assert.equal(scalar('SELECT COUNT(*) AS n FROM perlawanan WHERE lantikan_id=3').n,0);
assert.equal(scalar('SELECT email_token AS value FROM lantikan_pengadil WHERE id=3').value,null);
const ra = await recordAppointmentReply(env,4,'accept','',{kind:'user',value:4},4);
assert.equal(ra.status,'Diterima');
assert.equal(scalar('SELECT length(penilaian_token) AS n FROM lantikan_pengadil WHERE id=4').n,64);
assert.equal(scalar('SELECT COUNT(*) AS n FROM perlawanan WHERE lantikan_id=4').n,0,
  'RA is not KUP match history');

const adminCount = scalar('SELECT COUNT(*) AS n FROM notifications WHERE user_id=5').n;
const external = await recordAppointmentReply(env,7,'reject','',{kind:'email',value:'email-7'});
assert.equal(external.status,'Ditolak');
assert.equal(scalar('SELECT COUNT(*) AS n FROM notifications WHERE user_id=5').n,adminCount+1,
  'External official responses still notify Admin');

const expired = await recordAppointmentReply(env,5,'accept','',{kind:'user',value:1},1);
assert.equal(expired.kind,'expired');
assert.equal(scalar('SELECT status AS value FROM lantikan_pengadil WHERE id=5').value,'Ditolak');
assert.equal(scalar('SELECT tarikh_jawab AS value FROM lantikan_pengadil WHERE id=5').value,
  '2026-10-03 09:00:00');
assert.equal(scalar('SELECT event_type AS value FROM lantikan_audit_log WHERE lantikan_id=5').value,
  'appointment_auto_rejected');

assert.deepEqual(await recordAppointmentReply(env,6,'accept','',
  {kind:'telegram',value:'tg-6',chatId:9999}), {kind:'not_found'},
  'A leaked callback token must not authorize a different Telegram account');

beforeBatch = () => db.exec("UPDATE lantikan_pengadil SET status='Dibatalkan' WHERE id=6");
assert.deepEqual(await recordAppointmentReply(env,6,'accept','',{kind:'user',value:3},3),
  { kind:'already_answered' }, 'Concurrent status changes cannot create history');
assert.equal(scalar('SELECT COUNT(*) AS n FROM lantikan_audit_log WHERE lantikan_id=6').n,0);
db.exec("UPDATE lantikan_pengadil SET status='Belum Jawab' WHERE id=6");
beforeBatch = () => db.exec("UPDATE lantikan_pengadil SET tarikh_notif='2026-10-10 12:00:00' WHERE id=6");
assert.deepEqual(await recordAppointmentReply(env,6,'accept','',{kind:'user',value:3},3),
  { kind:'already_answered' }, 'A changed notification window cannot use a stale decision');
db.exec('UPDATE lantikan_pengadil SET tarikh_notif=NULL WHERE id=6');

db.exec(`CREATE TRIGGER fail_notification BEFORE INSERT ON notifications
  WHEN NEW.user_id=3 BEGIN SELECT RAISE(ABORT,'test rollback'); END`);
await assert.rejects(recordAppointmentReply(env,6,'accept','',{kind:'user',value:3},3),
  /test rollback/);
assert.equal(scalar('SELECT status AS value FROM lantikan_pengadil WHERE id=6').value,'Belum Jawab');
assert.equal(scalar('SELECT COUNT(*) AS n FROM lantikan_audit_log WHERE lantikan_id=6').n,0);
assert.equal(scalar('SELECT COUNT(*) AS n FROM perlawanan WHERE lantikan_id=6').n,0);
console.log('appointment response core: ownership, Telegram chat, acceptance, history, duplicate, RA, expiry, rollback passed');
