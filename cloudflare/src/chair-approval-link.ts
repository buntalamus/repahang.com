/**
 * api/laporan-pengesahan-token.php: read-only GET review page and explicit
 * POST confirmation for the tournament chair. No portal account is needed.
 */
import type {Env} from './types';
import {reportWritesEnabled} from './report-submission';
import {h,klTimestamp,phpDate} from './php/format';
import {auditMetaFrom} from './php/lantikan-audit';
import {PhpDomainError,PhpInvalidArgument,buildPengerusiReportPreviewUrl,
  confirmLaporanByPengerusi} from './php/laporan-pengesahan';

function approvalPage(title:string,content:string,status=200,allow=false):Response {
  const year=phpDate('Y',Date.now());
  const html=`<!doctype html>
<html lang="ms">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${h(title)}</title>
  <style>
    *{box-sizing:border-box} body{margin:0;background:#e8eaed;color:#111827;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;padding:24px}
    .card{max-width:620px;margin:20px auto;background:#fff;box-shadow:0 2px 12px rgba(15,23,42,.14)}
    .bar{height:7px;background:#f59e0b}.head{background:#111827;color:#fff;text-align:center;padding:27px 24px}
    .head strong{display:block;font-size:15px;letter-spacing:.5px}.head span{display:block;margin-top:5px;color:#9ca3af;font-size:11px;letter-spacing:2px;text-transform:uppercase}
    .body{padding:30px}.body h1{font-size:22px;margin:0 0 8px}.muted{color:#6b7280;font-size:13px;line-height:1.6}.info{width:100%;border-collapse:collapse;margin:22px 0;font-size:13px}.info td{padding:9px;border-bottom:1px solid #e5e7eb;vertical-align:top}.info td:first-child{width:34%;color:#64748b;font-weight:600}
    textarea{width:100%;min-height:120px;border:1px solid #cbd5e1;border-radius:6px;padding:12px;font:inherit;resize:vertical}.label{display:block;font-size:13px;font-weight:700;margin:20px 0 7px}
    .actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:20px}.btn{display:inline-block;border:0;border-radius:5px;padding:12px 18px;font-weight:700;font-size:13px;text-decoration:none;cursor:pointer}.primary{background:#059669;color:#fff}.secondary{background:#e2e8f0;color:#0f172a}.notice{border-left:4px solid #f59e0b;background:#fffbeb;padding:12px 14px;margin:18px 0;color:#854d0e;font-size:13px;line-height:1.55}.success{border-color:#10b981;background:#ecfdf5;color:#065f46}.error{border-color:#ef4444;background:#fef2f2;color:#991b1b}
    .foot{background:#111827;color:#9ca3af;text-align:center;padding:16px;font-size:11px}
  </style>
</head>
<body><main class="card"><div class="bar"></div><header class="head"><strong>PERSATUAN BOLA SEPAK NEGERI PAHANG</strong><span>Sistem Pengurusan Pengadil</span></header><section class="body">${content}</section><footer class="foot">&copy; ${year} Persatuan Bola Sepak Negeri Pahang</footer></main></body>
</html>`;
  const headers=new Headers({'Content-Type':'text/html; charset=UTF-8','Cache-Control':'no-store'});
  if (allow) headers.set('Allow','GET, POST');
  return new Response(html,{status,headers});
}

const INVALID='<h1>Pautan Tidak Sah</h1><div class="notice error">Pautan pengesahan ini tidak dapat dikenal pasti. Sila hubungi pentadbir.</div>';

async function postedFields(request:Request):Promise<URLSearchParams> {
  const type=request.headers.get('Content-Type') ?? '';
  const fields=new URLSearchParams();
  if (!type.startsWith('application/x-www-form-urlencoded') && !type.startsWith('multipart/form-data')) return fields;
  try {
    const form=await request.formData();
    form.forEach((value,key)=>{if (typeof value==='string') fields.append(key,value);});
  } catch {/* PHP leaves $_POST empty */}
  return fields;
}

