import { FarmPlan, Prisma, Role } from '@prisma/client';
import Stripe from 'stripe';
import prisma from '../config/database';
import { env } from '../config/env';
import { AppError } from '../middleware/error.middleware';

function stripeClient(): Stripe | null {
  if (!env.STRIPE_SECRET_KEY) return null;
  return new Stripe(env.STRIPE_SECRET_KEY);
}

function emptyTrial(): TrialInfo {
  return { isOnTrial: false, trialEndsAt: null, daysLeft: null };
}

function trialFromEnd(trialEnd: Date): TrialInfo {
  const ms = trialEnd.getTime() - Date.now();
  if (ms <= 0) return emptyTrial();
  return {
    isOnTrial: true,
    trialEndsAt: trialEnd.toISOString(),
    daysLeft: Math.ceil(ms / (24 * 60 * 60 * 1000)),
  };
}

function trialForFarm(farmId: string, trialMap: Map<string, Date>): TrialInfo {
  const end = trialMap.get(farmId);
  return end ? trialFromEnd(end) : emptyTrial();
}

function activeTrialForUser(farms: AdminUserFarm[]): TrialInfo | null {
  const onTrial = farms.filter((f) => f.role === 'OWNER' && f.trial.isOnTrial);
  if (onTrial.length === 0) return null;
  return onTrial.reduce((soonest, f) => {
    if (!soonest) return f.trial;
    const a = soonest.daysLeft ?? 999;
    const b = f.trial.daysLeft ?? 999;
    return b < a ? f.trial : soonest;
  }, null as TrialInfo | null);
}

/** Active Grower free trials from Stripe (status=trialing). Keyed by farm id. */
async function fetchActiveTrialsByFarmId(): Promise<Map<string, Date>> {
  const map = new Map<string, Date>();
  const stripe = stripeClient();
  if (!stripe) return map;

  const subsMissingFarmId: { subId: string; trialEnd: Date }[] = [];
  let startingAfter: string | undefined;

  for (;;) {
    const page = await stripe.subscriptions.list({
      status: 'trialing',
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });

    for (const sub of page.data) {
      if (!sub.trial_end) continue;
      const trialEnd = new Date(sub.trial_end * 1000);
      const farmId = sub.metadata?.farmId;
      if (farmId) {
        map.set(farmId, trialEnd);
      } else if (sub.id) {
        subsMissingFarmId.push({ subId: sub.id, trialEnd });
      }
    }

    if (!page.has_more) break;
    startingAfter = page.data[page.data.length - 1]?.id;
  }

  if (subsMissingFarmId.length > 0) {
    const farms = await prisma.farm.findMany({
      where: {
        isDeleted: false,
        stripeSubscriptionId: { in: subsMissingFarmId.map((s) => s.subId) },
      },
      select: { id: true, stripeSubscriptionId: true },
    });
    const endBySubId = new Map(subsMissingFarmId.map((s) => [s.subId, s.trialEnd]));
    for (const farm of farms) {
      if (farm.stripeSubscriptionId) {
        const end = endBySubId.get(farm.stripeSubscriptionId);
        if (end) map.set(farm.id, end);
      }
    }
  }

  return map;
}

const PLAN_RANK: Record<FarmPlan, number> = {
  FREE: 0,
  GROWER: 1,
  ENTERPRISE: 2,
};

export type AdminPlanFilter = 'ALL' | 'TRIAL' | FarmPlan;

export type TrialInfo = {
  isOnTrial: boolean;
  trialEndsAt: string | null;
  daysLeft: number | null;
};

export type AdminUserFarm = {
  farmId: string;
  farmName: string;
  plan: FarmPlan;
  role: string;
  memberCount: number;
  pigCount: number;
  hasStripe: boolean;
  isDeleted: boolean;
  trial: TrialInfo;
};

export type AdminFarmRow = {
  farmId: string;
  farmName: string;
  plan: FarmPlan;
  country: string;
  pigCount: number;
  memberCount: number;
  hasStripe: boolean;
  createdAt: Date;
  owner: { id: string; name: string; email: string } | null;
  trial: TrialInfo;
};

export type SetFarmPlanResult = {
  id: string;
  name: string;
  previousPlan: FarmPlan;
  plan: FarmPlan;
  hadStripe: boolean;
  stripeCanceled: boolean;
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
  activeTrial: TrialInfo | null;
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

function mapUser(user: UserWithFarms, trialMap: Map<string, Date>): AdminUserRow {
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
      trial: trialForFarm(m.farm.id, trialMap),
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
    activeTrial: activeTrialForUser(farms),
    farms,
  };
}

