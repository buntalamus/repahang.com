/**
 * Port of config/email.php. Markup and copy are kept byte-for-byte where the
 * PHP source is deterministic so recipients see the same messages after the
 * move to the Worker.
 */
import { renderEmailLayout, sendRefpahangEmail } from '../../mail';
import type { MailAttachment, MailType } from '../../mail';
import type { Env } from '../types';
import { getMatchKickoffTimestamp, h, klTimestamp, masaFmt, noMatchFmt, phpDate, plainTextFromHtml, tarikhFmt } from './format';

export interface InlineImage { cid: string; mime: string; data: ArrayBuffer }

export interface KupOfficial {
  jawatan?: string | null;
  nama?: string | null;
  no_telefon?: string | null;
  wilayah?: string | null;
}

/** Test seam with the same meaning as PHP's optional sender callbacks. */
export type EmailSender = (to: string, subject: string, html: string, toName: string,
  type: MailType, inlineImages: InlineImage[]) => Promise<boolean>;

let emailSenderOverride: EmailSender | null = null;
export function setEmailSenderForTests(sender: EmailSender | null): void {
  emailSenderOverride = sender;
}

export function baseUrl(env: Env): string {
  return env.BASE_URL || 'https://refpahang.com';
}

/** Official PBNP letterhead; shared with every Worker email through mail.ts. */
export function buildEmailTemplate(title: string, accent: string, _icon: string, body: string): string {
  return renderEmailLayout(title, accent, body);
}

export function emailGreeting(nama: string): string {
  return `<p style="color:#6B7280;font-size:14px;line-height:1.7;margin:0 0 4px 0;">
              Assalamualaikum w.b.t. dan Salam Sejahtera,
            </p>
            <p style="color:#111827;font-size:15px;font-weight:600;margin:0 0 22px 0;
                       border-bottom:1px solid #F3F4F6;padding-bottom:18px;">
              ${h(nama)},
            </p>`;
}

export function emailPara(text: string): string {
  return `<p style="color:#374151;font-size:14px;line-height:1.8;margin:0 0 16px 0;">${text}</p>`;
}

export function emailAlert(borderColor: string, bgColor: string, label: string, text: string): string {
  return `<div style="background:${bgColor};border-left:3px solid ${borderColor};
                         padding:14px 18px;margin:20px 0;">
              <div style="font-weight:700;color:#111827;margin-bottom:5px;font-size:12px;
                          text-transform:uppercase;letter-spacing:0.8px;">
                ${label}
              </div>
              <div style="color:#374151;font-size:14px;line-height:1.6;">${text}</div>
            </div>`;
}

/** Key–value table; values are inserted as HTML exactly like PHP. */
export function emailInfoTable(rows: Array<[string, string]>): string {
  let html = `<table width="100%" cellpadding="0" cellspacing="0" border="0"
                    style="margin:20px 0;border:1px solid #E5E7EB;border-collapse:collapse;">`;
  const last = rows.length - 1;
  rows.forEach(([label, value], i) => {
    const border = i < last ? 'border-bottom:1px solid #E5E7EB;' : '';
    const bg = i % 2 === 0 ? '#F9FAFB' : '#ffffff';
    html += `<tr>
                    <td style="padding:10px 16px;font-weight:600;color:#6B7280;
                                font-size:11px;text-transform:uppercase;letter-spacing:0.8px;
                                width:36%;background:${bg};${border}">${h(label)}</td>
                    <td style="padding:10px 16px;color:#111827;font-size:14px;
                                background:${bg};${border}">${value}</td>
                  </tr>`;
  });
  html += '</table>';
  return html;
}

export function emailCredBox(label: string, value: string): string {
  return `<div style="margin:10px 0;">
              <div style="font-size:10px;font-weight:700;color:#6B7280;text-transform:uppercase;
                           letter-spacing:1px;margin-bottom:5px;">${label}</div>
              <div style="background:#F3F4F6;border:1px solid #D1D5DB;
                           padding:10px 14px;font-family:'Courier New',monospace;
                           font-size:15px;color:#111827;word-break:break-all;">${value}</div>
            </div>`;
}

