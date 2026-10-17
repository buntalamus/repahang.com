/** Account and security notices: role/email changes, deactivation, password changes, profile edits. */
import type { Env } from './types';
import { baseUrl } from './php/email';
import { klNowText, notifyUser, validEmail } from './notify';
import type { Notice, NoticeResult, Recipient } from './notify';

export const ROLE_NAMES: Record<string, string> = {
  'Admin': 'Administrator',
  'PP Daerah': 'Pegawai Pembangunan Daerah',
  'Pengadil': 'Pengadil',
  'Penilai': 'Penilai Pengadil',
};

function reached(result: NoticeResult): boolean {
  return result.email === 'sent' || result.telegram === 'sent' || result.portal === 'sent';
}

function forgotPasswordAction(env: Env): { label: string; url: string } {
  return { label: 'Tetapkan Semula Kata Laluan', url: `${baseUrl(env)}/lupa-kata-laluan` };
}

/** Security notice to the address the account used before an email change. */
export async function notifyOldEmailAddress(env: Env, oldEmail: string, name: string, newEmail: string,
  actor: string): Promise<boolean> {
  if (!validEmail(oldEmail) || oldEmail.trim().toLowerCase() === newEmail.trim().toLowerCase()) return false;
  const result = await notifyUser(env, { name, email: oldEmail }, {
    subject: 'Alamat Emel Akaun Ditukar - Sistem Pengurusan Pengadil PBNP',
    title: 'Alamat Emel Akaun Ditukar',
    accent: '#F59E0B',
    paragraphs: [`Alamat emel log masuk akaun anda telah ditukar oleh ${actor} pada ${klNowText()}.`,
      'Emel ini tidak lagi digunakan untuk log masuk atau notifikasi sistem.'],
    rows: [['Emel Baharu', newEmail]],
    alert: { label: 'Keselamatan Akaun', tone: 'warn',
      text: 'Jika anda tidak meminta perubahan ini, hubungi pentadbir sistem dengan segera.' },
    telegram: false,
  });
  return reached(result);
}

/** Admin changed the role and/or login email of an account. */
export async function notifyAccountUpdated(env: Env, recipient: Recipient,
  changes: { role?: { from: string; to: string }; email?: { from: string; to: string } }): Promise<boolean> {
  const rows: Array<[string, string]> = [];
  if (changes.role) {
    rows.push(['Peranan Baharu', ROLE_NAMES[changes.role.to] ?? changes.role.to],
      ['Peranan Sebelum Ini', ROLE_NAMES[changes.role.from] ?? changes.role.from]);
  }
  if (changes.email) rows.push(['Emel Log Masuk Baharu', changes.email.to]);
  if (rows.length === 0) return false;
  const result = await notifyUser(env, recipient, {
    subject: 'Akaun Dikemaskini - Sistem Pengurusan Pengadil PBNP',
    title: 'Akaun Dikemaskini',
    paragraphs: [`Maklumat akaun anda telah dikemaskini oleh pentadbir pada ${klNowText()}.`],
    rows,
    actions: [{ label: 'Log Masuk ke Sistem', url: `${baseUrl(env)}/login` }],
    portal: { type: 'Akaun Dikemaskini', subject: 'Akaun Dikemaskini',
      message: `Pentadbir telah mengemaskini akaun anda: ${rows.map(([label, value]) => `${label}: ${value}`).join(', ')}.` },
  });
  return reached(result);
}

/** Email + Telegram; no portal notice because the account can no longer log in. */
export async function notifyAccountDeactivated(env: Env, recipient: Recipient): Promise<boolean> {
  const result = await notifyUser(env, { ...recipient, userId: null }, {
    subject: 'Akaun Dinyahaktifkan - Sistem Pengurusan Pengadil PBNP',
    title: 'Akaun Dinyahaktifkan',
    accent: '#DC2626',
    paragraphs: [`Akaun anda dalam Sistem Pengurusan Pengadil PBNP telah dinyahaktifkan oleh pentadbir pada ${klNowText()}.`,
      'Anda tidak lagi boleh log masuk atau menerima lantikan. Rekod sejarah perlawanan anda dikekalkan.'],
    alert: { label: 'Pertanyaan', tone: 'info',
      text: 'Jika anda berpendapat ini satu kesilapan, sila hubungi pentadbir atau Pegawai Pembangunan Daerah anda.' },
  });
  return reached(result);
}

/** Security confirmation after the account owner changed or reset their password. */
export async function notifyPasswordChanged(env: Env, recipient: Recipient, via: 'change' | 'reset'):
  Promise<boolean> {
  const result = await notifyUser(env, recipient, {
    subject: 'Kata Laluan Ditukar - Sistem Pengurusan Pengadil PBNP',
    title: 'Kata Laluan Ditukar',
    accent: '#F59E0B',
    paragraphs: [via === 'reset'
      ? `Kata laluan akaun anda telah ditetapkan semula melalui pautan lupa kata laluan pada ${klNowText()}.`
      : `Kata laluan akaun anda telah ditukar pada ${klNowText()}.`],
    alert: { label: 'Bukan Anda?', tone: 'warn',
      text: 'Jika anda tidak membuat perubahan ini, tetapkan semula kata laluan dengan segera dan maklumkan kepada pentadbir.' },
    actions: [forgotPasswordAction(env)],
    telegram: false,
  });
  return reached(result);
}

/** Admin or PP Daerah edited a referee's profile; only field names are listed, never values. */
export async function notifyProfileEdited(env: Env, recipient: Recipient, labels: string[], actor: string,
  oldEmail: string | null): Promise<boolean> {
  if (labels.length === 0) return false;
  const list = labels.join(', ');
  const notice: Notice = {
    subject: 'Profil Dikemaskini - Sistem Pengurusan Pengadil PBNP',
    title: 'Profil Dikemaskini',
    paragraphs: [`Profil anda telah dikemaskini oleh ${actor} pada ${klNowText()}.`,
      'Maklumat yang dikemaskini:', labels.map((label) => `• ${label}`).join('\n'),
      'Sila log masuk untuk menyemak profil anda.'],
    actions: [{ label: 'Semak Profil', url: `${baseUrl(env)}/login` }],
    telegram: false,
    portal: { type: 'Profil Dikemaskini', subject: 'Profil Dikemaskini',
      message: `Profil anda telah dikemaskini oleh ${actor}. Maklumat dikemaskini: ${list}.` },
  };
  const result = await notifyUser(env, recipient, notice);
  if (oldEmail && recipient.email) {
    await notifyOldEmailAddress(env, oldEmail, recipient.name, String(recipient.email), actor);
  }
  return reached(result);
}
