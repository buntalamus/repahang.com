// PHP-vs-Worker parity runner. Each case is sent to the original PHP endpoint
// (php-cgi on a MySQL copy of the snapshot, run from a code copy without .env
// so no real email or Telegram can be sent) and to the Worker (bundled
// src/index.ts on a D1/SQLite copy of the same snapshot). Status codes and
// JSON bodies are compared field by field.
//
//   PARITY_PHP_ROOT=<copy of api,config,includes,vendor> \
//   PARITY_MYSQL_SOCKET=/tmp/claude/rpmy.sock node parity/run.mjs [filter]
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {bundle,openDatabase,sessionCookie} from '../tests/_harness.mjs';
import {cases} from './cases.mjs';

const phpRoot=process.env.PARITY_PHP_ROOT;
const socket=process.env.PARITY_MYSQL_SOCKET;
assert.ok(phpRoot && socket,'PARITY_PHP_ROOT and PARITY_MYSQL_SOCKET are required');
const phpCgi=process.env.PARITY_PHP_CGI ?? '/opt/homebrew/opt/php@8.3/bin/php-cgi';
const sessionDir=join(phpRoot,'..','phpsess');
mkdirSync(sessionDir,{recursive:true});
const filter=process.argv[2] ?? '';

const worker=await bundle(`export {default} from '../src/index';`);
const {db,DB,close}=openDatabase(['0001_worker_sessions','0002_appointment_outbox','0003_assessment_drafts',
  '0004_admin_appointment_create','0005_report_confirmation_outbox','0006_report_submission_outbox',
  '0007_report_admin_override','0008_chair_assignment_queue','0009_mysql_on_update_triggers',
  '0010_worker_write_guards']);
const sent=[];
const env={DB,BASE_URL:'https://refpahang.com',TELEGRAM_BOT_USERNAME:'refpahang_bot',
  STAGING_AUTH_ENABLED:'1',STAGING_WRITES_ENABLED:'1',APPOINTMENT_DELIVERY_ENABLED:'1',REPORT_DELIVERY_ENABLED:'1',
  MAIL_ADMIN_USER:'admin@refpahang.com',MAIL_ADMIN_NAME:'Admin RefPahang',
  MAIL_DAFTAR_USER:'daftar@refpahang.com',MAIL_DAFTAR_NAME:'Pendaftaran Pengadil Pahang',
  MAIL_LANTIKAN_USER:'lantikan@refpahang.com',MAIL_LANTIKAN_NAME:'Lantikan Pengadil Pahang',
  MAIL_SUPPORT_USER:'support@refpahang.com',MAIL_SUPPORT_NAME:'Sokongan Pengadil Pahang',
  MAIL_PENGESAHAN_USER:'pengesahan@refpahang.com',MAIL_PENGESAHAN_NAME:'Pengesahan Perlawanan Pahang',
  EMAIL:{send:async(message)=>{sent.push(message);return {messageId:'parity'};}},
  MEDIA:{get:async()=>null,head:async()=>null},
  ASSETS:{fetch:async()=>new Response('asset',{status:200})}};

/** PHP 'php' session serialisation of the keys login.php sets. */
function phpSession(user) {
  const s=(value)=>value===null||value===undefined ? 'N;'
    : typeof value==='number' ? `i:${value};` : `s:${Buffer.byteLength(String(value))}:"${value}";`;
  return [['user_id',user.id],['user_email',user.email],['user_role',user.role],
    ['user_jenis_pengadil',user.jenis_pengadil],['user_nama',user.nama_penuh],
    ['persatuan_id',user.persatuan_id || user.district_id || null],['user_persatuan_name',user.persatuan_nama],
    ['password_changed',Number(user.password_changed ?? 0)]].map(([key,value])=>`${key}|${s(value)}`).join('');
}

const users={};
async function login(role) {
  if (role===null) return {php:null,worker:null};
  if (users[role]) return users[role];
  const sql={
    Admin:"SELECT u.*,p.nama_persatuan AS persatuan_nama FROM users u LEFT JOIN persatuan_bolasepak_daerah p ON p.id=u.persatuan_id WHERE u.role='Admin' AND u.aktif=1 ORDER BY u.id LIMIT 1",
    'PP Daerah':"SELECT u.*,p.nama_persatuan AS persatuan_nama FROM users u LEFT JOIN persatuan_bolasepak_daerah p ON p.id=u.persatuan_id WHERE u.role='PP Daerah' AND u.aktif=1 AND (SELECT count(*) FROM users r WHERE r.persatuan_id=u.persatuan_id)>5 ORDER BY u.id LIMIT 1",
    Pengadil:"SELECT u.*,p.nama_persatuan AS persatuan_nama FROM users u LEFT JOIN persatuan_bolasepak_daerah p ON p.id=u.persatuan_id WHERE u.role='Pengadil' AND u.aktif=1 ORDER BY (SELECT count(*) FROM lantikan_pengadil l WHERE l.pengadil_id=u.id) DESC LIMIT 1",
    Penilai:"SELECT u.*,p.nama_persatuan AS persatuan_nama FROM users u LEFT JOIN persatuan_bolasepak_daerah p ON p.id=u.persatuan_id WHERE u.role='Penilai' AND u.aktif=1 ORDER BY (SELECT count(*) FROM laporan_penilaian r WHERE r.penilai_id=u.id) DESC LIMIT 1",
  }[role];
  const user=db.prepare(sql).get();
  assert.ok(user,`no ${role} user`);
  const sid=`parity${role.replace(/\W/g,'')}${user.id}`;
  writeFileSync(join(sessionDir,`sess_${sid}`),phpSession(user));
  users[role]={id:user.id,php:`PHPSESSID=${sid}`,worker:await sessionCookie(db,user.id)};
  return users[role];
}

