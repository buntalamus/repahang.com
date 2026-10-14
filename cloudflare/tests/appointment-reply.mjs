import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/appointment-reply.ts', import.meta.url),'utf8')
  .replace("import { currentUser, json } from './auth';",
    `const currentUser = async () => globalThis.testActor;
     const json = (body,status=200) => new Response(JSON.stringify(body),{status});`)
  .replace("import { recordAppointmentReply } from './appointment-response-core';",
    `const recordAppointmentReply = async (...args) => {
       globalThis.testCalls.push(args); return globalThis.testOutcome;
     };`)
  .replace("import { boundedJson } from './request';",
    `const boundedJson = async (request) => request.json();`);
const code = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const { appointmentReply } = await import(`data:text/javascript,${encodeURIComponent(code)}`);
const env = { STAGING_AUTH_ENABLED:'0',STAGING_WRITES_ENABLED:'0',APPOINTMENT_DELIVERY_ENABLED:'0' };
globalThis.testActor = { id:7,role:'Pengadil' };
globalThis.testCalls = [];
globalThis.testOutcome = {kind:'answered',status:'Diterima'};
const request = (body,method='POST') => new Request('https://staging.example.test/api/lantikan-jawab.php',{
  method,headers:{'Content-Type':'application/json'},
  ...(method === 'POST' ? { body:JSON.stringify(body) } : {}),
});
const status = async (body,expected) => assert.equal((await appointmentReply(request(body),env)).status,expected);

await status({lantikan_id:1,action:'accept'},503);
assert.equal((await appointmentReply(request({},'GET'),env)).status,405);
Object.assign(env,{STAGING_AUTH_ENABLED:'1',STAGING_WRITES_ENABLED:'1'});
await status({lantikan_id:1,action:'accept'},503);
env.APPOINTMENT_DELIVERY_ENABLED='1';
globalThis.testActor=null;
await status({lantikan_id:1,action:'accept'},401);
globalThis.testActor={id:7,role:'Admin'};
await status({lantikan_id:1,action:'accept'},403);
globalThis.testActor={id:7,role:'Pengadil'};
await status({lantikan_id:0,action:'accept'},400);
await status({lantikan_id:'1 OR 1=1',action:'accept'},400);
await status({lantikan_id:1,action:'reject',komen:''},400);
assert.equal(globalThis.testCalls.length,0);

const accepted = await appointmentReply(request({lantikan_id:'12',action:'accept',komen:''}),env);
assert.equal(accepted.status,200);
assert.equal((await accepted.json()).status,'Diterima');
assert.deepEqual(globalThis.testCalls[0].slice(0,5),
  [env,12,'accept','',{kind:'user',value:7}]);
assert.equal(globalThis.testCalls[0][5],7);
globalThis.testOutcome={kind:'not_found'};
await status({lantikan_id:12,action:'accept'},404);
globalThis.testOutcome={kind:'already_answered'};
await status({lantikan_id:12,action:'accept'},409);
globalThis.testOutcome={kind:'expired'};
await status({lantikan_id:12,action:'accept'},400);
console.log('appointment reply: gate, role, input, owner guard and outcomes passed');
