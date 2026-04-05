import api from './api';
import type { Pig, PaginatedResponse, FarrowingRecord, ServicedSowsData, SaleRecord } from '../types';

export const pigService = {
  list: (farmId: string, params?: Record<string, string>) =>
    api.get<PaginatedResponse<Pig>>(`/farms/${farmId}/pigs`, { params }).then(r => r.data),

  getById: (farmId: string, pigId: string) =>
    api.get<Pig>(`/farms/${farmId}/pigs/${pigId}`).then(r => r.data),

  create: (farmId: string, data: any) =>
    api.post<Pig>(`/farms/${farmId}/pigs`, data).then(r => r.data),

  update: (farmId: string, pigId: string, data: any) =>
    api.patch<Pig>(`/farms/${farmId}/pigs/${pigId}`, data).then(r => r.data),

  delete: (farmId: string, pigId: string) =>
    api.delete(`/farms/${farmId}/pigs/${pigId}`).then(r => r.data),

  downloadTemplate: (farmId: string) =>
    api.get(`/farms/${farmId}/pigs/import/template`, { responseType: 'blob' }).then(r => {
      const url = window.URL.createObjectURL(new Blob([r.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'pigtrack_import_template.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
    }),

  validateImport: (farmId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post(`/farms/${farmId}/pigs/import`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data);
  },

  confirmImport: (farmId: string, preview: any[]) =>
    api.post(`/farms/${farmId}/pigs/import/confirm`, { preview }).then(r => r.data),

  addFarrowing: (farmId: string, pigId: string, data: any) =>
    api.post<FarrowingRecord>(`/farms/${farmId}/pigs/${pigId}/farrowing`, data).then(r => r.data),

  completeBirth: (farmId: string, pigId: string, data: any) =>
    api.post<FarrowingRecord>(`/farms/${farmId}/pigs/${pigId}/complete-birth`, data).then(r => r.data),

  recordSale: (farmId: string, pigId: string, data: any) =>
    api.post<SaleRecord>(`/farms/${farmId}/pigs/${pigId}/record-sale`, data).then(r => r.data),

  getServicedSows: (farmId: string) =>
    api.get<ServicedSowsData>(`/farms/${farmId}/pigs/serviced-sows`).then(r => r.data),

  exportServicedSows: (farmId: string, format: 'xlsx' | 'pdf') =>
    api.get(`/farms/${farmId}/pigs/serviced-sows`, {
      params: { format },
      responseType: 'blob',
    }).then(r => {
      const ext = format === 'xlsx' ? 'xlsx' : 'pdf';
      const url = window.URL.createObjectURL(new Blob([r.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `serviced_sows.${ext}`;
      a.click();
      window.URL.revokeObjectURL(url);
    }),
};
