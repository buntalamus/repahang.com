import assert from 'node:assert/strict';
import {bundle,openDatabase,sessionCookie} from './_harness.mjs';

const {appointmentLetter,signedLetterUrl,letterHtml}=await bundle(
  "export {appointmentLetter,signedLetterUrl,letterHtml} from '../src/appointment-letter';");
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
// Names with markup must come out escaped; the owner's own phone stays off the letter.
db.prepare("UPDATE users SET nama_penuh='Ali <b>Bin</b> & Abu', no_telefon='0199998888' WHERE id=?").run(accepted.pengadil_id);
// The rest of the crew is listed with region and phone so they can contact each other. The
// region comes from the Pahang district list or the state list, never the address fields.
const crewmate=db.prepare(`SELECT id,pengadil_id,pengadil_luar_id FROM lantikan_pengadil
  WHERE jadual_id=? AND id<>? AND status IN ('Belum Jawab','Diterima') LIMIT 1`).get(accepted.jadual_id,accepted.id);
const lipis=db.prepare("SELECT id FROM districts WHERE nama='Lipis'").get().id;
if(crewmate.pengadil_id) db.prepare(`UPDATE users SET daerah='KARAK, BENTONG',negeri='PAHANG',district_id=?,
  no_telefon='0127776666' WHERE id=?`).run(lipis,crewmate.pengadil_id);
else db.prepare("UPDATE pengadil_luar SET daerah='lipis',negeri='PAHANG',no_tel='0127776666' WHERE id=?").run(crewmate.pengadil_luar_id);
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
  assert.match(html,/Daerah \/ Negeri<\/th><th[^>]*>No\. Telefon/);
  assert.match(html,/<td>Lipis<\/td><td class="nowrap">0127776666<\/td>/);
  assert.doesNotMatch(html,/KARAK/);
  // External officials: state from the official list; a Pahang district only when it is on the list.
  const region=(member)=>/<td>([^<]*)<\/td><td class="nowrap">/.exec(letterHtml(
    {id:1,jawatan:'Pengadil'},[{jawatan:'Pegawai ke4',nama:'X',no_telefon:null,...member}],'','-'))[1];
  assert.equal(region({luar:1,daerah:null,negeri:'kuala lumpur'}),'WP Kuala Lumpur');
  assert.equal(region({luar:1,daerah:null,negeri:'PULAU PINANG'}),'Pulau Pinang');
  assert.equal(region({luar:1,daerah:'Kuantan',negeri:'Pahang'}),'Kuantan');
  assert.equal(region({luar:1,daerah:null,negeri:'Pahang'}),'Pahang');
  assert.equal(region({luar:1,daerah:null,negeri:'Gurun'}),'-');
  assert.equal(region({luar:0,daerah:null,negeri:null}),'Pahang');
  assert.match(html,/Sekian, terima kasih\.<\/p>\s*<p class="sign">Urusetia Lantikan Pengadil<\/p>/);

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
  console.log('Appointment letter: owner/Admin access, Diterima only, escaping, crew contacts, signed links passed');
} finally {close();}
