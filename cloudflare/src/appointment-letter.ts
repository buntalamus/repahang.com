/**
 * Surat Lantikan: a PDF appointment letter for one accepted appointment.
 * New in the Worker (the PHP system had none). GET with a session returns the
 * PDF; POST returns a short-lived signed link so the mobile app can open it in
 * the phone's browser or PDF viewer without a cookie.
 */
import { currentUser, json } from './auth';
import { boundedJson } from './request';
import type { Env } from './types';

const LINK_SECONDS = 600;
const encoder = new TextEncoder();
const MONTHS = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'];
const ORDER = `CASE lp.jawatan WHEN 'Pengadil' THEN 1 WHEN 'Penolong Pengadil 1' THEN 2
  WHEN 'Penolong Pengadil 2' THEN 3 WHEN 'Pegawai ke4' THEN 4 WHEN 'Penilai Pengadil' THEN 5 ELSE 6 END`;

interface Letter {
  id: number;
  pengadil_id: number;
  jadual_id: number;
  jawatan: string;
  status: string;
  tarikh_jawab: string | null;
  nama_penuh: string | null;
  jenis_pengadil: string | null;
  no_perlawanan: string | null;
  tarikh: string | null;
  masa: string | null;
  hari: string | null;
  kategori: string | null;
  peringkat: string | null;
  kumpulan: string | null;
  pasukan_home: string | null;
  pasukan_away: string | null;
  tempat: string | null;
  nama_kejohanan: string | null;
  peringkat_kejohanan: string | null;
}

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}

function page(message: string, status: number): Response {
  return new Response(`<!doctype html><html lang="ms"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Surat Lantikan</title><p style="font-family:Arial,sans-serif;padding:24px">${escapeHtml(message)}</p></html>`, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}

function idOf(raw: unknown): number | null {
  const text = String(raw ?? '');
  if (!/^[1-9]\d{0,15}$/.test(text)) return null;
  const value = Number(text);
  return Number.isSafeInteger(value) ? value : null;
}

/** "2026-10-21" → "21 Oktober 2026". */
function longDate(raw: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw ?? '');
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : '-';
}

function time(raw: string | null): string {
  return /^\d{2}:\d{2}/.test(raw ?? '') ? (raw as string).slice(0, 5) : '-';
}

async function hmacKey(env: Env): Promise<CryptoKey | null> {
  const secret = env.APPOINTMENT_LETTER_SECRET ?? '';
  if (secret.length < 32) return null;
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

function hex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(text: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[0-9a-f]{64}$/.test(text)) return null;
  return Uint8Array.from(text.match(/../g)!.map((pair) => parseInt(pair, 16)));
}

/** A link to the letter for [userId], valid for ten minutes. */
export async function signedLetterUrl(env: Env, origin: string, id: number, userId: number, now = Date.now()): Promise<string | null> {
  const key = await hmacKey(env);
  if (!key) return null;
  const exp = Math.floor(now / 1000) + LINK_SECONDS;
  const sig = hex(await crypto.subtle.sign('HMAC', key, encoder.encode(`${id}.${userId}.${exp}`)));
  return `${origin}/api/surat-lantikan.php?id=${id}&u=${userId}&exp=${exp}&sig=${sig}`;
}

/** The user a valid signed link was issued to, or null. */
async function signedUser(env: Env, params: URLSearchParams, id: number): Promise<number | null> {
  const userId = idOf(params.get('u'));
  const exp = idOf(params.get('exp'));
  const sig = fromHex(params.get('sig') ?? '');
  const key = await hmacKey(env);
  if (!userId || !exp || !sig || !key || exp < Date.now() / 1000) return null;
  const ok = await crypto.subtle.verify('HMAC', key, sig, encoder.encode(`${id}.${userId}.${exp}`));
  return ok ? userId : null;
}

async function logoDataUri(env: Env, request: Request): Promise<string> {
  try {
    const response = await env.ASSETS.fetch(new URL('/assets/Pahang_FA_logo.png', request.url));
    if (!response.ok) return '';
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length > 2_000_000) return '';
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return `data:image/png;base64,${btoa(binary)}`;
  } catch {
    return '';
  }
}

interface CrewMember {
  jawatan: string;
  nama: string | null;
  daerah: string | null;
  negeri: string | null;
  no_telefon: string | null;
}

