export interface Env {
  DB: D1Database;
  MEDIA: R2Bucket;
  ASSETS: Fetcher;
  STAGING_AUTH_ENABLED: string;
  STAGING_WRITES_ENABLED: string;
}
