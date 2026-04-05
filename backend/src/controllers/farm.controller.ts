import { Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';
import { FarmRequest, ASSIGNABLE_ROLES } from '../middleware/rbac.middleware';
import { AppError } from '../middleware/error.middleware';
import { AuditService } from '../services/audit.service';
import { FarmPlan } from '@prisma/client';
import { FREE_TIER_MAX_PIGS, pigLimitForPlan } from '../config/planLimits';
import { farmCurrencySchema } from '../config/farmCurrencies';

const createFarmSchema = z.object({
  name: z.string().min(2).max(100),
  location: z.string().min(2),
  country: z.string().min(2),
  currency: farmCurrencySchema.default('USD'),
  timezone: z.string().default('UTC'),
  weightUnit: z.string().default('kg'),
});

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['FARM_MANAGER', 'WORKER']),
});

const updateFarmSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  location: z.string().min(2).optional(),
  country: z.string().min(2).optional(),
  currency: farmCurrencySchema.optional(),
  timezone: z.string().optional(),
  weightUnit: z.string().optional(),
  pricePerKg: z.coerce.number().min(0).optional(),
  logoUrl: z.union([
    z.string().url(),
    z.string().regex(/^data:image\/(?:png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/, 'Invalid image data URL'),
    z.null(),
  ]).optional(),
});

export class FarmController {
  static async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = createFarmSchema.parse(req.body);
      const farm = await prisma.farm.create({
        data: {
          ...data,
          members: { create: { userId: req.userId!, role: 'OWNER' } },
        },
        include: { _count: { select: { pigs: true, pens: true, members: true } } },
      });
      const { stripeCustomerId: _c, stripeSubscriptionId: _s, ...farmPublic } = farm;
      res.status(201).json(farmPublic);
    } catch (error) {
      if (error instanceof z.ZodError) return next(new AppError(error.errors[0].message, 400));
      next(error);
    }
  }

  static async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const memberships = await prisma.farmMember.findMany({
        where: { userId: req.userId! },
        include: {
          farm: {
            include: { _count: { select: { pigs: true, pens: true, members: true } } },
          },
        },
      });
      const farms = memberships
        .filter(m => !m.farm.isDeleted)
        .map(m => {
          const { stripeCustomerId: _c, stripeSubscriptionId: _s, ...farmPublic } = m.farm;
          return { ...farmPublic, role: m.role };
        });
      res.json(farms);
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: FarmRequest, res: Response, next: NextFunction) {
    try {
      const farm = await prisma.farm.findUnique({
        where: { id: req.farmId! },
        include: {
          _count: { select: { pigs: true, pens: true, members: true } },
          members: { include: { user: { select: { id: true, name: true, email: true, photo: true } } } },
        },
      });
      if (!farm || farm.isDeleted) return next(new AppError('Farm not found', 404));

      const stats = await prisma.pig.groupBy({
        by: ['status'],
        where: { farmId: req.farmId! },
        _count: true,
      });

      const avgWeight = await prisma.pig.aggregate({
        where: { farmId: req.farmId!, status: 'ACTIVE' },
        _avg: { currentWeight: true },
      });

      const recentActivity = await prisma.auditLog.findMany({
        where: { farmId: req.farmId! },
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      const pigCount = farm._count.pigs;
      const { stripeCustomerId: _c, stripeSubscriptionId: _s, ...farmPublic } = farm;

      res.json({
        farm: farmPublic,
        myRole: req.memberRole,
        billing: {
          plan: farm.plan,
          pigCount,
          pigLimit: pigLimitForPlan(farm.plan),
          nearLimit: farm.plan === FarmPlan.FREE && pigCount >= FREE_TIER_MAX_PIGS * 0.8,
          atLimit: farm.plan === FarmPlan.FREE && pigCount >= FREE_TIER_MAX_PIGS,
        },
        stats: {
          byStatus: stats,
          avgWeight: avgWeight._avg.currentWeight || 0,
          recentActivity,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async update(req: FarmRequest, res: Response, next: NextFunction) {
    try {
      const data = updateFarmSchema.parse(req.body);
      const farm = await prisma.farm.update({
        where: { id: req.farmId! },
        data,
      });
      await AuditService.log({
        userId: req.userId!, farmId: req.farmId!,
        action: 'UPDATE', entity: 'Farm', entityId: farm.id,
        details: JSON.stringify(data),
      });
      const { stripeCustomerId: _sc, stripeSubscriptionId: _ss, ...farmPublic } = farm;
      res.json(farmPublic);
    } catch (error) {
      if (error instanceof z.ZodError) return next(new AppError(error.errors[0].message, 400));
      next(error);
    }
  }

  static async delete(req: FarmRequest, res: Response, next: NextFunction) {
    try {
      await prisma.farm.update({ where: { id: req.farmId! }, data: { isDeleted: true } });
      res.json({ message: 'Farm deleted' });
    } catch (error) {
      next(error);
    }
  }

  static async invite(req: FarmRequest, res: Response, next: NextFunction) {
    try {
      const { email, role } = inviteSchema.parse(req.body);
      const assignable = ASSIGNABLE_ROLES[req.memberRole!] || [];
      if (!assignable.includes(role)) {
        return next(new AppError(`Cannot assign role ${role}`, 403));
      }

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) return next(new AppError('User not found. They must register first.', 404));

      const existing = await prisma.farmMember.findUnique({
        where: { userId_farmId: { userId: user.id, farmId: req.farmId! } },
      });
      if (existing) return next(new AppError('User already a member', 400));

      const member = await prisma.farmMember.create({
        data: { userId: user.id, farmId: req.farmId!, role: role as any },
        include: { user: { select: { id: true, name: true, email: true } } },
      });

      await AuditService.log({
        userId: req.userId!, farmId: req.farmId!,
        action: 'INVITE', entity: 'FarmMember', entityId: member.id,
        details: `Invited ${email} as ${role}`,
      });

      res.status(201).json(member);
    } catch (error) {
      if (error instanceof z.ZodError) return next(new AppError(error.errors[0].message, 400));
      next(error);
    }
  }

  static async removeMember(req: FarmRequest, res: Response, next: NextFunction) {
    try {
      const memberId = req.params.memberId as string;
      const member = await prisma.farmMember.findUnique({ where: { id: memberId } });
      if (!member || member.farmId !== req.farmId!) return next(new AppError('Member not found', 404));
      if (member.role === 'OWNER') return next(new AppError('Cannot remove the farm owner', 400));

      await prisma.farmMember.delete({ where: { id: memberId } });
      await AuditService.log({
        userId: req.userId!, farmId: req.farmId!,
        action: 'REMOVE', entity: 'FarmMember', entityId: memberId,
      });
      res.json({ message: 'Member removed' });
    } catch (error) {
      next(error);
    }
  }
}
