import { currentUser } from './auth';
import {originalHtml} from './original-templates';
import { scheduleReport } from './schedule-report';
import type { Env } from './types';

type Row = Record<string, unknown>;

interface ScheduleDocument {
  error: false;
  kejohanan: Row;
  region_label: string;
  pengesahan: Row | null;
  jadual: Array<Row & { assignments: Record<string, Row | null> }>;
  stats: Row;
  source_label?: string;
}

function htmlResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'",
    },
  });
}

function errorPage(message: string, status: number): Response {
  return htmlResponse(`<!doctype html><html lang="ms"><meta charset="utf-8"><title>Jadual Lantikan</title><p style="font-family:Arial,sans-serif;padding:20px">${message.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c] ?? c))}</p></html>`, status);
}

export async function printSchedule(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return errorPage('Kaedah tidak dibenarkan.', 405);
  const user = await currentUser(request, env);
  if (!user || !['Admin','PP Daerah'].includes(user.role)) return errorPage('Akses tidak dibenarkan. Sila log masuk sebagai Admin terlebih dahulu.', 403);
  const result = await scheduleReport(request, env);
  if (!result.ok) {
    const failure = await result.json() as { message?: string };
    return errorPage(failure.message ?? 'Ralat memuat jadual lantikan.', result.status);
  }
  try {return htmlResponse(await originalHtml(env,{kind:'schedule',document:await result.json() as ScheduleDocument,printedBy:user.nama_penuh || user.email}));}
  catch {return errorPage('Jadual belum dapat dijana. Sila cuba semula.',503);}
}
