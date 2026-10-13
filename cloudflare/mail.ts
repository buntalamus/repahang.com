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
  const result = await env.EMAIL.send({
    to: { email: to, name: toName || undefined },
    from: { email: address, name },
    subject,
    html,
    text,
    ...(attachments.length ? { attachments } : {}),
  });
  return result.messageId;
}
