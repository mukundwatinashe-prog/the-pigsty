import { useMemo, useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Upload,
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Pencil,
  Trash2,
  PiggyBank,
  Loader2,
  DollarSign,
  X,
  Stethoscope,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useFarm } from '../../context/FarmContext';
import { pigService, type RecordSalePayload } from '../../services/pig.service';
import { farmService } from '../../services/farm.service';
import type { Pig, PigBreed, PigObservationCategory, PigStage, PigStatus, HealthStatus, SaleType } from '../../types';
import { PIG_OBSERVATION_OPTIONS } from '../../lib/pigObservations';

const BREED_OPTIONS: { value: PigBreed; label: string }[] = [
  { value: 'LARGE_WHITE', label: 'Large White' },
  { value: 'LANDRACE', label: 'Landrace' },
  { value: 'DUROC', label: 'Duroc' },
  { value: 'PIETRAIN', label: 'Pietrain' },
  { value: 'BERKSHIRE', label: 'Berkshire' },
  { value: 'HAMPSHIRE', label: 'Hampshire' },
  { value: 'CHESTER_WHITE', label: 'Chester White' },
  { value: 'YORKSHIRE', label: 'Yorkshire' },
  { value: 'TAMWORTH', label: 'Tamworth' },
  { value: 'MUKOTA', label: 'Mukota' },
  { value: 'KOLBROEK', label: 'Kolbroek' },
  { value: 'WINDSNYER', label: 'Windsnyer' },
  { value: 'SA_LANDRACE', label: 'SA Landrace' },
  { value: 'INDIGENOUS', label: 'Indigenous' },
  { value: 'CROSSBREED', label: 'Crossbreed' },
  { value: 'OTHER', label: 'Other' },
];

const STAGE_OPTIONS: { value: PigStage; label: string }[] = [
  { value: 'BOAR', label: 'Boar' },
  { value: 'SOW', label: 'Sow' },
  { value: 'GILT', label: 'Gilt' },
  { value: 'WEANER', label: 'Weaner' },
  { value: 'PIGLET', label: 'Piglet' },
  { value: 'PORKER', label: 'Porker' },
  { value: 'GROWER', label: 'Grower' },
  { value: 'FINISHER', label: 'Finisher' },
];

const STATUS_OPTIONS: { value: PigStatus; label: string }[] = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'SOLD', label: 'Sold' },
  { value: 'DECEASED', label: 'Deceased' },
  { value: 'QUARANTINE', label: 'Quarantine' },
];

const HEALTH_OPTIONS: { value: HealthStatus; label: string }[] = [
  { value: 'HEALTHY', label: 'Healthy' },
  { value: 'SICK', label: 'Sick' },
  { value: 'UNDER_TREATMENT', label: 'Under treatment' },
  { value: 'RECOVERED', label: 'Recovered' },
];

function breedLabel(breed: PigBreed) {
  return BREED_OPTIONS.find((b) => b.value === breed)?.label ?? breed;
}

function stageLabel(stage: PigStage) {
  return STAGE_OPTIONS.find((s) => s.value === stage)?.label ?? stage;
}