function callPhp(test,cookie) {
  const [path,query='']=test.path.split('?');
  const body=test.body===undefined ? '' : JSON.stringify(test.body);
  const result=spawnSync(phpCgi,['-d','opcache.enable=0','-d','variables_order=EGPCS',
    '-d',`pdo_mysql.default_socket=${socket}`,'-d',`session.save_path=${sessionDir}`,
    '-d','display_errors=0','-d',`error_log=${join(sessionDir,'php-error.log')}`],{
    input:body,maxBuffer:64*1024*1024,
    env:{PATH:'/usr/bin:/bin',DB_HOST:'localhost',DB_USER:'root',DB_PASS:'',DB_NAME:'refpahang',
      BASE_URL:'https://refpahang.com',APP_DEBUG:'false',TELEGRAM_BOT_TOKEN:'your_bot_token_here',
      TELEGRAM_BOT_USERNAME:'refpahang_bot',SMTP_HOST:'invalid.invalid',SMTP_PORT:'465',
      REQUEST_METHOD:test.method ?? 'GET',QUERY_STRING:query,REQUEST_URI:test.path,
      SCRIPT_FILENAME:join(phpRoot,path.replace(/^\//,'')),SCRIPT_NAME:path,REDIRECT_STATUS:'200',
      CONTENT_TYPE:body ? 'application/json' : '',CONTENT_LENGTH:String(Buffer.byteLength(body)),
      HTTP_HOST:'refpahang.com',HTTPS:'on',REMOTE_ADDR:'203.0.113.9',
      ...(cookie ? {HTTP_COOKIE:cookie} : {})},
  });
  const output=result.stdout;
  const split=output.indexOf('\r\n\r\n');
  const head=output.subarray(0,split).toString();
  const status=Number(/^Status: (\d+)/m.exec(head)?.[1] ?? 200);
  const type=/^Content-Type: (.*)$/mi.exec(head)?.[1]?.trim() ?? '';
  return {status,type,text:output.subarray(split+4).toString()};
}

async function callWorker(test,cookie) {
  const response=await worker.default.fetch(new Request(`https://refpahang.com${test.path}`,{
    method:test.method ?? 'GET',
    headers:{...(cookie ? {Cookie:cookie} : {}),...(test.body!==undefined ? {'Content-Type':'application/json'} : {})},
    body:test.body===undefined ? undefined : JSON.stringify(test.body)}),env);
  return {status:response.status,type:response.headers.get('Content-Type') ?? '',text:await response.text()};
}

function diff(php,wk,path='$',out=[]) {
  if (out.length>=25) return out;
  if (php===wk) return out;
  if (typeof php!==typeof wk || php===null || wk===null || typeof php!=='object') {
    out.push(`${path}: php=${JSON.stringify(php)?.slice(0,80)} worker=${JSON.stringify(wk)?.slice(0,80)}`);
    return out;
  }
  if (Array.isArray(php)!==Array.isArray(wk)) {
    out.push(`${path}: php is ${Array.isArray(php)?'array':'object'}, worker is ${Array.isArray(wk)?'array':'object'}`);
    return out;
  }
  if (Array.isArray(php) && php.length!==wk.length) out.push(`${path}: length php=${php.length} worker=${wk.length}`);
  const keys=new Set([...Object.keys(php),...Object.keys(wk)]);
  for (const key of keys) {
    if (!(key in wk)) {out.push(`${path}.${key}: missing in worker`);continue;}
    if (!(key in php)) {out.push(`${path}.${key}: extra in worker`);continue;}
    diff(php[key],wk[key],`${path}.${key}`,out);
  }
  return out;
}

const report=[];
try {
  for (const test of cases) {
    if (filter && !test.name.includes(filter)) continue;
    const who=await login(test.role || null);
    const php=callPhp(test,who.php);
    const wk=await callWorker(test,who.worker);
    const problems=[];
    if (php.status!==wk.status) problems.push(`status php=${php.status} worker=${wk.status}`);
    let pj=null; let wj=null;
    try {pj=JSON.parse(php.text);} catch {}
    try {wj=JSON.parse(wk.text);} catch {}
    if (pj!==null || wj!==null) {
      if (pj===null) problems.push(`php not JSON: ${php.text.slice(0,120)}`);
      else if (wj===null) problems.push(`worker not JSON: ${wk.text.slice(0,120)}`);
      else problems.push(...diff(pj,wj));
    } else if (php.type.split(';')[0]!==wk.type.split(';')[0]) {
      problems.push(`content-type php=${php.type} worker=${wk.type}`);
    }
    report.push({name:test.name,ok:problems.length===0,problems});
    console.log(`${problems.length===0?'OK  ':'DIFF'} ${test.name}`);
    for (const problem of problems.slice(0,12)) console.log(`       ${problem}`);
  }
} finally {close();}
const failed=report.filter((entry)=>!entry.ok).length;
console.log(`\n${report.length-failed}/${report.length} identical`);
writeFileSync(join(phpRoot,'..','parity-report.json'),JSON.stringify(report,null,2));
