import path from 'path';
import fs from 'fs/promises';
import { FeedType, Prisma } from '@prisma/client';
import prisma from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { bucketsToKg } from '../lib/feedConversion';

const RECEIPT_SUBDIR = 'feed-receipts';

export const FEED_TYPES: FeedType[] = [
  'MAIZE_CRECHE',
  'SOYA',
  'PREMIX',
  'CONCENTRATE',
  'LACTATING',
  'WEANER',
];

export type FeedPurchasePriceUnit = 'KG' | 'TONNE';

function readPriceFromJson(json: unknown, feedType: FeedType): number | null {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null;
  const v = (json as Record<string, unknown>)[feedType];
  if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return null;
}

/** Effective farm-currency price per kg from stored unit (kg or per tonne). */
export function effectiveFeedPricePerKg(
  feedType: FeedType,
  priceUnit: string,
  pricesJson: unknown,
): { perKg: Prisma.Decimal } | { error: string } {
  const u = priceUnit === 'TONNE' ? 'TONNE' : 'KG';
  const raw = readPriceFromJson(pricesJson, feedType);
  if (raw === null || raw <= 0) {
    return {
      error:
        'Set a purchase price for this feed type under Farm settings → Feed purchase prices (per kg or per tonne).',
    };
  }
  const rate = u === 'TONNE' ? new Prisma.Decimal(raw).div(1000) : new Prisma.Decimal(raw);
  return { perKg: rate };
}

export function computeFeedPurchaseTotalCost(params: {
  quantityKg: number;
  feedType: FeedType;
  priceUnit: string;
  pricesJson: unknown;
}): { totalCost: Prisma.Decimal } | { error: string } {
  const eff = effectiveFeedPricePerKg(params.feedType, params.priceUnit, params.pricesJson);
  if ('error' in eff) return eff;
  const qty = new Prisma.Decimal(params.quantityKg);
  const total = qty.mul(eff.perKg);
  return { totalCost: new Prisma.Decimal(total.toFixed(2)) };
}

export type DailyUsageBucketsRow = {
  maizeBuckets: Prisma.Decimal;
  soyaBuckets: Prisma.Decimal;
  premixBuckets: Prisma.Decimal;
  concentrateBuckets: Prisma.Decimal;
  lactatingBuckets: Prisma.Decimal;
  weanerBuckets: Prisma.Decimal;
};

export function getUploadsRoot(): string {
  return path.join(process.cwd(), 'uploads');
}

export function receiptPathForKey(receiptKey: string): string {
  return path.join(getUploadsRoot(), receiptKey);
}

export function bucketsForType(row: DailyUsageBucketsRow, type: FeedType): Prisma.Decimal {
  switch (type) {
    case 'MAIZE_CRECHE':
      return row.maizeBuckets;
    case 'SOYA':
      return row.soyaBuckets;
    case 'PREMIX':
      return row.premixBuckets;
    case 'CONCENTRATE':
      return row.concentrateBuckets;
    case 'LACTATING':
      return row.lactatingBuckets;
    case 'WEANER':
      return row.weanerBuckets;
    default:
      return new Prisma.Decimal(0);
  }
}

export function dailyUsageRowToKgRecord(row: DailyUsageBucketsRow): Record<FeedType, Prisma.Decimal> {
  const o = {} as Record<FeedType, Prisma.Decimal>;
  for (const t of FEED_TYPES) {
    o[t] = bucketsToKg(bucketsForType(row, t));
  }
  return o;
}

async function sumPurchasedKgByType(farmId: string): Promise<Record<FeedType, Prisma.Decimal>> {
  const sums = await prisma.feedPurchase.groupBy({
    by: ['feedType'],
    where: { farmId },
    _sum: { quantityKg: true },
  });
  const out = {} as Record<FeedType, Prisma.Decimal>;
  for (const t of FEED_TYPES) out[t] = new Prisma.Decimal(0);
  for (const s of sums) {
    out[s.feedType] = s._sum.quantityKg ?? new Prisma.Decimal(0);
  }
  return out;
}

async function sumUsedKgByType(farmId: string, excludeUsageId?: string): Promise<Record<FeedType, Prisma.Decimal>> {
  const rows = await prisma.feedDailyUsage.findMany({
    where: { farmId, ...(excludeUsageId ? { id: { not: excludeUsageId } } : {}) },
  });
  const out = {} as Record<FeedType, Prisma.Decimal>;
  for (const t of FEED_TYPES) out[t] = new Prisma.Decimal(0);
  for (const row of rows) {
    for (const t of FEED_TYPES) {
      const kg = bucketsToKg(bucketsForType(row, t));
      out[t] = out[t].add(kg);
    }
  }
  return out;
}

