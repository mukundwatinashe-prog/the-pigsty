import { Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../config/database';
import { FarmRequest } from '../middleware/rbac.middleware';
import { AppError } from '../middleware/error.middleware';
import { AuditService } from '../services/audit.service';
import { pigOnStockOnlyWhere } from '../lib/pigStock';
import { notifyFarmLeads } from '../services/farmNotify.service';

const penSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['FARROWING', 'GROWER', 'FINISHER', 'BOAR', 'QUARANTINE', 'NURSERY']),
  capacity: z.number().int().positive(),
});

export class PenController {
  static async getById(req: FarmRequest, res: Response, next: NextFunction) {
    try {
      const penId = req.params.penId as string;
      const pen = await prisma.pen.findFirst({
        where: { id: penId, farmId: req.farmId! },
        include: {
          _count: {
            select: {
              pigs: { where: pigOnStockOnlyWhere },
            },
          },
          pigs: {
            where: pigOnStockOnlyWhere,
            orderBy: { tagNumber: 'asc' },
            select: {
              id: true,
              tagNumber: true,
              name: true,
              breed: true,
              stage: true,
              currentWeight: true,
              status: true,
              healthStatus: true,
              acquisitionDate: true,
              dateOfBirth: true,
            },
          },
        },
      });
      if (!pen) return next(new AppError('Pen not found', 404));
      res.json(pen);
    } catch (error) {
      next(error);
    }
  }

  static async list(req: FarmRequest, res: Response, next: NextFunction) {
    try {
      const pens = await prisma.pen.findMany({
        where: { farmId: req.farmId! },
        include: {
          _count: {
            select: {
              pigs: { where: pigOnStockOnlyWhere },
            },
          },
        },
        orderBy: { name: 'asc' },
      });
      res.json(pens);
    } catch (error) {
      next(error);
    }
  }

  static async create(req: FarmRequest, res: Response, next: NextFunction) {
    try {
      const data = penSchema.parse(req.body);
      const [farm, actor] = await Promise.all([
        prisma.farm.findUnique({
          where: { id: req.farmId! },
          select: { id: true, name: true },
        }),
        prisma.user.findUnique({
          where: { id: req.userId! },
          select: { name: true, email: true },
        }),
      ]);
      if (!farm) return next(new AppError('Farm not found', 404));
      const pen = await prisma.pen.create({
        data: { ...data, farmId: req.farmId! },
        include: {
          _count: {
            select: {
              pigs: { where: pigOnStockOnlyWhere },
            },
          },
        },
      });
      await AuditService.log({
        userId: req.userId!, farmId: req.farmId!,
        action: 'CREATE', entity: 'Pen', entityId: pen.id,
        details: `Created pen "${pen.name}"`,
      });
      await notifyFarmLeads({
        farmId: req.farmId!,
        subject: `[The Pigsty] New pen created — ${farm.name}`,
        text: [
          `A new pen was created on farm "${farm.name}".`,
          '',
          `Pen name: ${pen.name}`,
          `Pen type: ${pen.type}`,
          `Capacity: ${pen.capacity}`,
          '',
          `Created by: ${actor?.name || 'Team member'} (${actor?.email || 'unknown'})`,
          `Time (UTC): ${new Date().toISOString()}`,
        ].join('\n'),
        logTag: 'farm-pen-created',
      });
      res.status(201).json(pen);
    } catch (error) {
      if (error instanceof z.ZodError) return next(new AppError(error.errors[0].message, 400));
      next(error);
    }
  }

  static async update(req: FarmRequest, res: Response, next: NextFunction) {
    try {
      const penId = req.params.penId as string;
      const data = penSchema.partial().parse(req.body);
      const pen = await prisma.pen.update({
        where: { id: penId },
        data,
        include: {
          _count: {
            select: {
              pigs: { where: pigOnStockOnlyWhere },
            },
          },
        },
      });
      await AuditService.log({
        userId: req.userId!, farmId: req.farmId!,
        action: 'UPDATE', entity: 'Pen', entityId: pen.id,
      });
      res.json(pen);
    } catch (error) {
      if (error instanceof z.ZodError) return next(new AppError(error.errors[0].message, 400));
      next(error);
    }
  }

  static async delete(req: FarmRequest, res: Response, next: NextFunction) {
    try {
      const penId = req.params.penId as string;
      await prisma.pen.delete({ where: { id: penId } });
      await AuditService.log({
        userId: req.userId!, farmId: req.farmId!,
        action: 'DELETE', entity: 'Pen', entityId: penId,
      });
      res.json({ message: 'Pen deleted' });
    } catch (error) {
      next(error);
    }
  }
}
