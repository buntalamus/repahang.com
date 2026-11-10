import assert from 'node:assert/strict';
import {bundle,openDatabase,sessionCookie} from './_harness.mjs';
const w=await bundle(`
 export {announcements,notifications} from '../src/notifications';
 export {announcementRead} from '../src/announcement-read';
 export {announcementsWrite} from '../src/announcements-write';
 export {pushMessageFor} from '../src/push';
 export {webPushUrl} from '../src/webpush';
 export {setTelegramSenderForTests} from '../src/php/telegram';`);
const {db,DB,close}=openDatabase([]);
w.setTelegramSenderForTests(async()=>true);
const env={DB,STAGING_AUTH_ENABLED:'1',STAGING_WRITES_ENABLED:'1',BASE_URL:'https://refpahang.example'};
const one=(sql,...args)=>db.prepare(sql).get(...args);
const admin=one("SELECT id FROM users WHERE aktif=1 AND role='Admin' LIMIT 1").id;
const ref=one("SELECT id FROM users WHERE aktif=1 AND role='Pengadil' LIMIT 1").id;
const cookies={admin:await sessionCookie(db,admin),ref:await sessionCookie(db,ref)};
const req=(path,who='ref',body)=>new Request('https://refpahang.example/api/'+path,{
 method:body===undefined?'GET':'POST',headers:{Cookie:cookies[who]??'', 'Content-Type':'application/json'},
 ...(body===undefined?{}:{body:JSON.stringify(body)}),
});
try {
 assert.equal((await w.announcements(req('announcements.php','none'),env)).status,401);
 assert.equal((await w.announcementsWrite(req('announcements.php','ref',{title:'No',content:'No'}),env)).status,403);
 const noticesBefore=one('SELECT count(*) n FROM notifications').n;
 const created=await (await w.announcementsWrite(req('announcements.php','admin',{title:'Makluman ujian',content:'Baris satu\nBaris dua'}),env)).json();
 const id=Number(created.id);
 const active=one('SELECT count(*) n FROM users WHERE aktif=1').n;
 assert.equal(one('SELECT count(*) n FROM notifications').n-noticesBefore,active);
 assert.equal(one('SELECT count(DISTINCT user_id) n FROM notifications WHERE announcement_id=?',id).n,active);
 assert.equal(one('SELECT count(*) n FROM notifications n JOIN users u ON u.id=n.user_id WHERE n.announcement_id=? AND u.aktif<>1',id).n,0);
 const list=await (await w.announcements(req('announcements.php'),env)).json();
 assert.equal(list.announcements[0].id,id);
 assert.equal(list.announcements[0].is_read,0);
 const detail=await (await w.announcements(req(`announcements.php?id=${id}`),env)).json();
 assert.equal(detail.announcement.content,'Baris satu\nBaris dua');
 assert.equal(one('SELECT count(*) n FROM worker_announcement_reads').n,0,'GET does not mark read');
 for(const bad of [0,-1,'bad','1x']) assert.equal((await w.announcementRead(req('announcement-read.php','ref',{announcement_id:bad}),env)).status,400);
 assert.equal((await w.announcementRead(req('announcement-read.php','none',{announcement_id:id}),env)).status,401);
 assert.equal((await w.announcementRead(req('announcement-read.php','ref',{announcement_id:999999}),env)).status,404);
 for(let i=0;i<2;i++) assert.equal((await w.announcementRead(req('announcement-read.php','ref',{announcement_id:id,user_id:admin}),env)).status,200);
 assert.equal(one('SELECT count(*) n FROM worker_announcement_reads WHERE announcement_id=?',id).n,1);
 assert.equal((await (await w.announcements(req(`announcements.php?id=${id}`),env)).json()).announcement.is_read,1);
 assert.equal((await (await w.announcements(req(`announcements.php?id=${id}`,'admin'),env)).json()).announcement.is_read,0);
 assert.equal(one('SELECT is_read FROM notifications WHERE user_id=? AND announcement_id=?',ref,id).is_read,1);
 assert.equal(one('SELECT is_read FROM notifications WHERE user_id=? AND announcement_id=?',admin,id).is_read,0);
 const notice=one('SELECT * FROM notifications WHERE user_id=? AND announcement_id=?',ref,id);
 assert.equal(w.pushMessageFor(notice).data.screen,`pengumuman:${id}`);
 assert.equal(w.webPushUrl('Pengadil',`pengumuman:${id}`),`/app/?screen=pengumuman%3A${id}`);
 const notificationList=await (await w.notifications(req('notifications.php'),env)).json();
 assert.ok(notificationList.notifications.some(n=>n.announcement_id===id));
 const edit=new Request(`https://refpahang.example/api/announcements.php?id=${id}`,{
 method:'PUT',headers:{Cookie:cookies.admin,'Content-Type':'application/json'},body:JSON.stringify({title:'Dikemaskini',content:'Teks terkini'})});
 assert.equal((await w.announcementsWrite(edit,env)).status,200);
 assert.equal(one('SELECT count(*) n FROM notifications WHERE announcement_id=?',id).n,active,'edit does not rebroadcast');
 // A failed notice insert rolls back publication too.
 db.exec("CREATE TRIGGER fail_announcement_notice BEFORE INSERT ON notifications WHEN NEW.type='Pengumuman' BEGIN SELECT RAISE(ABORT,'test failure'); END");
 const count=one('SELECT count(*) n FROM announcements').n;
 await assert.rejects(w.announcementsWrite(req('announcements.php','admin',{title:'Rollback',content:'test'}),env));
 assert.equal(one('SELECT count(*) n FROM announcements').n,count);
 db.exec('DROP TRIGGER fail_announcement_notice');
 assert.equal((await w.announcementsWrite(new Request(`https://refpahang.example/api/announcements.php?id=${id}`,{method:'DELETE',headers:{Cookie:cookies.admin}}),env)).status,200);
 assert.equal((await w.announcements(req(`announcements.php?id=${id}`),env)).status,404);
 console.log('Mobile announcements: atomic publication, active audience, read isolation/idempotence, deep links, edits and deleted content passed');
} finally { close(); }
