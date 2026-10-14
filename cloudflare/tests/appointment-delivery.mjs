import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import ts from 'typescript';

const path = new URL('../src/appointment-delivery.ts', import.meta.url);
const source = readFileSync(path, 'utf8').replace(
  "import { buildRefpahangEmail, sendRefpahangEmail } from '../mail';",
  `const buildRefpahangEmail = (_title, _name, paragraphs, action) =>
    ({ html: paragraphs.join(' '), text: paragraphs.join('\\n') + (action?.url || '') });
   const sendRefpahangEmail = async () => { throw new Error('Unexpected live email'); };`,
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const { processAppointmentDeliveries } = await import(`data:text/javascript,${encodeURIComponent(compiled)}`);

const db = new DatabaseSync(':memory:');
db.exec(`
  CREATE TABLE users(id INTEGER PRIMARY KEY,nama_penuh TEXT,email TEXT,telegram_chat_id INTEGER,
    no_telefon TEXT,daerah TEXT,negeri TEXT,persatuan_id INTEGER,role TEXT,aktif INTEGER);
  CREATE TABLE pengadil_luar(id INTEGER PRIMARY KEY,nama TEXT,emel TEXT,telegram_chat_id INTEGER,
    no_tel TEXT,daerah TEXT,negeri TEXT);
  CREATE TABLE kejohanan(id INTEGER PRIMARY KEY,nama TEXT,peringkat_kejohanan TEXT);
  CREATE TABLE jadual_perlawanan(id INTEGER PRIMARY KEY,kejohanan_id INTEGER,tarikh TEXT,masa TEXT,
    tempat TEXT,no_perlawanan TEXT,pasukan_home TEXT,pasukan_away TEXT);
  CREATE TABLE lantikan_pengadil(id INTEGER PRIMARY KEY,jadual_id INTEGER,pengadil_id INTEGER,
    pengadil_luar_id INTEGER,jawatan TEXT,status TEXT,penilaian_token TEXT);
  CREATE TABLE lantikan_audit_log(event_key TEXT PRIMARY KEY,nama_pegawai TEXT,jawatan TEXT,
    details_json TEXT);
  CREATE TABLE worker_appointment_outbox(event_key TEXT PRIMARY KEY,lantikan_id INTEGER,
    jadual_id INTEGER,response_status TEXT,completed_at TEXT);
  CREATE TABLE worker_appointment_deliveries(delivery_key TEXT PRIMARY KEY,event_key TEXT,
    kind TEXT,channel TEXT,recipient_user_id INTEGER,recipient_lantikan_id INTEGER,
    crew_key TEXT,status TEXT DEFAULT 'pending',attempts INTEGER DEFAULT 0,
    claimed_at TEXT,next_attempt_at TEXT,completed_at TEXT,last_error TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
  INSERT INTO users VALUES
    (1,'R','r@example.com',1001,'011','Bera','Pahang',10,'Pengadil',1),
    (2,'AR1','ar1@example.com',1002,'012','Bera','Pahang',10,'Pengadil',1),
    (3,'AR2','ar2@example.com',1003,'013','Bera','Pahang',10,'Pengadil',1),
    (4,'RA','ra@example.com',1004,'014','Bera','Pahang',10,'Penilai',1),
    (5,'Admin','admin@example.com',1005,'015','Kuantan','Pahang',NULL,'Admin',1),
    (6,'PP','pp@example.com',1006,'016','Bera','Pahang',10,'PP Daerah',1);
  INSERT INTO kejohanan VALUES(1,'Piala Pahang','Negeri');
  INSERT INTO jadual_perlawanan VALUES(1,1,'2026-12-01','18:00:00','Padang','001','A','B');
  INSERT INTO lantikan_pengadil VALUES
    (1,1,1,NULL,'Pengadil','Diterima',NULL),
    (2,1,2,NULL,'Penolong Pengadil 1','Diterima',NULL),
    (3,1,3,NULL,'Penolong Pengadil 2','Diterima',NULL),
    (4,1,4,NULL,'Penilai Pengadil','Diterima','ra-token');
  INSERT INTO lantikan_audit_log VALUES
    ('event-kup','AR2','Penolong Pengadil 2','{"comment":""}'),
    ('event-ra','RA','Penilai Pengadil','{"comment":""}');
  INSERT INTO worker_appointment_outbox VALUES
    ('event-kup',3,1,'Diterima',NULL),('event-ra',4,1,'Diterima',NULL);
  INSERT INTO worker_appointment_deliveries
    (delivery_key,event_key,kind,channel,recipient_user_id,recipient_lantikan_id,crew_key)
  VALUES
    ('kup-1','event-kup','kup_crew','email',NULL,1,'Pengadil:1|Penolong Pengadil 1:2|Penolong Pengadil 2:3'),
    ('kup-2','event-kup','kup_crew','telegram',NULL,2,'Pengadil:1|Penolong Pengadil 1:2|Penolong Pengadil 2:3'),
    ('admin','event-kup','admin_response','telegram',5,NULL,NULL),
    ('pp','event-kup','pp_response','telegram',6,NULL,NULL),
    ('ra-email','event-ra','ra_form','email',NULL,4,NULL),
    ('ra-tg','event-ra','ra_form','telegram',NULL,4,NULL);
`);

class Statement {
  constructor(sql, values = []) { this.sql = sql; this.values = values; }
  bind(...values) { return new Statement(this.sql, values); }
  first() { return db.prepare(this.sql).get(...this.values) ?? null; }
  all() { return { results: db.prepare(this.sql).all(...this.values) }; }
  run() { const result = db.prepare(this.sql).run(...this.values); return { meta: { changes: result.changes } }; }
}
const env = {
  BASE_URL: 'https://staging.example.test',
  STAGING_AUTH_ENABLED: '0', STAGING_WRITES_ENABLED: '0', APPOINTMENT_DELIVERY_ENABLED: '0',
  DB: {
    prepare: (sql) => new Statement(sql),
    batch: async (statements) => {
      db.exec('BEGIN');
      try {
        const result = statements.map((statement) => statement.run());
        db.exec('COMMIT');
        return result;
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
  },
};
const scalar = (sql) => db.prepare(sql).get();
const sent = [];
const senders = {
  email: async (_env, to, _name, _subject, _html, text) => sent.push({ channel: 'email', to, text }),
  telegram: async (_env, chatId, html, url) => sent.push({ channel: 'telegram', to: chatId, html, url }),
};

assert.equal((await processAppointmentDeliveries(env,20,senders)).processed,0);
env.STAGING_AUTH_ENABLED = '1'; env.STAGING_WRITES_ENABLED = '1';
assert.equal((await processAppointmentDeliveries(env,20,senders)).processed,0,
  'The delivery flag must remain an independent gate');
env.APPOINTMENT_DELIVERY_ENABLED = '1';
const result = await processAppointmentDeliveries(env,20,senders);
assert.deepEqual(result,{ processed:6, sent:6, failed:0, skipped:0 });
assert.equal(sent.length,6);
assert.match(sent.find((item) => item.to === 'r@example.com').text,/Penolong Pengadil 2: AR2/);
assert.match(sent.find((item) => item.to === 'ra@example.com').text,/ra-token/);
assert.equal(sent.find((item) => item.to === 1004).url,
  'https://staging.example.test/penilaian-borang.html?token=ra-token');
assert.equal(scalar('SELECT count(*) AS n FROM worker_appointment_outbox WHERE completed_at IS NOT NULL').n,2);
assert.equal((await processAppointmentDeliveries(env,20,senders)).processed,0,
  'Completed channels must never be sent a second time');

// Failed transport keeps one channel pending and schedules a retry.
db.exec(`
  INSERT INTO worker_appointment_outbox VALUES('event-retry',4,1,'Diterima',NULL);
  INSERT INTO lantikan_audit_log VALUES('event-retry','RA','Penilai Pengadil','{}');
  INSERT INTO worker_appointment_deliveries
    (delivery_key,event_key,kind,channel,recipient_lantikan_id)
  VALUES('retry-ra','event-retry','ra_form','email',4);
`);
const failure = await processAppointmentDeliveries(env,20,{
  ...senders, email: async () => { throw new Error('provider unavailable'); },
});
assert.deepEqual(failure,{ processed:1, sent:0, failed:1, skipped:0 });
assert.equal(scalar("SELECT attempts AS n FROM worker_appointment_deliveries WHERE delivery_key='retry-ra'").n,1);
assert.equal(scalar("SELECT status AS value FROM worker_appointment_deliveries WHERE delivery_key='retry-ra'").value,'pending');
assert.equal(scalar("SELECT completed_at AS value FROM worker_appointment_outbox WHERE event_key='event-retry'").value,null);
assert.equal((await processAppointmentDeliveries(env,20,senders)).processed,0,
  'Backoff must prevent an immediate duplicate attempt');
db.exec("UPDATE worker_appointment_deliveries SET next_attempt_at=NULL WHERE delivery_key='retry-ra'");
assert.deepEqual(await processAppointmentDeliveries(env,20,senders),
  { processed:1, sent:1, failed:0, skipped:0 });
assert.equal(scalar("SELECT attempts AS n FROM worker_appointment_deliveries WHERE delivery_key='retry-ra'").n,2);

// A stale contact list is suppressed when the crew changes before dispatch.
db.exec(`
  INSERT INTO worker_appointment_outbox VALUES('event-stale',3,1,'Diterima',NULL);
  INSERT INTO lantikan_audit_log VALUES('event-stale','AR2','Penolong Pengadil 2','{}');
  INSERT INTO worker_appointment_deliveries
    (delivery_key,event_key,kind,channel,recipient_lantikan_id,crew_key)
  VALUES('stale','event-stale','kup_crew','email',1,'Pengadil:1|Penolong Pengadil 1:2|Penolong Pengadil 2:99');
`);
assert.deepEqual(await processAppointmentDeliveries(env,20,senders),
  { processed:1, sent:0, failed:0, skipped:1 });
assert.equal(sent.length,7);

// District officers cannot receive a response after their district changes.
db.exec(`
  UPDATE users SET persatuan_id=11 WHERE id=6;
  INSERT INTO worker_appointment_outbox VALUES('event-district',3,1,'Diterima',NULL);
  INSERT INTO lantikan_audit_log VALUES('event-district','AR2','Penolong Pengadil 2','{}');
  INSERT INTO worker_appointment_deliveries
    (delivery_key,event_key,kind,channel,recipient_user_id)
  VALUES('moved-pp','event-district','pp_response','telegram',6);
`);
assert.deepEqual(await processAppointmentDeliveries(env,20,senders),
  { processed:1, sent:0, failed:0, skipped:1 });
assert.equal(sent.length,7);

console.log('appointment delivery: gate, channel jobs, retry, stale crew and district guard passed');
