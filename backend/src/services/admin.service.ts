import { FarmPlan, Prisma, Role } from '@prisma/client';
import prisma from '../config/database';
import { AppError } from '../middleware/error.middleware';

const PLAN_RANK: Record<FarmPlan, number> = {
  FREE: 0,
  GROWER: 1,
  ENTERPRISE: 2,
};

export type AdminPlanFilter = 'ALL' | FarmPlan;

export type AdminUserFarm = {
  farmId: string;
  farmName: string;
  plan: FarmPlan;
  role: string;
  memberCount: number;
  pigCount: number;
  hasStripe: boolean;
  isDeleted: boolean;
};

export type AdminUserRow = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  createdAt: Date;
  mfaEnabled: boolean;
  growerTrialUsedAt: Date | null;
  loginLockedUntil: Date | null;
  passwordResetLockedUntil: Date | null;
  hasGoogleAuth: boolean;
  ownedFarmCount: number;
  highestOwnedPlan: FarmPlan;
  isPaying: boolean;
  farms: AdminUserFarm[];
};

const userSelect = {
  id: true,
  email: true,
  name: true,
  phone: true,
  createdAt: true,
  mfaEnabled: true,
  growerTrialUsedAt: true,
  loginLockedUntil: true,
  passwordResetLockedUntil: true,
  googleId: true,
  farmMemberships: {
    select: {
      role: true,
      farm: {
        select: {
          id: true,
          name: true,
          plan: true,
          stripeSubscriptionId: true,
          isDeleted: true,
          _count: { select: { members: true, pigs: true } },
        },
      },
    },
  },
} satisfies Prisma.UserSelect;

type UserWithFarms = Prisma.UserGetPayload<{ select: typeof userSelect }>;

function mapUser(user: UserWithFarms): AdminUserRow {
  const farms: AdminUserFarm[] = user.farmMemberships
    .filter((m) => !m.farm.isDeleted)
    .map((m) => ({
      farmId: m.farm.id,
      farmName: m.farm.name,
      plan: m.farm.plan,
      role: m.role,
      memberCount: m.farm._count.members,
      pigCount: m.farm._count.pigs,
      hasStripe: !!m.farm.stripeSubscriptionId,
      isDeleted: m.farm.isDeleted,
    }));

  const owned = farms.filter((f) => f.role === 'OWNER');
  const highestOwnedPlan = owned.reduce<FarmPlan>(
    (best, f) => (PLAN_RANK[f.plan] > PLAN_RANK[best] ? f.plan : best),
    FarmPlan.FREE,
  );
  const isPaying = owned.some((f) => f.plan !== FarmPlan.FREE && f.hasStripe);

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    createdAt: user.createdAt,
    mfaEnabled: user.mfaEnabled,
    growerTrialUsedAt: user.growerTrialUsedAt,
    loginLockedUntil: user.loginLockedUntil,
    passwordResetLockedUntil: user.passwordResetLockedUntil,
    hasGoogleAuth: !!user.googleId,
    ownedFarmCount: owned.length,
    highestOwnedPlan,
    isPaying,
    farms,
  };
}

function planFilterWhere(plan: AdminPlanFilter): Prisma.UserWhereInput | undefined {
  if (plan === 'ALL') return undefined;
  if (plan === FarmPlan.FREE) {
    return {
      NOT: {
        farmMemberships: {
          some: {
            role: 'OWNER',
            farm: { plan: { in: [FarmPlan.GROWER, FarmPlan.ENTERPRISE] }, isDeleted: false },
          },
        },
      },
    };
  }
  return {
    farmMemberships: {
      some: {
        role: 'OWNER',
        farm: { plan, isDeleted: false },
      },
    },
  };
}

export class AdminService {
  static async getSummary() {
    const [totalUsers, farmsByPlan, payingOwners] = await Promise.all([
      prisma.user.count(),
      prisma.farm.groupBy({
        by: ['plan'],
        where: { isDeleted: false },
        _count: { _all: true },
      }),
      prisma.user.count({
        where: {
          farmMemberships: {
            some: {
              role: 'OWNER',
              farm: {
                isDeleted: false,
                plan: { in: [FarmPlan.GROWER, FarmPlan.ENTERPRISE] },
                stripeSubscriptionId: { not: null },
              },
            },
          },
        },
      }),
    ]);

    const planCounts = { FREE: 0, GROWER: 0, ENTERPRISE: 0 };
    for (const row of farmsByPlan) {
      planCounts[row.plan] = row._count._all;
    }

    return {
      totalUsers,
      totalFarms: planCounts.FREE + planCounts.GROWER + planCounts.ENTERPRISE,
      farmsByPlan: planCounts,
      payingOwners,
      freeOwners: totalUsers - payingOwners,
    };
  }

