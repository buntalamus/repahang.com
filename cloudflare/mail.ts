/** Shared sender mapping and outbound transport for every Worker email flow. */
import { demoTitle, isDemo, isFakeEmail, recordDemoOutbox } from './src/demo';
import { sendSmtpEmail } from './smtp';

export type MailType = 'admin' | 'daftar' | 'lantikan' | 'support' | 'pengesahan';

export interface MailAttachment {
  filename: string;
  type: string;
  content: string | ArrayBuffer | ArrayBufferView;
  disposition: 'attachment' | 'inline';
  contentId?: string;
}

export interface EmailMessage {
  to: string | { email: string; name: string };
  from: { email: string; name: string };
  subject: string;
  html: string;
  text: string;
  attachments?: MailAttachment[];
}

export interface EmailEnv {
  EMAIL?: { send(message: EmailMessage): Promise<{ messageId: string }> };
  EMAIL_TRANSPORT?: 'legacy-smtp' | 'cloudflare-email';
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  MAIL_ADMIN_PASS?: string;
  MAIL_DAFTAR_PASS?: string;
  MAIL_LANTIKAN_PASS?: string;
  MAIL_SUPPORT_PASS?: string;
  MAIL_PENGESAHAN_PASS?: string;
  MAIL_ADMIN_USER: string;
  MAIL_ADMIN_NAME: string;
  MAIL_DAFTAR_USER: string;
  MAIL_DAFTAR_NAME: string;
  MAIL_LANTIKAN_USER: string;
  MAIL_LANTIKAN_NAME: string;
  MAIL_SUPPORT_USER: string;
  MAIL_SUPPORT_NAME: string;
  MAIL_PENGESAHAN_USER: string;
  MAIL_PENGESAHAN_NAME: string;
  /** Staging only: every outgoing message goes here instead of its real recipient. */
  STAGING_EMAIL_REDIRECT?: string;
  /** demo.refpahang.com: fictional recipients go to demo_outbox (src/demo.ts). */
  DEMO_MODE?: string;
  DB?: D1Database;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character] ?? character);
}

/** Logo served by the site itself, so emails do not depend on a third-party host. */
export const EMAIL_LOGO_URL = 'https://refpahang.com/assets/Pahang_FA_logo.png';

