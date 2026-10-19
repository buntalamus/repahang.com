import { setAccountStatus, DEFAULT_INACTIVE_REASON } from './account-access';
import { normalizeProfileInput } from './profile-contract';
/** PUT half of api/profil-pengadil.php: Admin edits anyone, PP Daerah its own district. */
import { currentUser, json } from './auth';
import { boundedJson } from './request';
import { phpInt } from './lantikan-write';
import type { Env } from './types';
import { notifyProfileEdited } from './account-notify';
import { profileLabels } from './referee-profile';

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
  const target = await env.DB.prepare('SELECT persatuan_id,tahun_mula_aktif,tahun_mohon_kelas3,tahun_lulus_kelas3,tahun_mohon_kelas1,tahun_lulus_kelas1 FROM users WHERE id=?')
    .bind(id).first<Record<string, unknown> & { persatuan_id: number | null }>();
  if (!target) return json({ error: true, message: 'Pengguna tidak dijumpai.' }, 404);
  if (user.role === 'PP Daerah' && phpInt(target.persatuan_id ?? 0) !== phpInt(user.persatuan_id ?? -1)) {
    return json({ error: true, message: 'Anda hanya boleh kemaskini pengadil di bawah pentadbiran daerah anda.' }, 403);
  }
  if (user.role === 'PP Daerah' && Object.hasOwn(input,'persatuan_id') && Number(input.persatuan_id)!==Number(target.persatuan_id))
    return json({error:true,message:'Perubahan persatuan perlu dibuat oleh Admin.'},403);
  const normalized=normalizeProfileInput(input,target);
  if (normalized.error) return json({error:true,message:normalized.error},400);
  if (Object.hasOwn(normalized.values,'email') && await env.DB.prepare('SELECT 1 FROM users WHERE lower(email)=lower(?) AND id<>?').bind(normalized.values.email,id).first())
    return json({error:true,message:'Emel sudah digunakan oleh akaun lain.'},409);
  if (normalized.values.persatuan_id && !await env.DB.prepare('SELECT 1 FROM persatuan_bolasepak_daerah WHERE id=?').bind(normalized.values.persatuan_id).first())
    return json({error:true,message:'Persatuan tidak dijumpai.'},400);
  let accessStatus: number | null = null;
  if (user.role==='Admin' && Object.hasOwn(input,'aktif')) {
    if (![0,1,'0','1'].includes(input.aktif as number)) return json({error:true,message:'Status akaun tidak sah.'},400);
    accessStatus=Number(input.aktif);
    if (!Object.keys(normalized.values).length)
      return setAccountStatus(env,user.id,id,accessStatus,input.reason ?? DEFAULT_INACTIVE_REASON);
    normalized.values.aktif=accessStatus;
  }
  const sets=Object.keys(normalized.values).map(field=>`${field}=?`);
  const values=Object.values(normalized.values);
  if (!sets.length) return json({ error: true, message: 'Tiada perubahan untuk disimpan.' }, 400);
  const fields = sets.map((set) => set.slice(0, -2));
  const before = await env.DB.prepare(`SELECT nama_penuh,email,${fields.join(',')} FROM users WHERE id=?`)
    .bind(id).first<Record<string, unknown>>();
  let notified = false;
  if (accessStatus !== null) {
    // One transaction for legacy clients submitting profile and status together.
    const profileValues = { ...normalized.values };
    delete profileValues.aktif;
    const response = await setAccountStatus(env,user.id,id,accessStatus,input.reason ?? DEFAULT_INACTIVE_REASON,profileValues);
    if (!response.ok) return response;
    notified = Boolean((await response.json() as { notification_sent?: boolean }).notification_sent);
  } else {
    await env.DB.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id=?`).bind(...values, id).run();
  }
  if (before) {
    const same = (a: unknown, b: unknown) => String(a ?? '').trim() === String(b ?? '').trim();
    const changed = fields.filter((field, index) => !same(before[field], values[index]));
    const labels = changed.map((field) => profileLabels[field] ?? field);
    const newEmail = changed.includes('email') ? String(values[fields.indexOf('email')] ?? '') : String(before.email ?? '');
    const newName = changed.includes('nama_penuh') ? String(values[fields.indexOf('nama_penuh')] ?? '')
      : String(before.nama_penuh ?? '');
    try {
      notified = await notifyProfileEdited(env, { userId: id, name: newName, email: newEmail }, labels,
        user.role === 'Admin' ? 'pentadbir' : 'Pegawai Pembangunan Daerah',
        changed.includes('email') ? String(before.email ?? '') : null) || notified;
    } catch (error) {
      console.error('[profil-pengadil] profile notice failed', error instanceof Error ? error.message : error);
    }
  }
  return json({ error: false, message: 'Profil berjaya dikemaskini.', notification_sent: notified });
}
