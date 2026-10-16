import { json, type SessionUser } from './auth';
import { boundedJson } from './request';
import type { Env } from './types';

type Resource = 'tournament' | 'schedule' | 'upload' | 'pool' | 'appointment' | 'report';
export const districtOf = (user: SessionUser): number => Number(user.persatuan_id ?? user.district_id ?? 0);
export function appointmentManager(user: SessionUser): boolean {
  return user.role === 'Admin' || (user.role === 'PP Daerah' && districtOf(user)>0);
}
export const localOfficialSql = (alias: string): string =>
  `COALESCE(NULLIF(${alias}.persatuan_id,0),${alias}.district_id)=? AND ${alias}.aktif=1
   AND (${alias}.role IN ('Pengadil','Penilai') OR ${alias}.jenis_pengadil='Penilai Pengadil'
     OR (${alias}.role='PP Daerah' AND (${alias}.jenis_pengadil IN
       ('Pengadil Negeri','Pengadil Kebangsaan','Kelas III FAM','Kelas I FAM') OR EXISTS(
         SELECT 1 FROM permohonan eligible WHERE eligible.user_id=${alias}.id
           AND eligible.status='Approved' AND eligible.jenis_borang='pengadil_berdaftar'))))`;
const idOf = (raw: unknown): number => /^(?:[1-9]\d*)$/.test(String(raw)) && Number.isSafeInteger(Number(raw)) ? Number(raw) : 0;
const denied = () => json({error:true,message:'Lantikan ini di luar kelolaan daerah anda.'},403);

/** Authorize every resource in a bulk request before any read or side effect.
 * District ownership is server assigned at creation and cannot be changed by the API. */
export async function authorizeAppointmentResource(request: Request, env: Env, user: SessionUser,
  resource: Resource): Promise<Response | null> {
  if (user.role==='Admin') return null;
  if (!appointmentManager(user)) return denied();
  const district=districtOf(user);
  if (!await env.DB.prepare('SELECT id FROM persatuan_bolasepak_daerah WHERE id=?').bind(district).first()) return denied();
  const url=new URL(request.url);
  const multipart=(request.headers.get('Content-Type') ?? '').startsWith('multipart/form-data');
  let input: Record<string,unknown>={};
  if (['POST','PUT'].includes(request.method) && !multipart) {
    const parsed=await boundedJson(request.clone() as Request,1_048_576);
    if (parsed instanceof Response) return parsed;
    if (!parsed || typeof parsed!=='object' || Array.isArray(parsed)) return denied();
    input=parsed as Record<string,unknown>;
  }
  const query=url.searchParams;
  let source='kejohanan';
  let ids: unknown[]=[];
  let direct=false;
  if (resource==='tournament') {
    if (request.method==='GET' && !query.has('id')) return null; // caller scopes listing
    if (request.method==='POST' && !query.has('action')) return null; // owner assigned by server
    ids=[query.get('id') ?? input.id];
    direct=true;
  } else if (resource==='appointment') {
    const action=String(input.action ?? 'assign');
    if (!['assign','notify','notify_all','batal_jadual','batal_bulk'].includes(action)) return denied();
    if (request.method==='DELETE') { source='lantikan_pengadil'; ids=[query.get('id')]; }
    else if (action==='notify_all') { ids=[input.kejohanan_id]; direct=true; }
    else { source='jadual_perlawanan'; ids=action==='batal_bulk'
      ? (Array.isArray(input.jadual_ids) ? input.jadual_ids : []) : [query.get('jadual_id') ?? input.jadual_id]; }
    if (input.pengadil_luar_id!=null && input.pengadil_luar_id!=='') return denied();
    if (request.method==='POST' && action==='assign') {
      const referee=idOf(input.pengadil_id);
      if (!referee || !await env.DB.prepare(`SELECT u.id FROM users u WHERE u.id=? AND ${localOfficialSql('u')}`)
        .bind(referee,district).first()) return denied();
    }
  } else if (resource==='pool' && request.method==='DELETE') { source='pool_pengadil'; ids=[query.get('id')]; }
  else if (resource==='schedule' && (query.has('id') || request.method==='PUT')) {
    source='jadual_perlawanan'; ids=[query.get('id') ?? input.id];
  } else if (resource==='schedule' && query.get('action')==='bulk_delete') {
    source='jadual_perlawanan'; ids=Array.isArray(input.ids) ? input.ids : [];
  } else { ids=[query.get('kejohanan_id') ?? input.kejohanan_id]; direct=true; }
  const parsedIds=[...new Set(ids.map(idOf))];
  if (!ids.length || ids.length>200 || parsedIds.includes(0)) return denied();
  const ownership=direct ? 'id' : source==='lantikan_pengadil'
    ? '(SELECT kejohanan_id FROM jadual_perlawanan WHERE id=lantikan_pengadil.jadual_id)' : 'kejohanan_id';
  const rows=await env.DB.prepare(`SELECT id FROM ${source} WHERE id IN (SELECT value FROM json_each(?))
    AND ${ownership} IN (SELECT id FROM kejohanan WHERE lantikan_persatuan_id=?)`)
    .bind(JSON.stringify(parsedIds),district).all();
  if (rows.results.length!==parsedIds.length) return denied();
  if (resource==='pool' && request.method==='POST') {
    const items=Array.isArray(input.items) && input.items.length ? input.items : [input];
    if (items.length>200) return denied();
    const refereeIds: number[]=[];
    for (const item of items) {
      if (!item || typeof item!=='object' || Array.isArray(item)) return denied();
      const row=item as Record<string,unknown>;
      if (row.pengadil_luar_id!=null || !idOf(row.pengadil_id)) return denied();
      refereeIds.push(idOf(row.pengadil_id));
    }
    const unique=[...new Set(refereeIds)];
    const officials=await env.DB.prepare(`SELECT u.id FROM users u
      WHERE u.id IN (SELECT value FROM json_each(?)) AND ${localOfficialSql('u')}`)
      .bind(JSON.stringify(unique),district).all();
    if (officials.results.length!==unique.length) return denied();
  }
  return null;
}
