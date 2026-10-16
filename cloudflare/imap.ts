import type { SmtpConnector } from './smtp';

export interface ImapAccount {
  hostname: string;
  username: string;
  password: string;
}
export interface ImapMessage {
  uid: number;
  raw: Uint8Array;
  date: string;
  seen: boolean;
}
export interface ImapInbox {
  uidValidity: number;
  uidNext: number;
  search(first: number, last: number): Promise<number[]>;
  fetch(uid: number): Promise<ImapMessage | 'oversized' | null>;
}
export interface ImapFolder {
  name: string;
  label: string;
  kind: 'inbox' | 'sent' | 'drafts' | 'spam' | 'trash' | 'archive' | 'custom';
}
export interface ImapClient {
  list(): Promise<ImapFolder[]>;
  examine(folder: string): Promise<ImapInbox>;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();
export const MAX_IMAP_MESSAGE = 25 * 1024 * 1024;

function quote(value: string): string {
  if (/[\r\n\0]/.test(value)) throw new Error('IMAP invalid credentials');
  return `"${value.replace(/([\\"])/g, '\\$1')}"`;
}

function uid(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 4294967295)
    throw new Error('IMAP invalid UID');
  return value;
}

export function folderLabel(name: string): string {
  // IMAP4rev1 modified UTF-7, used by cPanel/Dovecot for non-ASCII folder names.
  return name.replace(/&([^-]*)-/g, (_, encoded: string) => {
    if (!encoded) return '&';
    try {
      const bytes = atob(encoded.replace(/,/g, '/').padEnd(Math.ceil(encoded.length / 4) * 4, '='));
      if (bytes.length % 2) return '&' + encoded + '-';
      let value = '';
      for (let i = 0; i < bytes.length; i += 2)
        value += String.fromCharCode(bytes.charCodeAt(i) * 256 + bytes.charCodeAt(i + 1));
      return value;
    } catch {
      return '&' + encoded + '-';
    }
  });
}

function parseFolder(line: string): ImapFolder | null {
  const match = /^\* LIST \(([^)]*)\) (?:NIL|"(?:[^"\\]|\\.)*") (.+)$/i.exec(line);
  if (!match) throw new Error('IMAP invalid folder list');
  if (/\\Noselect\b/i.test(match[1])) return null;
  const token = match[2];
  if (token.startsWith('"') && !/^"(?:[^"\\]|\\.)*"$/.test(token))
    throw new Error('IMAP invalid folder name');
  const name = token.startsWith('"') ? token.slice(1, -1).replace(/\\(.)/g, '$1') : token;
  if (!name || name.length > 500 || /[\r\n\0]/.test(name))
    throw new Error('IMAP invalid folder name');
  const label = folderLabel(name);
  const leaf = label.split(/[./]/).at(-1)?.toLowerCase();
  const flags = match[1].toLowerCase();
  const kind: ImapFolder['kind'] =
    name.toUpperCase() === 'INBOX'
      ? 'inbox'
      : flags.includes('\\sent') || ['sent', 'sent items', 'sent messages'].includes(leaf ?? '')
        ? 'sent'
        : flags.includes('\\drafts') || leaf === 'drafts'
          ? 'drafts'
          : flags.includes('\\junk') || ['junk', 'spam'].includes(leaf ?? '')
            ? 'spam'
            : flags.includes('\\trash') || ['trash', 'deleted items'].includes(leaf ?? '')
              ? 'trash'
              : flags.includes('\\archive') || leaf === 'archive'
                ? 'archive'
                : 'custom';
  return { name, label, kind };
}

