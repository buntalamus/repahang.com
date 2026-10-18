import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {renderOriginalLocally} from './_harness.mjs';
const output=new URL('../../output/template-restoration/',import.meta.url);
mkdirSync(output,{recursive:true});
const fixture=JSON.parse(readFileSync(new URL('./fixtures/original-profile.json',import.meta.url)));
const data=fixture.data;
const report={nama_kejohanan:'KEJOHANAN CONTOH',nama_penilai:'PENILAI CONTOH',penilai_negeri:'Pahang',
  pasukan_home:'A FC',pasukan_away:'B FC',no_perlawanan:'01',tarikh:'2026-10-01',masa:'10:00:00',
  tempat:'PADANG CONTOH',cuaca:'Cerah',tahap_kesukaran:'Susah',tarikh_sahkan:'2026-10-02',
  skor_ht_home:1,skor_ht_away:0,skor_ft_home:1,skor_ft_away:1,skor_et_home:null,skor_et_away:null,
  skor_ps_home:null,skor_ps_away:null,catatan_pengerusi:'Catatan contoh',pengesahan_status:'Disahkan',
  pengesah_nama:'PENGERUSI CONTOH',pengesah_jawatan:'Pengerusi Pengadil',ulasan_keseluruhan:'Ulasan contoh'};
const officials=['Pengadil','Penolong Pengadil 1','Penolong Pengadil 2','Pegawai ke4'].map((jawatan,index)=>({
  jawatan,nama_pengadil:'PEGAWAI CONTOH '+index,negeri:'Pahang',prestasi:'Baik',markah:8.4,
  ...Object.fromEntries(['kawalan','fizikal','kerjasama'].flatMap(section=>[
    [section+'_kekuatan',JSON.stringify(['Kekuatan contoh'])],[section+'_kelemahan',JSON.stringify(['Penambahbaikan contoh'])],[section+'_nasihat','Nasihat contoh'],
  ])),
}));
const document={kejohanan:{nama:'KEJOHANAN CONTOH',tarikh_mula:'2026-10-01',tarikh_akhir:'2026-10-02',tempat:'PADANG CONTOH',logo_kiri:'',logo_kanan:''},
  region_label:'Daerah',pengesahan:null,stats:{total_perlawanan:1,lantikan_lengkap:0,jumlah_lantikan:0,jumlah_terima:0,kadar_terima:0},
  jadual:[{id:1,no_perlawanan:'01',tarikh:'2026-10-01',hari:'Khamis',masa:'10:00',kategori:'B18',peringkat:'Kumpulan',kumpulan:'A',pasukan_home:'A FC',pasukan_away:'B FC',tempat:'PADANG CONTOH',assignments:Object.fromEntries(['Pengadil','Penolong Pengadil 1','Penolong Pengadil 2','Pegawai ke4','Penilai Pengadil'].map(p=>[p,null]))}]};
const cases=[
  ['R1_R2_R4',{...fixture}],['R1_RA',{...fixture,type:'penilai_berdaftar'}],
  ['R4',{...fixture,type:'kelas3_fam'}],['R11_III',{...fixture,type:'ujian_bertulis'}],['R11_I',{...fixture,type:'ujian_kelas1'}],
  ['RA_Report',{kind:'assessment',report,officials,autoprint:false}],
  ['Jadual',{kind:'schedule',document,printedBy:'ADMIN CONTOH'}],
  ['Futsal',{kind:'futsal',data}],['Fitness',{kind:'fitness',data}],
];
cases.push(['R1_RA_Photo',{...fixture,type:'penilai_berdaftar',photo:'data:image/png;base64,'+readFileSync(new URL('../../assets/Pahang_FA_logo.png',import.meta.url)).toString('base64')}]);
const application={...data,user_email:data.emel,jenis_borang:'penilai_berdaftar',user_role:'Penilai'};
const emailCases=[
 ['welcome',[data.emel,data.nama_penuh,data.emel,'CONTOH123','Pengadil','https://t.me/refpahang_bot?start=contoh']],
 ['kelas3Welcome',[data.emel,data.nama_penuh,data.emel,'CONTOH123','https://refpahang.com/login']],
 ['forgotPassword',[{nama_penuh:data.nama_penuh,email:data.emel},'https://refpahang.com/reset-kata-laluan?token=contoh']],
 ['receipt',[data.emel,data.nama_penuh,9001,data.jenis_pengadil,[true],2026,'penilai_berdaftar',80,'Penilai']],
 ['approval',[application,'Nota contoh']],['rejection',[application,'Sebab contoh']],
 ['testApproval',[application,'fitness','Nota contoh']],['testRejection',[application,'written','Sebab contoh']],['testAbsent',[application,'kelas1','Nota contoh']],
 ['annualStage',[application,'fitness_pass','Nota contoh']],
 ['ppApplicant',[application,'approved','']],['ppAdmin',[application,'PP CONTOH']],
 ['reviewer',[1,application,'']],['telegramBlast',[{nama_penuh:data.nama_penuh,email:data.emel},'https://t.me/refpahang_bot?start=contoh','refpahang_bot']],
 ['externalTelegram',[data.nama_penuh,'KEJOHANAN CONTOH','https://t.me/refpahang_bot?start=contoh']],
 ['groupMatch',['PP CONTOH',data.nama_penuh,{home_team:'A FC',away_team:'B FC',tarikh:'2026-10-01',masa:'10:00',jenis:'Persahabatan',nama_kejohanan:'KEJOHANAN CONTOH',tempat:'PADANG CONTOH'},[{nama:'PEGAWAI CONTOH',jawatan:'Pengadil'}],'KUANTAN']],
];
for(const stage of ['documents','fitness_fail','fitness_absent','registered'])
 cases.push(['email_annual_'+stage,{kind:'email',template:'annualStage',args:[application,stage,'Catatan contoh']}]);
