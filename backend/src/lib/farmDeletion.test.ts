import { describe, it, expect } from 'vitest';
import { farmDeletionBlocker } from './farmDeletion';

describe('farmDeletionBlocker', () => {
  it('allows deleting free farms and paid farms without a Stripe subscription', () => {
    expect(farmDeletionBlocker({ plan: 'FREE', stripeSubscriptionId: null })).toBeNull();
    expect(farmDeletionBlocker({ plan: 'ENTERPRISE', stripeSubscriptionId: null })).toBeNull();
  });

  it('blocks farms still billed through Stripe', () => {
    expect(farmDeletionBlocker({ plan: 'GROWER', stripeSubscriptionId: 'sub_123' })).toMatch(/Cancel it under Billing/);
  });
});
