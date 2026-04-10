import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  Building2,
  DollarSign,
  Loader2,
  PiggyBank,
  X,
} from 'lucide-react';
import { useFarm } from '../../context/FarmContext';
import { penService } from '../../services/pen.service';
import { pigService } from '../../services/pig.service';
import { farmService } from '../../services/farm.service';
import type { PenType, PigStatus, SaleType } from '../../types';

const TYPE_BADGE: Record<PenType, string> = {
  FARROWING: 'bg-primary-100 text-primary-800 ring-1 ring-inset ring-primary-200/80',
  GROWER: 'bg-green-100 text-green-800 ring-1 ring-inset ring-green-200/80',
  FINISHER: 'bg-primary-100 text-primary-800 ring-1 ring-inset ring-primary-200/80',
  BOAR: 'bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-200/80',
  QUARANTINE: 'bg-red-100 text-red-800 ring-1 ring-inset ring-red-200/80',
  NURSERY: 'bg-purple-100 text-purple-800 ring-1 ring-inset ring-purple-200/80',
};

function formatEnumLabel(value: string): string {
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusBadgeClass(status: PigStatus): string {
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

export default function PenDetailPage() {
  const { penId } = useParams<{ penId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentFarm } = useFarm();
  const farmId = currentFarm?.id;
  const weightUnit = currentFarm?.weightUnit ?? 'kg';
  const currency = currentFarm?.currency ?? 'USD';

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  /** Pigs included in the current bulk sale modal (may differ from checkbox selection). */
  const [bulkTargetIds, setBulkTargetIds] = useState<string[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [saleForm, setSaleForm] = useState({
    saleType: 'LIVE_SALE' as SaleType,
    saleDate: new Date().toISOString().slice(0, 10),
    buyer: '',
    notes: '',
  });
  const [weightByPigId, setWeightByPigId] = useState<Record<string, string>>({});

  const penQuery = useQuery({
    queryKey: ['pen', farmId, penId],
    queryFn: () => penService.getById(farmId!, penId!),
    enabled: Boolean(farmId && penId),
  });

  const { data: farmDetail } = useQuery({
    queryKey: ['farm', farmId],
    queryFn: () => farmService.getById(farmId!),
    enabled: !!farmId,
  });
  const pricePerKg = Number(farmDetail?.farm?.pricePerKg) || 0;

  const pen = penQuery.data;
  const pigs = pen?.pigs ?? [];
  const activePigs = useMemo(() => pigs.filter((p) => p.status === 'ACTIVE'), [pigs]);

  const bulkMutation = useMutation({
    mutationFn: () => {
      const ids = bulkTargetIds;
      const items = ids.map((id) => {
        const w = parseFloat(weightByPigId[id] ?? '');
        return { pigId: id, weightAtSale: w };
      });
      const bad = items.find((i) => !Number.isFinite(i.weightAtSale) || i.weightAtSale <= 0);
      if (bad) throw new Error('INVALID_WEIGHT');
      return pigService.bulkRecordSale(farmId!, {
        saleType: saleForm.saleType,
        saleDate: saleForm.saleDate,
        buyer: saleForm.buyer.trim() || null,
        notes: saleForm.notes.trim() || null,
        items,
      });
    },
    onSuccess: (result) => {
      toast.success(
        `Recorded ${result.count} sale${result.count === 1 ? '' : 's'} — ${currency} ${result.totalRevenue.toFixed(2)} total`,
      );
      setBulkOpen(false);
      setBulkTargetIds([]);
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['pen', farmId, penId] });
      queryClient.invalidateQueries({ queryKey: ['pens', farmId] });
      queryClient.invalidateQueries({ queryKey: ['pigs'] });
      queryClient.invalidateQueries({ queryKey: ['farm-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['serviced-sows', farmId] });
    },
    onError: (err: unknown) => {
      if (err instanceof Error && err.message === 'INVALID_WEIGHT') {
        toast.error('Enter a valid weight for every selected pig');
        return;
      }
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error(msg || 'Could not record sales');
    },
  });

  const openBulkModal = (ids: string[]) => {
    if (ids.length === 0) {
      toast.error('No active pigs to sell');
      return;
    }
    const map: Record<string, string> = {};
    for (const id of ids) {
      const pig = pigs.find((p) => p.id === id);
      map[id] =
        pig?.currentWeight != null ? String(Number(pig.currentWeight)) : '';
    }
    setBulkTargetIds(ids);
    setWeightByPigId(map);
    setSaleForm((f) => ({
      ...f,
      saleDate: new Date().toISOString().slice(0, 10),
    }));
    setBulkOpen(true);
  };

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllActive = () => {
    setSelectedIds(new Set(activePigs.map((p) => p.id)));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const pigsInBulkModal = useMemo(() => {
    const set = new Set(bulkTargetIds);
    return pigs.filter((p) => set.has(p.id));
  }, [pigs, bulkTargetIds]);

  const modalTotal = useMemo(() => {
    let sum = 0;
    for (const p of pigsInBulkModal) {
      const w = parseFloat(weightByPigId[p.id] ?? '');
      if (Number.isFinite(w) && w > 0) sum += w * pricePerKg;
    }
    return sum;
  }, [pigsInBulkModal, weightByPigId, pricePerKg]);

  const submitBulk = (e: React.FormEvent) => {
    e.preventDefault();
    bulkMutation.mutate();
  };

  if (!farmId) {
    return (
      <div className="max-w-lg mx-auto mt-16 rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">
        <Building2 className="mx-auto h-12 w-12 text-gray-300" aria-hidden />
        <h1 className="mt-4 text-xl font-semibold text-gray-900">No farm selected</h1>
        <Link
          to="/farms"
          className="mt-6 inline-flex rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
        >
          Select farm
        </Link>
      </div>
    );
  }

  if (penQuery.isLoading) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3">
        <Loader2 className="h-10 w-10 animate-spin text-primary-500" />
        <p className="text-sm text-gray-500">Loading pen…</p>
      </div>
    );
  }

  if (penQuery.isError || !pen) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-red-100 bg-red-50/80 p-8 text-center">
        <p className="text-red-800 font-medium">Pen not found or you don’t have access.</p>
        <Link
          to="/pens"
          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary-700 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Back to pens
        </Link>
      </div>
    );
  }

  const occ = pen._count?.pigs ?? pigs.length;
  const overCap = pen.capacity > 0 && occ > pen.capacity;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <button
            type="button"
            onClick={() => navigate('/pens')}
            className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-primary-700"
          >
            <ArrowLeft className="h-4 w-4" /> All pens
          </button>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">{pen.name}</h1>
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${TYPE_BADGE[pen.type]}`}
            >
              {formatEnumLabel(pen.type)}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Capacity {pen.capacity}
            {overCap && (
              <span className="ml-2 font-semibold text-red-600">Over capacity</span>
            )}
            {' · '}
            {occ} pig{occ === 1 ? '' : 's'} on hand in this pen
            {' · '}
            {activePigs.length} active (sellable)
          </p>
          <p className="mt-2 text-xs text-gray-400 max-w-xl">
            Sold and deceased animals are kept in records but not shown here or in the default inventory.{' '}
            <Link to="/pigs?status=SOLD" className="text-primary-600 font-medium hover:underline">
              View sold pigs
            </Link>
            .
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => openBulkModal(activePigs.map((p) => p.id))}
            disabled={activePigs.length === 0}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-900 shadow-sm transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <DollarSign className="h-4 w-4" />
            Sell entire pen (active)
          </button>
          <button
            type="button"
            onClick={() => openBulkModal(Array.from(selectedIds))}
            disabled={selectedIds.size === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Sell selected ({selectedIds.size})
          </button>
        </div>
      </div>

      {activePigs.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-gray-50/80 px-4 py-3 text-sm">
          <span className="font-medium text-gray-700">Selection:</span>
          <button
            type="button"
            onClick={selectAllActive}
            className="text-primary-700 font-medium hover:underline"
          >
            Select all active
          </button>
          <span className="text-gray-300">|</span>
          <button
            type="button"
            onClick={clearSelection}
            className="text-gray-600 font-medium hover:underline"
          >
            Clear
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        {pigs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <PiggyBank className="h-12 w-12 text-gray-300" />
            <p className="mt-4 text-gray-600">No pigs are assigned to this pen yet.</p>
            <Link
              to="/pigs"
              className="mt-4 text-sm font-medium text-primary-600 hover:underline"
            >
              Open inventory
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/80">
                  <th className="w-10 px-3 py-3" scope="col">
                    <span className="sr-only">Select</span>
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Tag</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Stage</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Weight</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pigs.map((pig) => {
                  const isActive = pig.status === 'ACTIVE';
                  return (
                    <tr key={pig.id} className="hover:bg-primary-50/30">
                      <td className="px-3 py-3 align-middle">
                        {isActive ? (
                          <input
                            type="checkbox"
                            checked={selectedIds.has(pig.id)}
                            onChange={() => toggle(pig.id)}
                            className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            aria-label={`Select ${pig.tagNumber}`}
                          />
                        ) : (
                          <span className="inline-block w-4" />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          to={`/pigs/${pig.id}`}
                          className="font-mono font-semibold text-primary-700 hover:underline"
                        >
                          {pig.tagNumber}
                        </Link>
                        {pig.name?.trim() ? (
                          <span className="ml-2 text-gray-500">{pig.name}</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{formatEnumLabel(pig.stage)}</td>
                      <td className="px-4 py-3 tabular-nums text-gray-800">
                        {pig.currentWeight != null
                          ? `${Number(pig.currentWeight)} ${weightUnit}`
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${statusBadgeClass(pig.status)}`}
                        >
                          {formatEnumLabel(pig.status)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {bulkOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            aria-label="Close"
            onClick={() => {
              setBulkOpen(false);
              setBulkTargetIds([]);
            }}
          />
          <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Bulk sale / slaughter</h2>
                <p className="mt-1 text-sm text-gray-500">
                  {pigsInBulkModal.length} pig{pigsInBulkModal.length === 1 ? '' : 's'} — same date,
                  buyer, and notes. Set weight per animal.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setBulkOpen(false);
                  setBulkTargetIds([]);
                }}
                className="rounded-lg p-2 hover:bg-gray-100"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={submitBulk} className="space-y-4 p-6">
              <div>
                <p className="mb-2 text-sm font-medium text-gray-700">Type *</p>
                <div className="grid grid-cols-2 gap-2">
                  {(['LIVE_SALE', 'SLAUGHTER'] as const).map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setSaleForm((f) => ({ ...f, saleType: val }))}
                      className={`rounded-xl border-2 px-3 py-2.5 text-sm font-semibold transition ${
                        saleForm.saleType === val
                          ? val === 'SLAUGHTER'
                            ? 'border-red-500 bg-red-50 text-red-800'
                            : 'border-emerald-500 bg-emerald-50 text-emerald-800'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {val === 'SLAUGHTER' ? 'Slaughter' : 'Live sale'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                <input
                  type="date"
                  required
                  value={saleForm.saleDate}
                  onChange={(e) => setSaleForm((f) => ({ ...f, saleDate: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-gray-100 p-3">
                {pigsInBulkModal.map((p) => (
                  <div key={p.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="w-24 font-mono font-medium text-gray-900">{p.tagNumber}</span>
                    <label className="sr-only" htmlFor={`w-${p.id}`}>
                      Weight {p.tagNumber}
                    </label>
                    <input
                      id={`w-${p.id}`}
                      type="number"
                      step="0.1"
                      min="0"
                      required
                      value={weightByPigId[p.id] ?? ''}
                      onChange={(e) =>
                        setWeightByPigId((m) => ({ ...m, [p.id]: e.target.value }))
                      }
                      className="min-w-[6rem] flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                      placeholder={weightUnit}
                    />
                    <span className="text-gray-500">{weightUnit}</span>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex justify-between gap-4 text-sm">
                  <div>
                    <p className="text-xs font-medium text-emerald-700">Price / {weightUnit}</p>
                    <p className="text-lg font-bold text-emerald-900">
                      {currency} {pricePerKg.toFixed(2)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium text-emerald-700">Combined total</p>
                    <p className="text-xl font-bold text-emerald-900">
                      {currency} {modalTotal.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              {saleForm.saleType === 'LIVE_SALE' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Buyer</label>
                  <input
                    type="text"
                    value={saleForm.buyer}
                    onChange={(e) => setSaleForm((f) => ({ ...f, buyer: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    placeholder="Optional"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={saleForm.notes}
                  onChange={(e) => setSaleForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Optional — applies to all"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setBulkOpen(false);
                    setBulkTargetIds([]);
                  }}
                  className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bulkMutation.isPending}
                  className={`inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${
                    saleForm.saleType === 'SLAUGHTER'
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {bulkMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                    </>
                  ) : (
                    <>
                      <DollarSign className="h-4 w-4" /> Record {pigsInBulkModal.length} sale
                      {pigsInBulkModal.length === 1 ? '' : 's'}
                    </>
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
