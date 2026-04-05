import { Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../config/database';
import { FarmRequest } from '../middleware/rbac.middleware';
import { AppError } from '../middleware/error.middleware';
import { AuditService } from '../services/audit.service';

const weightSchema = z.object({
  pigId: z.string().uuid(),
  weight: z.number().positive(),
  date: z.string(),
  notes: z.string().optional(),
});

const bulkWeightSchema = z.object({
  penId: z.string().uuid(),
  date: z.string(),
  notes: z.string().optional(),
  weights: z.array(z.object({
    pigId: z.string().uuid(),
    weight: z.number().positive(),
  })).min(1, 'At least one pig weight is required'),
});

export class WeightController {
  static async logWeight(req: FarmRequest, res: Response, next: NextFunction) {
    try {
      const data = weightSchema.parse(req.body);
      const pig = await prisma.pig.findUnique({ where: { id: data.pigId } });
      if (!pig || pig.farmId !== req.farmId!) return next(new AppError('Pig not found', 404));

      const log = await prisma.weightLog.create({
        data: {
          pigId: data.pigId,
          userId: req.userId!,
          weight: data.weight,
          date: new Date(data.date),
          notes: data.notes,
        },
        include: { user: { select: { id: true, name: true } } },
      });

      await prisma.pig.update({
        where: { id: data.pigId },
        data: { currentWeight: data.weight },
      });

      await AuditService.log({
        userId: req.userId!, farmId: req.farmId!,
        action: 'CREATE', entity: 'WeightLog', entityId: log.id,
        details: `Logged ${data.weight}kg for pig ${pig.tagNumber}`,
      });

      res.status(201).json(log);
    } catch (error) {
      if (error instanceof z.ZodError) return next(new AppError(error.errors[0].message, 400));
      next(error);
    }
  }

  static async bulkLogByPen(req: FarmRequest, res: Response, next: NextFunction) {
    try {
      const data = bulkWeightSchema.parse(req.body);

      const penPigs = await prisma.pig.findMany({
        where: { farmId: req.farmId!, penId: data.penId, status: 'ACTIVE' },
        select: { id: true, tagNumber: true },
      });
      if (penPigs.length === 0) return next(new AppError('No active pigs in this pen', 404));

      const penPigIds = new Set(penPigs.map(p => p.id));
      const validEntries = data.weights.filter(w => penPigIds.has(w.pigId));
      if (validEntries.length === 0) return next(new AppError('No valid pig weights provided', 400));

      const logs = [];
      for (const entry of validEntries) {
        const log = await prisma.weightLog.create({
          data: {
            pigId: entry.pigId,
            userId: req.userId!,
            weight: entry.weight,
            date: new Date(data.date),
            notes: data.notes,
          },
        });
        await prisma.pig.update({
          where: { id: entry.pigId },
          data: { currentWeight: entry.weight },
        });
        logs.push(log);
      }

      const totalWeight = validEntries.reduce((s, e) => s + e.weight, 0);
      const avgWeight = totalWeight / validEntries.length;

      await AuditService.log({
        userId: req.userId!, farmId: req.farmId!,
        action: 'BULK_CREATE', entity: 'WeightLog', entityId: data.penId,
        details: `Bulk weight log: ${validEntries.length} pigs, avg ${avgWeight.toFixed(1)}kg, total ${totalWeight.toFixed(1)}kg`,
      });

      res.status(201).json({ logged: validEntries.length, totalWeight, avgWeight, logs });
    } catch (error) {
      if (error instanceof z.ZodError) return next(new AppError(error.errors[0].message, 400));
      next(error);
    }
  }

  static async getHistory(req: FarmRequest, res: Response, next: NextFunction) {
    try {
      const pigId = req.params.pigId as string;
      const pig = await prisma.pig.findUnique({ where: { id: pigId } });
      if (!pig || pig.farmId !== req.farmId!) return next(new AppError('Pig not found', 404));

      const logs = await prisma.weightLog.findMany({
        where: { pigId },
        include: { user: { select: { id: true, name: true } } },
        orderBy: { date: 'asc' },
      });

      // Calculate ADG
      let adg = 0;
      if (logs.length >= 2) {
        const first = logs[0];
        const last = logs[logs.length - 1];
        const days = (new Date(last.date).getTime() - new Date(first.date).getTime()) / (1000 * 60 * 60 * 24);
        if (days > 0) {
          adg = (Number(last.weight) - Number(first.weight)) / days;
        }
      }

      res.json({ logs, adg: Math.round(adg * 100) / 100 });
    } catch (error) {
      next(error);
    }
  }

  static async getRecentLogs(req: FarmRequest, res: Response, next: NextFunction) {
    try {
      const { page = '1', pageSize = '50' } = req.query as Record<string, string>;
      const skip = (parseInt(page) - 1) * parseInt(pageSize);

      const pigIds = (await prisma.pig.findMany({
        where: { farmId: req.farmId! },
        select: { id: true },
      })).map(p => p.id);

      const [data, total] = await Promise.all([
        prisma.weightLog.findMany({
          where: { pigId: { in: pigIds } },
          include: {
            pig: { select: { id: true, tagNumber: true, name: true } },
            user: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: parseInt(pageSize),
        }),
        prisma.weightLog.count({ where: { pigId: { in: pigIds } } }),
      ]);

      res.json({ data, total, page: parseInt(page), pageSize: parseInt(pageSize), totalPages: Math.ceil(total / parseInt(pageSize)) });
    } catch (error) {
      next(error);
    }
  }
}
