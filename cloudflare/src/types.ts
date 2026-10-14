import type { EmailEnv } from '../mail';

export interface Env extends EmailEnv {
  DB: D1Database;
  MEDIA: R2Bucket;
  ASSETS: Fetcher;
  BASE_URL: string;
  STAGING_AUTH_ENABLED: string;
  STAGING_WRITES_ENABLED: string;
}
