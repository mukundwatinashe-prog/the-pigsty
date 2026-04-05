import axios from 'axios';

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
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        const { data } = await axios.post('/api/auth/refresh', { refreshToken });
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(originalRequest);
      } catch {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
