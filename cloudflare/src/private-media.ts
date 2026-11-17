import {currentUser,json} from './auth';
import type {Env} from './types';

function matchesEtag(request:Request,headers:Headers){
  const etag=headers.get('ETag');
  return etag&&request.headers.get('If-None-Match')?.split(',').some(value=>value.trim()==='*'||value.trim().replace(/^W\//,'')===etag);
}

export async function privateMedia(request: Request, env: Env, pathname: string, ctx?:Pick<ExecutionContext,'waitUntil'>): Promise<Response> {
  const user = await currentUser(request, env);
  if (!user) return json({ error: true, message: 'Sesi tidak sah. Sila log masuk semula.' }, 401);
  let key: string;
  try {
    key = decodeURIComponent(pathname.slice('/uploads/'.length));
  } catch {
    return json({ error: true, message: 'Laluan fail tidak sah.' }, 400);
  }
  if (!key || key.includes('\\') || key.split('/').some((part) => part === '..' || part === '.')) {
    return json({ error: true, message: 'Laluan fail tidak sah.' }, 400);
  }
  // Authorization and the current DB reference are checked before every cache lookup.
  const cacheableImage = ['GET','HEAD'].includes(request.method) &&
    (key.startsWith('profiles/') || key.startsWith('profile_') || key.startsWith('applications/gambar_') || key.startsWith('logos/'));
  const cache: Cache | null = typeof caches === 'undefined'
    ? null : (caches as unknown as { default: Cache }).default;
  const cacheKey = cacheableImage
    ? new Request(new URL(`/__private-media-cache/v2/${encodeURIComponent(key)}`, request.url), { method: 'GET' })
    : null;
  if (user.role !== 'Admin') {
    const reference = `/uploads/${key}`;
    let allowed = await env.DB.prepare(`
      SELECT 1 FROM users WHERE url_gambar_profil IN (?, ?, ?)
      UNION ALL
      SELECT 1 FROM permohonan WHERE user_id=? AND (
        url_resit IN (?, ?, ?) OR url_gambar_profil IN (?, ?, ?)
        OR payment_receipt_url IN (?, ?, ?)
      )
      UNION ALL
      SELECT 1 FROM permohonan_pp WHERE user_id=? AND (
        resit_pembayaran_path IN (?, ?, ?) OR resit_path IN (?, ?, ?)
      )
      UNION ALL
      SELECT 1 FROM penilai_permohonan pen
      JOIN permohonan p ON p.id=pen.permohonan_id
      WHERE p.user_id=? AND (
        pen.sijil_kursus_url IN (?, ?, ?) OR pen.sijil_kesihatan_url IN (?, ?, ?)
      ) LIMIT 1
    `).bind(
      reference, reference.slice(1), key,
      user.id, reference, reference.slice(1), key,
      reference, reference.slice(1), key,
      reference, reference.slice(1), key,
      user.id, reference, reference.slice(1), key,
      reference, reference.slice(1), key,
      user.id, reference, reference.slice(1), key,
      reference, reference.slice(1), key,
    ).first();
    // Tournament/team logos are shown to officials as well as Admin. Keep
    // receipts and other private uploads under the owner checks above.
    if (!allowed && key.startsWith('logos/')) {
      allowed = await env.DB.prepare(`
        SELECT 1 FROM kejohanan WHERE logo_kiri=? OR logo_kanan=?
        UNION ALL SELECT 1 FROM jadual_perlawanan WHERE logo_home=? OR logo_away=?
        UNION ALL SELECT 1 FROM pasukan_logo WHERE logo_path=? LIMIT 1
      `).bind(reference, reference, reference, reference, reference).first();
    }
    if (!allowed) return json({ error: true, message: 'Akses ditolak.' }, 403);
  }
  if (cache && cacheKey) {
    let cached: Response | undefined;
    try { cached = await cache.match(cacheKey); } catch { cached = undefined; }
    if (cached) {
      const headers = new Headers(cached.headers);
      headers.set('Cache-Control', 'private, no-store');
      headers.set('X-Media-Cache','HIT');
      if (matchesEtag(request,headers)) {headers.delete('Content-Length');return new Response(null,{status:304,headers});}
      return new Response(request.method==='HEAD'?null:cached.body, { status: cached.status, headers });
    }
  }
  const object = request.method === 'HEAD' ? await env.MEDIA.head(key) : await env.MEDIA.get(key);
  if (!object) return json({ error: true, message: 'Fail tidak dijumpai.' }, 404);
  const headers = new Headers({ 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
  object.writeHttpMetadata(headers);
  headers.set('Cache-Control','private, no-store');
  headers.set('ETag', object.httpEtag);
  headers.set('Content-Length',String(object.size));
  headers.set('X-Media-Cache',cacheKey&&cache?'MISS':'BYPASS');
  const response = new Response(request.method === 'HEAD' ? null : (object as R2ObjectBody).body, { headers });
  if (request.method==='GET' && cache && cacheKey && response.headers.get('Content-Type')?.startsWith('image/')) {
    const cacheHeaders = new Headers(response.headers);
    cacheHeaders.set('Cache-Control', key.startsWith('logos/')?'public, max-age=604800':'public, max-age=86400');
    try {
      const pending=cache.put(cacheKey, new Response(response.clone().body, {
        status: response.status, statusText: response.statusText, headers: cacheHeaders,
      })).catch(()=>undefined);
      if(ctx)ctx.waitUntil(pending);else await pending;
    } catch { /* Cache is an optimization; the R2 response is still valid. */ }
  }
  if(matchesEtag(request,headers)){headers.delete('Content-Length');return new Response(null,{status:304,headers});}
  return response;
}
