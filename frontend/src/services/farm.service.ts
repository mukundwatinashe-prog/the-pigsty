import api from './api';
import type { AuditLog, Farm, FarmMember, FarmBillingInfo, PigObservation, Role } from '../types';

export interface FarmDetailResponse {
  farm: Farm & { members: FarmMember[] };
  myRole: Role;
  billing: FarmBillingInfo;
  stats: {
    byStatus: { status: string; _count: number }[];
    avgWeight: number;
    recentActivity: AuditLog[];
    recentPigObservations: PigObservation[];
  };
}

export interface FarmBillingSummary extends FarmBillingInfo {
  myRole: Role;
  stripeConfigured: boolean;
  hasStripeCustomer: boolean;
}

export interface FarmFinancialsResponse {
  farm: {
    name: string;
    currency: string;
    weightUnit: string;
    pricePerKg: number;
  };
  herd: {
    inventoryHeadcount: number;
    totalCurrentWeight: number;
    avgWeight: number;
    estimatedValueAtFarmPrice: number;
  };
  breakdownByStage: { stage: string; count: number; totalWeight: number; estimatedValue: number }[];
  breakdownByPen: {
    penId: string | null;
    penName: string;
    count: number;
    totalWeight: number;
    value: number;
  }[];
  period: { from: string | null; to: string | null };
  salesInPeriod: {
    revenue: number;
    transactionCount: number;
    totalWeightSold: number;
  };
  feedPurchasesInPeriod: {
    totalSpend: number;
    byType: { feedType: string; spend: number; kgPurchased: number }[];
  };
  recentSales: {
    id: string;
    tagNumber: string;
    saleType: string;
    saleDate: string;
    weightAtSale: number;
    pricePerKg: number;
    totalPrice: number;
    buyer: string | null;
  }[];
}

export const farmService = {
  list: () => api.get<(Farm & { role: string })[]>('/farms').then(r => r.data),

  getById: (farmId: string) => api.get<FarmDetailResponse>(`/farms/${farmId}`).then(r => r.data),

  getBilling: (farmId: string) =>
    api.get<FarmBillingSummary>(`/farms/${farmId}/billing`).then(r => r.data),

  getFinancials: (farmId: string, params?: { from?: string; to?: string }) =>
    api.get<FarmFinancialsResponse>(`/farms/${farmId}/financials`, { params }).then((r) => r.data),

  billingCheckout: (farmId: string) =>
    api.post<{ url: string }>(`/farms/${farmId}/billing/checkout`).then(r => r.data),

  billingPortal: (farmId: string) =>
    api.post<{ url: string }>(`/farms/${farmId}/billing/portal`).then(r => r.data),

  create: (data: { name: string; location: string; country: string; currency?: string; timezone?: string; weightUnit?: string }) =>
    api.post<Farm>('/farms', data).then(r => r.data),

  update: (farmId: string, data: Partial<Farm>) =>
    api.patch<Farm>(`/farms/${farmId}`, data).then(r => r.data),

  delete: (farmId: string) => api.delete(`/farms/${farmId}`).then(r => r.data),

  invite: (farmId: string, email: string, role: string) =>
    api.post(`/farms/${farmId}/invite`, { email, role }).then(r => r.data),

  removeMember: (farmId: string, memberId: string) =>
    api.delete(`/farms/${farmId}/members/${memberId}`).then(r => r.data),
};
