import assert from 'node:assert/strict';
import {bundle} from './_harness.mjs';

const {worker}=await bundle("export {default as worker} from '../src/index';");
const logs=[];
const originalError=console.error;
const originalWarn=console.warn;
console.error=(...args)=>logs.push(args);
console.warn=(...args)=>logs.push(args);
try {
  const env={STAGING_AUTH_ENABLED:'1',DB:{prepare(){throw new Error('SQLITE_ERROR: private database detail');}}};
  const context={waitUntil(){}};
  const response=await worker.fetch(new Request('https://refpahang.com/api/__migration-health'),env,context);
  assert.equal(response.status,500);
  const body=await response.json();
  assert.equal(body.code,'INTERNAL_ERROR');
  assert.match(body.request_id,/^[0-9a-f-]{36}$/);
  assert.equal(response.headers.get('X-Request-ID'),body.request_id);
  assert.match(body.next_action,/semak rekod/);
  assert.doesNotMatch(JSON.stringify(body),/SQLITE|private database/);
  assert.equal(logs[0][1].request_id,body.request_id);
  assert.equal(logs[0][1].path,'/api/__migration-health');
  const denied=await worker.fetch(new Request('https://refpahang.com/api/admin-approve.php',{method:'POST',body:'{}'}),env,context);
  assert.equal(denied.status,401);
  assert.match(denied.headers.get('X-Request-ID'),/^[0-9a-f-]{36}$/);
  assert.equal(logs.at(-1)[1].request_id,denied.headers.get('X-Request-ID'));
} finally {console.error=originalError;console.warn=originalWarn;}
console.log('PASS: unexpected server errors and rejected API requests expose a reference linked to server logs, without returning internal exceptions.');
