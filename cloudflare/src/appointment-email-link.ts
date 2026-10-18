/**
 * api/lantikan-jawab-token.php: one-click accept/reject from the appointment
 * email. GET is a read-only confirmation page (mail scanners open links);
 * only POST records the answer.
 */
import { appointmentWritesEnabled } from './lantikan-write';
import { EMAIL_LOGO_URL } from '../mail';
import { appointmentDeadline } from './php/email';
import { responseDeadline } from '../../shared/appointment-deadline';
import { h, klTimestamp, phpDate, tarikhFmt } from './php/format';
import { auditMetaFrom } from './php/lantikan-audit';
import { LANTIKAN_AUTO_TOLAK_KOMEN, autoTolakLantikanTertunggak, createPortalNotification,
  generatePenilaianToken, getMatchKickoffTimestamp, notifyAdminLantikanResponse,
  notifyCompleteKupCrew, notifyPPDaerahResponse } from './php/lantikan-helper';
import { applyAppointmentResponse, ucfirst } from './php/lantikan-response';
import type { Env } from './types';

type Row = { id: number; status: string; komen: string | null; tarikh_notif: string | null;
  jawatan: string; jadual_id: number; tarikh: string; masa: string | null; tempat: string | null;
  pasukan_home: string; pasukan_away: string; kejohanan: string; jenis_kejohanan: string;
  pengadil_id: number | null; nama_penuh: string; persatuan_id: number | null };

/** renderPage() from the PHP endpoint, markup unchanged. */
function renderPage(title: string, icon: string, color: string, heading: string, body: string,
  nextUrl = '', status = 200): Response {
  const year = phpDate('Y', Date.now());
  const btnHtml = nextUrl
    ? `<a href="${h(nextUrl)}"
              style="display:inline-block;margin-top:28px;background:#111827;color:#FADA00;
                      padding:12px 32px;text-decoration:none;font-weight:700;font-size:13px;
                      letter-spacing:1px;text-transform:uppercase;">
            Ke Dashboard
           </a>`
    : '';
  const html = `<!DOCTYPE html>
<html lang="ms">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #E8EAED; font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
           min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .card { background: #fff; max-width: 480px; width: 100%;
            box-shadow: 0 1px 8px rgba(0,0,0,.12); }
    .top  { background: ${color}; height: 6px; }
    .hdr  { background: #111827; padding: 28px 36px 24px; text-align: center; }
    .hdr img { width: 56px; height: 56px; border-radius: 50%; display: block; margin: 0 auto 12px; }
    .hdr .org { color: #F9FAFB; font-size: 13px; font-weight: 700; letter-spacing: .6px; }
    .hdr .sub { color: #6B7280; font-size: 10px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; margin-top: 4px; }
    .body { padding: 40px 36px 36px; text-align: center; }
    .icon { font-size: 52px; margin-bottom: 18px; }
    .heading { font-size: 22px; font-weight: 700; color: #111827; margin-bottom: 14px; }
    .msg  { font-size: 14px; color: #6B7280; line-height: 1.7; }
    .ftr  { background: #111827; padding: 18px 36px; text-align: center;
            color: #9CA3AF; font-size: 11px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="top"></div>
    <div class="hdr">
      <img src="${EMAIL_LOGO_URL}" alt="PBNP">
      <div class="org">PERSATUAN BOLA SEPAK NEGERI PAHANG</div>
      <div class="sub">Sistem Pengurusan Pengadil</div>
    </div>
    <div class="body">
      <div class="icon">${icon}</div>
      <div class="heading">${heading}</div>
      <div class="msg">${body}</div>
      ${btnHtml}
    </div>
    <div class="ftr">&copy; ${year} Persatuan Bola Sepak Negeri Pahang</div>
  </div>
</body>
</html>`;
  const headers = new Headers({ 'Content-Type': 'text/html; charset=UTF-8', 'Cache-Control': 'no-store' });
  if (status === 405) headers.set('Allow', 'GET, POST');
  return new Response(html, { status, headers });
}

async function postedFields(request: Request): Promise<URLSearchParams> {
  const type = request.headers.get('Content-Type') ?? '';
  if (type.startsWith('application/x-www-form-urlencoded') || type.startsWith('multipart/form-data')) {
    try {
      const form = await request.formData();
      const fields = new URLSearchParams();
      form.forEach((value, key) => { if (typeof value === 'string') fields.append(key, value); });
      return fields;
    } catch { return new URLSearchParams(); }
  }
  return new URLSearchParams();
}