export function emailButton(url: string, label: string): string {
  return `<div style="text-align:center;margin:28px 0 8px;">
              <a href="${url}"
                 style="display:inline-block;background:#111827;color:#FADA00;
                         padding:12px 32px;text-decoration:none;
                         font-weight:700;font-size:13px;letter-spacing:1px;
                         text-transform:uppercase;">${label}</a>
            </div>`;
}

export function emailOrderedList(items: string[]): string {
  let html = '<ol style="color:#374151;font-size:14px;line-height:1.8;margin:0 0 16px 0;padding-left:20px;">';
  for (const item of items) html += `<li style="margin-bottom:6px;">${item}</li>`;
  return `${html}</ol>`;
}

export function emailStatusBadge(text: string, bg: string, color = '#ffffff'): string {
  return `<div style="text-align:center;margin:20px 0;">
              <span style="display:inline-block;background:${bg};color:${color};
                            padding:6px 20px;font-weight:700;font-size:11px;
                            letter-spacing:1.5px;text-transform:uppercase;">${text}</span>
            </div>`;
}

/** sendEmail(): false on any delivery failure, like _smtpSend(). */
export async function sendEmail(env: Env, to: string, subject: string, html: string,
  toName: string | null = null, type: MailType = 'admin', inlineImages: InlineImage[] = [],
  attachments: MailAttachment[] = []): Promise<boolean> {
  const name = toName ?? to;
  if (emailSenderOverride) return emailSenderOverride(to, subject, html, name, type, inlineImages);
  try {
    await sendRefpahangEmail(env, type, to, name || to, subject, html, plainTextFromHtml(html), [
      ...inlineImages.map((image): MailAttachment => ({
        filename: image.cid, type: image.mime, content: image.data,
        disposition: 'inline', contentId: image.cid,
      })),
      ...attachments,
    ]);
    return true;
  } catch (error) {
    console.error('Email delivery failed', type, error instanceof Error ? error.name : 'UnknownError');
    return false;
  }
}

export function buildKupOfficialsEmailSection(allOfficials: KupOfficial[], jawatan: string,
  regionLabel: string): string {
  if (allOfficials.length === 0) return '';
  let offRows = '';
  allOfficials.forEach((off, i) => {
    const officialJawatan = String(off.jawatan ?? '');
    const officialNama = String(off.nama ?? '-');
    const officialPhone = String(off.no_telefon ?? '-');
    const officialRegion = String(off.wilayah ?? '-');
    const isMe = officialJawatan.trim().toLowerCase() === jawatan.trim().toLowerCase();
    const bg = isMe ? '#FEFCE8' : (i % 2 === 0 ? '#F9FAFB' : '#ffffff');
    const namStyle = isMe
      ? 'font-size:13px;color:#92400E;font-weight:700;'
      : 'font-size:13px;color:#111827;';
    const jwStyle = isMe
      ? 'font-size:11px;color:#92400E;font-weight:700;text-transform:uppercase;letter-spacing:.8px;'
      : 'font-size:11px;color:#6B7280;font-weight:600;text-transform:uppercase;letter-spacing:.8px;';
    const badge = isMe
      ? `<span style="display:inline-block;background:#FADA00;color:#111827;
                            font-size:9px;font-weight:700;letter-spacing:1px;
                            text-transform:uppercase;padding:2px 7px;margin-left:6px;
                            vertical-align:middle;">Anda</span>`
      : '';
    const border = 'border-bottom:1px solid #E5E7EB;';
    offRows += `<tr>
            <td style="padding:10px 16px;${jwStyle}background:${bg};${border}">${h(officialJawatan)}</td>
            <td style="padding:10px 16px;${namStyle}background:${bg};${border}">
              <div>${h(officialNama)}${badge}</div>
              <div style="font-size:11px;color:#6B7280;font-weight:400;margin-top:4px;line-height:1.6;">
                <strong>No. Tel:</strong> ${h(officialPhone)}<br>
                <strong>${h(regionLabel)}:</strong> ${h(officialRegion)}
              </div>
            </td>
          </tr>`;
  });
  return `
    <div style="margin:20px 0 0;">
      <div style="background:#FADA00;padding:9px 16px;">
        <span style="font-size:10px;font-weight:700;color:#111827;letter-spacing:2px;
                      text-transform:uppercase;">Krew KUP Perlawanan</span>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0"
             style="border-collapse:collapse;border:1px solid #E5E7EB;border-top:none;">
        ${offRows}
      </table>
    </div>`;
}

