import {originalEmail} from './original-templates';
import { sendRefpahangEmail } from '../mail';
import { currentUser, json } from './auth';
import { boundedJson } from './request';
import type { Env } from './types';
import { wroteRow } from './d1-changes';

interface Application {
  id: number;
  user_id: number | null;
  nama_penuh: string;
  emel: string;
  user_email: string | null;
  jenis_borang: string;
  jenis_pengadil: string | null;
  tahun_permohonan: number | null;
}

export async function adminApprove(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return json({ error: true, message: 'Method not allowed' }, 405);
  const actor = await currentUser(request, env);
  if (!actor) return json({ error: true, message: 'Sesi tidak sah. Sila log masuk semula.' }, 401);
  if (actor.role !== 'Admin') return json({ error: true, message: 'Akses ditolak. Hanya admin boleh mengakses.' }, 403);
  if (env.STAGING_WRITES_ENABLED !== '1') {
    return json({ error: true, message: 'Tindakan tulis belum tersedia di staging.' }, 503);
  }
  const input = await boundedJson(request, 8192);
  if (input instanceof Response) return input;
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return json({ error: true, message: 'Parameter tidak sah.' }, 400);
  }
  const body = input as Record<string, unknown>;
  const id = Number(body.permohonan_id);
  const action = body.action;
  const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
  if (!Number.isSafeInteger(id) || id < 1 || !['approve', 'reject'].includes(String(action)) ||
      (body.notes !== undefined && typeof body.notes !== 'string') || notes.length > 2000) {
    return json({ error: true, message: 'Parameter tidak sah.' }, 400);
  }
  if (action === 'reject' && !notes) {
    return json({ error: true, message: 'Sebab penolakan diperlukan.' }, 400);
  }
  const application = await env.DB.prepare(`
    SELECT p.*,u.email AS user_email,u.role AS user_role
    FROM permohonan p LEFT JOIN users u ON u.id=p.user_id
    WHERE p.id=? AND p.status_workflow='Menunggu Admin' LIMIT 1
  `).bind(id).first<Application>();
  if (!application) {
    return json({ error: true, message: 'Permohonan tidak dijumpai atau sudah diproses.' }, 404);
  }
  const refereeType = (application.jenis_pengadil ?? '').trim().toUpperCase();
  const isRa = application.jenis_borang === 'penilai_berdaftar' ||
    (application.jenis_borang === 'pengadil_berdaftar' && refereeType === 'PENILAI PENGADIL');
  const fitness = action === 'approve' && application.jenis_borang === 'pengadil_berdaftar' &&
    Number(application.tahun_permohonan) >= 2027 &&
    !['PENILAI PENGADIL', 'PEGAWAI PEMBANGUNAN'].includes(refereeType);
  // Document approval creates annual registration. Fitness decides the year's patch/license.
  const status = action === 'reject' ? 'Rejected' : 'Approved';
  const workflow = action === 'reject' ? 'Ditolak' : fitness ? 'Admin Diluluskan' : 'Lengkap';
  const classOne = application.jenis_borang === 'ujian_kelas1_fam';
  const subject = action === 'reject' ? 'Permohonan Pendaftaran Ditolak'
    : fitness ? 'Dokumen Diluluskan - Menunggu Ujian Kecergasan'
      : isRa ? 'Pendaftaran Penilai Pengadil Diluluskan' : 'Pendaftaran Pengadil Diluluskan';
  const message = action === 'reject' ? `Permohonan pendaftaran anda telah ditolak. Sebab: ${notes}`
    : fitness ? 'Anda telah didaftarkan untuk sesi ini. Kelayakan patch dan lesen Pengadil Negeri menunggu keputusan ujian kecergasan.'
      : isRa ? 'Pendaftaran tahunan Penilai Pengadil anda telah diluluskan.'
        : 'Permohonan pendaftaran pengadil anda telah diluluskan.';
  const update = env.DB.prepare(`
    UPDATE permohonan SET status=?,status_workflow=?,
      workflow_status=CASE WHEN ? THEN ? ELSE workflow_status END,
      admin_approved_at=datetime('now','+8 hours'),admin_approved_by=?,admin_notes=?,
      final_approved_at=CASE WHEN ? THEN NULL WHEN ? THEN datetime('now','+8 hours') ELSE final_approved_at END,
      status_kemaskini=datetime('now','+8 hours')
    WHERE id=? AND status_workflow='Menunggu Admin'
  `).bind(status, workflow, classOne ? 1 : 0,
    action === 'reject' ? 'Rejected' : 'Approved', actor.id, notes,
    fitness ? 1 : 0, action === 'approve' ? 1 : 0, id);
  const statements = [update];
  if (application.user_id) {
    statements.push(env.DB.prepare(`
      INSERT INTO notifications(user_id,type,subject,message,created_at)
      SELECT ?,?,?,?,datetime('now','+8 hours') WHERE changes()=1
    `).bind(application.user_id,
      action === 'reject' ? 'Permohonan Ditolak' : fitness ? 'Semakan Permohonan' : 'Pendaftaran Lengkap',
      subject, message));
  }
  const results = await env.DB.batch(statements);
  if (!wroteRow(results[0])) {
    return json({ error: true, message: 'Permohonan sudah diproses.' }, 409);
  }
  let emailSent = false;
  const recipient = application.user_email || application.emel;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    try {
      const emailApplication = isRa ? {...application, jenis_borang: 'penilai_berdaftar'} : application;
      const {html,text,subject}=fitness
        ? await originalEmail(env,'annualStage',[application,'documents',notes])
        : await originalEmail(env,action==='reject'?'rejection':'approval',[emailApplication,notes]);
      await sendRefpahangEmail(env,'daftar',recipient,application.nama_penuh,subject,html,text);
      emailSent = true;
    } catch {
      console.error('Application decision email could not be sent');
    }
  }
  return json({ error: false, email_sent: emailSent,
    message: action === 'reject' ? 'Permohonan telah ditolak.'
      : fitness ? 'Dokumen diluluskan; menunggu keputusan ujian kecergasan.'
        : 'Permohonan berjaya diluluskan.' });
}
