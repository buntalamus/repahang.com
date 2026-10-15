import type {Env} from './types';

type State={approval_id:number;report_id:number;match_id:number;
  approval_status:string;report_status:string};
const roles="'Pengadil','Penolong Pengadil 1','Penolong Pengadil 2','Pegawai ke4'";

/** Reasoned Admin override, audit and KUP notification queue in one D1 batch. */
export async function overrideAdminReport(env:Env,reportId:number,adminId:number,
  reason:string,comment:string,request:Request):Promise<'confirmed'|'already_processed'> {
  const state=await env.DB.prepare(`SELECT a.id AS approval_id,r.id AS report_id,
    r.jadual_id AS match_id,a.status AS approval_status,r.status AS report_status
    FROM laporan_pengesahan_pengerusi a JOIN laporan_penilaian r ON r.id=a.laporan_id
    WHERE r.id=? LIMIT 1`).bind(reportId).first<State>();
  if (!state || state.approval_status!=='Menunggu' || state.report_status!=='Dihantar') {
    return 'already_processed';
  }
  const {approval_id:approvalId,match_id:matchId}=state;
  const now="datetime('now','+8 hours')";
  const valid=`a.id=? AND a.laporan_id=? AND a.status='Menunggu'
    AND r.id=a.laporan_id AND r.status='Dihantar' AND r.jadual_id=?
    AND EXISTS(SELECT 1 FROM lantikan_pengadil ra WHERE ra.id=r.lantikan_id
      AND ra.jadual_id=r.jadual_id AND ra.jawatan='Penilai Pengadil'
      AND ra.status='Diterima')
    AND (SELECT count(*) FROM laporan_penilaian_pegawai p WHERE p.laporan_id=r.id)
      BETWEEN 3 AND 4
    AND NOT EXISTS(SELECT 1 FROM laporan_penilaian_pegawai p
      LEFT JOIN lantikan_pengadil lp ON lp.id=p.lantikan_pengadil_id
      WHERE p.laporan_id=r.id AND (p.markah IS NULL OR trim(p.markah)=''
        OR lp.id IS NULL OR lp.jadual_id<>r.jadual_id OR lp.status<>'Diterima'
        OR lp.jawatan<>p.jawatan OR lp.jawatan NOT IN (${roles})))
    AND (SELECT count(DISTINCT p.jawatan) FROM laporan_penilaian_pegawai p
      WHERE p.laporan_id=r.id)=(SELECT count(*) FROM laporan_penilaian_pegawai p
        WHERE p.laporan_id=r.id)
    AND EXISTS(SELECT 1 FROM laporan_penilaian_pegawai p WHERE p.laporan_id=r.id
      AND p.jawatan='Pengadil')
    AND EXISTS(SELECT 1 FROM laporan_penilaian_pegawai p WHERE p.laporan_id=r.id
      AND p.jawatan='Penolong Pengadil 1')
    AND EXISTS(SELECT 1 FROM laporan_penilaian_pegawai p WHERE p.laporan_id=r.id
      AND p.jawatan='Penolong Pengadil 2')`;
  const active=`EXISTS(SELECT 1 FROM worker_report_confirmations c
    WHERE c.approval_id=? AND c.report_id=? AND c.source='admin')`;
  const newToken=Array.from(crypto.getRandomValues(new Uint8Array(32)),
    (byte)=>byte.toString(16).padStart(2,'0')).join('');
  const ip=request.headers.get('CF-Connecting-IP')?.slice(0,45)??null;
  const agent=request.headers.get('User-Agent')?.slice(0,255)??null;
  const result=await env.DB.batch([
    env.DB.prepare(`INSERT INTO worker_report_confirmations(approval_id,report_id,source)
      SELECT a.id,r.id,'admin' FROM laporan_pengesahan_pengerusi a
      JOIN laporan_penilaian r ON r.id=a.laporan_id WHERE ${valid}
      AND NOT EXISTS(SELECT 1 FROM worker_report_confirmations c WHERE c.approval_id=a.id)`)
      .bind(approvalId,reportId,matchId),
    env.DB.prepare(`UPDATE laporan_pengesahan_pengerusi
      SET status='Override Admin',admin_override_user_id=?,alasan_override=?,
        catatan_pengerusi=?,tarikh_sahkan=${now},updated_at=${now}
      WHERE id=? AND status='Menunggu' AND ${active}`)
      .bind(adminId,reason,comment,approvalId,approvalId,reportId),
    env.DB.prepare(`UPDATE laporan_penilaian SET status='Disahkan',
      catatan_admin=?,tarikh_sahkan=${now},updated_at=${now}
      WHERE id=? AND status='Dihantar' AND ${active}`)
      .bind(comment,reportId,approvalId,reportId),
    env.DB.prepare(`UPDATE jadual_perlawanan SET status='Selesai'
      WHERE id=? AND ${active}`).bind(matchId,approvalId,reportId),
    env.DB.prepare(`UPDATE lantikan_pengadil
      SET penilaian_token=COALESCE(NULLIF(penilaian_token,''),?)
      WHERE id=(SELECT lantikan_id FROM laporan_penilaian WHERE id=?)
        AND jawatan='Penilai Pengadil' AND status='Diterima' AND ${active}`)
      .bind(newToken,reportId,approvalId,reportId),
    env.DB.prepare(`INSERT INTO laporan_pengesahan_audit
      (laporan_pengesahan_id,laporan_id,event_type,channel,event_status,
       actor_type,actor_user_id,details_json,ip_address,user_agent,created_at)
      SELECT id,laporan_id,'report_admin_override','admin','success',
        'admin',?, ?,?,?,${now} FROM laporan_pengesahan_pengerusi
      WHERE id=? AND status='Override Admin' AND ${active}`)
      .bind(adminId,JSON.stringify({reason,comment}),ip,agent,approvalId,approvalId,reportId),
    env.DB.prepare(`INSERT INTO worker_report_deliveries
      (delivery_key,approval_id,report_id,recipient_lantikan_id,channel)
      SELECT 'report:'||?||':'||p.lantikan_pengadil_id||':'||channels.channel,
        ?,?,p.lantikan_pengadil_id,channels.channel
      FROM laporan_penilaian_pegawai p JOIN lantikan_pengadil lp
        ON lp.id=p.lantikan_pengadil_id
      CROSS JOIN (SELECT 'email' AS channel UNION ALL SELECT 'telegram') channels
      WHERE p.laporan_id=? AND lp.jadual_id=? AND lp.status='Diterima'
        AND lp.jawatan IN (${roles}) AND ${active}`)
      .bind(approvalId,approvalId,reportId,reportId,matchId,approvalId,reportId),
    env.DB.prepare(`UPDATE worker_report_confirmations SET integrity_checked=CASE WHEN
      source='admin' AND (SELECT status FROM laporan_pengesahan_pengerusi
        WHERE id=?)='Override Admin'
      AND (SELECT admin_override_user_id FROM laporan_pengesahan_pengerusi
        WHERE id=?)=?
      AND (SELECT status FROM laporan_penilaian WHERE id=?)='Disahkan'
      AND (SELECT status FROM jadual_perlawanan WHERE id=?)='Selesai'
      AND (SELECT length(ra.penilaian_token) FROM laporan_penilaian r
        JOIN lantikan_pengadil ra ON ra.id=r.lantikan_id WHERE r.id=?)>0
      AND (SELECT count(*) FROM laporan_pengesahan_audit
        WHERE laporan_pengesahan_id=? AND laporan_id=?
          AND event_type='report_admin_override' AND actor_user_id=?)>=1
      AND (SELECT count(*) FROM worker_report_deliveries WHERE approval_id=?)
        =2*(SELECT count(*) FROM laporan_penilaian_pegawai WHERE laporan_id=?)
      THEN 1 ELSE -1 END WHERE approval_id=? AND report_id=? AND source='admin'`)
      .bind(approvalId,approvalId,adminId,reportId,matchId,reportId,
        approvalId,reportId,adminId,approvalId,reportId,approvalId,reportId),
  ]);
  if (result[0].meta.changes!==1) return 'already_processed';
  if (result[1].meta.changes!==1 || result[2].meta.changes!==1 ||
      result[5].meta.changes!==1 || result[6].meta.changes<6 ||
      result[7].meta.changes!==1) {
    throw new Error('Incomplete Admin report override transaction');
  }
  return 'confirmed';
}
