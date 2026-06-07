import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';

type Props = {
  title?: string;
  message?: string;
  className?: string;
};

export function PlanUpgradeBanner({
  title = 'Upgrade to unlock this feature',
  message = 'Grower and Enterprise plans include full reports, financials, bulk Excel import, and team members.',
  className = '',
}: Props) {
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
