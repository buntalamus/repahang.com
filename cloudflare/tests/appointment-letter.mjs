import assert from 'node:assert/strict';
import {bundle,openDatabase,sessionCookie} from './_harness.mjs';

const {appointmentLetter,signedLetterUrl}=await bundle(
  "export {appointmentLetter,signedLetterUrl} from '../src/appointment-letter';");
const {db,DB,close}=openDatabase(['0001_worker_sessions']);

const base='https://refpahang.com/api/surat-lantikan.php';
const rendered=[];
const env={DB,STAGING_AUTH_ENABLED:'1',APPOINTMENT_LETTER_SECRET:'k'.repeat(40),
  ASSETS:{fetch:async()=>new Response(new Uint8Array([137,80,78,71]),{headers:{'Content-Type':'image/png'}})},
  BROWSER:{quickAction:async(kind,options)=>{rendered.push(options.html);
    return new Response('%PDF-1.4 test',{headers:{'Content-Type':'application/pdf'}});}}};

// An accepted appointment with crew, its official, another official and an Admin.
const accepted=db.prepare(`SELECT lp.id,lp.pengadil_id,lp.jadual_id FROM lantikan_pengadil lp
  WHERE lp.status='Diterima' AND lp.pengadil_id IS NOT NULL
    AND (SELECT count(*) FROM lantikan_pengadil x WHERE x.jadual_id=lp.jadual_id AND x.id<>lp.id
      AND x.status IN ('Belum Jawab','Diterima'))>0 LIMIT 1`).get();
const other=db.prepare("SELECT id FROM users WHERE role='Pengadil' AND aktif=1 AND id<>? LIMIT 1").get(accepted.pengadil_id).id;
const admin=db.prepare("SELECT id FROM users WHERE role='Admin' AND aktif=1 LIMIT 1").get().id;
// Names with markup must come out escaped; phone numbers must not appear.
db.prepare("UPDATE users SET nama_penuh='Ali <b>Bin</b> & Abu', no_telefon='0199998888' WHERE id=?").run(accepted.pengadil_id);
const ownerCookie=await sessionCookie(db,accepted.pengadil_id);
const get=(query,cookie)=>new Request(`${base}?${query}`,{headers:cookie?{Cookie:cookie}:{}});
const post=(body,cookie)=>new Request(base,{method:'POST',headers:{Cookie:cookie},body:JSON.stringify(body)});

try {
  // Owner with a session gets the PDF; the letter carries the details.
  let response=await appointmentLetter(get(`id=${accepted.id}`,ownerCookie),env);
  assert.equal(response.status,200);
  assert.equal(response.headers.get('Content-Type'),'application/pdf');
  assert.match(response.headers.get('Content-Disposition'),/^inline; filename="Surat_Lantikan_/);
  const html=rendered.at(-1);
  assert.match(html,/SURAT LANTIKAN PEGAWAI PERLAWANAN/);
  assert.match(html,new RegExp(`PBNP/LTK/\\d{4}/${accepted.id}`));
  assert.match(html,/Ali &lt;b&gt;Bin&lt;\/b&gt; &amp; Abu/);
  assert.doesNotMatch(html,/0199998888/);
  assert.match(html,/class="crew"/);

  // Not logged in, someone else, or not yet accepted: refused.
  assert.equal((await appointmentLetter(get(`id=${accepted.id}`),env)).status,401);
  const otherCookie=await sessionCookie(db,other);
  assert.equal((await appointmentLetter(get(`id=${accepted.id}`,otherCookie),env)).status,404);
  assert.equal((await appointmentLetter(post({id:accepted.id},otherCookie),env)).status,404);
  db.prepare("UPDATE lantikan_pengadil SET status='Belum Jawab' WHERE id=?").run(accepted.id);
  assert.equal((await appointmentLetter(get(`id=${accepted.id}`,ownerCookie),env)).status,403);
  db.prepare("UPDATE lantikan_pengadil SET status='Diterima' WHERE id=?").run(accepted.id);

  // Admin may open any accepted letter.
  assert.equal((await appointmentLetter(get(`id=${accepted.id}`,await sessionCookie(db,admin)),env)).status,200);

  // The app asks for a signed link, then opens it without a session.
  const link=await (await appointmentLetter(post({id:accepted.id},ownerCookie),env)).json();
  assert.equal(link.error,false);
  const url=new URL(link.url);
  assert.equal(url.pathname,'/api/surat-lantikan.php');
  assert.equal((await appointmentLetter(new Request(link.url),env)).status,200);
  const tampered=new URL(link.url);tampered.searchParams.set('u',String(other));
  assert.equal((await appointmentLetter(new Request(tampered),env)).status,403);
  const otherId=new URL(link.url);otherId.searchParams.set('id',String(accepted.id+1));
  assert.equal((await appointmentLetter(new Request(otherId),env)).status,403);
  const expired=await signedLetterUrl(env,'https://refpahang.com',accepted.id,accepted.pengadil_id,Date.now()-3600_000);
  assert.equal((await appointmentLetter(new Request(expired),env)).status,403);
  // No secret configured: no links are issued.
  assert.equal((await appointmentLetter(post({id:accepted.id},ownerCookie),{...env,APPOINTMENT_LETTER_SECRET:''})).status,503);
  console.log('Appointment letter: owner/Admin access, Diterima only, escaping, no phones, signed links passed');
} finally {close();}