/** Official PBNP letterhead used by every email. `title` and `body` are HTML. */
export function renderEmailLayout(title: string, accent: string, body: string): string {
  const year = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric' }).format(new Date());
  return `<!DOCTYPE html>
<html lang="ms">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#E8EAED;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#E8EAED;">
    <tr><td align="center" style="padding:40px 16px 48px;">
      <table width="600" cellpadding="0" cellspacing="0" border="0"
             style="max-width:600px;width:100%;background:#ffffff;
                    box-shadow:0 1px 4px rgba(0,0,0,0.10);">

        <!-- TOP ACCENT LINE -->
        <tr>
          <td style="background:${accent};height:4px;font-size:0;line-height:0;">&nbsp;</td>
        </tr>

        <!-- HEADER -->
        <tr>
          <td style="background:#111827;padding:28px 36px 24px;text-align:center;">
            <img src="${EMAIL_LOGO_URL}"
                 alt="PBNP" width="60" height="60"
                 style="width:60px;height:60px;border-radius:50%;
                        display:block;margin:0 auto 14px;">
            <div style="color:#F9FAFB;font-size:14px;font-weight:700;
                        letter-spacing:0.8px;margin-bottom:4px;">
              PERSATUAN BOLA SEPAK NEGERI PAHANG
            </div>
            <div style="color:#6B7280;font-size:10px;font-weight:600;
                        letter-spacing:2.5px;text-transform:uppercase;">
              Sistem Pengurusan Pengadil
            </div>
          </td>
        </tr>

        <!-- TITLE -->
        <tr>
          <td style="background:#F9FAFB;padding:22px 36px;
                     border-bottom:1px solid #E5E7EB;">
            <div style="border-left:3px solid ${accent};padding-left:14px;">
              <div style="color:#9CA3AF;font-size:10px;font-weight:700;
                          text-transform:uppercase;letter-spacing:2px;
                          margin-bottom:5px;">Pemberitahuan Rasmi</div>
              <div style="color:#111827;font-size:20px;font-weight:700;
                          line-height:1.3;">${title}</div>
            </div>
          </td>
        </tr>

        <!-- BODY -->
        <tr>
          <td style="padding:32px 36px 36px;">
            ${body}
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="background:#111827;padding:24px 36px;text-align:center;">
            <div style="color:#F9FAFB;font-size:12px;font-weight:600;
                        margin-bottom:10px;letter-spacing:0.3px;">
              Unit Pengadil &mdash; Persatuan Bola Sepak Negeri Pahang
            </div>
            <div style="color:#9CA3AF;font-size:12px;margin-bottom:14px;">
              <a href="mailto:admin@refpahang.com"
                 style="color:#FADA00;text-decoration:none;">admin@refpahang.com</a>
              &nbsp;&nbsp;&bull;&nbsp;&nbsp;
              <a href="mailto:support@refpahang.com"
                 style="color:#FADA00;text-decoration:none;">support@refpahang.com</a>
            </div>
            <div style="color:#4B5563;font-size:10px;
                        border-top:1px solid #374151;padding-top:14px;">
              &copy; ${year} Persatuan Bola Sepak Negeri Pahang. Hak Cipta Terpelihara.
            </div>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** Shared, escaped template for transactional messages, on the official letterhead. */
export function buildRefpahangEmail(
  title: string,
  recipientName: string,
  paragraphs: string[],
  action?: { label: string; url: string },
): { html: string; text: string } {
  const greeting = recipientName ? `<p style="color:#6B7280;font-size:14px;line-height:1.7;margin:0 0 4px 0;">
              Assalamualaikum w.b.t. dan Salam Sejahtera,
            </p>
            <p style="color:#111827;font-size:15px;font-weight:600;margin:0 0 22px 0;
                       border-bottom:1px solid #F3F4F6;padding-bottom:18px;">
              ${escapeHtml(recipientName)},
            </p>` : '';
  const body = paragraphs.map((paragraph) =>
    `<p style="color:#374151;font-size:14px;line-height:1.8;margin:0 0 16px 0;">${escapeHtml(paragraph)}</p>`,
  ).join('');
  const button = action ? `<div style="text-align:center;margin:28px 0 8px;">
              <a href="${escapeHtml(action.url)}"
                 style="display:inline-block;background:#111827;color:#FADA00;
                         padding:12px 32px;text-decoration:none;
                         font-weight:700;font-size:13px;letter-spacing:1px;
                         text-transform:uppercase;">${escapeHtml(action.label)}</a>
            </div>
            <p style="color:#9CA3AF;font-size:11px;line-height:1.6;margin:16px 0 0;word-break:break-all;">
              Jika butang tidak berfungsi, salin pautan ini: ${escapeHtml(action.url)}
            </p>` : '';
  return {
    html: renderEmailLayout(escapeHtml(title), '#FADA00', `${greeting}${body}${button}`),
    text: [title, ...(recipientName ? [`Assalamualaikum w.b.t. dan Salam Sejahtera, ${recipientName},`] : []),
      ...paragraphs, ...(action ? [`${action.label}: ${action.url}`] : []),
      'Unit Pengadil, Persatuan Bola Sepak Negeri Pahang.'].join('\n\n'),
  };
}

export async function sendRefpahangEmail(
  env: EmailEnv,
  type: MailType,
  to: string,
  toName: string,
  subject: string,
  html: string,
  text: string,
  attachments: MailAttachment[] = [],
): Promise<string> {
  const senderKeys: Record<MailType, [keyof EmailEnv, keyof EmailEnv]> = {
    admin: ['MAIL_ADMIN_USER', 'MAIL_ADMIN_NAME'],
    daftar: ['MAIL_DAFTAR_USER', 'MAIL_DAFTAR_NAME'],
    lantikan: ['MAIL_LANTIKAN_USER', 'MAIL_LANTIKAN_NAME'],
    support: ['MAIL_SUPPORT_USER', 'MAIL_SUPPORT_NAME'],
    pengesahan: ['MAIL_PENGESAHAN_USER', 'MAIL_PENGESAHAN_NAME'],
  };
  const [addressKey, nameKey] = senderKeys[type];
  const address = env[addressKey];
  const name = env[nameKey];
  if (typeof address !== 'string' || !address || typeof name !== 'string' || !name) {
    throw new Error(`Missing sender settings for ${type}`);
  }
  if (isDemo(env)) {
    subject = demoTitle(env, subject);
    if (isFakeEmail(to)) {
      await recordDemoOutbox(env, 'email', toName ? `${toName} <${to}>` : to, subject, html);
      return 'demo-outbox';
    }
  }
  // Staging D1 holds copies of real users; never let a test reach them.
  const redirect = env.STAGING_EMAIL_REDIRECT?.trim();
  const message: EmailMessage = {
    // The binding rejects an EmailAddress whose name is not a string, so a
    // recipient without a name is passed as a bare address.
    to: redirect ? redirect : toName ? { email: to, name: toName } : to,
    from: { email: address, name },
    subject: redirect ? `[UJIAN → ${to}] ${subject}` : subject,
    html,
    text,
    ...(attachments.length ? { attachments } : {}),
  };
  if (env.EMAIL_TRANSPORT === 'legacy-smtp') {
    const password = env[`MAIL_${type.toUpperCase()}_PASS` as keyof EmailEnv];
    if (typeof password !== 'string' || !password) throw new Error(`Missing SMTP credentials for ${type}`);
    return sendSmtpEmail({ hostname: env.SMTP_HOST ?? '', port: Number(env.SMTP_PORT),
      username: address, password }, message);
  }
  if (env.EMAIL_TRANSPORT && env.EMAIL_TRANSPORT !== 'cloudflare-email') throw new Error('Unknown email transport');
  if (!env.EMAIL) throw new Error('Cloudflare email binding unavailable');
  const result = await env.EMAIL.send(message);
  return result.messageId;
}
