import { buildRefpahangEmail, sendRefpahangEmail } from '../mail';
import type { MailAttachment } from '../mail';
import { currentUser, json } from './auth';
import { registrationPdf } from './registration-pdf';
import type { Env } from './types';
import { missingRefereeProfile, profileLabels } from './referee-profile';
import { dimensions } from './profile-write';
import { applicationSettingDefaults } from './applications';
import { applicationWindow, windowClosedMessage, type WindowName } from './application-window';
import { CLASS_THREE_YEAR_SQL, ageInYear, classThreeDeadline, klYear, qualifyingMatchYear } from './application-eligibility';

type FormType = 'pengadil_berdaftar' | 'penilai_berdaftar' | 'kelas3_fam' | 'ujian_kelas1_fam';
type Profile = Record<string, string | number | null>;
const annual = new Set<FormType>(['pengadil_berdaftar', 'penilai_berdaftar']);
const allowed: Record<string, FormType[]> = {
  Pengadil: ['pengadil_berdaftar', 'kelas3_fam', 'ujian_kelas1_fam'],
  Penilai: ['penilai_berdaftar'],
  'PP Daerah': ['pengadil_berdaftar', 'penilai_berdaftar', 'kelas3_fam', 'ujian_kelas1_fam'],
};
const formWindow: Record<FormType, WindowName> = {
  pengadil_berdaftar: 'berdaftar', penilai_berdaftar: 'penilai',
  kelas3_fam: 'bertulis', ujian_kelas1_fam: 'kelas1',
};
// The Admin Settings fee for each form; the annual forms share payment_amount.
const feeSetting: Record<FormType, string> = {
  pengadil_berdaftar: 'payment_amount', penilai_berdaftar: 'payment_amount',
  kelas3_fam: 'bertulis_fee', ujian_kelas1_fam: 'kelas1_fee',
};
const formLabel: Record<FormType, string> = {
  pengadil_berdaftar: 'Pendaftaran Tahunan Pengadil', penilai_berdaftar: 'Pendaftaran Tahunan Penilai Pengadil',
  kelas3_fam: 'Kelas III FAM', ujian_kelas1_fam: 'Ujian Kelas I FAM',
};
// Where each reviewer verifies the form.
const ppPage: Record<FormType, string> = {
  pengadil_berdaftar: '/pp-daerah/permohonan/pengadil', penilai_berdaftar: '/pp-daerah/permohonan/berdaftar',
  kelas3_fam: '/pp-daerah/permohonan/kelas3', ujian_kelas1_fam: '/pp-daerah/permohonan/kelas1',
};
const adminPage = (type: FormType) => type === 'penilai_berdaftar' ? '/admin/permohonan-ra' : '/admin/permohonan';
const closedMessage: Record<FormType, string> = {
  pengadil_berdaftar: 'Maaf, permohonan Pendaftaran Tahunan tidak dibuka pada masa ini.',
  penilai_berdaftar: 'Maaf, permohonan Pendaftaran Tahunan Penilai Pengadil tidak dibuka pada masa ini.',
  kelas3_fam: 'Maaf, permohonan Kelas III FAM tidak dibuka pada masa ini.',
  ujian_kelas1_fam: 'Maaf, permohonan Ujian Kelas I FAM tidak dibuka pada masa ini.',
};

function field(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === 'string' ? value.trim() : '';
}
/** A numeric Admin setting; blank or non-numeric values are NaN, never 0. */
function settingNumber(value: string | undefined): number {
  return value === undefined || value.trim() === '' ? NaN : Number(value);
}
function profileValue(profile: Profile, key: string): string {
  return profile[key] === null || profile[key] === undefined ? '' : String(profile[key]);
}

