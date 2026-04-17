import { Fragment, useState } from 'react';
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
/** Check ~3 weeks after service for return to heat (non-pregnancy). */
const POST_SERVICE_HEAT_CHECK_DAYS = 21;
const GESTATION_DAY_100 = 100;

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

const GROWTH_STAGES_UI = ['PIGLET', 'WEANER', 'PORKER', 'GROWER', 'FINISHER'] as const;

function isAutoManagedGrowthStage(stage: string): boolean {
  return (GROWTH_STAGES_UI as readonly string[]).includes(stage);
}

/** Calendar age from date of birth for display (aligned with server stage bands). */
function ageSummaryFromDob(iso?: string | null): string | null {
  if (!iso) return null;
  const dob = new Date(iso);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  const start = new Date(dob.getFullYear(), dob.getMonth(), dob.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) return null;
  if (days === 0) return 'Born today';
  if (days < 14) return `${days} day${days === 1 ? '' : 's'}`;
  const weeks = Math.floor(days / 7);
  if (weeks < 12) return `${weeks} wk (${days} days)`;
  const approxMonths = Math.floor(days / 30.44);
  return `~${approxMonths} mo (${days} days)`;
}

function addDays(iso: string, days: number): Date {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d;
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

function StatusBadge({ kind, value }: { kind: 'status' | 'health'; value: string }) {
  const base = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium';
  if (kind === 'status') {
    const map: Record<string, string> = {
      ACTIVE: `${base} bg-accent-100 text-accent-800`,
      SOLD: `${base} bg-primary-100 text-primary-800 ring-1 ring-inset ring-primary-200/80`,
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

function FarrowingForm({ farmId, pigId, unit, onSuccess }: { farmId: string; pigId: string; unit: string; onSuccess: () => void }) {
  const [form, setForm] = useState({
    farrowingDate: '',
    pigletsBornAlive: '',
    pigletsBornDead: '0',
    pigletsWeaned: '',
    weaningDate: '',
    avgBirthWeightKg: '',
    ironDate: '',
    tailDockedDate: '',
    teatClippedDate: '',
    notes: '',
  });
  const mutation = useMutation({
    mutationFn: () => pigService.addFarrowing(farmId, pigId, {
      farrowingDate: form.farrowingDate,
      pigletsBornAlive: Number(form.pigletsBornAlive),
      pigletsBornDead: Number(form.pigletsBornDead || 0),
      pigletsWeaned: form.pigletsWeaned ? Number(form.pigletsWeaned) : null,
      weaningDate: form.weaningDate || null,
      avgBirthWeightKg: form.avgBirthWeightKg ? parseFloat(form.avgBirthWeightKg) : null,
      ironDate: form.ironDate || null,
      tailDockedDate: form.tailDockedDate || null,
      teatClippedDate: form.teatClippedDate || null,
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
        <label className="text-xs font-medium text-gray-600">Avg piglet birth weight ({unit})</label>
        <input type="number" step="0.01" min="0" value={form.avgBirthWeightKg} onChange={e => setForm(p => ({ ...p, avgBirthWeightKg: e.target.value }))} className={ic} placeholder="Optional" />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600">Iron given</label>
        <input type="date" value={form.ironDate} onChange={e => setForm(p => ({ ...p, ironDate: e.target.value }))} className={ic} />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600">Tail docked</label>
        <input type="date" value={form.tailDockedDate} onChange={e => setForm(p => ({ ...p, tailDockedDate: e.target.value }))} className={ic} />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600">Teats clipped</label>
        <input type="date" value={form.teatClippedDate} onChange={e => setForm(p => ({ ...p, teatClippedDate: e.target.value }))} className={ic} />
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

function FarrowingLitterCarePanel({
  farmId,
  pigId,
  record,
  unit,
  onSaved,
}: {
  farmId: string;
  pigId: string;
  record: FarrowingRecord;
  unit: string;
  onSaved: () => void;
}) {
  const [avgBirthWeightKg, setAvgBirthWeightKg] = useState(
    record.avgBirthWeightKg != null ? String(record.avgBirthWeightKg) : '',
  );
  const [ironDate, setIronDate] = useState(record.ironDate?.slice(0, 10) ?? '');
  const [tailDockedDate, setTailDockedDate] = useState(record.tailDockedDate?.slice(0, 10) ?? '');
  const [teatClippedDate, setTeatClippedDate] = useState(record.teatClippedDate?.slice(0, 10) ?? '');
  const [weaningDate, setWeaningDate] = useState(record.weaningDate?.slice(0, 10) ?? '');
  const [pigletsWeaned, setPigletsWeaned] = useState(
    record.pigletsWeaned != null ? String(record.pigletsWeaned) : '',
  );

  const mutation = useMutation({
    mutationFn: () =>
      pigService.updateFarrowing(farmId, pigId, record.id, {
        avgBirthWeightKg: avgBirthWeightKg ? parseFloat(avgBirthWeightKg) : null,
        ironDate: ironDate || null,
        tailDockedDate: tailDockedDate || null,
        teatClippedDate: teatClippedDate || null,
        weaningDate: weaningDate || null,
        pigletsWeaned: pigletsWeaned ? parseInt(pigletsWeaned, 10) : null,
      }),
    onSuccess: () => {
      toast.success('Litter details saved');
      onSaved();
    },
    onError: () => toast.error('Could not save'),
  });

  const ic = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100';
  return (
    <div className="mt-3 rounded-xl border border-primary-100 bg-primary-50/40 p-4 grid gap-3 sm:grid-cols-2">
      <div>
        <label className="text-xs font-medium text-gray-600">Avg birth weight ({unit})</label>
        <input type="number" step="0.01" min="0" value={avgBirthWeightKg} onChange={(e) => setAvgBirthWeightKg(e.target.value)} className={ic} />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600">Piglets weaned</label>
        <input type="number" min="0" value={pigletsWeaned} onChange={(e) => setPigletsWeaned(e.target.value)} className={ic} />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600">Weaning date</label>
        <input type="date" value={weaningDate} onChange={(e) => setWeaningDate(e.target.value)} className={ic} />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600">Iron given</label>
        <input type="date" value={ironDate} onChange={(e) => setIronDate(e.target.value)} className={ic} />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600">Tail docked</label>
        <input type="date" value={tailDockedDate} onChange={(e) => setTailDockedDate(e.target.value)} className={ic} />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600">Teats clipped</label>
        <input type="date" value={teatClippedDate} onChange={(e) => setTeatClippedDate(e.target.value)} className={ic} />
      </div>
      <div className="sm:col-span-2 flex justify-end">
        <button
          type="button"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
          className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60"
        >
          {mutation.isPending ? 'Saving…' : 'Save litter details'}
        </button>
      </div>
    </div>
  );
}

function VaccinationAddForm({
  farmId,
  pigId,
  onClose,
  onSaved,
}: {
  farmId: string;
  pigId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: '',
    batchNumber: '',
    dateAdministered: new Date().toISOString().slice(0, 10),
    nextDueDate: '',
    administeredBy: '',
  });
  const mutation = useMutation({
    mutationFn: () =>
      pigService.addVaccination(farmId, pigId, {
        name: form.name.trim(),
        batchNumber: form.batchNumber.trim() || null,
        dateAdministered: form.dateAdministered,
        nextDueDate: form.nextDueDate || null,
        administeredBy: form.administeredBy.trim() || null,
      }),
    onSuccess: () => {
      toast.success('Vaccination recorded');
      onSaved();
    },
    onError: () => toast.error('Could not save vaccination'),
  });
  const ic = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100';
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!form.name.trim()) {
          toast.error('Enter a vaccine name');
          return;
        }
        mutation.mutate();
      }}
      className="grid gap-3 sm:grid-cols-2 mt-4"
    >
      <div className="sm:col-span-2">
        <label className="text-xs font-medium text-gray-600">Vaccine name *</label>
        <input
          required
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          className={ic}
          placeholder="e.g. Circoflex, PRRS"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600">Date given *</label>
        <input
          type="date"
          required
          value={form.dateAdministered}
          onChange={(e) => setForm((p) => ({ ...p, dateAdministered: e.target.value }))}
          className={ic}
        />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600">Next due</label>
        <input
          type="date"
          value={form.nextDueDate}
          onChange={(e) => setForm((p) => ({ ...p, nextDueDate: e.target.value }))}
          className={ic}
        />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600">Batch #</label>
        <input
          value={form.batchNumber}
          onChange={(e) => setForm((p) => ({ ...p, batchNumber: e.target.value }))}
          className={ic}
          placeholder="Optional"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600">Administered by</label>
        <input
          value={form.administeredBy}
          onChange={(e) => setForm((p) => ({ ...p, administeredBy: e.target.value }))}
          className={ic}
          placeholder="Optional"
        />
      </div>
      <div className="sm:col-span-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={mutation.isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60"
        >
          {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          Save
        </button>
      </div>
    </form>
  );
}

function VaccinationEditForm({
  farmId,
  pigId,
  record,
  onSaved,
  onCancel,
}: {
  farmId: string;
  pigId: string;
  record: Vaccination;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    name: record.name,
    batchNumber: record.batchNumber ?? '',
    dateAdministered: record.dateAdministered.slice(0, 10),
    nextDueDate: record.nextDueDate?.slice(0, 10) ?? '',
    administeredBy: record.administeredBy ?? '',
  });
  const mutation = useMutation({
    mutationFn: () =>
      pigService.updateVaccination(farmId, pigId, record.id, {
        name: form.name.trim(),
        batchNumber: form.batchNumber.trim() || null,
        dateAdministered: form.dateAdministered,
        nextDueDate: form.nextDueDate || null,
        administeredBy: form.administeredBy.trim() || null,
      }),
    onSuccess: () => {
      toast.success('Vaccination updated');
      onSaved();
    },
    onError: () => toast.error('Could not update'),
  });
  const ic = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100';
  return (
    <div className="p-4 bg-gray-50/80 rounded-xl border border-gray-200 grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className="text-xs font-medium text-gray-600">Vaccine name *</label>
        <input
          required
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          className={ic}
        />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600">Date given *</label>
        <input
          type="date"
          required
          value={form.dateAdministered}
          onChange={(e) => setForm((p) => ({ ...p, dateAdministered: e.target.value }))}
          className={ic}
        />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600">Next due</label>
        <input
          type="date"
          value={form.nextDueDate}
          onChange={(e) => setForm((p) => ({ ...p, nextDueDate: e.target.value }))}
          className={ic}
        />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600">Batch #</label>
        <input
          value={form.batchNumber}
          onChange={(e) => setForm((p) => ({ ...p, batchNumber: e.target.value }))}
          className={ic}
        />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600">Administered by</label>
        <input
          value={form.administeredBy}
          onChange={(e) => setForm((p) => ({ ...p, administeredBy: e.target.value }))}
          className={ic}
        />
      </div>
      <div className="sm:col-span-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={mutation.isPending}
          onClick={() => {
            if (!form.name.trim()) {
              toast.error('Enter a vaccine name');
              return;
            }
            mutation.mutate();
          }}
          className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60"
        >
          {mutation.isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
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
  const [expandedFarrowCareId, setExpandedFarrowCareId] = useState<string | null>(null);
  const [showVaccineForm, setShowVaccineForm] = useState(false);
  const [editingVaccinationId, setEditingVaccinationId] = useState<string | null>(null);
  const [heatCheckDateInput, setHeatCheckDateInput] = useState(() => new Date().toISOString().slice(0, 10));

  const invalidatePigAndList = () => {
    queryClient.invalidateQueries({ queryKey: ['pig', farmId, pigId] });
    queryClient.invalidateQueries({ queryKey: ['pigs'] });
  };

  const deleteVaccinationMutation = useMutation({
    mutationFn: ({ vaccinationId }: { vaccinationId: string }) =>
      pigService.deleteVaccination(farmId!, pigId!, vaccinationId),
    onSuccess: () => {
      toast.success('Vaccination removed');
      invalidatePigAndList();
    },
    onError: () => toast.error('Could not remove vaccination'),
  });

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

  const heatCheckMutation = useMutation({
    mutationFn: (body: { serviceHeatCheckAt: string; serviceHeatInHeat: boolean }) =>
      pigService.update(farmId!, pigId!, body),
    onSuccess: () => {
      toast.success('Heat check recorded');
      queryClient.invalidateQueries({ queryKey: ['pig', farmId, pigId] });
    },
    onError: () => toast.error('Could not save heat check'),
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
  const ageLabel = ageSummaryFromDob(pig.dateOfBirth);
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

  const postServiceHeatCheckDue =
    pig.serviced && pig.servicedDate ? addDays(pig.servicedDate, POST_SERVICE_HEAT_CHECK_DAYS) : null;
  const day100FromService =
    pig.serviced && pig.servicedDate ? addDays(pig.servicedDate, GESTATION_DAY_100) : null;
  const gestationDaysSinceService =
    pig.serviced && pig.servicedDate
      ? daysSince(pig.servicedDate)
      : null;
  const showPostServiceHeatCheckReminder =
    Boolean(
      isSow &&
        pig.serviced &&
        pig.servicedDate &&
        hasNotFarrowed &&
        gestationDaysSinceService !== null &&
        gestationDaysSinceService >= POST_SERVICE_HEAT_CHECK_DAYS &&
        !pig.serviceHeatCheckAt,
    );
  const showPreFarrowPrepReminder =
    Boolean(
      isSow &&
        pig.serviced &&
        pig.servicedDate &&
        hasNotFarrowed &&
        gestationDaysSinceService !== null &&
        gestationDaysSinceService >= 97 &&
        gestationDaysSinceService <= 103,
    );

  const youngStockStages = ['WEANER', 'PIGLET', 'GROWER', 'FINISHER', 'GILT'] as const;
  const showWeanHeatWindow =
    youngStockStages.includes(pig.stage as (typeof youngStockStages)[number]) && pig.weanedDate;
  const weanHeatStart = showWeanHeatWindow ? addDays(pig.weanedDate!, 4) : null;
  const weanHeatEnd = showWeanHeatWindow ? addDays(pig.weanedDate!, 18) : null;

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
              {pig.dateOfBirth && isAutoManagedGrowthStage(pig.stage) && (
                <p className="text-primary-100/85 text-xs mt-2 max-w-md leading-relaxed">
                  Grow-out stage (piglet → finisher) updates from date of birth as the animal ages. Boars, sows, and gilts stay on the stage you set.
                </p>
              )}
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
              {ageLabel && (
                <p className="text-gray-900 text-sm"><span className="text-gray-500">Age:</span> {ageLabel}</p>
              )}
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

      {showWeanHeatWindow && weanHeatStart && weanHeatEnd && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-3">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Clock size={20} className="text-primary-600" />
            Weaning & return to heat
          </h2>
          <p className="text-sm text-gray-600">
            Weaned <span className="font-medium text-gray-900">{formatDate(pig.weanedDate)}</span>
            {' · '}
            Typical estrus window (≈14-day span from ~day 4 after weaning):{' '}
            <span className="font-medium text-gray-900">
              {formatDate(weanHeatStart.toISOString())} – {formatDate(weanHeatEnd.toISOString())}
            </span>
          </p>
          <p className="text-xs text-gray-500">
            Use this window to spot non-cyclers and compare growth vs. days to first heat for profitability.
          </p>
        </div>
      )}

      {/* Breeding & Farrowing Section — only for sows/gilts */}
      {isSow && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Heart size={20} className="text-primary-600" />
            Breeding & Farrowing
          </h2>

          {(showPreFarrowPrepReminder || showPostServiceHeatCheckReminder) && (
            <div className="space-y-2">
              {showPreFarrowPrepReminder && day100FromService && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                  <strong>Pre-farrow reminder:</strong> Around gestation day 100 ({formatDate(day100FromService.toISOString())}) — about two weeks before expected farrowing (114 days). Complete Farrowsure / pen and feed steps per your farm protocol (applies to gilts and sows).
                </div>
              )}
              {showPostServiceHeatCheckReminder && postServiceHeatCheckDue && (
                <div className="rounded-xl border border-primary-300 bg-primary-50 px-4 py-3 text-sm text-primary-950 space-y-3">
                  <p>
                    <strong>Post-service heat check:</strong> From day 21 after service ({formatDate(postServiceHeatCheckDue.toISOString())}), check whether this animal is back in heat (possible non-pregnancy).
                  </p>
                  <div className="flex flex-wrap items-end gap-3">
                    <div>
                      <label className="block text-xs font-medium text-primary-800 mb-1">Check date</label>
                      <input
                        type="date"
                        value={heatCheckDateInput}
                        onChange={(e) => setHeatCheckDateInput(e.target.value)}
                        className="rounded-lg border border-primary-200 px-3 py-2 text-sm"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={heatCheckMutation.isPending}
                      onClick={() =>
                        heatCheckMutation.mutate({
                          serviceHeatCheckAt: new Date(heatCheckDateInput).toISOString(),
                          serviceHeatInHeat: true,
                        })
                      }
                      className="rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60"
                    >
                      Record: saw heat
                    </button>
                    <button
                      type="button"
                      disabled={heatCheckMutation.isPending}
                      onClick={() =>
                        heatCheckMutation.mutate({
                          serviceHeatCheckAt: new Date(heatCheckDateInput).toISOString(),
                          serviceHeatInHeat: false,
                        })
                      }
                      className="rounded-lg border border-primary-400 bg-white px-3 py-2 text-sm font-medium text-primary-900 hover:bg-primary-100 disabled:opacity-60"
                    >
                      Record: not in heat
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

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
            {pig.serviced && pig.servicedDate && hasNotFarrowed && postServiceHeatCheckDue && (
              <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Day 21 heat check due</p>
                <p className="text-gray-900 font-semibold">{formatDate(postServiceHeatCheckDue.toISOString())}</p>
                {pig.serviceHeatCheckAt && (
                  <p className="text-gray-600 text-sm mt-1">
                    Logged {formatDate(pig.serviceHeatCheckAt)}
                    {pig.serviceHeatInHeat === true ? ' · Observed in heat' : pig.serviceHeatInHeat === false ? ' · Not in heat' : ''}
                  </p>
                )}
              </div>
            )}
            {pig.serviced && pig.servicedDate && hasNotFarrowed && day100FromService && (
              <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Gestation day 100 (pre-farrow)</p>
                <p className="text-gray-900 font-semibold">{formatDate(day100FromService.toISOString())}</p>
                {gestationDaysSinceService !== null && (
                  <p className="text-gray-600 text-sm mt-1">Currently day {gestationDaysSinceService}</p>
                )}
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
                <p className="text-xs text-gray-500 mt-1">Parity (litters farrowed)</p>
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
              <FarrowingForm
                farmId={farmId!}
                pigId={pigId!}
                unit={unit}
                onSuccess={() => {
                  setShowFarrowForm(false);
                  queryClient.invalidateQueries({ queryKey: ['pig', farmId, pigId] });
                }}
              />
            )}
            {farrowings.length === 0 ? (
              <p className="text-gray-500 text-sm py-4">No farrowing records yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-200 mt-3">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left text-gray-600">
                      <th className="px-3 py-3 font-medium">Date</th>
                      <th className="px-3 py-3 font-medium">Alive</th>
                      <th className="px-3 py-3 font-medium">Dead</th>
                      <th className="px-3 py-3 font-medium">Avg wt ({unit})</th>
                      <th className="px-3 py-3 font-medium">Weaned #</th>
                      <th className="px-3 py-3 font-medium">Wean</th>
                      <th className="px-3 py-3 font-medium">Iron</th>
                      <th className="px-3 py-3 font-medium">Dock</th>
                      <th className="px-3 py-3 font-medium">Teats</th>
                      <th className="px-3 py-3 font-medium w-28">Care</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {farrowings.map((f) => (
                      <Fragment key={f.id}>
                        <tr className="hover:bg-gray-50/80">
                          <td className="px-3 py-3 font-medium text-gray-900">{formatDate(f.farrowingDate)}</td>
                          <td className="px-3 py-3 text-gray-700">{f.pigletsBornAlive}</td>
                          <td className="px-3 py-3 text-gray-700">{f.pigletsBornDead}</td>
                          <td className="px-3 py-3 text-gray-700">
                            {f.avgBirthWeightKg != null ? Number(f.avgBirthWeightKg).toFixed(2) : '—'}
                          </td>
                          <td className="px-3 py-3 text-gray-700">{f.pigletsWeaned ?? '—'}</td>
                          <td className="px-3 py-3 text-gray-700">{formatDate(f.weaningDate)}</td>
                          <td className="px-3 py-3 text-gray-700">{formatDate(f.ironDate)}</td>
                          <td className="px-3 py-3 text-gray-700">{formatDate(f.tailDockedDate)}</td>
                          <td className="px-3 py-3 text-gray-700">{formatDate(f.teatClippedDate)}</td>
                          <td className="px-3 py-3">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedFarrowCareId((id) => (id === f.id ? null : f.id))
                              }
                              className="text-primary-600 text-xs font-medium hover:underline"
                            >
                              {expandedFarrowCareId === f.id ? 'Close' : 'Edit piglet care'}
                            </button>
                          </td>
                        </tr>
                        {expandedFarrowCareId === f.id && (
                          <tr className="bg-gray-50/50">
                            <td colSpan={10} className="px-3 py-2">
                              <FarrowingLitterCarePanel
                                farmId={farmId!}
                                pigId={pigId!}
                                record={f}
                                unit={unit}
                                onSaved={() => {
                                  setExpandedFarrowCareId(null);
                                  queryClient.invalidateQueries({ queryKey: ['pig', farmId, pigId] });
                                }}
                              />
                            </td>
                          </tr>
                        )}
                      </Fragment>
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Syringe size={20} className="text-primary-600" /> Vaccinations
          </h2>
          <button
            type="button"
            onClick={() => {
              setEditingVaccinationId(null);
              setShowVaccineForm((s) => !s);
            }}
            className="inline-flex items-center gap-1 text-sm text-primary-600 font-medium hover:text-primary-700 self-start sm:self-auto"
          >
            <Plus size={16} /> {showVaccineForm ? 'Close form' : 'Record vaccination'}
          </button>
        </div>
        {showVaccineForm && (
          <VaccinationAddForm
            farmId={farmId!}
            pigId={pigId!}
            onClose={() => setShowVaccineForm(false)}
            onSaved={() => {
              setShowVaccineForm(false);
              invalidatePigAndList();
            }}
          />
        )}
        {vaccinations.length === 0 && !showVaccineForm ? (
          <p className="text-gray-500 text-sm">No vaccination records yet. Use Record vaccination to add shots given after this pig was registered.</p>
        ) : vaccinations.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-gray-200 mt-4">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-gray-600">
                  <th className="px-4 py-3 font-medium">Vaccine</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Next due</th>
                  <th className="px-4 py-3 font-medium">Batch</th>
                  <th className="px-4 py-3 font-medium">By</th>
                  <th className="px-4 py-3 font-medium w-36"> </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {vaccinations.map((v) => (
                  <Fragment key={v.id}>
                    <tr className="hover:bg-gray-50/80">
                      <td className="px-4 py-3 font-medium text-gray-900">{v.name}</td>
                      <td className="px-4 py-3 text-gray-700">{formatDate(v.dateAdministered)}</td>
                      <td className="px-4 py-3 text-gray-700">{formatDate(v.nextDueDate)}</td>
                      <td className="px-4 py-3 text-gray-600">{v.batchNumber ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{v.administeredBy?.trim() ? v.administeredBy : '—'}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() =>
                            setEditingVaccinationId((id) => (id === v.id ? null : v.id))
                          }
                          className="text-primary-600 text-xs font-medium hover:underline mr-3"
                        >
                          {editingVaccinationId === v.id ? 'Cancel' : 'Edit'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!window.confirm('Remove this vaccination record?')) return;
                            deleteVaccinationMutation.mutate({ vaccinationId: v.id });
                          }}
                          className="text-red-600 text-xs font-medium hover:underline disabled:opacity-50"
                          disabled={deleteVaccinationMutation.isPending}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                    {editingVaccinationId === v.id && (
                      <tr className="bg-gray-50/50">
                        <td colSpan={6} className="px-4 py-3">
                          <VaccinationEditForm
                            farmId={farmId!}
                            pigId={pigId!}
                            record={v}
                            onCancel={() => setEditingVaccinationId(null)}
                            onSaved={() => {
                              setEditingVaccinationId(null);
                              invalidatePigAndList();
                            }}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
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
