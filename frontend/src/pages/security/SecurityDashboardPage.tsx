import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import { securityService } from '../../services/security.service';
import { apiErrorMessage } from '../../services/api';

function severityClass(severity: string): string {
  if (severity === 'CRITICAL') return 'bg-red-100 text-red-800 border-red-200';
  if (severity === 'HIGH') return 'bg-orange-100 text-orange-800 border-orange-200';
  if (severity === 'MEDIUM') return 'bg-amber-100 text-amber-800 border-amber-200';
  return 'bg-gray-100 text-gray-700 border-gray-200';
}

export default function SecurityDashboardPage() {
  const qc = useQueryClient();
  const { data: summary, isLoading, error } = useQuery({
    queryKey: ['security-summary'],
    queryFn: () => securityService.getSummary(),
    retry: false,
  });
  const { data: events = [] } = useQuery({
    queryKey: ['security-events'],
    queryFn: () => securityService.listEvents(100),
    enabled: !!summary,
  });

  const ack = useMutation({
    mutationFn: (id: string) => securityService.acknowledge(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['security-summary'] });
      void qc.invalidateQueries({ queryKey: ['security-events'] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-gray-500">Loading security dashboard…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <AlertTriangle className="mx-auto size-8 text-red-600" />
        <p className="mt-2 font-medium text-red-900">Access denied</p>
        <p className="mt-1 text-sm text-red-700">
          {apiErrorMessage(error, 'Only platform admins can view this page.')}
        </p>
      </div>
    );
  }

  const threatCount = (summary?.unacknowledgedCritical ?? 0) + (summary?.unacknowledgedHigh ?? 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <Shield className="size-7 text-primary-600" />
          Security dashboard
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Monitor hacking attempts, brute-force activity, and suspicious behaviour across The Pigsty.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className={`rounded-xl border p-4 ${threatCount > 0 ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Active threats</p>
          <p className={`mt-1 text-3xl font-bold ${threatCount > 0 ? 'text-red-700' : 'text-green-700'}`}>
            {threatCount}
          </p>
          <p className="mt-1 text-xs text-gray-600">
            {summary?.unacknowledgedCritical ?? 0} critical · {summary?.unacknowledgedHigh ?? 0} high
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Events (24h)</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{summary?.recent24h ?? 0}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Status</p>
          <p className="mt-1 flex items-center gap-2 text-lg font-semibold text-gray-900">
            {threatCount === 0 ? (
              <>
                <CheckCircle2 className="size-5 text-green-600" />
                All clear
              </>
            ) : (
              <>
                <AlertTriangle className="size-5 text-amber-600" />
                Review needed
              </>
            )}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-4 py-3">
          <h2 className="font-semibold text-gray-900">Recent security events</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2">Time</th>
                <th className="px-4 py-2">Severity</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Details</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {events.map((ev) => (
                <tr key={ev.id} className={ev.acknowledged ? 'opacity-60' : ''}>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                    {new Date(ev.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${severityClass(ev.severity)}`}>
                      {ev.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{ev.type}</td>
                  <td className="max-w-md px-4 py-3 text-gray-700">
                    {[ev.email, ev.ip, ev.details].filter(Boolean).join(' · ') || '—'}
                  </td>
                  <td className="px-4 py-3">
                    {!ev.acknowledged && (
                      <button
                        type="button"
                        onClick={() => {
                          ack.mutate(ev.id, {
                            onSuccess: () => toast.success('Acknowledged'),
                            onError: (e) => toast.error(apiErrorMessage(e)),
                          });
                        }}
                        className="text-xs font-medium text-primary-600 hover:text-primary-700"
                      >
                        Acknowledge
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    No security events recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
