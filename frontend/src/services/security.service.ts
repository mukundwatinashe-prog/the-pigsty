import api from './api';

export type SecurityEvent = {
  id: string;
  type: string;
  severity: string;
  ip: string | null;
  email: string | null;
  path: string | null;
  details: string | null;
  acknowledged: boolean;
  createdAt: string;
  user?: { id: string; email: string; name: string } | null;
};

export type ThreatSummary = {
  unacknowledgedHigh: number;
  unacknowledgedCritical: number;
  recent24h: number;
  latestThreats: {
    id: string;
    type: string;
    severity: string;
    email: string | null;
    ip: string | null;
    details: string | null;
    createdAt: string;
    acknowledged: boolean;
  }[];
};

export const securityService = {
  getSummary: () => api.get<ThreatSummary>('/security/summary').then((r) => r.data),
  listEvents: (limit = 100) =>
    api.get<{ events: SecurityEvent[] }>(`/security/events?limit=${limit}`).then((r) => r.data.events),
  acknowledge: (id: string) => api.post(`/security/events/${id}/acknowledge`).then((r) => r.data),
  acknowledgeAll: () => api.post('/security/events/acknowledge-all').then((r) => r.data),
};

export const mfaService = {
  setup: () => api.post<{ secret: string; otpauthUrl: string }>('/auth/mfa/setup').then((r) => r.data),
  enable: (secret: string, code: string) =>
    api.post('/auth/mfa/enable', { secret, code }).then((r) => r.data),
  disable: (code: string) => api.post('/auth/mfa/disable', { code }).then((r) => r.data),
  verifyLogin: (mfaChallenge: string, code: string) =>
    api.post<{ user: import('../types').User }>('/auth/mfa/verify', { mfaChallenge, code }).then((r) => r.data),
};