export function buildKupCrewCompleteEmailHtml(nama: string, jawatan: string, kejohanan: string,
  tarikh: string, masa: string, tempat: string, pasukanHome: string, pasukanAway: string,
  noMatch: string, kupOfficials: KupOfficial[], regionLabel: string): string {
  const body = emailGreeting(nama)
    + emailPara('Semua KUP yang dilantik telah menerima lantikan. Gunakan nombor telefon yang '
      + 'disenaraikan untuk berhubung dan menyelaras tugasan perlawanan.')
    + emailInfoTable([
      ['Kejohanan', h(kejohanan)],
      ['No. Perlawanan', h(noMatchFmt(noMatch))],
      ['Perlawanan', h(`${pasukanHome} lwn ${pasukanAway}`)],
      ['Tarikh', tarikhFmt(tarikh)],
      ['Masa', `${masaFmt(masa)} MYT`],
      ['Tempat', h(tempat)],
    ])
    + buildKupOfficialsEmailSection(kupOfficials, jawatan, regionLabel);
  return buildEmailTemplate('Krew KUP Lengkap', '#16A34A', '', body);
}

export function sendKupCrewCompleteEmail(env: Env, to: string, nama: string, jawatan: string,
  kejohanan: string, tarikh: string, masa: string, tempat: string, pasukanHome: string,
  pasukanAway: string, noMatch: string, kupOfficials: KupOfficial[], regionLabel: string): Promise<boolean> {
  const html = buildKupCrewCompleteEmailHtml(nama, jawatan, kejohanan, tarikh, masa, tempat,
    pasukanHome, pasukanAway, noMatch, kupOfficials, regionLabel);
  const subject = `Krew KUP Lengkap: ${pasukanHome} vs ${pasukanAway} — ${tarikhFmt(tarikh)}`;
  return sendEmail(env, to, subject, html, nama, 'lantikan');
}

function logoMime(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
    webp: 'image/webp' } as Record<string, string>)[ext] ?? 'image/png';
}

/** file_exists($projectRoot . $logoPath): uploads live in the MEDIA bucket. */
async function readUpload(env: Env, logoPath: string): Promise<ArrayBuffer | null> {
  if (!logoPath.startsWith('/uploads/') || logoPath.includes('..')) return null;
  const object = await env.MEDIA.get(logoPath.slice('/uploads/'.length));
  return object ? object.arrayBuffer() : null;
}

async function makeLogo(env: Env, logoPath: string, namaTeam: string, cidName: string,
  inlineImages: InlineImage[], cancelled: boolean): Promise<string> {
  const faded = cancelled ? `
                                    opacity:0.5;filter:grayscale(100%)` : '';
  if (logoPath) {
    const data = await readUpload(env, logoPath);
    if (data) {
      inlineImages.push({ cid: cidName, mime: logoMime(logoPath), data });
      return `<img src="cid:${cidName}" alt="${h(namaTeam)}"
                            width="72" height="72"
                            style="width:72px;height:72px;object-fit:contain;display:block;margin:0 auto;${faded}">`;
    }
    const url = logoPath.indexOf('http') === 0 ? logoPath : baseUrl(env) + logoPath;
    return `<img src="${h(url)}" alt="${h(namaTeam)}"
                        width="72" height="72"
                        style="width:72px;height:72px;object-fit:contain;display:block;margin:0 auto;${faded}">`;
  }
  const initial = Array.from(namaTeam.trim())[0]?.toUpperCase() ?? '';
  return cancelled
    ? `<div style="width:72px;height:72px;border-radius:50%;background:#E5E7EB;
                             font-size:28px;font-weight:700;color:#9CA3AF;margin:0 auto;
                             line-height:72px;text-align:center;">${initial}</div>`
    : `<div style="width:72px;height:72px;border-radius:50%;background:#E5E7EB;
                             display:flex;align-items:center;justify-content:center;
                             font-size:28px;font-weight:700;color:#6B7280;margin:0 auto;
                             line-height:72px;text-align:center;">${initial}</div>`;
}

export function getDeadlineHours(jenisKejohanan: string): number {
  return jenisKejohanan.toLowerCase() === 'liga' ? 48 : 3;
}

