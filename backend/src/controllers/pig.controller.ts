import { Response, NextFunction } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import prisma from '../config/database';
import { FarmRequest } from '../middleware/rbac.middleware';
import { AppError } from '../middleware/error.middleware';
import { AuditService } from '../services/audit.service';
import { FREE_TIER_MAX_PIGS, wouldExceedFreeTier } from '../config/planLimits';

const BREEDS = ['LARGE_WHITE', 'LANDRACE', 'DUROC', 'PIETRAIN', 'BERKSHIRE', 'HAMPSHIRE', 'CHESTER_WHITE', 'YORKSHIRE', 'TAMWORTH', 'MUKOTA', 'KOLBROEK', 'WINDSNYER', 'SA_LANDRACE', 'INDIGENOUS', 'CROSSBREED', 'OTHER'] as const;
const STAGES = ['BOAR', 'SOW', 'GILT', 'WEANER', 'PIGLET', 'PORKER'] as const;
const STATUSES = ['ACTIVE', 'SOLD', 'DECEASED', 'QUARANTINE'] as const;
const HEALTH = ['HEALTHY', 'SICK', 'UNDER_TREATMENT', 'RECOVERED'] as const;

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
      if (status) where.status = status;
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

      res.json(pig);
    } catch (error) {
      next(error);
    }
  }

  static async create(req: FarmRequest, res: Response, next: NextFunction) {
    try {
      const data = pigSchema.parse(req.body);

      const farm = await prisma.farm.findUnique({
        where: { id: req.farmId! },
        select: { plan: true },
      });
      if (!farm) return next(new AppError('Farm not found', 404));
      const pigCount = await prisma.pig.count({ where: { farmId: req.farmId! } });
      if (wouldExceedFreeTier(pigCount, 1, farm.plan)) {
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
        },
        include: { pen: { select: { id: true, name: true } } },
      });

      await AuditService.log({
        userId: req.userId!, farmId: req.farmId!,
        action: 'CREATE', entity: 'Pig', entityId: pig.id,
        details: `Added pig "${pig.tagNumber}"`,
      });

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

      const pig = await prisma.pig.update({
        where: { id: pigId },
        data: updateData,
        include: { pen: { select: { id: true, name: true } } },
      });

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
            notes: [
              data.complications ? `Complications: ${data.complications}` : null,
              data.birthWeight ? `Avg piglet weight: ${data.birthWeight}kg` : null,
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
      const newStatus = data.saleType === 'SLAUGHTER' ? 'DECEASED' : 'SOLD';

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
          id: true, tagNumber: true, breed: true, stage: true,
          healthStatus: true, dateOfBirth: true, currentWeight: true,
          servicedDate: true,
        },
        orderBy: { servicedDate: 'asc' },
      });

      const now = new Date();
      const servicedWithDates = sows.map(s => {
        const servicedDate = new Date(s.servicedDate!);
        const expectedBirthDate = new Date(servicedDate);
        expectedBirthDate.setDate(expectedBirthDate.getDate() + GESTATION_DAYS);
        const daysUntil = Math.ceil((expectedBirthDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return {
          ...s,
          currentWeight: Number(s.currentWeight),
          expectedBirthDate: expectedBirthDate.toISOString(),
          daysUntilBirth: daysUntil,
        };
      });

      const upcoming = servicedWithDates
        .filter(s => s.daysUntilBirth >= 0)
        .sort((a, b) => a.daysUntilBirth - b.daysUntilBirth);

      if (format === 'xlsx') {
        const XLSX = await import('xlsx');
        const wb = XLSX.utils.book_new();
        const rows = servicedWithDates.map(s => ({
          'Tag Number': s.tagNumber,
          'Breed': s.breed.replace(/_/g, ' '),
          'Stage': s.stage.charAt(0) + s.stage.slice(1).toLowerCase(),
          'Health': s.healthStatus.replace(/_/g, ' '),
          'Date of Birth': s.dateOfBirth ? new Date(s.dateOfBirth).toLocaleDateString() : '—',
          'Current Weight (kg)': s.currentWeight,
          'Serviced Date': new Date(s.servicedDate!).toLocaleDateString(),
          'Expected Birth Date': new Date(s.expectedBirthDate).toLocaleDateString(),
          'Days Until Birth': s.daysUntilBirth,
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

        const cols = ['Tag', 'Breed', 'Stage', 'Health', 'DOB', 'Weight', 'Serviced', 'Expected Birth', 'Days Left'];
        const colW = [60, 80, 50, 70, 70, 55, 70, 80, 50];
        let y = doc.y;
        doc.fontSize(8).fillColor('#333');
        let x = 30;
        cols.forEach((col, i) => { doc.font('Helvetica-Bold').text(col, x, y, { width: colW[i] }); x += colW[i]; });
        y += 16;
        doc.font('Helvetica').fillColor('#444');

        for (const s of servicedWithDates) {
          if (y > 540) { doc.addPage(); y = 30; }
          x = 30;
          const row = [
            s.tagNumber,
            s.breed.replace(/_/g, ' '),
            s.stage.charAt(0) + s.stage.slice(1).toLowerCase(),
            s.healthStatus.replace(/_/g, ' '),
            s.dateOfBirth ? new Date(s.dateOfBirth).toLocaleDateString() : '—',
            `${s.currentWeight}`,
            new Date(s.servicedDate!).toLocaleDateString(),
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
}
