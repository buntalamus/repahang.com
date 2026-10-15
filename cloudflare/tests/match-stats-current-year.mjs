import assert from 'node:assert/strict';
import {bundle,openDatabase,sessionCookie} from './_harness.mjs';

const worker=await bundle(`
  export {refereeMatches} from '../src/referee';
  export {districtOverview} from '../src/role-dashboards';
`);
const {db,DB,close}=openDatabase([]);
const year=Number(new Intl.DateTimeFormat('en',{timeZone:'Asia/Kuala_Lumpur',year:'numeric'}).format(new Date()));
const yearText=String(year);
const priorYear=String(year-1);
const month=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kuala_Lumpur',month:'2-digit'}).format(new Date());
const env={DB,STAGING_AUTH_ENABLED:'1'};
const get=(url,cookie)=>new Request(url,{headers:{Cookie:cookie}});

try {
  const referee=db.prepare(`SELECT u.id,COUNT(*) AS n FROM users u JOIN perlawanan p ON p.user_id=u.id
    WHERE u.role='Pengadil' AND u.aktif=1 GROUP BY u.id HAVING COUNT(*)>=2 ORDER BY n DESC LIMIT 1`).get();
  assert.ok(referee);
  const allTimeRefereeRows=Number(referee.n);
  const refereeRow=db.prepare('SELECT id FROM perlawanan WHERE user_id=? ORDER BY id LIMIT 1').get(referee.id);
  db.prepare("UPDATE perlawanan SET tarikh=?,status_pp='Belum Disahkan' WHERE user_id=?")
    .run(`${priorYear}-06-01`,referee.id);
  db.prepare("UPDATE perlawanan SET tarikh=?,status_pp='Disahkan' WHERE id=?")
    .run(`${yearText}-06-01`,refereeRow.id);

  const refereeCookie=await sessionCookie(db,referee.id);
  const refereeResponse=await worker.refereeMatches(get('https://refpahang.example/api/pengadil-matches.php',refereeCookie),env);
  assert.equal(refereeResponse.status,200);
  const refereeResult=await refereeResponse.json();
  assert.deepEqual({
    total:refereeResult.statistics.total,
    verified:refereeResult.statistics.verified_total,
    currentYear:refereeResult.statistics.current_year,
    allTime:refereeResult.statistics.all_time_total,
    paginatedTotal:refereeResult.pagination.total_items,
  },{total:1,verified:1,currentYear:1,allTime:allTimeRefereeRows,paginatedTotal:allTimeRefereeRows});

  const district=db.prepare(`SELECT pp.id,pp.persatuan_id,d.id AS district_id,
      COUNT(DISTINCT COALESCE(m.match_group_id,'single_'||m.id)) AS n
    FROM users pp
    JOIN persatuan_bolasepak_daerah pb ON pb.id=pp.persatuan_id
    JOIN districts d ON d.nama=pb.daerah
    JOIN perlawanan m JOIN users u ON u.id=m.user_id
    WHERE pp.role='PP Daerah' AND pp.aktif=1 AND (
      (m.match_group_id IS NOT NULL AND m.daerah_perlawanan_id=d.id)
      OR (m.match_group_id IS NULL AND u.persatuan_id=pp.persatuan_id
          AND u.role IN ('Pengadil','PP Daerah')))
    GROUP BY pp.id,pp.persatuan_id,d.id ORDER BY n DESC LIMIT 1`).get();
  assert.ok(district);
  db.prepare(`UPDATE perlawanan SET tarikh=? WHERE substr(tarikh,1,4)=? AND id IN (
      SELECT m.id FROM perlawanan m JOIN users u ON u.id=m.user_id
      WHERE (m.match_group_id IS NOT NULL AND m.daerah_perlawanan_id=?)
        OR (m.match_group_id IS NULL AND u.persatuan_id=? AND u.role IN ('Pengadil','PP Daerah'))
    )`).run(`${priorYear}-06-01`,yearText,district.district_id,district.persatuan_id);
  const districtMatch=db.prepare(`SELECT m.id FROM perlawanan m JOIN users u ON u.id=m.user_id
    WHERE ((m.match_group_id IS NOT NULL AND m.daerah_perlawanan_id=?)
      OR (m.match_group_id IS NULL AND u.persatuan_id=? AND u.role IN ('Pengadil','PP Daerah')))
      AND u.role IN ('Pengadil','PP Daerah') ORDER BY m.id LIMIT 1`)
    .get(district.district_id,district.persatuan_id);
  assert.ok(districtMatch);
  db.prepare("UPDATE perlawanan SET tarikh=?,status_pp='Disahkan' WHERE id=?")
    .run(`${yearText}-${month}-01`,districtMatch.id);

  const ppCookie=await sessionCookie(db,district.id);
  const ppResponse=await worker.districtOverview(get('https://refpahang.example/api/pp-dashboard-overview.php',ppCookie),env);
  assert.equal(ppResponse.status,200);
  const ppResult=await ppResponse.json();
  assert.equal(ppResult.overview.year,year);
  assert.equal(ppResult.overview.total_matches,1);
  assert.equal(ppResult.overview.verified_matches,1);
  assert.equal(ppResult.overview.pending_matches,0);
  assert.equal(ppResult.top_referees[0].total_matches,1);
  console.log('Match statistics: referee and district dashboards count current year while match history pagination retains all years');
} finally {close();}
