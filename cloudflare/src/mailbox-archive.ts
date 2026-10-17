import type { Env } from './types';

function base64(value: string): string {
  return btoa(Array.from(new TextEncoder().encode(value),b=>String.fromCharCode(b)).join('')).replace(/.{1,76}/g,'$&\r\n');
}

export interface SentCopy {
  id: string; mailbox: string; to: string; subject: string; html: string; text: string; requestId: string;
}

/** Stores a Peti Emel "Dihantar" copy before SMTP, marked processing until the send settles. */
export async function archiveSentCopy(env: Env, copy: SentCopy): Promise<void> {
  const boundary = `refpahang-${copy.id}`;
  const words:string[]=[];let word='';
  for(const character of copy.subject){
    if(new TextEncoder().encode(word+character).byteLength>30){words.push(`=?UTF-8?B?${base64(word).replace(/\r\n/g,'')}?=`);word='';}
    word+=character;
  }
  if(word) words.push(`=?UTF-8?B?${base64(word).replace(/\r\n/g,'')}?=`);
  const subject=words.join('\r\n ');
  const raw = `From: ${copy.mailbox}\r\nTo: ${copy.to}\r\nSubject: ${subject}\r\nDate: ${new Date().toUTCString()}\r\nMIME-Version: 1.0\r\nContent-Type: multipart/alternative; boundary="${boundary}"\r\n\r\n`
    + `--${boundary}\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${base64(copy.text)}`
    + `--${boundary}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${base64(copy.html)}--${boundary}--\r\n`;
  const key = `mailbox/${copy.mailbox}/sent/${copy.id}.eml`;
  await env.MEDIA.put(key,raw,{httpMetadata:{contentType:'message/rfc822'}});
  await env.DB.prepare(`INSERT INTO mailbox_messages(id,mailbox,folder,sender,recipient,subject,r2_key,size_bytes,delivery_status,request_id)
    VALUES(?,?,'sent',?,?,?,?,?,'processing',?)`).bind(copy.id,copy.mailbox,copy.mailbox,copy.to,copy.subject,key,
      new TextEncoder().encode(raw).byteLength,copy.requestId).run();
}
