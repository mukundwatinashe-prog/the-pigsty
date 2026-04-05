import api from './api';

export const weightService = {
  log: (farmId: string, data: { pigId: string; weight: number; date: string; notes?: string }) =>
    api.post(`/farms/${farmId}/weights`, data).then(r => r.data),

  bulkLog: (farmId: string, data: {
    penId: string;
    date: string;
    notes?: string;
    weights: { pigId: string; weight: number }[];
  }) =>
    api.post(`/farms/${farmId}/weights/bulk`, data).then(r => r.data),

  getHistory: (farmId: string, pigId: string) =>
    api.get(`/farms/${farmId}/pigs/${pigId}/weights`).then(r => r.data),

  getRecent: (farmId: string, params?: Record<string, string>) =>
    api.get(`/farms/${farmId}/weights`, { params }).then(r => r.data),
};
