import {hash} from 'bcryptjs';
import {buildRefpahangEmail,sendRefpahangEmail} from '../mail';
import {json} from './auth';
import {guardStatement,runGuarded} from './php/guard';
import type {Env} from './types';
import { wroteRow } from './d1-changes';

type Recipient={id:number;nama_penuh:string;email:string;password:string};
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CHARS='abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function temporaryPassword():string {
  const random=crypto.getRandomValues(new Uint8Array(10));
  return Array.from(random,byte=>CHARS[byte%CHARS.length]).join('');
}

/** 2026 legacy Kelas III FAM welcome blast; only Admin calls this dispatcher. */
export async function blastKelas3Welcome(env:Env,actorId:number):Promise<Response> {
  if (env.STAGING_WRITES_ENABLED!=='1' || env.BULK_EMAIL_ENABLED!=='1') {
    return json({error:true,message:'Penghantaran emel pukal belum tersedia di staging.'},503);
  }
  const recipients=await env.DB.prepare(`SELECT u.id,u.nama_penuh,u.email,u.password
    FROM users u WHERE u.aktif=1 AND u.password_changed=0
      AND EXISTS(SELECT 1 FROM permohonan p WHERE p.user_id=u.id
        AND p.jenis_borang='kelas3_fam' AND p.tahun_permohonan=2026)
    ORDER BY u.id`).all<Recipient>();
  if (!recipients.results.length) {
    return json({error:false,
      message:'Tiada akaun yang layak untuk blast (semua sudah tukar password).',sent:0});
  }
  const login=new URL('/login',env.BASE_URL);
  if (login.protocol!=='https:') {
    return json({error:true,message:'Alamat log masuk belum dikonfigurasi.'},503);
  }
  let sent=0,failed=0,skipped=0,consecutiveFailures=0;
  for (const recipient of recipients.results) {
    if (consecutiveFailures>=3) {skipped++;continue;}
    const email=String(recipient.email??'').trim();
    if (!EMAIL.test(email) || email.length>254) {
      failed++;consecutiveFailures++;
      continue;
    }
    await env.DB.prepare(`INSERT OR IGNORE INTO worker_kelas3_welcome_delivery
      (user_id,campaign_year) VALUES (?,2026)`).bind(recipient.id).run();
    const claim=crypto.randomUUID();
    // A stale processing claim is deliberately not retried automatically:
    // the previous email may have been accepted before its final DB write.
    const acquired=await env.DB.prepare(`UPDATE worker_kelas3_welcome_delivery
      SET status='processing',claim_token=?,claimed_at=datetime('now','+8 hours'),
        attempts=attempts+1,actor_user_id=?
      WHERE user_id=? AND campaign_year=2026 AND status IN ('ready','failed')`)
      .bind(claim,actorId,recipient.id).run();
    if (!wroteRow(acquired)) {skipped++;continue;}
    const password=temporaryPassword();
    const replacement=await hash(password,12);
    const updated=await env.DB.prepare(`UPDATE users SET password=?,updated_at=datetime('now','+8 hours')
      WHERE id=? AND password=? AND password_changed=0 AND aktif=1
        AND EXISTS(SELECT 1 FROM permohonan p WHERE p.user_id=users.id
          AND p.jenis_borang='kelas3_fam' AND p.tahun_permohonan=2026)`)
      .bind(replacement,recipient.id,recipient.password).run();
    if (!wroteRow(updated)) {
      await env.DB.prepare(`UPDATE worker_kelas3_welcome_delivery
        SET status='ready',claim_token=NULL,claimed_at=NULL
        WHERE user_id=? AND campaign_year=2026 AND claim_token=?`)
        .bind(recipient.id,claim).run();
      skipped++;
      continue;
    }
    let delivered=false;
    try {
      const {html,text}=buildRefpahangEmail('Akaun Berjaya Didaftarkan',
        recipient.nama_penuh,[
          'Akaun anda didaftarkan untuk Peperiksaan Kelas III FAM 2026.',
          `Alamat emel log masuk: ${email}`,
          `Kata laluan sementara: ${password}`,
          'Permohonan anda masih dalam semakan. Log masuk, tukar kata laluan sementara, lengkapkan profil dan semak keputusan ujian dalam sistem.',
          'Jika ada pertanyaan, hubungi admin@refpahang.com.',
        ],{label:'Log Masuk Sekarang',url:login.toString()});
      await sendRefpahangEmail(env,'daftar',email,recipient.nama_penuh,
        'Akaun Sistem RefPahang — Peperiksaan Kelas III FAM 2026',html,text);
      delivered=true;
    } catch {
      // Provider exception text may contain recipient or authentication data.
    }
    const condition=`EXISTS(SELECT 1 FROM worker_kelas3_welcome_delivery
      WHERE user_id=? AND campaign_year=2026 AND claim_token=? AND status='processing')`;
    const statements=[guardStatement(env,'kelas3_welcome_complete',condition,
      [recipient.id,claim])];
    if (delivered) {
      statements.push(env.DB.prepare(`UPDATE worker_kelas3_welcome_delivery SET
        status='sent',sent_at=datetime('now','+8 hours'),claim_token=NULL,claimed_at=NULL
        WHERE user_id=? AND campaign_year=2026 AND claim_token=?`).bind(recipient.id,claim));
      statements.push(env.DB.prepare('DELETE FROM worker_sessions WHERE user_id=?')
        .bind(recipient.id));
    } else {
      statements.push(env.DB.prepare(`UPDATE users SET password=?,updated_at=datetime('now','+8 hours')
        WHERE id=? AND password=? AND password_changed=0`)
        .bind(recipient.password,recipient.id,replacement));
      statements.push(env.DB.prepare(`UPDATE worker_kelas3_welcome_delivery SET
        status='failed',failed_at=datetime('now','+8 hours'),
        claim_token=NULL,claimed_at=NULL
        WHERE user_id=? AND campaign_year=2026 AND claim_token=?`).bind(recipient.id,claim));
    }
    const outcome=await runGuarded(env,statements);
    if (!outcome) {
      return json({error:true,message:'Status penghantaran berubah. Semak rekod sebelum cuba lagi.'},409);
    }
    if (delivered) {sent++;consecutiveFailures=0;}
    else {failed++;consecutiveFailures++;}
  }
  return json({error:false,message:`Blast selesai. Berjaya: ${sent}, Gagal: ${failed}.`,
    sent,failed,skipped,smtp_circuit_open:consecutiveFailures>=3});
}
