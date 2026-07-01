import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { sitePricing } from '../lib/siteConfig';
import { isNativeApp } from '../lib/native';

type Props = {
  title?: string;
  message?: string;
  className?: string;
};

export function PlanUpgradeBanner({
  title = 'Upgrade to unlock this feature',
  message = `Start a ${sitePricing.growerTrialDays}-day Grower trial, subscribe to Grower (${sitePricing.growerMonthly}/mo), or Enterprise (${sitePricing.enterpriseMonthly}/mo) from Billing.`,
  className = '',
}: Props) {
  // Subscriptions are web-only in the native app (Apple/Google IAP rules), so we
  // don't advertise pricing or link to checkout there.
  if (isNativeApp()) {
    return (
      <div className={`rounded-2xl border border-primary-200 bg-primary-50/90 p-5 ${className}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <Sparkles className="size-6 shrink-0 text-primary-600" aria-hidden />
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-gray-900">{title}</h2>
            <p className="mt-1 text-sm text-gray-700">
              This feature is available on a paid plan. Manage your subscription by signing in at
              the-pigsty.org from a web browser.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border border-primary-200 bg-primary-50/90 p-5 ${className}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <Sparkles className="size-6 shrink-0 text-primary-600" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-gray-900">{title}</h2>
          <p className="mt-1 text-sm text-gray-700">{message}</p>
          <Link
            to="/billing"
            className="mt-3 inline-flex min-h-[44px] items-center rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700"
          >
            View plans &amp; upgrade
          </Link>
        </div>
      </div>
    </div>
  );
}