export function letterHtml(letter: Letter, crew: CrewMember[], logo: string, printedAt: string): string {
  const year = (letter.tarikh ?? '').slice(0, 4) || new Date().getFullYear();
  const reference = `PBNP/LTK/${year}/${letter.id}`;
  const stage = [letter.peringkat_kejohanan, letter.kategori, letter.peringkat, letter.kumpulan].filter(Boolean).join(' · ');
  const row = (label: string, value: string) =>
    `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`;
  const crewRows = crew.length
    ? crew.map((c) => {
      const region = [c.daerah, c.negeri].map((v) => (v ?? '').trim()).filter(Boolean).join(', ');
      return `<tr><td class="nowrap">${escapeHtml(c.jawatan)}</td><td>${escapeHtml(c.nama ?? '-')}</td>`
        + `<td>${escapeHtml(region || '-')}</td><td class="nowrap">${escapeHtml(c.no_telefon?.trim() || '-')}</td></tr>`;
    }).join('')
    : '<tr><td colspan="4">Tiada pegawai lain direkodkan.</td></tr>';
  return `<!doctype html><html lang="ms"><head><meta charset="utf-8"><title>Surat Lantikan ${escapeHtml(reference)}</title>
<style>
  @page { size: A4; margin: 14mm 18mm; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 10.5pt; line-height: 1.4; margin: 0; }
  p { margin: 0 0 8px; }
  .head { display: flex; align-items: center; gap: 14px; border-bottom: 3px solid #fada00; padding-bottom: 8px; }
  .head img { width: 58px; height: 58px; }
  .org { font-size: 14pt; font-weight: 700; letter-spacing: .3px; }
  .sub { font-size: 9.5pt; color: #444; }
  .meta { display: flex; justify-content: space-between; margin: 12px 0 10px; font-size: 10pt; }
  h1 { font-size: 12.5pt; text-align: center; text-decoration: underline; margin: 12px 0 8px; }
  table { width: 100%; border-collapse: collapse; margin: 6px 0 10px; }
  .details th { text-align: left; width: 30%; font-weight: 600; padding: 4px 8px; background: #f4f4f4; border: 1px solid #ccc; }
  .details td, .crew td, .crew th { padding: 4px 8px; border: 1px solid #ccc; }
  .crew { font-size: 9.5pt; }
  .crew th { background: #111; color: #fada00; text-align: left; }
  .crew .nowrap { white-space: nowrap; }
  .sign { margin-top: 18px; font-weight: 700; }
  .note { margin-top: 18px; font-size: 8.5pt; color: #555; border-top: 1px solid #ccc; padding-top: 6px; }
</style></head><body>
<div class="head">${logo ? `<img src="${logo}" alt="">` : ''}<div>
  <div class="org">PERSATUAN BOLASEPAK NEGERI PAHANG</div>
  <div class="sub">Sistem Pengurusan Pengadil PBNP · refpahang.com</div></div></div>
<div class="meta"><div>Rujukan: <strong>${escapeHtml(reference)}</strong></div><div>Tarikh: ${escapeHtml(longDate(letter.tarikh_jawab))}</div></div>
<p>Kepada:<br><strong>${escapeHtml(letter.nama_penuh ?? '-')}</strong><br>${escapeHtml(letter.jenis_pengadil ?? '')}</p>
<p>Tuan/Puan,</p>
<h1>SURAT LANTIKAN PEGAWAI PERLAWANAN</h1>
<p>Dengan hormatnya perkara di atas adalah dirujuk.</p>
<p>2.&nbsp; Tuan/Puan dilantik sebagai <strong>${escapeHtml(letter.jawatan)}</strong> bagi perlawanan berikut:</p>
<table class="details">
  ${row('Kejohanan', letter.nama_kejohanan ?? '-')}
  ${stage ? row('Peringkat', stage) : ''}
  ${row('No. Perlawanan', letter.no_perlawanan ?? '-')}
  ${row('Perlawanan', `${letter.pasukan_home ?? '-'} lwn ${letter.pasukan_away ?? '-'}`)}
  ${row('Hari / Tarikh', `${letter.hari ? `${letter.hari}, ` : ''}${longDate(letter.tarikh)}`)}
  ${row('Masa', time(letter.masa))}
  ${row('Tempat', letter.tempat ?? '-')}
</table>
<p>3.&nbsp; Pegawai yang bertugas bersama:</p>
<table class="crew"><tr><th>Jawatan</th><th>Nama</th><th style="width:20%">Daerah / Negeri</th><th>No. Telefon</th></tr>${crewRows}</table>
<p>4.&nbsp; Lantikan ini telah diterima melalui sistem pada ${escapeHtml(longDate(letter.tarikh_jawab))}${letter.tarikh_jawab ? `, ${escapeHtml(time(letter.tarikh_jawab.slice(11)))}` : ''}.
Tuan/Puan diminta hadir lebih awal sebelum perlawanan bermula dan mematuhi Undang-Undang Permainan serta arahan pihak penganjur.</p>
<p>Sekian, terima kasih.</p>
<p class="sign">Urusetia Lantikan Pengadil</p>
<div class="note">Surat ini dijana oleh komputer dan tidak memerlukan tandatangan. Dicetak pada ${escapeHtml(printedAt)}.</div>
</body></html>`;
}

