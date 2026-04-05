import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Baby, Download, FileText, Loader2, PiggyBank, X, CheckCircle2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useFarm } from '../../context/FarmContext';
import { pigService } from '../../services/pig.service';
import type { PigBreed, PigStage, HealthStatus, ServicedSow } from '../../types';

const BREED_LABELS: Record<string, string> = {
  LARGE_WHITE: 'Large White', LANDRACE: 'Landrace', DUROC: 'Duroc',
  PIETRAIN: 'Pietrain', BERKSHIRE: 'Berkshire', HAMPSHIRE: 'Hampshire',
  CHESTER_WHITE: 'Chester White', YORKSHIRE: 'Yorkshire', TAMWORTH: 'Tamworth',
  MUKOTA: 'Mukota', KOLBROEK: 'Kolbroek', WINDSNYER: 'Windsnyer',
  SA_LANDRACE: 'SA Landrace', INDIGENOUS: 'Indigenous',
  CROSSBREED: 'Crossbreed', OTHER: 'Other',
};

function breedLabel(b: PigBreed) { return BREED_LABELS[b] ?? b; }
function stageLabel(s: PigStage) { return s.charAt(0) + s.slice(1).toLowerCase(); }
function healthLabel(h: HealthStatus) { return h.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString(undefined, { dateStyle: 'medium' });
}

function healthBadgeClass(h: HealthStatus) {
  switch (h) {
    case 'HEALTHY': return 'bg-emerald-50 text-emerald-800 ring-emerald-600/15';
    case 'SICK': return 'bg-red-100 text-red-800 ring-red-600/20';
    case 'UNDER_TREATMENT': return 'bg-amber-100 text-amber-900 ring-amber-600/20';
    case 'RECOVERED': return 'bg-primary-100 text-primary-800 ring-primary-600/20';
    default: return 'bg-gray-100 text-gray-700';
  }
}

function birthUrgencyClass(days: number) {
  if (days <= 7) return 'text-red-700 bg-red-50 border-red-200';
  if (days <= 21) return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-gray-700 bg-gray-50 border-gray-200';
}

function toLocalISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface BirthFormState {
  farrowingDate: string;
  pigletsBornAlive: string;
  pigletsBornDead: string;
  birthWeight: string;
  complications: string;
  notes: string;
}

const emptyForm: BirthFormState = {
  farrowingDate: toLocalISODate(new Date()),
  pigletsBornAlive: '',
  pigletsBornDead: '0',
  birthWeight: '',
  complications: '',
  notes: '',
};