export function getDeadlineRuleText(jenisKejohanan: string): string {
  const hours = getDeadlineHours(jenisKejohanan);
  return `Anda perlu menjawab lantikan ini dalam masa ${hours} jam selepas notifikasi dihantar. `
    + 'Jika tidak dijawab dalam tempoh tersebut, lantikan akan DITOLAK secara automatik.';
}

export function calcDeadlineFromNotif(jenisKejohanan: string, notifMs = Date.now()): string {
  return phpDate('d M Y, H:i', notifMs + getDeadlineHours(jenisKejohanan) * 3600_000);
}

/**
 * The answer deadline shown to an official. Auto-reject applies only when the
 * answer window ends before kick-off; when the match starts first, the official
 * is asked to answer before kick-off instead, without an auto-reject warning.
 */
export function appointmentDeadline(jenisKejohanan: string, tarikh: string, masa: string,
  notifMs = Date.now()): { sentence: string; rule: string; html: string; label: string } {
  const hours = getDeadlineHours(jenisKejohanan);
  const windowEnd = notifMs + hours * 3600_000;
  const kickoff = getMatchKickoffTimestamp(tarikh, masa);
  if (kickoff !== null && kickoff <= windowEnd) {
    const at = phpDate('d M Y, H:i', kickoff);
    return {
      sentence: `sebelum perlawanan bermula (${at})`,
      rule: `Perlawanan ini bermula sebelum tempoh menjawab ${hours} jam tamat, jadi sila jawab sebelum perlawanan bermula.`,
      html: `sebelum perlawanan bermula (<strong>${at}</strong>)`,
      label: 'Tempoh Menjawab',
    };
  }
  const at = phpDate('d M Y, H:i', windowEnd);
  return {
    sentence: `sebelum ${at} (${hours} jam selepas notifikasi ini dihantar)`,
    rule: getDeadlineRuleText(jenisKejohanan),
    html: `<strong>sebelum ${at}</strong> (${hours} jam selepas notifikasi ini dihantar)`,
    label: 'Peraturan Auto-Tolak',
  };
}

