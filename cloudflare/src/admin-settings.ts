import { currentUser, json } from './auth';
import { boundedJson } from './request';
import type { Env } from './types';

function defaultSettings(): Record<string, string> {
  const year = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kuala_Lumpur', year: 'numeric',
  }).format(new Date());
  return {
    registration_open: '1', registration_open_date: '', registration_close_date: '',
    registration_fee: '0.00', registration_bank_name: 'Bank Kerjasama Rakyat Malaysia',
    registration_account_name: 'Persatuan Bolasepak Negeri Pahang', registration_account_no: '',
    applications_open: '0', berdaftar_open: '0', bertulis_open: '0',
    kelas1_open: '0', penilai_open: '0',
    berdaftar_open_date: '', berdaftar_close_date: '',
    bertulis_open_date: '', bertulis_close_date: '',
    kelas1_open_date: '', kelas1_close_date: '',
    penilai_open_date: '', penilai_close_date: '',
    application_year: year, min_verified_matches: '20',
    payment_amount: '80.00', payment_bank_name: 'Bank Kerjasama Rakyat Malaysia',
    payment_account_name: 'Persatuan Bolasepak Negeri Pahang', payment_account_no: '',
    max_applications_per_year: '1', require_profile_complete: '1', auto_link_matches: '1',
    application_open_date: '', application_close_date: '',
    fam_bank_name: 'Bank Islam Persatuan Bolasepak Malaysia',
    fam_account_no: '1213 1010 0061 21', bertulis_fee: '50.00',
    bertulis_min_age: '15', bertulis_max_age: '40',
    kelas1_fee: '300.00', kelas1_max_age: '32', kelas1_min_fitness_rounds: '7',
    maintenance_mode: '0',
  };
}

export async function maintenanceEnabled(env: Env): Promise<boolean> {
  if (env.STAGING_AUTH_ENABLED !== '1') return true;
  const row = await env.DB.prepare(
    "SELECT setting_value FROM application_settings WHERE setting_key='maintenance_mode'",
  ).first<{ setting_value: string }>();
  return row?.setting_value === '1';
}

export async function adminSettings(request: Request, env: Env): Promise<Response> {
  if (!['GET', 'POST', 'DELETE'].includes(request.method)) {
    return json({ error: true, message: 'Kaedah tidak dibenarkan.' }, 405);
  }
  const user = await currentUser(request, env);
  if (!user) return json({ error: true, message: 'Sila log masuk.' }, 401);
  if (user.role !== 'Admin') {
    return json({ error: true, message: 'Akses ditolak. Hanya admin dibenarkan.' }, 403);
  }

  if (request.method === 'GET') {
    const rows = await env.DB.prepare(
      'SELECT setting_key, setting_value FROM application_settings ORDER BY setting_key',
    ).all<{ setting_key: string; setting_value: string }>();
    const settings = Object.fromEntries(rows.results.map((row) => [row.setting_key, row.setting_value]));
    settings.maintenance_mode = await maintenanceEnabled(env) ? '1' : '0';
    return json({ error: false, settings });
  }
  if (env.STAGING_WRITES_ENABLED !== '1') {
    return json({ error: true, message: 'Tindakan tulis belum tersedia di staging.' }, 503);
  }

  if (request.method === 'DELETE') {
    const defaults = defaultSettings();
    await env.DB.batch([
      env.DB.prepare('DELETE FROM application_settings'),
      ...Object.entries(defaults).map(([key, value]) =>
        env.DB.prepare(
          'INSERT INTO application_settings(setting_key, setting_value) VALUES(?, ?)',
        ).bind(key, value)),
    ]);
    return json({ error: false, message: 'Tetapan telah direset kepada nilai lalai.' });
  }

  const input = await boundedJson(request, 8192);
  if (input instanceof Response) return input;
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return json({ error: true, message: 'Data tetapan diperlukan.' }, 400);
  }
  const entries = Object.entries(input);
  if (entries.length === 0 || entries.length > 100) {
    return json({ error: true, message: 'Data tetapan diperlukan.' }, 400);
  }
  const changes: [string, string][] = [];
  for (const [key, raw] of entries) {
    if (!/^[a-z][a-z0-9_]{0,63}$/.test(key)
      || (raw !== null && !['string', 'number', 'boolean'].includes(typeof raw))) {
      return json({ error: true, message: 'Nilai tetapan tidak sah.' }, 422);
    }
    const value = String(raw ?? '').trim();
    if (value.length > 2048 || (key === 'maintenance_mode' && !['0', '1'].includes(value))) {
      return json({ error: true, message: 'Nilai tetapan tidak sah.' }, 422);
    }
    changes.push([key, value]);
  }
  await env.DB.batch(changes.map(([key, value]) => env.DB.prepare(`
    INSERT INTO application_settings(setting_key, setting_value, updated_at)
    VALUES(?, ?, datetime('now'))
    ON CONFLICT(setting_key) DO UPDATE SET
      setting_value=excluded.setting_value, updated_at=excluded.updated_at
  `).bind(key, value)));
  return json({ error: false, message: 'Tetapan berjaya dikemaskini.' });
}
