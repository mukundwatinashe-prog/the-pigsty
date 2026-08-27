/**
 * Which unsubscribe affordance the billing page should show.
 *
 * A farm on a paid plan must never reach a state where the page offers no route
 * out of the subscription, so every paid combination resolves to one of the
 * actionable values below — `NONE` is reachable only on the Free plan.
 */
export type CancelAffordance =
  /** Real cancel button: there is a Stripe subscription the API can cancel. */
  | 'CANCEL_IN_APP'
  /** Cancellation already scheduled; the page offers "keep my subscription" instead. */
  | 'PENDING_CANCELLATION'
  /** Paid plan with no cancellable Stripe subscription — route the owner to support. */
  | 'REQUEST_VIA_SUPPORT'
  /** Caller lacks farm:settings; point them at an owner/manager. */
  | 'ASK_FARM_MANAGER'
  /** Free plan: nothing to cancel. */
  | 'NONE';

export interface CancelAffordanceInput {
  plan: string;
  myRole: string;
  stripeConfigured: boolean;
  hasSubscription?: boolean;
  cancelAtPeriodEnd?: boolean;
}

/** OWNER and FARM_MANAGER hold `farm:settings`, which the cancel endpoint requires. */
export function canManageSubscription(role: string): boolean {
  return role === 'OWNER' || role === 'FARM_MANAGER';
}

export function cancelAffordance(summary: CancelAffordanceInput): CancelAffordance {
  const isPaid = summary.plan === 'GROWER' || summary.plan === 'ENTERPRISE';
  if (!isPaid) return 'NONE';
  if (!canManageSubscription(summary.myRole)) return 'ASK_FARM_MANAGER';
  if (summary.cancelAtPeriodEnd) return 'PENDING_CANCELLATION';
  // No Stripe subscription id means the cancel endpoint would 400/503: plan granted
  // manually, Stripe unconfigured on this server, or the checkout webhook never landed.
  if (!summary.stripeConfigured || !summary.hasSubscription) return 'REQUEST_VIA_SUPPORT';
  return 'CANCEL_IN_APP';
}