/** TLS-only, read-only IMAP. No STORE, DELETE, EXPUNGE or SELECT commands. */
export async function withImapClient<T>(
  account: ImapAccount,
  work: (client: ImapClient) => Promise<T>,
  connector?: SmtpConnector,
): Promise<T> {
  if (!account.hostname || !account.username || !account.password)
    throw new Error('IMAP credentials missing');
  const username = quote(account.username);
  const password = quote(account.password);
  const connect = connector ?? (await import('cloudflare:sockets')).connect;
  const socket = connect(
    { hostname: account.hostname, port: 993 },
    { secureTransport: 'on', allowHalfOpen: false },
  );
  void socket.closed.catch(() => {});
  const reader = socket.readable.getReader();
  const writer = socket.writable.getWriter();
  let buffer = new Uint8Array(0);
  let sequence = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  async function timed<R>(operation: Promise<R>, stage: string): Promise<R> {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        operation,
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error(`IMAP timeout at ${stage}`)), 10_000);
        }),
      ]);
    } finally {
      clearTimeout(timeout);
    }
  }
  async function more(): Promise<void> {
    const chunk = await timed(reader.read(), 'response');
    if (chunk.done) throw new Error('IMAP connection closed');
    if (!buffer.length) {
      buffer = chunk.value;
      return;
    }
    const joined = new Uint8Array(buffer.length + chunk.value.length);
    joined.set(buffer);
    joined.set(chunk.value, buffer.length);
    buffer = joined;
  }
  async function line(): Promise<string> {
    while (true) {
      for (let i = 0; i + 1 < buffer.length; i++) {
        if (buffer[i] === 13 && buffer[i + 1] === 10) {
          const value = decoder.decode(buffer.subarray(0, i));
          buffer = buffer.subarray(i + 2);
          return value;
        }
      }
      if (buffer.length > 65536) throw new Error('IMAP response line too large');
      await more();
    }
  }
  async function literal(length: number): Promise<Uint8Array> {
    if (!Number.isSafeInteger(length) || length < 0 || length > MAX_IMAP_MESSAGE) {
      throw new Error('IMAP literal too large');
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    while (offset < length) {
      if (!buffer.length) await more();
      const size = Math.min(length - offset, buffer.length);
      bytes.set(buffer.subarray(0, size), offset);
      offset += size;
      buffer = buffer.subarray(size);
    }
    return bytes;
  }
  type Frame = { line: string; literals: Uint8Array[] };
  async function command(value: string, stage: string, allowLiteral = false): Promise<Frame[]> {
    const tag = `R${++sequence}`;
    await timed(writer.write(encoder.encode(`${tag} ${value}\r\n`)), stage);
    const frames: Frame[] = [];
    let size = 0;
    while (true) {
      let text = await line();
      size += text.length;
      if (size > 262144) throw new Error('IMAP response too large');
      if (text.startsWith(`${tag} `)) {
        if (!new RegExp(`^${tag} OK(?: |$)`, 'i').test(text))
          throw new Error(`IMAP rejected ${stage}`);
        return frames;
      }
      if (/^\* BYE(?: |$)/i.test(text) || text.startsWith('+'))
        throw new Error(`IMAP unexpected ${stage} response`);
      const literals: Uint8Array[] = [];
      let match = /\{(\d+)\}\s*$/.exec(text);
      while (match) {
        if (!allowLiteral || literals.length) throw new Error('IMAP unexpected literal');
        literals.push(await literal(Number(match[1])));
        const tail = await line();
        text += tail;
        match = /\{(\d+)\}\s*$/.exec(tail);
      }
      frames.push({ line: text, literals });
    }
  }
  try {
    const exchange = async (): Promise<T> => {
      await timed(socket.opened, 'connection');
      if (!/^\* OK(?: |$)/i.test(await line())) throw new Error('IMAP greeting rejected');
      await command(`LOGIN ${username} ${password}`, 'authentication');
      const client: ImapClient = {
        async list() {
          const frames = await command('LIST "" "*"', 'folders');
          return frames
            .filter((frame) => /^\* LIST /i.test(frame.line))
            .map((frame) => parseFolder(frame.line))
            .filter((folder): folder is ImapFolder => folder !== null);
        },
        async examine(folder) {
          const selected = await command(`EXAMINE ${quote(folder)}`, 'folder');
          const responses = selected.map((frame) => frame.line).join('\n');
          const validity = /\[UIDVALIDITY (\d+)\]/i.exec(responses);
          const next = /\[UIDNEXT (\d+)\]/i.exec(responses);
          if (!validity || !next) throw new Error('IMAP inbox UID metadata missing');
          const inbox: ImapInbox = {
            uidValidity: uid(Number(validity[1])),
            uidNext: uid(Number(next[1])),
            async search(first, last) {
              uid(first);
              uid(last);
              if (last < first || last - first > 999)
                throw new Error('IMAP search range too large');
              const frames = await command(`UID SEARCH UID ${first}:${last}`, 'search');
              const values = frames
                .filter((frame) => /^\* SEARCH(?: |$)/i.test(frame.line))
                .flatMap((frame) =>
                  frame.line.slice(8).trim().split(/\s+/).filter(Boolean).map(Number),
                );
              if (
                values.some((value) => !Number.isInteger(value) || value < first || value > last)
              ) {
                throw new Error('IMAP search UID mismatch');
              }
              return [...new Set(values)].sort((a, b) => a - b);
            },
            async fetch(value) {
              uid(value);
              // Ask for size before downloading. A large message cannot exhaust Worker memory.
              const metadata = (
                await command(`UID FETCH ${value} (UID RFC822.SIZE INTERNALDATE FLAGS)`, 'metadata')
              ).find(
                (frame) =>
                  /^\* \d+ FETCH /i.test(frame.line) &&
                  new RegExp(`\\bUID ${value}(?: |\\))`).test(frame.line),
              );
              if (!metadata) return null; // Expunged between SEARCH and FETCH.
              const size = /\bRFC822\.SIZE (\d+)/i.exec(metadata.line);
              const date = /\bINTERNALDATE "([^"]+)"/i.exec(metadata.line);
              if (!size || !date || !Number.isFinite(Date.parse(date[1])))
                throw new Error('IMAP invalid message metadata');
              if (Number(size[1]) > MAX_IMAP_MESSAGE) return 'oversized';
              const frames = await command(`UID FETCH ${value} (UID BODY.PEEK[])`, 'message', true);
              const frame = frames.find(
                (item) =>
                  /^\* \d+ FETCH /i.test(item.line) &&
                  new RegExp(`\\bUID ${value}(?: |\\))`).test(item.line) &&
                  item.literals.length === 1,
              );
              if (!frame) return null;
              if (frame.literals[0].byteLength !== Number(size[1]))
                throw new Error('IMAP message size mismatch');
              return {
                uid: value,
                raw: frame.literals[0],
                date: new Date(date[1]).toISOString(),
                seen: /\bFLAGS \([^)]*\\Seen(?: |\))/i.test(metadata.line),
              };
            },
          };
          return inbox;
        },
      };
      return work(client);
    };
    return await Promise.race([
      exchange(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('IMAP session timeout')), 60_000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
    void socket.close().catch(() => {});
    try {
      reader.releaseLock();
    } catch {
      /* Socket close cancels a pending read. */
    }
    try {
      writer.releaseLock();
    } catch {
      /* Socket close cancels a pending write. */
    }
  }
}
