import { currentUser, json } from './auth';
import { boundedJson } from './request';
import type { Env } from './types';

const APPLICATION_TYPES: Record<string, string> = {
  berdaftar: 'pengadil_berdaftar',
  kecergasan: 'pengadil_berdaftar',
  bertulis: 'ujian_bertulis',
  kelas1: 'ujian_kelas1_fam',
  penilai_berdaftar: 'penilai_berdaftar',
  pp_berdaftar: 'pp_berdaftar',
};

const ADMIN_TYPES: Record<string, string> = {
  berdaftar: 'pengadil_berdaftar',
  penilai: 'penilai_berdaftar',
  kelas3: 'kelas3_fam',
  kelas1: 'ujian_kelas1_fam',
};

function positiveId(value: string | null): number | null {
  if (!value || !/^[1-9][0-9]*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

export async function applicationSettings(request: Request, env: Env): Promise<Response> {
  if (!await currentUser(request, env)) return json({ error: true, message: 'Sila log masuk.' }, 401);
  const rows = await env.DB.prepare('SELECT setting_key, setting_value FROM application_settings')
    .all<{ setting_key: string; setting_value: string }>();
  const all = Object.fromEntries(rows.results.map((row) => [row.setting_key, row.setting_value]));
  const defaults: Record<string, string> = {
    applications_open: '0', berdaftar_open: '0', bertulis_open: '0', kelas1_open: '0',
    penilai_open: '0', berdaftar_open_date: '', berdaftar_close_date: '',
    bertulis_open_date: '', bertulis_close_date: '', kelas1_open_date: '',
    kelas1_close_date: '', application_year: String(new Date().getUTCFullYear()),
    payment_amount: '80.00', payment_bank_name: '', payment_account_name: '',
    payment_account_no: '', min_verified_matches: '20',
    fam_bank_name: 'Bank Islam Persatuan Bolasepak Malaysia',
    fam_account_no: '1213 1010 0061 21', bertulis_fee: '50.00',
    bertulis_min_age: '15', bertulis_max_age: '40', kelas1_fee: '300.00',
    kelas1_max_age: '32', kelas1_min_fitness_rounds: '7',
  };
  const settings = Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => [key, all[key] ?? fallback]));
  return json({ error: false, settings });
}

export async function applicationHistory(request: Request, env: Env): Promise<Response> {
  const user = await currentUser(request, env);
  if (!user) return json({ error: true, message: 'Sila log masuk.' }, 401);
  if (!['Pengadil', 'Penilai', 'PP Daerah', 'Admin'].includes(user.role)) {
    return json({ error: true, message: 'Akses ditolak.' }, 403);
  }
  const url = new URL(request.url);
  const applicationId = url.searchParams.get('application_id');
  if (applicationId !== null) {
    const id = positiveId(applicationId);
    if (id === null) return json({ error: true, message: 'ID permohonan tidak sah.' }, 400);
    const application = await env.DB.prepare(`
      SELECT p.*, u.nama_penuh, u.no_ic, u.email, u.no_telefon,
             u.alamat1, u.alamat2, u.poskod, u.daerah, u.negeri,
             u.status_kerja, u.jawatan, u.nama_majikan, u.alamat_majikan1,
             u.alamat_majikan2, u.poskod_majikan, u.daerah_majikan,
             u.negeri_majikan, u.nama_waris, u.hubungan_waris, u.telefon_waris,
             u.jenis_pengadil, u.tahun_mula_aktif, u.saiz_baju
      FROM permohonan p JOIN users u ON u.id=p.user_id
      WHERE p.id=? AND p.user_id=? LIMIT 1
    `).bind(id, user.id).first();
    if (!application) {
      return json({ error: true, message: 'Permohonan tidak dijumpai atau akses ditolak.' }, 404);
    }
    return json({ error: false, application });
  }
  const type = url.searchParams.get('type') ?? '';
  const jenisBorang = APPLICATION_TYPES[type] ?? null;
  const result = await env.DB.prepare(`
    SELECT p.id, p.jenis_borang, p.tahun_permohonan, p.status,
           p.status_workflow, p.status_ujian, p.payment_amount, p.url_resit,
           p.pp_notes, p.admin_notes, p.mohon_ujian_kecergasan,
           CASE WHEN p.tarikh_hantar IS NULL THEN NULL ELSE
             strftime('%d/%m/%Y %H:%M', p.tarikh_hantar) END AS tarikh_hantar,
           substr(p.tarikh_hantar,1,10) AS tarikh_hantar_raw,
           COALESCE(pb.nama_persatuan,'') AS district_name
    FROM permohonan p
    LEFT JOIN persatuan_bolasepak_daerah pb ON pb.id=p.persatuan_id
    WHERE p.user_id=? AND (? IS NULL OR p.jenis_borang=?)
    ORDER BY p.tarikh_hantar DESC, p.id DESC
  `).bind(user.id, jenisBorang, jenisBorang).all();
  return json({ error: false, data: result.results });
}

