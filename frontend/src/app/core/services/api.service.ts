import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, timeout } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private baseUrl = environment.apiUrl;
  private requestTimeoutMs = 20000;

  private normalizeResponse<T>(response: T): T {
    if (!response || typeof response !== 'object' || Array.isArray(response)) {
      return response;
    }

    const payload = response as Record<string, unknown>;
    if ('data' in payload) {
      return response;
    }

    if (Array.isArray(payload['users'])) {
      return { ...payload, data: payload['users'] } as T;
    }
    if (Array.isArray(payload['applications'])) {
      return { ...payload, data: payload['applications'] } as T;
    }
    if (Array.isArray(payload['announcements'])) {
      return { ...payload, data: payload['announcements'] } as T;
    }
    if (Array.isArray(payload['referees'])) {
      return { ...payload, data: payload['referees'] } as T;
    }
    if (Array.isArray(payload['matches'])) {
      return { ...payload, data: payload['matches'] } as T;
    }
    if (Array.isArray(payload['assignments'])) {
      return { ...payload, data: payload['assignments'] } as T;
    }
    if (Array.isArray(payload['assessments'])) {
      return { ...payload, data: payload['assessments'] } as T;
    }
    if (Array.isArray(payload['tasks'])) {
      return { ...payload, data: payload['tasks'] } as T;
    }
    if (Array.isArray(payload['notifications'])) {
      return { ...payload, data: payload['notifications'] } as T;
    }
    if ('profile' in payload && typeof payload['profile'] === 'object' && !Array.isArray(payload['profile'])) {
      return { ...payload, data: payload['profile'] } as T;
    }
    if ('user' in payload) {
      return { ...payload, data: payload['user'] } as T;
    }
    if ('announcement' in payload) {
      return { ...payload, data: payload['announcement'] } as T;
    }
    if ('overview' in payload || 'top_referees' in payload || 'current_assignments' in payload) {
      return {
        ...payload,
        data: {
          overview: payload['overview'] ?? {},
          top_referees: payload['top_referees'] ?? [],
          current_assignments: payload['current_assignments'] ?? [],
        },
      } as T;
    }
    if ('stats' in payload || 'pendingMatches' in payload) {
      return {
        ...payload,
        data: {
          stats: payload['stats'] ?? {},
          recent: payload['pendingMatches'] ?? [],
        },
      } as T;
    }

    return response;
  }

  constructor(private http: HttpClient) {}

  get<T>(endpoint: string, params?: Record<string, string>): Observable<T> {
    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        httpParams = httpParams.set(key, value);
      });
    }
    return this.http.get<T>(`${this.baseUrl}/${endpoint}`, {
      params: httpParams,
      withCredentials: true,
    }).pipe(
      timeout(this.requestTimeoutMs),
      map((response) => this.normalizeResponse(response)),
    );
  }

  post<T>(endpoint: string, body: unknown): Observable<T> {
    return this.http.post<T>(`${this.baseUrl}/${endpoint}`, body, {
      withCredentials: true,
    }).pipe(
      timeout(this.requestTimeoutMs),
      map((response) => this.normalizeResponse(response)),
    );
  }

  put<T>(endpoint: string, body: unknown): Observable<T> {
    return this.http.put<T>(`${this.baseUrl}/${endpoint}`, body, {
      withCredentials: true,
    }).pipe(
      timeout(this.requestTimeoutMs),
      map((response) => this.normalizeResponse(response)),
    );
  }

  patch<T>(endpoint: string, body: unknown): Observable<T> {
    return this.http.patch<T>(`${this.baseUrl}/${endpoint}`, body, {
      withCredentials: true,
    }).pipe(
      timeout(this.requestTimeoutMs),
      map((response) => this.normalizeResponse(response)),
    );
  }

  delete<T>(endpoint: string, body?: any): Observable<T> {
    return this.http.delete<T>(`${this.baseUrl}/${endpoint}`, {
      withCredentials: true,
      body,
    }).pipe(
      timeout(this.requestTimeoutMs),
      map((response) => this.normalizeResponse(response)),
    );
  }

  postFormData<T>(endpoint: string, formData: FormData): Observable<T> {
    return this.http.post<T>(`${this.baseUrl}/${endpoint}`, formData, {
      withCredentials: true,
    }).pipe(
      timeout(this.requestTimeoutMs),
      map((response) => this.normalizeResponse(response)),
    );
  }
}
