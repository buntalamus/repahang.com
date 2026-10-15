import assert from 'node:assert/strict';
import {bundle} from './_harness.mjs';

const {qaWriteAllowed}=await bundle("export {qaWriteAllowed} from '../src/index';");
const env={STAGING_QA_WRITE_TOKEN:'private-qa-token'};
const request=(method,path,token)=>new Request(`https://ujian.refpahang.com${path}`,{
  method,headers:token?{'X-Refpahang-QA-Write-Token':token}:undefined,
});

assert.equal(qaWriteAllowed(request('GET','/api/admin-applications.php'),env),true);
assert.equal(qaWriteAllowed(request('POST','/api/login.php'),env),true);
assert.equal(qaWriteAllowed(request('POST','/api/logout.php'),env),true);
assert.equal(qaWriteAllowed(request('POST','/api/admin-applications.php'),env),false);
assert.equal(qaWriteAllowed(request('PUT','/api/laporan-penilaian.php','wrong'),env),false);
assert.equal(qaWriteAllowed(request('POST','/api/admin-applications.php','private-qa-token'),env),true);
assert.equal(qaWriteAllowed(request('POST','/api/admin-applications.php'),{}),true);
console.log('Staging QA write guard passed');
