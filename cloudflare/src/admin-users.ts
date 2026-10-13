import { currentUser, json } from './auth';
import type { Env } from './types';

export async function adminUsers(request: Request, env: Env): Promise<Response> {
  const session = await currentUser(request, env);
  if (!session) return json({ error: true, message: 'Sila log masuk.' }, 401);
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
             u.tahun_mula_aktif, u.saiz_baju, u.aktif,
             u.tahun_mohon_kelas3, u.tahun_lulus_kelas3,
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
  const [users, persatuan] = await Promise.all([
    env.DB.prepare(`
      SELECT u.id, u.email, u.role AS user_role, u.persatuan_id,
             u.nama_penuh, u.no_ic, u.no_telefon, u.jantina,
             u.jenis_pengadil, u.url_gambar_profil,
             u.aktif AS is_active, u.telegram_chat_id, u.created_at,
             p.nama_persatuan AS persatuan_nama, p.kod_persatuan
      FROM users u
      LEFT JOIN persatuan_bolasepak_daerah p ON p.id=u.persatuan_id
      ORDER BY u.created_at DESC, u.id DESC
    `).all(),
    env.DB.prepare(`
      SELECT id, nama_persatuan FROM persatuan_bolasepak_daerah
      ORDER BY nama_persatuan
    `).all(),
  ]);
  return json({ error: false, users: users.results, persatuan: persatuan.results });
}
