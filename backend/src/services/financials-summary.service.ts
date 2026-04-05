import prisma from '../config/database';

const INVENTORY_STATUSES = ['ACTIVE', 'QUARANTINE'] as const;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Parse optional `from` / `to` query strings (YYYY-MM-DD). */
export function parseFinancialsDateQuery(q: Record<string, unknown>): { from?: string; to?: string; error?: string } {
  const from = typeof q.from === 'string' && DATE_RE.test(q.from) ? q.from : undefined;
  const to = typeof q.to === 'string' && DATE_RE.test(q.to) ? q.to : undefined;
  if (from && to && from > to) return { error: 'from must be on or before to' };
  return { from, to };
}

export function formatFinancialsPeriodLabel(period: { from: string | null; to: string | null }): string {
  if (period.from && period.to) return `${period.from} – ${period.to}`;
  if (period.from) return `From ${period.from}`;
  if (period.to) return `Until ${period.to}`;
  return 'All dates';
}

export function parseFinancialsSaleDateFilter(
  from?: string | null,
  to?: string | null,
): { gte?: Date; lte?: Date } | undefined {
  const w: { gte?: Date; lte?: Date } = {};
  if (from && DATE_RE.test(from)) w.gte = new Date(`${from}T00:00:00.000Z`);
  if (to && DATE_RE.test(to)) w.lte = new Date(`${to}T23:59:59.999Z`);
  return Object.keys(w).length ? w : undefined;
}

export interface FinancialsSummaryResult {
  farm: {
    name: string;
    currency: string;
    weightUnit: string;
    pricePerKg: number;
    logoUrl: string | null;
  };
  period: {
    /** ISO date (YYYY-MM-DD) or null if unbounded */
    from: string | null;
    to: string | null;
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
  salesInPeriod: {
    revenue: number;
    transactionCount: number;
    totalWeightSold: number;
  };
  recentSales: {
    id: string;
    tagNumber: string;
    saleType: string;
    saleDate: Date;
    weightAtSale: number;
    pricePerKg: number;
    totalPrice: number;
    buyer: string | null;
  }[];
}

export async function fetchFinancialsSummary(
  farmId: string,
  options?: { recentSalesLimit?: number; from?: string | null; to?: string | null },
): Promise<FinancialsSummaryResult | null> {
  const recentSalesLimit = options?.recentSalesLimit ?? 40;
  const from = options?.from && DATE_RE.test(options.from) ? options.from : null;
  const to = options?.to && DATE_RE.test(options.to) ? options.to : null;
  const saleDateFilter = parseFinancialsSaleDateFilter(from, to);

  const farm = await prisma.farm.findFirst({
    where: { id: farmId, isDeleted: false },
    select: {
      name: true,
      currency: true,
      weightUnit: true,
      pricePerKg: true,
      logoUrl: true,
    },
  });
  if (!farm) return null;

  const pricePerKg = Number(farm.pricePerKg);

  const pigs = await prisma.pig.findMany({
    where: {
      farmId,
      status: { in: [...INVENTORY_STATUSES] },
    },
    select: {
      id: true,
      stage: true,
      currentWeight: true,
      pen: { select: { id: true, name: true } },
    },
  });

  let totalCurrentWeight = 0;
  let estimatedHerdValue = 0;
  const byStage: Record<string, { count: number; totalWeight: number; value: number }> = {};
  const byPen: Record<string, { penId: string | null; penName: string; count: number; totalWeight: number; value: number }> = {};

  for (const p of pigs) {
    const w = Number(p.currentWeight);
    const v = w * pricePerKg;
    totalCurrentWeight += w;
    estimatedHerdValue += v;

    const st = p.stage;
    if (!byStage[st]) byStage[st] = { count: 0, totalWeight: 0, value: 0 };
    byStage[st].count += 1;
    byStage[st].totalWeight += w;
    byStage[st].value += v;

    const penKey = p.pen?.id ?? '_none';
    const penName = p.pen?.name ?? 'No pen';
    if (!byPen[penKey]) {
      byPen[penKey] = {
        penId: p.pen?.id ?? null,
        penName,
        count: 0,
        totalWeight: 0,
        value: 0,
      };
    }
    byPen[penKey].count += 1;
    byPen[penKey].totalWeight += w;
    byPen[penKey].value += v;
  }

  const saleWhere = {
    farmId,
    ...(saleDateFilter ? { saleDate: saleDateFilter } : {}),
  };

  const [salesAgg, recentSalesRaw] = await Promise.all([
    prisma.saleRecord.aggregate({
      where: saleWhere,
      _sum: { totalPrice: true, weightAtSale: true },
      _count: true,
    }),
    prisma.saleRecord.findMany({
      where: saleWhere,
      orderBy: { saleDate: 'desc' },
      take: recentSalesLimit,
      select: {
        id: true,
        saleType: true,
        saleDate: true,
        weightAtSale: true,
        pricePerKg: true,
        totalPrice: true,
        buyer: true,
        pig: { select: { tagNumber: true } },
      },
    }),
  ]);

  return {
    farm: {
      name: farm.name,
      currency: farm.currency,
      weightUnit: farm.weightUnit,
      pricePerKg,
      logoUrl: farm.logoUrl,
    },
    period: { from, to },
    herd: {
      inventoryHeadcount: pigs.length,
      totalCurrentWeight,
      avgWeight: pigs.length ? totalCurrentWeight / pigs.length : 0,
      estimatedValueAtFarmPrice: estimatedHerdValue,
    },
    breakdownByStage: Object.entries(byStage).map(([stage, o]) => ({
      stage,
      count: o.count,
      totalWeight: o.totalWeight,
      estimatedValue: o.value,
    })),
    breakdownByPen: Object.values(byPen).sort((a, b) => a.penName.localeCompare(b.penName)),
    salesInPeriod: {
      revenue: Number(salesAgg._sum.totalPrice ?? 0),
      transactionCount: salesAgg._count,
      totalWeightSold: Number(salesAgg._sum.weightAtSale ?? 0),
    },
    recentSales: recentSalesRaw.map((s) => ({
      id: s.id,
      tagNumber: s.pig.tagNumber,
      saleType: s.saleType,
      saleDate: s.saleDate,
      weightAtSale: Number(s.weightAtSale),
      pricePerKg: Number(s.pricePerKg),
      totalPrice: Number(s.totalPrice),
      buyer: s.buyer,
    })),
  };
}
