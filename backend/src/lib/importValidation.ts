import * as XLSX from 'xlsx';

export const IMPORT_BREEDS = [
  'LARGE_WHITE', 'LANDRACE', 'DUROC', 'PIETRAIN', 'BERKSHIRE', 'HAMPSHIRE',
  'CHESTER_WHITE', 'YORKSHIRE', 'TAMWORTH', 'MUKOTA', 'KOLBROEK', 'WINDSNYER',
  'SA_LANDRACE', 'INDIGENOUS', 'CROSSBREED', 'OTHER',
] as const;

export const IMPORT_STAGES = [
  'BOAR', 'SOW', 'GILT', 'WEANER', 'PIGLET', 'PORKER', 'GROWER', 'FINISHER',
] as const;

export const IMPORT_STATUSES = ['ACTIVE', 'SOLD', 'DECEASED', 'QUARANTINE'] as const;
export const IMPORT_HEALTH = ['HEALTHY', 'SICK', 'UNDER_TREATMENT', 'RECOVERED'] as const;

export const BREED_MAP: Record<string, string> = {
  'large white': 'LARGE_WHITE', landrace: 'LANDRACE', duroc: 'DUROC',
  pietrain: 'PIETRAIN', berkshire: 'BERKSHIRE', hampshire: 'HAMPSHIRE',
  'chester white': 'CHESTER_WHITE', yorkshire: 'YORKSHIRE', tamworth: 'TAMWORTH',
  mukota: 'MUKOTA', kolbroek: 'KOLBROEK', windsnyer: 'WINDSNYER',
  'sa landrace': 'SA_LANDRACE', indigenous: 'INDIGENOUS',
  'cross-breed': 'CROSSBREED', crossbreed: 'CROSSBREED', other: 'OTHER',
};

export const STAGE_MAP: Record<string, string> = {
  boar: 'BOAR', sow: 'SOW', gilt: 'GILT', weaner: 'WEANER', piglet: 'PIGLET',
  porker: 'PORKER', grower: 'GROWER', finisher: 'FINISHER',
};

export type RowError = { row: number; field: string; message: string };

export interface ValidatedImportRow {
  row: number;
  data: {
    tagNumber: string;
    breed: string;
    stage: string;
    dateOfBirth: string | null;
    acquisitionDate: string;
    entryWeight: number;
    penName: string | null;
    status: string;
    healthStatus: string;
    serviced: boolean;
    servicedDate: string | null;
    weanedDate: string | null;
    damTag: string | null;
    sireTag: string | null;
    vax1Name: string | null;
    vax1Date: string | null;
    vax2Name: string | null;
    vax2Date: string | null;
    notes: string | null;
  };
  errors: RowError[];
  valid: boolean;
}

export function normalizeEnum(value: string, allowed: readonly string[], map?: Record<string, string>): string | null {
  const upper = value.trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (allowed.includes(upper)) return upper;
  if (map) {
    const mapped = map[value.trim().toLowerCase()];
    if (mapped && allowed.includes(mapped)) return mapped;
  }
  return null;
}

const PEN_NAME_MAX = 100;

export function normalizePenName(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  return s.length === 0 ? null : s;
}

export function isValidPenName(name: string): boolean {
  if (name.length > PEN_NAME_MAX) return false;
  return /^[a-zA-Z0-9](?:[a-zA-Z0-9\s\-_.]*[a-zA-Z0-9])?$|^[a-zA-Z0-9]$/.test(name);
}

export function parseImportDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val);
    return new Date(d.y, d.m - 1, d.d);
  }
  const str = String(val).trim();
  const ddmmyyyy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (ddmmyyyy) {
    return new Date(parseInt(ddmmyyyy[3], 10), parseInt(ddmmyyyy[2], 10) - 1, parseInt(ddmmyyyy[1], 10));
  }
  const iso = new Date(str);
  return Number.isNaN(iso.getTime()) ? null : iso;
}

/** Match header labels across Excel versions, NBSP, slash variants, BOM. */
export function normalizeSheetHeader(value: unknown): string {
  return String(value ?? '')
    .replace(/^\ufeff/, '')
    .trim()
    .toLowerCase()
    .replace(/\u00a0/g, ' ')
    .replace(/\s*[/\\]\s*/g, '/')
    .replace(/\s+/g, ' ');
}

export function findPenColumnIndex(headerRow: unknown[]): number {
  if (!Array.isArray(headerRow)) return -1;
  for (let c = 0; c < headerRow.length; c++) {
    const n = normalizeSheetHeader(headerRow[c]);
    if (
      n === 'pen / location' ||
      n === 'pen/location' ||
      n === 'pen location' ||
      n === 'pen'
    ) {
      return c;
    }
  }
  return -1;
}

