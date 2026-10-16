import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import tls from 'node:tls';
import {Readable,Writable} from 'node:stream';
import {bundle,openDatabase,sessionCookie} from './_harness.mjs';

const {withImapClient,folderLabel,syncShinjiruMailbox,adminMailbox}=await bundle(`
  export {withImapClient,folderLabel} from '../imap';
  export {syncShinjiruMailbox} from '../src/mailbox-imap';
  export {adminMailbox} from '../src/mailbox';
`);
const directory=mkdtempSync(join(tmpdir(),'refpahang-imap-test-'));
execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1',
  '-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost',
  '-keyout',join(directory,'key.pem'),'-out',join(directory,'cert.pem')],{stdio:'ignore'});
const cert=readFileSync(join(directory,'cert.pem'));
const sockets=new Set();const commands=[];
let mode='ok';
const mime=Buffer.concat([Buffer.from('From: Sender <sender@example.test>\r\nTo: admin@refpahang.com\r\n'
  +'Subject: =?UTF-8?B?VWppYW4g4pq9?=\r\nMessage-ID: <fixture@example.test>\r\n'
  +'MIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary="test"\r\n\r\n'
  +'--test\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nSalam ⚽\r\nR4 OK fake tag inside literal\r\n'
  +'--test\r\nContent-Type: application/octet-stream\r\nContent-Disposition: attachment; filename="data.bin"\r\n'
  +'Content-Transfer-Encoding: base64\r\n\r\nAP8BAg==\r\n--test--\r\n')]);
const server=tls.createServer({key:readFileSync(join(directory,'key.pem')),cert},socket=>{
  sockets.add(socket);socket.on('close',()=>sockets.delete(socket));socket.on('error',()=>{});
  socket.write('* OK IMAP test ready\r\n');
  let pending='';
  socket.on('data',bytes=>{
    pending+=bytes.toString();
    while(pending.includes('\r\n')){
      const end=pending.indexOf('\r\n');const line=pending.slice(0,end);pending=pending.slice(end+2);
      const split=line.indexOf(' '),tag=line.slice(0,split),command=line.slice(split+1);
      // Never retain authentication secrets, even in test diagnostics.
      commands.push(command.startsWith('LOGIN ')?'LOGIN':command);
      let response='';
      if(command.startsWith('LOGIN ')) response=`${tag} ${mode==='auth'?'NO private diagnostic':'OK login'}\r\n`;
      else if(command==='LIST "" "*"') response='* LIST (\\HasChildren) "." INBOX\r\n'
        +'* LIST (\\HasNoChildren \\Sent) "." INBOX.Sent\r\n'
        +'* LIST (\\HasNoChildren) "." "INBOX.Project &- Notes"\r\n'
        +'* LIST (\\Noselect) "." Root\r\n'+`${tag} OK folders\r\n`;
      else if(command.startsWith('EXAMINE ')) response='* 1 EXISTS\r\n* OK [UIDVALIDITY 123] validity\r\n* OK [UIDNEXT 8] next\r\n'+`${tag} OK [READ-ONLY] examined\r\n`;
      else if(command.startsWith('UID SEARCH ')) response=`* SEARCH 7\r\n${tag} OK search\r\n`;
      else if(command==='UID FETCH 7 (UID RFC822.SIZE INTERNALDATE FLAGS)') response=mode==='expunged'?`${tag} OK gone\r\n`
        :`* 1 FETCH (UID 7 RFC822.SIZE ${mode==='oversized'?30*1024*1024:mime.length} INTERNALDATE "16-Oct-2026 09:00:00 +0800" FLAGS (\\Seen))\r\n${tag} OK metadata\r\n`;
      else if(command==='UID FETCH 7 (UID BODY.PEEK[])') {
        const prefix=Buffer.from(`* 1 FETCH (UID 7 BODY[] {${mode==='literal'?30*1024*1024:mime.length}}\r\n`);
        socket.write(prefix.subarray(0,3));
        setImmediate(()=>{socket.write(prefix.subarray(3));socket.write(mime.subarray(0,23));
          setImmediate(()=>{if(!socket.destroyed){socket.write(mime.subarray(23));socket.write(`)\r\n${tag} OK body\r\n`);}});});
        continue;
      } else response=`${tag} BAD unsupported\r\n`;
      socket.write(response.slice(0,3));setImmediate(()=>{if(!socket.destroyed)socket.write(response.slice(3));});
    }
  });
});
server.listen(0,'127.0.0.1');await once(server,'listening');
const connector=(address,options)=>{
  assert.equal(address.port,993);assert.equal(options.secureTransport,'on');
  const socket=tls.connect({host:'127.0.0.1',port:server.address().port,servername:'localhost',ca:cert});
  return {readable:Readable.toWeb(socket),writable:Writable.toWeb(socket),opened:once(socket,'secureConnect'),
    closed:once(socket,'close').then(()=>{}),close:async()=>{socket.destroy();}};
};
const account={hostname:'imap.example.test',username:'admin@refpahang.com',password:'dummy-secret'};
const {db,DB,close}=openDatabase(['0001_worker_sessions','0013_mailbox','0021_mailbox_imap']);
const objects=new Map();let failStore=false;
const MEDIA={put:async(key,value)=>{if(failStore){failStore=false;throw new Error('R2 unavailable');}objects.set(key,Buffer.from(value));},
  get:async(key)=>objects.has(key)?{arrayBuffer:async()=>objects.get(key),body:new Response(objects.get(key)).body}:null};
