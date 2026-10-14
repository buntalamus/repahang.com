import { currentUser, json } from './auth';
import { boundedJson } from './request';
import type { Env } from './types';

const editable = [
  'nama_penuh', 'no_ic', 'umur', 'email', 'no_telefon', 'jantina',
  'alamat1', 'alamat2', 'poskod', 'daerah', 'negeri', 'status_kerja',
  'jawatan', 'nama_majikan', 'alamat_majikan1', 'alamat_majikan2',
  'poskod_majikan', 'daerah_majikan', 'negeri_majikan', 'nama_waris',
  'hubungan_waris', 'telefon_waris', 'tahun_mula_aktif', 'saiz_baju',
] as const;
const requiredForMembers = [
  'alamat1', 'poskod', 'daerah', 'negeri', 'status_kerja',
  'nama_waris', 'hubungan_waris', 'telefon_waris',
];

function dimensions(bytes: Uint8Array): { width: number; height: number; mime: string; ext: string } | null {
  const sig = (at: number, values: number[]) => values.every((value, index) => bytes[at + index] === value);
  const big = (at: number) => bytes[at] * 256 + bytes[at + 1];
  if (bytes.length >= 24 && sig(0, [137, 80, 78, 71, 13, 10, 26, 10]) && sig(12, [73, 72, 68, 82])) {
    const view = new DataView(bytes.buffer);
    return { width: view.getUint32(16), height: view.getUint32(20), mime: 'image/png', ext: 'png' };
  }
  if (bytes.length >= 16 && sig(0, [255, 216, 255])) {
    let at = 2;
    while (at + 9 < bytes.length) {
      if (bytes[at] !== 255) return null;
      while (bytes[at] === 255) at++;
      const marker = bytes[at++];
      if (marker === 0xd9 || marker === 0xda) break;
      if (at + 2 > bytes.length) return null;
      const size = big(at);
      if (size < 2 || at + size > bytes.length) return null;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        if (size < 7) return null;
        return { width: big(at + 5), height: big(at + 3), mime: 'image/jpeg', ext: 'jpg' };
      }
      at += size;
    }
  }
  if (bytes.length >= 30 && sig(0, [82, 73, 70, 70]) && sig(8, [87, 69, 66, 80])) {
    const chunk = new TextDecoder().decode(bytes.slice(12, 16));
    if (chunk === 'VP8X') {
      return {
        width: 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16),
        height: 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16),
        mime: 'image/webp', ext: 'webp',
      };
    }
    if (chunk === 'VP8L' && bytes[20] === 0x2f) {
      return {
        width: 1 + bytes[21] + ((bytes[22] & 0x3f) << 8),
        height: 1 + (bytes[22] >> 6) + (bytes[23] << 2) + ((bytes[24] & 0x0f) << 10),
        mime: 'image/webp', ext: 'webp',
      };
    }
    if (chunk === 'VP8 ' && sig(23, [0x9d, 0x01, 0x2a])) {
      return {
        width: (bytes[26] + (bytes[27] << 8)) & 0x3fff,
        height: (bytes[28] + (bytes[29] << 8)) & 0x3fff,
        mime: 'image/webp', ext: 'webp',
      };
    }
  }
  return null;
}