export function extractPenCellFromRow(row: Record<string, unknown>): unknown {
  const directKeys = ['Pen / Location', 'Pen/Location', 'Pen Location', 'Pen'];
  for (const pk of directKeys) {
    const v = row[pk];
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  for (const key of Object.keys(row)) {
    const n = normalizeSheetHeader(key);
    if (
      n === 'pen / location' ||
      n === 'pen/location' ||
      n === 'pen location' ||
      n === 'pen'
    ) {
      return row[key];
    }
  }
  return undefined;
}

export function penNameFromImportData(data: Record<string, unknown>): string | null {
  return normalizePenName(
    data.penName ?? data.pen ?? data.Pen ?? data['Pen / Location'] ?? data.pen_name,
  );
}

/** Server-side validation of a single import row payload (used on confirm). */
export function validateImportRowFromData(
  rowNum: number,
  raw: Record<string, unknown>,
  ctx: { existingTags: Set<string>; seenTags: Set<string> },
): ValidatedImportRow {
  const errors: RowError[] = [];

  const tag = String(raw.tagNumber ?? '').trim();
  if (!tag) errors.push({ row: rowNum, field: 'Tag Number', message: 'Required' });
  else if (tag.length > 20) errors.push({ row: rowNum, field: 'Tag Number', message: 'Max 20 characters' });
  else if (ctx.existingTags.has(tag)) errors.push({ row: rowNum, field: 'Tag Number', message: 'Already exists in farm' });
  else if (ctx.seenTags.has(tag)) errors.push({ row: rowNum, field: 'Tag Number', message: 'Duplicate in file' });
  else ctx.seenTags.add(tag);

  const breedRaw = String(raw.breed ?? '').trim();
  const breed = breedRaw ? normalizeEnum(breedRaw, IMPORT_BREEDS, BREED_MAP) : null;
  if (!breedRaw) errors.push({ row: rowNum, field: 'Breed', message: 'Required' });
  else if (!breed) errors.push({ row: rowNum, field: 'Breed', message: `Invalid breed "${breedRaw}"` });

  const stageRaw = String(raw.stage ?? '').trim();
  const stage = stageRaw ? normalizeEnum(stageRaw, IMPORT_STAGES, STAGE_MAP) : null;
  if (!stageRaw) errors.push({ row: rowNum, field: 'Stage', message: 'Required' });
  else if (!stage) errors.push({ row: rowNum, field: 'Stage', message: `Invalid stage "${stageRaw}"` });

  const acqDate = parseImportDate(raw.acquisitionDate);
  if (!acqDate) errors.push({ row: rowNum, field: 'Acquisition Date', message: 'Required valid date' });
  else if (acqDate > new Date()) errors.push({ row: rowNum, field: 'Acquisition Date', message: 'Cannot be in the future' });

  const weight = typeof raw.entryWeight === 'number' ? raw.entryWeight : parseFloat(String(raw.entryWeight ?? ''));
  if (!Number.isFinite(weight) || weight <= 0) {
    errors.push({ row: rowNum, field: 'Entry Weight', message: 'Must be a positive number' });
  }

  const statusRaw = String(raw.status ?? 'ACTIVE').trim();
  const status = normalizeEnum(statusRaw, IMPORT_STATUSES);
  if (!status) errors.push({ row: rowNum, field: 'Status', message: `Invalid status "${statusRaw}"` });

  const healthRaw = String(raw.healthStatus ?? 'HEALTHY').trim();
  const health = healthRaw ? normalizeEnum(healthRaw, IMPORT_HEALTH) : 'HEALTHY';
  if (healthRaw && !health) errors.push({ row: rowNum, field: 'Health Status', message: `Invalid "${healthRaw}"` });

  const dob = raw.dateOfBirth ? parseImportDate(raw.dateOfBirth) : null;
  if (raw.dateOfBirth && !dob) errors.push({ row: rowNum, field: 'Date of Birth', message: 'Invalid date' });
  if (dob && dob > new Date()) errors.push({ row: rowNum, field: 'Date of Birth', message: 'Cannot be in the future' });

  const servicedRaw = String(raw.serviced ?? '').trim().toLowerCase();
  const serviced = servicedRaw === 'yes' || servicedRaw === 'true' || servicedRaw === '1' || raw.serviced === true;
  const servicedDate = raw.servicedDate ? parseImportDate(raw.servicedDate) : null;
  const weanedDate = raw.weanedDate ? parseImportDate(raw.weanedDate) : null;
  if (raw.weanedDate && !weanedDate) {
    errors.push({ row: rowNum, field: 'Weaned Date', message: 'Invalid date' });
  }

  const penName = penNameFromImportData(raw);
  if (penName && !isValidPenName(penName)) {
    errors.push({
      row: rowNum,
      field: 'Pen / Location',
      message: 'Use letters and/or numbers (optional spaces or hyphen), e.g. A, 12, Pen-2',
    });
  }

  const vax1Date = raw.vax1Date ? parseImportDate(raw.vax1Date) : null;
  const vax2Date = raw.vax2Date ? parseImportDate(raw.vax2Date) : null;

  return {
    row: rowNum,
    data: {
      tagNumber: tag,
      breed: breed || breedRaw,
      stage: stage || stageRaw,
      dateOfBirth: dob?.toISOString() || null,
      acquisitionDate: acqDate?.toISOString() || '',
      entryWeight: weight,
      penName,
      status: status || statusRaw,
      healthStatus: health || healthRaw,
      serviced,
      servicedDate: servicedDate?.toISOString() || null,
      weanedDate: weanedDate?.toISOString() || null,
      damTag: raw.damTag ? String(raw.damTag).trim() : null,
      sireTag: raw.sireTag ? String(raw.sireTag).trim() : null,
      vax1Name: raw.vax1Name ? String(raw.vax1Name) : null,
      vax1Date: vax1Date?.toISOString() || null,
      vax2Name: raw.vax2Name ? String(raw.vax2Name) : null,
      vax2Date: vax2Date?.toISOString() || null,
      notes: raw.notes ? String(raw.notes) : null,
    },
    errors,
    valid: errors.length === 0,
  };
}
