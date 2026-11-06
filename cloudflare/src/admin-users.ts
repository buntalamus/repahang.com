import { qualificationYearsSql } from './profile-years';
import { currentUser, json } from './auth';
import type { Env } from './types';

export async function adminUsers(request: Request, env: Env): Promise<Response> {
  const session = await currentUser(request, env);
  if (!session) return json({ error: true, message: 'Sesi tidak sah. Sila log masuk semula.' }, 401);
  if (session.role !== 'Admin') {
    return json({ error: true, message: 'Akses ditolak. Hanya admin boleh mengakses.' }, 403);
  }
  const url = new URL(request.url);
  const idText = url.searchParams.get('id');
  if (idText !== null) {
    if (!/^[1-9][0-9]*$/.test(idText) || !Number.isSafeInteger(Number(idText))) {
      return json({ error: true, message: 'ID pengguna tidak sah.' }, 400);
    }
    const user = await env.DB.prepare(`
      SELECT u.id, u.email, u.role, u.district_id, u.persatuan_id,
             u.nama_penuh, u.no_ic, u.no_telefon, u.jantina,
             u.alamat1, u.alamat2, u.poskod, u.daerah, u.negeri,
             u.status_kerja, u.jawatan, u.nama_majikan,
             u.alamat_majikan1, u.alamat_majikan2, u.poskod_majikan,
             u.daerah_majikan, u.negeri_majikan,
             u.nama_waris, u.hubungan_waris, u.telefon_waris,
             u.url_gambar_profil, u.jenis_pengadil, u.jenis_penilai,
             NULLIF(NULLIF(trim(u.tahun_mula_aktif),''),'0000') AS tahun_mula_aktif, u.saiz_baju, u.aktif, u.inactive_reason, u.inactive_source,
             ${qualificationYearsSql()},
             u.pengadil_kebangsaan, u.pengadil_negeri, u.pengadil_daerah,
             u.password_changed, u.last_login, u.created_at, u.updated_at,
             u.umur, u.telegram_chat_id,
             p.nama_persatuan AS persatuan_nama, p.kod_persatuan
      FROM users u
      LEFT JOIN persatuan_bolasepak_daerah p ON p.id=u.persatuan_id
      WHERE u.id=? LIMIT 1
    `).bind(Number(idText)).first();
    if (!user) return json({ error: true, message: 'Pengguna tidak dijumpai.' }, 404);
    return json({ error: false, user });
  }
  if (url.searchParams.get('action') === 'count') {
    const count = await env.DB.prepare('SELECT COUNT(*) AS total FROM users').first<{ total: number }>();
    return json({ error: false, total: count?.total ?? 0 });
  }
  const currentYear = Number(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kuala_Lumpur', year: 'numeric',
  }).format(new Date()));
  const yearText = url.searchParams.get('year');
  const year = yearText === null ? currentYear : Number(yearText);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return json({ error: true, message: 'Tahun tidak sah.' }, 400);
  }
  const [users, persatuan] = await Promise.all([
    usersOverviewStatement(env, year).all(),
    env.DB.prepare(`
      SELECT id, nama_persatuan FROM persatuan_bolasepak_daerah
      ORDER BY nama_persatuan
    `).all(),
  ]);
  return json({ error: false, year, users: users.results, persatuan: persatuan.results });
}

