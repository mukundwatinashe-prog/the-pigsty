import axios from 'axios';
import {
  isNativeApp,
  hydrateAuthTokens,
  getAccessTokenSync,
  getRefreshTokenSync,
  setAuthTokens,
  clearAuthTokens,
} from '../lib/native';

/** Production API host when the SPA is served from the-pigsty.org (API is on api.the-pigsty.org). */
const PRODUCTION_API_BASE = 'https://api.the-pigsty.org/api';

export function resolveApiBaseURL(): string {
  const envApiBase = import.meta.env.VITE_API_BASE_URL?.trim();
  if (envApiBase) return envApiBase.replace(/\/+$/, '');

  // Native shells load from capacitor://localhost or http://localhost, so the
  // hostname is "localhost" — but there is NO dev proxy there. Native must always
  // call the absolute API host, never a relative "/api". (Belt-and-suspenders in
  // case a build ever ships without VITE_API_BASE_URL baked in.)
  if (isNativeApp()) return PRODUCTION_API_BASE;

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return '/api';
    if (host === 'the-pigsty.org' || host === 'www.the-pigsty.org') {
      return PRODUCTION_API_BASE;
    }
  }

  if (import.meta.env.PROD) return PRODUCTION_API_BASE;

  return '/api';
}

function withBase(path: string): string {
  return `${resolveApiBaseURL()}${path.startsWith('/') ? path : `/${path}`}`;
}

/** User-facing message for failed API calls (network, CORS, server errors). */
export function apiErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  const e = err as {
    response?: { status?: number; data?: { message?: string } };
    code?: string;
    message?: string;
  };
  const status = e.response?.status;
  const serverMsg = e.response?.data?.message;
  if (status === 402) {
    return 'This feature requires a Grower or Enterprise plan. Open Billing to upgrade.';
  }
  if (status === 404) {
    return 'Could not reach the API (404). Try a hard refresh (Ctrl+Shift+R). If it persists, the app may be outdated — contact support.';
  }
  if (status === 502 || status === 503 || status === 504) {
    // Provider/AI failures (e.g. AI credits exhausted) send a specific, useful
    // message in the body — surface it rather than a generic gateway error.
    if (typeof serverMsg === 'string' && serverMsg.trim()) return serverMsg;
    return 'The service is temporarily unavailable. Please try again in a moment.';
  }
  if (typeof serverMsg === 'string' && serverMsg.trim()) return serverMsg;
  if (e.code === 'ERR_NETWORK' || e.code === 'ECONNABORTED' || e.message === 'Network Error') {
    return 'Cannot reach the server. Please check your connection and try again.';
  }
  if (typeof e.message === 'string' && e.message.trim()) return e.message;
  return fallback;
}

const api = axios.create({
  baseURL: resolveApiBaseURL(),
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
  /** Avoid infinite spinners when the API or dev proxy is unreachable. */
  timeout: 15_000,
});

api.interceptors.request.use(async (config) => {
  config.baseURL = resolveApiBaseURL();
  // Native shells can't rely on cookies — send a Bearer token and flag the client
  // so the API returns fresh tokens in the response body.
  if (isNativeApp()) {
    await hydrateAuthTokens();
    config.headers.set('X-Client', 'mobile');
    const token = getAccessTokenSync();
    if (token) config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

let refreshInFlight: Promise<void> | null = null;

function refreshSession(): Promise<void> {
  if (!refreshInFlight) {
    const native = isNativeApp();
    // Web refreshes via the httpOnly cookie; native sends the stored refresh token
    // and persists the rotated tokens returned in the body.
    const body = native ? { refreshToken: getRefreshTokenSync() } : {};
    const headers = native ? { 'X-Client': 'mobile' } : undefined;
    refreshInFlight = axios
      .post(withBase('/auth/refresh'), body, { withCredentials: true, headers })
      .then(async (res) => {
        if (native) {
          const d = res.data as { accessToken?: string; refreshToken?: string };
          if (d?.accessToken && d?.refreshToken) {
            await setAuthTokens(d.accessToken, d.refreshToken);
          }
        }
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

function shouldSkipRefreshRetry(config: { url?: string; method?: string }): boolean {
  const u = config.url ?? '';
  return (
    u.includes('/auth/me') ||
    u.includes('/auth/login') ||
    u.includes('/auth/register') ||
    u.includes('/auth/google') ||
    u.includes('/auth/forgot-password') ||
    u.includes('/auth/reset-password') ||
    u.includes('/auth/refresh')
  );
}

api.interceptors.response.use(
  (response) => {
    // On native, persist any tokens the API returns (login/register/google/mfa)
    // and drop them on logout.
    if (isNativeApp()) {
      const d = response.data as { accessToken?: string; refreshToken?: string } | undefined;
      if (d?.accessToken && d?.refreshToken) {
        void setAuthTokens(d.accessToken, d.refreshToken);
      }
      if ((response.config?.url ?? '').includes('/auth/logout')) {
        void clearAuthTokens();
      }
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !shouldSkipRefreshRetry(originalRequest)
    ) {
      originalRequest._retry = true;
      try {
        await refreshSession();
        return api(originalRequest);
      } catch {
        const path = window.location.pathname;
        const publicAuth = ['/login', '/register', '/forgot-password', '/reset-password'].some(
          (p) => path === p || path.startsWith(`${p}/`),
        );
        if (!publicAuth) window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

/** @deprecated Use resolveApiBaseURL() — resolved per request for correct production routing. */
export const apiBaseURL = resolveApiBaseURL();

export { withBase };
export default api;
