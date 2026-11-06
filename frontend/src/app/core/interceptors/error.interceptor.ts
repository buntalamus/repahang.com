import { HttpInterceptorFn, HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, finalize, from, mergeMap, tap, throwError, timeout } from 'rxjs';
import { ToastService } from '../services/toast.service';
import { BACKGROUND_REQUEST, EXPECTED_ERROR_STATUSES, REQUEST_TIMEOUT_MS } from '../services/background-request';
import { HttpViewRefreshService } from '../services/http-view-refresh.service';
import { rememberApiError } from '../services/api-error';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);
  const router = inject(Router);
  const viewRefresh = inject(HttpViewRefreshService);
  const isLoginRequest = req.url.includes('/login.php');

  const report = (error: unknown, requestId?: string | null) => {
    rememberApiError(error, { url: req.urlWithParams, method: req.method, body: req.body, requestId });
    // Let the component supply its action-specific heading first. Requests with
    // no error callback still receive an explanation; the service deduplicates.
    queueMicrotask(() => toast.apiError(error));
  };

  const fail = (error: unknown) => {
    const httpError = error instanceof HttpErrorResponse ? error : undefined;
    const backgroundFailure = req.context.get(BACKGROUND_REQUEST)
      && (!httpError || httpError.status === 0 || httpError.status >= 500);
    const inactiveLogin = isLoginRequest && httpError?.error?.code === 'ACCOUNT_INACTIVE';
    const expected = httpError && req.context.get(EXPECTED_ERROR_STATUSES).includes(httpError.status);
    if (!backgroundFailure && !inactiveLogin && !expected) report(error, httpError?.headers.get('X-Request-ID'));
    if (httpError?.status === 401 && !isLoginRequest) router.navigate(['/login']);
    return throwError(() => error);
  };

  return next(req).pipe(
    timeout(req.context.get(REQUEST_TIMEOUT_MS)),
    tap(event => {
      // Some legacy endpoints return HTTP 200 with {error:true}. Retain the
      // response contract while reporting these failures just like HTTP errors.
      if (event instanceof HttpResponse && event.body && typeof event.body === 'object'
        && 'error' in event.body && event.body.error === true) {
        if (!(isLoginRequest && 'code' in event.body && event.body.code === 'ACCOUNT_INACTIVE')) {
          report(event.body, event.headers.get('X-Request-ID'));
        }
      }
    }),
    catchError((error: unknown) => {
      // Downloads can receive a JSON error as a Blob. Decode it before either
      // the page or the shared toast reads the response.
      if (error instanceof HttpErrorResponse && error.error instanceof Blob) {
        const decoded = error.error.text().then(raw => {
          let body: unknown;
          try { body = JSON.parse(raw); } catch { return error; }
          return new HttpErrorResponse({ error: body, headers: error.headers,
            status: error.status, statusText: error.statusText, url: error.url ?? undefined });
        }).catch(() => error);
        return from(decoded).pipe(mergeMap(fail));
      }
      return fail(error);
    }),
    // Runs after subscribers have applied success/error state to their views.
    finalize(() => viewRefresh.notify()),
  );
};
