// Isolated documentation preview. Reads only an anonymised, disposable DB.
import {createServer} from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync,appendFileSync,existsSync,statSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {build} from '../../cloudflare/node_modules/esbuild/lib/main.js';
const root=resolve(import.meta.dirname,'../..'),tmp=resolve(root,'tmp/manual-peranan');
const users=JSON.parse(readFileSync(resolve(tmp,'users.json')));
const db=new DatabaseSync(resolve(tmp,'contoh.sqlite'),{readOnly:true});
class Statement {
 constructor(sql,args=[]){this.sql=sql;this.args=args;}
 bind(...args){return new Statement(this.sql,args);}
 async first(column){const r=db.prepare(this.sql).get(...this.args)??null;return column?r?.[column]??null:r;}
 async all(){return {results:db.prepare(this.sql).all(...this.args)};}
 async run(){throw new Error('Documentation preview refuses database writes');}
}
const DB={prepare:s=>new Statement(s),batch:async ss=>Promise.all(ss.map(s=>s.all()))};
const maps={
 'admin-telegram-blast.php':['adminTelegramBlastPreview','telegram-blast-preview'],
 'portal-dashboard.php':['portalDashboard','portal-dashboard'],
 'admin-users.php':['adminUsers','admin-users'], 'admin-settings.php':['adminSettings','admin-settings'],
 'admin-profile.php':['adminProfile','admin-dashboard'], 'admin-dashboard-tasks.php':['adminDashboardTasks','admin-dashboard'],
 'admin-dashboard-stats.php':['adminDashboardStats','admin-dashboard'], 'statistics.php':['statistics','statistics'],
 'get-user-profile.php':['userProfile','self-profile'], 'application-settings.php':['applicationSettings','applications'],
 'pengadil-application-history.php':['applicationHistory','applications'], 'admin-applications.php':['adminApplications','applications'],
 'pengadil-matches.php':['refereeMatches','referee'], 'pengadil-application.php':['ownApplications','referee'],
 'pengadil-penilaian.php':['refereeAssessments','assessments'], 'pp-penilaian.php':['districtAssessments','assessments'],
 'pp-applications.php':['districtApplications','district-applications'], 'pp-referees.php':['districtReferees','district-referees'],
 'profil-pengadil.php':['refereeProfile','profile'], 'get-active-referees.php':['activeReferees','referee'],
 'announcements.php':['announcements','notifications'], 'notifications.php':['notifications','notifications'],
 'tugasan.php':['appointments','appointments'], 'penilai-dashboard.php':['assessorDashboard','role-dashboards'],
 'pp-announcements.php':['districtAnnouncements','role-dashboards'], 'pp-dashboard-overview.php':['districtOverview','role-dashboards'],
 'kejohanan.php':['tournaments','tournaments'], 'pool-pengadil.php':['refereePool','referee-pool'],
 'jadual-perlawanan.php':['schedule','schedule'], 'jadual-lantikan-report.php':['scheduleReport','schedule-report'],
 'lantikan.php':['adminAppointments','admin-appointments'], 'lantikan-audit.php':['appointmentAudit','appointment-audit'],
 'laporan-penilaian.php':['assessmentReports','assessment-reports'], 'kejohanan-pengesah-laporan.php':['chairConfig','chair-config'],
 'referees.php':['registeredReferees','registered-referees'], 'admin-matches.php':['adminMatches','admin-matches'],
 'pp-verify-match.php':['districtMatchVerification','district-match-verification'], 'pengadil-luar.php':['externalReferees','external-referees'],
 'admin-test-applications.php':['adminTestApplications','admin-test-applications'], 'pengadil-taraf.php':['refereeGrades','referee-grades'],
 'lantikan-perlu-tindakan.php':['appointmentGaps','appointment-gaps'], 'mobile-usage.php':['mobileUsage','mobile-usage'],
};
const entry=[...new Map(Object.values(maps).map(([name,file])=>[name,`export {${name}} from '${resolve(root,'cloudflare/src',file)}';`])).values()].join('\n');
await build({stdin:{contents:entry,resolveDir:root,loader:'ts'},bundle:true,format:'esm',platform:'node',outfile:resolve(tmp,'backend.mjs'),logLevel:'silent',plugins:[{name:'manual-isolation',setup(b){
 b.onResolve({filter:/(^|\/)auth$/},()=>({path:'auth',namespace:'manual'}));
 b.onLoad({filter:/.*/,namespace:'manual'},()=>({contents:`export const currentUser=async(_r,env)=>env.MANUAL_USER;export const requestTokenHash=async()=>null;export const json=(body,status=200)=>Response.json(body,{status});`,loader:'js'}));
 b.onResolve({filter:/^cloudflare:/},()=>({path:'network',namespace:'blocked'}));
 b.onLoad({filter:/.*/,namespace:'blocked'},()=>({contents:`export function connect(){throw new Error('Network disabled in manual preview');}`,loader:'js'}));
}}]});
const worker=await import(resolve(tmp,'backend.mjs'));
const assets=resolve(root,'frontend/dist/frontend/browser');
const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2','.json':'application/json','.ico':'image/x-icon'};
const setups=[['public',4400],['admin',4401],['pp',4402],['ra',4403],['pengadil',4404],['ra',4413,'form'],['pengadil',4414,'form']];
const json=(r,b,status=200)=>{r.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});r.end(JSON.stringify(b));};
for(const [role,port,scenario] of setups){
 const user=role==='public'?null:users[role];
 const env={DB,MANUAL_USER:user,BASE_URL:`http://127.0.0.1:${port}`,STAGING_AUTH_ENABLED:'1',STAGING_WRITES_ENABLED:'0',APPOINTMENT_DELIVERY_ENABLED:'0',REPORT_DELIVERY_ENABLED:'0',BULK_EMAIL_ENABLED:'0',MAILBOX_SEND_ENABLED:'0',MEDIA:{get:async()=>null,head:async()=>null},MOBILE_LATEST_VERSION:'1.3.0',PUSH_ENABLED:'0'};
 createServer(async(req,res)=>{
  try {
   const url=new URL(req.url,env.BASE_URL),file=url.pathname.slice(5);
   if(url.pathname.startsWith('/api/')){
    if(req.method!=='GET'){
     if(file==='account-activity.php'||file==='support-chat.php')return json(res,{error:false});
     if(file==='login.php'&&role==='public')return json(res,{error:true,code:'ACCOUNT_INACTIVE',message:'Akaun anda ditandakan Tidak Aktif. Anda tidak boleh log masuk.',reason:'Tiada aktiviti atau log masuk sepanjang 8 bulan terakhir.'},403);
     return json(res,{error:true,message:'Pratonton manual: tiada transaksi dihantar.'},405);
    }
    if(file==='session.php')return json(res,user?{authenticated:true,user_id:user.id,user_role:user.role,user_email:user.email,nama_penuh:user.nama_penuh,user_persatuan_id:user.persatuan_id,user_persatuan_name:'Persatuan Daerah Contoh',can_referee:user.can_referee,can_ra:user.can_ra,password_changed:1}:{authenticated:false});
    if(file==='check-maintenance.php')return json(res,{maintenance_mode:false});
    if(file==='registration-status.php')return json(res,{error:false,registration_open:true});
    if(file==='webpush-key.php')return json(res,{error:false,enabled:false});
    if(file==='public-announcements.php')return json(res,{error:false,data:[{id:1,title:'Pengumuman contoh',content:'Semak profil, permohonan dan notifikasi anda.',created_at:'2026-10-20 08:00:00'}]});
    if(file==='public-persatuan.php')return json(res,{error:false,data:db.prepare('SELECT * FROM persatuan_bolasepak_daerah').all()});
    if(file==='districts.php')return json(res,{error:false,data:db.prepare('SELECT * FROM districts').all()});
    if(file==='support-chat.php') {
     if(url.searchParams.get('action')==='summary')return json(res,{error:false,unread_count:1});
     if(url.searchParams.get('action')==='threads')return json(res,{error:false,total:1,data:[{user_id:9001,nama_penuh:'PENGGUNA CONTOH',role:'Pengadil',daerah:'Daerah Contoh',preview:'Bagaimana menyemak permohonan saya?',is_admin:0,unread_count:1,updated_at:'2026-10-20 10:00:00'}]});
     return json(res,{error:false,has_more:false,data:[{id:1,body:'Bagaimana menyemak permohonan saya?',is_admin:0,created_at:'2026-10-20 10:00:00',sender_name:'PENGGUNA CONTOH'},{id:2,body:'Buka menu Permohonan dan semak tahun serta status.',is_admin:1,created_at:'2026-10-20 10:01:00',sender_name:'ADMIN CONTOH'}]});
    }
    if(file==='admin-mail-campaigns.php')return json(res,{error:false,data:url.searchParams.get('view')==='directory'?{year:2026,groups:[{id:'pengadil',label:'Pengadil Berdaftar',name:'Pengadil Berdaftar'}],contacts:[{id:'c1',name:'PENGADIL CONTOH',email:'pengadil@example.invalid',role:'Pengadil',district_id:1,district:'Daerah Contoh',active:true,groups:['pengadil']}],districts:[{id:1,name:'Daerah Contoh'}],invalid:0}:[],total:0});
    if(file==='admin-mailbox.php'){
     if(url.searchParams.get('view')==='contacts')return json(res,{error:false,data:[{id:'c1',name:'KENALAN CONTOH',email:'kenalan@example.invalid'}]});
     return json(res,{error:false,data:[{id:'m1',sender:'pengguna@example.invalid',recipient:'sokongan@pbnppahang.my',subject:'Pertanyaan contoh penggunaan portal',received_at:'2026-10-20 09:00:00',read_at:null,delivery_status:'received'}],total:1,page:1,imap_enabled:true,folders:[],sync:{last_sync_at:'2026-10-20 09:00:00',pending:0,failed:0}});
    }
    if(file==='laporan-penilaian.php'&&scenario==='form'&&role==='ra'&&!url.searchParams.has('officials')&&!url.searchParams.has('id'))return json(res,{error:false,data:[]});
    if(file==='pengadil-application-history.php'&&scenario==='form')return json(res,{error:false,data:[]});
    if(maps[file]){
     const response=await worker[maps[file][0]](new Request(url),env);
     const body=await response.text();
     appendFileSync(resolve(tmp,'requests.jsonl'),JSON.stringify({role,path:url.pathname+url.search,status:response.status})+'\n');
     res.writeHead(response.status,Object.fromEntries(response.headers));res.end(body);return;
    }
    appendFileSync(resolve(tmp,'requests.jsonl'),JSON.stringify({role,path:url.pathname,status:404})+'\n');
    return json(res,{error:false,data:[],total:0});
   }
   if(url.pathname.startsWith('/uploads/')){res.writeHead(404);res.end();return;}
   let target=resolve(assets,'.'+decodeURIComponent(url.pathname));
   if(!target.startsWith(assets+'/')||!existsSync(target)||!statSync(target).isFile())target=resolve(assets,'index.html');
   res.writeHead(200,{'Content-Type':mime[extname(target)]??'application/octet-stream','Cache-Control':'no-store'});res.end(readFileSync(target));
  }catch(e){appendFileSync(resolve(tmp,'errors.log'),`${role} ${req.url}: ${e.stack}\n`);json(res,{error:true,message:'Pratonton contoh tidak dapat dimuatkan.'},500);}
 }).listen(port,'127.0.0.1',()=>console.log('Manual preview',role,scenario??'default',port));
}
