import { expiryDeadline, recordAppointmentReply } from './appointment-response-core';
import type { Env } from './types';

interface LinkAppointment {
  id: number;
  status: string;
  jawatan: string;
  pengadil_id: number | null;
  notif_hantar: number | null;
  tarikh_notif: string | null;
  tarikh: string;
  masa: string | null;
  jenis_kejohanan: string | null;
  pasukan_home: string;
  pasukan_away: string;
  tempat: string | null;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character] ?? character);
}

function page(heading: string, paragraphs: string[],
  form?: { token: string; action: 'accept' | 'reject' }, status = 200): Response {
  const label = form?.action === 'accept' ? 'Terima Tugasan' : 'Tolak Tugasan';
  const color = form?.action === 'accept' ? '#047857' : '#b91c1c';
  const confirmation = form ? `<form method="post" action="/api/lantikan-jawab-token.php">
    <input type="hidden" name="token" value="${escapeHtml(form.token)}">
    <input type="hidden" name="action" value="${form.action}">
    <button type="submit" style="border:0;border-radius:6px;padding:12px 22px;background:${color};color:#fff;font-weight:700;cursor:pointer">${label}</button>
  </form>` : '';
  const html = `<!doctype html><html lang="ms"><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${escapeHtml(heading)} · RefPahang</title>
    <style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#e8eaed;font-family:Arial,sans-serif;color:#111827;padding:20px;box-sizing:border-box}
    main{background:white;width:min(100%,500px);box-shadow:0 2px 12px #0002;border-top:6px solid #111827;padding:30px;box-sizing:border-box}
    h1{font-size:22px;margin:0 0 18px}p{line-height:1.6;color:#475569}form{margin-top:24px}</style>
    </head><body><main><h1>${escapeHtml(heading)}</h1>
    ${paragraphs.map((text) => `<p>${escapeHtml(text)}</p>`).join('')}${confirmation}
    </main></body></html>`;
  return new Response(html,{status,headers:{
    'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store',
    'Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff',
    'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'",
  }});
}

async function formFields(request: Request): Promise<URLSearchParams | null> {
  if (request.headers.get('Content-Type')?.split(';')[0] !== 'application/x-www-form-urlencoded' ||
      Number(request.headers.get('Content-Length') ?? 0) > 2048) return null;
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 2048) { await reader.cancel(); return null; }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk,offset); offset += chunk.byteLength; }
  try { return new URLSearchParams(new TextDecoder('utf-8',{fatal:true}).decode(bytes)); }
  catch { return null; }
}

/** GET is a read-only confirmation page. Only a deliberate same-origin POST replies. */
export async function appointmentEmailLink(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'POST') {
    return page('Kaedah Tidak Sah',['Gunakan pautan daripada emel anda.'],undefined,405);
  }
  if (env.STAGING_AUTH_ENABLED !== '1' || env.STAGING_WRITES_ENABLED !== '1' ||
      env.APPOINTMENT_DELIVERY_ENABLED !== '1') {
    return new Response('Pautan jawapan belum tersedia di staging.',{
      status:503,headers:{'Cache-Control':'no-store','Content-Type':'text/plain; charset=utf-8'},
    });
  }
  const params = request.method === 'GET' ? new URL(request.url).searchParams : await formFields(request);
  const token = params?.get('token') ?? '';
  const action = params?.get('action') ?? '';
  if (!params || params.getAll('token').length !== 1 || params.getAll('action').length !== 1 ||
      !/^(?:[a-fA-F0-9]{32}|[a-fA-F0-9]{64})$/.test(token) ||
      (action !== 'accept' && action !== 'reject')) {
    return page('Pautan Tidak Sah',['Pautan ini tidak sah atau tidak lengkap. Sila semak emel anda.']);
  }
  const appointment = await env.DB.prepare(`
    SELECT lp.id,lp.status,lp.jawatan,lp.pengadil_id,lp.notif_hantar,lp.tarikh_notif,
      jp.tarikh,jp.masa,jp.pasukan_home,jp.pasukan_away,jp.tempat,k.jenis_kejohanan
    FROM lantikan_pengadil lp
    JOIN jadual_perlawanan jp ON jp.id=lp.jadual_id
    LEFT JOIN kejohanan k ON k.id=jp.kejohanan_id
    WHERE lp.email_token=? LIMIT 1
  `).bind(token).first<LinkAppointment>();
  if (!appointment) return page('Pautan Tidak Sah',[
    'Pautan ini tidak dapat dikenal pasti. Tugasan mungkin sudah dijawab atau dikemas kini.']);
  if (appointment.status !== 'Belum Jawab') {
    return page('Tugasan Sudah Dijawab',['Tugasan ini sudah dijawab. Tiada tindakan lanjut diperlukan.']);
  }
  if (request.method === 'GET') {
    if (expiryDeadline(appointment) !== null) {
      return page('Tempoh Menjawab Tamat',[
        'Tempoh menjawab telah tamat. Sila hubungi pentadbir jika anda masih boleh bertugas.']);
    }
    return page('Sahkan Jawapan Lantikan',[
      `Sahkan ${action === 'accept' ? 'penerimaan' : 'penolakan'} lantikan sebagai ${appointment.jawatan}.`,
      `${appointment.pasukan_home} lwn ${appointment.pasukan_away} pada ${appointment.tarikh}.`,
    ],{ token, action });
  }
  const result = await recordAppointmentReply(env,appointment.id,action,'',
    { kind:'email',value:token });
  if (result.kind === 'expired') return page('Tempoh Menjawab Tamat',[
    'Tempoh menjawab telah tamat dan lantikan ini telah ditolak secara automatik.']);
  if (result.kind === 'already_answered' || result.kind === 'not_found') {
    return page('Tugasan Sudah Dijawab',[
      'Tugasan ini sudah dijawab atau pautan tidak lagi aktif. Tiada tindakan lanjut diperlukan.']);
  }
  return result.status === 'Diterima'
    ? page('Tugasan Diterima',[
      `Anda telah menerima tugasan sebagai ${appointment.jawatan}.`,
      `${appointment.pasukan_home} lwn ${appointment.pasukan_away} pada ${appointment.tarikh} di ${appointment.tempat ?? '-'}.`,
      'Sila bawa kelengkapan penuh pengadil.'])
    : page('Tugasan Ditolak',[
      `Anda telah menolak tugasan sebagai ${appointment.jawatan}. Pentadbir telah dimaklumkan.`]);
}
