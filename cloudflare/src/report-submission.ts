import {currentUser,json} from './auth';
import {boundedJson} from './request';
import {overrideAdminReport} from './report-admin-override';
import {retryChairNotification} from './chair-dispatch';
import type {Env} from './types';

type Report={id:number;status:string;penilai_id:number|null;jadual_id:number;
  lantikan_id:number;penilaian_token:string|null};
type Approval={id:number;status:string;configured:number;email_sent_at:string|null;
  telegram_sent_at:string|null;pengesah_nama:string|null};

function idOf(value:unknown):number|null {
  if (typeof value!=='number' && typeof value!=='string') return null;
  const raw=String(value);
  const id=Number(raw);
  return /^[1-9]\d*$/.test(raw) && Number.isSafeInteger(id) ? id : null;
}

/** Submit an immutable RA draft and prepare chair/Admin work in one D1 batch. */
export async function submitAssessment(env:Env,reportId:number,userId:number|null,
  token:string|null=null):Promise<Response> {
  const report=await env.DB.prepare(`SELECT r.id,r.status,r.penilai_id,r.jadual_id,
    r.lantikan_id,ra.penilaian_token FROM laporan_penilaian r
    JOIN lantikan_pengadil ra ON ra.id=r.lantikan_id WHERE r.id=? LIMIT 1`)
    .bind(reportId).first<Report>();
  if (!report || report.status!=='Draf' ||
      (userId!==null ? report.penilai_id!==userId :
        !token || !/^[a-fA-F0-9]{64}$/.test(token) || report.penilaian_token!==token)) {
    return json({error:true,message:'Laporan bukan milik anda atau bukan lagi berstatus Draf.'},409);
  }
  const crew=await env.DB.prepare(`SELECT p.id,p.markah,lp.jawatan,lp.status,lp.jadual_id
    FROM laporan_penilaian_pegawai p LEFT JOIN lantikan_pengadil lp
      ON lp.id=p.lantikan_pengadil_id WHERE p.laporan_id=?`).bind(reportId)
    .all<{id:number;markah:string|null;jawatan:string|null;status:string|null;jadual_id:number|null}>();
  if (!crew.results.length) return json({error:true,message:'Senarai penilaian KUP masih kosong.'},400);
  if (crew.results.some((row)=>row.markah===null || String(row.markah).trim()==='')) {
    return json({error:true,message:'Markah untuk semua pegawai perlu diisi sebelum menghantar.'},400);
  }
  const roles=new Set(crew.results.map((row)=>row.jawatan));
  if (crew.results.length<3 || crew.results.length>4 || roles.size!==crew.results.length ||
      !['Pengadil','Penolong Pengadil 1','Penolong Pengadil 2'].every((role)=>roles.has(role)) ||
      crew.results.some((row)=>row.status!=='Diterima' || row.jadual_id!==report.jadual_id)) {
    return json({error:true,message:'Senarai KUP tidak sepadan dengan lantikan yang diterima.'},409);
  }
  const nonce=crypto.randomUUID();
  const approvalToken=Array.from(crypto.getRandomValues(new Uint8Array(32)),
    (byte)=>byte.toString(16).padStart(2,'0')).join('');
  const now="datetime('now','+8 hours')";
  const active=`EXISTS(SELECT 1 FROM worker_report_submissions ws
    WHERE ws.report_id=? AND ws.nonce=?)`;
  const valid=`EXISTS(SELECT 1 FROM laporan_penilaian r
    JOIN lantikan_pengadil ra ON ra.id=r.lantikan_id
    WHERE r.id=? AND r.status='Draf'
      AND ((? IS NOT NULL AND r.penilai_id=? AND ra.pengadil_id=r.penilai_id)
        OR (? IS NOT NULL AND ra.penilaian_token=?))
      AND ra.jadual_id=r.jadual_id
      AND ra.jawatan='Penilai Pengadil' AND ra.status='Diterima'
      AND NOT EXISTS(SELECT 1 FROM laporan_pengesahan_pengerusi a WHERE a.laporan_id=r.id)
      AND (SELECT count(*) FROM laporan_penilaian_pegawai p WHERE p.laporan_id=r.id)
        BETWEEN 3 AND 4
      AND NOT EXISTS(SELECT 1 FROM laporan_penilaian_pegawai p
        LEFT JOIN lantikan_pengadil lp ON lp.id=p.lantikan_pengadil_id
        WHERE p.laporan_id=r.id AND (p.markah IS NULL OR trim(p.markah)=''
          OR lp.id IS NULL OR lp.jadual_id<>r.jadual_id OR lp.status<>'Diterima'
          OR lp.jawatan<>p.jawatan OR lp.jawatan NOT IN
            ('Pengadil','Penolong Pengadil 1','Penolong Pengadil 2','Pegawai ke4')))
      AND (SELECT count(*) FROM lantikan_pengadil lp WHERE lp.jadual_id=r.jadual_id
        AND lp.status='Diterima' AND lp.jawatan IN
          ('Pengadil','Penolong Pengadil 1','Penolong Pengadil 2','Pegawai ke4'))
        =(SELECT count(*) FROM laporan_penilaian_pegawai p WHERE p.laporan_id=r.id)
      AND (SELECT count(DISTINCT p.jawatan) FROM laporan_penilaian_pegawai p
        WHERE p.laporan_id=r.id)=(SELECT count(*) FROM laporan_penilaian_pegawai p
          WHERE p.laporan_id=r.id)
      AND EXISTS(SELECT 1 FROM laporan_penilaian_pegawai p WHERE p.laporan_id=r.id
        AND p.jawatan='Pengadil')
      AND EXISTS(SELECT 1 FROM laporan_penilaian_pegawai p WHERE p.laporan_id=r.id
        AND p.jawatan='Penolong Pengadil 1')
      AND EXISTS(SELECT 1 FROM laporan_penilaian_pegawai p WHERE p.laporan_id=r.id
        AND p.jawatan='Penolong Pengadil 2'))`;
  const statements=[
    // The unconditional insert makes a failed guard or duplicate abort atomically.
    env.DB.prepare(`INSERT INTO worker_report_submissions(report_id,nonce,integrity_checked)
      VALUES(?,?,CASE WHEN ${valid} THEN 0 ELSE -1 END)`)
      .bind(reportId,nonce,reportId,userId,userId,token,token),
    env.DB.prepare(`UPDATE laporan_penilaian SET status='Dihantar',tarikh_hantar=${now},
      updated_at=${now} WHERE id=? AND status='Draf' AND ${active}`)
      .bind(reportId,reportId,nonce),
    env.DB.prepare(`INSERT INTO laporan_pengesahan_pengerusi
      (laporan_id,kejohanan_pengesah_id,pengesah_user_id,pengesah_luar_id,
       pengesah_nama,pengesah_jawatan,pengesah_negeri,approval_token,status,
       email_recipient,email_attempts,telegram_chat_id,telegram_attempts,admin_copy_at,
       created_at,updated_at)
      SELECT r.id,kp.id,kp.pengesah_user_id,kp.pengesah_luar_id,
        kp.nama_snapshot,kp.jawatan_snapshot,
        COALESCE(NULLIF(trim(u.negeri),''),NULLIF(trim(pl.negeri),''),''),
        CASE WHEN kp.id IS NOT NULL THEN ? ELSE NULL END,'Menunggu',
        COALESCE(u.email,pl.emel),0,COALESCE(u.telegram_chat_id,pl.telegram_chat_id),0,
        ${now},${now},${now}
      FROM laporan_penilaian r JOIN jadual_perlawanan jp ON jp.id=r.jadual_id
      LEFT JOIN kejohanan_pengesah_laporan kp ON kp.kejohanan_id=jp.kejohanan_id AND kp.aktif=1
      LEFT JOIN users u ON u.id=kp.pengesah_user_id
      LEFT JOIN pengadil_luar pl ON pl.id=kp.pengesah_luar_id
      WHERE r.id=? AND r.status='Dihantar' AND ${active}`)
      .bind(approvalToken,reportId,reportId,nonce),
    env.DB.prepare(`INSERT INTO notifications(user_id,type,subject,message,email_sent,is_read,created_at)
      SELECT admin.id,'Laporan RA','Salinan Laporan RA #'||r.id||
        ' — Menunggu Pengesahan Pengerusi',
        COALESCE(ra_user.nama_penuh,ra_luar.nama,'Penilai Pengadil')||
        ' telah menghantar laporan RA bagi '||jp.pasukan_home||' lwn '||jp.pasukan_away||
        ' ('||k.nama||'). Pengerusi Pengadil: '||COALESCE(a.pengesah_nama,'belum ditetapkan')||
        '. Admin boleh menyemak salinan dan hanya menggunakan override jika perlu.',
        0,0,${now}
      FROM users admin CROSS JOIN laporan_penilaian r
      JOIN jadual_perlawanan jp ON jp.id=r.jadual_id
      JOIN kejohanan k ON k.id=jp.kejohanan_id
      JOIN lantikan_pengadil ra ON ra.id=r.lantikan_id
      LEFT JOIN users ra_user ON ra_user.id=ra.pengadil_id
      LEFT JOIN pengadil_luar ra_luar ON ra_luar.id=ra.pengadil_luar_id
      JOIN laporan_pengesahan_pengerusi a ON a.laporan_id=r.id
      WHERE admin.role='Admin' AND admin.aktif=1 AND r.id=? AND ${active}`)
      .bind(reportId,reportId,nonce),
    env.DB.prepare(`INSERT INTO laporan_pengesahan_audit
      (laporan_pengesahan_id,laporan_id,event_type,channel,event_status,actor_type,
       link_url,details_json,created_at)
      SELECT a.id,a.laporan_id,'approval_prepared','system',
        CASE WHEN a.kejohanan_pengesah_id IS NULL THEN 'failed' ELSE 'success' END,
        'system',NULL,CASE WHEN a.kejohanan_pengesah_id IS NULL
          THEN '{"reason":"pengerusi_not_configured"}' ELSE NULL END,${now}
      FROM laporan_pengesahan_pengerusi a WHERE a.laporan_id=? AND ${active}`)
      .bind(reportId,reportId,nonce),
    env.DB.prepare(`INSERT INTO laporan_pengesahan_audit
      (laporan_pengesahan_id,laporan_id,event_type,channel,event_status,actor_type,
       details_json,created_at)
      SELECT a.id,a.laporan_id,'admin_copy_created','portal','success','system',
        json_object('admin_count',(SELECT count(*) FROM users WHERE role='Admin' AND aktif=1)),${now}
      FROM laporan_pengesahan_pengerusi a WHERE a.laporan_id=? AND ${active}`)
      .bind(reportId,reportId,nonce),
    env.DB.prepare(`INSERT INTO worker_chair_jobs
      (delivery_key,approval_id,report_id,token_tag,channel,origin)
      SELECT 'chair:'||a.laporan_id||':'||channels.channel||':'||?,a.id,a.laporan_id,
        substr(a.approval_token,1,16),channels.channel,'submission'
      FROM laporan_pengesahan_pengerusi a
      CROSS JOIN (SELECT 'email' AS channel UNION ALL SELECT 'telegram') channels
      WHERE a.laporan_id=? AND a.kejohanan_pengesah_id IS NOT NULL
        AND length(a.approval_token)=64 AND a.status='Menunggu' AND ${active}`)
      .bind(nonce,reportId,reportId,nonce),
    env.DB.prepare(`UPDATE worker_report_submissions SET integrity_checked=CASE WHEN
      (SELECT status FROM laporan_penilaian WHERE id=?)='Dihantar'
      AND (SELECT status FROM laporan_pengesahan_pengerusi WHERE laporan_id=?)='Menunggu'
      AND (SELECT count(DISTINCT user_id) FROM notifications WHERE type='Laporan RA'
        AND subject=('Salinan Laporan RA #'||CAST(? AS INTEGER)||' — Menunggu Pengesahan Pengerusi'))
        =(SELECT count(*) FROM users WHERE role='Admin' AND aktif=1)
      AND (SELECT count(*) FROM users WHERE role='Admin' AND aktif=1)>0
      AND (SELECT count(*) FROM laporan_pengesahan_audit
        WHERE laporan_id=? AND event_type IN ('approval_prepared','admin_copy_created'))>=2
      AND (SELECT count(*) FROM worker_chair_jobs WHERE report_id=?)
        =CASE WHEN (SELECT kejohanan_pengesah_id FROM laporan_pengesahan_pengerusi
          WHERE laporan_id=?) IS NULL THEN 0 ELSE 2 END
      THEN 1 ELSE -1 END WHERE report_id=? AND nonce=?`)
      .bind(reportId,reportId,reportId,reportId,reportId,reportId,reportId,nonce),
  ];
  let result:D1Result[];
  try {result=await env.DB.batch(statements);}
  catch(error) {
    if (String(error).includes('constraint')) return json({error:true,
      message:'Laporan telah berubah atau tidak lengkap. Muat semula sebelum menghantar.'},409);
    throw error;
  }
  if (result[0]?.meta?.changes!==1 || result[1]?.meta?.changes!==1 ||
      result[2]?.meta?.changes!==1 || result[4]?.meta?.changes!==1 ||
      result[5]?.meta?.changes!==1 || result[7]?.meta?.changes!==1) {
    throw new Error('Incomplete RA submission transaction');
  }
  const approval=await env.DB.prepare(`SELECT a.id,a.status,a.pengesah_nama,
    CASE WHEN a.kejohanan_pengesah_id IS NULL THEN 0 ELSE 1 END AS configured,
    a.email_sent_at,a.telegram_sent_at FROM laporan_pengesahan_pengerusi a
    WHERE a.laporan_id=?`).bind(reportId).first<Approval>();
  if (!approval) throw new Error('RA submission state unavailable');
  const message=approval.configured
    ? 'Laporan berjaya dihantar. Pemakluman Pengerusi Pengadil dijadualkan dan Admin menerima salinan.'
    : 'Laporan berjaya dihantar. Admin menerima salinan; penghantaran kepada Pengerusi Pengadil sedang menunggu tindakan pentadbir.';
  return json({error:false,message,id:reportId,pengesahan:approval});
}

