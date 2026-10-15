import assert from 'node:assert/strict';
import {bundle} from './_harness.mjs';

const {sendRefpahangEmail}=await bundle("export {sendRefpahangEmail} from '../mail';");
const sent=[];
const env={MAIL_LANTIKAN_USER:'lantikan@refpahang.com',MAIL_LANTIKAN_NAME:'Lantikan Pengadil Pahang',
  EMAIL:{send:async message=>{sent.push(message);return {messageId:'ok'};}}};

await sendRefpahangEmail(env,'lantikan','pengadil@example.test','Pengadil','Lantikan','<p>x</p>','x');
assert.deepEqual(sent[0].to,{email:'pengadil@example.test',name:'Pengadil'});
assert.equal(sent[0].subject,'Lantikan');

await sendRefpahangEmail(env,'lantikan','tanpa-nama@example.test','','Lantikan','<p>x</p>','x');
assert.equal(sent[1].to,'tanpa-nama@example.test');

env.STAGING_EMAIL_REDIRECT=' qa@example.test ';
await sendRefpahangEmail(env,'lantikan','pengadil@example.test','Pengadil','Lantikan','<p>x</p>','x');
assert.equal(sent[2].to,'qa@example.test');
assert.equal(sent[2].subject,'[UJIAN → pengadil@example.test] Lantikan');
assert.equal(sent[2].from.email,'lantikan@refpahang.com');
console.log('Staging email redirect passed');
