import toast from 'react-hot-toast';
import type { AdminUser, FarmPlan, SetFarmPlanResult, TrialInfo } from '../../services/admin.service';

const PLAN_RANK: Record<FarmPlan, number> = { FREE: 0, GROWER: 1, ENTERPRISE: 2 };

export function formatTrialRemaining(trial: TrialInfo | null | undefined): string | null {
  if (!trial?.isOnTrial || trial.daysLeft == null) return null;
  if (trial.daysLeft <= 0) return 'Ends today';
  if (trial.daysLeft === 1) return '1 day left';
  return `${trial.daysLeft} days left`;
}

export function TrialBadge({ trial }: { trial: TrialInfo | null | undefined }) {
  const label = formatTrialRemaining(trial);
  if (!label) return null;
  const ends = trial?.trialEndsAt ? new Date(trial.trialEndsAt).toLocaleDateString() : null;
  return (
    <span
      className="inline-flex flex-col rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900"
      title={ends ? `Trial ends ${ends}` : undefined}
    >
      <span>Grower trial</span>
      <span className="font-semibold">{label}</span>
    </span>
  );
}

export function planLabel(plan: FarmPlan): string {
  if (plan === 'FREE') return 'Smallholder';
  if (plan === 'GROWER') return 'Grower';
  return 'Enterprise';
}

export function planBadgeClass(plan: FarmPlan): string {
  if (plan === 'ENTERPRISE') return 'bg-purple-100 text-purple-800 border-purple-200';
  if (plan === 'GROWER') return 'bg-blue-100 text-blue-800 border-blue-200';
  return 'bg-gray-100 text-gray-700 border-gray-200';
}

export function primaryOwnedFarm(user: AdminUser) {
  const owned = user.farms.filter((f) => f.role === 'OWNER');
  if (owned.length === 0) return null;
  return owned.reduce((best, f) => (PLAN_RANK[f.plan] > PLAN_RANK[best.plan] ? f : best));
}

export function toastPlanChange(result: SetFarmPlanResult) {
  const from = planLabel(result.previousPlan);
  const to = planLabel(result.plan);
  if (result.previousPlan === result.plan) {
    toast.success('Plan unchanged');
    return;
  }
  let msg = `${result.name}: ${from} → ${to}`;
  if (result.stripeCanceled) msg += ' · Stripe canceled';
  else if (result.hadStripe) msg += ' · Stripe billing still active';
  toast.success(msg);
}

type PlanSelectProps = {
  value: FarmPlan;
  onChange: (plan: FarmPlan) => void;
  disabled?: boolean;
  className?: string;
};

export function PlanSelect({ value, onChange, disabled, className = '' }: PlanSelectProps) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as FarmPlan)}
      className={`rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm ${className}`}
      aria-label="Subscription plan"
    >
      <option value="FREE">Smallholder</option>
      <option value="GROWER">Grower</option>
      <option value="ENTERPRISE">Enterprise</option>
    </select>
  );
}
