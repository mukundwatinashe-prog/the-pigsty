export type Role = 'OWNER' | 'FARM_MANAGER' | 'WORKER';
export type FarmPlan = 'FREE' | 'PRO';
export type PigBreed = 'LARGE_WHITE' | 'LANDRACE' | 'DUROC' | 'PIETRAIN' | 'BERKSHIRE' | 'HAMPSHIRE' | 'CHESTER_WHITE' | 'YORKSHIRE' | 'TAMWORTH' | 'MUKOTA' | 'KOLBROEK' | 'WINDSNYER' | 'SA_LANDRACE' | 'INDIGENOUS' | 'CROSSBREED' | 'OTHER';
export type PigStage =
  | 'BOAR'
  | 'SOW'
  | 'GILT'
  | 'WEANER'
  | 'PIGLET'
  | 'PORKER'
  | 'GROWER'
  | 'FINISHER';
export type PigStatus = 'ACTIVE' | 'SOLD' | 'DECEASED' | 'QUARANTINE';
export type HealthStatus = 'HEALTHY' | 'SICK' | 'UNDER_TREATMENT' | 'RECOVERED';
export type PenType = 'FARROWING' | 'GROWER' | 'FINISHER' | 'BOAR' | 'QUARANTINE' | 'NURSERY';

export type FeedType =
  | 'MAIZE_CRECHE'
  | 'SOYA'
  | 'PREMIX'
  | 'CONCENTRATE'
  | 'LACTATING'
  | 'WEANER';

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  photo?: string;
  createdAt: string;
}

export interface Farm {
  id: string;
  name: string;
  logoUrl?: string | null;
  location: string;
  country: string;
  currency: string;
  timezone: string;
  weightUnit: string;
  pricePerKg: number;
  feedLowStockThresholdKg?: number | null;
  /** Default bucket amounts per feed type — pre-fills daily usage for new days */
  feedDefaultDailyBuckets?: Partial<Record<FeedType, number>> | null;
  /** KG = prices below are per kg; TONNE = per metric tonne */
  feedPurchasePriceUnit?: 'KG' | 'TONNE';
  /** Purchase price per feed type in farm currency (unit from feedPurchasePriceUnit) */
  feedPurchasePrices?: Partial<Record<FeedType, number>> | null;
  createdAt: string;
  plan?: FarmPlan;
  _count?: { pigs: number; pens: number; members: number };
}

export interface FarmBillingInfo {
  plan: FarmPlan;
  pigCount: number;
  pigLimit: number | null;
  nearLimit: boolean;
  atLimit: boolean;
}

export interface FarmMember {
  id: string;
  userId: string;
  farmId: string;
  role: Role;
  user: User;
}

export interface Pen {
  id: string;
  farmId: string;
  name: string;
  type: PenType;
  capacity: number;
  _count?: { pigs: number };
}

export interface Pig {
  id: string;
  farmId: string;
  tagNumber: string;
  name?: string | null;
  breed: PigBreed;
  stage: PigStage;
  dateOfBirth?: string;
  acquisitionDate: string;
  entryWeight: number;
  currentWeight: number;
  status: PigStatus;
  healthStatus: HealthStatus;
  serviced?: boolean;
  servicedDate?: string;
  weanedDate?: string | null;
  serviceHeatCheckAt?: string | null;
  serviceHeatInHeat?: boolean | null;
  penId?: string;
  damId?: string;
  sireId?: string;
  notes?: string;
  photo?: string;
  createdAt: string;
  pen?: Pen;
  dam?: Pig;
  sire?: Pig;
}

/** Pen detail from GET /pens/:penId including assigned pigs. */
export interface PenWithPigs extends Pen {
  pigs: Array<
    Pick<
      Pig,
      | 'id'
      | 'tagNumber'
      | 'name'
      | 'breed'
      | 'stage'
      | 'currentWeight'
      | 'status'
      | 'healthStatus'
      | 'acquisitionDate'
      | 'dateOfBirth'
    >
  >;
}

export interface WeightLog {
  id: string;
  pigId: string;
  userId: string;
  weight: number;
  date: string;
  notes?: string;
  user?: User;
}

export interface Vaccination {
  id: string;
  pigId: string;
  name: string;
  batchNumber?: string;
  dateAdministered: string;
  nextDueDate?: string;
  administeredBy?: string;
}

export type PigObservationCategory =
  | 'GENERAL_WELLBEING'
  | 'APPETITE_FEED_INTAKE'
  | 'BEHAVIOUR_ACTIVITY'
  | 'RESPIRATORY_COUGHING'
  | 'DIGESTIVE_DIARRHEA'
  | 'SKIN_LESIONS'
  | 'LAMENESS_MOBILITY'
  | 'EYES_NOSE_DISCHARGE'
  | 'OTHER';

export interface PigObservation {
  id: string;
  pigId: string;
  userId: string;
  category: PigObservationCategory;
  notes?: string | null;
  createdAt: string;
  pig?: { id: string; tagNumber: string };
  user?: Pick<User, 'id' | 'name'>;
}

export interface AuditLog {
  id: string;
  userId: string;
  farmId: string;
  action: string;
  entity: string;
  entityId: string;
  details?: string;
  createdAt: string;
  user?: User;
}

export interface ImportResult {
  total: number;
  imported: number;
  errors: ImportError[];
  preview?: ImportPreviewRow[];
}

export interface ImportError {
  row: number;
  field: string;
  message: string;
}

export interface ImportPreviewRow {
  row: number;
  data: Record<string, unknown>;
  errors: ImportError[];
  valid: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface FarrowingRecord {
  id: string;
  pigId: string;
  farrowingDate: string;
  pigletsBornAlive: number;
  pigletsBornDead: number;
  pigletsWeaned?: number;
  weaningDate?: string;
  avgBirthWeightKg?: number | null;
  ironDate?: string | null;
  tailDockedDate?: string | null;
  teatClippedDate?: string | null;
  notes?: string;
  createdAt: string;
}

export interface ServicedSow {
  id: string;
  tagNumber: string;
  breed: PigBreed;
  stage: PigStage;
  healthStatus: HealthStatus;
  dateOfBirth?: string | null;
  currentWeight: number;
  servicedDate: string;
  serviceHeatCheckAt?: string | null;
  serviceHeatInHeat?: boolean | null;
  expectedBirthDate: string;
  daysUntilBirth: number;
  /** Number of previous litters (farrowing records) */
  parity: number;
  gestationDays: number;
  /** Service + 100 days — aligns with ~2 weeks before 114d due */
  day100Date: string;
  needsPreFarrowPrep: boolean;
  needsHeatCheck: boolean;
}

export interface ServicedSowsData {
  totalServiced: number;
  nearestBirth: ServicedSow | null;
  sows: ServicedSow[];
}

export type SaleType = 'LIVE_SALE' | 'SLAUGHTER';

export interface SaleRecord {
  id: string;
  pigId: string;
  farmId: string;
  saleType: SaleType;
  saleDate: string;
  weightAtSale: number;
  pricePerKg: number;
  totalPrice: number;
  buyer?: string;
  notes?: string;
  currency: string;
  createdAt: string;
}

export interface BulkRecordSaleResult {
  count: number;
  currency: string;
  pricePerKg: number;
  totalRevenue: number;
  records: { id: string; pigId: string; tagNumber: string; totalPrice: number }[];
}

export interface DashboardStats {
  totalPigs: number;
  activePigs: number;
  soldPigs: number;
  deceasedPigs: number;
  quarantinedPigs: number;
  totalPens: number;
  avgWeight: number;
  mortalityRate: number;
  recentActivity: AuditLog[];
}
