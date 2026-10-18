import { HttpContextToken } from '@angular/common/http';

/** Background polling renders transient failures in its own panel. */
export const BACKGROUND_REQUEST = new HttpContextToken<boolean>(() => false);
