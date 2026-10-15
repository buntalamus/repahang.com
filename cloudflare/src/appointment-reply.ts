/** api/lantikan-jawab.php: an official answers an appointment from the portal. */
import { currentUser, json } from './auth';
import { appointmentWritesEnabled, phpInt } from './lantikan-write';
import { auditMetaFrom } from './php/lantikan-audit';
import { LANTIKAN_AUTO_TOLAK_KOMEN, autoTolakLantikanTertunggak, createPortalNotification,
  generatePenilaianToken, notifyAdminLantikanResponse, notifyCompleteKupCrew,
  notifyPPDaerahResponse } from './php/lantikan-helper';
import { applyAppointmentResponse, ucfirst } from './php/lantikan-response';
import { boundedJson } from './request';
import type { Env } from './types';

type Assignment = { id: number; jadual_id: number; status: string; komen: string | null;
  jawatan: string; tarikh: string; pasukan_home: string; pasukan_away: string; kejohanan: string };

export async function appointmentReply(request: Request, env: Env): Promise<Response> {
  const actor = await currentUser(request, env);
  if (!actor) return json({ error: true, message: 'Sesi tidak sah. Sila log masuk semula.' }, 401);
  if (!['Pengadil', 'Penilai', 'PP Daerah'].includes(actor.role)) {
    return json({ error: true, message: 'Akses ditolak.' }, 403);
  }
  if (!appointmentWritesEnabled(env)) {
    return json({ error: true, message: 'Jawapan lantikan belum tersedia di staging.' }, 503);
  }
  const parsed = await boundedJson(request, 65_536);
  if (parsed instanceof Response) return parsed;
  const input = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? parsed as Record<string, unknown> : {};
  const action = String(input.action ?? '').trim();
  const lantikanId = phpInt(input.lantikan_id);
  const komen = String(input.komen ?? '').trim();
  if (!lantikanId || (action !== 'accept' && action !== 'reject')) {
    return json({ error: true, message: 'lantikan_id dan action (accept/reject) diperlukan.' }, 400);
  }
  if (action === 'reject' && (komen === '' || komen === '0')) {
    return json({ error: true, message: 'Sila berikan sebab penolakan.' }, 400);
  }
  const meta = auditMetaFrom(request);
  if (await autoTolakLantikanTertunggak(env, { id: lantikanId }, meta) > 0) {
    return json({ error: true, message: 'Tempoh menjawab telah tamat. Lantikan ini telah ditolak secara automatik.' }, 400);
  }
  const assignment = await env.DB.prepare(`
    SELECT lp.id,lp.jadual_id,lp.status,lp.komen,lp.jawatan,
      jp.tarikh,jp.masa,jp.tempat,jp.pasukan_home,jp.pasukan_away,jp.no_perlawanan,
      COALESCE(kj.nama,'') AS kejohanan
    FROM lantikan_pengadil lp
    JOIN jadual_perlawanan jp ON lp.jadual_id=jp.id
    LEFT JOIN kejohanan kj ON jp.kejohanan_id=kj.id
    WHERE lp.id=? AND lp.pengadil_id=?`).bind(lantikanId, actor.id).first<Assignment>();
  if (!assignment) {
    return json({ error: true, message: 'Lantikan tidak dijumpai atau bukan milik anda.' }, 404);
  }
  if (assignment.status !== 'Belum Jawab') {
    return json({ error: true, message: assignment.status === 'Ditolak' && (assignment.komen ?? '') === LANTIKAN_AUTO_TOLAK_KOMEN
      ? 'Tempoh menjawab telah tamat. Lantikan ini telah ditolak secara automatik.'
      : 'Lantikan ini sudah dijawab.' }, 400);
  }
  const newStatus = action === 'accept' ? 'Diterima' : 'Ditolak';
  const outcome = await applyAppointmentResponse(env, {
    lantikanId, jadualId: assignment.jadual_id, jawatan: assignment.jawatan, newStatus, komen,
    channel: 'portal', details: { action, new_status: newStatus, comment: komen },
    linkUrl: null, actorUserId: actor.id,
  }, meta);
  if (!outcome.updated) return json({ error: true, message: 'Lantikan ini sudah dijawab.' }, 400);

  if (newStatus === 'Diterima') {
    try { await generatePenilaianToken(env, lantikanId, meta); } catch (error) {
      console.error('[lantikan-jawab.php] generatePenilaianToken error', error instanceof Error ? error.message : error);
    }
  }
  if (outcome.shouldNotifyCompleteKup) {
    try { await notifyCompleteKupCrew(env, assignment.jadual_id); } catch (error) {
      console.error('[lantikan-jawab.php] KUP crew notification error', error instanceof Error ? error.message : error);
    }
  }
  const label = action === 'accept' ? 'diterima' : 'ditolak';
  const match = `${assignment.pasukan_home} lwn ${assignment.pasukan_away}`;
  await createPortalNotification(env, actor.id, `Lantikan ${ucfirst(label)}`, `Lantikan ${match}`,
    `Anda telah ${label} lantikan sebagai ${assignment.jawatan} untuk ${match} (${assignment.kejohanan}).`);
  await notifyAdminLantikanResponse(env, action, actor.nama_penuh, assignment.jawatan, assignment.kejohanan,
    assignment.tarikh, assignment.pasukan_home, assignment.pasukan_away, komen);
  const persatuanId = Number(actor.persatuan_id ?? 0);
  if (persatuanId) {
    await notifyPPDaerahResponse(env, action, persatuanId, actor.nama_penuh, assignment.jawatan,
      assignment.kejohanan, assignment.tarikh, assignment.pasukan_home, assignment.pasukan_away, komen);
  }
  return json({ error: false,
    message: action === 'accept' ? 'Tugasan berjaya diterima. Sila bawa kelengkapan penuh pengadil.' : 'Tugasan berjaya ditolak.',
    status: newStatus });
}
