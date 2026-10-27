import { currentUser, json } from './auth';
import { publishedAppointmentSql } from './appointment-publication';
import { appointmentWritesEnabled } from './lantikan-write';
import { auditMetaFrom } from './php/lantikan-audit';
import { autoTolakLantikanTertunggak } from './php/lantikan-helper';
import type { Env } from './types';

interface Appointment {
  id: number;
  jadual_id: number;
  status: string;
  [key: string]: unknown;
}

interface CrewMember {
  jadual_id: number;
  id: number;
  jawatan: string;
  status: string;
  nama: string;
  no_telefon: string;
  wilayah: string;
  wilayah_label: string;
}

/** Assignment view (api/tugasan.php). */
export async function appointments(request: Request, env: Env): Promise<Response> {
  const user = await currentUser(request, env);
  if (!user) return json({ error: true, message: 'Sesi tidak sah. Sila log masuk semula.' }, 401);
  const allowed = ['Pengadil', 'Penilai', 'PP Daerah'].includes(user.role)
    || (user.role === 'Admin' && user.jenis_pengadil === 'Penilai Pengadil');
  if (!allowed) return json({ error: true, message: 'Akses ditolak.' }, 403);
  // Like PHP, viewing the list expires the caller's overdue answers.
  if (appointmentWritesEnabled(env)) {
    await autoTolakLantikanTertunggak(env, { pengadil_id: user.id }, auditMetaFrom(request));
  }

  const [assigned, crew] = await Promise.all([
    env.DB.prepare(`
      SELECT lp.id, lp.jawatan, lp.status, lp.komen, lp.sebab_status,
             lp.status_dikemaskini_at, lp.tarikh_jawab, lp.notif_hantar,
             lp.tarikh_notif, lp.created_at,
             jp.id AS jadual_id, jp.no_perlawanan, jp.tarikh, jp.masa,
             jp.hari, jp.kumpulan_tahap, jp.pasukan_home,
             jp.pasukan_away, jp.tempat,
             k.id AS kejohanan_id, k.nama AS nama_kejohanan, k.anjuran,
             k.jenis_kejohanan, k.peringkat_kejohanan,
             pu.id AS pengadil_utama_lantikan_id,
             pu.pengadil_id AS pengadil_utama_id,
             u_pu.nama_penuh AS nama_pengadil_utama
      FROM lantikan_pengadil lp
      JOIN jadual_perlawanan jp ON jp.id=lp.jadual_id
      JOIN kejohanan k ON k.id=jp.kejohanan_id
      LEFT JOIN lantikan_pengadil pu
        ON pu.jadual_id=jp.id AND pu.jawatan='Pengadil' AND ${publishedAppointmentSql('pu')}
      LEFT JOIN users u_pu ON u_pu.id=pu.pengadil_id
      WHERE lp.pengadil_id=? AND ${publishedAppointmentSql('lp')}
      ORDER BY jp.tarikh ASC, jp.masa ASC, lp.id ASC
    `).bind(user.id).all<Appointment>(),
    env.DB.prepare(`
      SELECT lp.jadual_id, lp.id, lp.jawatan, lp.status,
             COALESCE(NULLIF(trim(u.nama_penuh),''),
                      NULLIF(trim(pl.nama),''),'Nama tidak direkodkan') AS nama,
             COALESCE(NULLIF(trim(u.no_telefon),''),
                      NULLIF(trim(pl.no_tel),''),'-') AS no_telefon,
             CASE WHEN COALESCE(k.peringkat_kejohanan,'Daerah')='Negeri'
               THEN COALESCE(NULLIF(trim(u.daerah),''),
                             NULLIF(trim(pl.daerah),''),'-')
               ELSE COALESCE(NULLIF(trim(u.negeri),''),
                             NULLIF(trim(pl.negeri),''),'-') END AS wilayah,
             CASE WHEN COALESCE(k.peringkat_kejohanan,'Daerah')='Negeri'
               THEN 'Daerah' ELSE 'Negeri' END AS wilayah_label
      FROM lantikan_pengadil lp
      JOIN jadual_perlawanan jp ON jp.id=lp.jadual_id
      LEFT JOIN kejohanan k ON k.id=jp.kejohanan_id
      LEFT JOIN users u ON u.id=lp.pengadil_id
      LEFT JOIN pengadil_luar pl ON pl.id=lp.pengadil_luar_id
      WHERE EXISTS (
        SELECT 1 FROM lantikan_pengadil mine
        WHERE mine.jadual_id=lp.jadual_id AND mine.pengadil_id=?
          AND ${publishedAppointmentSql('mine')}
      )
        AND ${publishedAppointmentSql('lp')}
        AND lp.status IN ('Belum Jawab','Diterima')
        AND lp.jawatan IN ('Pengadil','Penolong Pengadil 1',
                           'Penolong Pengadil 2','Pegawai ke4')
      ORDER BY lp.jadual_id,
               CASE lp.jawatan
                 WHEN 'Pengadil' THEN 1
                 WHEN 'Penolong Pengadil 1' THEN 2
                 WHEN 'Penolong Pengadil 2' THEN 3
                 ELSE 4 END,
               lp.id
    `).bind(user.id).all<CrewMember>(),
  ]);

  const crewBySchedule = new Map<number, CrewMember[]>();
  for (const member of crew.results) {
    const list = crewBySchedule.get(member.jadual_id) ?? [];
    list.push(member);
    crewBySchedule.set(member.jadual_id, list);
  }
  const data = assigned.results.map((appointment) => ({
    ...appointment,
    rakan_tugasan: (crewBySchedule.get(appointment.jadual_id) ?? [])
      .filter((member) => member.id !== appointment.id),
  }));
  const stats: Record<string, number> = {
    total: data.length,
    belum_jawab: 0,
    diterima: 0,
    ditolak: 0,
    dibatalkan: 0,
    ditangguhkan: 0,
  };
  const statKey: Record<string, string> = {
    'Belum Jawab': 'belum_jawab',
    Diterima: 'diterima',
    Ditolak: 'ditolak',
    Dibatalkan: 'dibatalkan',
    Ditangguhkan: 'ditangguhkan',
  };
  for (const appointment of data) {
    const key = statKey[appointment.status];
    if (key) stats[key]++;
  }
  return json({ error: false, data, stats });
}
