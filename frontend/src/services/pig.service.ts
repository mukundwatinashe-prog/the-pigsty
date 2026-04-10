import api from './api';
import type {
  BulkRecordSaleResult,
  FarrowingRecord,
  ImportPreviewRow,
  PaginatedResponse,
  Pig,
  PigBreed,
  PigStage,
  PigStatus,
  HealthStatus,
  SaleRecord,
  SaleType,
  ServicedSowsData,
  Vaccination,
  PigObservation,
  PigObservationCategory,
} from '../types';

export type PigCreatePayload = {
  tagNumber: string;
  breed: PigBreed;
  stage: PigStage;
  dateOfBirth?: string | null;
  acquisitionDate: string;
  entryWeight: number;
  currentWeight?: number;
  status?: PigStatus;
  healthStatus?: HealthStatus;
  serviced?: boolean;
  servicedDate?: string | null;
  weanedDate?: string | null;
  serviceHeatCheckAt?: string | null;
  serviceHeatInHeat?: boolean | null;
  penId?: string | null;
  damId?: string | null;
  sireId?: string | null;
  notes?: string | null;
};

export type PigUpdatePayload = Partial<PigCreatePayload>;

export type AddFarrowingPayload = {
  farrowingDate: string;
  pigletsBornAlive: number;
  pigletsBornDead?: number;
  pigletsWeaned?: number | null;
  weaningDate?: string | null;
  avgBirthWeightKg?: number | null;
  ironDate?: string | null;
  tailDockedDate?: string | null;
  teatClippedDate?: string | null;
  notes?: string | null;
};

export type UpdateFarrowingPayload = {
  pigletsWeaned?: number | null;
  weaningDate?: string | null;
  avgBirthWeightKg?: number | null;
  ironDate?: string | null;
  tailDockedDate?: string | null;
  teatClippedDate?: string | null;
  notes?: string | null;
};

export type CompleteBirthPayload = {
  farrowingDate: string;
  pigletsBornAlive: number;
  pigletsBornDead?: number;
  pigletsBornTotal?: number;
  birthWeight?: number | null;
  complications?: string | null;
  notes?: string | null;
};

export type RecordSalePayload = {
  saleType: SaleType;
  saleDate: string;
  weightAtSale: number;
  buyer?: string | null;
  notes?: string | null;
};

export type BulkRecordSalePayload = {
  saleType: SaleType;
  saleDate: string;
  buyer?: string | null;
  notes?: string | null;
  items: { pigId: string; weightAtSale: number }[];
};

export type VaccinationPayload = {
  name: string;
  batchNumber?: string | null;
  dateAdministered: string;
  nextDueDate?: string | null;
  administeredBy?: string | null;
};

export type VaccinationUpdatePayload = Partial<VaccinationPayload>;

export type AddPigObservationPayload = {
  category: PigObservationCategory;
  notes?: string | null;
};

/** Response from POST .../pigs/import (validate upload). */
export interface ValidateImportResponse {
  total: number;
  valid: number;
  errors: number;
  preview: ImportPreviewRow[];
}

export interface ConfirmImportResponse {
  imported: number;
  total: number;
  errors: number;
}

export const pigService = {
  list: (farmId: string, params?: Record<string, string>) =>
    api.get<PaginatedResponse<Pig>>(`/farms/${farmId}/pigs`, { params }).then((r) => r.data),

  getById: (farmId: string, pigId: string) =>
    api.get<Pig>(`/farms/${farmId}/pigs/${pigId}`).then((r) => r.data),

  create: (farmId: string, data: PigCreatePayload) =>
    api.post<Pig>(`/farms/${farmId}/pigs`, data).then((r) => r.data),

  update: (farmId: string, pigId: string, data: PigUpdatePayload) =>
    api.patch<Pig>(`/farms/${farmId}/pigs/${pigId}`, data).then((r) => r.data),

  delete: (farmId: string, pigId: string) =>
    api.delete(`/farms/${farmId}/pigs/${pigId}`).then((r) => r.data),

  downloadTemplate: (farmId: string) =>
    api.get(`/farms/${farmId}/pigs/import/template`, { responseType: 'blob' }).then((r) => {
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
    return api
      .post<ValidateImportResponse>(`/farms/${farmId}/pigs/import`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },

  confirmImport: (farmId: string, preview: ImportPreviewRow[]) =>
    api
      .post<ConfirmImportResponse>(`/farms/${farmId}/pigs/import/confirm`, { preview })
      .then((r) => r.data),

  addFarrowing: (farmId: string, pigId: string, data: AddFarrowingPayload) =>
    api.post<FarrowingRecord>(`/farms/${farmId}/pigs/${pigId}/farrowing`, data).then((r) => r.data),

  updateFarrowing: (farmId: string, pigId: string, recordId: string, data: UpdateFarrowingPayload) =>
    api
      .patch<FarrowingRecord>(`/farms/${farmId}/pigs/${pigId}/farrowing/${recordId}`, data)
      .then((r) => r.data),

  completeBirth: (farmId: string, pigId: string, data: CompleteBirthPayload) =>
    api.post<FarrowingRecord>(`/farms/${farmId}/pigs/${pigId}/complete-birth`, data).then((r) => r.data),

  recordSale: (farmId: string, pigId: string, data: RecordSalePayload) =>
    api.post<SaleRecord>(`/farms/${farmId}/pigs/${pigId}/record-sale`, data).then((r) => r.data),

  bulkRecordSale: (farmId: string, data: BulkRecordSalePayload) =>
    api
      .post<BulkRecordSaleResult>(`/farms/${farmId}/pigs/bulk-record-sale`, data)
      .then((r) => r.data),

  addVaccination: (farmId: string, pigId: string, data: VaccinationPayload) =>
    api.post<Vaccination>(`/farms/${farmId}/pigs/${pigId}/vaccinations`, data).then((r) => r.data),

  updateVaccination: (farmId: string, pigId: string, vaccinationId: string, data: VaccinationUpdatePayload) =>
    api
      .patch<Vaccination>(`/farms/${farmId}/pigs/${pigId}/vaccinations/${vaccinationId}`, data)
      .then((r) => r.data),

  deleteVaccination: (farmId: string, pigId: string, vaccinationId: string) =>
    api.delete(`/farms/${farmId}/pigs/${pigId}/vaccinations/${vaccinationId}`).then((r) => r.data),

  addObservation: (farmId: string, pigId: string, data: AddPigObservationPayload) =>
    api.post<PigObservation>(`/farms/${farmId}/pigs/${pigId}/observations`, data).then((r) => r.data),

  getServicedSows: (farmId: string) =>
    api.get<ServicedSowsData>(`/farms/${farmId}/pigs/serviced-sows`).then((r) => r.data),

  exportServicedSows: (farmId: string, format: 'xlsx' | 'pdf') =>
    api
      .get(`/farms/${farmId}/pigs/serviced-sows`, {
        params: { format },
        responseType: 'blob',
      })
      .then((r) => {
        const ext = format === 'xlsx' ? 'xlsx' : 'pdf';
        const url = window.URL.createObjectURL(new Blob([r.data]));
        const a = document.createElement('a');
        a.href = url;
        a.download = `serviced_sows.${ext}`;
        a.click();
        window.URL.revokeObjectURL(url);
      }),
};
