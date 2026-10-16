import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import tls from 'node:tls';
import {Readable,Writable} from 'node:stream';
import {build} from 'esbuild';
import PostalMime from 'postal-mime';

const directory=mkdtempSync(join(tmpdir(),'refpahang-smtp-test-'));
execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1',
  '-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost',
  '-keyout',join(directory,'key.pem'),'-out',join(directory,'cert.pem')],{stdio:'ignore'});
const key=readFileSync(join(directory,'key.pem'));
const cert=readFileSync(join(directory,'cert.pem'));
const connections=new Set();
const received=[];
let mode='ok';
let commands=[];
const server=tls.createServer({key,cert},socket=>{
  connections.add(socket);socket.on('close',()=>connections.delete(socket));
  socket.on('error',()=>{});
  // Split protocol replies across writes to exercise buffered, multiline reads.
  const reply=text=>{socket.write(text.slice(0,2));setImmediate(()=>socket.write(text.slice(2)));};
  reply('220-test SMTP\r\n220 ready\r\n');
  let buffer='';let state='command';
  socket.on('data',bytes=>{
    buffer+=bytes.toString();
    while(buffer.includes('\r\n')) {
      if(state==='data') {
        const end=buffer.indexOf('\r\n.\r\n');
        if(end<0)return;
        received.push(buffer.slice(0,end+2));buffer=buffer.slice(end+5);state='command';
        reply(mode==='message-rejected'?'554 not accepted\r\n':'250 accepted for delivery\r\n');
        continue;
      }
      const end=buffer.indexOf('\r\n');const line=buffer.slice(0,end);buffer=buffer.slice(end+2);
      if(state==='username') {state='password';reply('334 UGFzc3dvcmQ6\r\n');continue;}
      if(state==='password') {state='command';reply(mode==='auth-rejected'?'535 credentials rejected\r\n':'235 authenticated\r\n');continue;}
      commands.push(line);
      if(line.startsWith('EHLO '))reply('250-test\r\n250-AUTH LOGIN\r\n250 SIZE 52428800\r\n');
      else if(line==='AUTH LOGIN'){state='username';reply('334 VXNlcm5hbWU6\r\n');}
      else if(line.startsWith('MAIL FROM:'))reply('250 sender OK\r\n');
      else if(line.startsWith('RCPT TO:'))reply(mode==='recipient-rejected'?'550 recipient rejected\r\n':'250 recipient OK\r\n');
      else if(line==='DATA'){state='data';reply('354 send message\r\n');}
      else reply('500 invalid command\r\n');
    }
  });
});
server.listen(0,'127.0.0.1');await once(server,'listening');
const connector=(address,options)=>{
  assert.deepEqual(address,{hostname:'smtp.example.test',port:465});
  assert.deepEqual(options,{secureTransport:'on',allowHalfOpen:false});
  const socket=tls.connect({host:'127.0.0.1',port:server.address().port,servername:'localhost',ca:cert});
  return {readable:Readable.toWeb(socket),writable:Writable.toWeb(socket),
    opened:once(socket,'secureConnect'),closed:once(socket,'close').then(()=>{}),
    close:async()=>{socket.destroy();}};
};
globalThis.refpahangSmtpConnector=connector;
const result=await build({stdin:{contents:`
  export {smtpMime,sendSmtpEmail,verifySmtpAccount} from '../smtp';
  export {sendRefpahangEmail} from '../mail';
`,resolveDir:new URL('.',import.meta.url).pathname,loader:'ts'},bundle:true,format:'esm',
  platform:'node',write:false,logLevel:'silent',plugins:[{
    name:'smtp-test-connector',setup(build){
      build.onResolve({filter:/^cloudflare:sockets$/},()=>({path:'sockets',namespace:'test'}));
      build.onLoad({filter:/.*/,namespace:'test'},()=>({contents:
        'export const connect=(...args)=>globalThis.refpahangSmtpConnector(...args);',loader:'js'}));
    },
  }]});
