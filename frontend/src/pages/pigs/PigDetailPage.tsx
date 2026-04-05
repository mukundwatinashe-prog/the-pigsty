import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Pencil, Trash2, PiggyBank, Scale, Calendar,
  MapPin, Dna, Syringe, Baby, StickyNote, Heart, Clock, Plus, Loader2,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useFarm } from '../../context/FarmContext';
import { pigService } from '../../services/pig.service';
import { weightService } from '../../services/weight.service';
import type { Pig, WeightLog, Vaccination, FarrowingRecord } from '../../types';

const GESTATION_DAYS = 114;
const HEAT_RETURN_DAYS = 21;

type PigWithRelations = Pig & {
  weightLogs?: WeightLog[];
  vaccinations?: Vaccination[];
  farrowingRecords?: FarrowingRecord[];
  damOffspring?: { id: string; tagNumber: string }[];
  sireOffspring?: { id: string; tagNumber: string }[];
  dam?: { id: string; tagNumber: string } | null;
  sire?: { id: string; tagNumber: string } | null;
  pen?: { id: string; name: string; type: string } | null;
};

function formatLabel(value: string): string {
  return value.split('_').map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString(undefined, { dateStyle: 'medium' });
}

function daysFromNow(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function addDays(iso: string, days: number): Date {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d;
}

function StatusBadge({ kind, value }: { kind: 'status' | 'health'; value: string }) {
  const base = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium';
  if (kind === 'status') {
    const map: Record<string, string> = {
      ACTIVE: `${base} bg-accent-100 text-accent-800`,
      SOLD: `${base} bg-gray-200 text-gray-800`,
      DECEASED: `${base} bg-red-100 text-red-800`,
      QUARANTINE: `${base} bg-amber-100 text-amber-900`,
    };
    return <span className={map[value] ?? `${base} bg-gray-100 text-gray-700`}>{formatLabel(value)}</span>;
  }
  const map: Record<string, string> = {
    HEALTHY: `${base} bg-accent-100 text-accent-800`,
    SICK: `${base} bg-red-100 text-red-800`,
    UNDER_TREATMENT: `${base} bg-amber-100 text-amber-900`,
    RECOVERED: `${base} bg-primary-100 text-primary-800`,
  };
  return <span className={map[value] ?? `${base} bg-gray-100 text-gray-700`}>{formatLabel(value)}</span>;
}

function FarrowingForm({ farmId, pigId, onSuccess }: { farmId: string; pigId: string; onSuccess: () => void }) {
  const [form, setForm] = useState({
    farrowingDate: '', pigletsBornAlive: '', pigletsBornDead: '0',
    pigletsWeaned: '', weaningDate: '', notes: '',
  });
  const mutation = useMutation({
    mutationFn: () => pigService.addFarrowing(farmId, pigId, {
      farrowingDate: form.farrowingDate,
      pigletsBornAlive: Number(form.pigletsBornAlive),
      pigletsBornDead: Number(form.pigletsBornDead || 0),
      pigletsWeaned: form.pigletsWeaned ? Number(form.pigletsWeaned) : null,
      weaningDate: form.weaningDate || null,
      notes: form.notes || null,
    }),
    onSuccess: () => { toast.success('Farrowing recorded'); onSuccess(); },
    onError: () => toast.error('Failed to record farrowing'),
  });
  const ic = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100';
  return (
    <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="grid gap-3 sm:grid-cols-2 mt-4">
      <div>
        <label className="text-xs font-medium text-gray-600">Farrowing date *</label>
        <input type="date" required value={form.farrowingDate} onChange={e => setForm(p => ({ ...p, farrowingDate: e.target.value }))} className={ic} />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600">Piglets born alive *</label>
        <input type="number" min="0" required value={form.pigletsBornAlive} onChange={e => setForm(p => ({ ...p, pigletsBornAlive: e.target.value }))} className={ic} />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600">Piglets born dead</label>
        <input type="number" min="0" value={form.pigletsBornDead} onChange={e => setForm(p => ({ ...p, pigletsBornDead: e.target.value }))} className={ic} />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600">Piglets weaned</label>
        <input type="number" min="0" value={form.pigletsWeaned} onChange={e => setForm(p => ({ ...p, pigletsWeaned: e.target.value }))} className={ic} />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600">Weaning date</label>
        <input type="date" value={form.weaningDate} onChange={e => setForm(p => ({ ...p, weaningDate: e.target.value }))} className={ic} />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600">Notes</label>
        <input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className={ic} placeholder="Optional" />
      </div>
      <div className="sm:col-span-2 flex justify-end">
        <button type="submit" disabled={mutation.isPending} className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60">
          {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          Record Farrowing
        </button>
      </div>
    </form>
  );
}

export default function PigDetailPage() {
  const { id: pigId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentFarm } = useFarm();
  const farmId = currentFarm?.id;
  const unit = currentFarm?.weightUnit ?? 'kg';
  const [showFarrowForm, setShowFarrowForm] = useState(false);

  const { data: pig, isLoading: pigLoading, isError: pigError, error: pigErr } = useQuery({
    queryKey: ['pig', farmId, pigId],
    queryFn: () => pigService.getById(farmId!, pigId!) as Promise<PigWithRelations>,
    enabled: !!farmId && !!pigId,
  });

  const { data: weightHistory, isLoading: weightLoading } = useQuery({
    queryKey: ['pig-weights', farmId, pigId],
    queryFn: () => weightService.getHistory(farmId!, pigId!) as Promise<{ logs: WeightLog[]; adg: number }>,
    enabled: !!farmId && !!pigId,
  });

  const deleteMutation = useMutation({
    mutationFn: () => pigService.delete(farmId!, pigId!),
    onSuccess: () => {
      toast.success('Pig removed');
      queryClient.invalidateQueries({ queryKey: ['pigs', farmId] });
      navigate('/pigs');
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message ?? 'Could not delete pig');
    },
  });

  const handleDelete = () => {
    if (!window.confirm('Delete this pig permanently? This cannot be undone.')) return;
    deleteMutation.mutate();
  };

  if (!currentFarm) {
    return (
      <div className="max-w-3xl mx-auto text-center py-16 px-4">
        <p className="text-gray-600 mb-4">Select a farm to view pig details.</p>
        <Link to="/farms" className="text-primary-600 font-medium hover:text-primary-700">Choose farm</Link>
      </div>
    );
  }
  if (!pigId) {
    return (
      <div className="text-center py-16 text-gray-600">
        Missing pig id. <Link to="/pigs" className="text-primary-600">Back to pigs</Link>
      </div>
    );
  }
  if (pigLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
      </div>
    );
  }
  if (pigError || !pig) {
    return (
      <div className="max-w-xl mx-auto text-center py-16 px-4">
        <p className="text-red-600 mb-4">
          {(pigErr as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Pig not found.'}
        </p>
        <Link to="/pigs" className="inline-flex items-center gap-2 text-primary-600 font-medium hover:text-primary-700">
          <ArrowLeft size={18} /> Back to pigs
        </Link>
      </div>
    );
  }

  const logs = weightHistory?.logs ?? [];
  const adg = weightHistory?.adg ?? 0;
  const chartData = logs.map((l) => ({
    date: new Date(l.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    weight: Number(l.weight),
  }));

  const vaccinations = pig.vaccinations ?? [];
  const farrowings = pig.farrowingRecords ?? [];
  const offspring = [...(pig.damOffspring ?? []), ...(pig.sireOffspring ?? [])];
  const uniqueOffspring = Array.from(new Map(offspring.map((o) => [o.id, o])).values());

  const isSow = pig.stage === 'SOW' || pig.stage === 'GILT';

  // Breeding calculations
  const expectedFarrowingDate = pig.serviced && pig.servicedDate
    ? addDays(pig.servicedDate, GESTATION_DAYS)
    : null;
  const daysUntilFarrowing = expectedFarrowingDate ? daysFromNow(expectedFarrowingDate.toISOString()) : null;
  const hasNotFarrowed = daysUntilFarrowing !== null && daysUntilFarrowing >= 0;

  const lastFarrowing = farrowings[0];
  const expectedHeatReturn = lastFarrowing?.weaningDate
    ? addDays(lastFarrowing.weaningDate, HEAT_RETURN_DAYS)
    : lastFarrowing?.farrowingDate
      ? addDays(lastFarrowing.farrowingDate, 28)
      : null;

  // Farrowing stats
  const totalBirths = farrowings.length;
  const totalBornAlive = farrowings.reduce((s, f) => s + f.pigletsBornAlive, 0);
  const totalBornDead = farrowings.reduce((s, f) => s + f.pigletsBornDead, 0);
  const totalBorn = totalBornAlive + totalBornDead;
  const avgLitterSize = totalBirths > 0 ? (totalBornAlive / totalBirths).toFixed(1) : '—';
  const pigletDeathRate = totalBorn > 0 ? ((totalBornDead / totalBorn) * 100).toFixed(1) : '0';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Link to="/pigs" className="inline-flex items-center gap-2 text-gray-600 hover:text-primary-600 transition text-sm font-medium w-fit">
          <ArrowLeft size={18} /> Back to pigs
        </Link>
        <div className="flex items-center gap-2">
          <Link to={`/pigs/${pigId}/edit`} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 transition">
            <Pencil size={16} /> Edit
          </Link>
          <button type="button" onClick={handleDelete} disabled={deleteMutation.isPending} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm font-medium hover:bg-red-100 transition disabled:opacity-50">
            <Trash2 size={16} /> {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>

      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-6 py-8 text-white">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <PiggyBank size={28} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold tracking-tight mb-1">{pig.tagNumber}</h1>
              <p className="text-primary-100 text-sm">{formatLabel(pig.breed)} · {formatLabel(pig.stage)}</p>
              <div className="flex flex-wrap gap-2 mt-4">
                <StatusBadge kind="status" value={pig.status} />
                <StatusBadge kind="health" value={pig.healthStatus} />
                {pig.serviced && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">Serviced</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
              <Scale size={20} className="text-gray-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Weights</p>
              <p className="text-gray-900 font-semibold">Entry {pig.entryWeight} {unit}</p>
              <p className="text-gray-700">Current {pig.currentWeight} {unit}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
              <Calendar size={20} className="text-gray-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Dates</p>
              <p className="text-gray-900 text-sm"><span className="text-gray-500">DOB:</span> {formatDate(pig.dateOfBirth)}</p>
              <p className="text-gray-900 text-sm"><span className="text-gray-500">Acquired:</span> {formatDate(pig.acquisitionDate)}</p>
            </div>
          </div>
          <div className="flex gap-3 sm:col-span-2 lg:col-span-1">
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
              <MapPin size={20} className="text-gray-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Pen</p>
              {pig.pen ? (
                <>
                  <p className="text-gray-900 font-medium">{pig.pen.name}</p>
                  <p className="text-gray-600 text-sm">{formatLabel(pig.pen.type)}</p>
                </>
              ) : (
                <p className="text-gray-500">Not assigned</p>
              )}
            </div>
          </div>

          <div className="sm:col-span-2 lg:col-span-3 border-t border-gray-100 pt-6 flex flex-wrap gap-8">
            <div className="flex gap-3 items-start min-w-[140px]">
              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0"><Dna size={20} className="text-gray-600" /></div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Dam</p>
                {pig.dam ? (
                  <Link to={`/pigs/${pig.dam.id}`} className="text-primary-600 font-medium hover:text-primary-700 hover:underline">{pig.dam.tagNumber}</Link>
                ) : <p className="text-gray-500 text-sm">—</p>}
              </div>
            </div>
            <div className="flex gap-3 items-start min-w-[140px]">
              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0"><Dna size={20} className="text-gray-600" /></div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Sire</p>
                {pig.sire ? (
                  <Link to={`/pigs/${pig.sire.id}`} className="text-primary-600 font-medium hover:text-primary-700 hover:underline">{pig.sire.tagNumber}</Link>
                ) : <p className="text-gray-500 text-sm">—</p>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Breeding & Farrowing Section — only for sows/gilts */}
      {isSow && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Heart size={20} className="text-primary-600" />
            Breeding & Farrowing
          </h2>

          {/* Expected dates */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pig.serviced && pig.servicedDate && (
              <div className="rounded-xl border border-primary-200 bg-primary-50/60 p-4">
                <p className="text-xs font-medium text-primary-600 uppercase tracking-wide mb-1">Serviced Date</p>
                <p className="text-gray-900 font-semibold">{formatDate(pig.servicedDate)}</p>
              </div>
            )}
            {expectedFarrowingDate && hasNotFarrowed && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Clock size={14} className="text-amber-600" />
                  <p className="text-xs font-medium text-amber-600 uppercase tracking-wide">Expected Farrowing</p>
                </div>
                <p className="text-gray-900 font-semibold">{formatDate(expectedFarrowingDate.toISOString())}</p>
                <p className="text-amber-700 text-sm mt-0.5">{daysUntilFarrowing} days remaining</p>
              </div>
            )}
            {expectedHeatReturn && !hasNotFarrowed && (
              <div className="rounded-xl border border-primary-200 bg-primary-50/60 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Clock size={14} className="text-primary-600" />
                  <p className="text-xs font-medium text-primary-600 uppercase tracking-wide">Expected Back in Heat</p>
                </div>
                <p className="text-gray-900 font-semibold">{formatDate(expectedHeatReturn.toISOString())}</p>
                {daysFromNow(expectedHeatReturn.toISOString()) > 0 && (
                  <p className="text-primary-700 text-sm mt-0.5">{daysFromNow(expectedHeatReturn.toISOString())} days remaining</p>
                )}
              </div>
            )}
          </div>

          {/* Lifetime stats */}
          {totalBirths > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl bg-gray-50 p-4 text-center">
                <p className="text-2xl font-bold text-gray-900">{totalBirths}</p>
                <p className="text-xs text-gray-500 mt-1">Total Births</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-4 text-center">
                <p className="text-2xl font-bold text-gray-900">{avgLitterSize}</p>
                <p className="text-xs text-gray-500 mt-1">Avg Litter Size</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-4 text-center">
                <p className="text-2xl font-bold text-gray-900">{totalBornAlive}</p>
                <p className="text-xs text-gray-500 mt-1">Total Born Alive</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-4 text-center">
                <p className={`text-2xl font-bold ${Number(pigletDeathRate) > 10 ? 'text-red-600' : 'text-gray-900'}`}>{pigletDeathRate}%</p>
                <p className="text-xs text-gray-500 mt-1">Piglet Death Rate</p>
              </div>
            </div>
          )}

          {/* Farrowing history table */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">Farrowing History</h3>
              <button type="button" onClick={() => setShowFarrowForm(!showFarrowForm)} className="inline-flex items-center gap-1 text-sm text-primary-600 font-medium hover:text-primary-700">
                <Plus size={16} /> Record Farrowing
              </button>
            </div>
            {showFarrowForm && (
              <FarrowingForm farmId={farmId!} pigId={pigId!} onSuccess={() => {
                setShowFarrowForm(false);
                queryClient.invalidateQueries({ queryKey: ['pig', farmId, pigId] });
              }} />
            )}
            {farrowings.length === 0 ? (
              <p className="text-gray-500 text-sm py-4">No farrowing records yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-200 mt-3">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left text-gray-600">
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium">Born Alive</th>
                      <th className="px-4 py-3 font-medium">Born Dead</th>
                      <th className="px-4 py-3 font-medium">Weaned</th>
                      <th className="px-4 py-3 font-medium">Wean Date</th>
                      <th className="px-4 py-3 font-medium">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {farrowings.map((f) => (
                      <tr key={f.id} className="hover:bg-gray-50/80">
                        <td className="px-4 py-3 font-medium text-gray-900">{formatDate(f.farrowingDate)}</td>
                        <td className="px-4 py-3 text-gray-700">{f.pigletsBornAlive}</td>
                        <td className="px-4 py-3 text-gray-700">{f.pigletsBornDead}</td>
                        <td className="px-4 py-3 text-gray-700">{f.pigletsWeaned ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-700">{formatDate(f.weaningDate)}</td>
                        <td className="px-4 py-3 text-gray-600 truncate max-w-[200px]">{f.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Weight History */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Scale size={20} className="text-primary-600" /> Weight history
          </h2>
          <div className="text-sm">
            <span className="text-gray-500">ADG (from logs): </span>
            <span className="font-semibold text-gray-900">{weightLoading ? '…' : logs.length >= 2 ? `${adg} ${unit}/day` : '—'}</span>
          </div>
        </div>
        {weightLoading ? (
          <div className="h-64 flex items-center justify-center text-gray-500">Loading chart…</div>
        ) : chartData.length === 0 ? (
          <p className="text-gray-500 text-center py-12">No weight logs yet.</p>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} className="text-gray-600" />
                <YAxis tick={{ fontSize: 12 }} label={{ value: unit, angle: -90, position: 'insideLeft' }} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} formatter={(value) => [`${value ?? '—'} ${unit}`, 'Weight']} />
                <Line type="monotone" dataKey="weight" stroke="#5bc0eb" strokeWidth={2} dot={{ fill: '#5bc0eb', r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Vaccinations */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
          <Syringe size={20} className="text-primary-600" /> Vaccinations
        </h2>
        {vaccinations.length === 0 ? (
          <p className="text-gray-500 text-sm">No vaccination records.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="min-w-full text-sm">
              <thead><tr className="bg-gray-50 text-left text-gray-600"><th className="px-4 py-3 font-medium">Vaccine</th><th className="px-4 py-3 font-medium">Date</th><th className="px-4 py-3 font-medium">Next due</th><th className="px-4 py-3 font-medium">Batch</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {vaccinations.map((v) => (
                  <tr key={v.id} className="hover:bg-gray-50/80">
                    <td className="px-4 py-3 font-medium text-gray-900">{v.name}</td>
                    <td className="px-4 py-3 text-gray-700">{formatDate(v.dateAdministered)}</td>
                    <td className="px-4 py-3 text-gray-700">{formatDate(v.nextDueDate)}</td>
                    <td className="px-4 py-3 text-gray-600">{v.batchNumber ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Offspring */}
      {uniqueOffspring.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <Baby size={20} className="text-primary-600" /> Offspring
          </h2>
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 overflow-hidden">
            {uniqueOffspring.map((o) => (
              <li key={o.id}>
                <Link to={`/pigs/${o.id}`} className="flex items-center px-4 py-3 hover:bg-primary-50/50 transition">
                  <span className="font-medium text-primary-700">{o.tagNumber}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Notes */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-3">
          <StickyNote size={20} className="text-primary-600" /> Notes
        </h2>
        {pig.notes?.trim() ? (
          <p className="text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">{pig.notes}</p>
        ) : (
          <p className="text-gray-500 text-sm">No notes for this pig.</p>
        )}
      </div>
    </div>
  );
}
