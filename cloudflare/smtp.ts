import type { EmailMessage, MailAttachment } from './mail';

export interface SmtpAccount {
  hostname: string;
  port: number;
  username: string;
  password: string;
}

/** Structural socket type also permits real TLS-server tests outside Workers. */
export interface SmtpSocket {
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
  opened: Promise<unknown>;
  closed: Promise<void>;
  close(): Promise<void>;
}

export type SmtpConnector = (address: { hostname: string; port: number },
  options: { secureTransport: 'on'; allowHalfOpen: false }) => SmtpSocket;

const encoder = new TextEncoder();

function base64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return btoa(binary);
}

function header(value: string): string {
  if (/[\r\n\0]/.test(value)) throw new Error('Invalid email header');
  // RFC 2047 encoded words stay below 75 bytes, including for Unicode names.
  const words: string[] = [];
  let word = '';
  for (const character of value) {
    if (encoder.encode(word + character).length > 30) {
      words.push(`=?UTF-8?B?${base64(encoder.encode(word))}?=`);
      word = '';
    }
    word += character;
  }
  if (word) words.push(`=?UTF-8?B?${base64(encoder.encode(word))}?=`);
  return words.join('\r\n ');
}

function address(value: string): string {
  if (!/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?$/.test(value)
    || value.length > 254) throw new Error('Invalid email address');
  return value;
}

function encodedBody(bytes: Uint8Array): string {
  return base64(bytes).match(/.{1,76}/g)?.join('\r\n') ?? '';
}

function attachmentPart(attachment: MailAttachment): string {
  if (!/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i.test(attachment.type)
    || /[\r\n\0]/.test(attachment.filename)
    || (attachment.contentId && !/^[A-Za-z0-9@._+-]+$/.test(attachment.contentId))) {
    throw new Error('Invalid attachment header');
  }
  const content = attachment.content;
  // The shared interface uses a base64 string or raw binary bytes, matching
  // the Cloudflare Email binding. Inline logos and PDFs use raw binary.
  let bytes: Uint8Array;
  if (typeof content === 'string') {
    const decoded = atob(content.replace(/\s/g, ''));
    bytes = Uint8Array.from(decoded, (character) => character.charCodeAt(0));
  } else if (ArrayBuffer.isView(content)) {
    bytes = new Uint8Array(content.buffer, content.byteOffset, content.byteLength);
  } else bytes = new Uint8Array(content);
  const filename = encodeURIComponent(attachment.filename).replace(/['()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
  return `Content-Type: ${attachment.type}\r\nContent-Transfer-Encoding: base64\r\n`
    + `Content-Disposition: ${attachment.disposition}; filename*=UTF-8''${filename}\r\n`
    + (attachment.contentId ? `Content-ID: <${attachment.contentId}>\r\n` : '')
    + `\r\n${encodedBody(bytes)}\r\n`;
}

/** Preserve text/HTML alternatives, CID logos, PDF bytes and Unicode headers. */
export function smtpMime(message: EmailMessage): { raw: string; messageId: string; to: string } {
  const from = address(message.from.email);
  const to = address(typeof message.to === 'string' ? message.to : message.to.email);
  const toName = typeof message.to === 'string' ? '' : message.to.name;
  const messageId = `<${crypto.randomUUID()}@${from.split('@')[1]}>`;
  const alternative = `alt_${crypto.randomUUID()}`;
  const related = `rel_${crypto.randomUUID()}`;
  const mixed = `mix_${crypto.randomUUID()}`;
  const inline = (message.attachments ?? []).filter((item) => item.disposition === 'inline');
  const attachments = (message.attachments ?? []).filter((item) => item.disposition !== 'inline');
  const textPart = (type: string, text: string) => `Content-Type: ${type}; charset=utf-8\r\n`
    + `Content-Transfer-Encoding: base64\r\n\r\n${encodedBody(encoder.encode(text))}\r\n`;
  let body = `Content-Type: multipart/alternative; boundary="${alternative}"\r\n\r\n`
    + `--${alternative}\r\n${textPart('text/plain', message.text)}`
    + `--${alternative}\r\n${textPart('text/html', message.html)}--${alternative}--\r\n`;
  if (inline.length) {
    body = `Content-Type: multipart/related; boundary="${related}"\r\n\r\n--${related}\r\n${body}`
      + inline.map((item) => `--${related}\r\n${attachmentPart(item)}`).join('') + `--${related}--\r\n`;
  }
  if (attachments.length) {
    body = `Content-Type: multipart/mixed; boundary="${mixed}"\r\n\r\n--${mixed}\r\n${body}`
      + attachments.map((item) => `--${mixed}\r\n${attachmentPart(item)}`).join('') + `--${mixed}--\r\n`;
  }
  return { messageId, to, raw: `From: ${header(message.from.name)} <${from}>\r\n`
    + `To: ${toName ? `${header(toName)} ` : ''}<${to}>\r\nSubject: ${header(message.subject)}\r\n`
    + `Date: ${new Date().toUTCString()}\r\nMessage-ID: ${messageId}\r\nMIME-Version: 1.0\r\n${body}` };
}

async function withTimeout<T>(operation: Promise<T>, milliseconds: number, stage: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`SMTP timeout at ${stage}`)), milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}