const {smtpMime,sendSmtpEmail,verifySmtpAccount,sendRefpahangEmail}=await import(
  `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const account={hostname:'smtp.example.test',port:465,username:'admin@example.test',password:'test-password'};
const pdf=Uint8Array.from([37,80,68,70,45,49,46,55,0,255]);
const image=Uint8Array.from([137,80,78,71,0,255]);
const message={from:{email:'admin@example.test',name:'Pentadbir — Pahang'},
  to:{email:'referee@example.test',name:'Pengadil Bin Abdullah'},
  subject:'Lantikan pengadil — Pahang ⚽ '.repeat(8),html:'<p>Salam pengadil ⚽ <img src="cid:logo"></p>',
  text:'Salam pengadil ⚽\n\n.Barisan titik',attachments:[
    {filename:'Borang Penilaian — RA.pdf',type:'application/pdf',content:pdf,disposition:'attachment'},
    {filename:'logo.png',type:'image/png',content:image.buffer,disposition:'inline',contentId:'logo'},
    {filename:'nota.txt',type:'text/plain',content:Buffer.from('Nota ujian').toString('base64'),disposition:'attachment'},
  ]};
try {
  const id=await sendSmtpEmail(account,message,connector);
  const parsed=await PostalMime.parse(received.at(-1));
  assert.equal(parsed.messageId,id);
  assert.equal(parsed.subject,message.subject);
  assert.equal(parsed.from.name,message.from.name);
  assert.equal(parsed.to[0].name,message.to.name);
  assert.equal(parsed.text,message.text);
  assert.equal(parsed.html,message.html);
  assert.equal(parsed.attachments.length,3);
  assert.deepEqual(new Uint8Array(parsed.attachments.find(a=>a.filename.endsWith('.pdf')).content),pdf);
  assert.deepEqual(new Uint8Array(parsed.attachments.find(a=>a.contentId==='<logo>').content),image);
  assert.equal(new TextDecoder().decode(parsed.attachments.find(a=>a.filename==='nota.txt').content),'Nota ujian');
  const env={EMAIL_TRANSPORT:'legacy-smtp',SMTP_HOST:account.hostname,SMTP_PORT:'465',
    EMAIL:{send:async()=>{throw new Error('Cloudflare sending must never be used in SMTP mode');}}};
  for(const type of ['admin','daftar','lantikan','support','pengesahan']){
    const prefix=`MAIL_${type.toUpperCase()}`;
    env[`${prefix}_USER`]=`${type}@example.test`;env[`${prefix}_NAME`]=`Penghantar ${type}`;
    env[`${prefix}_PASS`]='test-password';
    const id=await sendRefpahangEmail(env,type,'referee@example.test','Pengadil','Ujian','<p>Ujian</p>','Ujian');
    assert.equal((await PostalMime.parse(received.at(-1))).messageId,id);
    assert.ok(commands.includes(`MAIL FROM:<${type}@example.test>`));
  }
  env.STAGING_EMAIL_REDIRECT=' qa@example.test ';
  await sendRefpahangEmail(env,'admin','real@example.test','Pengadil','Ujian','<p>Ujian</p>','Ujian');
  const redirected=await PostalMime.parse(received.at(-1));
  assert.equal(redirected.to[0].address,'qa@example.test');
  assert.equal(redirected.subject,'[UJIAN → real@example.test] Ujian');
  const count=received.length;
  commands=[];
  await verifySmtpAccount(account,connector);
  assert.equal(received.length,count,'Authentication probe never sends DATA');
  assert.ok(!commands.includes('DATA'));
  for(const rejected of ['auth-rejected','recipient-rejected','message-rejected']) {
    mode=rejected;
    await assert.rejects(sendSmtpEmail(account,message,connector),error=>{
      assert.doesNotMatch(error.message,/test-password|credentials rejected|referee@example/);
      return /SMTP rejected/.test(error.message);
    });
  }
  mode='auth-rejected';
  await assert.rejects(sendRefpahangEmail(env,'admin','referee@example.test','','Ujian','<p>x</p>','x'),/SMTP rejected/);
  assert.throws(()=>smtpMime({...message,subject:'X\r\nBcc: victim@example.test'}),/Invalid email header/);
  assert.throws(()=>smtpMime({...message,to:'x@example.test\r\nRCPT TO:<victim@example.test>'}),/Invalid email address/);
  assert.throws(()=>smtpMime({...message,attachments:[{...message.attachments[0],filename:'x\r\nX-Header: x'}]}),/Invalid attachment header/);
  console.log('legacy SMTP: TLS, multiline protocol, five senders, Unicode MIME, CID/PDF/base64 attachments, staging redirect, acceptance/rejection, no CF fallback and header injection checks passed');
} finally {
  for(const socket of connections)socket.destroy();
  await new Promise(resolve=>server.close(resolve));
  rmSync(directory,{recursive:true,force:true});
  delete globalThis.refpahangSmtpConnector;
}
