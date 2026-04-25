import axios from 'axios';

const envApiBase = import.meta.env.VITE_API_BASE_URL?.trim();
const normalizedApiBase = envApiBase ? envApiBase.replace(/\/+$/, '') : '';
const fallbackApiBase = (() => {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname.toLowerCase();
    if (host === 'the-pigsty.org' || host.endsWith('.the-pigsty.org')) {
      return 'https://api.the-pigsty.org/api';
    }
  }
  return '/api';
})();
const apiBaseURL = normalizedApiBase || fallbackApiBase;

function withBase(path: string): string {
  return `${apiBaseURL}${path.startsWith('/') ? path : `/${path}`}`;
}

/** User-facing message for failed API calls (network, CORS, server errors). */
export function apiErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  const e = err as {
    response?: { status?: number; data?: { message?: string } };
    code?: string;
    message?: string;
  };
  const status = e.response?.status;
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
  baseURL: apiBaseURL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
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

export { apiBaseURL, withBase };
export default api;