/** Stock kg per feed type (purchases minus all daily usage). */
export async function getStockKgByType(farmId: string): Promise<Record<FeedType, Prisma.Decimal>> {
  const purchased = await sumPurchasedKgByType(farmId);
  const used = await sumUsedKgByType(farmId);
  const stock = {} as Record<FeedType, Prisma.Decimal>;
  for (const t of FEED_TYPES) {
    stock[t] = purchased[t].sub(used[t]);
  }
  return stock;
}

async function getStockKgByTypeExcludingUsage(farmId: string, excludeUsageId: string): Promise<Record<FeedType, Prisma.Decimal>> {
  const purchased = await sumPurchasedKgByType(farmId);
  const used = await sumUsedKgByType(farmId, excludeUsageId);
  const stock = {} as Record<FeedType, Prisma.Decimal>;
  for (const t of FEED_TYPES) {
    stock[t] = purchased[t].sub(used[t]);
  }
  return stock;
}

export type DailyUsageInput = {
  maizeBuckets: Prisma.Decimal | number | string;
  soyaBuckets: Prisma.Decimal | number | string;
  premixBuckets: Prisma.Decimal | number | string;
  concentrateBuckets: Prisma.Decimal | number | string;
  lactatingBuckets: Prisma.Decimal | number | string;
  weanerBuckets: Prisma.Decimal | number | string;
};

function toDec(v: Prisma.Decimal | number | string): Prisma.Decimal {
  if (v instanceof Prisma.Decimal) return v;
  return new Prisma.Decimal(v);
}

function usageRowToKgMap(row: DailyUsageInput): Record<FeedType, Prisma.Decimal> {
  const r: DailyUsageBucketsRow = {
    maizeBuckets: toDec(row.maizeBuckets),
    soyaBuckets: toDec(row.soyaBuckets),
    premixBuckets: toDec(row.premixBuckets),
    concentrateBuckets: toDec(row.concentrateBuckets),
    lactatingBuckets: toDec(row.lactatingBuckets),
    weanerBuckets: toDec(row.weanerBuckets),
  };
  return dailyUsageRowToKgRecord(r);
}

export function assertUsageDoesNotExceedStock(
  stock: Record<FeedType, Prisma.Decimal>,
  proposedUsageKg: Record<FeedType, Prisma.Decimal>,
): void {
  for (const t of FEED_TYPES) {
    const left = stock[t].sub(proposedUsageKg[t]);
    if (left.lt(0)) {
      throw new AppError(
        `Usage exceeds stock for ${t.replace(/_/g, ' ')}. Available: ${stock[t].toFixed(2)} kg; tried to use ${proposedUsageKg[t].toFixed(2)} kg.`,
        400,
      );
    }
  }
}

export async function validateDailyUsageAgainstStock(
  farmId: string,
  input: DailyUsageInput,
  options: { replaceUsageId?: string } = {},
): Promise<void> {
  const proposed = usageRowToKgMap(input);
  const stock = options.replaceUsageId
    ? await getStockKgByTypeExcludingUsage(farmId, options.replaceUsageId)
    : await getStockKgByType(farmId);
  assertUsageDoesNotExceedStock(stock, proposed);
}

const MS_24H = 24 * 60 * 60 * 1000;

export function assertCanEditUsage(submittedAt: Date): void {
  if (Date.now() - submittedAt.getTime() > MS_24H) {
    throw new AppError('This usage log can only be edited within 24 hours of submission.', 403);
  }
}

export function parseUsageDate(dateStr: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new AppError('Invalid date. Use YYYY-MM-DD.', 400);
  }
  return new Date(`${dateStr}T00:00:00.000Z`);
}

export async function saveReceiptFile(
  farmId: string,
  purchaseId: string,
  buffer: Buffer,
  originalName: string,
): Promise<{ receiptKey: string; mime: string }> {
  const ext = path.extname(originalName).toLowerCase();
  const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];
  const safeExt = allowed.includes(ext) ? ext : '.bin';
  const receiptKey = path.join(RECEIPT_SUBDIR, farmId, `${purchaseId}${safeExt}`);
  const full = receiptPathForKey(receiptKey);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, buffer);
  const mime =
    safeExt === '.pdf'
      ? 'application/pdf'
      : safeExt === '.png'
        ? 'image/png'
        : safeExt === '.webp'
          ? 'image/webp'
          : 'image/jpeg';
  return { receiptKey, mime };
}

export async function readReceiptFile(receiptKey: string): Promise<{ buffer: Buffer; mime: string }> {
  const full = receiptPathForKey(receiptKey);
  const buffer = await fs.readFile(full);
  const ext = path.extname(full).toLowerCase();
  const mime =
    ext === '.pdf'
      ? 'application/pdf'
      : ext === '.png'
        ? 'image/png'
        : ext === '.webp'
          ? 'image/webp'
          : 'image/jpeg';
  return { buffer, mime };
}

