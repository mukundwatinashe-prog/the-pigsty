/**
 * Reason a farm can't be deleted yet, or null when it can. A farm still billed through
 * Stripe must have its subscription end first, or the owner keeps paying for a farm
 * they can no longer see.
 */
export function farmDeletionBlocker(farm: { plan: string; stripeSubscriptionId: string | null }): string | null {
  if (farm.plan !== 'FREE' && farm.stripeSubscriptionId) {
    return 'This farm has a paid subscription. Cancel it under Billing first — you can delete the farm once the subscription has ended.';
  }
  return null;
}
