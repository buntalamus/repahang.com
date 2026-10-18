import assert from 'node:assert/strict';
import {bundle,openDatabase,sessionCookie} from './_harness.mjs';

const {appointments,schedule,scheduleReport}=await bundle(`
  export {appointments} from '../src/appointments';
  export {schedule} from '../src/schedule';
  export {scheduleReport} from '../src/schedule-report';
`);
const {db,DB,close}=openDatabase(['0001_worker_sessions','0002_appointment_outbox','0009_mysql_on_update_triggers',
  '0010_worker_write_guards','0020_match_team_regions','0022_district_appointments']);
const env={DB,BASE_URL:'https://refpahang.com',STAGING_AUTH_ENABLED:'1',STAGING_WRITES_ENABLED:'1',
  APPOINTMENT_DELIVERY_ENABLED:'1',EMAIL:{send:async()=>({messageId:'ok'})}};
const admin=db.prepare("SELECT id FROM users WHERE role='Admin' AND aktif=1 LIMIT 1").get();
const adminCookie=await sessionCookie(db,admin.id);
const AUTO='Ditolak automatik - tiada jawapan dalam tempoh';

/** Make one appointment overdue: notified long ago, match still in the future. */
function overdue() {
  const row=db.prepare(`SELECT lp.id,lp.jadual_id,lp.pengadil_id,jp.kejohanan_id FROM lantikan_pengadil lp
    JOIN jadual_perlawanan jp ON jp.id=lp.jadual_id JOIN users u ON u.id=lp.pengadil_id
    WHERE u.aktif=1 AND u.role='Pengadil' AND lp.status<>'Belum Jawab' ORDER BY lp.id DESC LIMIT 1`).get();
  db.prepare(`UPDATE lantikan_pengadil SET status='Belum Jawab',komen=NULL,notif_hantar=1,
    tarikh_notif='2026-01-01 08:00:00' WHERE id=?`).run(row.id);
  db.prepare("UPDATE jadual_perlawanan SET tarikh=date('now','+8 hours','+2 hours'),masa=time('now','+8 hours','+2 hours') WHERE id=?").run(row.jadual_id);
  return row;
}
const statusOf=(id)=>({...db.prepare('SELECT status,komen FROM lantikan_pengadil WHERE id=?').get(id)});

try {
  let row=overdue();
  const refereeCookie=await sessionCookie(db,row.pengadil_id);
  let response=await appointments(new Request('https://refpahang.com/api/tugasan.php',{headers:{Cookie:refereeCookie}}),env);
  assert.equal(response.status,200);
  assert.deepEqual(statusOf(row.id),{status:'Ditolak',komen:AUTO});

  row=overdue();
  response=await schedule(new Request(`https://refpahang.com/api/jadual-perlawanan.php?kejohanan_id=${row.kejohanan_id}`,
    {headers:{Cookie:adminCookie}}),env);
  assert.equal(response.status,200);
  assert.deepEqual(statusOf(row.id),{status:'Ditolak',komen:AUTO});

  row=overdue();
  response=await scheduleReport(new Request(`https://refpahang.com/api/jadual-lantikan-report.php?kejohanan_id=${row.kejohanan_id}`,
    {headers:{Cookie:adminCookie}}),env);
  assert.equal(response.status,200);
  assert.deepEqual(statusOf(row.id),{status:'Ditolak',komen:AUTO});

  // With the appointment switch off, reads stay side-effect free.
  row=overdue();
  await scheduleReport(new Request(`https://refpahang.com/api/jadual-lantikan-report.php?kejohanan_id=${row.kejohanan_id}`,
    {headers:{Cookie:adminCookie}}),{...env,APPOINTMENT_DELIVERY_ENABLED:'0'});
  assert.equal(statusOf(row.id).status,'Belum Jawab');
  console.log('auto-reject on reads: tugasan, jadual-perlawanan and jadual-lantikan-report expire overdue answers like PHP');
} finally {
  close();
}
