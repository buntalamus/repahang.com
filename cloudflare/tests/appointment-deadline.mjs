import assert from 'node:assert/strict';
import {bundle} from './_harness.mjs';

// The answer deadline in emails and Telegram: the window after notification,
// or kick-off when the match starts first (without an auto-reject warning).
const {appointmentDeadline}=await bundle("export {appointmentDeadline} from '../src/php/email';");
const kl=(ms)=>new Date(ms+8*3600000).toISOString();
const at=(ms)=>({tarikh:kl(ms).slice(0,10),masa:kl(ms).slice(11,19)});
const now=Date.UTC(2026,9,16,2,0,0); // 16 Oct 2026, 10:00 KL

let match=at(now+10*86400000);
let result=appointmentDeadline('Liga',match.tarikh,match.masa,now);
assert.equal(result.label,'Peraturan Auto-Tolak');
assert.equal(result.sentence,'sebelum 24 Oct 2026, 10:00 (48 jam sebelum perlawanan bermula)');
assert.match(result.rule,/DITOLAK secara automatik/);

match=at(now+2*3600000);
result=appointmentDeadline('Liga',match.tarikh,match.masa,now);
assert.equal(result.label,'Tempoh Menjawab');
assert.equal(result.sentence,'sebelum perlawanan bermula (16 Oct 2026, 12:00)');
assert.doesNotMatch(result.rule,/DITOLAK/);

match=at(now+3600000);
assert.equal(appointmentDeadline('Karnival',match.tarikh,match.masa,now).label,'Tempoh Menjawab');
match=at(now+5*3600000);
assert.equal(appointmentDeadline('Karnival',match.tarikh,match.masa,now).sentence,
  'sebelum 16 Oct 2026, 12:00 (3 jam sebelum perlawanan bermula)');
console.log('appointment deadline: answer window, or kick-off when the match starts first');

const {responseDeadline}=await bundle("export {responseDeadline} from '../../shared/appointment-deadline';");
assert.equal(responseDeadline('Liga',now+72*3600000,now).at,now+24*3600000);
assert.equal(responseDeadline('Karnival',now+6*3600000,now).at,now+3*3600000);
assert.deepEqual(responseDeadline('Karnival',now+2*3600000,now),{at:now+2*3600000,hours:3,autoReject:false});
assert.equal(responseDeadline('Liga',NaN,now),null);
