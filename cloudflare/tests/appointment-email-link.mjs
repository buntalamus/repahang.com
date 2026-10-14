import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/appointment-email-link.ts',import.meta.url),'utf8')
  .replace("import { expiryDeadline, recordAppointmentReply } from './appointment-response-core';",
    `const expiryDeadline = () => globalThis.testExpired ? Date.now()-1 : null;
     const recordAppointmentReply = async (...args) => {
       globalThis.testReplies.push(args); return globalThis.testOutcome;
     };`);
const code = ts.transpileModule(source,{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},
}).outputText;
const { appointmentEmailLink } = await import(`data:text/javascript,${encodeURIComponent(code)}`);

const token='a'.repeat(32);
globalThis.testExpired=false;
globalThis.testReplies=[];
globalThis.testOutcome={kind:'answered',status:'Diterima'};
globalThis.testAppointment={
  id:7,status:'Belum Jawab',jawatan:'Pengadil',pengadil_id:1,
  notif_hantar:1,tarikh_notif:'2026-12-01 10:00:00',
  tarikh:'2026-12-02',masa:'18:00:00',jenis_kejohanan:'Liga',
  pasukan_home:'A <script>',pasukan_away:'B',tempat:'Padang',
};
const env={
  STAGING_AUTH_ENABLED:'0',STAGING_WRITES_ENABLED:'0',APPOINTMENT_DELIVERY_ENABLED:'0',
  DB:{prepare:() => ({bind:() => ({first:async () => globalThis.testAppointment})})},
};
const get = (action='accept',value=token) => new Request(
  `https://staging.example.test/api/lantikan-jawab-token.php?token=${value}&action=${action}`);
const post = (action='accept',value=token) => new Request(
  'https://staging.example.test/api/lantikan-jawab-token.php',{
    method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({token:value,action}).toString(),
  });

assert.equal((await appointmentEmailLink(get(),env)).status,503);
Object.assign(env,{STAGING_AUTH_ENABLED:'1',STAGING_WRITES_ENABLED:'1',APPOINTMENT_DELIVERY_ENABLED:'1'});
assert.equal((await appointmentEmailLink(new Request(get().url,{method:'PUT'}),env)).status,405);
assert.match(await (await appointmentEmailLink(get('wrong'),env)).text(),/Pautan Tidak Sah/);
assert.match(await (await appointmentEmailLink(get('accept','x'.repeat(32)),env)).text(),/Pautan Tidak Sah/);
const confirmation=await appointmentEmailLink(get(),env);
assert.equal(confirmation.status,200);
assert.equal(confirmation.headers.get('Referrer-Policy'),'no-referrer');
const html=await confirmation.text();
assert.match(html,/Terima Tugasan/);
assert.match(html,/A &lt;script&gt;/);
assert.doesNotMatch(html,/<script>/);
assert.equal(globalThis.testReplies.length,0,'GET must remain read-only');
globalThis.testExpired=true;
assert.match(await (await appointmentEmailLink(get(),env)).text(),/Tempoh Menjawab Tamat/);
assert.equal(globalThis.testReplies.length,0);
globalThis.testExpired=false;
const accepted=await appointmentEmailLink(post(),env);
assert.match(await accepted.text(),/Tugasan Diterima/);
assert.deepEqual(globalThis.testReplies[0].slice(1),
  [7,'accept','',{kind:'email',value:token}]);
globalThis.testOutcome={kind:'expired'};
assert.match(await (await appointmentEmailLink(post(),env)).text(),/Tempoh Menjawab Tamat/);
globalThis.testOutcome={kind:'already_answered'};
assert.match(await (await appointmentEmailLink(post(),env)).text(),/Tugasan Sudah Dijawab/);
assert.equal(globalThis.testReplies.length,3);
console.log('appointment email link: gate, read-only GET, escaped HTML, POST and outcomes passed');
