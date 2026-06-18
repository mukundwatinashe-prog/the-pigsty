import api from './api';

export type FarmPlan = 'FREE' | 'GROWER' | 'ENTERPRISE';

export type TrialInfo = {
  isOnTrial: boolean;
  trialEndsAt: string | null;
  daysLeft: number | null;
};

export type AdminUserFarm = {
  farmId: string;
  farmName: string;
  plan: FarmPlan;
  role: string;
  memberCount: number;
  pigCount: number;
  hasStripe: boolean;
  isDeleted: boolean;
  trial: TrialInfo;
};

export type AdminUser = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  createdAt: string;
  mfaEnabled: boolean;
  growerTrialUsedAt: string | null;
  loginLockedUntil: string | null;
  passwordResetLockedUntil: string | null;
  hasGoogleAuth: boolean;
  ownedFarmCount: number;
  highestOwnedPlan: FarmPlan;
  isPaying: boolean;
  activeTrial: TrialInfo | null;
  farms: AdminUserFarm[];
};

export type AdminSummary = {
  totalUsers: number;
  totalFarms: number;
  farmsByPlan: Record<FarmPlan, number>;
  payingOwners: number;
  freeOwners: number;
  activeTrials: number;
};

export type AdminUsersResponse = {
  users: AdminUser[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type AdminPlanFilter = 'ALL' | 'TRIAL' | FarmPlan;

export type SetFarmPlanResult = {
  id: string;
  name: string;
  previousPlan: FarmPlan;
  plan: FarmPlan;
  hadStripe: boolean;
  stripeCanceled: boolean;
};

export type AdminFarm = {
  farmId: string;
  farmName: string;
  plan: FarmPlan;
  country: string;
  pigCount: number;
  memberCount: number;
  hasStripe: boolean;
  createdAt: string;
  owner: { id: string; name: string; email: string } | null;
  trial: TrialInfo;
};

export type AdminFarmsResponse = {
  farms: AdminFarm[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export const adminService = {
  getSummary: () => api.get<AdminSummary>('/admin/summary').then((r) => r.data),

  listUsers: (params: { page?: number; pageSize?: number; plan?: AdminPlanFilter; search?: string }) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.pageSize) qs.set('pageSize', String(params.pageSize));
    if (params.plan && params.plan !== 'ALL') qs.set('plan', params.plan);
    if (params.search) qs.set('search', params.search);
    const q = qs.toString();
    return api.get<AdminUsersResponse>(`/admin/users${q ? `?${q}` : ''}`).then((r) => r.data);
  },

  listFarms: (params: { page?: number; pageSize?: number; plan?: AdminPlanFilter; search?: string }) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.pageSize) qs.set('pageSize', String(params.pageSize));
    if (params.plan && params.plan !== 'ALL') qs.set('plan', params.plan);
    if (params.search) qs.set('search', params.search);
    const q = qs.toString();
    return api.get<AdminFarmsResponse>(`/admin/farms${q ? `?${q}` : ''}`).then((r) => r.data);
  },

  getUser: (userId: string) =>
    api.get<{ user: AdminUser }>(`/admin/users/${userId}`).then((r) => r.data.user),

  unlockUser: (userId: string) =>
    api.post(`/admin/users/${userId}/unlock`).then((r) => r.data),

  forceLogout: (userId: string) =>
    api.post(`/admin/users/${userId}/logout`).then((r) => r.data),

  resetGrowerTrial: (userId: string) =>
    api.post(`/admin/users/${userId}/reset-trial`).then((r) => r.data),

  updateUser: (userId: string, data: { name?: string; phone?: string | null }) =>
    api.patch(`/admin/users/${userId}`, data).then((r) => r.data),

  setFarmPlan: (farmId: string, plan: FarmPlan) =>
    api.patch<SetFarmPlanResult>(`/admin/farms/${farmId}/plan`, { plan }).then((r) => r.data),

  deleteUser: (userId: string, confirmEmail: string) =>
    api.delete(`/admin/users/${userId}`, { data: { confirmEmail } }).then((r) => r.data),

  exportCsv: async (params: { plan?: AdminPlanFilter; search?: string }) => {
    const qs = new URLSearchParams();
    if (params.plan && params.plan !== 'ALL') qs.set('plan', params.plan);
    if (params.search) qs.set('search', params.search);
    const q = qs.toString();
    const response = await api.get(`/admin/users/export${q ? `?${q}` : ''}`, { responseType: 'blob' });
    const blob = response.data as Blob;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pigsty-users-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },
};
