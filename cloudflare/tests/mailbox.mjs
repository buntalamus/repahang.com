import assert from 'node:assert/strict';
import {bundle,openDatabase,sessionCookie} from './_harness.mjs';

const {adminMailbox,receiveMailboxEmail}=await bundle(
  "export {adminMailbox,receiveMailboxEmail} from '../src/mailbox';"
);
const {db,DB,close}=openDatabase(['0001_worker_sessions','0013_mailbox']);
const objects=new Map();
const MEDIA={
  async put(key,value){objects.set(key,await new Response(value).arrayBuffer());},
  async get(key){const bytes=objects.get(key);return bytes===undefined?null:{
    body:new Response(bytes).body,arrayBuffer:async()=>bytes,
  };},
  async delete(key){objects.delete(key);},
};
const sent=[];
const env={DB,MEDIA,STAGING_AUTH_ENABLED:'1',STAGING_WRITES_ENABLED:'0',
  MAILBOX_SEND_ENABLED:'0',MAIL_DAFTAR_USER:'daftar@refpahang.com',
  MAIL_DAFTAR_NAME:'Pendaftaran Pengadil Pahang',
  EMAIL:{send:async message=>{sent.push(message);return {messageId:'test-accepted'};}}};
const endpoint='https://staging.example.test/api/admin-mailbox.php';
const admin=db.prepare("SELECT id FROM users WHERE role='Admin' AND aktif=1 LIMIT 1").get();
const referee=db.prepare("SELECT id FROM users WHERE role='Pengadil' AND aktif=1 LIMIT 1").get();
const adminCookie=await sessionCookie(db,admin.id);
const refereeCookie=await sessionCookie(db,referee.id);
const get=(cookie,search='')=>new Request(endpoint+search,{headers:{Cookie:cookie}});
const post=(cookie,body)=>new Request(endpoint,{method:'POST',headers:{Cookie:cookie},body:JSON.stringify(body)});

try {
  const raw='From: Sender <sender@example.test>\r\nTo: daftar@refpahang.com\r\n'
    +'Subject: Permohonan ujian\r\nMessage-ID: <mail-1@example.test>\r\n'
    +'MIME-Version: 1.0\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nSalam admin.';
  const message={from:'sender@example.test',to:'daftar@refpahang.com',
    headers:new Headers({'from':'Sender <sender@example.test>',subject:'Permohonan ujian',
      'message-id':'<mail-1@example.test>'}),
    rawSize:new TextEncoder().encode(raw).byteLength,
    raw:new Response(raw).body,setReject(reason){this.rejected=reason;}};
  await receiveMailboxEmail(message,env);
  assert.equal(objects.size,1);
  const row=db.prepare('SELECT * FROM mailbox_messages').get();
  assert.equal(row.mailbox,'daftar@refpahang.com');
  assert.equal(row.folder,'inbox');
  assert.equal((await adminMailbox(get(''),env)).status,401);
  assert.equal((await adminMailbox(get(refereeCookie),env)).status,403);
  const list=await (await adminMailbox(get(adminCookie),env)).json();
  assert.equal(list.total,1);
  assert.equal(list.data[0].subject,'Permohonan ujian');
  const detail=await (await adminMailbox(get(adminCookie,`?id=${row.id}`),env)).json();
  assert.equal(detail.data.text.trim(),'Salam admin.');
  assert.equal(detail.data.reply_address,'sender@example.test');
  assert.ok(db.prepare('SELECT read_at FROM mailbox_messages WHERE id=?').get(row.id).read_at);
  const download=await adminMailbox(get(adminCookie,`?id=${row.id}&download=1`),env);
  assert.equal(download.headers.get('Content-Type'),'message/rfc822');
  assert.equal(await download.text(),raw);
  const unknown={...message,to:'unknown@refpahang.com',raw:new Response(raw).body};
  await receiveMailboxEmail(unknown,env);
  assert.equal(unknown.rejected,'Unknown RefPahang mailbox');
  assert.equal(db.prepare('SELECT count(*) AS n FROM mailbox_messages').get().n,1);
  const body={from:'daftar@refpahang.com',to:'owner@example.test',
    subject:'Balasan',text:'Terima kasih.',request_id:crypto.randomUUID()};
  assert.equal((await adminMailbox(post(adminCookie,body),env)).status,503);
  env.STAGING_WRITES_ENABLED='1';
  assert.equal((await adminMailbox(post(adminCookie,body),env)).status,503);
  env.MAILBOX_SEND_ENABLED='1';
  assert.equal((await adminMailbox(post(refereeCookie,body),env)).status,403);
  const response=await (await adminMailbox(post(adminCookie,body),env)).json();
  assert.equal(response.data.delivery_status,'sent');
  assert.equal(sent.length,1);
  assert.equal(sent[0].from.email,'daftar@refpahang.com');
  assert.equal((await (await adminMailbox(post(adminCookie,body),env)).json()).data.id,response.data.id);
  assert.equal(sent.length,1);
  const sentList=await (await adminMailbox(get(adminCookie,'?mailbox=daftar@refpahang.com&folder=sent'),env)).json();
  assert.equal(sentList.total,1);
  const uncertain={...body,request_id:crypto.randomUUID(),subject:'Status belum pasti'};
  env.DB={...DB,prepare(sql){
    if(sql.includes("UPDATE mailbox_messages SET delivery_status='sent'")) {
      return {bind(){return {async run(){throw new Error('synthetic D1 outage');}};}};
    }
    return DB.prepare(sql);
  }};
  const accepted=await adminMailbox(post(adminCookie,uncertain),env);
  assert.equal(accepted.status,202);
  assert.equal((await accepted.json()).data.delivery_status,'processing');
  const repeated=await (await adminMailbox(post(adminCookie,uncertain),env)).json();
  assert.equal(repeated.data.delivery_status,'processing');
  assert.equal(sent.length,2);
  console.log('Cloudflare mailbox: inbound R2/D1, Admin isolation, EML, outgoing gate and idempotence passed');
} finally {close();}
