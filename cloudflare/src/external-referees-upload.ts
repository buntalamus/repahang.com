import { currentUser, json } from './auth';
import { gradeAliases, grades, normalize, stateAliases, states } from './external-referees';
import { boundedJson } from './request';
import type { Env } from './types';

interface Registered {
  id: number;
  nama_penuh: string;
  no_telefon: string | null;
  email: string | null;
  daerah: string | null;
  negeri: string | null;
  jenis_pengadil: string | null;
}

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function digits(value: string): string {
  return value.replace(/\D/g, '');
}

/** Admin Excel import with the PHP priority: phone, email, then full name. */
export async function externalRefereesUpload(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return json({ error: true, message: 'Kaedah tidak disokong.' }, 405);
  const user = await currentUser(request, env);
  if (!user) return json({ error: true, message: 'Sila log masuk.' }, 401);
  if (user.role !== 'Admin') return json({ error: true, message: 'Akses ditolak.' }, 403);
  if (env.STAGING_WRITES_ENABLED !== '1') {
    return json({ error: true, message: 'Tindakan tulis belum tersedia di staging.' }, 503);
  }
  const payload = await boundedJson(request, 512 * 1024);
  if (payload instanceof Response) return payload;
  const input = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? payload as Record<string, unknown> : {};
  if (!Array.isArray(input.data) || input.data.length === 0) {
    return json({ error: true, message: 'Tiada data untuk dimuat naik.' }, 400);
  }
  if (input.data.length > 500) {
    return json({ error: true, message: 'Maksimum 500 rekod sekali muat naik.' }, 400);
  }
  const registered = await env.DB.prepare(`
    SELECT id,nama_penuh,no_telefon,email,daerah,negeri,jenis_pengadil
    FROM users WHERE aktif=1 AND (
      role IN ('Pengadil','Penilai','PP Daerah')
      OR jenis_pengadil IN ('Penilai Pengadil','Pegawai Pembangunan'))
    ORDER BY id
  `).all<Registered>();
  const byPhone = new Map<string, Registered>();
  const byEmail = new Map<string, Registered>();
  const byName = new Map<string, Registered>();
  for (const record of registered.results) {
    const phone = digits(record.no_telefon ?? '');
    if (phone) byPhone.set(phone, record);
    const email = text(record.email).toLowerCase();
    if (email) byEmail.set(email, record);
    const name = text(record.nama_penuh).toLowerCase();
    if (name) byName.set(name, record);
  }

  const statements: D1PreparedStatement[] = [];
  const matched: Record<string, unknown>[] = [];
  const errors: string[] = [];
  for (const [index, raw] of input.data.entries()) {
    const line = index + 1;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      errors.push(`Baris ${line}: Data pengadil luar tidak sah.`);
      continue;
    }
    const item = raw as Record<string, unknown>;
    const nama = text(item.nama);
    const daerah = text(item.daerah);
    const rawState = text(item.negeri);
    const noTel = text(item.no_tel);
    const emel = text(item.emel);
    const rawGrade = text(item.jenis_pengadil) || 'Pengadil Negeri';
    if (!nama || !daerah || !rawState) {
      errors.push(`Baris ${line}: Nama, daerah dan negeri diperlukan.`);
      continue;
    }
    const negeri = normalize(rawState, states, stateAliases);
    if (!negeri) {
      errors.push(`Baris ${line}: Negeri '${rawState.slice(0, 30)}' tidak sah.`);
      continue;
    }
    const jenis = normalize(rawGrade, grades, gradeAliases);
    if (!jenis) {
      errors.push(`Baris ${line}: Jenis pengadil '${rawGrade.slice(0, 30)}' tidak sah.`);
      continue;
    }
    if (emel && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emel) || emel.length > 254)) {
      errors.push(`Baris ${line}: Emel '${emel.slice(0, 40)}' tidak sah.`);
      continue;
    }
    if (nama.length > 255 || daerah.length > 100 || noTel.length > 30) {
      errors.push(`Baris ${line}: Maklumat pengadil luar terlalu panjang.`);
      continue;
    }
    const phoneMatch = digits(noTel);
    let registeredMatch: Registered | undefined;
    let matchBy = '';
    if (phoneMatch && byPhone.has(phoneMatch)) {
      registeredMatch = byPhone.get(phoneMatch);
      matchBy = 'no_telefon';
    } else if (emel && byEmail.has(emel.toLowerCase())) {
      registeredMatch = byEmail.get(emel.toLowerCase());
      matchBy = 'emel';
    } else if (byName.has(nama.toLowerCase())) {
      registeredMatch = byName.get(nama.toLowerCase());
      matchBy = 'nama';
    }
    if (registeredMatch) {
      matched.push({ baris: line, upload_nama: nama, match_by: matchBy,
        pengadil_id: registeredMatch.id, nama_penuh: registeredMatch.nama_penuh,
        daerah: registeredMatch.daerah ?? '', negeri: registeredMatch.negeri ?? 'Pahang',
        no_telefon: registeredMatch.no_telefon ?? '', email: registeredMatch.email ?? '',
        jenis_pengadil: registeredMatch.jenis_pengadil ?? '' });
      continue;
    }
    statements.push(env.DB.prepare(`
      INSERT INTO pengadil_luar (nama,daerah,negeri,no_tel,emel,jenis_pengadil)
      VALUES(?,?,?,?,?,?)
    `).bind(nama, daerah, negeri, noTel, emel, jenis));
  }
  if (statements.length) {
    try {
      await env.DB.batch(statements);
    } catch (error) {
      console.error('External referee upload transaction failed', error);
      return json({ error: true, message: 'Muat naik gagal. Tiada pengadil luar ditambah.' }, 409);
    }
  }
  const inserted = statements.length;
  const skipped = matched.length + errors.length;
  let message = `${inserted} pengadil luar berjaya ditambah.`;
  if (matched.length) message += ` ${matched.length} pengadil sudah berdaftar dalam sistem.`;
  if (errors.length) message += ` ${errors.length} baris dilangkau.`;
  return json({ error: false, message, inserted, skipped, matched, errors: errors.slice(0, 20) });
}
