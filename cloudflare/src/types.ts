import type { EmailEnv } from '../mail';

export interface Env extends EmailEnv {
  DB: D1Database;
  MEDIA: R2Bucket;
  ASSETS: Fetcher;
  BROWSER: BrowserRun;
  BASE_URL: string;
  STAGING_AUTH_ENABLED: string;
  STAGING_WRITES_ENABLED: string;
  APPOINTMENT_DELIVERY_ENABLED: string;
  REPORT_DELIVERY_ENABLED: string;
  TELEGRAM_BOT_USERNAME?: string;
  TELEGRAM_BOT_TOKEN?: string;
}