/** GET → PDF (session or signed link). POST {id} → {url} signed link for the app. */
export async function appointmentLetter(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === 'POST') {
    const user = await currentUser(request, env);
    if (!user) return json({ error: true, message: 'Sesi tidak sah. Sila log masuk semula.' }, 401);
    const input = await boundedJson(request);
    if (input instanceof Response) return input;
    const id = idOf((input as Record<string, unknown> | null)?.id);
    if (!id) return json({ error: true, message: 'ID lantikan diperlukan.' }, 400);
    const denied = await accessError(env, id, user.id, user.role);
    if (denied) return json({ error: true, message: denied.message }, denied.status);
    const link = await signedLetterUrl(env, url.origin, id, user.id);
    if (!link) return json({ error: true, message: 'Surat lantikan belum tersedia.' }, 503);
    return json({ error: false, url: link });
  }
  if (request.method !== 'GET') return page('Kaedah tidak dibenarkan.', 405);
  const id = idOf(url.searchParams.get('id'));
  if (!id) return page('ID lantikan diperlukan.', 400);
  let userId: number;
  let role: string;
  if (url.searchParams.has('sig')) {
    const signed = await signedUser(env, url.searchParams, id);
    if (!signed) return page('Pautan surat telah tamat tempoh atau tidak sah. Sila buka semula dari app.', 403);
    const owner = await env.DB.prepare('SELECT role FROM users WHERE id=? AND aktif=1').bind(signed).first<{ role: string }>();
    if (!owner) return page('Akaun tidak aktif.', 403);
    userId = signed;
    role = owner.role;
  } else {
    const user = await currentUser(request, env);
    if (!user) return page('Sila log masuk untuk melihat surat lantikan.', 401);
    userId = user.id;
    role = user.role;
  }
  const denied = await accessError(env, id, userId, role);
  if (denied) return page(denied.message, denied.status);
  const letter = (await loadLetter(env, id))!;
  const crew = (await env.DB.prepare(`SELECT lp.jawatan,COALESCE(u.nama_penuh,pl.nama) AS nama,
      CASE WHEN lp.pengadil_id IS NOT NULL THEN u.daerah ELSE pl.daerah END AS daerah,
      CASE WHEN lp.pengadil_id IS NOT NULL THEN u.negeri ELSE pl.negeri END AS negeri,
      CASE WHEN lp.pengadil_id IS NOT NULL THEN u.no_telefon ELSE pl.no_tel END AS no_telefon
      FROM lantikan_pengadil lp LEFT JOIN users u ON u.id=lp.pengadil_id
      LEFT JOIN pengadil_luar pl ON pl.id=lp.pengadil_luar_id
    WHERE lp.jadual_id=? AND lp.id<>? AND lp.status IN ('Belum Jawab','Diterima') ORDER BY ${ORDER},lp.id`)
    .bind(letter.jadual_id, letter.id).all<CrewMember>()).results;
  const printedAt = new Intl.DateTimeFormat('ms-MY', {
    timeZone: 'Asia/Kuala_Lumpur', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date());
  let rendered: Response;
  try {
    rendered = await env.BROWSER.quickAction('pdf', {
      html: letterHtml(letter, crew, await logoDataUri(env, request), printedAt), cacheTTL: 0,
      pdfOptions: { format: 'a4', printBackground: true, preferCSSPageSize: true },
    });
  } catch {
    return page('PDF belum dapat dijana. Sila cuba semula.', 503);
  }
  if (!rendered.ok || !rendered.headers.get('Content-Type')?.includes('application/pdf')) {
    return page('PDF belum dapat dijana. Sila cuba semula.', 503);
  }
  const safe = (value: string | null) => (value ?? '').replace(/[^A-Za-z0-9-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
  return new Response(rendered.body, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="Surat_Lantikan_${safe(letter.no_perlawanan) || letter.id}_${safe(letter.nama_penuh)}.pdf"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    },
  });
}

async function loadLetter(env: Env, id: number): Promise<Letter | null> {
  return env.DB.prepare(`SELECT lp.id,lp.pengadil_id,lp.jadual_id,lp.jawatan,lp.status,lp.tarikh_jawab,
      u.nama_penuh,u.jenis_pengadil,jp.no_perlawanan,jp.tarikh,jp.masa,jp.hari,jp.kategori,jp.peringkat,
      jp.kumpulan,jp.pasukan_home,jp.pasukan_away,jp.tempat,k.nama AS nama_kejohanan,k.peringkat_kejohanan
    FROM lantikan_pengadil lp JOIN users u ON u.id=lp.pengadil_id
    JOIN jadual_perlawanan jp ON jp.id=lp.jadual_id LEFT JOIN kejohanan k ON k.id=jp.kejohanan_id
    WHERE lp.id=?`).bind(id).first<Letter>();
}

/** Only the appointed official (or Admin) may see the letter, and only once accepted. */
async function accessError(env: Env, id: number, userId: number, role: string): Promise<{ status: number; message: string } | null> {
  const letter = await loadLetter(env, id);
  if (!letter || (letter.pengadil_id !== userId && role !== 'Admin')) {
    return { status: 404, message: 'Lantikan tidak dijumpai.' };
  }
  if (letter.status !== 'Diterima') {
    return { status: 403, message: 'Surat lantikan hanya tersedia selepas lantikan diterima.' };
  }
  return null;
}
