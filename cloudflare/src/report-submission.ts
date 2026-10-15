/** PUT api/laporan-penilaian.php: hantar, link copy log, chair retry and Admin override. */
import {currentUser,json} from './auth';
import {boundedJson} from './request';
import {phpInt} from './lantikan-write';
import {guardStatement,runGuarded} from './php/guard';
import type {AuditMeta} from './php/lantikan-audit';
import {NOW,auditMetaFrom} from './php/lantikan-audit';
import type {ChairDispatch} from './php/laporan-pengesahan';
import {PhpDomainError,PhpInvalidArgument,buildPengerusiApprovalUrl,dispatchLaporanForPengerusi,
  ensureLaporanPengesahanState,overrideLaporanByAdmin,recordLaporanPengesahanAudit} from './php/laporan-pengesahan';
import type {Env} from './types';

export function reportWritesEnabled(env:Env):boolean {
  return env.STAGING_AUTH_ENABLED==='1' && env.STAGING_WRITES_ENABLED==='1' && env.REPORT_DELIVERY_ENABLED==='1';
}

/**
 * The dispatch result PHP returns as `pengesahan`. The approval token stays
 * server-side: the RA submitting the report must never receive the chair link.
 */
export function publicDispatch(delivery:ChairDispatch|null):Record<string,unknown>|null {
  if (!delivery) return null;
  const {approval_token:_token,...state}=delivery.state;
  return {...delivery,state};
}

export function submissionMessage(delivery:ChairDispatch|null):string {
  return delivery && delivery.configured
    ? 'Laporan berjaya dihantar kepada Pengerusi Pengadil. Admin menerima salinan.'
    : 'Laporan berjaya dihantar. Admin menerima salinan; penghantaran kepada Pengerusi Pengadil sedang menunggu tindakan pentadbir.';
}

/** Chair dispatch after a committed submission; a failure only gets logged. */
export async function dispatchAfterSubmission(env:Env,reportId:number,meta:AuditMeta,
  source:string):Promise<ChairDispatch|null> {
  try {return await dispatchLaporanForPengerusi(env,reportId,meta);}
  catch (error) {
    console.error(`[${source}] Chair dispatch error`,error instanceof Error ? error.message : error);
    return null;
  }
}

async function hantar(env:Env,id:number,userId:number,meta:AuditMeta):Promise<Response> {
  const owner=await env.DB.prepare(`SELECT lantikan_id FROM laporan_penilaian
    WHERE id=? AND penilai_id=? AND status='Draf'`).bind(id,userId).first();
  if (!owner) return json({error:true,message:'Laporan bukan milik anda atau bukan lagi berstatus Draf.'},409);
  const pegawai=await env.DB.prepare('SELECT markah FROM laporan_penilaian_pegawai WHERE laporan_id=?')
    .bind(id).all<{markah:string|number|null}>();
  if (pegawai.results.length===0) return json({error:true,message:'Senarai penilaian KUP masih kosong.'},400);
  if (pegawai.results.some((row)=>row.markah===null || row.markah==='')) {
    return json({error:true,message:'Markah untuk semua pegawai perlu diisi sebelum menghantar.'},400);
  }
  const done=await runGuarded(env,[
    guardStatement(env,'report_submit',`EXISTS(SELECT 1 FROM laporan_penilaian WHERE id=? AND penilai_id=?
      AND status='Draf') AND EXISTS(SELECT 1 FROM laporan_penilaian_pegawai WHERE laporan_id=?)
      AND NOT EXISTS(SELECT 1 FROM laporan_penilaian_pegawai WHERE laporan_id=?
        AND (markah IS NULL OR markah=''))`,[id,userId,id,id]),
    env.DB.prepare(`UPDATE laporan_penilaian SET status='Dihantar',tarikh_hantar=${NOW}
      WHERE id=? AND penilai_id=? AND status='Draf'`).bind(id,userId),
  ]);
  if (!done) return json({error:true,message:'Laporan bukan milik anda atau bukan lagi berstatus Draf.'},409);
  const delivery=await dispatchAfterSubmission(env,id,meta,'laporan-penilaian.php');
  return json({error:false,message:submissionMessage(delivery),pengesahan:publicDispatch(delivery)});
}

export async function submitAssessmentRequest(request:Request,env:Env):Promise<Response> {
  if (request.method!=='PUT') return json({error:true,message:'Kaedah tidak disokong.'},405);
  const user=await currentUser(request,env);
  if (!user) return json({error:true,message: 'Sesi tidak sah. Sila log masuk semula.'},401);
  if (!['Admin','Penilai','PP Daerah'].includes(user.role)) return json({error:true,message:'Akses ditolak.'},403);
  if (!reportWritesEnabled(env)) {
    return json({error:true,message:'Penghantaran laporan belum tersedia di staging.'},503);
  }
  const parsed=await boundedJson(request,65_536);
  if (parsed instanceof Response) return parsed;
  const input=parsed && typeof parsed==='object' && !Array.isArray(parsed) ? parsed as Record<string,unknown> : {};
  const action=input.action ?? '';
  const id=phpInt(input.id);
  if (!id) return json({error:true,message:'ID diperlukan.'},400);
  const isAdmin=user.role==='Admin';
  const meta=auditMetaFrom(request);
  try {
    if (action==='hantar') return await hantar(env,id,user.id,meta);
    if (action==='log_pengerusi_link_copy' && isAdmin) {
      const state=await ensureLaporanPengesahanState(env,id,meta);
      const token=String(state.approval_token ?? '').trim();
      if (state.status!=='Menunggu' || token==='') {
        return json({error:true,message:'Pautan Pengerusi tidak lagi aktif.'},409);
      }
      await recordLaporanPengesahanAudit(env,Number(state.id),id,'direct_link_copied','admin','success','admin',
        user.id,null,buildPengerusiApprovalUrl(env,token),{purpose:'chair_report_confirmation'},meta);
      return json({error:false,message:'Salinan pautan direkodkan.'});
    }
    if (action==='retry_pengerusi_notification' && isAdmin) {
      const delivery=await dispatchLaporanForPengerusi(env,id,meta);
      return json({error:false,
        message:delivery.email_sent || delivery.telegram_sent
          ? 'Percubaan penghantaran kepada Pengerusi selesai. Sekurang-kurangnya satu saluran berjaya.'
          : 'Percubaan direkodkan tetapi tiada saluran berjaya. Gunakan pautan terus jika perlu.',
        pengesahan:publicDispatch(delivery)});
    }
    if (action==='sahkan' && isAdmin) {
      try {
        await overrideLaporanByAdmin(env,id,user.id,String(input.override_reason ?? '').trim(),
          String(input.catatan_admin ?? '').trim(),meta);
      } catch (error) {
        if (error instanceof PhpInvalidArgument) return json({error:true,message:error.message},400);
        if (error instanceof PhpDomainError) return json({error:true,message:error.message},409);
        throw error;
      }
      return json({error:false,message:'Override Admin direkodkan dan laporan disahkan.'});
    }
    return json({error:true,message:'Action tidak sah.'},400);
  } catch (error) {
    console.error('[laporan-penilaian.php]',error instanceof Error ? error.message : error);
    return json({error:true,message:'Ralat pelayan.'},500);
  }
}