export async function submitAssessmentRequest(request:Request,env:Env):Promise<Response> {
  if (request.method!=='PUT') return json({error:true,message:'Kaedah tidak disokong.'},405);
  if (env.STAGING_AUTH_ENABLED!=='1' || env.STAGING_WRITES_ENABLED!=='1' ||
      env.REPORT_DELIVERY_ENABLED!=='1') {
    return json({error:true,message:'Penghantaran laporan belum tersedia di staging.'},503);
  }
  const user=await currentUser(request,env);
  if (!user) return json({error:true,message:'Sila log masuk.'},401);
  if (!['Admin','Penilai','PP Daerah'].includes(user.role)) return json({error:true,message:'Akses ditolak.'},403);
  const input=await boundedJson(request,4096);
  if (input instanceof Response) return input;
  if (!input || typeof input!=='object' || Array.isArray(input)) return json({error:true,message:'Data laporan tidak sah.'},400);
  const body=input as Record<string,unknown>;
  const id=idOf(body.id);
  if (!id) return json({error:true,message:'ID diperlukan.'},400);
  if (body.action==='log_pengerusi_link_copy') {
    if (user.role!=='Admin') return json({error:true,message:'Akses ditolak.'},403);
    const state=await env.DB.prepare(`SELECT a.id,a.approval_token FROM
      laporan_pengesahan_pengerusi a JOIN laporan_penilaian r ON r.id=a.laporan_id
      WHERE a.laporan_id=? AND a.status='Menunggu' AND r.status='Dihantar'
        AND length(a.approval_token)=64 LIMIT 1`)
      .bind(id).first<{id:number;approval_token:string}>();
    if (!state || !/^[a-fA-F0-9]{64}$/.test(state.approval_token)) {
      return json({error:true,message:'Pautan Pengerusi tidak lagi aktif.'},409);
    }
    const url=`${env.BASE_URL.replace(/\/$/,'')}/api/laporan-pengesahan-token.php?token=${state.approval_token}`;
    const audit=await env.DB.prepare(`INSERT INTO laporan_pengesahan_audit
      (laporan_pengesahan_id,laporan_id,event_type,channel,event_status,
       actor_type,actor_user_id,link_url,details_json,created_at)
      SELECT a.id,a.laporan_id,'direct_link_copied','admin','success','admin',
        ?,?,'{"purpose":"chair_report_confirmation"}',datetime('now','+8 hours')
      FROM laporan_pengesahan_pengerusi a JOIN laporan_penilaian r ON r.id=a.laporan_id
      WHERE a.id=? AND a.laporan_id=? AND a.status='Menunggu'
        AND a.approval_token=? AND r.status='Dihantar'`)
      .bind(user.id,url,state.id,id,state.approval_token).run();
    return audit.meta.changes===1
      ? json({error:false,message:'Salinan pautan direkodkan.'})
      : json({error:true,message:'Pautan Pengerusi tidak lagi aktif.'},409);
  }
  if (body.action==='sahkan') {
    if (user.role!=='Admin') return json({error:true,message:'Akses ditolak.'},403);
    const reason=typeof body.override_reason==='string' ? body.override_reason.trim() : '';
    const comment=typeof body.catatan_admin==='string' ? body.catatan_admin.trim() : '';
    if (!reason) return json({error:true,message:'Sebab override Admin diperlukan.'},400);
    if (reason.length>5000 || comment.length>5000) {
      return json({error:true,message:'Catatan override terlalu panjang.'},400);
    }
    let result:'confirmed'|'already_processed';
    try {result=await overrideAdminReport(env,id,user.id,reason,comment,request);}
    catch(error) {
      if (String(error).includes('constraint')) return json({error:true,
        message:'Laporan telah berubah atau tidak lengkap. Muat semula sebelum mengesahkan.'},409);
      throw error;
    }
    return result==='confirmed'
      ? json({error:false,message:'Override Admin direkodkan dan laporan disahkan.'})
      : json({error:true,message:'Laporan ini telah disahkan atau di-override sebelum ini.'},409);
  }
  if (body.action==='retry_pengerusi_notification') {
    if (user.role!=='Admin') return json({error:true,message:'Akses ditolak.'},403);
    const retry=await retryChairNotification(env,id,user.id);
    return json(retry.body,retry.status);
  }
  if (body.action!=='hantar') return json({error:true,message:'Tindakan belum tersedia di staging.'},503);
  return submitAssessment(env,id,user.id);
}