export default function ServicedSowsPage() {
  const { currentFarm } = useFarm();
  const unit = currentFarm?.weightUnit ?? 'kg';
  const queryClient = useQueryClient();

  const [modalSow, setModalSow] = useState<ServicedSow | null>(null);
  const [form, setForm] = useState<BirthFormState>(emptyForm);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['serviced-sows', currentFarm?.id],
    queryFn: () => pigService.getServicedSows(currentFarm!.id),
    enabled: !!currentFarm?.id,
  });

  const birthMutation = useMutation({
    mutationFn: (vars: { pigId: string; payload: any }) =>
      pigService.completeBirth(currentFarm!.id, vars.pigId, vars.payload),
    onSuccess: (_data, vars) => {
      toast.success(`Birth recorded for ${modalSow?.tagNumber ?? vars.pigId}`);
      queryClient.invalidateQueries({ queryKey: ['serviced-sows'] });
      queryClient.invalidateQueries({ queryKey: ['farm-dashboard'] });
      closeModal();
    },
    onError: () => toast.error('Failed to record birth'),
  });

  const openModal = (sow: ServicedSow) => {
    setModalSow(sow);
    setForm(emptyForm);
  };

  const closeModal = () => {
    setModalSow(null);
    setForm(emptyForm);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalSow) return;
    const alive = parseInt(form.pigletsBornAlive, 10);
    const dead = parseInt(form.pigletsBornDead, 10) || 0;
    if (isNaN(alive) || alive < 0) return toast.error('Enter a valid number for piglets born alive');

    birthMutation.mutate({
      pigId: modalSow.id,
      payload: {
        farrowingDate: form.farrowingDate,
        pigletsBornAlive: alive,
        pigletsBornDead: dead,
        birthWeight: form.birthWeight ? parseFloat(form.birthWeight) : null,
        complications: form.complications || null,
        notes: form.notes || null,
      },
    });
  };

  const handleExport = async (format: 'xlsx' | 'pdf') => {
    if (!currentFarm) return;
    try {
      await pigService.exportServicedSows(currentFarm.id, format);
      toast.success(`Exported as ${format.toUpperCase()}`);
    } catch {
      toast.error('Export failed');
    }
  };

  const sows = data?.sows ?? [];

  if (!currentFarm) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center rounded-2xl border border-gray-200 bg-white p-10 shadow-sm">
        <PiggyBank className="w-14 h-14 text-primary-400 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-gray-900">Select a farm</h2>
        <p className="text-gray-500 mt-2 text-sm">Choose a farm to view serviced sows.</p>
        <Link to="/farms" className="inline-flex mt-6 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition">Go to farms</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-2">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <Baby className="w-7 h-7 text-primary-600" />
            Serviced Sows
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            <span className="font-medium text-gray-700">{sows.length}</span> sow{sows.length === 1 ? '' : 's'} currently serviced
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => handleExport('xlsx')} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition">
            <Download className="w-4 h-4" /> Export Excel
          </button>
          <button onClick={() => handleExport('pdf')} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition">
            <FileText className="w-4 h-4" /> Export PDF
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200/80 bg-white shadow-sm overflow-hidden">
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
            <p className="text-sm text-gray-500">Loading serviced sows…</p>
          </div>
        )}

        {isError && (
          <div className="p-8 text-center">
            <p className="text-red-600 text-sm font-medium">Failed to load data</p>
          </div>
        )}

        {!isLoading && !isError && sows.length === 0 && (
          <div className="text-center py-20 px-6">
            <div className="w-16 h-16 rounded-2xl bg-primary-50 flex items-center justify-center mx-auto mb-4">
              <Baby className="w-8 h-8 text-primary-500" />
            </div>
            <h3 className="font-semibold text-gray-900">No serviced sows</h3>
            <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
              Mark a sow as serviced in the pig details to track expected birth dates.
            </p>
          </div>
        )}

        {!isLoading && !isError && sows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/80">
                  <th className="px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Tag</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Breed</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Stage</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Health</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Date of Birth</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Weight</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Serviced</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Expected Birth</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Days Left</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 whitespace-nowrap text-center">Record Birth</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sows.map((sow) => (
                  <tr key={sow.id} className="hover:bg-primary-50/40 transition-colors">
                    <td className="px-4 py-3">
                      <Link to={`/pigs/${sow.id}`} className="font-mono font-medium text-primary-700 hover:text-primary-800 hover:underline">
                        {sow.tagNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{breedLabel(sow.breed)}</td>
                    <td className="px-4 py-3 text-gray-600">{stageLabel(sow.stage)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${healthBadgeClass(sow.healthStatus)}`}>
                        {healthLabel(sow.healthStatus)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(sow.dateOfBirth)}</td>
                    <td className="px-4 py-3 text-gray-800 tabular-nums">{sow.currentWeight} {unit}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(sow.servicedDate)}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{formatDate(sow.expectedBirthDate)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-semibold ${birthUrgencyClass(sow.daysUntilBirth)}`}>
                        {sow.daysUntilBirth > 0 ? `${sow.daysUntilBirth} days` : sow.daysUntilBirth === 0 ? 'Today' : 'Overdue'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => openModal(sow)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-primary-700 active:bg-primary-800 transition"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Given Birth
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Birth Recording Modal */}
      {modalSow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Record Birth</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Sow <span className="font-mono font-semibold text-primary-700">{modalSow.tagNumber}</span>
                  {' '}· Expected {formatDate(modalSow.expectedBirthDate)}
                </p>
              </div>
              <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-lg transition">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth *</label>
                <input
                  type="date"
                  required
                  value={form.farrowingDate}
                  onChange={e => setForm(f => ({ ...f, farrowingDate: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Piglets Born Alive *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    placeholder="e.g. 10"
                    value={form.pigletsBornAlive}
                    onChange={e => setForm(f => ({ ...f, pigletsBornAlive: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stillborn / Deaths</label>
                  <input
                    type="number"
                    min="0"
                    value={form.pigletsBornDead}
                    onChange={e => setForm(f => ({ ...f, pigletsBornDead: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  />
                </div>
              </div>

              {form.pigletsBornAlive && parseInt(form.pigletsBornDead) > 0 && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                  Total litter: <strong>{parseInt(form.pigletsBornAlive || '0') + parseInt(form.pigletsBornDead || '0')}</strong> piglets
                  · Survival rate: <strong>{((parseInt(form.pigletsBornAlive || '0') / (parseInt(form.pigletsBornAlive || '0') + parseInt(form.pigletsBornDead || '0'))) * 100).toFixed(0)}%</strong>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Average Piglet Birth Weight ({unit})</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="e.g. 1.4"
                  value={form.birthWeight}
                  onChange={e => setForm(f => ({ ...f, birthWeight: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Complications</label>
                <input
                  type="text"
                  placeholder="e.g. Dystocia, retained placenta…"
                  value={form.complications}
                  onChange={e => setForm(f => ({ ...f, complications: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Additional Notes</label>
                <textarea
                  rows={3}
                  placeholder="Any other observations about the birth…"
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={birthMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {birthMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                  ) : (
                    <><CheckCircle2 className="w-4 h-4" /> Complete Birth</>
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
