import { Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';
import { FarmRequest, ASSIGNABLE_ROLES } from '../middleware/rbac.middleware';
import { AppError } from '../middleware/error.middleware';
import { AuditService } from '../services/audit.service';
import { FarmPlan, Prisma } from '@prisma/client';
import { allowsMassImport, allowsMultiUser, allowsReports, allowsFinancialsExport, allowsEnterpriseAutomation, memberLimitForPlan, pigLimitForPlan } from '../config/planLimits';
import { normalizePhone } from '../lib/phone';
import { onHandPigsWhere } from '../lib/pigStock';
import { farmCurrencySchema } from '../config/farmCurrencies';

const createFarmSchema = z.object({
  name: z.string().min(2).max(100),
  location: z.string().min(2),
  country: z.string().min(2),
  currency: farmCurrencySchema.default('GBP'),
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
  feedLowStockThresholdKg: z.coerce.number().min(0).nullable().optional(),
  feedDefaultDailyBuckets: z
    .object({
      MAIZE_CRECHE: z.number().min(0).optional(),
      SOYA: z.number().min(0).optional(),
      PREMIX: z.number().min(0).optional(),
      CONCENTRATE: z.number().min(0).optional(),
      LACTATING: z.number().min(0).optional(),
      WEANER: z.number().min(0).optional(),
    })
    .optional()
    .nullable(),
  feedPurchasePriceUnit: z.enum(['KG', 'TONNE']).optional(),
  feedPurchasePrices: z
    .object({
      MAIZE_CRECHE: z.coerce.number().min(0).optional(),
      SOYA: z.coerce.number().min(0).optional(),
      PREMIX: z.coerce.number().min(0).optional(),
      CONCENTRATE: z.coerce.number().min(0).optional(),
      LACTATING: z.coerce.number().min(0).optional(),
      WEANER: z.coerce.number().min(0).optional(),
    })
    .optional()
    .nullable(),
  logoUrl: z.union([
    z.string().url(),
    z.string().regex(/^data:image\/(?:png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/, 'Invalid image data URL'),
    z.null(),
  ]).optional(),
  reportEmailCadence: z.enum(['OFF', 'WEEKLY', 'MONTHLY']).optional(),
  alertSmsPhone: z.string().max(20).nullable().optional(),
  alertSmsFarrowing: z.boolean().optional(),
  alertSmsLowStock: z.boolean().optional(),
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
        include: {
          _count: {
            select: {
              pigs: { where: { status: { notIn: ['SOLD', 'DECEASED'] } } },
              pens: true,
              members: true,
            },
          },
        },
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
            include: {
              _count: {
                select: {
                  pigs: { where: { status: { notIn: ['SOLD', 'DECEASED'] } } },
                  pens: true,
                  members: true,
                },
              },
            },
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
      // These reads are independent — run them concurrently to keep the
      // "open farm" dashboard load fast (avoids serial round-trips on cold starts).
      const [farm, stats, avgWeight, recentActivity, recentPigObservations, pigCount] =
        await Promise.all([
          prisma.farm.findUnique({
            where: { id: req.farmId! },
            include: {
              _count: {
                select: {
                  pigs: { where: { status: { notIn: ['SOLD', 'DECEASED'] } } },
                  pens: true,
                  members: true,
                },
              },
              members: { include: { user: { select: { id: true, name: true, email: true, photo: true } } } },
            },
          }),
          prisma.pig.groupBy({
            by: ['status'],
            where: { farmId: req.farmId! },
            _count: true,
          }),
          prisma.pig.aggregate({
            where: { farmId: req.farmId!, status: 'ACTIVE' },
            _avg: { currentWeight: true },
          }),
          prisma.auditLog.findMany({
            where: { farmId: req.farmId! },
            include: { user: { select: { id: true, name: true } } },
            orderBy: { createdAt: 'desc' },
            take: 10,
          }),
          prisma.pigObservation.findMany({
            where: { pig: { farmId: req.farmId! } },
            include: {
              pig: { select: { id: true, tagNumber: true } },
              user: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
          }),
          prisma.pig.count({ where: onHandPigsWhere(req.farmId!) }),
        ]);

      if (!farm || farm.isDeleted) return next(new AppError('Farm not found', 404));

      const pigLimit = pigLimitForPlan(farm.plan);
      const { stripeCustomerId: _c, stripeSubscriptionId: _s, ...farmPublic } = farm;

      res.json({
        farm: farmPublic,
        myRole: req.memberRole,
        billing: {
          plan: farm.plan,
          pigCount,
          pigLimit,
          nearLimit: pigLimit != null && pigCount >= pigLimit * 0.8,
          atLimit: pigLimit != null && pigCount >= pigLimit,
          canAccessReports: allowsReports(farm.plan),
          canUseMassImport: allowsMassImport(farm.plan),
          canManageTeam: allowsMultiUser(farm.plan),
          canExportFinancials: allowsFinancialsExport(farm.plan),
          canUseEnterpriseAutomation: allowsEnterpriseAutomation(farm.plan),
          memberLimit: farm.plan === FarmPlan.ENTERPRISE ? null : memberLimitForPlan(farm.plan),
        },
        stats: {
          byStatus: stats,
          avgWeight: avgWeight._avg.currentWeight || 0,
          recentActivity,
          recentPigObservations,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async update(req: FarmRequest, res: Response, next: NextFunction) {
    try {
      const parsed = updateFarmSchema.parse(req.body);
      const farmBefore = await prisma.farm.findUnique({
        where: { id: req.farmId! },
        select: { plan: true },
      });
      if (!farmBefore) return next(new AppError('Farm not found', 404));

      const wantsAutomation =
        parsed.reportEmailCadence !== undefined ||
        parsed.alertSmsPhone !== undefined ||
        parsed.alertSmsFarrowing !== undefined ||
        parsed.alertSmsLowStock !== undefined;
      const automationActive =
        (parsed.reportEmailCadence && parsed.reportEmailCadence !== 'OFF') ||
        parsed.alertSmsFarrowing === true ||
        parsed.alertSmsLowStock === true ||
        (parsed.alertSmsPhone != null && String(parsed.alertSmsPhone).trim() !== '');

      if (wantsAutomation && !allowsEnterpriseAutomation(farmBefore.plan)) {
        return next(
          new AppError('Scheduled reports and SMS alerts are available on the Enterprise plan.', 402),
        );
      }
      if (automationActive && !allowsEnterpriseAutomation(farmBefore.plan)) {
        return next(
          new AppError('Scheduled reports and SMS alerts are available on the Enterprise plan.', 402),
        );
      }

      let alertSmsPhone: string | null | undefined;
      if (parsed.alertSmsPhone !== undefined) {
        if (parsed.alertSmsPhone === null || String(parsed.alertSmsPhone).trim() === '') {
          alertSmsPhone = null;
        } else {
          const normalized = normalizePhone(String(parsed.alertSmsPhone));
          if (!normalized) {
            return next(new AppError('Alert SMS phone must be 8–15 digits', 400));
          }
          alertSmsPhone = normalized;
        }
      }

      const { feedDefaultDailyBuckets, feedPurchasePrices, alertSmsPhone: _dropPhone, ...rest } = parsed;
      const farm = await prisma.farm.update({
        where: { id: req.farmId! },
        data: {
          ...rest,
          ...(alertSmsPhone !== undefined ? { alertSmsPhone } : {}),
          ...(feedDefaultDailyBuckets !== undefined && {
            feedDefaultDailyBuckets:
              feedDefaultDailyBuckets === null
                ? Prisma.JsonNull
                : (feedDefaultDailyBuckets as Prisma.InputJsonValue),
          }),
          ...(feedPurchasePrices !== undefined && {
            feedPurchasePrices:
              feedPurchasePrices === null
                ? Prisma.JsonNull
                : (feedPurchasePrices as Prisma.InputJsonValue),
          }),
        },
      });
      await AuditService.log({
        userId: req.userId!, farmId: req.farmId!,
        action: 'UPDATE', entity: 'Farm', entityId: farm.id,
        details: JSON.stringify(parsed),
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

      const farm = await prisma.farm.findUnique({
        where: { id: req.farmId! },
        select: { plan: true, _count: { select: { members: true } } },
      });
      if (!farm) return next(new AppError('Farm not found', 404));
      const limit = memberLimitForPlan(farm.plan);
      if (farm._count.members >= limit) {
        if (farm.plan === FarmPlan.FREE) {
          return next(new AppError('Free plan supports only 1 user. Upgrade to Grower or Enterprise.', 402));
        }
        if (farm.plan === FarmPlan.GROWER) {
          return next(new AppError('Grower plan supports up to 5 users. Upgrade to Enterprise for more seats.', 402));
        }
      }

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
