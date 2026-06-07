/** True when the API rejected a request because the farm is on the Free plan. */
export function isPlanUpgradeError(err: unknown): boolean {
  const e = err as { response?: { status?: number } };
  return e.response?.status === 402;
}

export function planUpgradeMessage(err: unknown, fallback = 'Upgrade to Grower or Enterprise to unlock this feature.'): string {
  const e = err as { response?: { data?: { message?: string } } };
  const serverMsg = e.response?.data?.message;
  if (typeof serverMsg === 'string' && serverMsg.trim()) return serverMsg;
  return fallback;
}

/** Reports gated behind Grower/Enterprise (activity log audit export stays on Free). */
export const PAID_REPORT_IDS = new Set(['herd_inventory', 'weight_gain', 'sales', 'daily_summary']);
