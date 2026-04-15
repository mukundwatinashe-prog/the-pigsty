import { Response, NextFunction } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import prisma from '../config/database';
import { FarmRequest } from '../middleware/rbac.middleware';
import { AppError } from '../middleware/error.middleware';
import { AuditService } from '../services/audit.service';
import { FREE_TIER_MAX_PIGS, wouldExceedFreeTier } from '../config/planLimits';
import { syncPigGrowthStageIfNeeded } from '../services/pigStageSync.service';
import { onHandPigsWhere } from '../lib/pigStock';
import { notifyFarmLeads } from '../services/farmNotify.service';

const BREEDS = ['LARGE_WHITE', 'LANDRACE', 'DUROC', 'PIETRAIN', 'BERKSHIRE', 'HAMPSHIRE', 'CHESTER_WHITE', 'YORKSHIRE', 'TAMWORTH', 'MUKOTA', 'KOLBROEK', 'WINDSNYER', 'SA_LANDRACE', 'INDIGENOUS', 'CROSSBREED', 'OTHER'] as const;
const STAGES = ['BOAR', 'SOW', 'GILT', 'WEANER', 'PIGLET', 'PORKER', 'GROWER', 'FINISHER'] as const;
const STATUSES = ['ACTIVE', 'SOLD', 'DECEASED', 'QUARANTINE'] as const;
const HEALTH = ['HEALTHY', 'SICK', 'UNDER_TREATMENT', 'RECOVERED'] as const;

const PIG_OBSERVATION_CATEGORIES = [
  'GENERAL_WELLBEING',
  'APPETITE_FEED_INTAKE',
  'BEHAVIOUR_ACTIVITY',
  'RESPIRATORY_COUGHING',
  'DIGESTIVE_DIARRHEA',
  'SKIN_LESIONS',
  'LAMENESS_MOBILITY',
  'EYES_NOSE_DISCHARGE',
  'OTHER',
] as const;

const PIG_LIST_SORT_FIELDS = [
  'tagNumber',
  'breed',
  'stage',
  'currentWeight',
  'status',
  'healthStatus',
  'createdAt',
  'acquisitionDate',
] as const;

function pigListOrderBy(sortBy: string, sortOrder: string): Prisma.PigOrderByWithRelationInput {
  const dir: Prisma.SortOrder = sortOrder === 'asc' ? 'asc' : 'desc';
  if (sortBy === 'penName') {
    return { pen: { name: dir } };
  }
  if (PIG_LIST_SORT_FIELDS.includes(sortBy as (typeof PIG_LIST_SORT_FIELDS)[number])) {
    return { [sortBy]: dir } as Prisma.PigOrderByWithRelationInput;
  }
  return { createdAt: 'desc' };
}

