import type {Env} from './types';

export type ConfirmationResult='confirmed'|'already_processed'|'invalid';

const crewRoles="'Pengadil','Penolong Pengadil 1','Penolong Pengadil 2','Pegawai ke4'";

/** Atomic state change, audit and Worker-only delivery rows. No network I/O. */
export async function confirmChairReport(env:Env,token:string,comment:string,
  request:Request):Promise<ConfirmationResult> {
  const state=await env.DB.prepare(`SELECT a.id,a.laporan_id,r.jadual_id,a.status,r.status AS laporan_status
    FROM laporan_pengesahan_pengerusi a JOIN laporan_penilaian r ON r.id=a.laporan_id
    WHERE a.approval_token=? LIMIT 1`).bind(token).first<{
      id:number;laporan_id:number;jadual_id:number;status:string;laporan_status:string;
    }>();
  if (!state) return 'invalid';
  if (state.status!=='Menunggu' || state.laporan_status!=='Dihantar') return 'already_processed';
  const {id,laporan_id:reportId,jadual_id:matchId}=state;
  const now="datetime('now','+8 hours')";
  const valid=`a.id=? AND a.approval_token=? AND a.status='Menunggu'
    AND r.id=? AND r.status='Dihantar' AND r.jadual_id=?
    AND EXISTS (SELECT 1 FROM lantikan_pengadil ra WHERE ra.id=r.lantikan_id
      AND ra.jadual_id=r.jadual_id AND ra.jawatan='Penilai Pengadil'
      AND ra.status='Diterima')
    AND (SELECT count(*) FROM laporan_penilaian_pegawai p
      JOIN lantikan_pengadil lp ON lp.id=p.lantikan_pengadil_id
      WHERE p.laporan_id=r.id AND lp.jadual_id=r.jadual_id
        AND lp.status='Diterima' AND lp.jawatan IN (${crewRoles})) BETWEEN 3 AND 4
    AND (SELECT count(DISTINCT lp.jawatan) FROM laporan_penilaian_pegawai p
      JOIN lantikan_pengadil lp ON lp.id=p.lantikan_pengadil_id
      WHERE p.laporan_id=r.id AND lp.jadual_id=r.jadual_id
        AND lp.status='Diterima' AND lp.jawatan IN (${crewRoles}))
      = (SELECT count(*) FROM laporan_penilaian_pegawai WHERE laporan_id=r.id)
    AND EXISTS (SELECT 1 FROM laporan_penilaian_pegawai p JOIN lantikan_pengadil lp
      ON lp.id=p.lantikan_pengadil_id WHERE p.laporan_id=r.id AND lp.jawatan='Pengadil')
    AND EXISTS (SELECT 1 FROM laporan_penilaian_pegawai p JOIN lantikan_pengadil lp
      ON lp.id=p.lantikan_pengadil_id WHERE p.laporan_id=r.id AND lp.jawatan='Penolong Pengadil 1')
    AND EXISTS (SELECT 1 FROM laporan_penilaian_pegawai p JOIN lantikan_pengadil lp
      ON lp.id=p.lantikan_pengadil_id WHERE p.laporan_id=r.id AND lp.jawatan='Penolong Pengadil 2')`;
  const active=`EXISTS(SELECT 1 FROM worker_report_confirmations c
    WHERE c.approval_id=? AND c.report_id=?)`;
  const random=Array.from(crypto.getRandomValues(new Uint8Array(32)),
    (byte)=>byte.toString(16).padStart(2,'0')).join('');
  const actor=request.headers.get('User-Agent')?.slice(0,255) ?? null;
  const ip=request.headers.get('CF-Connecting-IP')?.slice(0,45) ?? null;
  const result=await env.DB.batch([
    env.DB.prepare(`INSERT INTO worker_report_confirmations(approval_id,report_id)
      SELECT a.id,r.id FROM laporan_pengesahan_pengerusi a
      JOIN laporan_penilaian r ON r.id=a.laporan_id
      WHERE ${valid} AND NOT EXISTS
        (SELECT 1 FROM worker_report_confirmations WHERE approval_id=a.id)`)
      .bind(id,token,reportId,matchId),
    env.DB.prepare(`UPDATE laporan_pengesahan_pengerusi SET status='Disahkan',
      catatan_pengerusi=?,tarikh_sahkan=${now},updated_at=${now}
      WHERE id=? AND approval_token=? AND status='Menunggu' AND ${active}`)
      .bind(comment,id,token,id,reportId),
    env.DB.prepare(`UPDATE laporan_penilaian SET status='Disahkan',catatan_admin=?,
      tarikh_sahkan=${now},updated_at=${now}
      WHERE id=? AND status='Dihantar' AND ${active}`)
      .bind(comment,reportId,id,reportId),
    env.DB.prepare(`UPDATE jadual_perlawanan SET status='Selesai'
      WHERE id=? AND ${active}`).bind(matchId,id,reportId),
    env.DB.prepare(`UPDATE lantikan_pengadil SET penilaian_token=COALESCE(NULLIF(penilaian_token,''),?)
      WHERE id=(SELECT lantikan_id FROM laporan_penilaian WHERE id=?)
        AND jawatan='Penilai Pengadil' AND status='Diterima' AND ${active}`)
      .bind(random,reportId,id,reportId),
    env.DB.prepare(`INSERT INTO laporan_pengesahan_audit
      (laporan_pengesahan_id,laporan_id,event_type,channel,event_status,actor_type,
       actor_user_id,actor_luar_id,link_url,details_json,ip_address,user_agent,created_at)
      SELECT a.id,a.laporan_id,'report_confirmed','token','success',
        CASE WHEN a.pengesah_luar_id IS NOT NULL THEN 'pengerusi_luar'
          ELSE 'pengerusi_berdaftar' END,a.pengesah_user_id,a.pengesah_luar_id,
        NULL,?, ?,?,${now}
      FROM laporan_pengesahan_pengerusi a WHERE a.id=? AND a.status='Disahkan'
        AND ${active}`)
      .bind(JSON.stringify({comment}),ip,actor,id,id,reportId),
    env.DB.prepare(`INSERT INTO worker_report_deliveries
      (delivery_key,approval_id,report_id,recipient_lantikan_id,channel)
      SELECT 'report:'||?||':'||p.lantikan_pengadil_id||':'||channels.channel,
        ?,?,p.lantikan_pengadil_id,channels.channel
      FROM laporan_penilaian_pegawai p JOIN lantikan_pengadil lp
        ON lp.id=p.lantikan_pengadil_id
      CROSS JOIN (SELECT 'email' AS channel UNION ALL SELECT 'telegram') channels
      WHERE p.laporan_id=? AND lp.jadual_id=? AND lp.status='Diterima'
        AND lp.jawatan IN (${crewRoles}) AND ${active}`)
      .bind(id,id,reportId,reportId,matchId,id,reportId),
    // A failed invariant causes a CHECK error and rolls back the whole D1 batch.
    env.DB.prepare(`UPDATE worker_report_confirmations SET integrity_checked=CASE WHEN
      (SELECT status FROM laporan_pengesahan_pengerusi WHERE id=?)='Disahkan'
      AND (SELECT status FROM laporan_penilaian WHERE id=?)='Disahkan'
      AND (SELECT status FROM jadual_perlawanan WHERE id=?)='Selesai'
      AND (SELECT length(ra.penilaian_token) FROM laporan_penilaian r
        JOIN lantikan_pengadil ra ON ra.id=r.lantikan_id WHERE r.id=?)>0
      AND (SELECT count(*) FROM laporan_pengesahan_audit
        WHERE laporan_pengesahan_id=? AND laporan_id=?
          AND event_type='report_confirmed' AND channel='token')>=1
      AND (SELECT count(*) FROM worker_report_deliveries WHERE approval_id=?)
        = 2*(SELECT count(*) FROM laporan_penilaian_pegawai WHERE laporan_id=?)
      THEN 1 ELSE -1 END WHERE approval_id=? AND report_id=?`)
      .bind(id,reportId,matchId,reportId,id,reportId,id,reportId,id,reportId),
  ]);
  if (result[0].meta.changes!==1) return 'already_processed';
  if (result[1].meta.changes!==1 || result[2].meta.changes!==1 ||
      result[5].meta.changes!==1 || result[6].meta.changes<6 ||
      result[7].meta.changes!==1) {
    throw new Error('Incomplete chair confirmation transaction');
  }
  return 'confirmed';
}