cases.push(['email_pp_rejected',{kind:'email',template:'ppApplicant',args:[application,'rejected','Sebab contoh']}]);
for(const role of ['Admin','PP Daerah'])cases.push(['email_ra_'+role.replaceAll(' ','_'),
 {kind:'email',template:'approval',args:[{...application,user_role:role},'']}]);
for(const kind of ['written','kelas1'])cases.push(['email_test_approval_'+kind,{kind:'email',template:'testApproval',args:[application,kind,'']}]);
cases.push(['email_welcome_ra',{kind:'email',template:'welcome',args:[data.emel,data.nama_penuh,data.emel,'CONTOH123','Penilai','https://t.me/refpahang_bot?start=contoh']}]);
for(const [template,args] of emailCases)cases.push(['email_'+template,{kind:'email',template,args,rows:[{nama_penuh:'PENERIMA CONTOH',email:'penerima@example.invalid'}]}]);
const rows=[];
const normalize=s=>s.replace(/\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}/g,'[masa cetak]');
for(const [name,payload] of cases){
  const native=renderOriginalLocally(payload);
  const response=await fetch(process.env.ORIGINAL_RENDER_URL || 'http://localhost:4198/render',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  assert.equal(response.status,200,`Wasm renderer failed for ${name}`);
  const edge=await response.json();
  if(edge.mime==='application/pdf'){
    for(const [label,result] of [['native',native],['worker',edge]])writeFileSync(new URL(`${name}-${label}.pdf`,output),Buffer.from(result.base64,'base64'));
    rows.push({name,mime:edge.mime,pdf:true});
  }else{
    const oldHtml=native.html || native.email.html,newHtml=edge.html || edge.email.html;
    assert.ok(normalize(oldHtml)===normalize(newHtml),`Original PHP and Wasm markup differ: ${name}`);
    for(const [label,html] of [['native',oldHtml],['worker',newHtml]])writeFileSync(new URL(`${name}-${label}.html`,output),html);
    rows.push({name,mime:edge.mime,identicalMarkup:true});
  }
}
writeFileSync(new URL('parity-results.json',output),JSON.stringify(rows,null,2));
// Concurrent requests must not expose a previous recipient's name or credentials.
const concurrent=await Promise.all(Array.from({length:4},async(_,index)=>{
  const payload={kind:'email',template:'welcome',args:['qa@example.invalid','PENERIMA_'+index,'qa@example.invalid','UJIAN_'+index,'Pengadil','']};
  const response=await fetch(process.env.ORIGINAL_RENDER_URL || 'http://localhost:4198/render',{method:'POST',body:JSON.stringify(payload)});
  assert.equal(response.status,200,'Concurrent original rendering');
  const result=await response.json();
  assert.ok(result.email.html.includes('PENERIMA_'+index),'Correct recipient');
  for(let other=0;other<4;other++)if(other!==index)assert.ok(!result.email.html.includes('PENERIMA_'+other),'Recipient isolation');
  return true;
}));
assert.equal(concurrent.length,4);
const invalid=await fetch(process.env.ORIGINAL_RENDER_URL || 'http://localhost:4198/render',{method:'POST',body:JSON.stringify({kind:'registration'})});
assert.equal(invalid.status,503,'Malformed internal data fails safely');
const recovery=await fetch(process.env.ORIGINAL_RENDER_URL || 'http://localhost:4198/render',{method:'POST',body:JSON.stringify({kind:'futsal',data})});
assert.equal(recovery.status,200,'Runtime recovers after a failed render');
console.log(`Original PHP / Cloudflare Wasm parity: ${rows.length} documents and emails passed; no external delivery`);
