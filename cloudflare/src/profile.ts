import { currentUser, json } from './auth';
import type { Env } from './types';

type Row = Record<string, unknown>;

const SENSITIVE = [
  'email', 'no_telefon', 'no_ic', 'alamat1', 'alamat2', 'poskod',
  'status_kerja', 'jawatan', 'nama_majikan', 'nama_waris',
  'hubungan_waris', 'telefon_waris',
];

/** Global referee profile modal. PP Daerah sees private data in their own district. */
export async function refereeProfile(request: Request, env: Env): Promise<Response> {
  const user = await currentUser(request, env);
  if (!user) return json({ error: true, message: 'Sila log masuk.' }, 401);
  if (!['Admin', 'Pengadil', 'Penilai', 'PP Daerah'].includes(user.role)) {
    return json({ error: true, message: 'Akses ditolak.' }, 403);
  }
  const raw = new URL(request.url).searchParams.get('id');
  const id = raw && /^[1-9][0-9]*$/.test(raw) ? Number(raw) : 0;
  if (!Number.isSafeInteger(id) || id <= 0) {
    return json({ error: true, message: 'id diperlukan.' }, 400);
  }

  const profile = await env.DB.prepare(`
    SELECT u.id, u.nama_penuh, u.url_gambar_profil, u.role,
           u.jenis_pengadil, u.jenis_penilai, u.tahun_mula_aktif,
           u.tahun_mohon_kelas3, u.tahun_lulus_kelas3,
           u.pengadil_kebangsaan, u.pengadil_negeri, u.pengadil_daerah,
           u.aktif, u.jantina, u.saiz_baju, u.umur, u.telegram_chat_id,
           u.email, u.no_telefon, u.no_ic, u.persatuan_id,
           u.alamat1, u.alamat2, u.poskod, u.daerah, u.negeri,
           u.status_kerja, u.jawatan, u.nama_majikan,
           u.nama_waris, u.hubungan_waris, u.telefon_waris,
           pbd.nama_persatuan, pbd.daerah AS daerah_persatuan
    FROM users u
    LEFT JOIN persatuan_bolasepak_daerah pbd ON pbd.id=u.persatuan_id
    WHERE u.id=?
  `).bind(id).first<Row>();
  if (!profile) return json({ error: true, message: 'Pengguna tidak dijumpai.' }, 404);

  const sameDistrict = user.role === 'PP Daerah' && !!user.persatuan_id
    && Number(profile.persatuan_id) === user.persatuan_id;
  const privateAccess = user.role === 'Admin' || user.id === id || sameDistrict;
  const result = { ...profile };
  if (!privateAccess) {
    for (const field of SENSITIVE) delete result[field];
  }
  result.pengadil_kebangsaan = Number(result.pengadil_kebangsaan ?? 0);
  result.pengadil_negeri = Number(result.pengadil_negeri ?? 0);
  result.pengadil_daerah = Number(result.pengadil_daerah ?? 0);
  result.telegram_linked = result.telegram_chat_id ? 1 : 0;
  delete result.telegram_chat_id;
  result.boleh_kemaskini = user.role === 'Admin' || sameDistrict ? 1 : 0;

  const [appointments, applications, fitness, matches] = await Promise.all([
    env.DB.prepare(`
      SELECT COUNT(*) AS total,
             SUM(CASE WHEN status='Diterima' THEN 1 ELSE 0 END) AS diterima,
             SUM(CASE WHEN status='Ditolak' THEN 1 ELSE 0 END) AS ditolak,
             SUM(CASE WHEN status='Belum Jawab' THEN 1 ELSE 0 END) AS belum_jawab
      FROM lantikan_pengadil WHERE pengadil_id=?
    `).bind(id).first<{ total: number; diterima: number; ditolak: number; belum_jawab: number }>(),
    env.DB.prepare(`
      SELECT id, jenis_borang, jenis_permohonan, jenis_pengadil,
             status, status_ujian, admin_notes,
             tahun_permohonan, status_kemaskini, tarikh_hantar,
             COALESCE(CAST(substr(tarikh_hantar,1,4) AS INTEGER),tahun_permohonan)
               AS tahun_sebenar
      FROM permohonan WHERE user_id=?
      ORDER BY tarikh_hantar DESC, id DESC
    `).bind(id).all<Row>(),
    env.DB.prepare(`
      SELECT id, tahun_permohonan, status_ujian, tarikh_hantar,
             COALESCE(CAST(substr(tarikh_hantar,1,4) AS INTEGER),tahun_permohonan)
               AS tahun_sebenar
      FROM permohonan WHERE user_id=?
        AND (jenis_borang='ujian_kecergasan' OR jenis_permohonan='ujian_kecergasan')
      ORDER BY tahun_sebenar DESC, tarikh_hantar DESC
    `).bind(id).all(),
    env.DB.prepare(`
      SELECT id, tarikh, jenis, tempat, jawatan, home_team, away_team
      FROM perlawanan WHERE user_id=? ORDER BY tarikh DESC
    `).bind(id).all(),
  ]);
  const applicationRows = applications.results.map((application) => {
    if (privateAccess) return application;
    const { admin_notes: _notes, ...visible } = application;
    return visible;
  });

  result.stats = {
    tugasan_total: Number(appointments?.total ?? 0),
    tugasan_diterima: Number(appointments?.diterima ?? 0),
    tugasan_ditolak: Number(appointments?.ditolak ?? 0),
    tugasan_belum: Number(appointments?.belum_jawab ?? 0),
    jumlah_perlawanan: matches.results.length,
  };
  result.permohonan = applicationRows;
  result.perlawanan = matches.results;
  result.ujian_kecergasan = fitness.results;
  return json({ error: false, profil: result });
}
