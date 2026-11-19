import { describe, it, expect } from 'vitest';
import { cancelAffordance, canManageSubscription } from './billingActions';

const PLANS = ['FREE', 'GROWER', 'ENTERPRISE'];
const ROLES = ['OWNER', 'FARM_MANAGER', 'WORKER'];
const BOOLS = [true, false];

describe('cancelAffordance', () => {
  it('never leaves a paid farm without an unsubscribe route', () => {
    for (const plan of PLANS.filter(p => p !== 'FREE')) {
      for (const myRole of ROLES) {
        for (const stripeConfigured of BOOLS) {
          for (const hasSubscription of BOOLS) {
            for (const cancelAtPeriodEnd of BOOLS) {
              const result = cancelAffordance({
                plan, myRole, stripeConfigured, hasSubscription, cancelAtPeriodEnd,
              });
              expect(result, JSON.stringify({ plan, myRole, stripeConfigured, hasSubscription, cancelAtPeriodEnd })).not.toBe('NONE');
            }
          }
        }
      }
    }
  });

  it('offers the in-app cancel button to managers with a live Stripe subscription', () => {
    expect(
      cancelAffordance({ plan: 'GROWER', myRole: 'OWNER', stripeConfigured: true, hasSubscription: true }),
    ).toBe('CANCEL_IN_APP');
    expect(
      cancelAffordance({ plan: 'ENTERPRISE', myRole: 'FARM_MANAGER', stripeConfigured: true, hasSubscription: true }),
    ).toBe('CANCEL_IN_APP');
  });

  it('falls back to support when there is no cancellable Stripe subscription', () => {
    expect(
      cancelAffordance({ plan: 'GROWER', myRole: 'OWNER', stripeConfigured: false, hasSubscription: false }),
    ).toBe('REQUEST_VIA_SUPPORT');
    expect(
      cancelAffordance({ plan: 'GROWER', myRole: 'OWNER', stripeConfigured: true, hasSubscription: false }),
    ).toBe('REQUEST_VIA_SUPPORT');
  });

  it('shows the resume path once cancellation is already scheduled', () => {
    expect(
      cancelAffordance({ plan: 'GROWER', myRole: 'OWNER', stripeConfigured: true, hasSubscription: true, cancelAtPeriodEnd: true }),
    ).toBe('PENDING_CANCELLATION');
  });

  it('points workers at an owner or manager', () => {
    expect(
      cancelAffordance({ plan: 'GROWER', myRole: 'WORKER', stripeConfigured: true, hasSubscription: true }),
    ).toBe('ASK_FARM_MANAGER');
  });

  it('has nothing to cancel on the free plan', () => {
    expect(cancelAffordance({ plan: 'FREE', myRole: 'OWNER', stripeConfigured: true })).toBe('NONE');
  });
});

describe('canManageSubscription', () => {
  it('matches the roles holding farm:settings', () => {
    expect(canManageSubscription('OWNER')).toBe(true);
    expect(canManageSubscription('FARM_MANAGER')).toBe(true);
    expect(canManageSubscription('WORKER')).toBe(false);
  });
});
