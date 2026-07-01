import { describe, it, expect } from 'vitest';
import { FarmPlan } from '@prisma/client';
import {
  pigLimitForPlan,
  wouldExceedFreeTier,
  allowsReports,
  allowsMassImport,
  allowsMultiUser,
  memberLimitForPlan,
  allowsFinancialsExport,
  allowsEnterpriseAutomation,
  FREE_TIER_MAX_PIGS,
  GROWER_TIER_MAX_PIGS,
  GROWER_TIER_MAX_MEMBERS,
} from './planLimits';

describe('pigLimitForPlan', () => {
  it('caps FREE and GROWER, uncaps ENTERPRISE', () => {
    expect(pigLimitForPlan(FarmPlan.FREE)).toBe(FREE_TIER_MAX_PIGS);
    expect(pigLimitForPlan(FarmPlan.GROWER)).toBe(GROWER_TIER_MAX_PIGS);
    expect(pigLimitForPlan(FarmPlan.ENTERPRISE)).toBeNull();
  });
});

describe('wouldExceedFreeTier', () => {
  it('blocks additions that cross the FREE cap', () => {
    expect(wouldExceedFreeTier(FREE_TIER_MAX_PIGS, 1, FarmPlan.FREE)).toBe(true);
    expect(wouldExceedFreeTier(FREE_TIER_MAX_PIGS - 1, 1, FarmPlan.FREE)).toBe(false);
  });

  it('never blocks uncapped (ENTERPRISE) plans', () => {
    expect(wouldExceedFreeTier(1_000_000, 1_000_000, FarmPlan.ENTERPRISE)).toBe(false);
  });
});

describe('feature gates', () => {
  it('gates reports/import/multi-user behind paid plans', () => {
    for (const gate of [allowsReports, allowsMassImport, allowsMultiUser]) {
      expect(gate(FarmPlan.FREE)).toBe(false);
      expect(gate(FarmPlan.GROWER)).toBe(true);
      expect(gate(FarmPlan.ENTERPRISE)).toBe(true);
    }
  });

  it('gates financial exports and automation to ENTERPRISE only', () => {
    for (const gate of [allowsFinancialsExport, allowsEnterpriseAutomation]) {
      expect(gate(FarmPlan.FREE)).toBe(false);
      expect(gate(FarmPlan.GROWER)).toBe(false);
      expect(gate(FarmPlan.ENTERPRISE)).toBe(true);
    }
  });
});

describe('memberLimitForPlan', () => {
  it('allows 1 on FREE, a fixed cap on GROWER, and effectively unlimited on ENTERPRISE', () => {
    expect(memberLimitForPlan(FarmPlan.FREE)).toBe(1);
    expect(memberLimitForPlan(FarmPlan.GROWER)).toBe(GROWER_TIER_MAX_MEMBERS);
    expect(memberLimitForPlan(FarmPlan.ENTERPRISE)).toBe(Number.MAX_SAFE_INTEGER);
  });
});
