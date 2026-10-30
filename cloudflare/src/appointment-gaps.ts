/**
 * Upcoming matches (next 14 days, not cancelled/postponed, not started) whose
 * required officials are incomplete — never appointed, declined or expired.
 * Read-only list for the app's "Perlu tindakan" view; Admin sees every
 * tournament, PP Daerah only their district's.
 */
import { appointmentManager, districtOf } from './appointment-access';
import { currentUser, json } from './auth';
import type { Env } from './types';

const ACTIVE = "('Belum Jawab','Diterima')";
const slot = (jawatan: string, alias: string) => `(SELECT COUNT(*) FROM lantikan_pengadil lp
  WHERE lp.jadual_id=jp.id AND lp.jawatan='${jawatan}' AND lp.status IN ${ACTIVE}) AS ${alias}`;

/** Incomplete upcoming matches within [days]; [district] null means every tournament. */
export async function listAppointmentGaps(env: Env, district: number | null, days = 14): Promise<Record<string, unknown>[]> {
  return (await env.DB.prepare(`SELECT * FROM (
      SELECT jp.id,jp.kejohanan_id,k.nama AS nama_kejohanan,jp.no_perlawanan,jp.tarikh,jp.masa,jp.hari,
        jp.kumpulan_tahap,jp.kategori,jp.pasukan_home,jp.pasukan_away,jp.tempat,jp.status,
        ${slot('Pengadil', 'ada_pengadil')},
        ${slot('Penolong Pengadil 1', 'ada_pp1')},
        ${slot('Penolong Pengadil 2', 'ada_pp2')},
        (SELECT COUNT(*) FROM lantikan_pengadil lp WHERE lp.jadual_id=jp.id AND lp.status='Ditolak') AS jumlah_ditolak,
        (SELECT COUNT(*) FROM lantikan_pengadil lp WHERE lp.jadual_id=jp.id AND lp.status='Belum Jawab') AS jumlah_belum_jawab
      FROM jadual_perlawanan jp JOIN kejohanan k ON k.id=jp.kejohanan_id
      WHERE COALESCE(jp.status,'') NOT IN ('Dibatalkan','Ditangguhkan')
        AND COALESCE(k.status,'') <> 'Selesai'
        AND date(jp.tarikh) BETWEEN date('now','+8 hours') AND date('now','+8 hours','+${Math.max(1, Math.floor(days))} days')
        AND datetime(date(jp.tarikh)||' '||substr(COALESCE(NULLIF(jp.masa,''),'23:59'),1,5)) > datetime('now','+8 hours')
        ${district === null ? '' : 'AND k.lantikan_persatuan_id=?'}
    ) WHERE ada_pengadil=0 OR ada_pp1=0 OR ada_pp2=0
    ORDER BY date(tarikh),masa,id LIMIT 100`)
    .bind(...(district === null ? [] : [district])).all<Record<string, unknown>>()).results;
}

export async function appointmentGaps(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return json({ error: true, message: 'Kaedah tidak dibenarkan.' }, 405);
  const user = await currentUser(request, env);
  if (!user) return json({ error: true, message: 'Sesi tidak sah. Sila log masuk semula.' }, 401);
  if (!appointmentManager(user)) return json({ error: true, message: 'Akses ditolak.' }, 403);
  const district = user.role === 'Admin' ? null : districtOf(user);
  const rows = await listAppointmentGaps(env, district);
  return json({
    error: false,
    data: rows.map((row) => ({
      ...row,
      slot_kosong: [
        ...(Number(row.ada_pengadil) ? [] : ['Pengadil']),
        ...(Number(row.ada_pp1) ? [] : ['Penolong Pengadil 1']),
        ...(Number(row.ada_pp2) ? [] : ['Penolong Pengadil 2']),
      ],
    })),
  });
}
