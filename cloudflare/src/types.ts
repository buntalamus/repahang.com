import type { EmailEnv } from '../mail';

export interface Env extends EmailEnv {
  DB: D1Database;
  MEDIA: R2Bucket;
  ASSETS: Fetcher;
  BROWSER: BrowserRun;
  BASE_URL: string;
  STAGING_AUTH_ENABLED: string;
  STAGING_LOGIN_EMAILS?: string;
  STAGING_QA_WRITE_TOKEN?: string;
  STAGING_WRITES_ENABLED: string;
  APPOINTMENT_DELIVERY_ENABLED: string;
  REPORT_DELIVERY_ENABLED: string;
  BULK_EMAIL_ENABLED: string;
  MAILBOX_SEND_ENABLED: string;
  MAILBOX_IMAP_ENABLED?: string;
  IMAP_HOST?: string;
  TELEGRAM_BOT_USERNAME?: string;
  TELEGRAM_BOT_TOKEN?: string;
}