/** Shared annual classification for the screen and the full master export. */
export function usersOverviewStatement(env: Env, year: number): D1PreparedStatement {
  return env.DB.prepare(`
      WITH annual AS (
        SELECT p.user_id,
          MAX(CASE WHEN p.jenis_borang='pengadil_berdaftar' AND p.tahun_permohonan=?
            AND UPPER(TRIM(COALESCE(p.jenis_pengadil,''))) NOT IN ('PENILAI PENGADIL','PEGAWAI PEMBANGUNAN')
            THEN 1 ELSE 0 END) AS current_applied,
          MAX(CASE WHEN p.jenis_borang='pengadil_berdaftar' AND p.tahun_permohonan=?
            AND p.status='Approved'
            AND UPPER(TRIM(COALESCE(p.jenis_pengadil,''))) NOT IN ('PENILAI PENGADIL','PEGAWAI PEMBANGUNAN')
            THEN 1 ELSE 0 END) AS current_approved,
          MAX(CASE WHEN p.jenis_borang='pengadil_berdaftar' AND p.tahun_permohonan=?
            AND p.status='Approved'
            AND UPPER(TRIM(COALESCE(p.jenis_pengadil,''))) NOT IN ('PENILAI PENGADIL','PEGAWAI PEMBANGUNAN')
            AND ((p.tahun_permohonan>=2027 AND p.status_ujian='Lulus') OR
              (p.tahun_permohonan<2027 AND EXISTS (SELECT 1 FROM permohonan f
                WHERE f.user_id=p.user_id AND f.tahun_permohonan=p.tahun_permohonan
                  AND f.jenis_borang='ujian_kecergasan' AND f.status_ujian='Lulus')))
            THEN 1 ELSE 0 END) AS current_license,
          MAX(CASE WHEN p.jenis_borang='pengadil_berdaftar' AND p.tahun_permohonan=?
            AND p.status='Approved'
            AND UPPER(TRIM(COALESCE(p.jenis_pengadil,''))) NOT IN ('PENILAI PENGADIL','PEGAWAI PEMBANGUNAN')
            THEN COALESCE(p.status_ujian,(SELECT f.status_ujian FROM permohonan f
              WHERE f.user_id=p.user_id AND f.tahun_permohonan=p.tahun_permohonan
                AND f.jenis_borang='ujian_kecergasan' ORDER BY f.id DESC LIMIT 1)) END) AS current_fitness_status,
          MAX(CASE WHEN p.jenis_borang='pengadil_berdaftar' AND p.tahun_permohonan<?
            AND p.status='Approved'
            AND UPPER(TRIM(COALESCE(p.jenis_pengadil,''))) NOT IN ('PENILAI PENGADIL','PEGAWAI PEMBANGUNAN')
            THEN 1 ELSE 0 END) AS prior_approved,
          MAX(CASE WHEN (p.jenis_borang='penilai_berdaftar'
            OR (p.jenis_borang='pengadil_berdaftar'
              AND UPPER(TRIM(COALESCE(p.jenis_pengadil,'')))='PENILAI PENGADIL'))
            AND p.status='Approved'
            THEN 1 ELSE 0 END) AS ra_approved,
          MAX(CASE WHEN p.jenis_borang IN ('kelas3_fam','ujian_bertulis')
            AND p.status_ujian='Lulus' AND p.tahun_permohonan<=?
            THEN 1 ELSE 0 END) AS class3_passed,
          MAX(CASE WHEN p.jenis_borang='ujian_kelas1_fam'
            AND p.status_ujian='Lulus' AND p.tahun_permohonan<=?
            THEN 1 ELSE 0 END) AS class1_passed
        FROM permohonan p GROUP BY p.user_id
      )
      SELECT u.id, u.email, u.role AS user_role, u.persatuan_id,
             u.nama_penuh, u.no_ic, u.no_telefon, u.jantina,
             u.jenis_pengadil, u.url_gambar_profil,
             u.aktif AS is_active, u.inactive_reason, u.inactive_source, u.telegram_chat_id, u.created_at,
             COALESCE(a.current_applied,0) AS current_applied,
             COALESCE(a.current_approved,0) AS current_approved,
             COALESCE(a.current_license,0) AS current_license,
             a.current_fitness_status,
             COALESCE(a.prior_approved,0) AS prior_approved,
             CASE WHEN (u.role='Pengadil' AND UPPER(TRIM(COALESCE(u.jenis_pengadil,'')))
               NOT IN ('PENILAI PENGADIL','PEGAWAI PEMBANGUNAN'))
               OR u.jenis_pengadil IN ('Pengadil Negeri','Pengadil Kebangsaan','Kelas III FAM','Kelas I FAM')
               OR COALESCE(a.current_applied,0)=1 OR COALESCE(a.prior_approved,0)=1
               THEN 1 ELSE 0 END AS is_referee,
             CASE WHEN u.role='Penilai' OR COALESCE(a.ra_approved,0)=1
               OR u.jenis_pengadil='Penilai Pengadil' THEN 1 ELSE 0 END AS is_ra,
             CASE WHEN CAST(u.tahun_lulus_kelas3 AS INTEGER) BETWEEN 1900 AND ? OR COALESCE(a.class3_passed,0)=1
               THEN 1 ELSE 0 END AS class3_passed,
             CASE WHEN CAST(u.tahun_lulus_kelas1 AS INTEGER) BETWEEN 1900 AND ? OR COALESCE(a.class1_passed,0)=1 THEN 1 ELSE 0 END AS class1_passed,
             p.nama_persatuan AS persatuan_nama, p.kod_persatuan
      FROM users u
      LEFT JOIN annual a ON a.user_id=u.id
      LEFT JOIN persatuan_bolasepak_daerah p ON p.id=u.persatuan_id
      ORDER BY u.created_at DESC
    `).bind(year, year, year, year, year, year, year, year, year);
}