export async function sendLantikanEmail(env: Env, to: string, nama: string, jawatan: string,
  kejohanan: string, tarikh: string, masa: string, tempat: string, pasukanHome: string,
  pasukanAway: string, emailToken: string, tgLinkUrl: string | null = null, isDashboard = false,
  noMatch = '', logoHome = '', logoAway = '', allOfficials: KupOfficial[] = [],
  jenisKejohanan = 'Persahabatan', regionLabel = 'Negeri'): Promise<boolean> {
  const base = baseUrl(env);
  const acceptUrl = `${base}/api/lantikan-jawab-token.php?token=${encodeURIComponent(emailToken)}&action=accept`;
  const rejectUrl = `${base}/api/lantikan-jawab-token.php?token=${encodeURIComponent(emailToken)}&action=reject`;
  const noFmt = noMatchFmt(noMatch);
  const inlineImages: InlineImage[] = [];
  const infoRows: Array<[string, string]> = [
    ['Kejohanan', h(kejohanan)],
    ['No. Perlawanan', h(noFmt)],
    ['Tarikh', tarikhFmt(tarikh)],
    ['Masa', `${masaFmt(masa)} MYT`],
    ['Tempat', h(tempat)],
  ];
  let infoHtml = '';
  infoRows.forEach(([lbl, val], i) => {
    const bg = i % 2 === 0 ? '#1F2937' : '#111827';
    infoHtml += `<tr>
            <td style="padding:10px 16px;font-size:11px;font-weight:600;color:#9CA3AF;
                        text-transform:uppercase;letter-spacing:.8px;width:38%;background:${bg};
                        border-bottom:1px solid #374151;">${lbl}</td>
            <td style="padding:10px 16px;font-size:13px;color:#F9FAFB;background:${bg};
                        border-bottom:1px solid #374151;">${val}</td>
          </tr>`;
  });
  const sectionInfo = `
    <div style="margin:28px 0 0;">
      <div style="background:#FADA00;padding:9px 16px;">
        <span style="font-size:10px;font-weight:700;color:#111827;letter-spacing:2px;
                      text-transform:uppercase;">Maklumat Perlawanan</span>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0"
             style="border-collapse:collapse;border:1px solid #374151;">
        ${infoHtml}
      </table>
    </div>`;
  const logoHomeHtml = await makeLogo(env, logoHome, pasukanHome, 'logo_home', inlineImages, false);
  const logoAwayHtml = await makeLogo(env, logoAway, pasukanAway, 'logo_away', inlineImages, false);
  const sectionPasukan = `
    <div style="margin:20px 0 0;">
      <div style="background:#FADA00;padding:9px 16px;">
        <span style="font-size:10px;font-weight:700;color:#111827;letter-spacing:2px;
                      text-transform:uppercase;">Pasukan</span>
      </div>
      <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-top:none;padding:24px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="44%" style="text-align:center;vertical-align:middle;">
              ${logoHomeHtml}
              <div style="font-weight:700;font-size:12px;color:#111827;margin-top:10px;
                          text-transform:uppercase;line-height:1.4;">${h(pasukanHome)}
              </div>
              <div style="font-size:10px;color:#9CA3AF;margin-top:3px;">Tuan Rumah</div>
            </td>
            <td width="12%" style="text-align:center;vertical-align:middle;">
              <div style="font-size:13px;font-weight:700;color:#374151;letter-spacing:1px;">VS</div>
            </td>
            <td width="44%" style="text-align:center;vertical-align:middle;">
              ${logoAwayHtml}
              <div style="font-weight:700;font-size:12px;color:#111827;margin-top:10px;
                          text-transform:uppercase;line-height:1.4;">${h(pasukanAway)}
              </div>
              <div style="font-size:10px;color:#9CA3AF;margin-top:3px;">Pasukan Tamu</div>
            </td>
          </tr>
        </table>
      </div>
    </div>`;
  const officialsHtml = buildKupOfficialsEmailSection(allOfficials, jawatan, regionLabel);
  const deadline = appointmentDeadline(jenisKejohanan, tarikh, masa);
  const ruleText = deadline.rule;
  const buttonsHtml = `
    <div style="margin:28px 0 0;">
      <p style="color:#374151;font-size:13px;line-height:1.8;margin:0 0 10px 0;">
        Sila maklumkan penerimaan atau penolakan tugasan ini ${deadline.html}.
      </p>
      <div style="background:#FEF3C7;border:1px solid #F59E0B;border-left:3px solid #F59E0B;
                   padding:12px 16px;margin-bottom:16px;">
        <span style="font-size:12px;font-weight:700;color:#92400E;">⚠ ${deadline.label}:</span>
        <p style="font-size:12px;color:#78350F;line-height:1.6;margin:4px 0 0;">${ruleText}</p>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:0 6px 0 0;">
            <a href="${h(acceptUrl)}"
               style="display:block;text-align:center;background:#059669;color:#ffffff;
                       padding:14px 0;text-decoration:none;font-weight:700;font-size:12px;
                       letter-spacing:1px;text-transform:uppercase;">
              ✓ &nbsp;Terima Tugasan
            </a>
          </td>
          <td style="padding:0 0 0 6px;">
            <a href="${h(rejectUrl)}"
               style="display:block;text-align:center;background:#DC2626;color:#ffffff;
                       padding:14px 0;text-decoration:none;font-weight:700;font-size:12px;
                       letter-spacing:1px;text-transform:uppercase;">
              ✗ &nbsp;Tolak Tugasan
            </a>
          </td>
        </tr>
      </table>
    </div>`;
  const tgSection = tgLinkUrl === null ? '' : `
        <div style="margin:24px 0 0;padding:16px 20px;background:#EFF6FF;
                     border:1px solid #BFDBFE;border-left:3px solid #3B82F6;">
          <div style="font-weight:700;font-size:11px;color:#1E40AF;
                       text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px;">
            Hubungkan Akaun Telegram
          </div>
          <p style="color:#374151;font-size:13px;line-height:1.7;margin:0 0 14px 0;">
            Dapatkan notifikasi perlawanan terus melalui Telegram dan jawab tugasan dengan
            lebih pantas menggunakan butang <em>Terima / Tolak</em> dalam Telegram.
          </p>
          <a href="${h(tgLinkUrl)}"
             style="display:inline-block;background:#2563EB;color:#ffffff;
                     padding:9px 20px;text-decoration:none;font-weight:700;
                     font-size:11px;letter-spacing:.8px;text-transform:uppercase;">
            Daftar Telegram Sekarang
          </a>
        </div>`;
  const dashSection = !isDashboard ? '' : `
        <div style="border-top:1px solid #F3F4F6;margin-top:24px;padding-top:20px;text-align:center;">
          <p style="color:#6B7280;font-size:12px;margin:0 0 12px 0;">
            Lihat semua tugasan anda dalam dashboard:
          </p>${emailButton(`${base}/pengadil-dashboard.html`, 'Dashboard Pengadil')}
        </div>`;
  const body = emailGreeting(nama)
    + emailPara(`Anda telah dilantik sebagai <strong>${h(jawatan)}</strong> untuk perlawanan berikut:`)
    + sectionInfo + sectionPasukan + officialsHtml + buttonsHtml + tgSection + dashSection
    + `<p style="color:#9CA3AF;font-size:11px;margin:24px 0 0;line-height:1.6;">
           Pautan Terima/Tolak di atas hanya boleh digunakan sekali sahaja. Jika anda telah
           menjawab melalui Telegram atau dashboard, pautan ini tidak akan berfungsi lagi.
           Pautan ini juga akan terbatal selepas tempoh menjawab tamat.
         </p>`;
  const subject = `Lantikan Perlawanan: ${kejohanan}${noFmt !== '-' ? ` (No: ${noFmt})` : ''}`
    + ` — ${pasukanHome} vs ${pasukanAway} — ${tarikhFmt(tarikh)}`;
  const html = buildEmailTemplate('Lantikan Pengadil', '#FADA00', '', body);
  return sendEmail(env, to, subject, html, nama, 'lantikan', inlineImages);
}

