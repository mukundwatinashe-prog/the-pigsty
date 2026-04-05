import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ScrollText, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useFarm } from '../../context/FarmContext';
import { reportService } from '../../services/report.service';
import type { AuditLog } from '../../types';

type ActivityResponse = {
  data: AuditLog[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export default function AuditLogPage() {
  const { currentFarm } = useFarm();
  const farmId = currentFarm?.id;
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['audit-log', farmId, page, pageSize],
    queryFn: async () => {
      const res = await reportService.activityLog(farmId!, 'json', {
        page: String(page),
        pageSize: String(pageSize),
      });
      return res as ActivityResponse;
    },
    enabled: !!farmId,
    retry: 1,
  });

  if (!farmId) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center">
        <ScrollText className="mx-auto mb-4 size-12 text-gray-300" />
        <h1 className="text-lg font-semibold text-gray-800">Audit log</h1>
        <p className="mt-2 text-gray-600">Select a farm to view the audit log.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Audit log</h1>
        <p className="mt-1 text-sm text-gray-600">
          Who did what on {currentFarm?.name} — immutable activity history
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/80">
                <th className="px-4 py-3 font-semibold text-gray-700">Date</th>
                <th className="px-4 py-3 font-semibold text-gray-700">User</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Action</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Entity</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Details</th>
              </tr>
            </thead>
            <tbody>
              {isError ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <p className="text-sm text-red-600">
                      {error instanceof Error ? error.message : 'Failed to load audit log.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => refetch()}
                      className="mt-3 text-sm font-medium text-primary-600 hover:underline"
                    >
                      Try again
                    </button>
                  </td>
                </tr>
              ) : isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-16 text-center text-gray-500">
                    <Loader2 className="mx-auto mb-2 size-8 animate-spin text-primary-500" />
                    Loading audit entries…
                  </td>
                </tr>
              ) : !data?.data?.length ? (
                <tr>
                  <td colSpan={5} className="px-4 py-16 text-center text-gray-500">
                    No audit entries yet.
                  </td>
                </tr>
              ) : (
                data.data.map((row) => (
                  <tr key={row.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                    <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                      {new Date(row.createdAt).toLocaleString(undefined, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {row.user?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800">
                        {row.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-800">
                      <span className="font-medium">{row.entity}</span>
                      <span className="ml-2 font-mono text-xs text-gray-400">{row.entityId.slice(0, 8)}…</span>
                    </td>
                    <td className="max-w-md px-4 py-3 text-gray-600">
                      <span className="line-clamp-2" title={row.details ?? undefined}>
                        {row.details ?? '—'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {data && data.totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-4 py-3 text-sm text-gray-600">
            <span>
              Page {data.page} of {data.totalPages} · {data.total} entries
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 font-medium hover:bg-gray-50 disabled:opacity-40"
              >
                <ChevronLeft className="size-4" />
                Previous
              </button>
              <button
                type="button"
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 font-medium hover:bg-gray-50 disabled:opacity-40"
              >
                Next
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
