import { currentUser } from './auth';
import {originalHtml} from './original-templates';
import type { Env } from './types';

interface FutsalApplication {
  tahun_permohonan: number | null;
  nama_penuh: string | null;
  no_ic: string | null;
  email: string | null;
  no_telefon: string | null;
  jantina: string | null;
  jenis_pengadil: string | null;
  tahun_mula_aktif: number | null;
  alamat1: string | null;
  alamat2: string | null;
  poskod: string | null;
  daerah: string | null;
  negeri: string | null;
  status_kerja: string | null;
  jawatan: string | null;
  nama_majikan: string | null;
  nama_waris: string | null;
  hubungan_waris: string | null;
  telefon_waris: string | null;
  saiz_baju: string | null;
}

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g,(character)=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;',
  })[character] ?? character);
}

function html(body: string,status=200): Response {
  return new Response(body,{status,headers:{
    'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store',
    'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
    'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'",
  }});
}

function error(message: string,status: number): Response {
  return html(`<!doctype html><html lang="ms"><meta charset="utf-8"><title>Borang Futsal R3</title><p>${escapeHtml(message)}</p></html>`,status);
}

export async function futsalForm(request: Request,env: Env): Promise<Response> {
  if (request.method !== 'GET') return error('Kaedah tidak dibenarkan.',405);
  const user = await currentUser(request,env);
  if (!user || !['Pengadil','PP Daerah','Admin'].includes(user.role)) {
    return error('Akses ditolak',403);
  }
  const application = await env.DB.prepare(`
    SELECT p.tahun_permohonan,u.nama_penuh,u.no_ic,u.email,u.no_telefon,u.jantina,
      u.jenis_pengadil,u.tahun_mula_aktif,u.alamat1,u.alamat2,u.poskod,u.daerah,
      u.negeri,u.status_kerja,u.jawatan,u.nama_majikan,u.nama_waris,
      u.hubungan_waris,u.telefon_waris,u.saiz_baju
    FROM permohonan p JOIN users u ON u.id=p.user_id
    WHERE p.user_id=? AND p.jenis_borang='pengadil_futsal'
      AND lower(p.status)='approved'
    ORDER BY p.tarikh_hantar DESC,p.id DESC LIMIT 1
  `).bind(user.id).first<FutsalApplication>();
  if (!application) return error('Permohonan pengadil futsal belum diluluskan atau tidak wujud',403);
  let rendered: Response;
  try {
    rendered = await env.BROWSER.quickAction('pdf',{
      html: await originalHtml(env,{kind:'futsal',data:application}),cacheTTL:0,
      pdfOptions:{format:'a4',printBackground:true,preferCSSPageSize:true},
    });
  } catch {
    return error('PDF belum dapat dijana. Sila cuba semula.',503);
  }
  if (!rendered.ok || !rendered.headers.get('Content-Type')?.includes('application/pdf')) {
    return error('PDF belum dapat dijana. Sila cuba semula.',503);
  }
  const date = new Intl.DateTimeFormat('en-CA',{
    timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit',
  }).format(new Date());
  return new Response(rendered.body,{status:200,headers:{
    'Content-Type':'application/pdf',
    'Content-Disposition':`attachment; filename="Borang_Pendaftaran_Pengadil_Futsal_R3_${date}.pdf"`,
    'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',
  }});
}
