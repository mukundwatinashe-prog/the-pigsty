import { FarmPlan } from '@prisma/client';

export const FREE_TIER_MAX_PIGS = 50;

export function pigLimitForPlan(plan: FarmPlan): number | null {
  return plan === FarmPlan.FREE ? FREE_TIER_MAX_PIGS : null;
}

export function wouldExceedFreeTier(currentCount: number, toAdd: number, plan: FarmPlan): boolean {
  if (plan !== FarmPlan.FREE) return false;
  return currentCount + toAdd > FREE_TIER_MAX_PIGS;
}
