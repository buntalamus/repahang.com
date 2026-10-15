import { currentUser, json } from './auth';
import { appointmentWritesEnabled } from './lantikan-write';
import { auditMetaFrom } from './php/lantikan-audit';
import { autoTolakLantikanTertunggak } from './php/lantikan-helper';
import { boundedJson } from './request';
import type { Env } from './types';
import { wroteRow } from './d1-changes';

const positions = ['Pengadil', 'Penolong Pengadil 1', 'Penolong Pengadil 2', 'Pegawai ke4', 'Penilai Pengadil'];
const autoRejectComment = 'Ditolak automatik - tiada jawapan dalam tempoh';

function positiveId(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  if (!/^[1-9]\d*$/.test(String(value))) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : null;
}

function started(date: string, time: string): boolean {
  const timestamp = Date.parse(`${date}T${time.slice(0, 8).padEnd(8, ':00')}+08:00`);
  return Number.isFinite(timestamp) && Date.now() >= timestamp;
}

const incompleteMatch = `
  SELECT jp.no_perlawanan FROM jadual_perlawanan jp
  LEFT JOIN lantikan_pengadil lp ON lp.jadual_id=jp.id AND lp.status IN ('Belum Jawab','Diterima')
  WHERE jp.kejohanan_id=? AND jp.status NOT IN ('Dibatalkan','Ditangguhkan')
  GROUP BY jp.id
  HAVING jp.status NOT IN ('Disahkan','Selesai')
    OR COUNT(DISTINCT lp.jawatan)<3 OR COUNT(DISTINCT lp.jawatan)>5
    OR SUM(CASE WHEN lp.jawatan='Pengadil' THEN 1 ELSE 0 END)=0
    OR SUM(CASE WHEN lp.jawatan='Penolong Pengadil 1' THEN 1 ELSE 0 END)=0
    OR SUM(CASE WHEN lp.jawatan='Penolong Pengadil 2' THEN 1 ELSE 0 END)=0
    OR SUM(CASE WHEN lp.status='Belum Jawab' AND lp.notif_hantar=0 THEN 1 ELSE 0 END)>0
`;