function statusBadgeClass(status: PigStatus) {
  switch (status) {
    case 'ACTIVE':
      return 'bg-emerald-100 text-emerald-800 ring-emerald-600/20';
    case 'SOLD':
      return 'bg-primary-100 text-primary-800 ring-primary-600/20';
    case 'DECEASED':
      return 'bg-gray-100 text-gray-700 ring-gray-500/15';
    case 'QUARANTINE':
      return 'bg-red-100 text-red-800 ring-red-600/20';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

function healthBadgeClass(health: HealthStatus) {
  switch (health) {
    case 'HEALTHY':
      return 'bg-emerald-50 text-emerald-800 ring-emerald-600/15';
    case 'SICK':
      return 'bg-red-100 text-red-800 ring-red-600/20';
    case 'UNDER_TREATMENT':
      return 'bg-amber-100 text-amber-900 ring-amber-600/20';
    case 'RECOVERED':
      return 'bg-primary-100 text-primary-800 ring-primary-600/20';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

const PAGE_SIZE = 25;

type PigSortKey = 'tagNumber' | 'breed' | 'stage' | 'currentWeight' | 'status' | 'healthStatus' | 'penName' | 'createdAt';

const DEFAULT_SORT_ORDER: Record<PigSortKey, 'asc' | 'desc'> = {
  tagNumber: 'asc',
  breed: 'asc',
  stage: 'asc',
  currentWeight: 'desc',
  status: 'asc',
  healthStatus: 'asc',
  penName: 'asc',
  createdAt: 'desc',
};

function statusFromParams(searchParams: URLSearchParams): string {
  const raw = searchParams.get('status');
  return raw && STATUS_OPTIONS.some((o) => o.value === raw) ? raw : '';
}

function SortableTh({
  label,
  sortKey,
  activeSort,
  sortOrder,
  onSort,
}: {
  label: string;
  sortKey: PigSortKey;
  activeSort: PigSortKey;
  sortOrder: 'asc' | 'desc';
  onSort: (k: PigSortKey) => void;
}) {
  const active = activeSort === sortKey;
  return (
    <th scope="col" className="px-4 py-3 whitespace-nowrap">
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1.5 font-semibold text-gray-600 hover:text-gray-900 transition-colors"
        aria-label={
          active
            ? `${label}, sorted ${sortOrder === 'asc' ? 'ascending' : 'descending'}. Click to reverse.`
            : `Sort by ${label}`
        }
      >
        {label}
        {active ? (
          sortOrder === 'asc' ? (
            <ArrowUp className="w-3.5 h-3.5 shrink-0 text-primary-600" aria-hidden />
          ) : (
            <ArrowDown className="w-3.5 h-3.5 shrink-0 text-primary-600" aria-hidden />
          )
        ) : (
          <ArrowUpDown className="w-3.5 h-3.5 shrink-0 text-gray-300" aria-hidden />
        )}
      </button>
    </th>
  );
}

export default function PigListPage() {
  const { currentFarm } = useFarm();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const weightUnit = currentFarm?.weightUnit ?? 'kg';

  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [breedFilter, setBreedFilter] = useState<string>('');
  const [stageFilter, setStageFilter] = useState<string>('');
  /** '' = on-hand only (API inStockOnly); '__ALL__' = every status; else specific PigStatus. */
  const [statusFilter, setStatusFilter] = useState<string>(() => statusFromParams(searchParams));
  const [healthFilter, setHealthFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<PigSortKey>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<Pig | null>(null);
  const [observationTarget, setObservationTarget] = useState<Pig | null>(null);
  const [observationForm, setObservationForm] = useState<{
    category: PigObservationCategory;
    notes: string;
  }>({ category: 'GENERAL_WELLBEING', notes: '' });

  const [saleTarget, setSaleTarget] = useState<Pig | null>(null);
  const [saleForm, setSaleForm] = useState({
    saleType: 'LIVE_SALE' as SaleType,
    saleDate: new Date().toISOString().slice(0, 10),
    weightAtSale: '',
    buyer: '',
    notes: '',
  });

  const { data: farmDetail } = useQuery({
    queryKey: ['farm', currentFarm?.id],
    queryFn: () => farmService.getById(currentFarm!.id),
    enabled: !!currentFarm?.id,
  });
  const pricePerKg = Number(farmDetail?.farm?.pricePerKg) || 0;
  const currency = currentFarm?.currency ?? 'USD';
  const saleWeight = parseFloat(saleForm.weightAtSale) || 0;
  const calculatedPrice = parseFloat((saleWeight * pricePerKg).toFixed(2));

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const isFirstDebounced = useRef(true);
  useEffect(() => {
    if (isFirstDebounced.current) {
      isFirstDebounced.current = false;
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset pagination when debounced search term changes
    setPage(1);
  }, [debouncedSearch]);

  const listParams = useMemo(() => {
    const p: Record<string, string> = {
      page: String(page),
      pageSize: String(PAGE_SIZE),
    };
    if (debouncedSearch) p.search = debouncedSearch;
    if (breedFilter) p.breed = breedFilter;
    if (stageFilter) p.stage = stageFilter;
    if (statusFilter === '__ALL__') {
      /* no status / inStockOnly — full ledger */
    } else if (statusFilter === '') {
      p.inStockOnly = '1';
    } else {
      p.status = statusFilter;
    }
    if (healthFilter) p.healthStatus = healthFilter;
    p.sortBy = sortBy;
    p.sortOrder = sortOrder;
    return p;
  }, [page, debouncedSearch, breedFilter, stageFilter, statusFilter, healthFilter, sortBy, sortOrder]);

  const handleColumnSort = (key: PigSortKey) => {
    setPage(1);
    if (sortBy === key) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortOrder(DEFAULT_SORT_ORDER[key]);
    }
  };

  const {
    data,
    isLoading,
    isError,
    error,
    isFetching,
  } = useQuery({
    queryKey: ['pigs', currentFarm?.id, listParams],
    queryFn: () => pigService.list(currentFarm!.id, listParams),
    enabled: !!currentFarm?.id,
  });

  const deleteMutation = useMutation({
    mutationFn: ({ farmId, pigId }: { farmId: string; pigId: string }) =>
      pigService.delete(farmId, pigId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pigs'] });
      toast.success('Pig removed from inventory');
      setDeleteTarget(null);
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error(msg || 'Could not delete pig');
    },
  });

  const observationMutation = useMutation({
    mutationFn: (vars: {
      farmId: string;
      pigId: string;
      payload: { category: PigObservationCategory; notes: string | null };
    }) => pigService.addObservation(vars.farmId, vars.pigId, vars.payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pigs'] });
      queryClient.invalidateQueries({ queryKey: ['farm-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['farm'] });
      toast.success('Observation saved');
      setObservationTarget(null);
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error(msg || 'Could not save observation');
    },
  });

  const saleMutation = useMutation({
    mutationFn: (vars: { farmId: string; pigId: string; payload: RecordSalePayload }) =>
      pigService.recordSale(vars.farmId, vars.pigId, vars.payload),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['pigs'] });
      queryClient.invalidateQueries({ queryKey: ['farm-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['serviced-sows'] });
      toast.success(`${saleForm.saleType === 'SLAUGHTER' ? 'Slaughter' : 'Sale'} recorded — ${currency} ${Number(result.totalPrice).toFixed(2)}`);
      setSaleTarget(null);
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error(msg || 'Could not record sale');
    },
  });

  const openObservationModal = (pig: Pig) => {
    setObservationTarget(pig);
    setObservationForm({ category: 'GENERAL_WELLBEING', notes: '' });
  };

  const submitObservation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentFarm || !observationTarget) return;
    const notesTrim = observationForm.notes.trim();
    observationMutation.mutate({
      farmId: currentFarm.id,
      pigId: observationTarget.id,
      payload: {
        category: observationForm.category,
        notes: notesTrim.length ? notesTrim : null,
      },
    });
  };

  const openSaleModal = (pig: Pig) => {
    setSaleTarget(pig);
    setSaleForm({
      saleType: 'LIVE_SALE',
      saleDate: new Date().toISOString().slice(0, 10),
      weightAtSale: pig.currentWeight != null ? String(pig.currentWeight) : '',
      buyer: '',
      notes: '',
    });
  };

  const submitSale = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentFarm || !saleTarget) return;
    if (!saleWeight || saleWeight <= 0) return toast.error('Enter a valid weight');
    saleMutation.mutate({
      farmId: currentFarm.id,
      pigId: saleTarget.id,
      payload: {
        saleType: saleForm.saleType,
        saleDate: saleForm.saleDate,
        weightAtSale: saleWeight,
        buyer: saleForm.buyer || null,
        notes: saleForm.notes || null,
      },
    });
  };

  const pigs = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, data?.totalPages ?? 1);

  const handleRowClick = (pigId: string) => {
    navigate(`/pigs/${pigId}`);
  };

  const confirmDelete = () => {
    if (!currentFarm || !deleteTarget) return;
    deleteMutation.mutate({ farmId: currentFarm.id, pigId: deleteTarget.id });
  };

  if (!currentFarm) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center rounded-2xl border border-gray-200 bg-white p-10 shadow-sm">
        <PiggyBank className="w-14 h-14 text-primary-400 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-gray-900">Select a farm</h2>
        <p className="text-gray-500 mt-2 text-sm">Choose a farm to view pig inventory.</p>
        <Link
          to="/farms"
          className="inline-flex mt-6 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition"
        >
          Go to farms
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Pig Inventory</h1>
          <p className="mt-1 text-sm text-gray-500">
            {isLoading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading count…
              </span>
            ) : (
              <>
                <span className="font-medium text-gray-700">{total.toLocaleString()}</span>{' '}
                {statusFilter === '' ? (
                  <>pig{total === 1 ? '' : 's'} on hand</>
                ) : (
                  <>
                    pig{total === 1 ? '' : 's'}
                    {statusFilter === '__ALL__' ? ' (all statuses)' : ' (filtered)'}
                  </>
                )}
                {statusFilter === '' && (
                  <span className="block text-xs text-gray-400 mt-0.5 max-w-md">
                    Sold and deceased are hidden here. Open the dashboard <strong>Sold</strong> card or choose &quot;Sold&quot; below to see sold animals.
                  </span>
                )}
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/import"
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition"
          >
            <Upload className="w-4 h-4" />
            Import
          </Link>
          <Link
            to="/pigs/new"
            className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-primary-700 transition"
          >
            <Plus className="w-4 h-4" />
            Add Pig
          </Link>
        </div>
      </div>

      {farmDetail?.billing?.plan === 'FREE' && farmDetail.billing.atLimit && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <span className="font-medium">Free tier pig limit reached.</span>{' '}
          You cannot add or import more pigs until the farm is upgraded.{' '}
          <Link to="/billing" className="font-medium text-red-800 underline hover:no-underline">
            Open billing
          </Link>
        </div>
      )}
      {farmDetail?.billing?.plan === 'FREE' && farmDetail.billing.nearLimit && !farmDetail.billing.atLimit && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <span className="font-medium">Approaching the Free tier limit</span> ({farmDetail.billing.pigCount} /{' '}
          {farmDetail.billing.pigLimit ?? '—'} pigs).{' '}
          <Link to="/billing" className="font-medium text-amber-900 underline hover:no-underline">
            Upgrade to Pro
          </Link>{' '}
          for unlimited pigs.
        </div>
      )}

      <div className="rounded-2xl border border-gray-200/80 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <div className="relative xl:col-span-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search tag number…"
              className="w-full rounded-xl border border-gray-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition"
            />
          </div>
          <select
            value={breedFilter}
            onChange={(e) => {
              setBreedFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 bg-white"
          >
            <option value="">All breeds</option>
            {BREED_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            value={stageFilter}
            onChange={(e) => {
              setStageFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 bg-white"
          >
            <option value="">All stages</option>
            {STAGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 bg-white"
          >
            <option value="">On hand (excludes sold &amp; deceased)</option>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
            <option value="__ALL__">All statuses (incl. sold &amp; deceased)</option>
          </select>
          <select
            value={healthFilter}
            onChange={(e) => {
              setHealthFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 bg-white"
          >
            <option value="">All health</option>
            {HEALTH_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200/80 bg-white shadow-sm overflow-hidden">
        {isError && (
          <div className="p-8 text-center">
            <p className="text-red-600 text-sm font-medium">Failed to load pigs</p>
            <p className="text-gray-500 text-xs mt-1">
              {(error as Error)?.message || 'Please try again.'}
            </p>
          </div>
        )}

        {isLoading && !isError && (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
            <p className="text-sm text-gray-500">Loading inventory…</p>
          </div>
        )}

        {!isLoading && !isError && pigs.length === 0 && (
          <div className="text-center py-20 px-6">
            <div className="w-16 h-16 rounded-2xl bg-primary-50 flex items-center justify-center mx-auto mb-4">
              <PiggyBank className="w-8 h-8 text-primary-500" />
            </div>
            <h3 className="font-semibold text-gray-900">No pigs match your filters</h3>
            <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
              {statusFilter === '' ? (
                <>
                  No pigs on hand right now.{' '}
                  <Link to="/pigs?status=SOLD" className="text-primary-600 font-medium hover:underline">
                    View sold pigs
                  </Link>{' '}
                  or add a new pig.
                </>
              ) : (
                <>Adjust filters or add a new pig to get started.</>
              )}
            </p>
            <Link
              to="/pigs/new"
              className="inline-flex mt-6 items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
            >
              <Plus className="w-4 h-4" />
              Add Pig
            </Link>
          </div>
        )}

        {!isLoading && !isError && pigs.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/80">
                    <SortableTh
                      label="Tag"
                      sortKey="tagNumber"
                      activeSort={sortBy}
                      sortOrder={sortOrder}
                      onSort={handleColumnSort}
                    />
                    <SortableTh
                      label="Breed"
                      sortKey="breed"
                      activeSort={sortBy}
                      sortOrder={sortOrder}
                      onSort={handleColumnSort}
                    />
                    <SortableTh
                      label="Stage"
                      sortKey="stage"
                      activeSort={sortBy}
                      sortOrder={sortOrder}
                      onSort={handleColumnSort}
                    />
                    <SortableTh
                      label="Weight"
                      sortKey="currentWeight"
                      activeSort={sortBy}
                      sortOrder={sortOrder}
                      onSort={handleColumnSort}
                    />
                    <SortableTh
                      label="Status"
                      sortKey="status"
                      activeSort={sortBy}
                      sortOrder={sortOrder}
                      onSort={handleColumnSort}
                    />
                    <SortableTh
                      label="Health"
                      sortKey="healthStatus"
                      activeSort={sortBy}
                      sortOrder={sortOrder}
                      onSort={handleColumnSort}
                    />
                    <SortableTh
                      label="Pen"
                      sortKey="penName"
                      activeSort={sortBy}
                      sortOrder={sortOrder}
                      onSort={handleColumnSort}
                    />
                    <th scope="col" className="px-4 py-3 font-semibold text-gray-600 text-right min-w-[11rem]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pigs.map((pig) => (
                    <tr
                      key={pig.id}
                      onClick={() => handleRowClick(pig.id)}
                      className="hover:bg-primary-50/40 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 font-mono font-medium text-gray-900">{pig.tagNumber}</td>
                      <td className="px-4 py-3 text-gray-600">{breedLabel(pig.breed)}</td>
                      <td className="px-4 py-3 text-gray-600">{stageLabel(pig.stage)}</td>
                      <td className="px-4 py-3 text-gray-800 tabular-nums">
                        {pig.currentWeight != null ? `${pig.currentWeight} ${weightUnit}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${statusBadgeClass(pig.status)}`}
                        >
                          {STATUS_OPTIONS.find((s) => s.value === pig.status)?.label ?? pig.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${healthBadgeClass(pig.healthStatus)}`}
                        >
                          {HEALTH_OPTIONS.find((h) => h.value === pig.healthStatus)?.label ??
                            pig.healthStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{pig.pen?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex flex-wrap justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openObservationModal(pig)}
                            className="p-2 rounded-lg text-gray-500 hover:bg-primary-50 hover:text-primary-700 transition"
                            title="Log health observation"
                          >
                            <Stethoscope className="w-4 h-4" />
                          </button>
                          {pig.status === 'ACTIVE' && (
                            <button
                              type="button"
                              onClick={() => openSaleModal(pig)}
                              className="p-2 rounded-lg text-gray-500 hover:bg-emerald-50 hover:text-emerald-600 transition"
                              title="Record Sale / Slaughter"
                            >
                              <DollarSign className="w-4 h-4" />
                            </button>
                          )}
                          <Link
                            to={`/pigs/${pig.id}/edit`}
                            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-primary-600 transition"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(pig)}
                            className="p-2 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 transition"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-gray-100 px-4 py-3 bg-gray-50/50">
              <p className="text-xs text-gray-500">
                Page {page} of {totalPages}
                {isFetching && !isLoading && (
                  <Loader2 className="inline w-3 h-3 ml-2 animate-spin align-middle" />
                )}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:pointer-events-none"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:pointer-events-none"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-pig-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-gray-100 p-6">
            <h2 id="delete-pig-title" className="text-lg font-semibold text-gray-900">
              Delete pig?
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              This will permanently remove{' '}
              <span className="font-mono font-medium text-gray-900">{deleteTarget.tagNumber}</span>
              {' '}from the inventory. This action
              cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleteMutation.isPending}
                className="rounded-xl px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleteMutation.isPending}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deleteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {observationTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => !observationMutation.isPending && setObservationTarget(null)}
            aria-hidden
          />
          <div
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-gray-100"
            role="dialog"
            aria-modal="true"
            aria-labelledby="observation-modal-title"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 id="observation-modal-title" className="text-lg font-bold text-gray-900">
                  Health observation
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Pig{' '}
                  <span className="font-mono font-semibold text-primary-700">{observationTarget.tagNumber}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => !observationMutation.isPending && setObservationTarget(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={submitObservation} className="p-6 space-y-5">
              <div>
                <label htmlFor="observation-category" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Focus area
                </label>
                <select
                  id="observation-category"
                  value={observationForm.category}
                  onChange={(e) =>
                    setObservationForm((f) => ({
                      ...f,
                      category: e.target.value as PigObservationCategory,
                    }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none bg-white"
                >
                  {PIG_OBSERVATION_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="observation-notes" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Notes <span className="font-normal text-gray-500">(optional)</span>
                </label>
                <textarea
                  id="observation-notes"
                  rows={4}
                  placeholder="What did you see? Appetite, behaviour, treatment given, etc."
                  value={observationForm.notes}
                  onChange={(e) => setObservationForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-y min-h-[100px]"
                />
                <p className="mt-1.5 text-xs text-gray-500">
                  Add detail especially if you chose &quot;Other&quot; or need a record for your vet.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setObservationTarget(null)}
                  disabled={observationMutation.isPending}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={observationMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {observationMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                      Saving…
                    </>
                  ) : (
                    <>
                      <Stethoscope className="w-4 h-4" aria-hidden />
                      Save observation
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {saleTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSaleTarget(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Record Sale / Slaughter</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Pig <span className="font-mono font-semibold text-primary-700">{saleTarget.tagNumber}</span>
                  {' '}· Current weight: {saleTarget.currentWeight ?? '—'} {weightUnit}
                </p>
              </div>
              <button onClick={() => setSaleTarget(null)} className="p-2 hover:bg-gray-100 rounded-lg transition">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={submitSale} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Type of Sale *</label>
                <div className="grid grid-cols-2 gap-3">
                  {([['LIVE_SALE', 'Live Sale'], ['SLAUGHTER', 'Slaughter']] as const).map(([val, lbl]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setSaleForm(f => ({ ...f, saleType: val }))}
                      className={`rounded-xl border-2 px-4 py-3 text-sm font-semibold transition ${
                        saleForm.saleType === val
                          ? val === 'SLAUGHTER'
                            ? 'border-red-500 bg-red-50 text-red-800'
                            : 'border-emerald-500 bg-emerald-50 text-emerald-800'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date of {saleForm.saleType === 'SLAUGHTER' ? 'Slaughter' : 'Sale'} *
                </label>
                <input
                  type="date"
                  required
                  value={saleForm.saleDate}
                  onChange={e => setSaleForm(f => ({ ...f, saleDate: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Weight at {saleForm.saleType === 'SLAUGHTER' ? 'Slaughter' : 'Sale'} ({weightUnit}) *
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  required
                  placeholder={`e.g. ${saleTarget.currentWeight ?? '80'}`}
                  value={saleForm.weightAtSale}
                  onChange={e => setSaleForm(f => ({ ...f, weightAtSale: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
              </div>

              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-emerald-600 font-medium">Price per {weightUnit}</p>
                    <p className="text-lg font-bold text-emerald-900">{currency} {pricePerKg.toFixed(2)}</p>
                    <p className="text-xs text-emerald-500 mt-0.5">Set in farm settings</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-emerald-600 font-medium">Total Price</p>
                    <p className="text-2xl font-bold text-emerald-900">{currency} {calculatedPrice.toFixed(2)}</p>
                    {saleWeight > 0 && (
                      <p className="text-xs text-emerald-500 mt-0.5">{saleWeight} {weightUnit} × {pricePerKg.toFixed(2)}</p>
                    )}
                  </div>
                </div>
              </div>

              {saleForm.saleType === 'LIVE_SALE' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Buyer Name</label>
                  <input
                    type="text"
                    placeholder="e.g. John Smith"
                    value={saleForm.buyer}
                    onChange={e => setSaleForm(f => ({ ...f, buyer: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  rows={2}
                  placeholder="Any additional details…"
                  value={saleForm.notes}
                  onChange={e => setSaleForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSaleTarget(null)}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saleMutation.isPending}
                  className={`inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed ${
                    saleForm.saleType === 'SLAUGHTER'
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {saleMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                  ) : (
                    <><DollarSign className="w-4 h-4" /> {saleForm.saleType === 'SLAUGHTER' ? 'Record Slaughter' : 'Record Sale'}</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