const env={DB,MEDIA,STAGING_AUTH_ENABLED:'1',STAGING_WRITES_ENABLED:'1',MAILBOX_IMAP_ENABLED:'1',MAILBOX_SEND_ENABLED:'0',
  SMTP_HOST:account.hostname,MAIL_ADMIN_USER:account.username,MAIL_ADMIN_PASS:account.password};
let validity=100,next=27;let live=Array.from({length:26},(_,index)=>index+1);let activeFolder='INBOX';
const runner=async(actual,work)=>{
  assert.deepEqual(actual,account);
  return work({list:async()=>[{name:'INBOX',label:'INBOX',kind:'inbox'},
    {name:'INBOX.Sent',label:'INBOX.Sent',kind:'sent'}, {name:'INBOX.Drafts',label:'INBOX.Drafts',kind:'drafts'}],
    examine:async(folder)=>{activeFolder=folder;return {uidValidity:validity,uidNext:next,
      search:async(first,last)=>live.filter(value=>value>=first&&value<=last),
      fetch:async(value)=>value===26?'oversized':{uid:value,raw:Buffer.from(mime.toString().replace('fixture@example.test',`${activeFolder}-${value}@example.test`)),
        date:`2026-10-16T01:${String(value).padStart(2,'0')}:00.000Z`,seen:value===25}};}});
};
const unlock=()=>db.exec('UPDATE mailbox_imap_state SET last_attempt=0,lease_until=0');
const admin=db.prepare("SELECT id FROM users WHERE role='Admin' AND aktif=1 LIMIT 1").get();
const referee=db.prepare("SELECT id FROM users WHERE role='Pengadil' AND aktif=1 LIMIT 1").get();
const adminCookie=await sessionCookie(db,admin.id),refereeCookie=await sessionCookie(db,referee.id);
const endpoint='https://refpahang.example.test/api/admin-mailbox.php';
const get=(query='',cookie=adminCookie)=>new Request(endpoint+query,{headers:{Cookie:cookie}});
const post=(body,cookie=adminCookie)=>new Request(endpoint,{method:'POST',headers:{Cookie:cookie},body:JSON.stringify(body)});
try {
  assert.equal(folderLabel('Project &- Notes'),'Project & Notes');
  await withImapClient(account,async(client)=>{
    const folders=await client.list();assert.equal(folders.length,3);assert.equal(folders[1].kind,'sent');
    assert.equal(folders[2].label,'INBOX.Project & Notes');
    const inbox=await client.examine('INBOX');assert.equal(inbox.uidValidity,123);
    assert.deepEqual(await inbox.search(1,7),[7]);
    const message=await inbox.fetch(7);assert.deepEqual(Buffer.from(message.raw),mime);
    assert.equal(message.seen,true);assert.equal(message.date,'2026-10-16T01:00:00.000Z');
  },connector);
  for(const [testMode,expected] of [['oversized','oversized'],['expunged',null]]){
    mode=testMode;assert.equal(await withImapClient(account,async client=>(await client.examine('INBOX')).fetch(7),connector),expected);
  }
  mode='auth';await assert.rejects(withImapClient(account,async()=>{},connector),/IMAP rejected authentication/);
  mode='literal';await assert.rejects(withImapClient(account,async client=>(await client.examine('INBOX')).fetch(7),connector),/literal too large/);
  await assert.rejects(withImapClient({...account,password:'bad\r\nSTORE'},async()=>{},connector),/invalid credentials/);
  assert.ok(commands.every(command=>!/^SELECT |^STORE |^DELETE |^EXPUNGE |^UID STORE /.test(command)));

  const first=await syncShinjiruMailbox(env,account.username,'inbox',runner);
  assert.equal(first.imported,9);assert.equal(first.oversized,1);assert.equal(first.pending,true);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM mailbox_messages').get().n,9);
  const seen=db.prepare("SELECT * FROM mailbox_messages WHERE message_id='<INBOX-25@example.test>'").get();
  assert.ok(seen.read_at);assert.equal(seen.subject,'Ujian ⚽');
  assert.equal((await syncShinjiruMailbox(env,account.username,'inbox',runner)).busy,true);
  unlock();await syncShinjiruMailbox(env,account.username,'inbox',runner);unlock();await syncShinjiruMailbox(env,account.username,'inbox',runner);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM mailbox_messages').get().n,25);
  assert.equal(db.prepare('SELECT backfill_before FROM mailbox_imap_state').get().backfill_before,1);
  // UIDVALIDITY reset and fresh UIDs must not duplicate exact raw mail or reset local read status.
  validity=101;unlock();await syncShinjiruMailbox(env,account.username,'inbox',runner);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM mailbox_messages').get().n,25);
  assert.equal(db.prepare('SELECT read_at FROM mailbox_messages WHERE id=?').get(seen.id).read_at,seen.read_at);
  live=[27];next=28;unlock();failStore=true;
  await assert.rejects(syncShinjiruMailbox(env,account.username,'inbox',runner),/R2 unavailable/);
  assert.equal(db.prepare('SELECT high_uid FROM mailbox_imap_state').get().high_uid,26);
  unlock();await syncShinjiruMailbox(env,account.username,'inbox',runner);
  assert.equal(db.prepare('SELECT high_uid FROM mailbox_imap_state').get().high_uid,27);
  // Recover if raw/index succeeded but the IMAP-item/cursor write failed.
  db.exec('DELETE FROM mailbox_imap_items WHERE uid=27; UPDATE mailbox_imap_state SET high_uid=26');
  unlock();await syncShinjiruMailbox(env,account.username,'inbox',runner);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM mailbox_messages').get().n,26);
  await syncShinjiruMailbox(env,account.username,'sent',runner);
  await syncShinjiruMailbox(env,account.username,'imap:INBOX.Drafts',runner);
  assert.equal((await adminMailbox(get('?mailbox=admin@refpahang.com&folder=inbox'),env)).status,200);
  let list=await (await adminMailbox(get('?mailbox=admin@refpahang.com&folder=inbox'),env)).json();
  assert.equal(list.total,26);assert.equal(list.folders.length,3);assert.equal(list.oversized,2); // Two UIDVALIDITY snapshots.
  list=await (await adminMailbox(get('?mailbox=admin@refpahang.com&folder=imap:INBOX.Drafts'),env)).json();assert.equal(list.total,1);
  const disabled={...env,MAILBOX_IMAP_ENABLED:'0'};
  assert.equal((await (await adminMailbox(get('?mailbox=admin@refpahang.com&folder=inbox'),disabled)).json()).total,26);
  assert.equal((await (await adminMailbox(get('?mailbox=admin@refpahang.com&folder=imap:INBOX.Drafts'),disabled)).json()).total,1);
  const detail=await (await adminMailbox(get(`?id=${list.data[0].id}`),env)).json();
  assert.equal(detail.data.attachments[0].size,4);assert.ok(detail.data.text.includes('Salam ⚽'));
  assert.equal((await adminMailbox(get('?view=contacts',''),env)).status,401);
  assert.equal((await adminMailbox(get('?view=contacts',refereeCookie),env)).status,403);
  assert.equal((await adminMailbox(post({action:'save-contact',name:'Forbidden',email:'no@example.test'},refereeCookie),env)).status,403);
  const saved=await (await adminMailbox(post({action:'save-contact',name:'Pengurus Ujian',email:' MANAGER@EXAMPLE.TEST '}),env)).json();
  assert.equal(saved.data.email,'manager@example.test');
  assert.equal((await adminMailbox(post({action:'save-contact',name:'Duplicate',email:'manager@example.test'}),env)).status,409);
  await adminMailbox(post({action:'save-contact',id:saved.data.id,name:'Pengurus Baru',email:'new@example.test'}),env);
  let contacts=await (await adminMailbox(get('?view=contacts'),env)).json();assert.equal(contacts.data[0].name,'Pengurus Baru');
  await adminMailbox(post({action:'delete-contact',id:saved.data.id}),env);
  contacts=await (await adminMailbox(get('?view=contacts'),env)).json();assert.equal(contacts.data.length,0);
  assert.equal((await adminMailbox(post({action:'save-contact',name:'Bad\r\nName',email:'bad@example.test'}),env)).status,422);
  assert.equal((await adminMailbox(post({action:'sync',mailbox:'external@example.test'}),env)).status,422);
  assert.equal((await adminMailbox(post({action:'sync',mailbox:account.username}),{...env,MAILBOX_IMAP_ENABLED:'0'})).status,503);
  console.log('IMAP TLS, binary MIME, folders, retry/cursors, UIDVALIDITY, access and address book passed');
} finally {
  for(const socket of sockets)socket.destroy();server.close();close();rmSync(directory,{recursive:true,force:true});
}
