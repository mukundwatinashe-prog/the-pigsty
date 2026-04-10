import { randomUUID } from 'crypto';
import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { FeedType, Prisma } from '@prisma/client';
import prisma from '../config/database';
import { FarmRequest } from '../middleware/rbac.middleware';
import { AppError } from '../middleware/error.middleware';
import {
  assertCanEditUsage,
  computeFeedPurchaseTotalCost,
  costSummaryForRange,
  dailyUsageRowToKgRecord,
  FEED_TYPES,
  getFeedUsageReportData,
  listFeedPurchasesInPeriod,
  getStockKgByType,
  parseUsageDate,
  readReceiptFile,
  saveReceiptFile,
  validateDailyUsageAgainstStock,
} from '../services/feed.service';
import {
  buildFeedPurchaseHistoryPdf,
  buildFeedPurchaseHistoryXlsx,
  buildFeedUsageReportPdf,
  buildFeedUsageReportXlsx,
  toFeedPurchaseExportRow,
} from '../services/feedReportExport.service';

const feedTypeSchema = z.enum([
  'MAIZE_CRECHE',
  'SOYA',
  'PREMIX',
  'CONCENTRATE',
  'LACTATING',
  'WEANER',
]);

const createPurchaseSchema = z.object({
  feedType: feedTypeSchema,
  quantityKg: z.coerce.number().positive(),
  supplier: z.string().max(200).optional().nullable(),
  purchasedAt: z.coerce.date(),
});

const dailyUsageBodySchema = z.object({
  maizeBuckets: z.coerce.number().min(0).default(0),
  soyaBuckets: z.coerce.number().min(0).default(0),
  premixBuckets: z.coerce.number().min(0).default(0),
  concentrateBuckets: z.coerce.number().min(0).default(0),
  lactatingBuckets: z.coerce.number().min(0).default(0),
  weanerBuckets: z.coerce.number().min(0).default(0),
  notes: z.string().max(2000).optional().nullable(),
});

function stockToJson(stock: Record<FeedType, Prisma.Decimal>) {
  return FEED_TYPES.map((t) => ({
    feedType: t,
    stockKg: parseFloat(stock[t].toFixed(3)),
  }));
}

export class FeedController {
  static async getStock(req: FarmRequest, res: Response, next: NextFunction) {
    try {
      const farm = await prisma.farm.findUnique({
        where: { id: req.farmId! },
        select: { feedLowStockThresholdKg: true },
      });
      const threshold = farm?.feedLowStockThresholdKg ?? new Prisma.Decimal(50);
      const stock = await getStockKgByType(req.farmId!);
      const lowStock = FEED_TYPES.filter((t) => stock[t].lte(threshold));
      res.json({
        stock: stockToJson(stock),
        lowStockThresholdKg: parseFloat(threshold.toFixed(2)),
        lowStockFeedTypes: lowStock,
      });
    } catch (e) {
      next(e);
    }
  }

  static async getSummary(req: FarmRequest, res: Response, next: NextFunction) {
    try {
      const farm = await prisma.farm.findUnique({
        where: { id: req.farmId! },
        select: { feedLowStockThresholdKg: true, currency: true },
      });
      const threshold = farm?.feedLowStockThresholdKg ?? new Prisma.Decimal(50);
      const stock = await getStockKgByType(req.farmId!);
      const now = new Date();
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
      const { byType, totalSpend } = await costSummaryForRange(req.farmId!, monthStart, monthEnd);

      res.json({
        currency: farm?.currency ?? 'USD',
        stock: stockToJson(stock),
        lowStockThresholdKg: parseFloat(threshold.toFixed(2)),
        lowStockFeedTypes: FEED_TYPES.filter((t) => stock[t].lte(threshold)),
        monthSpendByType: FEED_TYPES.map((t) => ({
          feedType: t,
          spend: parseFloat(byType[t].spend.toFixed(2)),
          kgPurchased: parseFloat(byType[t].kg.toFixed(3)),
        })),
        monthSpendTotal: parseFloat(totalSpend.toFixed(2)),
      });
    } catch (e) {
      next(e);
    }
  }

  static async listPurchases(req: FarmRequest, res: Response, next: NextFunction) {
    try {
      const list = await prisma.feedPurchase.findMany({
        where: { farmId: req.farmId! },
        orderBy: { purchasedAt: 'desc' },
        take: 500,
        include: { createdBy: { select: { id: true, name: true } } },
      });
      res.json({
        purchases: list.map((p) => ({
          id: p.id,
          feedType: p.feedType,
          quantityKg: parseFloat(p.quantityKg.toFixed(3)),
          totalCost: parseFloat(p.totalCost.toFixed(2)),
          supplier: p.supplier,
          purchasedAt: p.purchasedAt.toISOString(),
          receiptKey: p.receiptKey,
          createdBy: p.createdBy,
          createdAt: p.createdAt.toISOString(),
        })),
      });
    } catch (e) {
      next(e);
    }
  }

