import assert from 'node:assert/strict';
import {bundle,openDatabase,sessionCookie} from './_harness.mjs';

// Open/close dates on the Settings page are enforced: a form is open only when
// its switch is on and today (Malaysia time) is within its dates, inclusive.
const {applicationWindow,klToday,submitRefereeApplication,applicationSettings,register,adminSettings}=await bundle(
  "export {applicationWindow,klToday} from '../src/application-window';"
  +" export {submitRefereeApplication} from '../src/application-submit';"
  +" export {applicationSettings} from '../src/applications';"
  +" export {register} from '../src/register';"
  +" export {adminSettings} from '../src/admin-settings';"
);
const {db,DB,close}=openDatabase(['0001_worker_sessions','0011_application_uniqueness']);
const env={DB,STAGING_AUTH_ENABLED:'1',STAGING_WRITES_ENABLED:'1',BASE_URL:'https://staging.refpahang.example'};
const today=klToday();
const shift=(days)=>new Date(Date.parse(`${today}T00:00:00Z`)+days*86400000).toISOString().slice(0,10);
const shown=(date)=>date.split('-').reverse().join('/');
const yesterday=shift(-1), tomorrow=shift(1);
const setting=(key,value)=>db.prepare(`INSERT INTO application_settings(setting_key,setting_value) VALUES(?,?)
  ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value`).run(key,value);
const url='https://staging.refpahang.example/api/';
const refereeCookie=await sessionCookie(db,80);
const admin=db.prepare("SELECT id FROM users WHERE role='Admin' AND aktif=1 LIMIT 1").get();
const adminCookie=await sessionCookie(db,admin.id);

try {
  const state=(settings)=>applicationWindow(settings,'berdaftar',today).state;
  assert.equal(state({berdaftar_open:'0'}),'off');
  assert.equal(state({berdaftar_open:'1'}),'open');
  assert.equal(state({berdaftar_open:'1',berdaftar_open_date:today,berdaftar_close_date:today}),'open');
  assert.equal(state({berdaftar_open:'1',berdaftar_open_date:tomorrow}),'not_yet');
  assert.equal(state({berdaftar_open:'1',berdaftar_close_date:yesterday}),'closed');
  assert.equal(state({berdaftar_open:'1',berdaftar_close_date:'bukan-tarikh'}),'open');
  assert.equal(applicationWindow({},'registration',today,'1').state,'open');

  // The submission refuses outside the dates even with the switch on.
  setting('berdaftar_open','1');
  setting('berdaftar_open_date','2026-01-01');
  setting('berdaftar_close_date',yesterday);
  const submit=async()=>{
    const data=new FormData();data.set('jenis_borang','pengadil_berdaftar');
    return submitRefereeApplication(new Request(url+'pengadil-application.php',{method:'POST',
      headers:{Cookie:refereeCookie},body:data}),env);
  };
  let response=await submit();
  assert.equal(response.status,400);
  assert.equal((await response.json()).message,
    `Permohonan Pendaftaran Tahunan telah ditutup pada ${shown(yesterday)}.`);
  setting('berdaftar_open_date',tomorrow);
  setting('berdaftar_close_date','');
  response=await submit();
  assert.equal((await response.json()).message,
    `Permohonan Pendaftaran Tahunan akan dibuka pada ${shown(tomorrow)}.`);

  // Forms receive the same server-computed state.
  const windows=(await (await applicationSettings(new Request(url+'application-settings.php',
    {headers:{Cookie:refereeCookie}}),env)).json()).windows;
  assert.deepEqual(windows.berdaftar,{state:'not_yet',open_date:tomorrow,close_date:''});

  // Account sign-up closes after its close date.
  setting('registration_open','1');
  setting('registration_close_date',yesterday);
  response=await register(new Request(url+'register.php',{method:'POST',body:new FormData()}),env);
  assert.equal(response.status,403);
  assert.match((await response.json()).message,/Pendaftaran akaun baru telah ditutup pada/);

  // Saving a close date before the open date is refused; unrelated saves still work.
  const save=(body)=>adminSettings(new Request(url+'admin-settings.php',{method:'POST',
    headers:{Cookie:adminCookie,'Content-Type':'application/json'},body:JSON.stringify(body)}),env);
  response=await save({berdaftar_open_date:'2026-12-01',berdaftar_close_date:'2026-04-01'});
  assert.equal(response.status,422);
  assert.match((await response.json()).message,/tarikh tutup \(01\/04\/2026\) tidak boleh sebelum tarikh buka \(01\/12\/2026\)/);
  assert.equal((await save({kelas1_open_date:'31-12-2026'})).status,422);
  setting('bertulis_open_date','2026-12-01');
  setting('bertulis_close_date','2026-04-01');
  assert.equal((await save({maintenance_mode:'0'})).status,200);
  assert.equal((await save({berdaftar_open_date:'2026-12-01',berdaftar_close_date:'2027-01-31'})).status,200);
  console.log('application window: switch and inclusive dates enforced for forms, sign-up and settings');
} finally {
  close();
}
