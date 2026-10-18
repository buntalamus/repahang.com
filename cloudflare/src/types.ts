import type { EmailEnv } from '../mail';

export interface Env extends EmailEnv {
  DB: D1Database;
  MEDIA: R2Bucket;
  ASSETS: Fetcher;
  BROWSER: BrowserRun;
  ORIGINAL_TEMPLATES?: Fetcher;
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
  PUSH_ENABLED?: string;
  /** Firebase service account JSON (secret) for FCM HTTP v1. */
  FCM_SERVICE_ACCOUNT?: string;
  MOBILE_MIN_VERSION?: string;
  MOBILE_LATEST_VERSION?: string;
  MOBILE_ANDROID_URL?: string;
  MOBILE_IOS_URL?: string;
  /** Secret for /api/mobile-broadcast.php (release update pushes). */
  MOBILE_BROADCAST_TOKEN?: string;
  /** VAPID key pair for Web Push: public = raw P-256 point, private = JWK `d` (secret); both base64url. */
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
}