export async function scheduleReport(request: Request, env: Env): Promise<Response> {
  if (!['GET', 'POST'].includes(request.method)) {
    return json({ error: true, message: 'Kaedah tidak dibenarkan.' }, 405);
  }
  const user = await currentUser(request, env);
  if (!user) return json({ error: true, message: 'Sesi tidak sah. Sila log masuk semula.' }, 401);
  if (user.role !== 'Admin') return json({ error: true, message: 'Akses ditolak.' }, 403);
  if (request.method === 'GET') {
    const tournamentId = positiveId(new URL(request.url).searchParams.get('kejohanan_id'));
    if (!tournamentId) return json({ error: true, message: 'kejohanan_id diperlukan.' }, 400);
    // Like PHP, viewing the report expires overdue answers first.
    if (appointmentWritesEnabled(env)) {
      await autoTolakLantikanTertunggak(env, { kejohanan_id: tournamentId }, auditMetaFrom(request));
    }
    const tournament = await env.DB.prepare(`SELECT id,nama,tarikh_mula,tarikh_akhir,tempat,anjuran,
      logo_kiri,logo_kanan,status,COALESCE(peringkat_kejohanan,'Daerah') AS peringkat_kejohanan
      FROM kejohanan WHERE id=?`).bind(tournamentId).first<Record<string, unknown>>();
    if (!tournament) return json({ error: true, message: 'Kejohanan tidak dijumpai.' }, 404);
    const confirmation = await env.DB.prepare('SELECT * FROM jadual_lantikan_pengesahan WHERE kejohanan_id=?')
      .bind(tournamentId).first<Record<string, unknown>>();
    if (confirmation) {
      const source = `${confirmation.kejohanan_id}|${confirmation.tarikh_sahkan}|RFPHG2025`;
      const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source));
      confirmation.kod_verifikasi = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0'))
        .join('').slice(0, 12).toUpperCase();
    }
    const schedules = await env.DB.prepare(`SELECT id,no_perlawanan,tarikh,hari,masa,kategori,peringkat,kumpulan,
      pasukan_home,pasukan_away,tempat,status FROM jadual_perlawanan WHERE kejohanan_id=?
      ORDER BY kategori,tarikh,masa,CAST(SUBSTR(no_perlawanan,INSTR(no_perlawanan,'-')+1) AS INTEGER),no_perlawanan`)
      .bind(tournamentId).all<Record<string, unknown>>();
    const assigned = await env.DB.prepare(`SELECT lp.jadual_id,lp.jawatan,lp.status AS status_lantikan,
      lp.pengadil_id,COALESCE(u.nama_penuh,pl.nama) AS nama_penuh,
      COALESCE(u.jenis_pengadil,pl.jenis_pengadil) AS jenis_pengadil,
      COALESCE(u.daerah,pl.daerah) AS daerah,COALESCE(u.negeri,pl.negeri) AS negeri,
      COALESCE(u.no_telefon,pl.no_tel) AS no_telefon,
      CASE WHEN lp.pengadil_id IS NOT NULL THEN 'Berdaftar' ELSE 'Luar' END AS jenis_sumber,
      lp.notif_hantar,CASE WHEN lp.komen=? THEN 1 ELSE 0 END AS is_auto_tolak
      FROM lantikan_pengadil lp LEFT JOIN users u ON u.id=lp.pengadil_id
      LEFT JOIN pengadil_luar pl ON pl.id=lp.pengadil_luar_id
      JOIN jadual_perlawanan jp ON jp.id=lp.jadual_id WHERE jp.kejohanan_id=?`)
      .bind(autoRejectComment, tournamentId).all<Record<string, unknown>>();
    const regionLabel = tournament.peringkat_kejohanan === 'Negeri' ? 'Daerah' : 'Negeri';
    const bySchedule = new Map<number, Record<string, unknown>>();
    let totalAppointments = 0;
    let accepted = 0;
    for (const row of assigned.results) {
      row.wilayah = (regionLabel === 'Daerah' ? row.daerah : row.negeri) || '-';
      const id = Number(row.jadual_id);
      const group = bySchedule.get(id) ?? {};
      group[String(row.jawatan)] = row;
      bySchedule.set(id, group);
      if (row.status_lantikan === 'Belum Jawab' || row.status_lantikan === 'Diterima') totalAppointments++;
      if (row.status_lantikan === 'Diterima') accepted++;
    }
    let complete = 0;
    let partial = 0;
    let empty = 0;
    const schedule = schedules.results.map((row) => {
      const group = bySchedule.get(Number(row.id)) ?? {};
      const assignments: Record<string, unknown> = {};
      const active = new Set<string>();
      let count = 0;
      for (const position of positions) {
        const item = group[position] as Record<string, unknown> | undefined;
        assignments[position] = item ?? null;
        if (item && (item.status_lantikan === 'Belum Jawab' || item.status_lantikan === 'Diterima')) {
          count++;
          active.add(position);
        }
      }
      const isComplete = count >= 3 && count <= 5
        && ['Pengadil', 'Penolong Pengadil 1', 'Penolong Pengadil 2'].every((position) => active.has(position));
      if (isComplete) complete++;
      else if (count === 0) empty++;
      else partial++;
      return { ...row, is_started: started(String(row.tarikh), String(row.masa)),
        assignments, jumlah_lantikan: count, is_lengkap: isComplete };
    });
    return json({ error: false, kejohanan: tournament, region_label: regionLabel,
      pengesahan: confirmation, jadual: schedule,
      stats: { total_perlawanan: schedule.length, lantikan_lengkap: complete,
        lantikan_separa: partial, tiada_lantikan: empty,
        jumlah_lantikan: totalAppointments, jumlah_terima: accepted,
        kadar_terima: totalAppointments ? Math.round(accepted / totalAppointments * 100) : 0 } });
  }
  if (env.STAGING_WRITES_ENABLED !== '1') {
    return json({ error: true, message: 'Tindakan tulis belum tersedia di staging.' }, 503);
  }
  const body = await boundedJson(request, 4096);
  if (body instanceof Response) return body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return json({ error: true, message: 'Data tidak sah.' }, 400);
  }
  const input = body as Record<string, unknown>;
  const tournamentId = positiveId(input.kejohanan_id);
  if (!tournamentId) return json({ error: true, message: 'kejohanan_id diperlukan.' }, 400);
  if (input.action === 'batal') {
    await env.DB.prepare('DELETE FROM jadual_lantikan_pengesahan WHERE kejohanan_id=?').bind(tournamentId).run();
    return json({ error: false, message: 'Pengesahan dibatalkan.' });
  }
  if (input.action !== 'sahkan') return json({ error: true, message: 'Tindakan tidak dikenali.' }, 400);
  for (const key of ['nama_penyahkan', 'jawatan_penyahkan', 'nota']) {
    if (input[key] != null && typeof input[key] !== 'string') {
      return json({ error: true, message: 'Data tidak sah.' }, 400);
    }
  }
  const name = String(input.nama_penyahkan ?? '').trim();
  const title = String(input.jawatan_penyahkan ?? '').trim();
  const note = String(input.nota ?? '').trim();
  if (!name || !title || name.length > 255 || title.length > 255) {
    return json({ error: true, message: 'Nama dan jawatan penyahkan diperlukan.' }, 400);
  }
  if (note.length > 500) return json({ error: true, message: 'Nota terlalu panjang (maks 500 aksara).' }, 400);
  const tournament = await env.DB.prepare('SELECT 1 FROM kejohanan WHERE id=?').bind(tournamentId).first();
  if (!tournament) return json({ error: true, message: 'Kejohanan tidak dijumpai.' }, 404);
  const incomplete = await env.DB.prepare(`${incompleteMatch} LIMIT 10`).bind(tournamentId).all<{ no_perlawanan: string }>();
  if (incomplete.results.length) {
    return json({ error: true, message: `Jadual belum boleh disahkan. Lengkapkan dan hantar lantikan minimum Pengadil, AR1 dan AR2 bagi: ${incomplete.results.map((row) => row.no_perlawanan).join(', ')}.` }, 409);
  }
  const result = await env.DB.prepare(`INSERT INTO jadual_lantikan_pengesahan
    (kejohanan_id,nama_penyahkan,jawatan_penyahkan,nota,tarikh_sahkan,created_by)
    SELECT ?,?,?,?,datetime('now','+8 hours'),? WHERE NOT EXISTS(${incompleteMatch})
    ON CONFLICT(kejohanan_id) DO UPDATE SET
      nama_penyahkan=excluded.nama_penyahkan,jawatan_penyahkan=excluded.jawatan_penyahkan,
      nota=excluded.nota,tarikh_sahkan=excluded.tarikh_sahkan,created_by=excluded.created_by`)
    .bind(tournamentId, name, title, note, user.id, tournamentId).run();
  if (!wroteRow(result)) {
    return json({ error: true, message: 'Jadual berubah semasa pengesahan. Sila semak semula.' }, 409);
  }
  return json({ error: false, message: 'Jadual lantikan berjaya disahkan.' });
}