/** The server's response text and credentials never enter errors or logs. */
async function session(account: SmtpAccount, connect: SmtpConnector, message?: EmailMessage): Promise<string> {
  if (account.port !== 465 || !account.hostname || !account.username || !account.password) {
    throw new Error('Legacy SMTP requires host, port 465 and sender credentials');
  }
  const mime = message ? smtpMime(message) : null;
  const socket = connect({ hostname: account.hostname, port: account.port }, { secureTransport: 'on', allowHalfOpen: false });
  // A peer closing unexpectedly must not produce an unhandled rejection.
  void socket.closed.catch(() => {});
  const reader = socket.readable.getReader();
  const writer = socket.writable.getWriter();
  const decoder = new TextDecoder();
  let buffered = '';
  async function reply(expected: number[], stage: string): Promise<void> {
    let responseSize = 0;
    let firstCode: string | undefined;
    while (true) {
      let end = buffered.indexOf('\r\n');
      while (end < 0) {
        const chunk = await withTimeout(reader.read(), 10_000, stage);
        if (chunk.done) throw new Error(`SMTP connection closed at ${stage}`);
        buffered += decoder.decode(chunk.value, { stream: true });
        if (buffered.length > 65536) throw new Error('SMTP response too large');
        end = buffered.indexOf('\r\n');
      }
      const line = buffered.slice(0, end);
      buffered = buffered.slice(end + 2);
      responseSize += line.length;
      const match = /^(\d{3})([ -])/.exec(line);
      if (!match || responseSize > 65536 || (firstCode && firstCode !== match[1])) {
        throw new Error(`Invalid SMTP response at ${stage}`);
      }
      firstCode = match[1];
      if (match[2] === '-') continue;
      if (!expected.includes(Number(match[1]))) throw new Error(`SMTP rejected ${stage} (${match[1]})`);
      return;
    }
  }
  async function command(value: string, expected: number[], stage: string): Promise<void> {
    await withTimeout(writer.write(encoder.encode(`${value}\r\n`)), 10_000, stage);
    await reply(expected, stage);
  }
  try {
    const exchange = async (): Promise<string> => {
      await socket.opened;
      await reply([220], 'greeting');
      await command('EHLO refpahang.com', [250], 'EHLO');
      await command('AUTH LOGIN', [334], 'authentication');
      await command(base64(encoder.encode(account.username)), [334], 'username');
      await command(base64(encoder.encode(account.password)), [235], 'password');
      if (!message || !mime) return 'authenticated';
      await command(`MAIL FROM:<${address(message.from.email)}>`, [250], 'sender');
      await command(`RCPT TO:<${mime.to}>`, [250, 251], 'recipient');
      await command('DATA', [354], 'DATA');
      const bytes = encoder.encode(`${mime.raw.replace(/(^|\r\n)\./g, '$1..')}.\r\n`);
      for (let offset = 0; offset < bytes.length; offset += 65536) {
        await withTimeout(writer.write(bytes.subarray(offset, offset + 65536)), 10_000, 'message');
      }
      // Only final DATA acceptance constitutes success. Close immediately after
      // acceptance; a failed QUIT must never cause a duplicate-send retry.
      await reply([250], 'message acceptance');
      return mime.messageId;
    };
    return await withTimeout(exchange(), 30_000, 'delivery');
  } finally {
    void socket.close().catch(() => {});
    try { reader.releaseLock(); } catch { /* Closing a timed-out socket cancels pending reads. */ }
    try { writer.releaseLock(); } catch { /* A peer may stop reading during a timed-out write. */ }
  }
}

export async function sendSmtpEmail(account: SmtpAccount, message: EmailMessage,
  connector?: SmtpConnector): Promise<string> {
  const connect = connector ?? (await import('cloudflare:sockets')).connect;
  return session(account, connect, message);
}

export async function verifySmtpAccount(account: SmtpAccount,
  connector?: SmtpConnector): Promise<void> {
  const connect = connector ?? (await import('cloudflare:sockets')).connect;
  await session(account, connect);
}