/** Aggregate feed purchase spend and kg by type. Omit `purchasedAt` for all-time (no date filter). */
export async function aggregateFeedPurchaseCosts(
  farmId: string,
  purchasedAt?: { gte?: Date; lte?: Date },
): Promise<{ byType: Record<FeedType, { spend: Prisma.Decimal; kg: Prisma.Decimal }>; totalSpend: Prisma.Decimal }> {
  const purchases = await prisma.feedPurchase.findMany({
    where: {
      farmId,
      ...(purchasedAt && Object.keys(purchasedAt).length ? { purchasedAt } : {}),
    },
  });
  const byType = {} as Record<FeedType, { spend: Prisma.Decimal; kg: Prisma.Decimal }>;
  for (const t of FEED_TYPES) {
    byType[t] = { spend: new Prisma.Decimal(0), kg: new Prisma.Decimal(0) };
  }
  let totalSpend = new Prisma.Decimal(0);
  for (const p of purchases) {
    byType[p.feedType].spend = byType[p.feedType].spend.add(p.totalCost);
    byType[p.feedType].kg = byType[p.feedType].kg.add(p.quantityKg);
    totalSpend = totalSpend.add(p.totalCost);
  }
  return { byType, totalSpend };
}

export async function costSummaryForRange(
  farmId: string,
  from: Date,
  to: Date,
): Promise<{ byType: Record<FeedType, { spend: Prisma.Decimal; kg: Prisma.Decimal }>; totalSpend: Prisma.Decimal }> {
  return aggregateFeedPurchaseCosts(farmId, { gte: from, lte: to });
}

export type FeedUsageReportRange = 'daily' | 'weekly' | 'monthly';

export async function listFeedPurchasesInPeriod(
  farmId: string,
  start: Date,
  end: Date,
): Promise<
  {
    purchasedAt: Date;
    feedType: FeedType;
    quantityKg: number;
    totalCost: number;
    supplier: string | null;
    loggedByName: string;
  }[]
> {
  const rows = await prisma.feedPurchase.findMany({
    where: {
      farmId,
      purchasedAt: { gte: start, lte: end },
    },
    orderBy: { purchasedAt: 'asc' },
    include: { createdBy: { select: { name: true } } },
  });
  return rows.map((p) => ({
    purchasedAt: p.purchasedAt,
    feedType: p.feedType,
    quantityKg: parseFloat(p.quantityKg.toFixed(3)),
    totalCost: parseFloat(p.totalCost.toFixed(2)),
    supplier: p.supplier,
    loggedByName: p.createdBy?.name?.trim() || '—',
  }));
}

export async function getFeedUsageReportData(
  farmId: string,
  range: FeedUsageReportRange,
  anchor: Date,
): Promise<{
  range: FeedUsageReportRange;
  start: string;
  end: string;
  series: { date: string; byType: Record<FeedType, number>; loggedByName: string }[];
  totalsKg: { feedType: FeedType; kg: number }[];
}> {
  const y = anchor.getUTCFullYear();
  const m = anchor.getUTCMonth();
  const d = anchor.getUTCDate();

  let start: Date;
  let end: Date;

  if (range === 'daily') {
    start = new Date(Date.UTC(y, m, d));
    end = new Date(Date.UTC(y, m, d, 23, 59, 59, 999));
  } else if (range === 'weekly') {
    end = new Date(Date.UTC(y, m, d, 23, 59, 59, 999));
    start = new Date(end);
    start.setUTCDate(start.getUTCDate() - 6);
    start.setUTCHours(0, 0, 0, 0);
  } else {
    start = new Date(Date.UTC(y, m, 1));
    end = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999));
  }

  const rows = await prisma.feedDailyUsage.findMany({
    where: {
      farmId,
      usageDate: { gte: start, lte: end },
    },
    orderBy: { usageDate: 'asc' },
    include: { user: { select: { name: true } } },
  });

  const byDay: { date: string; byType: Record<FeedType, number>; loggedByName: string }[] = [];
  const totals = {} as Record<FeedType, Prisma.Decimal>;
  for (const t of FEED_TYPES) totals[t] = new Prisma.Decimal(0);

  for (const r of rows) {
    const day = r.usageDate.toISOString().slice(0, 10);
    const kg = dailyUsageRowToKgRecord(r);
    for (const t of FEED_TYPES) {
      totals[t] = totals[t].add(kg[t]);
    }
    const byType = {} as Record<FeedType, number>;
    for (const t of FEED_TYPES) {
      byType[t] = parseFloat(kg[t].toFixed(3));
    }
    byDay.push({
      date: day,
      byType,
      loggedByName: r.user?.name?.trim() || '—',
    });
  }

  return {
    range,
    start: start.toISOString(),
    end: end.toISOString(),
    series: byDay,
    totalsKg: FEED_TYPES.map((t) => ({ feedType: t, kg: parseFloat(totals[t].toFixed(3)) })),
  };
}
