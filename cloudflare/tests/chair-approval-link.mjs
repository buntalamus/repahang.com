import assert from 'node:assert/strict';
import {copyFileSync,mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import ts from 'typescript';

const source=readFileSync(new URL('../src/chair-approval-link.ts',import.meta.url),'utf8')
  .replace("import {confirmChairReport} from './chair-confirm-core';",
    "const confirmChairReport=async(...args)=>globalThis.confirmChairReportTest(...args);");
const compiled=ts.transpileModule(source,{compilerOptions:{
  target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,
}}).outputText;
const {chairApprovalLink}=await import(`data:text/javascript,${encodeURIComponent(compiled)}`);
const dir=mkdtempSync(join(tmpdir(),'refpahang-chair-'));
const path=join(dir,'database.sqlite');
copyFileSync(new URL('../../output/cloudflare/refpahang_2026-10-13_hanafi51.sqlite',
  import.meta.url),path);
const db=new DatabaseSync(path);
const env={STAGING_AUTH_ENABLED:'0',DB:{prepare:(sql)=>({bind:(...params)=>({
  first:async()=>db.prepare(sql).get(...params)??null,
})})}};
try{
  const row=db.prepare(`SELECT a.id,a.laporan_id,a.approval_token FROM
    laporan_pengesahan_pengerusi a JOIN laporan_penilaian r ON r.id=a.laporan_id
    WHERE length(a.approval_token)=64 AND r.status='Disahkan' LIMIT 1`).get();
  assert.ok(row);
  const url=`https://staging.example.test/api/laporan-pengesahan-token.php?token=${row.approval_token}`;
  assert.equal((await chairApprovalLink(new Request(url),env)).status,503);
  env.STAGING_AUTH_ENABLED='1';
  assert.equal((await chairApprovalLink(new Request('https://staging.example.test/api/laporan-pengesahan-token.php?token=bad'),env)).status,404);
  assert.equal((await chairApprovalLink(new Request(url+'&token=bad'),env)).status,404);
  const processed=await chairApprovalLink(new Request(url),env);
  assert.equal(processed.status,200);
  assert.match(await processed.text(),/Laporan Telah Diproses/);
  db.prepare("UPDATE laporan_pengesahan_pengerusi SET status='Menunggu',pengesah_nama='<script>alert(1)</script>' WHERE id=?")
    .run(row.id);
  db.prepare("UPDATE laporan_penilaian SET status='Dihantar' WHERE id=?").run(row.laporan_id);
  const pending=await chairApprovalLink(new Request(url),env);
  assert.equal(pending.status,200);
  const body=await pending.text();
  assert.match(body,/Lihat Laporan Penuh/);
  assert.match(body,/download-laporan-penilaian.php/);
  assert.equal(body.includes('<script>alert(1)</script>'),false);
  assert.equal(body.includes('&lt;script&gt;alert(1)&lt;/script&gt;'),true);
  assert.equal(body.includes('<form'),false,'No confirmation form before POST parity');
  assert.equal((await chairApprovalLink(new Request(url,{method:'POST'}),env)).status,503);
  assert.equal(db.prepare('SELECT status FROM laporan_pengesahan_pengerusi WHERE id=?').get(row.id).status,
    'Menunggu','A closed POST must not modify approval state');
  env.STAGING_WRITES_ENABLED='1';env.REPORT_DELIVERY_ENABLED='1';
  const ready=await chairApprovalLink(new Request(url),env);
  assert.match(await ready.text(),/Sahkan Laporan/);
  assert.match(ready.headers.get('Content-Security-Policy'),/form-action 'self'/);
  globalThis.confirmChairReportTest=async(_env,token,comment)=>{
    assert.equal(token,row.approval_token);
    assert.equal(comment,'<script>alert(1)</script>');
    return 'confirmed';
  };
  const post=(body)=>new Request('https://staging.example.test/api/laporan-pengesahan-token.php',{
    method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body,
  });
  const result=await chairApprovalLink(post(new URLSearchParams({token:row.approval_token,
    catatan_pengerusi:'<script>alert(1)</script>'})),env);
  assert.equal(result.status,200);
  assert.match(await result.text(),/&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.equal((await chairApprovalLink(post(new URLSearchParams({token:row.approval_token,
    catatan_pengerusi:'x'.repeat(5001)})),env)).status,422);
  console.log('Chair approval link: imported D1 token, processed/pending views, escape and closed POST passed');
}finally{db.close();rmSync(dir,{recursive:true,force:true});}
