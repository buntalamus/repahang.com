import assert from 'node:assert/strict';
import {deflateSync,crc32} from 'node:zlib';
import {bundle,openDatabase,sessionCookie} from './_harness.mjs';

// The minimum verified matches for a session are counted, and linked, from the
// season before it (session 2027 -> matches of 2026), whatever the send date.
const {submitRefereeApplication}=await bundle("export {submitRefereeApplication} from '../src/application-submit';");
const {db,DB,close}=openDatabase(['0001_worker_sessions','0011_application_uniqueness']);
const objects=new Map();
const pdf=new TextEncoder().encode('%PDF-1.7\n% test');
const env={DB,STAGING_AUTH_ENABLED:'1',STAGING_WRITES_ENABLED:'1',
  BASE_URL:'https://staging.refpahang.example',
  MAIL_DAFTAR_USER:'daftar@refpahang.example',MAIL_DAFTAR_NAME:'PBNP',
  EMAIL:{send:async()=>({messageId:'test'})},
  MEDIA:{put:async(key,bytes,options)=>objects.set(key,{bytes,options}),
    get:async key=>objects.has(key)?{
      httpMetadata:{contentType:objects.get(key).options.httpMetadata.contentType},
      arrayBuffer:async()=>objects.get(key).bytes.buffer,
    }:null,delete:async key=>objects.delete(key)},
  ASSETS:{fetch:async()=>new Response('missing',{status:404})},
  BROWSER:{quickAction:async()=>new Response(pdf,{headers:{'Content-Type':'application/pdf'}})},
};

// A 150x150 grey PNG: the smallest profile picture the form accepts.
function png(size=150) {
  const chunk=(type,data)=>{
    const body=Buffer.concat([Buffer.from(type),data]);
    const length=Buffer.alloc(4);length.writeUInt32BE(data.length);
    const crc=Buffer.alloc(4);crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length,body,crc]);
  };
  const header=Buffer.alloc(13);
  header.writeUInt32BE(size,0);header.writeUInt32BE(size,4);header[8]=8;header[9]=0;
  const rows=Buffer.alloc(size*(size+1),0x80);
  for (let row=0;row<size;row++) rows[row*(size+1)]=0;
  return new Uint8Array(Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),
    chunk('IHDR',header),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]));
}
const picture=png();
const userId=80;
const cookie=await sessionCookie(db,userId);
const setting=(key,value)=>db.prepare(`INSERT INTO application_settings(setting_key,setting_value) VALUES(?,?)
  ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value`).run(key,value);
function form() {
  const data=new FormData();
  data.set('jenis_borang','pengadil_berdaftar');
  data.set('nama_waris','Waris Ujian');
  data.set('hubungan_waris','Keluarga');
  data.set('telefon_waris','0123456789');
  data.set('saiz_baju','M');
  data.set('resit',new File([picture],'resit.png',{type:'image/png'}));
  data.set('gambar',new File([picture],'gambar.png',{type:'image/png'}));
  return data;
}
const post=()=>submitRefereeApplication(new Request('https://staging.refpahang.example/api/pengadil-application.php',{
  method:'POST',headers:{Cookie:cookie},body:form()}),env);
const verified=(year)=>db.prepare(`SELECT COUNT(*) n FROM perlawanan WHERE user_id=? AND status_pp='Disahkan'
  AND substr(tarikh,1,4)=?`).get(userId,String(year)).n;

try {
  // These tests are about other rules; the snapshot's past open/close dates would close the forms.
  db.prepare(`UPDATE application_settings SET setting_value='' WHERE setting_key LIKE '%\\_open\\_date' ESCAPE '\\'
    OR setting_key LIKE '%\\_close\\_date' ESCAPE '\\'`).run();
  setting('berdaftar_open','1');
  setting('min_verified_matches','20');
  db.prepare("UPDATE users SET alamat1=COALESCE(NULLIF(alamat1,''),'Alamat Ujian') WHERE id=?").run(userId);
  assert.ok(verified(2026)>=20);
  assert.equal(verified(2027),0);

  // Session 2028 counts the 2027 season, which has no verified matches yet,
  // even though the calendar year (2026) has plenty.
  setting('application_year','2028');
  let response=await post();
  let body=await response.json();
  assert.equal(response.status,400);
  assert.equal(body.verified_count,0);
  assert.match(body.message,/pada tahun 2027 diperlukan untuk sesi 2028/);

  // Session 2027 counts and links the 2026 season.
  setting('application_year','2027');
  response=await post();
  body=await response.json();
  assert.equal(response.status,200,JSON.stringify(body));
  assert.equal(body.linked_matches,db.prepare(`SELECT COUNT(*) n FROM perlawanan WHERE user_id=?
    AND permohonan_id=?`).get(userId,body.application_id).n);
  assert.equal(db.prepare(`SELECT COUNT(*) n FROM perlawanan WHERE permohonan_id=?
    AND substr(tarikh,1,4)<>'2026'`).get(body.application_id).n,0);
  assert.ok(body.linked_matches>0);
  console.log('annual match year: session N counts and links verified matches of year N-1');
} finally {
  close();
}
