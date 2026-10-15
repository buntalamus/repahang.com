/** Sender mapping for the future Worker API. No mail is sent at module load. */

export type MailType = 'admin' | 'daftar' | 'lantikan' | 'support' | 'pengesahan';

export interface MailAttachment {
  filename: string;
  type: string;
  content: string | ArrayBuffer | ArrayBufferView;
  disposition: 'attachment' | 'inline';
  contentId?: string;
}

interface EmailMessage {
  to: { email: string; name?: string };
  from: { email: string; name: string };
  subject: string;
  html: string;
  text: string;
  attachments?: MailAttachment[];
}

export interface EmailEnv {
  EMAIL: { send(message: EmailMessage): Promise<{ messageId: string }> };
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
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character] ?? character);
}

/** Shared, escaped template for transactional messages. */
export function buildRefpahangEmail(
  title: string,
  recipientName: string,
  paragraphs: string[],
  action?: { label: string; url: string },
): { html: string; text: string } {
  const safeTitle = escapeHtml(title);
  const safeName = escapeHtml(recipientName);
  const greeting = recipientName ? `<p style="margin:0 0 16px;color:#334155">Salam <strong>${safeName}</strong>,</p>` : '';
  const body = paragraphs.map((paragraph) =>
    `<p style="margin:0 0 16px;color:#334155;line-height:1.6">${escapeHtml(paragraph)}</p>`,
  ).join('');
  const button = action ? `<p style="margin:24px 0;text-align:center"><a href="${escapeHtml(action.url)}" style="display:inline-block;background:#111827;color:#fada00;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">${escapeHtml(action.label)}</a></p>` : '';
  const link = action ? `<p style="color:#64748b;font-size:12px;word-break:break-all">Jika butang tidak berfungsi, salin pautan ini: ${escapeHtml(action.url)}</p>` : '';
  return {
    html: `<div style="background:#f8fafc;padding:24px;font-family:Arial,sans-serif"><div style="max-width:600px;margin:auto;background:white;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden"><div style="background:#111827;color:#fada00;padding:20px 24px;font-size:18px;font-weight:700">Sistem Pengadil Pahang</div><div style="padding:24px"><h1 style="font-size:20px;color:#111827;margin:0 0 20px">${safeTitle}</h1>${greeting}${body}${button}${link}</div><div style="border-top:1px solid #e2e8f0;padding:16px 24px;color:#64748b;font-size:12px">Emel automatik Sistem Pengadil Pahang.</div></div></div>`,
    text: [title, ...(recipientName ? [`Salam ${recipientName},`] : []), ...paragraphs,
      ...(action ? [`${action.label}: ${action.url}`] : []),
      'Emel automatik Sistem Pengadil Pahang.'].join('\n\n'),
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
  // Staging D1 holds copies of real users; never let a test reach them.
  const redirect = env.STAGING_EMAIL_REDIRECT?.trim();
  const result = await env.EMAIL.send({
    to: redirect ? { email: redirect } : { email: to, name: toName || undefined },
    from: { email: address, name },
    subject: redirect ? `[UJIAN → ${to}] ${subject}` : subject,
    html,
    text,
    ...(attachments.length ? { attachments } : {}),
  });
  return result.messageId;
}
