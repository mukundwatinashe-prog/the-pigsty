import { FarmPlan } from '@prisma/client';

export const FREE_TIER_MAX_PIGS = 50;
export const GROWER_TIER_MAX_PIGS = 500;
export const GROWER_TIER_MAX_MEMBERS = 5;
export const GROWER_TRIAL_DAYS = 7;

export function pigLimitForPlan(plan: FarmPlan): number | null {
  if (plan === FarmPlan.FREE) return FREE_TIER_MAX_PIGS;
  if (plan === FarmPlan.GROWER) return GROWER_TIER_MAX_PIGS;
  return null;
}

export function wouldExceedFreeTier(currentCount: number, toAdd: number, plan: FarmPlan): boolean {
  const limit = pigLimitForPlan(plan);
  if (limit == null) return false;
  return currentCount + toAdd > limit;
}

export function allowsReports(plan: FarmPlan): boolean {
  return plan !== FarmPlan.FREE;
}

export function allowsMassImport(plan: FarmPlan): boolean {
  return plan !== FarmPlan.FREE;
}

export function allowsMultiUser(plan: FarmPlan): boolean {
  return plan !== FarmPlan.FREE;
}

export function memberLimitForPlan(plan: FarmPlan): number {
  if (plan === FarmPlan.GROWER) return GROWER_TIER_MAX_MEMBERS;
  if (plan === FarmPlan.ENTERPRISE) return Number.MAX_SAFE_INTEGER;
  return 1;
}

/** PDF/Excel financial exports — Enterprise only (Grower keeps on-screen summary). */
export function allowsFinancialsExport(plan: FarmPlan): boolean {
  return plan === FarmPlan.ENTERPRISE;
}

/** Scheduled report emails and SMS farm alerts — Enterprise only. */
export function allowsEnterpriseAutomation(plan: FarmPlan): boolean {
  return plan === FarmPlan.ENTERPRISE;
}
