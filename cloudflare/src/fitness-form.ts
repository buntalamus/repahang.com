import { currentUser } from './auth';
import {originalHtml} from './original-templates';
import type { Env } from './types';

type Application = {
  nama_penuh: string | null;
  no_kp: string | null;
  no_telefon: string | null;
  nama_waris: string | null;
  hubungan_waris: string | null;
  telefon_waris: string | null;
  tahun_permohonan: number | null;
};

function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character] ?? character);
}

function html(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'",
    },
  });
}

function error(message: string, status: number): Response {
  return html(`<!doctype html><html lang="ms"><meta charset="utf-8"><title>Borang Ujian Kecergasan</title><p style="font-family:Arial,sans-serif;padding:20px">${esc(message)}</p></html>`, status);
}

export async function fitnessForm(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return error('Kaedah tidak dibenarkan.', 405);
  const user = await currentUser(request, env);
  if (!user || user.role !== 'Pengadil') return error('Akses ditolak - hanya Pengadil sahaja', 403);
  const id = new URL(request.url).searchParams.get('id');
  if (!id || !/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) {
    return error('ID permohonan diperlukan', 400);
  }
  const application = await env.DB.prepare(`
    SELECT nama_penuh,no_kp,no_telefon,nama_waris,hubungan_waris,telefon_waris,tahun_permohonan
    FROM permohonan WHERE id=? AND user_id=? AND jenis_borang='ujian_kecergasan' LIMIT 1
  `).bind(Number(id), user.id).first<Application>();
  if (!application) return error('Permohonan tidak dijumpai', 404);
  try {return html(await originalHtml(env,{kind:'fitness',data:application}));}
  catch {return error('Borang belum dapat dijana. Sila cuba semula.',503);}
}
