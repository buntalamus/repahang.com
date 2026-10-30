import { currentUser, json } from './auth';
import {originalPdf} from './original-templates';
import type { SessionUser } from './auth';
import type { Env } from './types';

type Row = Record<string, string | number | null>;
type FormType = 'pengadil_berdaftar' | 'penilai_berdaftar' | 'kelas3_fam'
  | 'pengadil_futsal' | 'ujian_kecergasan' | 'ujian_bertulis' | 'ujian_kelas1';
type Match = { tarikh: string | null; jenis: string | null; tempat: string | null; jawatan: string | null };

const types: FormType[] = ['pengadil_berdaftar', 'penilai_berdaftar', 'kelas3_fam',
  'pengadil_futsal', 'ujian_kecergasan', 'ujian_bertulis', 'ujian_kelas1'];

function value(row: Row, key: string, fallback = ''): string {
  const raw = row[key];
  return raw === null || raw === undefined || raw === '' ? fallback : String(raw);
}

async function imageData(env: Env, request: Request, profilePath?: string): Promise<string> {
  try {
    let bytes: Uint8Array;
    let mime: string | null | undefined;
    if (profilePath) {
      const object = await env.MEDIA.get(new URL(profilePath, request.url).pathname.replace(/^\/uploads\//, ''));
      if (!object) return '';
      mime = object.httpMetadata?.contentType;
      bytes = new Uint8Array(await object.arrayBuffer());
    } else {
      const response = await env.ASSETS.fetch(new URL('/assets/Pahang_FA_logo.png', request.url));
      if (!response.ok) return '';
      mime = response.headers.get('Content-Type');
      bytes = new Uint8Array(await response.arrayBuffer());
    }
    if (!mime || !/^image\/(png|jpeg)$/i.test(mime)) return '';
    if (bytes.length > 2_000_000) return '';
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return `data:${mime};base64,${btoa(binary)}`;
  } catch { return ''; }
}

async function application(env: Env, user: SessionUser, type: FormType, id: number | null): Promise<Row | null> {
  const scope = user.role === 'PP Daerah' ? user.persatuan_id : null;
  // Admin reviews any applicant's form when the application is named.
  const adminReview = user.role === 'Admin' && id !== null;
  let isWritten = type === 'ujian_bertulis' || type === 'ujian_kelas1';
  let currentClassOne=false;
  if (type === 'ujian_kelas1') {
    // Current applications live in permohonan; keep the legacy written-test
    // table as a fallback without requiring its historically missing column.
    const current=await env.DB.prepare(`SELECT id FROM permohonan
      WHERE jenis_borang='ujian_kelas1_fam' AND lower(status)='approved'
        AND (?=1 OR user_id=? OR COALESCE(district_id,persatuan_id)=?) ${id?'AND id=?':''}
      LIMIT 1`).bind(adminReview?1:0,user.id,scope,...(id?[id]:[])).first();
    currentClassOne=!!current;
    if(currentClassOne)isWritten=false;
    else {
      const columns=await env.DB.prepare('PRAGMA table_info(permohonan_ujian_bertulis)').all<{name:string}>();
      if(!columns.results.some(column=>column.name==='jenis_permohonan'))return null;
    }
  }
  const table = isWritten ? 'permohonan_ujian_bertulis' : 'permohonan';
  const typeCondition = isWritten ? (type === 'ujian_kelas1' ? "p.jenis_permohonan='kelas1'" : '1=1')
    : currentClassOne ? "p.jenis_borang='ujian_kelas1_fam' AND lower(p.status)='approved'"
    : type === 'ujian_kecergasan' ? "p.jenis_permohonan='ujian_kecergasan' AND p.workflow_status='Approved'"
    : `p.jenis_borang='${type}'`;
  const approved = isWritten || type === 'pengadil_futsal' ? "AND lower(p.status)='approved'" : '';
  // Imported annual applications commonly store the district in persatuan_id
  // while district_id is NULL. Both identify the same PP Daerah scope.
  const districtField = isWritten ? 'p.persatuan_id' : 'COALESCE(p.district_id,p.persatuan_id)';
  const districtAccess = type === 'kelas3_fam' ? '' : ` OR (${districtField}=?${type === 'pengadil_berdaftar' || type === 'penilai_berdaftar' ? " AND lower(p.status)='approved'" : ''})`;
  const params = [...(id ? [id] : []), adminReview ? 1 : 0, user.id, ...(districtAccess ? [scope] : [])];
  const sql = `SELECT p.*,u.tahun_mula_aktif AS user_tahun_mula_aktif,
    u.tahun_lulus_kelas3,u.url_gambar_profil AS user_gambar_profil,
    u.persatuan_id AS user_persatuan_id,u.nama_penuh AS user_nama_penuh,
    u.no_ic AS user_no_ic,u.email AS user_email,u.no_telefon AS user_no_telefon,
    u.alamat1 AS user_alamat1,u.alamat2 AS user_alamat2,u.poskod AS user_poskod,
    u.daerah AS user_daerah,u.negeri AS user_negeri,u.jantina AS user_jantina,
    u.status_kerja AS user_status_kerja,u.jawatan AS user_jawatan,
    u.nama_majikan AS user_nama_majikan,u.nama_waris AS user_nama_waris,
    u.hubungan_waris AS user_hubungan_waris,u.telefon_waris AS user_telefon_waris
    FROM ${table} p JOIN users u ON u.id=p.user_id
    WHERE ${id ? 'p.id=? AND ' : ''}(?=1 OR p.user_id=?${districtAccess}) AND ${typeCondition} ${approved}
    ${id ? '' : `ORDER BY ${isWritten ? 'p.id' : 'p.tarikh_hantar'} DESC LIMIT 1`}`;
  const raw = await env.DB.prepare(sql).bind(...params).first<Row>();
  if (!raw) return null;
  if (isWritten) {
    for (const key of ['nama_penuh','no_telefon','alamat1','alamat2','poskod','daerah','negeri',
      'jantina','status_kerja','jawatan','nama_majikan','nama_waris','hubungan_waris','telefon_waris']) {
      raw[key] = raw[`user_${key}`] ?? raw[key];
    }
    raw.no_kp = raw.user_no_ic;
    raw.emel = raw.user_email;
  }
  raw.tahun_mula_aktif = raw.tahun_mula_aktif || raw.user_tahun_mula_aktif;
  raw.url_gambar_profil = raw.url_gambar_profil || raw.user_gambar_profil;
  const districtId = Number(raw.district_id || raw.persatuan_id || raw.user_persatuan_id || 0);
  if (districtId) {
    const district = await env.DB.prepare('SELECT nama_persatuan FROM persatuan_bolasepak_daerah WHERE id=?')
      .bind(districtId).first<{nama_persatuan:string}>();
    raw.district_nama = district?.nama_persatuan ?? '';
    const pp = await env.DB.prepare("SELECT nama_penuh,no_telefon,email FROM users WHERE role='PP Daerah' AND persatuan_id=? LIMIT 1")
      .bind(districtId).first<{nama_penuh:string;no_telefon:string;email:string}>();
    raw.pp_daerah_nama = pp?.nama_penuh ?? '';
    raw.pp_telefon = pp?.no_telefon ?? '';
    raw.pp_emel = pp?.email ?? '';
  }
  return raw;
}

export async function registrationPdf(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return json({error:true,message:'Kaedah tidak dibenarkan.'},405);
  const user = await currentUser(request,env);
  if (!user) return json({error:true,message:'Sesi tidak sah. Sila log masuk semula.'},401);
  const params = new URL(request.url).searchParams;
  const type = params.get('type') || 'pengadil_berdaftar';
  if (!types.includes(type as FormType)) return json({error:true,message:'Jenis borang tidak sah'},400);
  const form = params.get('form');
  if (type === 'penilai_berdaftar' && form !== null && form !== 'r1') {
    return json({error:true,message:'Pendaftaran Penilai Pengadil hanya mempunyai borang R1.'},400);
  }
  if (type === 'pengadil_berdaftar' && form !== null && !['r1','r2','r4'].includes(form)) {
    return json({error:true,message:'Jenis borang tidak sah.'},400);
  }
  const idText = params.get('application_id') || params.get('id');
  const id = idText && /^\d+$/.test(idText) && Number.isSafeInteger(Number(idText)) && Number(idText)>0
    ? Number(idText) : null;
  if (type === 'kelas3_fam' && !id) return json({error:true,message:'ID permohonan diperlukan.'},400);
  const rowData = await application(env,user,type as FormType,id);
  if (!rowData) return json({error:true,message:'Permohonan belum diluluskan atau tidak wujud'},403);
  const matches = type === 'pengadil_berdaftar' && (form === null || form === 'r2')
    ? (await env.DB.prepare('SELECT tarikh,jenis,tempat,jawatan FROM perlawanan WHERE permohonan_id=? ORDER BY tarikh ASC')
      .bind(Number(rowData.id)).all<Match>()).results : [];
  const photoPath = value(rowData,'url_gambar_profil');
  const photo = photoPath.startsWith('/uploads/') ? await imageData(env,request,photoPath) : '';
  let rendered:Uint8Array;
  try { rendered=await originalPdf(env,{kind:'registration',data:rowData,type,form,matches,photo}); }
  catch {return json({error:true,message:'PDF belum dapat dijana. Sila cuba semula.'},503);}
  const name = type === 'penilai_berdaftar' ? `Borang_Pendaftaran_RA_R1_${rowData.id}.pdf`
    : type === 'pengadil_berdaftar' ? `Borang_Pendaftaran_Pengadil_${form ? form.toUpperCase() : 'R1_R2_R4'}_${rowData.id}.pdf`
    : type === 'kelas3_fam' ? `Borang_Perakuan_Kesihatan_R4_${rowData.id}.pdf`
    : `${type==='pengadil_futsal'?'Borang_Pendaftaran_Pengadil_Futsal_R11':type==='ujian_kecergasan'?'Borang_Permohonan_Ujian_Kecergasan_R4':type==='ujian_bertulis'?'Borang_R11_KelasIII':'Borang_R11_KelasI'}_${rowData.id}.pdf`;
  return new Response(rendered.buffer as ArrayBuffer,{status:200,headers:{
    'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="${name}"`,
    'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',
  }});
}
