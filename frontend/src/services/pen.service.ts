import api from './api';
import type { Pen, PenWithPigs } from '../types';

export const penService = {
  list: (farmId: string) =>
    api.get<Pen[]>(`/farms/${farmId}/pens`).then(r => r.data),

  getById: (farmId: string, penId: string) =>
    api.get<PenWithPigs>(`/farms/${farmId}/pens/${penId}`).then((r) => r.data),

  create: (farmId: string, data: { name: string; type: string; capacity: number }) =>
    api.post<Pen>(`/farms/${farmId}/pens`, data).then(r => r.data),

  update: (farmId: string, penId: string, data: Partial<Pen>) =>
    api.patch<Pen>(`/farms/${farmId}/pens/${penId}`, data).then(r => r.data),

  delete: (farmId: string, penId: string) =>
    api.delete(`/farms/${farmId}/pens/${penId}`).then(r => r.data),
};