async function limitedForm(request: Request): Promise<FormData | Response> {
  const max = 12 * 1024 * 1024;
  if (Number(request.headers.get('Content-Length') || 0) > max) {
    return json({error: true, message: 'Permintaan terlalu besar.'}, 413);
  }
  const contentType = request.headers.get('Content-Type') || '';
  if (!/^(multipart\/form-data|application\/x-www-form-urlencoded)\b/i.test(contentType)) {
    return json({error: true, message: 'Data borang tidak sah.'}, 400);
  }
  const reader = request.body?.getReader();
  if (!reader) return json({error: true, message: 'Data borang tidak sah.'}, 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const {done, value} = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      return json({error: true, message: 'Permintaan terlalu besar.'}, 413);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try {
    return await new Request(request.url, {method: 'POST', headers: {'Content-Type': contentType}, body: bytes}).formData();
  } catch {
    return json({error: true, message: 'Data borang tidak sah.'}, 400);
  }
}

async function fileInfo(file: File, kind: 'resit' | 'gambar'):
  Promise<{bytes: Uint8Array; mime: string; ext: string} | Response> {
  if (file.size < 1 || file.size > 5 * 1024 * 1024) {
    return json({error: true, message: `Saiz fail ${kind} tidak sah (maksimum 5MB).`}, 400);
  }
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const bytes = new Uint8Array(await file.arrayBuffer());
  const jpeg = bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes.length > 8 && [137,80,78,71,13,10,26,10].every((part, i) => bytes[i] === part);
  const pdf = bytes.length > 5 && [37,80,68,70,45].every((part, i) => bytes[i] === part);
  const mime = jpeg && ['jpg','jpeg'].includes(ext) ? 'image/jpeg'
    : png && ext === 'png' ? 'image/png'
      : kind === 'resit' && pdf && ext === 'pdf' ? 'application/pdf' : '';
  if (!mime) return json({error: true, message: kind === 'resit'
    ? 'Format resit tidak dibenarkan. Gunakan JPG, PNG atau PDF.'
    : 'Format gambar tidak dibenarkan. Gunakan JPG atau PNG.'}, 400);
  if (kind === 'gambar') {
    const info = dimensions(bytes);
    if (bytes.length > 200 * 1024 || !info || info.width < 150 || info.height < 150 ||
        info.width > 400 || info.height > 400) {
      return json({error: true, message: 'Gambar profil perlu dikecilkan kepada maksimum 400x400 piksel dan 200KB.'}, 400);
    }
  }
  return {bytes, mime, ext};
}

function isResponse(value: unknown): value is Response { return value instanceof Response; }

export async function submitRefereeApplication(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return json({error: true, message: 'Method not allowed'}, 405);
  const user = await currentUser(request, env);
  if (!user) return json({error: true, message: 'Sesi tidak sah. Sila log masuk semula.'}, 401);
  if (env.STAGING_WRITES_ENABLED !== '1') {
    return json({error: true, message: 'Tindakan tulis belum tersedia di staging.'}, 503);
  }
  if (!allowed[user.role] && !(user.role === 'Admin' && user.jenis_pengadil === 'Penilai Pengadil')) {
    return json({error: true, message: 'Akses ditolak.'}, 403);
  }
  const input = await limitedForm(request);
  if (isResponse(input)) return input;
  const type = (field(input, 'jenis_borang') || 'pengadil_berdaftar') as FormType;
  const canSubmit = allowed[user.role]?.includes(type)
    || (user.role === 'Admin' && user.jenis_pengadil === 'Penilai Pengadil' && type === 'penilai_berdaftar');
  if (!canSubmit) return json({error: true, message: 'Jenis borang tidak dibenarkan untuk peranan anda.'}, 403);
  if (user.role === 'PP Daerah' && type === 'pengadil_berdaftar' && Number(user.can_referee) !== 1) {
    return json({error: true, message: 'Akaun PP ini tidak mempunyai kelayakan pengadil.'}, 403);
  }

  const settingsRows = await env.DB.prepare('SELECT setting_key,setting_value FROM application_settings')
    .all<{setting_key: string; setting_value: string}>();
  const settings: Record<string, string> = {...applicationSettingDefaults(),
    ...Object.fromEntries(settingsRows.results.map(row => [row.setting_key, row.setting_value]))};
  const formStatus = applicationWindow(settings, formWindow[type]);
  if (formStatus.state !== 'open') {
    return json({error: true, message: windowClosedMessage(formWindow[type], formStatus, closedMessage[type])}, 400);
  }
  const year = Number(settings.application_year || klYear());
  if (!Number.isSafeInteger(year) || year < 2020 || year > 2100) {
    return json({error: true, message: 'Tahun permohonan tidak sah.'}, 500);
  }
  const fee = settingNumber(settings[feeSetting[type]]);
  if (!Number.isFinite(fee) || fee < 0) {
    return json({error: true, message: 'Tetapan yuran permohonan tidak sah. Sila hubungi pentadbir.'}, 500);
  }
  const profile = await env.DB.prepare(`
    SELECT nama_penuh,no_ic,email,no_telefon,jantina,alamat1,alamat2,poskod,daerah,negeri,
      district_id,persatuan_id,jenis_pengadil,status_kerja,jawatan,nama_majikan,
      alamat_majikan1,alamat_majikan2,poskod_majikan,daerah_majikan,negeri_majikan,
      saiz_baju,tahun_mula_aktif,nama_waris,hubungan_waris,telefon_waris,
      url_gambar_profil
    FROM users WHERE id=? LIMIT 1
  `).bind(user.id).first<Profile>();
  if (!profile) return json({error: true, message: 'Profil pengguna tidak dijumpai.'}, 400);
  if (type === 'pengadil_berdaftar') {
    const missing = missingRefereeProfile(profile);
    if (missing.length) return json({error: true,
      message: `Lengkapkan profil anda sebelum memohon: ${missing.map(key => profileLabels[key]).join(', ')}.`,
      missing_fields: missing}, 400);
  }

  const age = ageInYear(profileValue(profile, 'no_ic'), year);
  if (age !== null && (type === 'kelas3_fam' || type === 'ujian_kelas1_fam')) {
    const minAge = settingNumber(settings.bertulis_min_age);
    const maxAge = settingNumber(settings.bertulis_max_age);
    const classOneMax = settingNumber(settings.kelas1_max_age);
    if (![minAge, maxAge, classOneMax].every(Number.isFinite)) {
      return json({error: true, message: 'Tetapan had umur tidak sah. Sila hubungi pentadbir.'}, 500);
    }
    if (type === 'kelas3_fam' && (age < minAge || age > maxAge)) {
      return json({error: true, message: `Anda tidak memenuhi syarat umur untuk Kelas III FAM. Calon mesti berumur antara ${minAge} hingga ${maxAge} tahun pada tahun ${year}.`}, 400);
    }
    if (type === 'ujian_kelas1_fam' && age > classOneMax) {
      return json({error: true, message: `Anda tidak memenuhi syarat umur untuk Ujian Kelas I FAM. Calon mesti berumur ${classOneMax} tahun ke bawah pada tahun ${year}.`}, 400);
    }
  }
  if (type === 'ujian_kelas1_fam') {
    const deadline = classThreeDeadline(year);
    const classThree = await env.DB.prepare(`SELECT 1 FROM users u WHERE u.id=? AND ${CLASS_THREE_YEAR_SQL('u')}<=?`)
      .bind(user.id, deadline).first();
    if (!classThree) return json({error: true, message:
      `Anda tidak layak memohon Ujian Kelas I FAM. Sijil Kelas III FAM mesti diperoleh pada tahun ${deadline} atau sebelumnya (sekurang-kurangnya 2 tahun).`}, 400);
  }
  const existing = await env.DB.prepare(`
    SELECT id FROM permohonan WHERE user_id=? AND jenis_borang=? AND tahun_permohonan=? LIMIT 1
  `).bind(user.id, type, year).first();
  if (existing) return json({error: true, message:
    `Anda sudah mempunyai permohonan untuk tahun ${year}. Sila semak sejarah permohonan anda.`}, 400);
  // Registration for a session opens in the December before it, so the
  // qualifying matches are always those of the preceding season, whether the
  // form is sent in December or in January of the session year.
  const matchYear = String(qualifyingMatchYear(year));
  if (type === 'pengadil_berdaftar' && user.role !== 'PP Daerah') {
    const count = await env.DB.prepare(`
      SELECT COUNT(*) AS n FROM perlawanan WHERE user_id=? AND status_pp='Disahkan'
        AND substr(tarikh,1,4)=?
    `).bind(user.id, matchYear).first<{n: number}>();
    const minimum = Number(settings.min_verified_matches || 20);
    if (Number(count?.n || 0) < minimum) return json({error: true,
      message: `Anda tidak layak memohon. Minimum ${minimum} perlawanan yang disahkan pada tahun ${matchYear} diperlukan untuk sesi ${year}.`,
      verified_count: Number(count?.n || 0)}, 400);
  }
  const waris = ['nama_waris','hubungan_waris','telefon_waris'] as const;
  for (const key of waris) {
    if (!field(input, key)) return json({error: true, message: `Sila lengkapkan maklumat '${key}'.`}, 400);
  }
  const shirt = field(input, 'saiz_baju') || profileValue(profile, 'saiz_baju');
  if (annual.has(type) && !shirt) return json({error: true, message: "Sila lengkapkan maklumat 'saiz_baju'."}, 400);
  for (const key of [...waris, 'saiz_baju']) {
    if (field(input, key).length > 255) return json({error: true, message: `Maklumat '${key}' terlalu panjang.`}, 400);
  }
  const receipt = input.get('resit');
  const picture = input.get('gambar');
  if (annual.has(type) && !(receipt instanceof File)) return json({error: true, message: 'Resit bayaran diperlukan.'}, 400);
  if (annual.has(type) && !(picture instanceof File)) return json({error: true, message: 'Gambar profil diperlukan.'}, 400);
  const receiptInfo = receipt instanceof File ? await fileInfo(receipt, 'resit') : null;
  if (isResponse(receiptInfo)) return receiptInfo;
  const pictureInfo = picture instanceof File ? await fileInfo(picture, 'gambar') : null;
  if (isResponse(pictureInfo)) return pictureInfo;

  // A PP Daerah cannot verify their own application, so it goes straight to Admin.
  // The first reviewer is told: the applicant's PP Daerah, or Admin when there is none.
  const districtReviewers = user.role === 'PP Daerah' ? [] : (await env.DB.prepare(`
    SELECT id,nama_penuh,email FROM users WHERE role='PP Daerah' AND aktif=1
      AND COALESCE(NULLIF(persatuan_id,0),district_id)=?`)
    .bind(Number(profile.persatuan_id ?? 0)).all<{id: number; nama_penuh: string; email: string | null}>()).results;
  const initialWorkflow = user.role === 'PP Daerah' ? 'Menunggu Admin' : 'Menunggu PP Daerah';
  const reviewers = districtReviewers.length ? districtReviewers : (await env.DB.prepare(`
    SELECT id,nama_penuh,email FROM users WHERE role='Admin' AND aktif=1`)
    .all<{id: number; nama_penuh: string; email: string | null}>()).results;
  const reviewerPage = districtReviewers.length ? ppPage[type] : adminPage(type);
  const uploaded: string[] = [];
  const suffix = `${user.id}_${Date.now()}_${crypto.randomUUID()}`;
  const receiptKey = receiptInfo ? `applications/resit_${suffix}.${receiptInfo.ext}` : '';
  const pictureKey = pictureInfo && annual.has(type) ? `applications/gambar_${suffix}.${pictureInfo.ext}` : '';
  try {
    if (receiptInfo) {
      await env.MEDIA.put(receiptKey, receiptInfo.bytes, {httpMetadata: {contentType: receiptInfo.mime}});
      uploaded.push(receiptKey);
    }
    if (pictureInfo && pictureKey) {
      await env.MEDIA.put(pictureKey, pictureInfo.bytes, {httpMetadata: {contentType: pictureInfo.mime}});
      uploaded.push(pictureKey);
    }
    const columns = [
      'user_id','district_id','persatuan_id','tahun_permohonan','jenis_borang',
      'nama_penuh','no_kp','emel','no_telefon','jantina','jenis_pengadil',
      'alamat1','alamat2','poskod','daerah','negeri','status_kerja','jawatan',
      'nama_majikan','alamat_majikan1','alamat_majikan2','poskod_majikan',
      'daerah_majikan','negeri_majikan','nama_waris','hubungan_waris','telefon_waris',
      'url_resit','url_gambar_profil','saiz_baju','payment_amount','mohon_r1',
      'mohon_ujian_kecergasan','status','status_workflow','tarikh_hantar',
    ];
    const fromProfile = (key: string) => profileValue(profile, key);
    const values: Array<string | number | null> = [
      user.id, profile.district_id === null ? null : Number(profile.district_id),
      profile.persatuan_id === null ? null : Number(profile.persatuan_id), year, type,
      fromProfile('nama_penuh'), fromProfile('no_ic'), fromProfile('email'),
      fromProfile('no_telefon'), fromProfile('jantina'), fromProfile('jenis_pengadil'),
      fromProfile('alamat1'), fromProfile('alamat2') || null, fromProfile('poskod'),
      fromProfile('daerah'), fromProfile('negeri'), fromProfile('status_kerja'),
      fromProfile('jawatan') || null, fromProfile('nama_majikan') || null,
      fromProfile('alamat_majikan1') || null, fromProfile('alamat_majikan2') || null,
      fromProfile('poskod_majikan') || null, fromProfile('daerah_majikan') || null,
      fromProfile('negeri_majikan') || null, ...waris.map(key => field(input, key)),
      receiptKey ? `/uploads/${receiptKey}` : null,
      pictureKey ? `/uploads/${pictureKey}` : null, shirt || null,
      fee.toFixed(2), annual.has(type) ? 1 : 0,
      type === 'pengadil_berdaftar' ? 1 : 0,
      'Pending', initialWorkflow,
    ];
    const insert = env.DB.prepare(`INSERT INTO permohonan(${columns.join(',')})
      VALUES(${values.map(() => '?').join(',')},datetime('now','+8 hours'))`).bind(...values);
    const statements = [insert];
    if (pictureKey) statements.push(env.DB.prepare(`
      UPDATE users SET url_gambar_profil=? WHERE id=?
    `).bind(`/uploads/${pictureKey}`, user.id));
    statements.push(env.DB.prepare(`
      UPDATE perlawanan SET permohonan_id=(
        SELECT id FROM permohonan WHERE user_id=? AND jenis_borang=? AND tahun_permohonan=?
      ) WHERE user_id=? AND status_pp='Disahkan' AND substr(tarikh,1,4)=?
        AND (permohonan_id IS NULL OR permohonan_id=0)
    `).bind(user.id, type, year, user.id, matchYear));
    const reviewMessage = `Permohonan ${formLabel[type]} ${year} daripada ${fromProfile('nama_penuh')} (${fromProfile('jenis_pengadil') || '-'}) menunggu semakan anda.`;
    for (const reviewer of reviewers) {
      statements.push(env.DB.prepare(`INSERT INTO notifications(user_id,type,subject,message,created_at)
        VALUES(?,'Permohonan Baru','Permohonan Baharu Menunggu Semakan',?,datetime('now','+8 hours'))`)
        .bind(reviewer.id, reviewMessage));
    }
    const results = await env.DB.batch(statements);
    const linkedMatches = Number(results[pictureKey ? 2 : 1]?.meta.changes || 0);
    const saved = await env.DB.prepare(`
      SELECT id FROM permohonan WHERE user_id=? AND jenis_borang=? AND tahun_permohonan=?
    `).bind(user.id, type, year).first<{id: number}>();
    if (!saved) throw new Error('Application insert was not visible after transaction');
    const applicationId = Number(saved.id);

    await Promise.allSettled(reviewers.filter((reviewer) => reviewer.email).map(async (reviewer) => {
      const {html, text} = buildRefpahangEmail('Permohonan Baharu Menunggu Semakan', reviewer.nama_penuh,
        [reviewMessage, `No. Rujukan: REF-${String(applicationId).padStart(6, '0')}. Sesi: ${year}.`],
        {label: 'Semak Permohonan', url: new URL(reviewerPage, env.BASE_URL).toString()});
      try {
        await sendRefpahangEmail(env, 'daftar', reviewer.email!, reviewer.nama_penuh,
          `Permohonan Baharu Menunggu Semakan: ${fromProfile('nama_penuh')} - PBNP`, html, text);
      } catch {
        console.error('Reviewer email for a new application could not be sent');
      }
    }));
    let emailSent = false;
    try {
      const attachments: MailAttachment[] = [];
      if (annual.has(type) || type === 'kelas3_fam') {
        const pdfUrl = new URL('/api/download-borang-pendaftaran.php', request.url);
        pdfUrl.searchParams.set('type', type);
        pdfUrl.searchParams.set('application_id', String(applicationId));
        const pdf = await registrationPdf(new Request(pdfUrl, {
          headers: {Cookie: request.headers.get('Cookie') || ''},
        }), env);
        if (!pdf.ok || !pdf.headers.get('Content-Type')?.includes('application/pdf')) {
          throw new Error('Registration PDF unavailable');
        }
        attachments.push({filename: type === 'penilai_berdaftar'
          ? `Borang_Pendaftaran_RA_R1_${applicationId}.pdf`
          : type === 'kelas3_fam' ? `Borang_Perakuan_Kesihatan_R4_${applicationId}.pdf`
            : `Borang_Pendaftaran_R1_R2_R4_${applicationId}.pdf`,
        type: 'application/pdf', content: await pdf.arrayBuffer(), disposition: 'attachment'});
      }
      const title = type === 'kelas3_fam' ? 'Permohonan Kelas III FAM Berjaya Dihantar'
        : type === 'penilai_berdaftar' ? 'Permohonan Pendaftaran Tahunan Penilai Pengadil Berjaya Dihantar'
          : 'Permohonan Pendaftaran Pengadil Berjaya Dihantar';
      const paragraphs = [
        `Permohonan anda telah diterima. No. Rujukan: REF-${String(applicationId).padStart(6,'0')}.`,
        `Jenis Pengadil: ${fromProfile('jenis_pengadil') || '-'}. Sesi: ${year}. Yuran permohonan: RM ${fee.toFixed(2)}.`,
        `Status: ${initialWorkflow === 'Menunggu Admin' ? 'Menunggu Kelulusan Admin' : 'Menunggu Semakan PP Daerah'}. Semak status di dashboard anda.`,
        ...(type === 'pengadil_berdaftar' ? [
          'Salinan R1, R2 dan R4 dilampirkan. Cetak dan tandatangani perakuan kesihatan R4 sebelum ujian kecergasan.',
          'Kehadiran seminar dan keputusan ujian kecergasan direkod secara berasingan. Kelulusan permohonan menjadikan anda Pengadil Berdaftar; ujian kecergasan sahaja menentukan kelayakan patch dan lesen Pengadil Negeri.',
        ] : type === 'penilai_berdaftar' ? [
          'Salinan R1 Pendaftaran Tahunan Penilai Pengadil dilampirkan untuk simpanan dan tandatangan anda.',
        ] : type === 'kelas3_fam' ? [
          'Borang R4 perakuan kesihatan dilampirkan. Cetak dan tandatangan sebelum ujian kecergasan.',
        ] : []),
      ];
      const dashboard = type === 'penilai_berdaftar' ? user.role === 'Admin' ? '/admin/daftar/ra'
        : user.role === 'PP Daerah' ? '/pp-daerah/daftar/tahunan' : '/penilai/permohonan/tahunan'
        : '/pengadil';
      const {html,text} = buildRefpahangEmail(title, fromProfile('nama_penuh'), paragraphs,
        {label: 'Semak Status Permohonan', url: new URL(dashboard, env.BASE_URL).toString()});
      await sendRefpahangEmail(env, 'daftar', fromProfile('email'), fromProfile('nama_penuh'),
        `${title} - PBNP`, html, text, attachments);
      emailSent = true;
    } catch {
      console.error('Application copy email or PDF attachment could not be sent');
    }
    return json({error: false, message: 'Permohonan berjaya dihantar!',
      application_id: applicationId, linked_matches: linkedMatches, email_sent: emailSent,
      email_message: emailSent ? 'Salinan dihantar melalui emel.'
        : 'Emel salinan belum berjaya dihantar; borang boleh dimuat turun dari dashboard.'});
  } catch (error) {
    await Promise.allSettled(uploaded.map(key => env.MEDIA.delete(key)));
    const duplicate = await env.DB.prepare(`
      SELECT 1 FROM permohonan WHERE user_id=? AND jenis_borang=? AND tahun_permohonan=? LIMIT 1
    `).bind(user.id, type, year).first();
    if (duplicate) return json({error: true, message:
      `Anda sudah mempunyai permohonan untuk tahun ${year}. Sila semak sejarah permohonan anda.`}, 400);
    throw error;
  }
}
