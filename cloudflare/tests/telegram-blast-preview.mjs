import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import ts from 'typescript';

const source=readFileSync(new URL('../src/telegram-blast-preview.ts',import.meta.url),'utf8')
  .replace("import {currentUser,json} from './auth';",`
    const currentUser=async()=>globalThis.actor;
    const json=(body,status=200)=>Response.json(body,{status});`);
const compiled=ts.transpileModule(source,{compilerOptions:{
  target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,
}}).outputText;
const {adminTelegramBlastPreview,externalTelegramBlastPreview}=await import(
  `data:text/javascript,${encodeURIComponent(compiled)}`);
const db=new DatabaseSync(new URL('../../output/cloudflare/refpahang_2026-10-13_hanafi51.sqlite',
  import.meta.url).pathname,{readOnly:true});
const env={TELEGRAM_BOT_USERNAME:'refpahang_bot',DB:{
  prepare:(sql)=>({
    first:async()=>db.prepare(sql).get()??null,
    bind:(...params)=>({
      first:async()=>db.prepare(sql).get(...params)??null,
      all:async()=>({results:db.prepare(sql).all(...params)}),
    }),
  }),
}};
const main='https://staging.example.test/api/admin-telegram-blast.php';
const external='https://staging.example.test/api/pengadil-luar-telegram-blast.php';
globalThis.actor=null;
assert.equal((await adminTelegramBlastPreview(new Request(main),env)).status,401);
assert.equal((await externalTelegramBlastPreview(new Request(`${external}?kejohanan_id=16`),env)).status,401);
globalThis.actor={id:80,role:'Pengadil'};
assert.equal((await adminTelegramBlastPreview(new Request(main),env)).status,403);
assert.equal((await externalTelegramBlastPreview(new Request(`${external}?kejohanan_id=16`),env)).status,403);
globalThis.actor={id:1,role:'Admin'};
const stats=await (await adminTelegramBlastPreview(new Request(main),env)).json();
assert.equal(stats.error,false);
const expected=db.prepare(`SELECT count(*) AS total,sum(CASE WHEN telegram_chat_id IS NOT NULL
  AND trim(telegram_chat_id)<>'' THEN 1 ELSE 0 END) AS linked
  FROM users WHERE aktif=1 AND email IS NOT NULL AND email<>''`).get();
assert.deepEqual({total:stats.total,linked:stats.linked,not_linked:stats.not_linked},
  {total:expected.total,linked:expected.linked,not_linked:expected.total-expected.linked});
assert.equal((await adminTelegramBlastPreview(new Request(main,{method:'POST'}),env)).status,503);
assert.equal((await externalTelegramBlastPreview(new Request(external),env)).status,400);
assert.equal((await externalTelegramBlastPreview(new Request(`${external}?kejohanan_id=999999`),env)).status,404);
const response=await externalTelegramBlastPreview(new Request(`${external}?kejohanan_id=16`),env);
assert.equal(response.status,200);
const preview=(await response.json()).data;
assert.equal(preview.counts.total_external,76);
assert.equal(preview.recipients.length,76);
assert.equal(preview.recent_batches.length<=10,true);
assert.equal(preview.counts.total_external,
  ['linked','no_email','invalid_email','ready','failed','emailed_waiting']
    .reduce((n,key)=>n+preview.counts[key],0));
for(const recipient of preview.recipients){
  assert.equal('tg_link_token' in recipient,false);
  assert.equal('telegram_chat_id' in recipient,false);
  assert.equal(recipient.link_url===null || recipient.link_url.startsWith('https://t.me/refpahang_bot?start='),true);
}
assert.equal((await externalTelegramBlastPreview(new Request(`${external}?kejohanan_id=16`,
  {method:'POST'}),env)).status,503);
db.close();
console.log('Telegram blast previews: Admin scope, imported D1 counts, recipients and closed writes passed');
