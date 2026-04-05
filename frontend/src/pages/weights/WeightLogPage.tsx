import { useState, useMemo, useRef, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Scale,
  History,
  ChevronDown,
  Check,
  Users,
  User,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useFarm } from '../../context/FarmContext';
import { weightService } from '../../services/weight.service';
import { pigService } from '../../services/pig.service';
import { penService } from '../../services/pen.service';
import type { Pig, Pen } from '../../types';

type RecentWeightEntry = {
  id: string;
  pigId: string;
  weight: number;
  date: string;
  notes?: string | null;
  pig: { id: string; tagNumber: string; name?: string | null };
  user?: { id: string; name: string };
};

type RecentWeightsResponse = {
  data: RecentWeightEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

function formatDateInput(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function WeightLogPage() {
  const { currentFarm } = useFarm();
  const queryClient = useQueryClient();
  const farmId = currentFarm?.id;
  const unit = currentFarm?.weightUnit ?? 'kg';

  const [tab, setTab] = useState<'log' | 'recent'>('log');
  const [bulkMode, setBulkMode] = useState(false);
  const [pigSearch, setPigSearch] = useState('');
  const [debouncedPigSearch, setDebouncedPigSearch] = useState('');
  const [selectedPig, setSelectedPig] = useState<Pig | null>(null);
  const [pigDropdownOpen, setPigDropdownOpen] = useState(false);
  const pigDropdownRef = useRef<HTMLDivElement>(null);

  const [weight, setWeight] = useState('');
  const [date, setDate] = useState(formatDateInput(new Date()));
  const [notes, setNotes] = useState('');
  const [selectedPenId, setSelectedPenId] = useState('');

  // Individual pig weights for bulk mode: { [pigId]: string }
  const [penWeights, setPenWeights] = useState<Record<string, string>>({});

  const [recentPage, setRecentPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedPigSearch(pigSearch.trim()), 300);
    return () => clearTimeout(t);
  }, [pigSearch]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (pigDropdownRef.current && !pigDropdownRef.current.contains(e.target as Node)) {
        setPigDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const { data: pens = [] } = useQuery({
    queryKey: ['pens', farmId],
    queryFn: () => penService.list(farmId!),
    enabled: !!farmId,
  });

  const { data: pigsResult, isLoading: pigsLoading } = useQuery({
    queryKey: ['pigs', farmId, debouncedPigSearch, 'weight-log-dropdown'],
    queryFn: () =>
      pigService.list(farmId!, {
        search: debouncedPigSearch || undefined,
        pageSize: '40',
        status: 'ACTIVE',
        sortBy: 'tagNumber',
        sortOrder: 'asc',
      } as Record<string, string>),
    enabled: !!farmId && !bulkMode,
  });

  const pigs = pigsResult?.data ?? [];

  // Fetch pigs in the selected pen
  const { data: penPigsResult, isLoading: penPigsLoading } = useQuery({
    queryKey: ['pigs', farmId, 'pen', selectedPenId],
    queryFn: () =>
      pigService.list(farmId!, {
        penId: selectedPenId,
        pageSize: '200',
        status: 'ACTIVE',
        sortBy: 'tagNumber',
        sortOrder: 'asc',
      } as Record<string, string>),
    enabled: !!farmId && bulkMode && !!selectedPenId,
  });

  const penPigs = penPigsResult?.data ?? [];

  // When pen pigs load, initialise the weights map with current weights
  useEffect(() => {
    if (penPigs.length > 0) {
      setPenWeights(prev => {
        const next: Record<string, string> = {};
        penPigs.forEach(p => {
          next[p.id] = prev[p.id] ?? '';
        });
        return next;
      });
    }
  }, [penPigs]);

  // Compute totals from individual weights
  const filledWeights = useMemo(() => {
    return Object.entries(penWeights)
      .map(([pigId, val]) => ({ pigId, weight: parseFloat(val) }))
      .filter(e => !isNaN(e.weight) && e.weight > 0);
  }, [penWeights]);

  const totalPenWeight = useMemo(() => filledWeights.reduce((s, e) => s + e.weight, 0), [filledWeights]);
  const averagePenWeight = useMemo(() => (filledWeights.length > 0 ? totalPenWeight / filledWeights.length : 0), [totalPenWeight, filledWeights]);

  const { data: recentData, isLoading: recentLoading } = useQuery({
    queryKey: ['weights-recent', farmId, recentPage, pageSize],
    queryFn: () =>
      weightService.getRecent(farmId!, {
        page: String(recentPage),
        pageSize: String(pageSize),
      }) as Promise<RecentWeightsResponse>,
    enabled: !!farmId && tab === 'recent',
  });

  const logMutation = useMutation({
    mutationFn: () => {
      if (!farmId) throw new Error('No farm');
      if (bulkMode) {
        if (!selectedPenId) throw new Error('Select a pen');
        if (filledWeights.length === 0) throw new Error('Enter at least one pig weight');
        return weightService.bulkLog(farmId, {
          penId: selectedPenId,
          date: new Date(date).toISOString(),
          notes: notes.trim() || undefined,
          weights: filledWeights,
        });
      }
      const w = parseFloat(weight);
      if (Number.isNaN(w) || w <= 0) throw new Error('Enter a valid weight');
      if (!selectedPig) throw new Error('Select a pig');
      return weightService.log(farmId, {
        pigId: selectedPig.id,
        weight: w,
        date: new Date(date).toISOString(),
        notes: notes.trim() || undefined,
      });
    },
    onSuccess: (data) => {
      if (bulkMode && data && typeof data === 'object' && 'logged' in data) {
        toast.success(`Logged weights for ${(data as { logged: number }).logged} pigs`);
        setPenWeights({});
      } else {
        toast.success('Weight logged');
      }
      setWeight('');
      setNotes('');
      queryClient.invalidateQueries({ queryKey: ['weights-recent', farmId] });
      queryClient.invalidateQueries({ queryKey: ['pigs', farmId] });
      queryClient.invalidateQueries({ queryKey: ['farm-dashboard'] });
    },
    onError: (err: unknown) => {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;
      toast.error(msg || (err instanceof Error ? err.message : 'Failed to log weight'));
    },
  });

  const displayLabel = (pig: Pig) => pig.tagNumber || pig.id.slice(0, 8);

  if (!farmId) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center">
        <Scale className="mx-auto mb-4 size-12 text-gray-300" />
        <h1 className="text-lg font-semibold text-gray-800">Weight log</h1>
        <p className="mt-2 text-gray-600">Select a farm from the farm switcher to log weights.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Weight log</h1>
          <p className="mt-1 text-sm text-gray-600">
            Record weights for individual pigs or an entire pen · {currentFarm?.name}
          </p>
        </div>
        <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setTab('log')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === 'log'
                ? 'bg-primary-600 text-white shadow'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Scale className="size-4" />
            Log weight
          </button>
          <button
            type="button"
            onClick={() => setTab('recent')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === 'recent'
                ? 'bg-primary-600 text-white shadow'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <History className="size-4" />
            Recent logs
          </button>
        </div>
      </div>

      {tab === 'log' && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 pb-6">
            <span className="text-sm font-medium text-gray-700">Entry mode</span>
            <label className="flex cursor-pointer items-center gap-3">
              <span className={`text-sm ${!bulkMode ? 'font-semibold text-gray-900' : 'text-gray-500'}`}>
                <User className="mr-1 inline size-4 align-text-bottom" />
                Single pig
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={bulkMode}
                onClick={() => {
                  setBulkMode(!bulkMode);
                  setSelectedPig(null);
                  setPigDropdownOpen(false);
                  setPenWeights({});
                }}
                className={`relative h-7 w-12 rounded-full transition ${
                  bulkMode ? 'bg-accent-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 size-6 rounded-full bg-white shadow transition ${
                    bulkMode ? 'translate-x-5' : ''
                  }`}
                />
              </button>
              <span className={`text-sm ${bulkMode ? 'font-semibold text-gray-900' : 'text-gray-500'}`}>
                <Users className="mr-1 inline size-4 align-text-bottom" />
                Bulk by pen
              </span>
            </label>
          </div>

          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              logMutation.mutate();
            }}
          >
            {!bulkMode ? (
              <>
                <div ref={pigDropdownRef} className="relative">
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Pig</label>
                  <button
                    type="button"
                    onClick={() => setPigDropdownOpen((o) => !o)}
                    className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-left text-sm transition hover:border-primary-300 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                  >
                    <span className={selectedPig ? 'text-gray-900' : 'text-gray-400'}>
                      {selectedPig ? displayLabel(selectedPig) : 'Search and select a pig…'}
                    </span>
                    <ChevronDown className={`size-4 shrink-0 text-gray-500 transition ${pigDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {pigDropdownOpen && (
                    <div className="absolute z-20 mt-2 max-h-72 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
                      <div className="border-b border-gray-100 p-2">
                        <input
                          type="search"
                          autoFocus
                          placeholder="Search tag number…"
                          value={pigSearch}
                          onChange={(e) => setPigSearch(e.target.value)}
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                        />
                      </div>
                      <ul className="max-h-52 overflow-y-auto p-1">
                        {pigsLoading ? (
                          <li className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500">
                            <Loader2 className="size-4 animate-spin" />
                            Loading pigs…
                          </li>
                        ) : pigs.length === 0 ? (
                          <li className="py-8 text-center text-sm text-gray-500">No pigs match your search.</li>
                        ) : (
                          pigs.map((pig) => (
                            <li key={pig.id}>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedPig(pig);
                                  setPigDropdownOpen(false);
                                  setPigSearch('');
                                }}
                                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-primary-50"
                              >
                                <span>{displayLabel(pig)}</span>
                                {selectedPig?.id === pig.id && (
                                  <Check className="size-4 text-primary-600" />
                                )}
                              </button>
                            </li>
                          ))
                        )}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label htmlFor="weight" className="mb-1.5 block text-sm font-medium text-gray-700">
                      Weight ({unit})
                    </label>
                    <input
                      id="weight"
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label htmlFor="w-date" className="mb-1.5 block text-sm font-medium text-gray-700">
                      Date
                    </label>
                    <input
                      id="w-date"
                      type="date"
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label htmlFor="pen-select" className="mb-1.5 block text-sm font-medium text-gray-700">
                    Pen
                  </label>
                  <select
                    id="pen-select"
                    value={selectedPenId}
                    onChange={(e) => {
                      setSelectedPenId(e.target.value);
                      setPenWeights({});
                    }}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                  >
                    <option value="">Select pen…</option>
                    {pens.map((pen: Pen) => (
                      <option key={pen.id} value={pen.id}>
                        {pen.name}
                        {pen._count?.pigs != null ? ` (${pen._count.pigs} pigs)` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedPenId && (
                  <div>
                    <label htmlFor="bulk-date" className="mb-1.5 block text-sm font-medium text-gray-700">
                      Weigh Date
                    </label>
                    <input
                      id="bulk-date"
                      type="date"
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                    />
                  </div>
                )}

                {selectedPenId && penPigsLoading && (
                  <div className="flex items-center justify-center py-12 gap-2 text-gray-500">
                    <Loader2 className="size-5 animate-spin" />
                    <span className="text-sm">Loading pigs in pen…</span>
                  </div>
                )}

                {selectedPenId && !penPigsLoading && penPigs.length === 0 && (
                  <div className="py-10 text-center text-sm text-gray-500">
                    No active pigs in this pen.
                  </div>
                )}

                {selectedPenId && !penPigsLoading && penPigs.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-700">
                        Individual pig weights — {penPigs.length} pig{penPigs.length === 1 ? '' : 's'}
                      </p>
                      <p className="text-xs text-gray-400">Enter each pig's weight below</p>
                    </div>

                    <div className="rounded-xl border border-gray-200 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="px-4 py-2.5 text-left font-semibold text-gray-600 w-12">#</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-gray-600">Tag Number</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-gray-600 w-28">Current ({unit})</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-gray-600 w-40">New Weight ({unit})</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {penPigs.map((pig, idx) => {
                            const newW = parseFloat(penWeights[pig.id] || '');
                            const currentW = Number(pig.currentWeight);
                            const diff = !isNaN(newW) && newW > 0 ? newW - currentW : null;
                            return (
                              <tr key={pig.id} className="hover:bg-gray-50/50">
                                <td className="px-4 py-2 text-gray-400 tabular-nums">{idx + 1}</td>
                                <td className="px-4 py-2">
                                  <span className="font-mono font-medium text-gray-900">{pig.tagNumber}</span>
                                </td>
                                <td className="px-4 py-2 tabular-nums text-gray-500">{currentW > 0 ? currentW.toFixed(1) : '—'}</td>
                                <td className="px-4 py-2">
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="number"
                                      step="0.1"
                                      min="0"
                                      placeholder="0.0"
                                      value={penWeights[pig.id] ?? ''}
                                      onChange={e =>
                                        setPenWeights(prev => ({ ...prev, [pig.id]: e.target.value }))
                                      }
                                      className="w-24 rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm tabular-nums focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                                    />
                                    {diff !== null && (
                                      <span className={`text-xs font-medium tabular-nums ${diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                                        {diff > 0 ? '+' : ''}{diff.toFixed(1)}
                                      </span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {filledWeights.length > 0 && (
                      <div className="rounded-xl bg-primary-50 border border-primary-200 p-4">
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div>
                            <p className="text-xs text-primary-600 font-medium">Pigs Weighed</p>
                            <p className="text-lg font-bold text-primary-900">{filledWeights.length}<span className="text-sm font-normal text-primary-500"> / {penPigs.length}</span></p>
                          </div>
                          <div>
                            <p className="text-xs text-primary-600 font-medium">Total Weight</p>
                            <p className="text-lg font-bold text-primary-900">{totalPenWeight.toFixed(1)} <span className="text-sm font-normal">{unit}</span></p>
                          </div>
                          <div>
                            <p className="text-xs text-primary-600 font-medium">Average Weight</p>
                            <p className="text-lg font-bold text-primary-900">{averagePenWeight.toFixed(1)} <span className="text-sm font-normal">{unit}</span></p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {!bulkMode && (
              <div>
                <label htmlFor="w-notes" className="mb-1.5 block text-sm font-medium text-gray-700">
                  Notes <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <textarea
                  id="w-notes"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                  placeholder="Condition, feed change, etc."
                />
              </div>
            )}

            {bulkMode && selectedPenId && penPigs.length > 0 && (
              <div>
                <label htmlFor="bulk-notes" className="mb-1.5 block text-sm font-medium text-gray-700">
                  Notes <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <textarea
                  id="bulk-notes"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                  placeholder="Weigh session notes…"
                />
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={logMutation.isPending || (bulkMode && filledWeights.length === 0)}
                className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:opacity-60"
              >
                {logMutation.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Saving…
                  </>
                ) : bulkMode ? (
                  `Log weights (${filledWeights.length} pig${filledWeights.length === 1 ? '' : 's'})`
                ) : (
                  'Log weight'
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {tab === 'recent' && (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/80">
                  <th className="px-4 py-3 font-semibold text-gray-700">Pig tag</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Weight ({unit})</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Date</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Logged by</th>
                </tr>
              </thead>
              <tbody>
                {recentLoading ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-16 text-center text-gray-500">
                      <Loader2 className="mx-auto mb-2 size-8 animate-spin text-primary-500" />
                      Loading recent logs…
                    </td>
                  </tr>
                ) : !recentData?.data?.length ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-16 text-center text-gray-500">
                      No weight logs yet.
                    </td>
                  </tr>
                ) : (
                  recentData.data.map((row) => (
                    <tr key={row.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {row.pig.tagNumber}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-gray-800">{Number(row.weight).toFixed(2)}</td>
                      <td className="px-4 py-3 text-gray-700">
                        {new Date(row.date).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{row.user?.name ?? '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {recentData && recentData.totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-4 py-3 text-sm text-gray-600">
              <span>
                Page {recentData.page} of {recentData.totalPages} · {recentData.total} entries
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={recentPage <= 1}
                  onClick={() => setRecentPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 font-medium hover:bg-gray-50 disabled:opacity-40"
                >
                  <ChevronLeft className="size-4" />
                  Previous
                </button>
                <button
                  type="button"
                  disabled={recentPage >= recentData.totalPages}
                  onClick={() => setRecentPage((p) => p + 1)}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 font-medium hover:bg-gray-50 disabled:opacity-40"
                >
                  Next
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