export async function chairApprovalLink(request:Request,env:Env):Promise<Response> {
  const method=request.method.toUpperCase();
  if (method!=='GET' && method!=='POST') {
    return approvalPage('Kaedah Tidak Sah','<h1>Kaedah Tidak Sah</h1><div class="notice error">Gunakan pautan asal daripada emel atau Telegram anda.</div>',405,true);
  }
  if (!reportWritesEnabled(env)) {
    return new Response('Pautan Pengerusi belum tersedia di staging.',{status:503,
      headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});
  }
  try {
    const source=method==='POST' ? await postedFields(request) : new URL(request.url).searchParams;
    const token=(source.get('token') ?? '').trim();
    if (!/^[0-9a-fA-F]{64}$/.test(token)) return approvalPage('Pautan Tidak Sah',INVALID,404);
    const state=await env.DB.prepare(`
      SELECT approval.*,laporan.status AS laporan_status,
        jp.no_perlawanan,jp.tarikh,jp.masa,jp.tempat,jp.pasukan_home,jp.pasukan_away,
        k.nama AS nama_kejohanan,
        COALESCE(u_ra.nama_penuh,pl_ra.nama,'Penilai Pengadil') AS nama_penilai
      FROM laporan_pengesahan_pengerusi approval
      JOIN laporan_penilaian laporan ON laporan.id=approval.laporan_id
      JOIN jadual_perlawanan jp ON jp.id=laporan.jadual_id
      JOIN kejohanan k ON k.id=jp.kejohanan_id
      JOIN lantikan_pengadil ra ON ra.id=laporan.lantikan_id
      LEFT JOIN users u_ra ON u_ra.id=ra.pengadil_id
      LEFT JOIN pengadil_luar pl_ra ON pl_ra.id=ra.pengadil_luar_id
      WHERE approval.approval_token=? LIMIT 1`).bind(token).first<Record<string,unknown>>();
    if (!state) return approvalPage('Pautan Tidak Sah',INVALID,404);
    const s=(value:unknown)=>String(value ?? '');
    const match=`${h(state.pasukan_home)} lwn ${h(state.pasukan_away)}`;
    const local=new Date((klTimestamp(s(state.tarikh)) ?? 0)+8*3600_000);
    const date=`${String(local.getUTCDate()).padStart(2,'0')}/${String(local.getUTCMonth()+1).padStart(2,'0')}/${local.getUTCFullYear()}`;
    const time=s(state.masa).slice(0,5);

    if (method==='POST') {
      const comment=(source.get('catatan_pengerusi') ?? '').trim();
      if (Array.from(comment).length>5000) {
        return approvalPage('Komen Terlalu Panjang','<h1>Komen Terlalu Panjang</h1><div class="notice error">Komen mestilah tidak melebihi 5,000 aksara.</div>',422);
      }
      try {
        await confirmLaporanByPengerusi(env,token,comment,auditMetaFrom(request));
      } catch (error) {
        if (error instanceof PhpDomainError) {
          return approvalPage('Laporan Telah Diproses',`<h1>Laporan Telah Diproses</h1><div class="notice">${h(error.message)}</div>`,409);
        }
        if (error instanceof PhpInvalidArgument) {
          return approvalPage('Pautan Tidak Sah',`<h1>Pautan Tidak Sah</h1><div class="notice error">${h(error.message)}</div>`,404);
        }
        throw error;
      }
      const commentText=comment!==''
        ? `<p class="muted"><strong>Komen direkodkan:</strong><br>${h(comment).replace(/(\r\n|\n\r|\n|\r)/g,'<br />$1')}</p>`
        : '<p class="muted">Tiada komen tambahan direkodkan.</p>';
      return approvalPage('Laporan Disahkan',
        `<h1>Laporan Berjaya Disahkan</h1><div class="notice success">Pengesahan anda sebagai Pengerusi Pengadil telah direkodkan. Salinan laporan akan dihantar kepada pegawai perlawanan.</div>${commentText}`);
    }

    if (state.status!=='Menunggu' || state.laporan_status!=='Dihantar') {
      const status=state.status==='Override Admin'
        ? 'Laporan ini telah disahkan melalui override Admin.'
        : 'Laporan ini telah disahkan sebelum ini.';
      return approvalPage('Laporan Telah Diproses',`<h1>Laporan Telah Diproses</h1><div class="notice">${h(status)}</div>`);
    }
    const previewUrl=buildPengerusiReportPreviewUrl(env,Number(state.laporan_id),token);
    const content='<h1>Semak & Sahkan Laporan Penilai Pengadil</h1>'
      +`<p class="muted">Tuan/Puan ditetapkan sebagai <strong>${h(state.pengesah_jawatan)}</strong> bagi kejohanan ini. Semak laporan penuh sebelum mengesahkan.</p>`
      +`<table class="info"><tr><td>Pengerusi</td><td><strong>${h(state.pengesah_nama)}</strong></td></tr>`
      +`<tr><td>Kejohanan</td><td>${h(state.nama_kejohanan)}</td></tr>`
      +`<tr><td>Perlawanan</td><td><strong>${match}</strong></td></tr>`
      +`<tr><td>Tarikh / Masa</td><td>${h(`${date} · ${time}`)}</td></tr>`
      +`<tr><td>Tempat</td><td>${h(s(state.tempat) || '-')}</td></tr>`
      +`<tr><td>Penilai</td><td>${h(state.nama_penilai)}</td></tr></table>`
      +'<div class="notice">Klik “Lihat Laporan Penuh” dan semak semua markah serta ulasan. Membuka pautan ini sahaja tidak mengesahkan laporan.</div>'
      +`<a class="btn secondary" href="${h(previewUrl)}" target="_blank" rel="noopener">Lihat Laporan Penuh</a>`
      +`<form method="post"><input type="hidden" name="token" value="${h(token)}">`
      +'<label class="label" for="catatan">Komen Pengerusi Pengadil (pilihan)</label>'
      +'<textarea id="catatan" name="catatan_pengerusi" maxlength="5000" placeholder="Tulis komen atau arahan sebelum mengesahkan..."></textarea>'
      +'<div class="actions"><button class="btn primary" type="submit">Sahkan Laporan</button></div></form>';
    return approvalPage('Pengesahan Laporan Penilai Pengadil',content);
  } catch (error) {
    console.error('[laporan-pengesahan-token.php]',error instanceof Error ? error.message : error);
    return approvalPage('Ralat Pelayan','<h1>Ralat Pelayan</h1><div class="notice error">Pengesahan tidak dapat diproses sekarang. Sila cuba semula atau hubungi pentadbir.</div>',500);
  }
}