function planFilterWhere(plan: AdminPlanFilter, trialFarmIds?: string[]): Prisma.UserWhereInput | undefined {
  if (plan === 'TRIAL') {
    if (!trialFarmIds?.length) {
      return { id: { in: [] } };
    }
    return {
      farmMemberships: {
        some: {
          role: Role.OWNER,
          farm: { id: { in: trialFarmIds }, isDeleted: false },
        },
      },
    };
  }
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
    const trialMap = await fetchActiveTrialsByFarmId();
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
      activeTrials: trialMap.size,
    };
  }

  static async listUsers(opts: {
    page: number;
    pageSize: number;
    plan?: AdminPlanFilter;
    search?: string;
  }) {
    const { page, pageSize, plan = 'ALL', search } = opts;
    const trialMap = await fetchActiveTrialsByFarmId();
    const trialFarmIds = plan === 'TRIAL' ? [...trialMap.keys()] : undefined;
    const where: Prisma.UserWhereInput = {
      ...planFilterWhere(plan, trialFarmIds),
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
      users: users.map((u) => mapUser(u, trialMap)),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  static async getUser(userId: string) {
    const trialMap = await fetchActiveTrialsByFarmId();
    const user = await prisma.user.findUnique({ where: { id: userId }, select: userSelect });
    if (!user) return null;
    return mapUser(user, trialMap);
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

  static async setFarmPlan(farmId: string, plan: FarmPlan): Promise<SetFarmPlanResult> {
    const farm = await prisma.farm.findUnique({
      where: { id: farmId },
      select: {
        id: true,
        name: true,
        plan: true,
        isDeleted: true,
        stripeSubscriptionId: true,
      },
    });
    if (!farm || farm.isDeleted) throw new AppError('Farm not found', 404);

    const previousPlan = farm.plan;
    if (previousPlan === plan) {
      return {
        id: farm.id,
        name: farm.name,
        previousPlan,
        plan,
        hadStripe: !!farm.stripeSubscriptionId,
        stripeCanceled: false,
      };
    }

    let stripeCanceled = false;
    const hadStripe = !!farm.stripeSubscriptionId;

    if (plan === FarmPlan.FREE && farm.stripeSubscriptionId) {
      const stripe = stripeClient();
      if (stripe) {
        try {
          await stripe.subscriptions.cancel(farm.stripeSubscriptionId);
          stripeCanceled = true;
        } catch (err) {
          console.error('[admin] Stripe subscription cancel failed:', err);
        }
      }
      await prisma.farm.update({
        where: { id: farmId },
        data: { plan, stripeSubscriptionId: null },
      });
    } else {
      await prisma.farm.update({
        where: { id: farmId },
        data: { plan },
      });
    }

    return {
      id: farm.id,
      name: farm.name,
      previousPlan,
      plan,
      hadStripe,
      stripeCanceled,
    };
  }

  static async listFarms(opts: {
    page: number;
    pageSize: number;
    plan?: AdminPlanFilter;
    search?: string;
  }) {
    const { page, pageSize, plan = 'ALL', search } = opts;
    const trialMap = await fetchActiveTrialsByFarmId();
    const trialFarmIds = plan === 'TRIAL' ? [...trialMap.keys()] : undefined;

    const where: Prisma.FarmWhereInput = {
      isDeleted: false,
      ...(plan === 'TRIAL'
        ? { id: { in: trialFarmIds?.length ? trialFarmIds : ['__none__'] } }
        : plan !== 'ALL'
          ? { plan }
          : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              {
                members: {
                  some: {
                    role: Role.OWNER,
                    user: {
                      OR: [
                        { email: { contains: search, mode: 'insensitive' } },
                        { name: { contains: search, mode: 'insensitive' } },
                      ],
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [total, farms] = await Promise.all([
      prisma.farm.count({ where }),
      prisma.farm.findMany({
        where,
        select: {
          id: true,
          name: true,
          plan: true,
          country: true,
          createdAt: true,
          stripeSubscriptionId: true,
          _count: { select: { members: true, pigs: true } },
          members: {
            where: { role: Role.OWNER },
            take: 1,
            select: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const rows: AdminFarmRow[] = farms.map((f) => ({
      farmId: f.id,
      farmName: f.name,
      plan: f.plan,
      country: f.country,
      pigCount: f._count.pigs,
      memberCount: f._count.members,
      hasStripe: !!f.stripeSubscriptionId,
      createdAt: f.createdAt,
      owner: f.members[0]?.user ?? null,
      trial: trialForFarm(f.id, trialMap),
    }));

    return {
      farms: rows,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
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
    const trialMap = await fetchActiveTrialsByFarmId();
    const trialFarmIds = plan === 'TRIAL' ? [...trialMap.keys()] : undefined;
    const where: Prisma.UserWhereInput = {
      ...planFilterWhere(plan, trialFarmIds),
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

    const rows = users.map((u) => mapUser(u, trialMap));
    const header = [
      'Email',
      'Name',
      'Phone',
      'Joined',
      'Highest Plan',
      'Paying',
      'On Trial',
      'Trial Days Left',
      'Trial Ends',
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
          .map((f) => `${f.farmName} (${f.role}/${f.plan}${f.hasStripe ? '/Stripe' : ''}${f.trial.isOnTrial ? '/Trial' : ''})`)
          .join('; ');
        return [
          csvEscape(u.email),
          csvEscape(u.name),
          csvEscape(u.phone),
          csvEscape(u.createdAt.toISOString()),
          csvEscape(u.highestOwnedPlan),
          csvEscape(u.isPaying ? 'yes' : 'no'),
          csvEscape(u.activeTrial?.isOnTrial ? 'yes' : 'no'),
          csvEscape(u.activeTrial?.daysLeft ?? ''),
          csvEscape(u.activeTrial?.trialEndsAt ?? ''),
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