  static async listUsers(opts: {
    page: number;
    pageSize: number;
    plan?: AdminPlanFilter;
    search?: string;
  }) {
    const { page, pageSize, plan = 'ALL', search } = opts;
    const where: Prisma.UserWhereInput = {
      ...planFilterWhere(plan),
      ...(search
        ? {
            OR: [
              { email: { contains: search, mode: 'insensitive' } },
              { name: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        select: userSelect,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      users: users.map(mapUser),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  static async getUser(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: userSelect });
    if (!user) return null;
    return mapUser(user);
  }

  static async unlockUser(userId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { loginLockedUntil: null, passwordResetLockedUntil: null },
      select: { id: true, loginLockedUntil: true, passwordResetLockedUntil: true },
    });
  }

  static async forceLogout(userId: string) {
    await prisma.$transaction([
      prisma.refreshToken.deleteMany({ where: { userId } }),
      prisma.user.update({
        where: { id: userId },
        data: { tokenVersion: { increment: 1 } },
      }),
    ]);
    return { ok: true };
  }

  static async updateUser(userId: string, data: { name?: string; phone?: string | null }) {
    const patch: Prisma.UserUpdateInput = {};
    if (data.name !== undefined) patch.name = data.name.trim();
    if (data.phone !== undefined) patch.phone = data.phone?.trim() || null;
    return prisma.user.update({
      where: { id: userId },
      data: patch,
      select: { id: true, name: true, phone: true },
    });
  }

  static async resetGrowerTrial(userId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { growerTrialUsedAt: null },
      select: { id: true, growerTrialUsedAt: true },
    });
  }

  static async setFarmPlan(farmId: string, plan: FarmPlan) {
    return prisma.farm.update({
      where: { id: farmId },
      data: { plan },
      select: { id: true, name: true, plan: true },
    });
  }

  static async deleteUser(userId: string, adminUserId: string) {
    if (userId === adminUserId) {
      throw new AppError('Cannot delete your own account', 400);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        farmMemberships: {
          include: {
            farm: {
              select: {
                id: true,
                name: true,
                isDeleted: true,
                _count: { select: { members: true } },
              },
            },
          },
        },
      },
    });
    if (!user) return null;

    const ownedMemberships = user.farmMemberships.filter(
      (m) => m.role === Role.OWNER && !m.farm.isDeleted,
    );

    for (const m of ownedMemberships) {
      if (m.farm._count.members > 1) {
        throw new AppError(
          `Cannot delete: user owns "${m.farm.name}" which still has other members. Transfer ownership or remove members first.`,
          400,
        );
      }
    }

    const soleOwnedFarmIds = ownedMemberships
      .filter((m) => m.farm._count.members === 1)
      .map((m) => m.farm.id);

    await prisma.$transaction(async (tx) => {
      if (soleOwnedFarmIds.length > 0) {
        await tx.farm.updateMany({
          where: { id: { in: soleOwnedFarmIds } },
          data: { isDeleted: true },
        });
      }
      await tx.weightLog.deleteMany({ where: { userId } });
      await tx.auditLog.deleteMany({ where: { userId } });
      await tx.pigObservation.deleteMany({ where: { userId } });
      await tx.feedDailyUsage.deleteMany({ where: { userId } });
      await tx.user.delete({ where: { id: userId } });
    });

    return { ok: true };
  }

  static async exportUsersCsv(opts: { plan?: AdminPlanFilter; search?: string }) {
    const { plan = 'ALL', search } = opts;
    const where: Prisma.UserWhereInput = {
      ...planFilterWhere(plan),
      ...(search
        ? {
            OR: [
              { email: { contains: search, mode: 'insensitive' } },
              { name: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const users = await prisma.user.findMany({
      where,
      select: userSelect,
      orderBy: { createdAt: 'desc' },
      take: 10_000,
    });

    const rows = users.map(mapUser);
    const header = [
      'Email',
      'Name',
      'Phone',
      'Joined',
      'Highest Plan',
      'Paying',
      'Owned Farms',
      'Total Farms',
      'MFA Enabled',
      'Locked',
      'Grower Trial Used',
      'Farms',
    ];

    const lines = [
      header.join(','),
      ...rows.map((u) => {
        const locked =
          (u.loginLockedUntil != null && u.loginLockedUntil.getTime() > Date.now()) ||
          (u.passwordResetLockedUntil != null && u.passwordResetLockedUntil.getTime() > Date.now());
        const farms = u.farms
          .map((f) => `${f.farmName} (${f.role}/${f.plan}${f.hasStripe ? '/Stripe' : ''})`)
          .join('; ');
        return [
          csvEscape(u.email),
          csvEscape(u.name),
          csvEscape(u.phone),
          csvEscape(u.createdAt.toISOString()),
          csvEscape(u.highestOwnedPlan),
          csvEscape(u.isPaying ? 'yes' : 'no'),
          csvEscape(u.ownedFarmCount),
          csvEscape(u.farms.length),
          csvEscape(u.mfaEnabled ? 'yes' : 'no'),
          csvEscape(locked ? 'yes' : 'no'),
          csvEscape(u.growerTrialUsedAt?.toISOString() ?? ''),
          csvEscape(farms),
        ].join(',');
      }),
    ];

    return lines.join('\n');
  }
}

function csvEscape(value: string | number | boolean | null | undefined): string {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
