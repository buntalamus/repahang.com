import { currentUser, json } from './auth';
import { recordAppointmentReply } from './appointment-response-core';
import { boundedJson } from './request';
import type { Env } from './types';

function positiveId(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (!/^[1-9]\d*$/.test(String(value))) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

/** Portal answer. Email and Telegram callbacks use the same guarded core later. */
export async function appointmentReply(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ error: true, message: 'Kaedah tidak dibenarkan.' }, 405);
  }
  if (env.STAGING_AUTH_ENABLED !== '1' || env.STAGING_WRITES_ENABLED !== '1' ||
      env.APPOINTMENT_DELIVERY_ENABLED !== '1') {
    return json({ error: true, message: 'Jawapan lantikan belum tersedia di staging.' }, 503);
  }
  const actor = await currentUser(request, env);
  if (!actor) return json({ error: true, message: 'Sila log masuk.' }, 401);
  if (!['Pengadil','Penilai','PP Daerah'].includes(actor.role)) {
    return json({ error: true, message: 'Akses ditolak.' }, 403);
  }
  const input = await boundedJson(request);
  if (input instanceof Response) return input;
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return json({ error: true, message: 'Parameter tidak sah.' }, 400);
  }
  const body = input as Record<string,unknown>;
  const id = positiveId(body.lantikan_id);
  const action = body.action;
  const comment = typeof body.komen === 'string' ? body.komen.trim() : '';
  if (!id || (action !== 'accept' && action !== 'reject') ||
      (body.komen != null && typeof body.komen !== 'string') || comment.length > 2000) {
    return json({ error: true, message: 'lantikan_id dan action (accept/reject) diperlukan.' }, 400);
  }
  if (action === 'reject' && !comment) {
    return json({ error: true, message: 'Sila berikan sebab penolakan.' }, 400);
  }
  const result = await recordAppointmentReply(env,id,action,comment,
    { kind: 'user', value: actor.id },actor.id);
  if (result.kind === 'not_found') {
    return json({ error: true, message: 'Lantikan tidak dijumpai atau bukan milik anda.' }, 404);
  }
  if (result.kind === 'already_answered') {
    return json({ error: true, message: 'Lantikan ini sudah dijawab.' }, 409);
  }
  if (result.kind === 'expired') {
    return json({ error: true,
      message: 'Tempoh menjawab telah tamat. Lantikan ini telah ditolak secara automatik.' }, 400);
  }
  return json({ error: false, status: result.status,
    message: action === 'accept'
      ? 'Tugasan berjaya diterima. Sila bawa kelengkapan penuh pengadil.'
      : 'Tugasan berjaya ditolak.' });
}
