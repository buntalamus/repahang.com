import { compare, hash } from 'bcryptjs';

import { currentUser, json } from './auth';
import { boundedJson } from './request';
import type { Env } from './types';

export async function changePassword(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ error: true, message: 'Kaedah tidak dibenarkan.' }, 405);
  }
  const session = await currentUser(request, env);
  if (!session) return json({ error: true, message: 'Sila log masuk.' }, 401);
  if (env.STAGING_WRITES_ENABLED !== '1') {
    return json({ error: true, message: 'Tindakan tulis belum tersedia di staging.' }, 503);
  }

  const input = await boundedJson(request);
  if (input instanceof Response) return input;
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return json({ error: true, message: 'Data kata laluan tidak sah.' }, 400);
  }
  const body = input as Record<string, unknown>;
  const current = body.current_password;
  const next = body.new_password;
  const confirmation = body.confirm_password;
  if (typeof current !== 'string' || !current || typeof next !== 'string' || !next) {
    return json({ error: true, message: 'Kata laluan semasa dan kata laluan baru diperlukan!' }, 400);
  }
  if (new TextEncoder().encode(next).byteLength < 8) {
    return json({ error: true, message: 'Kata laluan baru mesti sekurang-kurangnya 8 aksara!' }, 400);
  }
  // bcrypt uses the first 72 bytes. Reject longer input so a second password
  // with the same prefix cannot authenticate as this one.
  if (new TextEncoder().encode(next).byteLength > 72) {
    return json({ error: true, message: 'Kata laluan baru terlalu panjang (maksimum 72 bait).' }, 400);
  }
  if (next !== confirmation) {
    return json({ error: true, message: 'Kata laluan baru dan pengesahan tidak sepadan!' }, 400);
  }

  const user = await env.DB.prepare('SELECT password FROM users WHERE id=?')
    .bind(session.id).first<{ password: string }>();
  if (!user) return json({ error: true, message: 'Pengguna tidak dijumpai!' }, 404);
  const valid = await compare(current, user.password.replace(/^\$2y\$/, '$2b$'));
  if (!valid) return json({ error: true, message: 'Kata laluan semasa tidak tepat!' }, 400);

  // bcryptjs emits $2b$, which PHP password_verify also accepts. The
  // conditional update protects a concurrent password change from overwrite.
  const replacement = await hash(next, 12);
  const result = await env.DB.prepare(`
    UPDATE users SET password=?, password_changed=1, updated_at=datetime('now')
    WHERE id=? AND password=?
  `).bind(replacement, session.id, user.password).run();
  if (result.meta.changes !== 1) {
    return json({ error: true, message: 'Kata laluan telah berubah. Cuba lagi.' }, 409);
  }
  return json({ error: false, message: 'Kata laluan berjaya dikemaskini!' });
}