export async function updateProfile(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return json({ error: true, message: 'Kaedah tidak dibenarkan.' }, 405);
  const user = await currentUser(request, env);
  if (!user) return json({ error: true, message: 'Sila log masuk.' }, 401);
  if (env.STAGING_WRITES_ENABLED !== '1') return json({ error: true, message: 'Tindakan tulis belum tersedia di staging.' }, 503);
  const body = await boundedJson(request, 16 * 1024);
  if (body instanceof Response) return body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return json({ error: true, message: 'Data profil tidak sah.' }, 400);
  }
  const input = body as Record<string, unknown>;
  const name = typeof input.nama_penuh === 'string' ? input.nama_penuh.trim() : '';
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  if (!name || name.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return json({ error: true, message: 'Nama penuh dan emel yang sah diperlukan.' }, 400);
  }
  if (user.role !== 'Admin') {
    for (const field of requiredForMembers) {
      if (typeof input[field] !== 'string' || !input[field].trim()) {
        return json({ error: true, message: `Medan '${field}' diperlukan!` }, 400);
      }
    }
  }
  const updates: string[] = [];
  const values: (string | number | null)[] = [];
  for (const key of editable) {
    if (!(key in input)) continue;
    const raw = input[key];
    if (key === 'umur') {
      if (raw !== null && raw !== '' && (typeof raw !== 'number' && typeof raw !== 'string')) {
        return json({ error: true, message: 'Umur tidak sah.' }, 400);
      }
      const age = raw === null || raw === '' ? null : Number(raw);
      if (age !== null && (!Number.isInteger(age) || age < 0 || age > 120)) {
        return json({ error: true, message: 'Umur tidak sah.' }, 400);
      }
      values.push(age);
    } else {
      if (raw !== null && typeof raw !== 'string') return json({ error: true, message: `Medan '${key}' tidak sah.` }, 400);
      const text = typeof raw === 'string' ? raw.trim() : null;
      if (text && text.length > (key.startsWith('alamat') ? 500 : 255)) {
        return json({ error: true, message: `Medan '${key}' terlalu panjang.` }, 400);
      }
      values.push(key === 'email' ? email : key === 'nama_penuh' ? name : text);
    }
    updates.push(`${key}=?`);
  }
  if (user.role === 'Admin' && 'jenis_pengadil' in input) {
    const value = input.jenis_pengadil;
    if (value !== null && (typeof value !== 'string' || value.length > 100)) {
      return json({ error: true, message: 'Jenis pengadil tidak sah.' }, 400);
    }
    updates.push('jenis_pengadil=?');
    values.push(value);
  }
  if (!updates.includes('nama_penuh=?')) { updates.push('nama_penuh=?'); values.push(name); }
  if (!updates.includes('email=?')) { updates.push('email=?'); values.push(email); }
  const duplicate = await env.DB.prepare('SELECT 1 FROM users WHERE lower(email)=? AND id<>? LIMIT 1')
    .bind(email, user.id).first();
  if (duplicate) return json({ error: true, message: 'Emel sudah digunakan oleh akaun lain.' }, 409);
  await env.DB.batch([
    env.DB.prepare(`UPDATE users SET ${updates.join(',')},updated_at=datetime('now','+8 hours') WHERE id=?`)
      .bind(...values, user.id),
    env.DB.prepare(`
      INSERT INTO notifications(user_id,type,subject,message,is_read,created_at)
      VALUES(?,'Profil Dikemaskini','Profil Dikemaskini',
        'Profil anda telah berjaya dikemaskini.',0,datetime('now','+8 hours'))
    `).bind(user.id),
  ]);
  return json({ error: false, message: 'Profil berjaya dikemaskini!' });
}

export async function uploadProfileImage(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return json({ error: true, message: 'Kaedah tidak dibenarkan.' }, 405);
  const user = await currentUser(request, env);
  if (!user) return json({ error: true, message: 'Sila log masuk.' }, 401);
  if (env.STAGING_WRITES_ENABLED !== '1') return json({ error: true, message: 'Tindakan tulis belum tersedia di staging.' }, 503);
  const type = request.headers.get('Content-Type') ?? '';
  if (!type.toLowerCase().startsWith('multipart/form-data;')) return json({ error: true, message: 'Tiada fail dimuat naik.' }, 422);
  if (Number(request.headers.get('Content-Length') ?? 0) > 5_500_000) return json({ error: true, message: 'Saiz fail terlalu besar. Maksimum 5MB.' }, 422);
  const reader = request.body?.getReader();
  if (!reader) return json({ error: true, message: 'Tiada fail dimuat naik.' }, 422);
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 5_500_000) {
      await reader.cancel();
      return json({ error: true, message: 'Saiz fail terlalu besar. Maksimum 5MB.' }, 422);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let data: FormData;
  try {
    data = await new Request(request.url, {
      method: 'POST', headers: { 'Content-Type': type }, body: bytes,
    }).formData();
  } catch {
    return json({ error: true, message: 'Tiada fail dimuat naik.' }, 422);
  }
  const file = data.get('image');
  if (!(file instanceof File)) return json({ error: true, message: 'Tiada fail dimuat naik.' }, 422);
  if (file.size > 5 * 1024 * 1024) return json({ error: true, message: 'Saiz fail terlalu besar. Maksimum 5MB.' }, 422);
  const image = new Uint8Array(await file.arrayBuffer());
  const info = dimensions(image);
  if (!info) return json({ error: true, message: 'Fail bukan imej yang sah.' }, 422);
  if (info.width < 150 || info.height < 150) {
    return json({ error: true, message: 'Resolusi imej terlalu kecil. Minimum 150x150 piksel.' }, 422);
  }
  if (info.width > 4000 || info.height > 4000) {
    return json({ error: true, message: 'Resolusi imej terlalu besar. Maksimum 4000x4000 piksel.' }, 422);
  }
  const key = `profiles/user_${user.id}_${crypto.randomUUID()}.${info.ext}`;
  const path = `/uploads/${key}`;
  await env.MEDIA.put(key, image, { httpMetadata: { contentType: info.mime } });
  try {
    const updated = await env.DB.prepare("UPDATE users SET url_gambar_profil=?,updated_at=datetime('now','+8 hours') WHERE id=?")
      .bind(path, user.id).run();
    if (updated.meta.changes !== 1) throw new Error('User disappeared during image upload');
  } catch (error) {
    await env.MEDIA.delete(key);
    throw error;
  }
  return json({ error: false, message: 'Gambar profil berjaya dimuat naik.', data: {
    url: path, filename: key.slice('profiles/'.length),
  } });
}
