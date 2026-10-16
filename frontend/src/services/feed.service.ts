import type { AxiosResponse } from 'axios';
import api, { withBase } from './api';
import { saveBlob } from '../lib/download';
import type { FeedType } from '../types';

const downloadBlob = (response: AxiosResponse<Blob>, filename: string) =>
  saveBlob(new Blob([response.data]), filename);

export type FeedSummary = {
  currency: string;
  stock: { feedType: FeedType; stockKg: number }[];
  lowStockThresholdKg: number;
  lowStockFeedTypes: FeedType[];
  monthSpendByType: { feedType: FeedType; spend: number; kgPurchased: number }[];
  monthSpendTotal: number;
};

export type FeedDailyEntry = {
  id: string;
  usageDate: string;
  maizeBuckets: number;
  soyaBuckets: number;
  premixBuckets: number;
  concentrateBuckets: number;
  lactatingBuckets: number;
  weanerBuckets: number;
  kgByType: { feedType: FeedType; kg: number }[];
  notes?: string | null;
  submittedAt: string;
  editableUntil: string;
  user: { id: string; name: string };
};

export type CreatePurchasePayload = {
  feedType: FeedType;
  quantityKg: number;
  supplier?: string | null;
  purchasedAt: string;
};

export const feedService = {
  getSummary(farmId: string) {
    return api.get<FeedSummary>(`/farms/${farmId}/feed/summary`).then((r) => r.data);
  },

  getStock(farmId: string) {
    return api.get(`/farms/${farmId}/feed/stock`).then((r) => r.data);
  },

  listPurchases(farmId: string) {
    return api
      .get<{
        purchases: {
          id: string;
          feedType: FeedType;
          quantityKg: number;
          totalCost: number;
          supplier?: string | null;
          purchasedAt: string;
          createdBy?: { id: string; name: string } | null;
        }[];
      }>(`/farms/${farmId}/feed/purchases`)
      .then((r) => r.data);
  },

  exportPurchaseHistory(farmId: string, format: 'pdf' | 'xlsx') {
    const q = new URLSearchParams({ format });
    return api
      .get(`/farms/${farmId}/feed/purchases/export?${q.toString()}`, { responseType: 'blob' })
      .then((r) => downloadBlob(r, `feed_purchase_history.${format === 'pdf' ? 'pdf' : 'xlsx'}`));
  },

  async createPurchase(farmId: string, payload: CreatePurchasePayload, receiptFile: File) {
    const form = new FormData();
    form.append('data', JSON.stringify(payload));
    form.append('receipt', receiptFile);
    // Must go through the axios instance (not raw fetch) so native builds attach the
    // Bearer token and X-Client header — otherwise the upload 401s with "authentication
    // required" on mobile, where there is no auth cookie. Let the browser set the
    // multipart boundary by overriding the instance's default JSON content-type.
    const res = await api.post(`/farms/${farmId}/feed/purchases`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  receiptUrl(farmId: string, purchaseId: string) {
    return withBase(`/farms/${farmId}/feed/purchases/${purchaseId}/receipt`);
  },

  /**
   * Fetches a receipt with the app's auth and hands it to saveBlob. Needed in the
   * native app: a plain link to receiptUrl opens the API in the WebView without the
   * Bearer token (401) and navigates away from the app.
   */
  async openReceipt(farmId: string, purchaseId: string) {
    const res = await api.get<Blob>(`/farms/${farmId}/feed/purchases/${purchaseId}/receipt`, {
      responseType: 'blob',
    });
    const type = res.data.type || '';
    const ext = type.includes('pdf') ? 'pdf' : type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg';
    await saveBlob(res.data, `receipt-${purchaseId.slice(0, 8)}.${ext}`);
  },

  listDailyUsage(farmId: string, params?: { from?: string; to?: string }) {
    const q = new URLSearchParams();
    if (params?.from) q.set('from', params.from);
    if (params?.to) q.set('to', params.to);
    const qs = q.toString();
    return api
      .get<{ entries: FeedDailyEntry[] }>(`/farms/${farmId}/feed/daily${qs ? `?${qs}` : ''}`)
      .then((r) => r.data);
  },

  getDailyByDate(farmId: string, date: string) {
    return api.get<{ entry: FeedDailyEntry | null }>(`/farms/${farmId}/feed/daily/${date}`).then((r) => r.data);
  },

  upsertDailyUsage(
    farmId: string,
    date: string,
    body: {
      maizeBuckets: number;
      soyaBuckets: number;
      premixBuckets: number;
      concentrateBuckets: number;
      lactatingBuckets: number;
      weanerBuckets: number;
      notes?: string | null;
    },
  ) {
    return api.put<{ entry: FeedDailyEntry }>(`/farms/${farmId}/feed/daily/${date}`, body).then((r) => r.data);
  },

  getReports(farmId: string, range: 'daily' | 'weekly' | 'monthly', date?: string) {
    const q = new URLSearchParams({ range });
    if (date) q.set('date', date);
    return api.get(`/farms/${farmId}/feed/reports?${q.toString()}`).then((r) => r.data);
  },

  exportReports(farmId: string, format: 'pdf' | 'xlsx', range: 'daily' | 'weekly' | 'monthly', date?: string) {
    const q = new URLSearchParams({ format, range });
    if (date) q.set('date', date);
    return api
      .get(`/farms/${farmId}/feed/reports/export?${q.toString()}`, { responseType: 'blob' })
      .then((r) => downloadBlob(r, `feed_report.${format === 'pdf' ? 'pdf' : 'xlsx'}`));
  },

  getCosts(farmId: string, from?: string, to?: string) {
    const q = new URLSearchParams();
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    const qs = q.toString();
    return api.get(`/farms/${farmId}/feed/costs${qs ? `?${qs}` : ''}`).then((r) => r.data);
  },
};
