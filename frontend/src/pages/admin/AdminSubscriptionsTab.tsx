import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import {
  adminService,
  type AdminFarm,
  type AdminPlanFilter,
  type FarmPlan,
} from '../../services/admin.service';
import { apiErrorMessage } from '../../services/api';
import { PlanSelect, planBadgeClass, planLabel, toastPlanChange } from './adminPlanHelpers';

const PLAN_FILTERS: { id: AdminPlanFilter; label: string }[] = [
  { id: 'ALL', label: 'All farms' },
  { id: 'FREE', label: 'Smallholder' },
  { id: 'GROWER', label: 'Grower' },
  { id: 'ENTERPRISE', label: 'Enterprise' },
];

export default function AdminSubscriptionsTab() {
  const qc = useQueryClient();
  const [planFilter, setPlanFilter] = useState<AdminPlanFilter>('ALL');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-farms', page, pageSize, planFilter, search],
    queryFn: () => adminService.listFarms({ page, pageSize, plan: planFilter, search: search || undefined }),
  });

  const setPlan = useMutation({
    mutationFn: ({ farmId, plan }: { farmId: string; plan: FarmPlan }) =>
      adminService.setFarmPlan(farmId, plan),
    onSuccess: (result) => {
      toastPlanChange(result);
      void qc.invalidateQueries({ queryKey: ['admin-farms'] });
      void qc.invalidateQueries({ queryKey: ['admin-users'] });
      void qc.invalidateQueries({ queryKey: ['admin-summary'] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const farms = data?.farms ?? [];

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Change any farm&apos;s subscription level. Stripe checkout still upgrades automatically; use this for manual overrides (comps, support, downgrades).
        Downgrading to Smallholder cancels an active Stripe subscription.
      </p>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {PLAN_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => { setPlanFilter(f.id); setPage(1); }}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                planFilter === f.id
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <form
          className="w-full sm:max-w-xs"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(searchInput.trim());
            setPage(1);
          }}
        >
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search farm or owner…"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
        </form>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2">Farm</th>
                <th className="px-4 py-2">Owner</th>
                <th className="px-4 py-2">Plan</th>
                <th className="px-4 py-2">Usage</th>
                <th className="px-4 py-2">Billing</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    <Loader2 className="mx-auto size-5 animate-spin" />
                  </td>
                </tr>
              )}
              {error && !isLoading && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-red-600">
                    {apiErrorMessage(error)}
                  </td>
                </tr>
              )}
              {!isLoading && !error && farms.map((farm: AdminFarm) => (
                <FarmRow
                  key={farm.farmId}
                  farm={farm}
                  planChanging={setPlan.isPending}
                  onPlanChange={(farmId, plan) => setPlan.mutate({ farmId, plan })}
                />
              ))}
              {!isLoading && !error && farms.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    No farms match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
            <p className="text-sm text-gray-500">
              Page {data.page} of {data.totalPages} · {data.total} farms
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-lg border border-gray-200 p-2 disabled:opacity-40"
                aria-label="Previous page"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-gray-200 p-2 disabled:opacity-40"
                aria-label="Next page"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FarmRow({
  farm,
  onPlanChange,
  planChanging,
}: {
  farm: AdminFarm;
  onPlanChange: (farmId: string, plan: FarmPlan) => void;
  planChanging: boolean;
}) {
  return (
    <tr className="hover:bg-gray-50/80">
      <td className="px-4 py-3">
        <p className="font-medium text-gray-900">{farm.farmName}</p>
        <p className="text-xs text-gray-500">{farm.country}</p>
      </td>
      <td className="px-4 py-3">
        {farm.owner ? (
          <>
            <p className="text-gray-900">{farm.owner.name}</p>
            <p className="text-xs text-gray-500">{farm.owner.email}</p>
          </>
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        <PlanSelect
          value={farm.plan}
          disabled={planChanging}
          onChange={(plan) => {
            if (plan !== farm.plan) onPlanChange(farm.farmId, plan);
          }}
        />
      </td>
      <td className="px-4 py-3 text-gray-600">
        {farm.pigCount} pigs · {farm.memberCount} members
      </td>
      <td className="px-4 py-3">
        {farm.hasStripe ? (
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
            Stripe
          </span>
        ) : (
          <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${planBadgeClass(farm.plan)}`}>
            {planLabel(farm.plan)}
          </span>
        )}
      </td>
    </tr>
  );
}
