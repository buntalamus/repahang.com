import { currentUser, json } from './auth';
import { buildRefpahangEmail, sendRefpahangEmail } from '../mail';
import { boundedJson } from './request';
import type { Env } from './types';
import { blastKelas3Welcome } from './kelas3-welcome';
import { wroteRow } from './d1-changes';
import { APPLICATION_CATEGORY_SQL } from './application-category';

const APPLICATION_TYPES: Record<string, string> = {
  berdaftar: 'pengadil_berdaftar',
  kecergasan: 'pengadil_berdaftar',
  bertulis: 'kelas3_fam',
  kelas3: 'kelas3_fam',
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
  if (!await currentUser(request, env)) return json({ error: true, message: 'Sesi tidak sah. Sila log masuk semula.' }, 401);
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
  if (!user) return json({ error: true, message: 'Sesi tidak sah. Sila log masuk semula.' }, 401);
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
  const applicationCategory = APPLICATION_TYPES[type] ?? null;
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
    WHERE p.user_id=? AND (? IS NULL OR ${APPLICATION_CATEGORY_SQL}=?)
    ORDER BY p.tarikh_hantar DESC, p.id DESC
  `).bind(user.id, applicationCategory, applicationCategory).all();
  return json({ error: false, data: result.results });
}

export async function adminApplications(request: Request, env: Env): Promise<Response> {
  const user = await currentUser(request, env);
  if (!user) return json({ error: true, message: 'Sesi tidak sah. Sila log masuk semula.' }, 401);
  if (user.role !== 'Admin') {
    return json({ error: true, message: 'Akses ditolak. Hanya admin boleh mengakses.' }, 403);
  }
  const url = new URL(request.url);
  const status = url.searchParams.get('status') ?? 'all';
  const applicationCategory = ADMIN_TYPES[url.searchParams.get('type') ?? ''] ?? null;
  const requestedYear = url.searchParams.get('year');
  const year = requestedYear === null ? null : Number(requestedYear);
  if (year !== null && (!Number.isInteger(year) || year < 2000 || year > 2100)) {
    return json({ error: true, message: 'Tahun tidak sah.' }, 400);
  }
  const limit = Number.parseInt(url.searchParams.get('limit') ?? '0', 10) || 0;

  const rows = await env.DB.prepare(`
    SELECT p.id, p.nama_penuh, p.jenis_permohonan AS jenis_permohonan_slug,
           p.jenis_borang,${APPLICATION_CATEGORY_SQL} AS application_category,
           CASE ${APPLICATION_CATEGORY_SQL}
             WHEN 'pengadil_berdaftar' THEN 'Pengadil Berdaftar'
             WHEN 'penilai_berdaftar' THEN 'Penilai Pengadil Berdaftar'
             WHEN 'pp_berdaftar' THEN 'Pegawai Pembangunan Berdaftar'
             WHEN 'kelas3_fam' THEN 'Kelas III FAM'
             WHEN 'ujian_kelas1_fam' THEN 'Ujian Kelas I FAM'
             WHEN 'ujian_kecergasan' THEN 'Ujian Kecergasan (Rekod Lama)'
             WHEN 'pegawai_pembangunan' THEN 'Pegawai Pembangunan'
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
      AND (? IS NULL OR ${APPLICATION_CATEGORY_SQL}=?)
      AND (? IS NULL OR p.tahun_permohonan=?)
    ORDER BY p.tarikh_hantar DESC
  `).bind(status, status, applicationCategory, applicationCategory, year, year).all();

  const month = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kuala_Lumpur', month: '2-digit',
  }).format(new Date());
  const stats = await env.DB.prepare(`
    SELECT
      SUM(CASE WHEN p.status_workflow='Menunggu Admin'
        OR (p.jenis_borang='ujian_kelas1_fam' AND p.workflow_status='Pending')
        THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN (p.status_workflow='Lengkap'
        OR (p.jenis_borang='ujian_kelas1_fam' AND p.workflow_status='Approved'))
        AND substr(p.tarikh_hantar,6,2)=? THEN 1 ELSE 0 END) AS approved_this_month,
      SUM(CASE WHEN p.status_workflow='Lengkap'
        OR (p.jenis_borang='ujian_kelas1_fam' AND p.workflow_status='Approved')
        THEN 1 ELSE 0 END) AS total_approved,
      SUM(CASE WHEN p.status_workflow='Ditolak'
        OR (p.jenis_borang='ujian_kelas1_fam' AND p.workflow_status='Rejected')
        THEN 1 ELSE 0 END) AS total_rejected
    FROM permohonan p
    WHERE (? IS NULL OR ${APPLICATION_CATEGORY_SQL}=?)
      AND (? IS NULL OR p.tahun_permohonan=?)
  `).bind(month, applicationCategory, applicationCategory, year, year).first();
  // PDO returns aggregate values as strings in the original PHP response.
  const statistics = Object.fromEntries(Object.entries(stats ?? {}).map(([key, value]) =>
    [key, value === null ? null : String(value)]));
  return json({ error: false,
    applications: limit > 0 ? rows.results.slice(0, limit) : rows.results,
    statistics });
}

/** Retain match history when an Admin removes an annual application. */
export async function deleteApplication(request: Request, env: Env): Promise<Response> {
  const user = await currentUser(request, env);
  if (!user) return json({ error: true, message: 'Sesi tidak sah. Sila log masuk semula.' }, 401);
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
  if (body.action === 'blast_kelas3_welcome') return blastKelas3Welcome(env, user.id);
  if (body.action === 'update_status_ujian') return updateFitnessResult(body, env);
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
  if (!wroteRow(results[1])) {
    return json({ error: true, message: 'Permohonan sudah diproses.' }, 409);
  }
  return json({
    error: false,
    message: 'Permohonan berjaya dipadam; rekod perlawanan dikekalkan.',
    affected_rows: results[1].meta.changes,
    unlinked_matches: results[0].meta.changes,
  });
}

async function updateFitnessResult(body: Record<string, unknown>, env: Env): Promise<Response> {
  const id = positiveId(String(body.id ?? ''));
  const decision = body.status_ujian;
  if (!id || !['Lulus', 'Tidak Lulus', 'Tidak Hadir'].includes(String(decision))) {
    return json({ error: true, message: 'Parameter tidak sah.' }, 400);
  }
  const application = await env.DB.prepare(`SELECT p.id,p.user_id,p.nama_penuh,p.emel,
    p.jenis_borang,p.jenis_pengadil,p.tahun_permohonan,p.tarikh_hantar,
    p.status_workflow,p.status_ujian,u.email AS user_email
    FROM permohonan p LEFT JOIN users u ON u.id=p.user_id WHERE p.id=? LIMIT 1`)
    .bind(id).first<{
      id: number; user_id: number | null; nama_penuh: string; emel: string;
      jenis_borang: string; jenis_pengadil: string | null; tahun_permohonan: number | null;
      tarikh_hantar: string | null; status_workflow: string | null;
      status_ujian: string | null; user_email: string | null;
    }>();
  if (!application) return json({ error: true, message: 'Permohonan tidak dijumpai.' }, 404);
  const gated = application.jenis_borang === 'pengadil_berdaftar' &&
    Number(application.tahun_permohonan) >= 2027 &&
    !['Penilai Pengadil', 'Pegawai Pembangunan'].includes(application.jenis_pengadil ?? '');
  if (gated && !['Admin Diluluskan', 'Lengkap'].includes(application.status_workflow ?? '')) {
    return json({ error: true,
      message: 'Sahkan dokumen permohonan dahulu sebelum merekod keputusan ujian.' }, 409);
  }
  if (application.status_ujian === decision) {
    return json({ error: false, message: 'Keputusan ujian tidak berubah.', email_sent: true });
  }
  const passed = decision === 'Lulus';
  if (gated) {
    const results = await env.DB.batch([
      env.DB.prepare(`UPDATE permohonan SET status_ujian=?,status=?,status_workflow=?,
        final_approved_at=CASE WHEN ? THEN datetime('now','+8 hours') ELSE NULL END,
        status_kemaskini=datetime('now','+8 hours')
        WHERE id=? AND status_workflow IN ('Admin Diluluskan','Lengkap')
          AND COALESCE(status_ujian,'')<>?`)
        .bind(decision, passed ? 'Approved' : 'Pending', passed ? 'Lengkap' : 'Admin Diluluskan',
          passed ? 1 : 0, id, decision),
      env.DB.prepare(`INSERT INTO notifications(user_id,type,subject,message,created_at)
        SELECT ?,'Keputusan Ujian Kecergasan',?,?,datetime('now','+8 hours')
        WHERE ? IS NOT NULL AND changes()=1`)
        .bind(application.user_id, `Keputusan Ujian Kecergasan: ${decision}`,
          passed ? 'Anda lulus ujian kecergasan dan kini Pengadil Berdaftar.'
            : `Keputusan ujian kecergasan anda: ${decision}. Pendaftaran belum diluluskan.`,
          application.user_id),
    ]);
    if (!wroteRow(results[0])) {
      return json({ error: true, message: 'Keputusan berubah semasa semakan. Sila muat semula.' }, 409);
    }
    let emailSent = false;
    const to = application.user_email || application.emel;
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      try {
        const title = `Keputusan Ujian Kecergasan: ${decision}`;
        const paragraphs = [passed
          ? `Anda telah lulus ujian kecergasan sesi ${application.tahun_permohonan} dan kini Pengadil Berdaftar.`
          : `Keputusan ujian kecergasan sesi ${application.tahun_permohonan}: ${decision}. Pendaftaran Pengadil Berdaftar belum diluluskan.`,
          `No. Permohonan: #${id}`];
        const { html, text } = buildRefpahangEmail(title, application.nama_penuh, paragraphs,
          { label: 'Semak Permohonan', url: new URL('/pengadil', env.BASE_URL).toString() });
        await sendRefpahangEmail(env, 'daftar', to, application.nama_penuh, `${title} - PBNP`, html, text);
        if (passed) {
          const registered = buildRefpahangEmail('Pendaftaran Pengadil Berdaftar Diluluskan',
            application.nama_penuh,
            [`Pendaftaran Pengadil Berdaftar sesi ${application.tahun_permohonan} telah diluluskan.`,
              `No. Permohonan: #${id}`],
            { label: 'Semak Pendaftaran', url: new URL('/pengadil', env.BASE_URL).toString() });
          await sendRefpahangEmail(env, 'daftar', to, application.nama_penuh,
            'Pendaftaran Pengadil Berdaftar Diluluskan - PBNP', registered.html, registered.text);
        }
        emailSent = true;
      } catch {
        console.error('Fitness decision email could not be sent');
      }
    }
    return json({ error: false, message: 'Keputusan ujian berjaya dikemaskini.', email_sent: emailSent });
  }
  const year = (application.tarikh_hantar ?? '').slice(0, 4) || String(application.tahun_permohonan ?? '');
  const isClassThree = ['kelas3_fam', 'ujian_bertulis'].includes(application.jenis_borang);
  const statements = [env.DB.prepare('UPDATE permohonan SET status_ujian=? WHERE id=? AND COALESCE(status_ujian,\'\')<>?')
    .bind(decision, id, decision)];
  if (isClassThree && application.user_id && /^20\d{2}$/.test(year)) {
    statements.push(env.DB.prepare(passed
      ? `UPDATE users SET tahun_lulus_kelas3=?,tahun_mohon_kelas3=COALESCE(tahun_mohon_kelas3,?) WHERE id=?`
      : `UPDATE users SET tahun_lulus_kelas3=NULL WHERE id=? AND tahun_lulus_kelas3=?`)
      .bind(...(passed ? [year, year, application.user_id] : [application.user_id, year])));
  }
  const results = await env.DB.batch(statements);
  return json({ error: false, message: 'Status ujian berjaya dikemaskini.',
    affected_rows: results[0].meta.changes });
}
