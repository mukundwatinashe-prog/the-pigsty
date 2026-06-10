import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { securityService } from '../services/security.service';

export function SecurityThreatBanner() {
  const qc = useQueryClient();
  const { data, isError } = useQuery({
    queryKey: ['security-summary'],
    queryFn: () => securityService.getSummary(),
    refetchInterval: 60_000,
    retry: false,
  });

  const ackAll = useMutation({
    mutationFn: () => securityService.acknowledgeAll(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['security-summary'] });
      toast.success('Threats acknowledged');
    },
  });

  if (isError || !data) return null;

  const total = data.unacknowledgedCritical + data.unacknowledgedHigh;
  if (total === 0) return null;

  const critical = data.unacknowledgedCritical > 0;

  return (
    <div
      className={`relative border-b px-4 py-3 ${
        critical
          ? 'border-red-300 bg-red-50 text-red-900'
          : 'border-amber-300 bg-amber-50 text-amber-900'
      }`}
      role="alert"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          {critical ? (
            <ShieldAlert className="mt-0.5 size-5 shrink-0 text-red-600" aria-hidden />
          ) : (
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" aria-hidden />
          )}
          <div className="min-w-0 text-sm">
            <p className="font-semibold">
              {critical ? 'Critical security threat detected' : 'Security warnings need review'}
            </p>
            <p className="mt-0.5 opacity-90">
              {data.unacknowledgedCritical > 0 && `${data.unacknowledgedCritical} critical`}
              {data.unacknowledgedCritical > 0 && data.unacknowledgedHigh > 0 && ', '}
              {data.unacknowledgedHigh > 0 && `${data.unacknowledgedHigh} high`}
              {' · '}
              {data.recent24h} events in 24h
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            to="/security"
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              critical ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-amber-600 text-white hover:bg-amber-700'
            }`}
          >
            Review threats
          </Link>
          <button
            type="button"
            onClick={() => ackAll.mutate()}
            disabled={ackAll.isPending}
            className="rounded-lg border border-current/30 px-3 py-1.5 text-sm font-medium hover:bg-black/5"
          >
            Dismiss all
          </button>
        </div>
      </div>
    </div>
  );
}