export async function appointmentEmailLink(request: Request, env: Env): Promise<Response> {
  const method = request.method.toUpperCase();
  if (method !== 'GET' && method !== 'POST') {
    return renderPage('Kaedah Tidak Sah', '⚠️', '#F59E0B', 'Kaedah Tidak Sah', 'Gunakan pautan daripada emel anda.', '', 405);
  }
  if (!appointmentWritesEnabled(env)) {
    return new Response('Pautan jawapan belum tersedia di staging.', {
      status: 503, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
  try {
    const source = method === 'POST' ? await postedFields(request) : new URL(request.url).searchParams;
    const token = (source.get('token') ?? '').trim();
    const action = (source.get('action') ?? '').trim();
    if (token === '' || (action !== 'accept' && action !== 'reject')) {
      return renderPage('Pautan Tidak Sah', '⚠️', '#F59E0B', 'Pautan Tidak Sah',
        'Pautan ini tidak sah atau tidak lengkap. Sila semak emel anda dan cuba lagi.');
    }
    const baseUrl = env.BASE_URL || 'https://refpahang.com';
    const row = await env.DB.prepare(`
      SELECT lp.id,lp.status,lp.komen,lp.tarikh_notif,lp.jawatan,lp.jadual_id,
        jp.tarikh,jp.masa,jp.tempat,jp.pasukan_home,jp.pasukan_away,
        COALESCE(kj.nama,'') AS kejohanan,
        COALESCE(kj.jenis_kejohanan,'Persahabatan') AS jenis_kejohanan,
        lp.pengadil_id,
        COALESCE(NULLIF(trim(u.nama_penuh),''),NULLIF(trim(pl.nama),''),'Pengadil') AS nama_penuh,
        u.persatuan_id
      FROM lantikan_pengadil lp
      JOIN jadual_perlawanan jp ON lp.jadual_id=jp.id
      LEFT JOIN kejohanan kj ON jp.kejohanan_id=kj.id
      LEFT JOIN users u ON lp.pengadil_id=u.id
      LEFT JOIN pengadil_luar pl ON lp.pengadil_luar_id=pl.id
      WHERE lp.email_token=? LIMIT 1`).bind(token).first<Row>();
    if (!row) {
      return renderPage('Pautan Tidak Sah', '⚠️', '#F59E0B', 'Pautan Tidak Sah',
        `Pautan ini tidak dapat dikenal pasti. Kemungkinan tugasan telah dijawab melalui
             saluran lain atau lantikan telah dikemaskini oleh pentadbir.
             Sila hubungi pentadbir untuk mendapatkan pautan aktif.`, '');
    }
    const dashUrl = row.pengadil_id ? `${baseUrl}/pengadil-dashboard.html` : '';

    if (method === 'GET' && row.status === 'Belum Jawab') {
      const notif = row.tarikh_notif ? klTimestamp(String(row.tarikh_notif)) : null;
      const kickoff = getMatchKickoffTimestamp(String(row.tarikh), String(row.masa ?? ''));
      if (notif !== null && notif > 0 && kickoff !== null) {
        const deadline = responseDeadline(row.jenis_kejohanan, kickoff, notif);
        if (deadline && deadline.at <= Date.now()) {
          const deadlineDt = phpDate('d M Y, H:i', deadline.at);
          return renderPage('Tempoh Menjawab Tamat', '⏰', '#F59E0B', 'Tempoh Menjawab Telah Tamat',
            `Tempoh menjawab telah tamat pada <strong>${deadlineDt}</strong>. Sila hubungi pentadbir jika anda masih boleh bertugas.`,
            dashUrl);
        }
      }
      const actionLabel = action === 'accept' ? 'Terima Tugasan' : 'Tolak Tugasan';
      const actionColor = action === 'accept' ? '#059669' : '#DC2626';
      const body = `Sahkan tindakan <strong>${actionLabel}</strong> sebagai <strong>${h(row.jawatan)}</strong> untuk ${h(`${row.pasukan_home} lwn ${row.pasukan_away}`)}.`
        + '<form method="post" style="margin-top:24px">'
        + `<input type="hidden" name="token" value="${h(token)}">`
        + `<input type="hidden" name="action" value="${h(action)}">`
        + `<button type="submit" style="border:0;border-radius:4px;padding:13px 24px;background:${actionColor};color:#fff;font-weight:700;cursor:pointer">${actionLabel}</button></form>`;
      return renderPage('Sahkan Jawapan', '✉️', actionColor, 'Sahkan Jawapan Lantikan', body, dashUrl);
    }

    const meta = auditMetaFrom(request);
    const expiredNow = await autoTolakLantikanTertunggak(env, { id: row.id }, meta);
    if (expiredNow > 0 || (row.status === 'Ditolak' && (row.komen ?? '') === LANTIKAN_AUTO_TOLAK_KOMEN)) {
      const deadline = appointmentDeadline(row.jenis_kejohanan, row.tarikh, row.masa ?? '',
        row.tarikh_notif ? klTimestamp(String(row.tarikh_notif)) ?? 0 : 0);
      return renderPage('Tempoh Menjawab Tamat', '⏰', '#F59E0B', 'Tempoh Menjawab Telah Tamat',
        `Tempoh menjawab telah tamat. Tarikh akhir ialah ${deadline.html}.
             Lantikan ini telah <strong>DITOLAK secara automatik</strong>.
             Sila hubungi pentadbir jika anda masih boleh bertugas.`, dashUrl);
    }
    if (row.status !== 'Belum Jawab') {
      const already = row.status === 'Diterima' ? 'diterima' : 'ditolak';
      return renderPage('Sudah Dijawab', 'ℹ️', '#3B82F6', 'Tugasan Sudah Dijawab',
        `Tugasan ini telah <strong>${already}</strong> sebelum ini. Tiada tindakan lanjut diperlukan.`, dashUrl);
    }
    const newStatus = action === 'accept' ? 'Diterima' : 'Ditolak';
    const responseUrl = `${baseUrl.replace(/\/+$/, '')}/api/lantikan-jawab-token.php?token=`
      + `${encodeURIComponent(token)}&action=${encodeURIComponent(action)}`;
    const outcome = await applyAppointmentResponse(env, {
      lantikanId: row.id, jadualId: row.jadual_id, jawatan: row.jawatan, newStatus,
      channel: 'email_link', details: { action, new_status: newStatus }, linkUrl: responseUrl,
      actorUserId: null,
    }, meta);
    if (!outcome.updated) {
      return renderPage('Sudah Dijawab', 'ℹ️', '#3B82F6', 'Tugasan Sudah Dijawab',
        'Tugasan ini telah dijawab sebelum ini. Tiada tindakan lanjut diperlukan.');
    }
    if (newStatus === 'Diterima') {
      try { await generatePenilaianToken(env, row.id, meta); } catch (error) {
        console.error('[lantikan-jawab-token] generatePenilaianToken error', error instanceof Error ? error.message : error);
      }
    }
    if (outcome.shouldNotifyCompleteKup) {
      try { await notifyCompleteKupCrew(env, row.jadual_id); } catch (error) {
        console.error('[lantikan-jawab-token] KUP crew notification error', error instanceof Error ? error.message : error);
      }
    }
    const tarikhText = tarikhFmt(row.tarikh);
    const pasukan = h(`${row.pasukan_home} lwn ${row.pasukan_away}`);
    const jawatan = h(row.jawatan);
    // The answer is saved; a side notification failure must not turn this into an error page.
    try {
      await notifyAdminLantikanResponse(env, action, row.nama_penuh, row.jawatan, row.kejohanan, row.tarikh,
        row.pasukan_home, row.pasukan_away);
      if (row.pengadil_id) {
        const label = action === 'accept' ? 'diterima' : 'ditolak';
        await createPortalNotification(env, row.pengadil_id, `Lantikan ${ucfirst(label)}`,
          `Lantikan ${row.pasukan_home} lwn ${row.pasukan_away}`,
          `Anda telah ${label} lantikan sebagai ${row.jawatan} untuk ${row.pasukan_home} lwn ${row.pasukan_away} (${row.kejohanan}).`);
        const persatuanId = Number(row.persatuan_id ?? 0);
        if (persatuanId) {
          await notifyPPDaerahResponse(env, action, persatuanId, row.nama_penuh, row.jawatan, row.kejohanan,
            row.tarikh, row.pasukan_home, row.pasukan_away);
        }
      }
    } catch (error) {
      console.error('[lantikan-jawab-token] notification error', error instanceof Error ? error.message : error);
    }
    return action === 'accept'
      ? renderPage('Tugasan Diterima', '✅', '#10B981', 'Tugasan Diterima',
        `Terima kasih. Anda telah <strong>menerima</strong> tugasan sebagai <strong>${jawatan}</strong>.<br><br>
             <strong>${pasukan}</strong><br>${tarikhText}<br>${h(row.tempat ?? '')}<br><br>
             Sila hadir pada masa dan tempat yang ditetapkan.<br><br>
             ⚠️ <strong>Sila bawa kelengkapan penuh pengadil.</strong>`, dashUrl)
      : renderPage('Tugasan Ditolak', '❌', '#EF4444', 'Tugasan Ditolak',
        `Anda telah <strong>menolak</strong> tugasan sebagai <strong>${jawatan}</strong>.<br><br>
             <strong>${pasukan}</strong><br>${tarikhText}<br><br>
             Pentadbir telah dimaklumkan. Terima kasih atas maklum balas anda.`, dashUrl);
  } catch (error) {
    console.error('[lantikan-jawab-token]', error instanceof Error ? error.message : error);
    return renderPage('Ralat', '⚠️', '#EF4444', 'Ralat Dalaman',
      'Ralat berlaku semasa memproses permintaan anda. Sila cuba lagi atau hubungi pentadbir.');
  }
}
