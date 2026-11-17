import { currentUser, json, type SessionUser } from './auth';
import { boundedFormData, boundedJson } from './request';
import type { Env } from './types';
import { teamPair } from './match-conflicts';
import { activeAdmins, contactRecipient, enqueueNoticeStatements, userContact, type ContactRow, type Notice } from './notify';

const STATES = ['Johor','Kedah','Kelantan','Melaka','Negeri Sembilan','Perak','Perlis','Pulau Pinang',
  'Sabah','Sarawak','Selangor','Terengganu','W.P. Kuala Lumpur','W.P. Labuan','W.P. Putrajaya'];
const POSITIONS = ['Pengadil','Penolong Pengadil 1','Penolong Pengadil 2','Pengadil Ke-4'];
type OriginRequest = {
  id: number; user_id: number; origin_state: string; transfer_date: string; date_from: string; date_to: string;
  status: string; expires_on: string | null; revision: number; proof_key: string; proof_name: string;
  proof_type: string; verifier_name: string; last_operation: string | null;
};
type RecordRow = { id: number; tarikh: string; home_team: string; away_team: string };
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur',
  year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const text = (v: unknown, max = 255) => typeof v === 'string' && v.trim().length <= max ? v.trim() : '';
function id(v: unknown): number | null {
  return (typeof v === 'number' || typeof v === 'string') && /^[1-9]\d*$/.test(String(v))
    && Number.isSafeInteger(Number(v)) ? Number(v) : null;
}
function date(v: unknown): v is string {
  return typeof v === 'string' && /^(19|20|21)\d{2}-\d{2}-\d{2}$/.test(v)
    && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v;
}
const fail = (message: string, status = 422) => json({ error: true, message }, status);
const stale = () => fail('Rekod atau akses telah berubah. Muat semula sebelum meneruskan.', 409);
const active = (row: OriginRequest) => row.status === 'open' && !!row.expires_on && row.expires_on >= today();
const visible = (user: SessionUser, row: OriginRequest) => user.role === 'Admin' || row.user_id === user.id;

async function find(env: Env, requestId: number): Promise<OriginRequest | null> {
  return env.DB.prepare('SELECT * FROM referee_origin_requests WHERE id=?').bind(requestId).first<OriginRequest>();
}

