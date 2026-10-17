/** PUT half of api/profil-pengadil.php: Admin edits anyone, PP Daerah its own district. */
import { currentUser, json } from './auth';
import { boundedJson } from './request';
import { phpInt } from './lantikan-write';
import type { Env } from './types';
import { notifyProfileEdited } from './account-notify';
import { profileLabels } from './referee-profile';

const FIELDS = [
  'nama_penuh', 'no_ic', 'jantina', 'no_telefon', 'email', 'saiz_baju',
  'alamat1', 'alamat2', 'poskod', 'daerah', 'negeri',
  'status_kerja', 'jawatan', 'nama_majikan',
  'nama_waris', 'hubungan_waris', 'telefon_waris',
  'jenis_pengadil', 'jenis_penilai', 'tahun_mula_aktif',
  'tahun_mohon_kelas3', 'tahun_lulus_kelas3',
];
const ADMIN_FIELDS = ['persatuan_id', 'aktif'];
const EXTRA_LABELS: Record<string, string> = {
  alamat2: 'Alamat kediaman (baris 2)', jenis_penilai: 'Jenis penilai',
  tahun_mohon_kelas3: 'Tahun mohon Kelas III', tahun_lulus_kelas3: 'Tahun lulus Kelas III', aktif: 'Status akaun',
};
const INT_FIELDS = new Set(['tahun_mula_aktif', 'tahun_mohon_kelas3', 'tahun_lulus_kelas3', 'persatuan_id', 'aktif']);
// MySQL YEAR columns became TEXT in D1 ('2019'); a bound JS number could be stored as '2019.0'.
const YEAR_FIELDS = new Set(['tahun_mula_aktif', 'tahun_mohon_kelas3', 'tahun_lulus_kelas3']);

export async function refereeProfileWrite(request: Request, env: Env): Promise<Response> {
  const user = await currentUser(request, env);
  if (!user) return json({ error: true, message: 'Sesi tidak sah. Sila log masuk semula.' }, 401);
  if (request.method !== 'PUT') return json({ error: true, message: 'Kaedah tidak dibenarkan.' }, 405);
  if (user.role !== 'Admin' && user.role !== 'PP Daerah') {
    return json({ error: true, message: 'Tidak dibenarkan.' }, 403);
  }
  if (env.STAGING_WRITES_ENABLED !== '1') {
    return json({ error: true, message: 'Tindakan tulis belum tersedia di staging.' }, 503);
  }
  const parsed = await boundedJson(request, 64 * 1024);
  if (parsed instanceof Response) return parsed;
  const input = (parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}) as Record<string, unknown>;
  const id = phpInt(input.id ?? 0);
  if (!id) return json({ error: true, message: 'id diperlukan.' }, 400);
  const target = await env.DB.prepare('SELECT persatuan_id FROM users WHERE id=?')
    .bind(id).first<{ persatuan_id: number | null }>();
  if (!target) return json({ error: true, message: 'Pengguna tidak dijumpai.' }, 404);
  if (user.role === 'PP Daerah' && phpInt(target.persatuan_id ?? 0) !== phpInt(user.persatuan_id ?? -1)) {
    return json({ error: true, message: 'Anda hanya boleh kemaskini pengadil di bawah pentadbiran daerah anda.' }, 403);
  }
  const allowed = user.role === 'Admin' ? [...FIELDS, ...ADMIN_FIELDS] : FIELDS;
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const field of allowed) {
    if (!Object.prototype.hasOwnProperty.call(input, field)) continue;
    let value = input[field];
    if (typeof value === 'string') value = value.trim();
    if (value === '' || value === null || value === undefined) value = null;
    else if (YEAR_FIELDS.has(field)) value = String(phpInt(value));
    else if (INT_FIELDS.has(field)) value = phpInt(value);
    else if (typeof value === 'boolean') value = value ? 1 : 0;
    else if (typeof value !== 'number') value = String(value);
    sets.push(`${field}=?`);
    values.push(value);
  }
  if (!sets.length) return json({ error: true, message: 'Tiada perubahan untuk disimpan.' }, 400);
  const fields = sets.map((set) => set.slice(0, -2));
  const before = await env.DB.prepare(`SELECT nama_penuh,email,${fields.join(',')} FROM users WHERE id=?`)
    .bind(id).first<Record<string, unknown>>();
  await env.DB.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id=?`).bind(...values, id).run();
  let notified = false;
  if (before) {
    const same = (a: unknown, b: unknown) => String(a ?? '').trim() === String(b ?? '').trim();
    const changed = fields.filter((field, index) => !same(before[field], values[index]));
    const labels = changed.map((field) => EXTRA_LABELS[field] ?? profileLabels[field] ?? field);
    const newEmail = changed.includes('email') ? String(values[fields.indexOf('email')] ?? '') : String(before.email ?? '');
    const newName = changed.includes('nama_penuh') ? String(values[fields.indexOf('nama_penuh')] ?? '')
      : String(before.nama_penuh ?? '');
    try {
      notified = await notifyProfileEdited(env, { userId: id, name: newName, email: newEmail }, labels,
        user.role === 'Admin' ? 'pentadbir' : 'Pegawai Pembangunan Daerah',
        changed.includes('email') ? String(before.email ?? '') : null);
    } catch (error) {
      console.error('[profil-pengadil] profile notice failed', error instanceof Error ? error.message : error);
    }
  }
  return json({ error: false, message: 'Profil berjaya dikemaskini.', notification_sent: notified });
}