  static async createPurchase(req: FarmRequest, res: Response, next: NextFunction) {
    try {
      if (!req.file?.buffer) return next(new AppError('Receipt file is required', 400));

      const raw = req.body?.data;
      let parsed: unknown;
      if (typeof raw === 'string') {
        try {
          parsed = JSON.parse(raw);
        } catch {
          return next(new AppError('Invalid JSON in data field', 400));
        }
      } else if (raw && typeof raw === 'object') {
        parsed = raw;
      } else {
        return next(new AppError('Missing data field (JSON) for purchase details', 400));
      }
      const body = createPurchaseSchema.parse(parsed);
      const farmPricing = await prisma.farm.findFirst({
        where: { id: req.farmId!, isDeleted: false },
        select: { feedPurchasePriceUnit: true, feedPurchasePrices: true },
      });
      if (!farmPricing) return next(new AppError('Farm not found', 404));

      const computed = computeFeedPurchaseTotalCost({
        quantityKg: body.quantityKg,
        feedType: body.feedType as FeedType,
        priceUnit: farmPricing.feedPurchasePriceUnit,
        pricesJson: farmPricing.feedPurchasePrices,
      });
      if ('error' in computed) return next(new AppError(computed.error, 400));

      const purchaseId = randomUUID();
      const { receiptKey } = await saveReceiptFile(req.farmId!, purchaseId, req.file.buffer, req.file.originalname);

      const p = await prisma.feedPurchase.create({
        data: {
          id: purchaseId,
          farmId: req.farmId!,
          feedType: body.feedType as FeedType,
          quantityKg: new Prisma.Decimal(body.quantityKg),
          totalCost: computed.totalCost,
          supplier: body.supplier ?? undefined,
          purchasedAt: body.purchasedAt,
          receiptKey,
          createdById: req.userId!,
        },
      });

      res.status(201).json({
        id: p.id,
        feedType: p.feedType,
        quantityKg: parseFloat(p.quantityKg.toFixed(3)),
        totalCost: parseFloat(p.totalCost.toFixed(2)),
        purchasedAt: p.purchasedAt.toISOString(),
      });
    } catch (e) {
      if (e instanceof z.ZodError) return next(new AppError(e.errors[0].message, 400));
      next(e);
    }
  }

  /** Multipart: fields in `data` JSON string + file field `receipt`. */
  static async getPurchaseReceipt(req: FarmRequest, res: Response, next: NextFunction) {
    try {
      const purchaseId = req.params.purchaseId as string;
      const p = await prisma.feedPurchase.findFirst({
        where: { id: purchaseId, farmId: req.farmId! },
      });
      if (!p) return next(new AppError('Purchase not found', 404));
      const { buffer, mime } = await readReceiptFile(p.receiptKey);
      res.setHeader('Content-Type', mime);
      res.setHeader('Content-Disposition', `inline; filename="receipt-${purchaseId}"`);
      res.send(buffer);
    } catch (e) {
      next(e);
    }
  }

  static async listDailyUsage(req: FarmRequest, res: Response, next: NextFunction) {
    try {
      const from = req.query.from ? parseUsageDate(req.query.from as string) : undefined;
      const to = req.query.to ? parseUsageDate(req.query.to as string) : undefined;
      const dateFilter: { gte?: Date; lte?: Date } = {};
      if (from) dateFilter.gte = from;
      if (to) dateFilter.lte = to;
      const rows = await prisma.feedDailyUsage.findMany({
        where: {
          farmId: req.farmId!,
          ...(Object.keys(dateFilter).length ? { usageDate: dateFilter } : {}),
        },
        orderBy: { usageDate: 'desc' },
        take: 400,
        include: { user: { select: { id: true, name: true } } },
      });
      res.json({
        entries: rows.map((r) => FeedController.serializeDailyUsage(r)),
      });
    } catch (e) {
      next(e);
    }
  }

