import { HttpContextToken } from '@angular/common/http';

/** Background polling renders transient failures in its own panel. */
export const BACKGROUND_REQUEST = new HttpContextToken<boolean>(() => false);

/** Applied inside the interceptor so timeout failures reach the same error path. */
export const REQUEST_TIMEOUT_MS = new HttpContextToken<number>(() => 20000);

/** Expected capability probes (for example demo-info returning 404 in production). */
export const EXPECTED_ERROR_STATUSES = new HttpContextToken<readonly number[]>(() => []);
