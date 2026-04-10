import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Building2,
  Loader2,
  Pencil,
  PiggyBank,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useFarm } from '../../context/FarmContext';
import { penService } from '../../services/pen.service';
import type { Pen, PenType } from '../../types';

const PEN_TYPES: PenType[] = [
  'FARROWING',
  'GROWER',
  'FINISHER',
  'BOAR',
  'QUARANTINE',
  'NURSERY',
];

const TYPE_BADGE: Record<PenType, string> = {
  FARROWING: 'bg-primary-100 text-primary-800 ring-1 ring-inset ring-primary-200/80',
  GROWER: 'bg-green-100 text-green-800 ring-1 ring-inset ring-green-200/80',
  FINISHER: 'bg-primary-100 text-primary-800 ring-1 ring-inset ring-primary-200/80',
  BOAR: 'bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-200/80',
  QUARANTINE: 'bg-red-100 text-red-800 ring-1 ring-inset ring-red-200/80',
  NURSERY: 'bg-purple-100 text-purple-800 ring-1 ring-inset ring-purple-200/80',
};

function formatPenTypeLabel(t: PenType): string {
  return t
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function occupancyPercent(pen: Pen): number {
  const cap = pen.capacity;
  if (!cap || cap <= 0) return 0;
  const n = pen._count?.pigs ?? 0;
  return Math.min(100, Math.round((n / cap) * 100));
}

function barColorClass(pct: number): string {
  if (pct >= 100) return 'bg-red-500';
  if (pct >= 85) return 'bg-amber-500';
  if (pct >= 60) return 'bg-primary-500';
  return 'bg-accent-500';
}

type ModalMode = 'create' | 'edit';

export default function PenListPage() {
  const { currentFarm } = useFarm();
  const queryClient = useQueryClient();
  const farmId = currentFarm?.id;

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<ModalMode>('create');
  const [editingPen, setEditingPen] = useState<Pen | null>(null);
  const [deletePen, setDeletePen] = useState<Pen | null>(null);

  const [name, setName] = useState('');
  const [type, setType] = useState<PenType>('GROWER');
  const [capacity, setCapacity] = useState<number>(10);

  const pensQuery = useQuery({
    queryKey: ['pens', farmId],
    queryFn: () => penService.list(farmId!),
    enabled: Boolean(farmId),
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; type: PenType; capacity: number }) =>
      penService.create(farmId!, data),
    onSuccess: () => {
      toast.success('Pen created');
      queryClient.invalidateQueries({ queryKey: ['pens', farmId] });
      setFormOpen(false);
      setEditingPen(null);
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data
              ?.message
          : undefined;
      toast.error(msg || 'Could not create pen');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      penId,
      data,
    }: {
      penId: string;
      data: { name: string; type: PenType; capacity: number };
    }) => penService.update(farmId!, penId, data),
    onSuccess: () => {
      toast.success('Pen updated');
      queryClient.invalidateQueries({ queryKey: ['pens', farmId] });
      setFormOpen(false);
      setEditingPen(null);
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data
              ?.message
          : undefined;
      toast.error(msg || 'Could not update pen');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (penId: string) => penService.delete(farmId!, penId),
    onSuccess: () => {
      toast.success('Pen removed');
      queryClient.invalidateQueries({ queryKey: ['pens', farmId] });
      setDeletePen(null);
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data
              ?.message
          : undefined;
      toast.error(msg || 'Could not delete pen');
    },
  });

  const openCreate = () => {
    setFormMode('create');
    setEditingPen(null);
    setName('');
    setType('GROWER');
    setCapacity(10);
    setFormOpen(true);
  };

  const openEdit = (pen: Pen) => {
    setFormMode('edit');
    setEditingPen(pen);
    setName(pen.name);
    setType(pen.type);
    setCapacity(pen.capacity);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingPen(null);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Name is required');
      return;
    }
    if (capacity < 1 || !Number.isFinite(capacity)) {
      toast.error('Capacity must be at least 1');
      return;
    }
    const payload = { name: trimmed, type, capacity: Math.floor(capacity) };
    if (formMode === 'create') {
      createMutation.mutate(payload);
    } else if (editingPen) {
      updateMutation.mutate({ penId: editingPen.id, data: payload });
    }
  };

  const pens = pensQuery.data ?? [];
  const penCount = pens.length;
  const isSaving = createMutation.isPending || updateMutation.isPending;

  if (!farmId) {
    return (
      <div className="max-w-lg mx-auto mt-16 rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">
        <Building2 className="mx-auto h-12 w-12 text-gray-300" aria-hidden />
        <h1 className="mt-4 text-xl font-semibold text-gray-900">No farm selected</h1>
        <p className="mt-2 text-sm text-gray-500">
          Choose a farm to manage pens and occupancy.
        </p>
        <Link
          to="/farms"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-primary-700"
        >
          Select farm
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Pen Management
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {pensQuery.isLoading
              ? 'Loading pens…'
              : `${penCount} ${penCount === 1 ? 'pen' : 'pens'} on ${currentFarm?.name}`}
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add Pen
        </button>
      </header>

      {pensQuery.isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
            >
              <div className="h-5 w-2/3 rounded bg-gray-200" />
              <div className="mt-3 h-6 w-24 rounded-full bg-gray-100" />
              <div className="mt-6 h-2 w-full rounded-full bg-gray-100" />
              <div className="mt-4 flex gap-2">
                <div className="h-9 flex-1 rounded-lg bg-gray-100" />
                <div className="h-9 w-9 rounded-lg bg-gray-100" />
              </div>
            </div>
          ))}
        </div>
      ) : penCount === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-white/80 px-8 py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
            <PiggyBank className="h-8 w-8" aria-hidden />
          </div>
          <h2 className="mt-6 text-lg font-semibold text-gray-900">No pens yet</h2>
          <p className="mt-2 max-w-sm text-sm text-gray-500">
            Create your first pen to organize pigs by stage — farrowing, grower, finisher,
            and more.
          </p>
          <button
            type="button"
            onClick={openCreate}
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700"
          >
            <Plus className="h-4 w-4" />
            Add your first pen
          </button>
        </div>
      ) : (
        <ul className="grid list-none gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {pens.map((pen) => {
            const occ = pen._count?.pigs ?? 0;
            const pct = occupancyPercent(pen);
            const overCap = pen.capacity > 0 && occ > pen.capacity;
            return (
              <li key={pen.id}>
                <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition hover:border-primary-200/60 hover:shadow-md">
                  <div className="absolute right-3 top-3 z-10 flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(pen)}
                      className="rounded-lg bg-white/90 p-2 text-gray-400 shadow-sm ring-1 ring-gray-100 transition hover:bg-white hover:text-primary-600"
                      aria-label={`Edit ${pen.name}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletePen(pen)}
                      className="rounded-lg bg-white/90 p-2 text-gray-400 shadow-sm ring-1 ring-gray-100 transition hover:bg-white hover:text-red-600"
                      aria-label={`Delete ${pen.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <Link
                    to={`/pens/${pen.id}`}
                    className="flex flex-1 flex-col p-6 pb-6 outline-none transition hover:bg-gray-50/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"
                  >
                    <div className="flex items-start justify-between gap-3 pr-14">
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-lg font-semibold text-gray-900">
                          {pen.name}
                        </h3>
                        <span
                          className={`mt-2 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${TYPE_BADGE[pen.type]}`}
                        >
                          {formatPenTypeLabel(pen.type)}
                        </span>
                      </div>
                    </div>

                    <dl className="mt-5 space-y-3 text-sm">
                      <div className="flex items-center justify-between text-gray-600">
                        <dt className="flex items-center gap-1.5">
                          <span className="text-gray-400">Capacity</span>
                        </dt>
                        <dd className="font-medium text-gray-900">{pen.capacity}</dd>
                      </div>
                      <div className="flex items-center justify-between text-gray-600">
                        <dt>Occupancy</dt>
                        <dd className="font-medium text-gray-900">
                          {occ} pig{occ === 1 ? '' : 's'}
                          {overCap && (
                            <span className="ml-1 text-xs font-semibold text-red-600">
                              (over capacity)
                            </span>
                          )}
                        </dd>
                      </div>
                    </dl>

                    <div className="mt-4">
                      <div className="mb-1.5 flex items-center justify-between text-xs text-gray-500">
                        <span>Fill level</span>
                        <span className="font-medium tabular-nums text-gray-700">
                          {pen.capacity > 0
                            ? `${Math.round((occ / pen.capacity) * 100)}%`
                            : '—'}
                        </span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
                        <div
                          className={`h-full rounded-full transition-all ${barColorClass(pct)} ${overCap ? 'bg-red-600' : ''}`}
                          style={{
                            width: `${pen.capacity > 0 ? Math.min(100, (occ / pen.capacity) * 100) : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                    <p className="mt-4 text-xs font-medium text-primary-600">View pigs in pen →</p>
                  </Link>
                </article>
              </li>
            );
          })}
        </ul>
      )}

      {/* Create / Edit modal */}
      {formOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="presentation"
        >
          <button
            type="button"
            className="absolute inset-0 bg-gray-900/50 backdrop-blur-[2px]"
            aria-label="Close dialog"
            onClick={closeForm}
          />
          <div
            className="relative z-10 w-full max-w-md rounded-2xl border border-gray-100 bg-white p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pen-form-title"
          >
            <div className="flex items-center justify-between gap-4">
              <h2 id="pen-form-title" className="text-lg font-bold text-gray-900">
                {formMode === 'create' ? 'Add pen' : 'Edit pen'}
              </h2>
              <button
                type="button"
                onClick={closeForm}
                className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleFormSubmit} className="mt-6 space-y-5">
              <div>
                <label htmlFor="pen-name" className="block text-sm font-medium text-gray-700">
                  Name
                </label>
                <input
                  id="pen-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-gray-900 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                  placeholder="e.g. North Grower A"
                  autoComplete="off"
                />
              </div>
              <div>
                <label htmlFor="pen-type" className="block text-sm font-medium text-gray-700">
                  Type
                </label>
                <select
                  id="pen-type"
                  value={type}
                  onChange={(e) => setType(e.target.value as PenType)}
                  className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-gray-900 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                >
                  {PEN_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {formatPenTypeLabel(t)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="pen-capacity"
                  className="block text-sm font-medium text-gray-700"
                >
                  Capacity
                </label>
                <input
                  id="pen-capacity"
                  type="number"
                  min={1}
                  step={1}
                  value={capacity}
                  onChange={(e) => setCapacity(Number(e.target.value))}
                  className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-gray-900 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                />
              </div>
              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-60"
                >
                  {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {formMode === 'create' ? 'Create pen' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deletePen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-gray-900/50 backdrop-blur-[2px]"
            aria-label="Close dialog"
            onClick={() => setDeletePen(null)}
          />
          <div
            className="relative z-10 w-full max-w-sm rounded-2xl border border-gray-100 bg-white p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-pen-title"
          >
            <h2 id="delete-pen-title" className="text-lg font-bold text-gray-900">
              Delete pen?
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              <span className="font-medium text-gray-900">{deletePen.name}</span> will be
              removed. This cannot be undone.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setDeletePen(null)}
                className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteMutation.mutate(deletePen.id)}
                disabled={deleteMutation.isPending}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
              >
                {deleteMutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