async function list(request: Request, env: Env, user: SessionUser): Promise<Response> {
  const query = new URL(request.url).searchParams;
  const requestId = id(query.get('id'));
  if (query.has('id')) {
    if (!requestId) return fail('ID permohonan tidak sah.');
    const row = await find(env, requestId);
    if (!row || !visible(user, row)) return fail('Permohonan tidak dijumpai.', 404);
    if (query.get('action') === 'proof') {
      const object = await env.MEDIA.get(row.proof_key);
      if (!object) return fail('Dokumen tidak dijumpai.', 404);
      return new Response(object.body, { headers: { 'Content-Type': row.proof_type,
        'Content-Disposition': `attachment; filename="bukti-negeri-asal-${row.id}.${row.proof_type === 'application/pdf' ? 'pdf' : row.proof_type === 'image/png' ? 'png' : 'jpg'}"`,
        'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
    }
    const [detail, records] = await Promise.all([
      env.DB.prepare(`SELECT r.*,u.nama_penuh AS referee_name,g.nama_penuh AS granted_by_name,
        a.nama_penuh AS reviewed_by_name FROM referee_origin_requests r JOIN users u ON u.id=r.user_id
        LEFT JOIN users g ON g.id=r.granted_by LEFT JOIN users a ON a.id=r.reviewed_by WHERE r.id=?`)
        .bind(requestId).first<Record<string, unknown>>(),
      env.DB.prepare('SELECT * FROM referee_origin_records WHERE request_id=? ORDER BY tarikh,id').bind(requestId).all(),
    ]);
    delete detail!.proof_key;
    delete detail!.last_operation;
    return json({ error: false, request: { ...detail, access_active: active(row) }, records: records.results });
  }
  const page = Math.min(100000, id(query.get('page')) ?? 1);
  const status = query.get('status') ?? '';
  if (status && !['requested','open','submitted','accepted','rejected','revoked'].includes(status)) return fail('Status tidak sah.');
  const where = `${user.role === 'Admin' ? '1=1' : 'r.user_id=?'}${status ? ' AND r.status=?' : ''}`;
  const values = [...(user.role === 'Admin' ? [] : [user.id]), ...(status ? [status] : [])];
  const [rows, count] = await Promise.all([
    env.DB.prepare(`SELECT r.id,r.user_id,u.nama_penuh AS referee_name,r.origin_state,r.transfer_date,r.date_from,
      r.date_to,r.status,r.expires_on,r.revision,r.created_at,r.review_notes,
      (SELECT COUNT(*) FROM referee_origin_records rec WHERE rec.request_id=r.id) AS record_count
      FROM referee_origin_requests r JOIN users u ON u.id=r.user_id WHERE ${where}
      ORDER BY r.id DESC LIMIT 20 OFFSET ?`).bind(...values, (page-1)*20).all(),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM referee_origin_requests r WHERE ${where}`).bind(...values).first<{n:number}>(),
  ]);
  return json({ error: false, requests: rows.results, states: STATES, positions: POSITIONS,
    today: today(), pagination: { page, total_pages: Math.ceil(Number(count?.n ?? 0)/20), total_items: count?.n ?? 0 } });
}

async function proofFile(form: FormData): Promise<{ bytes: ArrayBuffer; type: string; name: string } | Response> {
  const file = form.get('proof');
  if (!file || typeof file === 'string' || !file.size || file.size > 5*1024*1024) {
    return fail('Lampirkan buku log atau pengesahan PP negeri asal (PDF/JPG/PNG, maksimum 5 MB).');
  }
  const bytes = await file.arrayBuffer();
  const head = new Uint8Array(bytes.slice(0,8));
  const type = new TextDecoder().decode(head.slice(0,5)) === '%PDF-' ? 'application/pdf'
    : head[0] === 255 && head[1] === 216 && head[2] === 255 ? 'image/jpeg'
      : [137,80,78,71,13,10,26,10].every((n,i) => head[i] === n) ? 'image/png' : '';
  if (!type) return fail('Format dokumen tidak sah. Gunakan PDF, JPG atau PNG.');
  return { bytes, type, name: file.name.replace(/[\x00-\x1f]/g,'').slice(0,180) || 'Dokumen sokongan' };
}

async function upload(request: Request, env: Env, user: SessionUser): Promise<Response> {
  if (Number(user.can_referee) !== 1) return fail('Hanya pengadil boleh menghantar rekod sendiri.', 403);
  const form = await boundedFormData(request, 5*1024*1024 + 64*1024);
  if (form instanceof Response) return form;
  const action = form.get('action');
  if (!['request','replace_proof'].includes(String(action))) return fail('Tindakan tidak sah.');
  const proof = await proofFile(form);
  if (proof instanceof Response) return proof;
  let row: OriginRequest | null = null;
  const originState = text(form.get('origin_state'));
  const transfer = form.get('transfer_date');
  const from = form.get('date_from');
  const until = form.get('date_to');
  const verifier = text(form.get('verifier_name'));
  const notes = text(form.get('notes'), 1000);
  if (action === 'request') {
    if (!STATES.includes(originState) || !date(transfer) || transfer > today() || !date(from)
      || !date(until) || from > until || until >= transfer || !verifier) {
      return fail('Lengkapkan negeri asal, nama PP pengesah dan julat tarikh sebelum tarikh perpindahan.');
    }
  } else {
    row = await find(env, id(form.get('id')) ?? 0);
    if (!row || row.user_id !== user.id) return fail('Permohonan tidak dijumpai.', 404);
    if (Number(form.get('revision')) !== row.revision || !['requested','open'].includes(row.status)
      || (row.status === 'open' && !active(row))) return stale();
  }
  // Outside /uploads: this key can only be read through the owner/Admin endpoint.
  const key = `origin-records/${user.id}/${crypto.randomUUID()}`;
  await env.MEDIA.put(key, proof.bytes, { httpMetadata: { contentType: proof.type } });
  const operation = crypto.randomUUID();
  try {
    let response: D1Result[];
    if (row) {
      response = await env.DB.batch([
        env.DB.prepare(`UPDATE referee_origin_requests SET proof_key=?,proof_name=?,proof_type=?,revision=revision+1,
          last_operation=?,updated_at=datetime('now','+8 hours') WHERE id=? AND revision=?
          AND (status='requested' OR (status='open' AND expires_on>=?))`)
          .bind(key,proof.name,proof.type,operation,row.id,row.revision,today()),
        audit(env,user.id,'replace_proof',row.id,operation),
      ]);
      if (!response[0].meta.changes) { await env.MEDIA.delete(key); return stale(); }
    } else {
      const contacts = await activeAdmins(env);
      response = await env.DB.batch([
        env.DB.prepare(`INSERT INTO referee_origin_requests(user_id,origin_state,transfer_date,date_from,date_to,
          verifier_name,notes,proof_key,proof_name,proof_type,last_operation) VALUES(?,?,?,?,?,?,?,?,?,?,?)`)
          .bind(user.id,originState,transfer as string,from as string,until as string,verifier,notes,key,proof.name,proof.type,operation),
        env.DB.prepare(`INSERT INTO activity_log(user_id,action,table_name,record_id,description,created_at)
          SELECT ?,'origin_request','referee_origin_requests',id,'Permohonan akses rekod negeri asal',datetime('now','+8 hours')
          FROM referee_origin_requests WHERE last_operation=?`).bind(user.id,operation),
        ...notices(env,contacts,operation,'Permohonan akses rekod negeri asal',
          `${user.nama_penuh} memohon akses membawa masuk rekod ${originState}. Semak dokumen sebelum membuka akses.`,
          true,'EXISTS(SELECT 1 FROM referee_origin_requests WHERE last_operation=?)',[operation]),
      ]);
    }
  } catch (error) {
    await env.MEDIA.delete(key);
    if (String(error).includes('UNIQUE')) return fail('Anda masih mempunyai permohonan akses yang belum selesai.',409);
    throw error;
  }
  // Replacement is allowed only before submission; accepted evidence is immutable.
  if (row) await env.MEDIA.delete(row.proof_key).catch(() => console.warn('Superseded origin proof cleanup pending.'));
  return json({ error: false, message: row ? 'Dokumen sokongan dikemas kini.' : 'Permohonan akses dihantar kepada Admin.' });
}

function audit(env: Env, actor: number, action: string, requestId: number, operation: string): D1PreparedStatement {
  return env.DB.prepare(`INSERT INTO activity_log(user_id,action,table_name,record_id,description,created_at)
    SELECT ?,?,'referee_origin_requests',id,json_object('negeri',origin_state,'status',status,'catatan',review_notes,
      'date_from',date_from,'date_to',date_to,'expires_on',expires_on,'proof_name',proof_name,'revision',revision),
    datetime('now','+8 hours') FROM referee_origin_requests WHERE id=? AND last_operation=?`)
    .bind(actor,`origin_${action}`,requestId,operation);
}

function notices(env: Env, contacts: ContactRow[], operation: string, subject: string, message: string,
  forAdmin: boolean, guardSql: string, guardBinds: unknown[]): D1PreparedStatement[] {
  const notice: Notice = { subject, title: subject, mailType: 'pengesahan', email: 'always',
    paragraphs: [message], actions: [{ label: 'Semak Rekod Negeri Asal',
      url: `${env.BASE_URL.replace(/\/$/,'')}/${forAdmin ? 'admin' : 'pengadil'}/rekod-negeri-asal` }],
    portal: { type: 'Rekod Negeri Asal', subject, message } };
  return contacts.flatMap(contact => enqueueNoticeStatements(env,`origin:${operation}:${contact.id}`,
    contactRecipient(contact),notice,{kind:'origin_records',guardSql,guardBinds}));
}

async function mutate(request: Request, env: Env, user: SessionUser): Promise<Response> {
  const body = await boundedJson(request, 8192);
  if (body instanceof Response) return body;
  const input = body as Record<string,unknown>;
  const requestId = id(input.id);
  if (!requestId) return fail('ID permohonan tidak sah.');
  const row = await find(env,requestId);
  if (!row || !visible(user,row)) return fail('Permohonan tidak dijumpai.',404);
  const action = text(input.action);
  const adminAction = ['grant','reject','revoke','accept'].includes(action);
  // PP may submit their own history if they referee, but never review anyone's.
  if (adminAction && user.role !== 'Admin') return fail('Hanya Admin boleh meluluskan akses atau rekod negeri asal.',403);
  if (!adminAction && (row.user_id !== user.id || Number(user.can_referee) !== 1)) return fail('Akses ditolak.',403);
  if (!Number.isInteger(input.revision) || input.revision !== row.revision) return stale();
  if (row.status === 'accepted') return fail('Rekod yang diterima telah dikunci.',409);
  const operation = crypto.randomUUID();
  const note = text(input.notes,1000);
  let assignments = 'revision=revision+1,last_operation=?,updated_at=datetime(\'now\',\'+8 hours\')';
  const values: (string|number|null)[] = [operation];
  let condition = '';
  const extra: D1PreparedStatement[] = [];
  let message = '';
  if (action === 'grant') {
    const from = input.date_from; const until = input.date_to; const expires = input.expires_on;
    if (!['requested','open','rejected','revoked'].includes(row.status)) return stale();
    if (!date(from) || !date(until) || from>until || until>=row.transfer_date || !date(expires)
      || expires<today() || Date.parse(expires)-Date.parse(today())>90*86400000) {
      return fail('Tetapkan julat sebelum perpindahan dan tarikh tamat akses dalam 90 hari akan datang.');
    }
    const outside = await env.DB.prepare('SELECT 1 FROM referee_origin_records WHERE request_id=? AND (tarikh<? OR tarikh>?) LIMIT 1')
      .bind(row.id,from,until).first();
    if (outside) return fail('Julat tarikh mesti meliputi semua rekod yang sudah diisi.');
    assignments += ",status='open',date_from=?,date_to=?,expires_on=?,granted_by=?,granted_at=datetime('now','+8 hours'),review_notes=?";
    values.push(from,until,expires,user.id,note);
    message = 'Akses khas dibuka. Pengadil boleh mengisi rekod dan menghantarnya kepada Admin.';
  } else if (action === 'reject' || action === 'revoke') {
    if (!note) return fail('Sebab penolakan atau penutupan akses wajib diisi.');
    if (action === 'reject' && !['requested','submitted'].includes(row.status)) return stale();
    if (action === 'revoke' && row.status !== 'open') return stale();
    assignments += ",status=?,review_notes=?,reviewed_by=?,reviewed_at=datetime('now','+8 hours')";
    values.push(action === 'reject' ? 'rejected' : 'revoked',note,user.id);
    message = action === 'reject' ? 'Permohonan atau senarai rekod ditolak oleh Admin.' : 'Akses khas ditutup oleh Admin.';
  } else if (action === 'add_record') {
    if (!active(row)) return fail('Akses khas belum dibuka, telah tamat atau telah ditutup.',409);
    const day = input.tarikh;
    const home = text(input.home_team); const away = text(input.away_team);
    const kind = text(input.jenis,60); const tournament = text(input.nama_kejohanan);
    const venue = text(input.tempat); const position = text(input.jawatan,80); const time = text(input.masa,5);
    if (!date(day) || day<row.date_from || day>row.date_to || day>=row.transfer_date || day>today()
      || !home || !away || home.toLowerCase()===away.toLowerCase() || !kind || !tournament || !venue
      || !POSITIONS.includes(position) || (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) {
      return fail('Lengkapkan butiran perlawanan dalam julat akses yang diluluskan.');
    }
    const duplicate = await duplicateMatch(env,row.user_id,day,home,away);
    if (duplicate) return fail('Perlawanan ini sudah ada dalam rekod anda.',409);
    condition = " AND status='open' AND expires_on>=? AND (SELECT COUNT(*) FROM referee_origin_records WHERE request_id=?)<500";
    const key = JSON.stringify([day,teamPair(home,away)]);
    extra.push(env.DB.prepare(`INSERT INTO referee_origin_records(request_id,tarikh,masa,jenis,nama_kejohanan,tempat,home_team,away_team,jawatan,record_key)
      SELECT id,?,?,?,?,?,?,?,?,? FROM referee_origin_requests WHERE id=? AND last_operation=?`)
      .bind(day,time||null,kind,tournament,venue,home,away,position,key,row.id,operation));
    message = 'Rekod ditambah. Hantar senarai kepada Admin selepas lengkap.';
  } else if (action === 'delete_record') {
    if (!active(row) || !id(input.record_id)) return fail('Rekod tidak boleh dipadam atau akses telah tamat.',409);
    condition = " AND status='open' AND expires_on>=?";
    extra.push(env.DB.prepare(`DELETE FROM referee_origin_records WHERE id=? AND request_id=? AND EXISTS(
      SELECT 1 FROM referee_origin_requests WHERE id=? AND last_operation=?)`)
      .bind(id(input.record_id),row.id,row.id,operation));
    message = 'Rekod draf dipadam.';
  } else if (action === 'submit' || action === 'accept') {
    if (action === 'submit' && !active(row)) return fail('Akses khas telah tamat atau senarai telah dihantar.',409);
    if (action === 'accept' && row.status !== 'submitted') return stale();
    const records = await env.DB.prepare('SELECT id,tarikh,home_team,away_team FROM referee_origin_records WHERE request_id=?')
      .bind(row.id).all<RecordRow>();
    if (!records.results.length) return fail('Masukkan sekurang-kurangnya satu rekod perlawanan.');
    const existing = await env.DB.prepare("SELECT tarikh,home_team,away_team FROM perlawanan WHERE user_id=? AND tarikh>=? AND tarikh<=? AND COALESCE(status_pp,'')<>'Tidak Disahkan'")
      .bind(row.user_id,row.date_from,row.date_to).all<RecordRow>();
    const existingKeys = new Set(existing.results.map(rec => JSON.stringify([rec.tarikh.slice(0,10),teamPair(rec.home_team,rec.away_team)])));
    for (const rec of records.results) {
      if (rec.tarikh<row.date_from || rec.tarikh>row.date_to || rec.tarikh>=row.transfer_date
        || existingKeys.has(JSON.stringify([rec.tarikh,teamPair(rec.home_team,rec.away_team)]))) {
        return fail(`Semak rekod ${rec.home_team} lwn ${rec.away_team} (${rec.tarikh}): tarikh tidak dibenarkan atau rekod berulang.`,409);
      }
    }
    if (action === 'submit') {
      assignments += ",status='submitted',submitted_at=datetime('now','+8 hours')";
      condition = " AND status='open' AND expires_on>=?";
      message = 'Senarai dihantar. Hanya rekod yang diterima Admin akan dikira untuk kelayakan tahunan.';
    } else {
      if (!note) return fail('Catatan semakan dokumen pengesahan wajib diisi.');
      assignments += ",status='accepted',reviewed_by=?,reviewed_at=datetime('now','+8 hours'),review_notes=?";
      values.push(user.id,note);
      condition = " AND status='submitted'";
      extra.push(env.DB.prepare(`INSERT INTO perlawanan(user_id,submitted_by,tarikh,masa,jenis,nama_kejohanan,tempat,
        home_team,away_team,jawatan,status_pp,verified_by,verified_at,catatan_pp,origin_record_id,created_at)
        SELECT req.user_id,req.user_id,rec.tarikh,rec.masa,rec.jenis,rec.nama_kejohanan,rec.tempat,
          rec.home_team,rec.away_team,rec.jawatan,'Disahkan',?,datetime('now','+8 hours'),?,rec.id,datetime('now','+8 hours')
        FROM referee_origin_records rec JOIN referee_origin_requests req ON req.id=rec.request_id
        WHERE req.id=? AND req.last_operation=? AND req.status='accepted'`)
        .bind(user.id,`PP negeri asal: ${row.verifier_name} (${row.origin_state}). Diterima Admin Pahang: ${note}`,row.id,operation));
      message = 'Rekod diterima dan dikira untuk kelayakan tahunan mengikut tahun perlawanan.';
    }
  } else return fail('Tindakan tidak sah.');
  const conditionValues: (string|number)[] = condition.includes('expires_on>=?') ? [today()] : [];
  if (action === 'add_record') conditionValues.push(row.id);
  const statements = [env.DB.prepare(`UPDATE referee_origin_requests SET ${assignments} WHERE id=? AND revision=?${condition}`)
    .bind(...values,row.id,row.revision,...conditionValues), ...extra,
    audit(env,user.id,action,row.id,operation)];
  if (adminAction) {
    const contact = await userContact(env,row.user_id);
    if (contact) statements.push(...notices(env,[contact],operation,'Keputusan Admin · Rekod Negeri Asal',
      `${message}${note ? ` Catatan: ${note}` : ''}`,false,
      'EXISTS(SELECT 1 FROM referee_origin_requests WHERE id=? AND last_operation=?)',[row.id,operation]));
  } else if (action === 'submit') {
    statements.push(...notices(env,await activeAdmins(env),operation,'Rekod negeri asal menunggu Admin',
      `${user.nama_penuh} menghantar rekod ${row.origin_state}. Semak dokumen dan senarai di Rekod Negeri Asal.`,true,
      'EXISTS(SELECT 1 FROM referee_origin_requests WHERE id=? AND last_operation=?)',[row.id,operation]));
  }
  try {
    const results = await env.DB.batch(statements);
    if (!results[0].meta.changes) return stale();
  } catch (error) {
    if (String(error).includes('referee_origin_requests.user_id')) return fail('Pengadil ini mempunyai permohonan akses lain yang belum selesai.',409);
    if (/UNIQUE|origin_record_duplicate/.test(String(error))) return fail('Perlawanan berulang dikesan. Semak senarai sebelum menghantar semula.',409);
    throw error;
  }
  return json({ error: false, message });
}

async function duplicateMatch(env: Env, userId: number, day: string, home: string, away: string): Promise<boolean> {
  const rows = await env.DB.prepare("SELECT home_team,away_team FROM perlawanan WHERE user_id=? AND substr(tarikh,1,10)=? AND COALESCE(status_pp,'')<>'Tidak Disahkan'")
    .bind(userId,day).all<{home_team:string|null;away_team:string|null}>();
  const pair = teamPair(home,away);
  return rows.results.some(row => teamPair(row.home_team,row.away_team) === pair);
}

/** Shared by portal cookies and native app bearer sessions. No PP review path. */
export async function originRecords(request: Request, env: Env): Promise<Response> {
  if (!['GET','POST'].includes(request.method)) return fail('Kaedah tidak dibenarkan.',405);
  const user = await currentUser(request,env);
  if (!user) return fail('Sesi tidak sah. Sila log masuk semula.',401);
  if (user.role !== 'Admin' && Number(user.can_referee) !== 1) return fail('Akses ditolak.',403);
  if (request.method === 'GET') return list(request,env,user);
  if (env.STAGING_WRITES_ENABLED !== '1') return fail('Tindakan tulis belum tersedia.',503);
  return /^multipart\/form-data\b/i.test(request.headers.get('Content-Type') ?? '')
    ? upload(request,env,user) : mutate(request,env,user);
}