export async function sendBatalEmail(env: Env, to: string, nama: string, jawatan: string,
  kejohanan: string, tarikh: string, masa: string, tempat: string, pasukanHome: string,
  pasukanAway: string, noMatch = '', logoHome = '', logoAway = '', isDashboard = false,
  status = 'Dibatalkan', sebab = '', scope: 'perlawanan' | 'lantikan' = 'perlawanan'): Promise<boolean> {
  const base = baseUrl(env);
  const noFmt = noMatchFmt(noMatch);
  const inlineImages: InlineImage[] = [];
  const isPostponed = status === 'Ditangguhkan';
  const title = scope === 'lantikan' ? 'Lantikan Dibatalkan'
    : isPostponed ? 'Perlawanan Ditangguhkan' : 'Perlawanan Dibatalkan';
  const statusText = isPostponed ? 'ditangguhkan' : 'dibatalkan';
  const accent = isPostponed ? '#D97706' : '#DC2626';
  const noticeBanner = `
    <div style="background:#FEF2F2;border:1px solid #FECACA;border-left:4px solid ${accent};
                 padding:16px 20px;margin:0 0 4px;">
      <div style="font-weight:700;font-size:12px;color:#991B1B;text-transform:uppercase;
                   letter-spacing:.8px;margin-bottom:6px;">⊗ &nbsp;${title}</div>
      <p style="color:#7F1D1D;font-size:13px;line-height:1.7;margin:0;">
        Lantikan anda sebagai <strong>${h(jawatan)}</strong>
        telah ${statusText} oleh pengurus kejohanan.${sebab !== ''
          ? `<br><strong>Sebab:</strong> ${h(sebab).replace(/(\r\n|\n\r|\n|\r)/g, '<br />$1')}` : ''}
      </p>
    </div>`;
  const infoRows: Array<[string, string]> = [
    ['Kejohanan', h(kejohanan)],
    ['No. Perlawanan', h(noFmt)],
    ['Tarikh', tarikhFmt(tarikh)],
    ['Masa', `${masaFmt(masa)} MYT`],
    ['Tempat', h(tempat)],
  ];
  let infoHtml = '';
  infoRows.forEach(([lbl, val], i) => {
    const bg = i % 2 === 0 ? '#1F2937' : '#111827';
    infoHtml += `<tr>
            <td style="padding:10px 16px;font-size:11px;font-weight:600;color:#9CA3AF;
                        text-transform:uppercase;letter-spacing:.8px;width:38%;background:${bg};
                        border-bottom:1px solid #374151;">${lbl}</td>
            <td style="padding:10px 16px;font-size:13px;color:#9CA3AF;background:${bg};
                        border-bottom:1px solid #374151;text-decoration:line-through;">${val}</td>
          </tr>`;
  });
  const sectionInfo = `
    <div style="margin:20px 0 0;">
      <div style="background:#6B7280;padding:9px 16px;">
        <span style="font-size:10px;font-weight:700;color:#F9FAFB;letter-spacing:2px;
                      text-transform:uppercase;">Maklumat Perlawanan</span>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0"
             style="border-collapse:collapse;border:1px solid #374151;">
        ${infoHtml}
      </table>
    </div>`;
  const logoHomeHtml = await makeLogo(env, logoHome, pasukanHome, 'logo_home', inlineImages, true);
  const logoAwayHtml = await makeLogo(env, logoAway, pasukanAway, 'logo_away', inlineImages, true);
  const sectionPasukan = `
    <div style="margin:20px 0 0;">
      <div style="background:#6B7280;padding:9px 16px;">
        <span style="font-size:10px;font-weight:700;color:#F9FAFB;letter-spacing:2px;
                      text-transform:uppercase;">Pasukan</span>
      </div>
      <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-top:none;padding:24px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="44%" style="text-align:center;vertical-align:middle;">
              ${logoHomeHtml}
              <div style="font-weight:700;font-size:12px;color:#9CA3AF;margin-top:10px;
                          text-transform:uppercase;line-height:1.4;text-decoration:line-through;">${h(pasukanHome)}
              </div>
              <div style="font-size:10px;color:#D1D5DB;margin-top:3px;">Tuan Rumah</div>
            </td>
            <td width="12%" style="text-align:center;vertical-align:middle;">
              <div style="font-size:13px;font-weight:700;color:#D1D5DB;letter-spacing:1px;">VS</div>
            </td>
            <td width="44%" style="text-align:center;vertical-align:middle;">
              ${logoAwayHtml}
              <div style="font-weight:700;font-size:12px;color:#9CA3AF;margin-top:10px;
                          text-transform:uppercase;line-height:1.4;text-decoration:line-through;">${h(pasukanAway)}
              </div>
              <div style="font-size:10px;color:#D1D5DB;margin-top:3px;">Pasukan Tamu</div>
            </td>
          </tr>
        </table>
      </div>
    </div>`;
  const dashSection = !isDashboard ? '' : `
        <div style="border-top:1px solid #F3F4F6;margin-top:24px;padding-top:20px;text-align:center;">
          <p style="color:#6B7280;font-size:12px;margin:0 0 12px 0;">
            Semak status tugasan anda yang lain dalam dashboard:
          </p>${emailButton(`${base}/pengadil-dashboard.html`, 'Dashboard Pengadil')}
        </div>`;
  const body = emailGreeting(nama) + noticeBanner + sectionInfo + sectionPasukan + dashSection
    + `<p style="color:#9CA3AF;font-size:11px;margin:24px 0 0;line-height:1.6;">
           Ini adalah notifikasi automatik. Sila hubungi pengurus kejohanan jika anda mempunyai
           sebarang pertanyaan berkenaan pembatalan ini.
         </p>`;
  const subjectPrefix = scope === 'lantikan' ? 'Pembatalan Lantikan: '
    : isPostponed ? 'Penangguhan Perlawanan: ' : 'Pembatalan Perlawanan: ';
  const subject = `${subjectPrefix}${kejohanan}`
    + `${noFmt !== '-' ? ` (No: ${noFmt})` : ''} — ${pasukanHome} vs ${pasukanAway} — ${tarikhFmt(tarikh)}`;
  const html = buildEmailTemplate(title, accent, '', body);
  return sendEmail(env, to, subject, html, nama, 'lantikan', inlineImages);
}

