export interface Env {
  DB: D1Database;
  MEDIA: R2Bucket;
  ASSETS: Fetcher;
  EMAIL: import('../mail').EmailEnv['EMAIL'];
  STAGING_AUTH_ENABLED: string;
  STAGING_WRITES_ENABLED: string;
}