const pigSchema = z.object({
  tagNumber: z.string().min(1).max(20),
  breed: z.enum(BREEDS),
  stage: z.enum(STAGES),
  dateOfBirth: z.string().optional().nullable(),
  acquisitionDate: z.string(),
  entryWeight: z.number().positive(),
  currentWeight: z.number().positive().optional(),
  status: z.enum(STATUSES).default('ACTIVE'),
  healthStatus: z.enum(HEALTH).default('HEALTHY'),
  serviced: z.boolean().optional().default(false),
  servicedDate: z.string().optional().nullable(),
  weanedDate: z.string().optional().nullable(),
  serviceHeatCheckAt: z.string().optional().nullable(),
  serviceHeatInHeat: z.boolean().optional().nullable(),
  penId: z.string().uuid().optional().nullable(),
  damId: z.string().uuid().optional().nullable(),
  sireId: z.string().uuid().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export class PigController {
  static async list(req: FarmRequest, res: Response, next: NextFunction) {
    try {
      const {
        page = '1', pageSize = '25',
        search, breed, status, healthStatus, penId,
        inStockOnly,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = req.query as Record<string, string>;

      const orderBy = pigListOrderBy(sortBy, sortOrder);

      const where: any = { farmId: req.farmId! };
      if (search) {
        where.tagNumber = { contains: search, mode: 'insensitive' };
      }
      if (breed) where.breed = breed;
      if (req.query.stage) where.stage = req.query.stage;
      if (status) {
        where.status = status;
      } else if (inStockOnly === '1' || inStockOnly === 'true') {
        where.status = { notIn: ['SOLD', 'DECEASED'] };
      }
      if (healthStatus) where.healthStatus = healthStatus;
      if (penId) where.penId = penId;

      const skip = (parseInt(page) - 1) * parseInt(pageSize);
      const [data, total] = await Promise.all([
        prisma.pig.findMany({
          where,
          include: {
            pen: { select: { id: true, name: true, type: true } },
          },
          orderBy,
          skip,
          take: parseInt(pageSize),
        }),
        prisma.pig.count({ where }),
      ]);

      await Promise.all(
        data.map(async (p) => {
          const nextStage = await syncPigGrowthStageIfNeeded(p);
          if (nextStage) p.stage = nextStage;
        }),
      );

      res.json({
        data,
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        totalPages: Math.ceil(total / parseInt(pageSize)),
      });
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: FarmRequest, res: Response, next: NextFunction) {
    try {
      const pigId = req.params.pigId as string;
      const pig = await prisma.pig.findUnique({
        where: { id: pigId },
        include: {
          pen: true,
          dam: { select: { id: true, tagNumber: true } },
          sire: { select: { id: true, tagNumber: true } },
          weightLogs: {
            orderBy: { date: 'desc' },
            include: { user: { select: { id: true, name: true } } },
          },
          vaccinations: { orderBy: { dateAdministered: 'desc' } },
          farrowingRecords: { orderBy: { farrowingDate: 'desc' } },
          damOffspring: { select: { id: true, tagNumber: true, status: true } },
          sireOffspring: { select: { id: true, tagNumber: true, status: true } },
        },
      });

      if (!pig || pig.farmId !== req.farmId!) {
        return next(new AppError('Pig not found', 404));
      }

      const nextStage = await syncPigGrowthStageIfNeeded(pig);
      if (nextStage) pig.stage = nextStage;

      res.json(pig);
    } catch (error) {
      next(error);
    }
  }

  static async create(req: FarmRequest, res: Response, next: NextFunction) {
    try {
      const data = pigSchema.parse(req.body);

      const farmPlan = await prisma.farm.findUnique({
        where: { id: req.farmId! },
        select: { plan: true },
      });
      if (!farmPlan) return next(new AppError('Farm not found', 404));
      const pigCount = await prisma.pig.count({ where: onHandPigsWhere(req.farmId!) });
      if (wouldExceedFreeTier(pigCount, 1, farmPlan.plan)) {
        return next(
          new AppError(
            `Free plan supports up to ${FREE_TIER_MAX_PIGS} pigs. Upgrade to Pro to add more.`,
            402,
          ),
        );
      }

      const pig = await prisma.pig.create({
        data: {
          ...data,
          farmId: req.farmId!,
          currentWeight: data.currentWeight ?? data.entryWeight,
          dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
          acquisitionDate: new Date(data.acquisitionDate),
          servicedDate: data.servicedDate ? new Date(data.servicedDate) : null,
          weanedDate: data.weanedDate ? new Date(data.weanedDate) : null,
          serviceHeatCheckAt: data.serviceHeatCheckAt ? new Date(data.serviceHeatCheckAt) : null,
          serviceHeatInHeat: data.serviceHeatInHeat ?? null,
        },
        include: { pen: { select: { id: true, name: true } } },
      });

      const createdStage = await syncPigGrowthStageIfNeeded(pig);
      if (createdStage) pig.stage = createdStage;

      await AuditService.log({
        userId: req.userId!, farmId: req.farmId!,
        action: 'CREATE', entity: 'Pig', entityId: pig.id,
        details: `Added pig "${pig.tagNumber}"`,
      });

      const [farmInfo, actor] = await Promise.all([
        prisma.farm.findUnique({
          where: { id: req.farmId! },
          select: { name: true },
        }),
        prisma.user.findUnique({
          where: { id: req.userId! },
          select: { name: true, email: true },
        }),
      ]);
      if (farmInfo) {
        await notifyFarmLeads({
          farmId: req.farmId!,
          subject: `[The Pigsty] Pig added — ${farmInfo.name}`,
          text: [
            `A pig was added to farm "${farmInfo.name}".`,
            '',
            'Breed breakdown:',
            `- ${pig.breed}: 1`,
            '',
            `Tag number: ${pig.tagNumber}`,
            `Stage: ${pig.stage}`,
            `Health status: ${pig.healthStatus}`,
            '',
            `Added by: ${actor?.name || 'Team member'} (${actor?.email || 'unknown'})`,
            `Time (UTC): ${new Date().toISOString()}`,
          ].join('\n'),
          logTag: 'farm-pig-added-single',
        });
      }

      res.status(201).json(pig);
    } catch (error) {
      if (error instanceof z.ZodError) return next(new AppError(error.errors[0].message, 400));
      next(error);
    }
  }

  static async update(req: FarmRequest, res: Response, next: NextFunction) {
    try {
      const pigId = req.params.pigId as string;
      const data = pigSchema.partial().parse(req.body);

      const updateData: any = { ...data };
      if (data.dateOfBirth) updateData.dateOfBirth = new Date(data.dateOfBirth);
      if (data.acquisitionDate) updateData.acquisitionDate = new Date(data.acquisitionDate);
      if (data.servicedDate) updateData.servicedDate = new Date(data.servicedDate);
      if (data.weanedDate !== undefined) {
        updateData.weanedDate = data.weanedDate ? new Date(data.weanedDate) : null;
      }
      if (data.serviceHeatCheckAt !== undefined) {
        updateData.serviceHeatCheckAt = data.serviceHeatCheckAt ? new Date(data.serviceHeatCheckAt) : null;
      }

      const pig = await prisma.pig.update({
        where: { id: pigId },
        data: updateData,
        include: { pen: { select: { id: true, name: true } } },
      });

      const updatedStage = await syncPigGrowthStageIfNeeded(pig);
      if (updatedStage) pig.stage = updatedStage;

      await AuditService.log({
        userId: req.userId!, farmId: req.farmId!,
        action: 'UPDATE', entity: 'Pig', entityId: pig.id,
        details: `Updated pig "${pig.tagNumber}"`,
      });

      res.json(pig);
    } catch (error) {
      if (error instanceof z.ZodError) return next(new AppError(error.errors[0].message, 400));
      next(error);
    }
  }

  static async delete(req: FarmRequest, res: Response, next: NextFunction) {
    try {
      const pigId = req.params.pigId as string;
      const pig = await prisma.pig.findUnique({ where: { id: pigId } });
      if (!pig || pig.farmId !== req.farmId!) return next(new AppError('Pig not found', 404));

      await prisma.pig.delete({ where: { id: pigId } });
      await AuditService.log({
        userId: req.userId!, farmId: req.farmId!,
        action: 'DELETE', entity: 'Pig', entityId: pigId,
        details: `Deleted pig "${pig.tagNumber}"`,
      });

      res.json({ message: 'Pig deleted' });
    } catch (error) {
      next(error);
    }
  }

  static async addFarrowing(req: FarmRequest, res: Response, next: NextFunction) {
    try {
      const pigId = req.params.pigId as string;
      const schema = z.object({
        farrowingDate: z.string(),
        pigletsBornAlive: z.number().int().min(0),
        pigletsBornDead: z.number().int().min(0).default(0),
        pigletsWeaned: z.number().int().min(0).optional().nullable(),
        weaningDate: z.string().optional().nullable(),
        avgBirthWeightKg: z.number().min(0).optional().nullable(),
        ironDate: z.string().optional().nullable(),
        tailDockedDate: z.string().optional().nullable(),
        teatClippedDate: z.string().optional().nullable(),
        notes: z.string().max(2000).optional().nullable(),
      });
      const data = schema.parse(req.body);

      const pig = await prisma.pig.findUnique({ where: { id: pigId } });
      if (!pig || pig.farmId !== req.farmId!) return next(new AppError('Pig not found', 404));

      const record = await prisma.farrowingRecord.create({
        data: {
          pigId,
          farrowingDate: new Date(data.farrowingDate),
          pigletsBornAlive: data.pigletsBornAlive,
          pigletsBornDead: data.pigletsBornDead,
          pigletsWeaned: data.pigletsWeaned ?? null,
          weaningDate: data.weaningDate ? new Date(data.weaningDate) : null,
          avgBirthWeightKg: data.avgBirthWeightKg ?? null,
          ironDate: data.ironDate ? new Date(data.ironDate) : null,
          tailDockedDate: data.tailDockedDate ? new Date(data.tailDockedDate) : null,
          teatClippedDate: data.teatClippedDate ? new Date(data.teatClippedDate) : null,
          notes: data.notes ?? null,
        },
      });

      await AuditService.log({
        userId: req.userId!, farmId: req.farmId!,
        action: 'CREATE', entity: 'FarrowingRecord', entityId: record.id,
        details: `Recorded farrowing for "${pig.tagNumber}": ${data.pigletsBornAlive} alive, ${data.pigletsBornDead} dead`,
      });

      res.status(201).json(record);
    } catch (error) {
      if (error instanceof z.ZodError) return next(new AppError(error.errors[0].message, 400));
      next(error);
    }
  }

  static async updateFarrowing(req: FarmRequest, res: Response, next: NextFunction) {
    try {
      const pigId = req.params.pigId as string;
      const recordId = req.params.recordId as string;
      const schema = z
        .object({
          pigletsWeaned: z.number().int().min(0).optional().nullable(),
          weaningDate: z.string().optional().nullable(),
          avgBirthWeightKg: z.number().min(0).optional().nullable(),
          ironDate: z.string().optional().nullable(),
          tailDockedDate: z.string().optional().nullable(),
          teatClippedDate: z.string().optional().nullable(),
          notes: z.string().max(2000).optional().nullable(),
        })
        .strict();
      const body = schema.parse(req.body);

      const pig = await prisma.pig.findUnique({ where: { id: pigId } });
      if (!pig || pig.farmId !== req.farmId!) return next(new AppError('Pig not found', 404));

      const existing = await prisma.farrowingRecord.findFirst({
        where: { id: recordId, pigId },
      });
      if (!existing) return next(new AppError('Farrowing record not found', 404));

      const updateData: Record<string, unknown> = {};
      if (body.pigletsWeaned !== undefined) updateData.pigletsWeaned = body.pigletsWeaned;
      if (body.weaningDate !== undefined) {
        updateData.weaningDate = body.weaningDate ? new Date(body.weaningDate) : null;
      }
      if (body.avgBirthWeightKg !== undefined) updateData.avgBirthWeightKg = body.avgBirthWeightKg;
      if (body.ironDate !== undefined) updateData.ironDate = body.ironDate ? new Date(body.ironDate) : null;
      if (body.tailDockedDate !== undefined) {
        updateData.tailDockedDate = body.tailDockedDate ? new Date(body.tailDockedDate) : null;
      }
      if (body.teatClippedDate !== undefined) {
        updateData.teatClippedDate = body.teatClippedDate ? new Date(body.teatClippedDate) : null;
      }
      if (body.notes !== undefined) updateData.notes = body.notes;

      const record = await prisma.farrowingRecord.update({
        where: { id: recordId },
        data: updateData as any,
      });

      await AuditService.log({
        userId: req.userId!,
        farmId: req.farmId!,
        action: 'UPDATE',
        entity: 'FarrowingRecord',
        entityId: record.id,
        details: `Updated farrowing record for "${pig.tagNumber}"`,
      });

      res.json(record);
    } catch (error) {
      if (error instanceof z.ZodError) return next(new AppError(error.errors[0].message, 400));
      next(error);
    }
  }

  static async completeBirth(req: FarmRequest, res: Response, next: NextFunction) {
    try {
      const pigId = req.params.pigId as string;
      const schema = z.object({
        farrowingDate: z.string(),
        pigletsBornAlive: z.number().int().min(0),
        pigletsBornDead: z.number().int().min(0).default(0),
        pigletsBornTotal: z.number().int().min(0).optional(),
        birthWeight: z.number().min(0).optional().nullable(),
        complications: z.string().max(2000).optional().nullable(),
        notes: z.string().max(2000).optional().nullable(),
      });
      const data = schema.parse(req.body);

      const pig = await prisma.pig.findUnique({ where: { id: pigId } });
      if (!pig || pig.farmId !== req.farmId!) return next(new AppError('Pig not found', 404));

      const [record] = await prisma.$transaction([
        prisma.farrowingRecord.create({
          data: {
            pigId,
            farrowingDate: new Date(data.farrowingDate),
            pigletsBornAlive: data.pigletsBornAlive,
            pigletsBornDead: data.pigletsBornDead,
            avgBirthWeightKg: data.birthWeight ?? null,
            notes: [
              data.complications ? `Complications: ${data.complications}` : null,
              data.notes || null,
            ].filter(Boolean).join('\n') || null,
          },
        }),
        prisma.pig.update({
          where: { id: pigId },
          data: { serviced: false, servicedDate: null },
        }),
      ]);

      await AuditService.log({
        userId: req.userId!, farmId: req.farmId!,
        action: 'CREATE', entity: 'FarrowingRecord', entityId: record.id,
        details: `Birth completed for "${pig.tagNumber}": ${data.pigletsBornAlive} alive, ${data.pigletsBornDead} dead. Serviced status reset.`,
      });

      res.status(201).json(record);
    } catch (error) {
      if (error instanceof z.ZodError) return next(new AppError(error.errors[0].message, 400));
      next(error);
    }
  }

  static async recordSale(req: FarmRequest, res: Response, next: NextFunction) {
    try {
      const pigId = req.params.pigId as string;
      const schema = z.object({
        saleType: z.enum(['LIVE_SALE', 'SLAUGHTER']),
        saleDate: z.string(),
        weightAtSale: z.number().min(0),
        buyer: z.string().max(200).optional().nullable(),
        notes: z.string().max(2000).optional().nullable(),
      });
      const data = schema.parse(req.body);

      const pig = await prisma.pig.findUnique({ where: { id: pigId } });
      if (!pig || pig.farmId !== req.farmId!) return next(new AppError('Pig not found', 404));

      const farm = await prisma.farm.findUnique({ where: { id: req.farmId! } });
      if (!farm) return next(new AppError('Farm not found', 404));

      const pricePerKg = Number(farm.pricePerKg);
      const totalPrice = parseFloat((data.weightAtSale * pricePerKg).toFixed(2));
      /** Inventory status is always SOLD for any sale; `saleType` on SaleRecord distinguishes live vs slaughter. */
      const newStatus = 'SOLD';

      const [record] = await prisma.$transaction([
        prisma.saleRecord.create({
          data: {
            pigId,
            farmId: req.farmId!,
            saleType: data.saleType,
            saleDate: new Date(data.saleDate),
            weightAtSale: data.weightAtSale,
            pricePerKg,
            totalPrice,
            buyer: data.buyer ?? null,
            notes: data.notes ?? null,
          },
        }),
        prisma.pig.update({
          where: { id: pigId },
          data: {
            status: newStatus as any,
            currentWeight: data.weightAtSale,
            serviced: false,
            servicedDate: null,
          },
        }),
      ]);

      await AuditService.log({
        userId: req.userId!, farmId: req.farmId!,
        action: 'CREATE', entity: 'SaleRecord', entityId: record.id,
        details: `${data.saleType === 'SLAUGHTER' ? 'Slaughtered' : 'Sold'} "${pig.tagNumber}" at ${data.weightAtSale}kg for ${farm.currency} ${totalPrice.toFixed(2)}`,
      });

      res.status(201).json({ ...record, totalPrice, pricePerKg, currency: farm.currency });
    } catch (error) {
      if (error instanceof z.ZodError) return next(new AppError(error.errors[0].message, 400));
      next(error);
    }
  }

  static async bulkRecordSale(req: FarmRequest, res: Response, next: NextFunction) {
    try {
      const schema = z.object({
        saleType: z.enum(['LIVE_SALE', 'SLAUGHTER']),
        saleDate: z.string(),
        buyer: z.string().max(200).optional().nullable(),
        notes: z.string().max(2000).optional().nullable(),
        items: z
          .array(
            z.object({
              pigId: z.string().uuid(),
              weightAtSale: z.number().min(0),
            }),
          )
          .min(1, 'At least one pig is required'),
      });
      const data = schema.parse(req.body);

      const pigIds = data.items.map((i) => i.pigId);
      if (new Set(pigIds).size !== pigIds.length) {
        return next(new AppError('Duplicate pig in list', 400));
      }

      const farm = await prisma.farm.findUnique({ where: { id: req.farmId! } });
      if (!farm) return next(new AppError('Farm not found', 404));
      const pricePerKg = Number(farm.pricePerKg);

      const pigs = await prisma.pig.findMany({
        where: { id: { in: pigIds }, farmId: req.farmId! },
        select: { id: true, tagNumber: true, status: true },
      });
      if (pigs.length !== pigIds.length) {
        return next(new AppError('One or more pigs were not found on this farm', 404));
      }
      for (const p of pigs) {
        if (p.status !== 'ACTIVE') {
          return next(new AppError(`Pig ${p.tagNumber} is not active`, 400));
        }
      }

      const weightById = new Map(data.items.map((i) => [i.pigId, i.weightAtSale]));
      const saleDate = new Date(data.saleDate);

      const records = await prisma.$transaction(async (tx) => {
        const out: {
          id: string;
          pigId: string;
          tagNumber: string;
          totalPrice: number;
        }[] = [];
        for (const pig of pigs) {
          const w = weightById.get(pig.id)!;
          const totalPrice = parseFloat((w * pricePerKg).toFixed(2));
          const newStatus = 'SOLD';
          const record = await tx.saleRecord.create({
            data: {
              pigId: pig.id,
              farmId: req.farmId!,
              saleType: data.saleType,
              saleDate,
              weightAtSale: w,
              pricePerKg,
              totalPrice,
              buyer: data.buyer ?? null,
              notes: data.notes ?? null,
            },
          });
          await tx.pig.update({
            where: { id: pig.id },
            data: {
              status: newStatus as any,
              currentWeight: w,
              serviced: false,
              servicedDate: null,
            },
          });
          out.push({
            id: record.id,
            pigId: pig.id,
            tagNumber: pig.tagNumber,
            totalPrice,
          });
        }
        return out;
      });

      await AuditService.log({
        userId: req.userId!,
        farmId: req.farmId!,
        action: 'BULK_CREATE',
        entity: 'SaleRecord',
        entityId: records[0]?.id ?? 'bulk',
        details: `Bulk ${data.saleType}: ${records.length} pigs (${records.map((r) => r.tagNumber).join(', ')})`,
      });

      const totalRevenue = records.reduce((s, r) => s + r.totalPrice, 0);
      res.status(201).json({
        count: records.length,
        currency: farm.currency,
        pricePerKg,
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        records,
      });
    } catch (error) {
      if (error instanceof z.ZodError) return next(new AppError(error.errors[0].message, 400));
      next(error);
    }
  }

  static async getServicedSows(req: FarmRequest, res: Response, next: NextFunction) {
    try {
      const GESTATION_DAYS = 114;
      const { format } = req.query as Record<string, string>;

      const sows = await prisma.pig.findMany({
        where: {
          farmId: req.farmId!,
          serviced: true,
          servicedDate: { not: null },
          stage: { in: ['SOW', 'GILT'] },
          status: 'ACTIVE',
        },
        select: {
          id: true,
          tagNumber: true,
          breed: true,
          stage: true,
          healthStatus: true,
          dateOfBirth: true,
          currentWeight: true,
          servicedDate: true,
          serviceHeatCheckAt: true,
          serviceHeatInHeat: true,
          _count: { select: { farrowingRecords: true } },
        },
        orderBy: { servicedDate: 'asc' },
      });

      const now = new Date();
      const msDay = 1000 * 60 * 60 * 24;
      const servicedWithDates = sows.map((s) => {
        const servicedDate = new Date(s.servicedDate!);
        const expectedBirthDate = new Date(servicedDate);
        expectedBirthDate.setDate(expectedBirthDate.getDate() + GESTATION_DAYS);
        const daysUntil = Math.ceil((expectedBirthDate.getTime() - now.getTime()) / msDay);
        const daysSinceService = Math.floor((now.getTime() - servicedDate.getTime()) / msDay);
        const gestationDays = daysSinceService;
        const day100Date = new Date(servicedDate);
        day100Date.setDate(day100Date.getDate() + 100);
        /** ~day 100 gestation ≈ 2 weeks before expected farrowing (114d) — Farrowsure-style prep window */
        const needsPreFarrowPrep =
          gestationDays >= 97 && gestationDays <= 103 && daysUntil >= 0;
        const needsHeatCheck =
          daysSinceService >= 21 && daysUntil > 0 && s.serviceHeatCheckAt == null;
        return {
          id: s.id,
          tagNumber: s.tagNumber,
          breed: s.breed,
          stage: s.stage,
          healthStatus: s.healthStatus,
          dateOfBirth: s.dateOfBirth,
          currentWeight: Number(s.currentWeight),
          servicedDate: s.servicedDate!.toISOString(),
          serviceHeatCheckAt: s.serviceHeatCheckAt?.toISOString() ?? null,
          serviceHeatInHeat: s.serviceHeatInHeat,
          expectedBirthDate: expectedBirthDate.toISOString(),
          daysUntilBirth: daysUntil,
          parity: s._count.farrowingRecords,
          gestationDays,
          day100Date: day100Date.toISOString(),
          needsPreFarrowPrep,
          needsHeatCheck,
        };
      });

      const upcoming = servicedWithDates
        .filter(s => s.daysUntilBirth >= 0)
        .sort((a, b) => a.daysUntilBirth - b.daysUntilBirth);

      if (format === 'xlsx') {
        const XLSX = await import('xlsx');
        const wb = XLSX.utils.book_new();
        const rows = servicedWithDates.map((s) => ({
          'Tag Number': s.tagNumber,
          'Breed': s.breed.replace(/_/g, ' '),
          'Stage': s.stage.charAt(0) + s.stage.slice(1).toLowerCase(),
          'Parity (litters)': s.parity,
          'Health': s.healthStatus.replace(/_/g, ' '),
          'Date of Birth': s.dateOfBirth ? new Date(s.dateOfBirth).toLocaleDateString() : '—',
          'Current Weight (kg)': s.currentWeight,
          'Serviced Date': new Date(s.servicedDate).toLocaleDateString(),
          'Gestation day': s.gestationDays,
          'Day 100 date': new Date(s.day100Date).toLocaleDateString(),
          'Expected Birth Date': new Date(s.expectedBirthDate).toLocaleDateString(),
          'Days Until Birth': s.daysUntilBirth,
          'Heat check (21d) due': s.needsHeatCheck ? 'Yes' : 'No',
          'Pre-farrow prep window': s.needsPreFarrowPrep ? 'Yes' : 'No',
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, 'Serviced Sows');
        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=serviced_sows.xlsx');
        return res.send(Buffer.from(buf));
      }

      if (format === 'pdf') {
        const PDFDocument = (await import('pdfkit')).default;
        const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=serviced_sows.pdf');
        doc.pipe(res);

        const farm = await prisma.farm.findUnique({ where: { id: req.farmId! } });
        doc.fontSize(16).text(`${farm?.name ?? 'Farm'} — Serviced Sows Report`, { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(10).fillColor('#666').text(`Generated ${new Date().toLocaleDateString()}`, { align: 'center' });
        doc.moveDown();

        const cols = [
          'Tag',
          'Breed',
          'Stage',
          'Parity',
          'Health',
          'DOB',
          'Wt',
          'Serviced',
          'G#',
          'Due',
          'Left',
        ];
        const colW = [52, 68, 40, 28, 58, 58, 40, 54, 22, 54, 34];
        let y = doc.y;
        doc.fontSize(8).fillColor('#333');
        let x = 30;
        cols.forEach((col, i) => { doc.font('Helvetica-Bold').text(col, x, y, { width: colW[i] }); x += colW[i]; });
        y += 16;
        doc.font('Helvetica').fillColor('#444');

        for (const s of servicedWithDates) {
          if (y > 520) { doc.addPage(); y = 30; }
          x = 30;
          const row = [
            s.tagNumber,
            s.breed.replace(/_/g, ' '),
            s.stage.charAt(0) + s.stage.slice(1).toLowerCase(),
            `${s.parity}`,
            s.healthStatus.replace(/_/g, ' '),
            s.dateOfBirth ? new Date(s.dateOfBirth).toLocaleDateString() : '—',
            `${s.currentWeight}`,
            new Date(s.servicedDate).toLocaleDateString(),
            `${s.gestationDays}`,
            new Date(s.expectedBirthDate).toLocaleDateString(),
            `${s.daysUntilBirth}`,
          ];
          row.forEach((cell, i) => { doc.text(cell, x, y, { width: colW[i] }); x += colW[i]; });
          y += 14;
        }

        doc.end();
        return;
      }

      res.json({
        totalServiced: servicedWithDates.length,
        nearestBirth: upcoming[0] || null,
        sows: servicedWithDates,
      });
    } catch (error) {
      next(error);
    }
  }

  static async addObservation(req: FarmRequest, res: Response, next: NextFunction) {
    try {
      const pigId = req.params.pigId as string;
      const schema = z.object({
        category: z.enum(PIG_OBSERVATION_CATEGORIES),
        notes: z.string().max(2000).optional().nullable(),
      });
      const data = schema.parse(req.body);

      const pig = await prisma.pig.findUnique({ where: { id: pigId } });
      if (!pig || pig.farmId !== req.farmId!) return next(new AppError('Pig not found', 404));

      const record = await prisma.pigObservation.create({
        data: {
          pigId,
          userId: req.userId!,
          category: data.category,
          notes: data.notes?.trim() || null,
        },
        include: {
          pig: { select: { id: true, tagNumber: true } },
          user: { select: { id: true, name: true } },
        },
      });

      await AuditService.log({
        userId: req.userId!, farmId: req.farmId!,
        action: 'CREATE', entity: 'PigObservation', entityId: record.id,
        details: `Health observation for pig "${pig.tagNumber}" (${data.category})`,
      });

      res.status(201).json(record);
    } catch (error) {
      if (error instanceof z.ZodError) return next(new AppError(error.errors[0].message, 400));
      next(error);
    }
  }

  static async addVaccination(req: FarmRequest, res: Response, next: NextFunction) {
    try {
      const pigId = req.params.pigId as string;
      const schema = z.object({
        name: z.string().min(1).max(200),
        batchNumber: z.string().max(100).optional().nullable(),
        dateAdministered: z.string(),
        nextDueDate: z.string().optional().nullable(),
        administeredBy: z.string().max(200).optional().nullable(),
      });
      const data = schema.parse(req.body);

      const pig = await prisma.pig.findUnique({ where: { id: pigId } });
      if (!pig || pig.farmId !== req.farmId!) return next(new AppError('Pig not found', 404));

      const record = await prisma.vaccination.create({
        data: {
          pigId,
          name: data.name.trim(),
          batchNumber: data.batchNumber?.trim() || null,
          dateAdministered: new Date(data.dateAdministered),
          nextDueDate: data.nextDueDate ? new Date(data.nextDueDate) : null,
          administeredBy: data.administeredBy?.trim() || null,
        },
      });

      await AuditService.log({
        userId: req.userId!, farmId: req.farmId!,
        action: 'CREATE', entity: 'Vaccination', entityId: record.id,
        details: `Vaccination "${data.name}" for pig "${pig.tagNumber}"`,
      });

      res.status(201).json(record);
    } catch (error) {
      if (error instanceof z.ZodError) return next(new AppError(error.errors[0].message, 400));
      next(error);
    }
  }

  static async updateVaccination(req: FarmRequest, res: Response, next: NextFunction) {
    try {
      const pigId = req.params.pigId as string;
      const vaccinationId = req.params.vaccinationId as string;
      const schema = z
        .object({
          name: z.string().min(1).max(200).optional(),
          batchNumber: z.string().max(100).optional().nullable(),
          dateAdministered: z.string().optional(),
          nextDueDate: z.string().optional().nullable(),
          administeredBy: z.string().max(200).optional().nullable(),
        })
        .strict();
      const body = schema.parse(req.body);

      const pig = await prisma.pig.findUnique({ where: { id: pigId } });
      if (!pig || pig.farmId !== req.farmId!) return next(new AppError('Pig not found', 404));

      const existing = await prisma.vaccination.findFirst({
        where: { id: vaccinationId, pigId },
      });
      if (!existing) return next(new AppError('Vaccination not found', 404));

      const updateData: Record<string, unknown> = {};
      if (body.name !== undefined) updateData.name = body.name.trim();
      if (body.batchNumber !== undefined) updateData.batchNumber = body.batchNumber?.trim() || null;
      if (body.dateAdministered !== undefined) updateData.dateAdministered = new Date(body.dateAdministered);
      if (body.nextDueDate !== undefined) {
        updateData.nextDueDate = body.nextDueDate ? new Date(body.nextDueDate) : null;
      }
      if (body.administeredBy !== undefined) updateData.administeredBy = body.administeredBy?.trim() || null;

      if (Object.keys(updateData).length === 0) {
        return res.json(existing);
      }

      const record = await prisma.vaccination.update({
        where: { id: vaccinationId },
        data: updateData as any,
      });

      await AuditService.log({
        userId: req.userId!, farmId: req.farmId!,
        action: 'UPDATE', entity: 'Vaccination', entityId: record.id,
        details: `Updated vaccination for pig "${pig.tagNumber}"`,
      });

      res.json(record);
    } catch (error) {
      if (error instanceof z.ZodError) return next(new AppError(error.errors[0].message, 400));
      next(error);
    }
  }

  static async deleteVaccination(req: FarmRequest, res: Response, next: NextFunction) {
    try {
      const pigId = req.params.pigId as string;
      const vaccinationId = req.params.vaccinationId as string;

      const pig = await prisma.pig.findUnique({ where: { id: pigId } });
      if (!pig || pig.farmId !== req.farmId!) return next(new AppError('Pig not found', 404));

      const existing = await prisma.vaccination.findFirst({
        where: { id: vaccinationId, pigId },
      });
      if (!existing) return next(new AppError('Vaccination not found', 404));

      await prisma.vaccination.delete({ where: { id: vaccinationId } });

      await AuditService.log({
        userId: req.userId!, farmId: req.farmId!,
        action: 'DELETE', entity: 'Vaccination', entityId: vaccinationId,
        details: `Removed vaccination "${existing.name}" for pig "${pig.tagNumber}"`,
      });

      res.json({ message: 'Vaccination deleted' });
    } catch (error) {
      next(error);
    }
  }
}
