import axios from 'axios';

/** Production API host when the SPA is served from the-pigsty.org (API is on api.the-pigsty.org). */
const PRODUCTION_API_BASE = 'https://api.the-pigsty.org/api';

export function resolveApiBaseURL(): string {
  const envApiBase = import.meta.env.VITE_API_BASE_URL?.trim();
  if (envApiBase) return envApiBase.replace(/\/+$/, '');

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
  if (status === 402) {
    return 'This feature requires a Grower or Enterprise plan. Open Billing to upgrade.';
  }
  if (status === 404) {
    return 'Could not reach the API (404). Try a hard refresh (Ctrl+Shift+R). If it persists, the app may be outdated — contact support.';
  }
  if (status === 502 || status === 503 || status === 504) {
    return 'API unavailable (bad gateway). The dev server proxies /api to port 4000 — start the backend: cd backend && npm run dev. Or from the repo root: npm install && npm run dev. Check http://localhost:4000/api/health responds.';
  }
  const serverMsg = e.response?.data?.message;
  if (typeof serverMsg === 'string' && serverMsg.trim()) return serverMsg;
  if (e.code === 'ERR_NETWORK' || e.code === 'ECONNABORTED' || e.message === 'Network Error') {
    return 'Cannot reach the server. From the project root, run the API with: cd backend && npm run dev — then open the app at http://localhost:5173 (not a production build unless the API URL is configured).';
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

api.interceptors.request.use((config) => {
  config.baseURL = resolveApiBaseURL();
  return config;
});

let refreshInFlight: Promise<void> | null = null;

function refreshSession(): Promise<void> {
  if (!refreshInFlight) {
    refreshInFlight = axios
      .post(withBase('/auth/refresh'), {}, { withCredentials: true })
      .then(() => undefined)
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
  (response) => response,
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