export async function adminApplications(request: Request, env: Env): Promise<Response> {
  const user = await currentUser(request, env);
  if (!user) return json({ error: true, message: 'Sila log masuk.' }, 401);
  if (user.role !== 'Admin') {
    return json({ error: true, message: 'Akses ditolak. Hanya admin boleh mengakses.' }, 403);
  }
  const url = new URL(request.url);
  const status = url.searchParams.get('status') ?? 'all';
  const jenisBorang = ADMIN_TYPES[url.searchParams.get('type') ?? ''] ?? null;
  const limitRaw = url.searchParams.get('limit');
  const limit = limitRaw && positiveId(limitRaw) ? Math.min(Number(limitRaw), 500) : 500;
  const yearRaw = url.searchParams.get('year');
  const year = yearRaw && /^20[0-9]{2}$/.test(yearRaw) ? Number(yearRaw) : null;

  const rows = await env.DB.prepare(`
    SELECT p.id, p.nama_penuh, p.jenis_permohonan AS jenis_permohonan_slug,
           p.jenis_borang,
           CASE p.jenis_borang
             WHEN 'pengadil_berdaftar' THEN 'Pengadil Berdaftar'
             WHEN 'penilai_berdaftar' THEN 'RA Berdaftar'
             WHEN 'pp_berdaftar' THEN 'PP Berdaftar'
             WHEN 'kelas3_fam' THEN 'Kelas III FAM'
             WHEN 'ujian_kelas1_fam' THEN 'Ujian Kelas I FAM'
             ELSE p.jenis_borang END AS jenis_permohonan,
           CASE WHEN p.jenis_borang='ujian_kelas1_fam' THEN
             CASE p.workflow_status WHEN 'Pending' THEN 'Menunggu Admin'
               WHEN 'Approved' THEN 'Lengkap' WHEN 'Rejected' THEN 'Ditolak'
               ELSE p.workflow_status END
             ELSE p.status_workflow END AS status,
           p.status_ujian, p.tarikh_hantar, p.emel, p.no_telefon,
           p.jenis_pengadil, p.tahun_permohonan,
           COALESCE(NULLIF(p.url_gambar_profil,''),u.url_gambar_profil) AS url_gambar_profil,
           p.no_kp, p.saiz_baju, p.alamat1, p.alamat2, p.poskod, p.daerah,
           p.negeri, p.status_kerja, p.jawatan, p.nama_majikan,
           p.nama_waris, p.hubungan_waris, p.telefon_waris, p.url_resit,
           penilai_det.jenis_penilai AS penilai_jenis,
           penilai_det.tahun_pengalaman AS penilai_tahun_pengalaman,
           penilai_det.kelayakan AS penilai_kelayakan,
           penilai_det.sijil_kursus_url, penilai_det.sijil_kesihatan_url,
           penilai_det.catatan AS penilai_catatan,
           pb.nama_persatuan AS district_nama, u.email AS user_email,
           (SELECT COUNT(*) FROM perlawanan pl WHERE pl.permohonan_id=p.id) AS total_matches
    FROM permohonan p
    LEFT JOIN users u ON u.id=p.user_id
    LEFT JOIN persatuan_bolasepak_daerah pb ON pb.id=p.persatuan_id
    LEFT JOIN penilai_permohonan penilai_det ON penilai_det.permohonan_id=p.id
    WHERE (?='all' OR
      CASE WHEN p.jenis_borang='ujian_kelas1_fam' THEN
        CASE p.workflow_status WHEN 'Pending' THEN 'Menunggu Admin'
          WHEN 'Approved' THEN 'Lengkap' WHEN 'Rejected' THEN 'Ditolak'
          ELSE p.workflow_status END
      ELSE p.status_workflow END=?)
      AND (? IS NULL OR p.jenis_borang=?)
      AND (? IS NULL OR p.tahun_permohonan=?)
    ORDER BY p.tarikh_hantar DESC, p.id DESC LIMIT ?
  `).bind(status, status, jenisBorang, jenisBorang, year, year, limit).all();

  const month = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit',
  }).format(new Date());
  const stats = await env.DB.prepare(`
    SELECT
      SUM(CASE WHEN p.status_workflow='Menunggu Admin'
        OR (p.jenis_borang='ujian_kelas1_fam' AND p.workflow_status='Pending')
        THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN (p.status_workflow='Lengkap'
        OR (p.jenis_borang='ujian_kelas1_fam' AND p.workflow_status='Approved'))
        AND substr(p.tarikh_hantar,1,7)=? THEN 1 ELSE 0 END) AS approved_this_month,
      SUM(CASE WHEN p.status_workflow='Lengkap'
        OR (p.jenis_borang='ujian_kelas1_fam' AND p.workflow_status='Approved')
        THEN 1 ELSE 0 END) AS total_approved,
      SUM(CASE WHEN p.status_workflow='Ditolak'
        OR (p.jenis_borang='ujian_kelas1_fam' AND p.workflow_status='Rejected')
        THEN 1 ELSE 0 END) AS total_rejected
    FROM permohonan p
  `).bind(month).first();
  return json({ error: false, applications: rows.results, statistics: stats });
}

