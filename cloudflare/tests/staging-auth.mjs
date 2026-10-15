import assert from 'node:assert/strict';
import {hash} from 'bcryptjs';
import {bundle,openDatabase,sessionCookie} from './_harness.mjs';

const {login,session,currentUser}=await bundle("export {login,session,currentUser} from '../src/auth';");
const {db,DB,close}=openDatabase(['0001_worker_sessions']);
const email='staging-admin@example.invalid';
const password='staging-test-password';
const oldAdmin=db.prepare("SELECT id,email FROM users WHERE role='Admin' AND aktif=1 LIMIT 1").get();
const testId=Number(db.prepare('SELECT max(id) AS id FROM users').get().id)+1;
db.prepare(`INSERT INTO users(id,email,password,role,nama_penuh,aktif,password_changed)
  VALUES(?,?,?,'Admin','Admin Staging',1,1)`).run(testId,email,await hash(password,10));
const env={DB,STAGING_AUTH_ENABLED:'0',STAGING_LOGIN_EMAILS:email};
const url='https://ujian.refpahang.com/api/login.php';
const request=(mail,pass)=>new Request(url,{method:'POST',body:JSON.stringify({email:mail,password:pass})});

try {
  assert.equal((await login(request(email,password),env)).status,503);
  env.STAGING_AUTH_ENABLED='1';
  assert.equal((await login(request(oldAdmin.email,'anything'),env)).status,401);
  assert.equal(db.prepare('SELECT count(*) AS n FROM worker_login_limits').get().n,0);

  const legacyCookie=await sessionCookie(db,oldAdmin.id);
  const legacyRequest=new Request('https://ujian.refpahang.com/api/session.php',{headers:{Cookie:legacyCookie}});
  assert.equal(await currentUser(legacyRequest,env),null);
  assert.equal((await (await session(legacyRequest,env)).json()).authenticated,false);

  const response=await login(request(email.toUpperCase(),password),env);
  assert.equal(response.status,200);
  const cookie=response.headers.get('Set-Cookie')?.split(';')[0];
  assert.ok(cookie?.startsWith('refpahang_session='));
  assert.match(response.headers.get('Set-Cookie'),/HttpOnly/);
  assert.match(response.headers.get('Set-Cookie'),/Secure/);
  const testRequest=new Request('https://ujian.refpahang.com/api/session.php',{headers:{Cookie:cookie}});
  const state=await (await session(testRequest,env)).json();
  assert.equal(state.authenticated,true);
  assert.equal(state.user_email,email);
  assert.equal(state.user_role,'Admin');

  env.STAGING_LOGIN_EMAILS='nobody@example.invalid';
  assert.equal(await currentUser(testRequest,env),null);
  assert.equal((await login(request(email,password),env)).status,401);
  console.log('Staging auth: only the test Admin can log in; imported sessions are rejected');
} finally {close();}