/** number_format($value, 1) */
function numberFormat1(value: number): string {
  const rounded = Math.round(Math.abs(value) * 10 + Number.EPSILON) / 10;
  return `${value < 0 ? '-' : ''}${rounded.toFixed(1)}`;
}

/** sendPenilaianEmail(): confirmed RA report to one official. */
export function sendPenilaianEmail(env: Env, to: string, nama: string, jawatan: string, kejohanan: string,
  tarikh: string, pasukan: string, penilai: string, markah: number | null = null,
  prestasi: string | null = null, kekuatan: string[] = [], kelemahan: string[] = [], nasihat = '',
  ulasan = '', catatanAdmin = '', reportUrl = '', catatanLabel = 'Catatan Admin'): Promise<boolean> {
  let tarikhText = '-';
  if (tarikh) {
    const bulan = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];
    const ms = klTimestamp(tarikh);
    if (ms) {
      const local = new Date(ms + 8 * 3600_000);
      tarikhText = `${String(local.getUTCDate()).padStart(2, '0')} ${bulan[local.getUTCMonth()]} ${local.getUTCFullYear()}`;
    }
  }
  let markahColor = '#6B7280';
  if (markah !== null) {
    if (markah >= 8.3) markahColor = '#059669';
    else if (markah >= 8.0) markahColor = '#2563EB';
    else if (markah >= 7.5) markahColor = '#D97706';
    else markahColor = '#DC2626';
  }
  let body = emailGreeting(nama)
    + emailPara('Laporan penilaian anda untuk perlawanan berikut telah disahkan.')
    + emailInfoTable([
      ['Kejohanan', h(kejohanan)], ['Perlawanan', h(pasukan)], ['Tarikh', tarikhText],
      ['Jawatan', h(jawatan)], ['Penilai', h(penilai)],
    ]);
  body += `<div style="text-align:center;margin:24px 0;">
                <div style="display:inline-block;background:#F9FAFB;border:2px solid #E5E7EB;padding:16px 32px;">
                  <div style="font-size:10px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Markah Anda</div>
                  <div style="font-size:36px;font-weight:800;color:${markahColor};">${markah !== null ? numberFormat1(markah) : '-'}</div>
                  <div style="font-size:10px;color:#9CA3AF;">/10</div>`
    + (prestasi ? `<div style="font-size:12px;font-weight:600;color:#374151;margin-top:4px;">${h(prestasi)}</div>` : '')
    + '</div></div>';
  if (kekuatan.length > 0) {
    body += `<div style="margin:16px 0;">
                    <div style="font-size:10px;font-weight:700;color:#059669;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Kekuatan</div>`;
    for (const item of kekuatan) {
      body += `<span style="display:inline-block;background:#ECFDF5;border:1px solid #A7F3D0;color:#065F46;padding:3px 10px;font-size:12px;margin:2px 4px 2px 0;">${h(item)}</span>`;
    }
    body += '</div>';
  }
  if (kelemahan.length > 0) {
    body += `<div style="margin:16px 0;">
                    <div style="font-size:10px;font-weight:700;color:#DC2626;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Perlu Diperbaiki</div>`;
    for (const item of kelemahan) {
      body += `<span style="display:inline-block;background:#FEF2F2;border:1px solid #FECACA;color:#991B1B;padding:3px 10px;font-size:12px;margin:2px 4px 2px 0;">${h(item)}</span>`;
    }
    body += '</div>';
  }
  if (nasihat) body += emailAlert('#2563EB', '#EFF6FF', 'Nasihat & Cadangan', h(nasihat));
  if (ulasan) body += emailAlert('#6B7280', '#F9FAFB', 'Ulasan Keseluruhan', h(ulasan));
  if (catatanAdmin) body += emailAlert('#FADA00', '#FFFBEB', h(catatanLabel), h(catatanAdmin));
  if (reportUrl) {
    body += `<div style="text-align:center;margin:24px 0;">
                    <a href="${h(reportUrl)}" target="_blank"
                       style="display:inline-block;background:#0066cc;color:#fff;padding:12px 32px;
                              font-weight:700;font-size:14px;text-decoration:none;border-radius:4px;">
                      📋 Lihat Laporan Penuh (RA Report)
                    </a>
                    <div style="font-size:11px;color:#9CA3AF;margin-top:8px;">Klik untuk melihat dan muat turun laporan penilaian penuh dalam format PDF</div>
                  </div>`;
  }
  body += emailPara('Sila jadikan maklum balas ini sebagai panduan untuk meningkatkan prestasi pada masa hadapan. Terima kasih atas dedikasi anda.');
  const subject = `Laporan Penilaian — ${pasukan} — ${tarikhText}`;
  const html = buildEmailTemplate('Laporan Penilaian Pengadil', '#2563EB', '', body);
  return sendEmail(env, to, subject, html, nama, 'lantikan');
}