  static serializeDailyUsage(r: {
    id: string;
    usageDate: Date;
    maizeBuckets: Prisma.Decimal;
    soyaBuckets: Prisma.Decimal;
    premixBuckets: Prisma.Decimal;
    concentrateBuckets: Prisma.Decimal;
    lactatingBuckets: Prisma.Decimal;
    weanerBuckets: Prisma.Decimal;
    notes: string | null;
    submittedAt: Date;
    user: { id: string; name: string };
  }) {
    const row = r;
    const kg = dailyUsageRowToKgRecord(row);
    return {
      id: row.id,
      usageDate: row.usageDate.toISOString().slice(0, 10),
      maizeBuckets: parseFloat(row.maizeBuckets.toFixed(4)),
      soyaBuckets: parseFloat(row.soyaBuckets.toFixed(4)),
      premixBuckets: parseFloat(row.premixBuckets.toFixed(4)),
      concentrateBuckets: parseFloat(row.concentrateBuckets.toFixed(4)),
      lactatingBuckets: parseFloat(row.lactatingBuckets.toFixed(4)),
      weanerBuckets: parseFloat(row.weanerBuckets.toFixed(4)),
      kgByType: FEED_TYPES.map((t) => ({ feedType: t, kg: parseFloat(kg[t].toFixed(3)) })),
      notes: row.notes,
      submittedAt: row.submittedAt.toISOString(),
      editableUntil: new Date(row.submittedAt.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      user: row.user,
    };
  }

  static async getDailyUsageByDate(req: FarmRequest, res: Response, next: NextFunction) {
    try {
      const usageDate = parseUsageDate(req.params.date as string);
      const row = await prisma.feedDailyUsage.findUnique({
        where: { farmId_usageDate: { farmId: req.farmId!, usageDate } },
        include: { user: { select: { id: true, name: true } } },
      });
      if (!row) return res.json({ entry: null });
      res.json({ entry: FeedController.serializeDailyUsage(row) });
    } catch (e) {
      next(e);
    }
  }

  static async upsertDailyUsage(req: FarmRequest, res: Response, next: NextFunction) {
    try {
      const usageDate = parseUsageDate(req.params.date as string);
      const body = dailyUsageBodySchema.parse(req.body);

      const input = {
        maizeBuckets: body.maizeBuckets,
        soyaBuckets: body.soyaBuckets,
        premixBuckets: body.premixBuckets,
        concentrateBuckets: body.concentrateBuckets,
        lactatingBuckets: body.lactatingBuckets,
        weanerBuckets: body.weanerBuckets,
      };

      const existing = await prisma.feedDailyUsage.findUnique({
        where: { farmId_usageDate: { farmId: req.farmId!, usageDate } },
      });

      if (existing) {
        assertCanEditUsage(existing.submittedAt);
        await validateDailyUsageAgainstStock(req.farmId!, input, { replaceUsageId: existing.id });
        const updated = await prisma.feedDailyUsage.update({
          where: { id: existing.id },
          data: {
            maizeBuckets: new Prisma.Decimal(input.maizeBuckets),
            soyaBuckets: new Prisma.Decimal(input.soyaBuckets),
            premixBuckets: new Prisma.Decimal(input.premixBuckets),
            concentrateBuckets: new Prisma.Decimal(input.concentrateBuckets),
            lactatingBuckets: new Prisma.Decimal(input.lactatingBuckets),
            weanerBuckets: new Prisma.Decimal(input.weanerBuckets),
            notes: body.notes ?? undefined,
            userId: req.userId!,
            submittedAt: existing.submittedAt,
          },
          include: { user: { select: { id: true, name: true } } },
        });
        return res.json({ entry: FeedController.serializeDailyUsage(updated) });
      }

      await validateDailyUsageAgainstStock(req.farmId!, input);
      const created = await prisma.feedDailyUsage.create({
        data: {
          farmId: req.farmId!,
          usageDate,
          maizeBuckets: new Prisma.Decimal(input.maizeBuckets),
          soyaBuckets: new Prisma.Decimal(input.soyaBuckets),
          premixBuckets: new Prisma.Decimal(input.premixBuckets),
          concentrateBuckets: new Prisma.Decimal(input.concentrateBuckets),
          lactatingBuckets: new Prisma.Decimal(input.lactatingBuckets),
          weanerBuckets: new Prisma.Decimal(input.weanerBuckets),
          notes: body.notes ?? undefined,
          userId: req.userId!,
        },
        include: { user: { select: { id: true, name: true } } },
      });
      res.status(201).json({ entry: FeedController.serializeDailyUsage(created) });
    } catch (e) {
      if (e instanceof z.ZodError) return next(new AppError(e.errors[0].message, 400));
      next(e);
    }
  }

  static async getReports(req: FarmRequest, res: Response, next: NextFunction) {
    try {
      const range = z.enum(['daily', 'weekly', 'monthly']).parse(req.query.range || 'daily');
      const anchor = req.query.date ? parseUsageDate(req.query.date as string) : new Date();
      const data = await getFeedUsageReportData(req.farmId!, range, anchor);
      res.json(data);
    } catch (e) {
      if (e instanceof z.ZodError) return next(new AppError(e.errors[0].message, 400));
      next(e);
    }
  }

  static async exportReports(req: FarmRequest, res: Response, next: NextFunction) {
    try {
      const format = z.enum(['pdf', 'xlsx']).parse(req.query.format);
      const range = z.enum(['daily', 'weekly', 'monthly']).parse(req.query.range || 'daily');
      const anchor = req.query.date ? parseUsageDate(req.query.date as string) : new Date();

      const farm = await prisma.farm.findFirst({
        where: { id: req.farmId!, isDeleted: false },
        select: { name: true, logoUrl: true, currency: true },
      });
      if (!farm) return next(new AppError('Farm not found', 404));

      const report = await getFeedUsageReportData(req.farmId!, range, anchor);
      const purchaseRows = await listFeedPurchasesInPeriod(
        req.farmId!,
        new Date(report.start),
        new Date(report.end),
      );
      const purchases = purchaseRows.map(toFeedPurchaseExportRow);
      const payload = {
        farmName: farm.name,
        logoUrl: farm.logoUrl,
        currency: farm.currency ?? 'USD',
        range: report.range,
        start: report.start,
        end: report.end,
        series: report.series,
        totalsKg: report.totalsKg,
        purchases,
      };

      if (format === 'xlsx') {
        const buf = await buildFeedUsageReportXlsx(payload);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=feed_report.xlsx');
        return res.send(buf);
      }

      const buf = await buildFeedUsageReportPdf(payload);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=feed_report.pdf');
      return res.send(buf);
    } catch (e) {
      if (e instanceof z.ZodError) return next(new AppError(e.errors[0].message, 400));
      next(e);
    }
  }

  static async exportPurchaseHistory(req: FarmRequest, res: Response, next: NextFunction) {
    try {
      const format = z.enum(['pdf', 'xlsx']).parse(req.query.format);

      const farm = await prisma.farm.findFirst({
        where: { id: req.farmId!, isDeleted: false },
        select: { name: true, logoUrl: true, currency: true },
      });
      if (!farm) return next(new AppError('Farm not found', 404));

      const list = await prisma.feedPurchase.findMany({
        where: { farmId: req.farmId! },
        orderBy: { purchasedAt: 'asc' },
        take: 500,
        include: { createdBy: { select: { name: true } } },
      });
      const purchases = list.map((p) =>
        toFeedPurchaseExportRow({
          purchasedAt: p.purchasedAt,
          feedType: p.feedType,
          quantityKg: parseFloat(p.quantityKg.toFixed(3)),
          totalCost: parseFloat(p.totalCost.toFixed(2)),
          supplier: p.supplier,
          loggedByName: p.createdBy?.name?.trim() || '—',
        }),
      );

      const payload = {
        farmName: farm.name,
        logoUrl: farm.logoUrl,
        currency: farm.currency ?? 'USD',
        purchases,
      };

      if (format === 'xlsx') {
        const buf = await buildFeedPurchaseHistoryXlsx(payload);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=feed_purchase_history.xlsx');
        return res.send(buf);
      }

      const buf = await buildFeedPurchaseHistoryPdf(payload);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=feed_purchase_history.pdf');
      return res.send(buf);
    } catch (e) {
      if (e instanceof z.ZodError) return next(new AppError(e.errors[0].message, 400));
      next(e);
    }
  }

  static async getCosts(req: FarmRequest, res: Response, next: NextFunction) {
    try {
      const from = req.query.from ? parseUsageDate(req.query.from as string) : new Date(Date.UTC(2000, 0, 1));
      const to = req.query.to ? parseUsageDate(req.query.to as string) : new Date();
      const endOfTo = new Date(to);
      endOfTo.setUTCHours(23, 59, 59, 999);

      const { byType, totalSpend } = await costSummaryForRange(req.farmId!, from, endOfTo);
      const avgCostPerKg = FEED_TYPES.map((t) => {
        const kg = byType[t].kg;
        const spend = byType[t].spend;
        const avg = kg.gt(0) ? spend.div(kg) : new Prisma.Decimal(0);
        return {
          feedType: t,
          totalSpend: parseFloat(spend.toFixed(2)),
          totalKg: parseFloat(kg.toFixed(3)),
          avgCostPerKg: parseFloat(avg.toFixed(4)),
        };
      });

      res.json({
        from: from.toISOString(),
        to: endOfTo.toISOString(),
        totalSpend: parseFloat(totalSpend.toFixed(2)),
        byType: avgCostPerKg,
      });
    } catch (e) {
      next(e);
    }
  }
}