/** Retain match history when an Admin removes an annual application. */
export async function deleteApplication(request: Request, env: Env): Promise<Response> {
  const user = await currentUser(request, env);
  if (!user) return json({ error: true, message: 'Sila log masuk.' }, 401);
  if (user.role !== 'Admin') {
    return json({ error: true, message: 'Akses ditolak. Hanya admin boleh mengakses.' }, 403);
  }
  if (env.STAGING_WRITES_ENABLED !== '1') {
    return json({ error: true, message: 'Tindakan tulis belum tersedia di staging.' }, 503);
  }
  const input = await boundedJson(request);
  if (input instanceof Response) return input;
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return json({ error: true, message: 'Data tidak sah.' }, 400);
  }
  const body = input as Record<string, unknown>;
  if (body.action !== 'delete_application') {
    return json({ error: true, message: 'Tindakan belum tersedia di staging.' }, 503);
  }
  const id = positiveId(String(body.id ?? ''));
  if (id === null) return json({ error: true, message: 'ID permohonan diperlukan.' }, 400);
  const exists = await env.DB.prepare('SELECT id FROM permohonan WHERE id=?').bind(id).first();
  if (!exists) return json({ error: true, message: 'Permohonan tidak dijumpai.' }, 404);

  // D1 batch is transactional. Detach match history before the FK cascade
  // could remove it, then delete the application and its true child rows.
  const results = await env.DB.batch([
    env.DB.prepare('UPDATE perlawanan SET permohonan_id=NULL WHERE permohonan_id=?').bind(id),
    env.DB.prepare('DELETE FROM permohonan WHERE id=?').bind(id),
  ]);
  if (results[1].meta.changes !== 1) {
    return json({ error: true, message: 'Permohonan sudah diproses.' }, 409);
  }
  return json({
    error: false,
    message: 'Permohonan berjaya dipadam; rekod perlawanan dikekalkan.',
    affected_rows: results[1].meta.changes,
    unlinked_matches: results[0].meta.changes,
  });
}
