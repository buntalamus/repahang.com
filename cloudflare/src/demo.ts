/**
 * Demo deployment (demo.refpahang.com): every switch is on, but the seeded
 * people are fictional. Email to a fictional address and Telegram to a
 * fictional chat id is recorded in demo_outbox instead of being sent, so
 * testers can still read it. Everything here is inert unless DEMO_MODE=1.
 */
import accounts from '../demo/accounts.json';

export const DEMO_ACCOUNTS: { peranan: string; emel: string; kata_laluan: string; keterangan: string }[] = accounts;

export const isDemo = (env: { DEMO_MODE?: string }): boolean => env.DEMO_MODE === '1';

/** Seeded fictional chat ids sit far below any real Telegram chat (-100… supergroups). */
export const DEMO_FAKE_CHAT_CEILING = -8_000_000_000_000_000;
export const isFakeChat = (chatId: number | string): boolean => Number(chatId) <= DEMO_FAKE_CHAT_CEILING;

export function isFakeEmail(address: string): boolean {
  const value = address.trim().toLowerCase();
  return value.endsWith('.invalid') || value.endsWith('@demo.refpahang.com');
}

/** Shared login accounts: nobody may lock the others out of them. */
export function isSharedDemoAccount(env: { DEMO_MODE?: string }, email: string | null | undefined): boolean {
  if (!isDemo(env) || !email) return false;
  const value = email.trim().toLowerCase();
  return DEMO_ACCOUNTS.some((account) => account.emel === value);
}

export async function isSharedDemoUserId(env: { DEMO_MODE?: string; DB?: D1Database }, userId: number): Promise<boolean> {
  if (!isDemo(env) || !env.DB || !userId) return false;
  const row = await env.DB.prepare('SELECT email FROM users WHERE id=?').bind(userId).first<{ email: string | null }>();
  return isSharedDemoAccount(env, row?.email);
}

export const SHARED_ACCOUNT_MESSAGE = 'Akaun demo kongsi tidak boleh diubah. Daftar akaun anda sendiri untuk mencuba fungsi ini.';

export const demoTitle = (env: { DEMO_MODE?: string }, title: string): string =>
  isDemo(env) && !title.startsWith('[DEMO]') ? `[DEMO] ${title}` : title;

export async function recordDemoOutbox(env: { DB?: D1Database }, channel: 'email' | 'telegram',
  recipient: string, subject: string, body: string): Promise<void> {
  if (!env.DB) return;
  try {
    await env.DB.prepare(`INSERT INTO demo_outbox(channel,recipient,subject,body,created_at)
      VALUES (?,?,?,?,datetime('now','+8 hours'))`).bind(channel, recipient, subject.slice(0, 500), body.slice(0, 100_000)).run();
  } catch (error) {
    console.error('[demo] outbox write failed', error instanceof Error ? error.message : error);
  }
}
