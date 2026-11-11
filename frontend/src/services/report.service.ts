import type { AxiosResponse } from 'axios';
import api from './api';
import { saveBlob } from '../lib/download';

const downloadFile = (response: AxiosResponse<Blob>, filename: string) =>
  saveBlob(new Blob([response.data]), filename);

export const reportService = {
  herdInventory: (farmId: string, format: string, params?: Record<string, string>) => {
    if (format === 'json') {
      return api.get(`/farms/${farmId}/reports/herd-inventory`, { params: { ...params, format } }).then(r => r.data);
    }
    return api.get(`/farms/${farmId}/reports/herd-inventory`, {
      params: { ...params, format },
      responseType: 'blob',
    }).then(r => downloadFile(r, `herd_inventory.${format === 'pdf' ? 'pdf' : 'xlsx'}`));
  },

  weightGain: (farmId: string, format: string, params?: Record<string, string>) => {
    if (format === 'json') {
      return api.get(`/farms/${farmId}/reports/weight-gain`, { params: { ...params, format } }).then(r => r.data);
    }
    return api.get(`/farms/${farmId}/reports/weight-gain`, {
      params: { ...params, format },
      responseType: 'blob',
    }).then(r => downloadFile(r, `weight_gain.${format === 'pdf' ? 'pdf' : 'xlsx'}`));
  },

  activityLog: (farmId: string, format: string, params?: Record<string, string>) => {
    if (format === 'json' || !format) {
      return api.get(`/farms/${farmId}/reports/activity-log`, { params: { ...params, format } }).then(r => r.data);
    }
    return api.get(`/farms/${farmId}/reports/activity-log`, {
      params: { ...params, format },
      responseType: 'blob',
    }).then(r => downloadFile(r, `activity_log.xlsx`));
  },

  salesReport: (farmId: string, format: string, params?: Record<string, string>) => {
    if (format === 'json') {
      return api.get(`/farms/${farmId}/reports/sales`, { params: { ...params, format } }).then(r => r.data);
    }
    return api.get(`/farms/${farmId}/reports/sales`, {
      params: { ...params, format },
      responseType: 'blob',
    }).then(r => downloadFile(r, `sales_report.${format === 'pdf' ? 'pdf' : 'xlsx'}`));
  },

  dailySummary: (farmId: string, format: string) => {
    if (format === 'json') {
      return api.get(`/farms/${farmId}/reports/daily-summary`, { params: { format } }).then(r => r.data);
    }
    return api.get(`/farms/${farmId}/reports/daily-summary`, {
      params: { format },
      responseType: 'blob',
    }).then(r => downloadFile(r, `daily_summary.pdf`));
  },

  financials: (farmId: string, format: 'pdf' | 'xlsx', params?: { from?: string; to?: string }) =>
    api
      .get(`/farms/${farmId}/reports/financials`, {
        params: { format, ...params },
        responseType: 'blob',
      })
      .then((r) => downloadFile(r, `financials.${format === 'pdf' ? 'pdf' : 'xlsx'}`)),
};
