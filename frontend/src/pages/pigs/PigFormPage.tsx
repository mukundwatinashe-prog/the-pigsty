import { useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, PiggyBank } from 'lucide-react';
import toast from 'react-hot-toast';
import { useFarm } from '../../context/FarmContext';
import { track } from '../../lib/analytics';
import { pigService } from '../../services/pig.service';
import { penService } from '../../services/pen.service';
import type { PigBreed, PigStage, PigStatus, HealthStatus } from '../../types';

const BREEDS = [
  'LARGE_WHITE',
  'LANDRACE',
  'DUROC',
  'PIETRAIN',
  'BERKSHIRE',
  'HAMPSHIRE',
  'CHESTER_WHITE',
  'YORKSHIRE',
  'TAMWORTH',
  'MUKOTA',
  'KOLBROEK',
  'WINDSNYER',
  'SA_LANDRACE',
  'INDIGENOUS',
  'CROSSBREED',
  'OTHER',
] as const satisfies readonly PigBreed[];

const STAGES = [
  'BOAR',
  'SOW',
  'GILT',
  'WEANER',
  'PIGLET',
  'PORKER',
  'GROWER',
  'FINISHER',
] as const satisfies readonly PigStage[];

const STATUSES = ['ACTIVE', 'SOLD', 'DECEASED', 'QUARANTINE'] as const satisfies readonly PigStatus[];

const HEALTH = ['HEALTHY', 'SICK', 'UNDER_TREATMENT', 'RECOVERED'] as const satisfies readonly HealthStatus[];

const BREED_LABELS: Record<PigBreed, string> = {
  LARGE_WHITE: 'Large White',
  LANDRACE: 'Landrace',
  DUROC: 'Duroc',
  PIETRAIN: 'Pietrain',
  BERKSHIRE: 'Berkshire',
  HAMPSHIRE: 'Hampshire',
  CHESTER_WHITE: 'Chester White',
  YORKSHIRE: 'Yorkshire',
  TAMWORTH: 'Tamworth',
  MUKOTA: 'Mukota',
  KOLBROEK: 'Kolbroek',
  WINDSNYER: 'Windsnyer',
  SA_LANDRACE: 'SA Landrace',
  INDIGENOUS: 'Indigenous',
  CROSSBREED: 'Crossbreed',
  OTHER: 'Other',
};

const STAGE_LABELS: Record<PigStage, string> = {
  BOAR: 'Boar',
  SOW: 'Sow',
  GILT: 'Gilt',
  WEANER: 'Weaner',
  PIGLET: 'Piglet',
  PORKER: 'Porker',
  GROWER: 'Grower',
  FINISHER: 'Finisher',
};

const WEANED_DATE_STAGES: readonly PigStage[] = ['WEANER', 'PIGLET', 'GILT', 'GROWER', 'FINISHER'];

const STATUS_LABELS: Record<PigStatus, string> = {
  ACTIVE: 'Active',
  SOLD: 'Sold',
  DECEASED: 'Deceased',
  QUARANTINE: 'Quarantine',
};

const HEALTH_LABELS: Record<HealthStatus, string> = {
  HEALTHY: 'Healthy',
  SICK: 'Sick',
  UNDER_TREATMENT: 'Under treatment',
  RECOVERED: 'Recovered',
};

const pigFormSchema = z.object({
  tagNumber: z
    .string()
    .min(1, 'Tag number is required')
    .max(20, 'Tag number must be at most 20 characters'),
  breed: z.enum(BREEDS),
  stage: z.enum(STAGES),
  dateOfBirth: z.string().optional(),
  acquisitionDate: z.string().min(1, 'Acquisition date is required'),
  entryWeight: z
    .string()
    .min(1, 'Entry weight is required')
    .refine((s) => {
      const n = Number(s);
      return !Number.isNaN(n) && n > 0;
    }, 'Entry weight must be a positive number'),
  status: z.enum(STATUSES),
  healthStatus: z.enum(HEALTH),
  serviced: z.boolean().optional(),
  servicedDate: z.string().optional(),
  weanedDate: z.string().optional(),
  penId: z.string().optional(),
  notes: z.string().max(2000).optional(),
});

type PigFormValues = z.infer<typeof pigFormSchema>;

const defaultValues: PigFormValues = {
  tagNumber: '',
  breed: 'LARGE_WHITE',
  stage: 'GILT',
  dateOfBirth: '',
  acquisitionDate: '',
  entryWeight: '',
  status: 'ACTIVE',
  healthStatus: 'HEALTHY',
  serviced: false,
  servicedDate: '',
  weanedDate: '',
  penId: '',
  notes: '',
};

function toPayload(values: PigFormValues) {
  return {
    tagNumber: values.tagNumber.trim(),
    breed: values.breed,
    stage: values.stage,
    dateOfBirth: values.dateOfBirth?.trim() ? values.dateOfBirth.trim() : null,
    acquisitionDate: values.acquisitionDate,
    entryWeight: Number(values.entryWeight),
    status: values.status,
    healthStatus: values.healthStatus,
    serviced: values.serviced || false,
    servicedDate: values.servicedDate?.trim() ? values.servicedDate.trim() : null,
    weanedDate: values.weanedDate?.trim() ? values.weanedDate.trim() : null,
    penId: values.penId?.trim() ? values.penId.trim() : null,
    notes: values.notes?.trim() ? values.notes.trim() : null,
  };
}

function formatDateInput(iso: string | undefined) {
  if (!iso) return '';
  return iso.slice(0, 10);
}

export default function PigFormPage() {
  const { id: pigId } = useParams<{ id: string }>();
  const isEdit = Boolean(pigId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentFarm } = useFarm();
  const weightUnit = currentFarm?.weightUnit ?? 'kg';

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<PigFormValues>({
    resolver: zodResolver(pigFormSchema),
    defaultValues,
  });

  const watchedStage = useWatch({ control, name: 'stage' });

  const { data: pig, isLoading: pigLoading, isError: pigError, error: pigErr } = useQuery({
    queryKey: ['pig', currentFarm?.id, pigId],
    queryFn: () => pigService.getById(currentFarm!.id, pigId!),
    enabled: !!currentFarm?.id && isEdit,
  });

  const { data: pens = [], isLoading: pensLoading } = useQuery({
    queryKey: ['pens', currentFarm?.id],
    queryFn: () => penService.list(currentFarm!.id),
    enabled: !!currentFarm?.id,
  });

  useEffect(() => {
    if (!pig || !isEdit) return;
    reset({
      tagNumber: pig.tagNumber,
      breed: pig.breed,
      stage: pig.stage,
      dateOfBirth: formatDateInput(pig.dateOfBirth),
      acquisitionDate: formatDateInput(pig.acquisitionDate),
      entryWeight: String(pig.entryWeight),
      status: pig.status,
      healthStatus: pig.healthStatus,
      serviced: pig.serviced ?? false,
      servicedDate: formatDateInput(pig.servicedDate),
      weanedDate: formatDateInput(pig.weanedDate ?? undefined),
      penId: pig.penId ?? '',
      notes: pig.notes ?? '',
    });
  }, [pig, isEdit, reset]);

  const createMutation = useMutation({
    mutationFn: (payload: ReturnType<typeof toPayload>) =>
      pigService.create(currentFarm!.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pigs'] });
      track('pig_created');
      toast.success('Pig added successfully');
      navigate('/pigs');
    },
    onError: (err: unknown) => {
      const res =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { status?: number; data?: { message?: string } } }).response
          : undefined;
      const msg = res?.data?.message;
      if (res?.status === 402) {
        track('plan_limit_hit', { context: 'pig_create' });
        toast.error(
          `${msg || 'Free tier pig limit reached'}. Open Billing in the sidebar to upgrade to Pro.`,
          { duration: 6500 },
        );
        return;
      }
      toast.error(msg || 'Could not create pig');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: ReturnType<typeof toPayload>) =>
      pigService.update(currentFarm!.id, pigId!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pigs'] });
      queryClient.invalidateQueries({ queryKey: ['pig', currentFarm?.id, pigId] });
      toast.success('Pig updated');
      navigate('/pigs');
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error(msg || 'Could not update pig');
    },
  });

  const onSubmit = (values: PigFormValues) => {
    if (!currentFarm) return;
    const payload = toPayload(values);
    if (isEdit) updateMutation.mutate(payload);
    else createMutation.mutate(payload);
  };

  const busy =
    isSubmitting ||
    (isEdit && pigLoading) ||
    createMutation.isPending ||
    updateMutation.isPending;

  if (!currentFarm) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center rounded-2xl border border-gray-200 bg-white p-10 shadow-sm">
        <PiggyBank className="w-14 h-14 text-primary-400 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-gray-900">Select a farm</h2>
        <p className="text-gray-500 mt-2 text-sm">Choose a farm before managing pigs.</p>
        <Link
          to="/farms"
          className="inline-flex mt-6 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition"
        >
          Go to farms
        </Link>
      </div>
    );
  }

  if (isEdit && pigError) {
    return (
      <div className="max-w-lg mx-auto mt-8 rounded-2xl border border-red-100 bg-red-50/80 p-8 text-center">
        <p className="text-red-800 font-medium">Could not load pig</p>
        <p className="text-red-600/80 text-sm mt-2">
          {(pigErr as Error)?.message || 'The pig may have been removed.'}
        </p>
        <button
          type="button"
          onClick={() => navigate('/pigs')}
          className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-primary-700 hover:text-primary-800"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to inventory
        </button>
      </div>
    );
  }

  if (isEdit && pigLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
        <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
        <p className="text-sm text-gray-500">Loading pig…</p>
      </div>
    );
  }

  const inputClass =
    'w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition bg-white';
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1.5';

  return (
    <div className="max-w-3xl mx-auto pb-12">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <div className="rounded-2xl border border-gray-200/80 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-gray-100 bg-gradient-to-r from-primary-50/80 to-white px-6 py-5">
          <h1 className="text-xl font-bold text-gray-900">
            {isEdit ? 'Edit pig' : 'Add new pig'}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isEdit
              ? 'Update details and save changes.'
              : 'Register a pig into your inventory.'}
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="tagNumber" className={labelClass}>
                Tag number <span className="text-red-500">*</span>
              </label>
              <input id="tagNumber" {...register('tagNumber')} className={inputClass} placeholder="e.g. PT-1024" />
              {errors.tagNumber && (
                <p className="text-red-500 text-xs mt-1">{errors.tagNumber.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="breed" className={labelClass}>
                Breed <span className="text-red-500">*</span>
              </label>
              <select id="breed" {...register('breed')} className={inputClass}>
                {BREEDS.map((b) => (
                  <option key={b} value={b}>
                    {BREED_LABELS[b]}
                  </option>
                ))}
              </select>
              {errors.breed && <p className="text-red-500 text-xs mt-1">{errors.breed.message}</p>}
            </div>
            <div>
              <label htmlFor="stage" className={labelClass}>
                Stage <span className="text-red-500">*</span>
              </label>
              <select id="stage" {...register('stage')} className={inputClass}>
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    {STAGE_LABELS[s]}
                  </option>
                ))}
              </select>
              {errors.stage && <p className="text-red-500 text-xs mt-1">{errors.stage.message}</p>}
            </div>

            <div>
              <label htmlFor="dateOfBirth" className={labelClass}>
                Date of birth
              </label>
              <input id="dateOfBirth" type="date" {...register('dateOfBirth')} className={inputClass} />
              {errors.dateOfBirth && (
                <p className="text-red-500 text-xs mt-1">{errors.dateOfBirth.message}</p>
              )}
            </div>
            <div>
              <label htmlFor="acquisitionDate" className={labelClass}>
                Acquisition date <span className="text-red-500">*</span>
              </label>
              <input
                id="acquisitionDate"
                type="date"
                {...register('acquisitionDate')}
                className={inputClass}
              />
              {errors.acquisitionDate && (
                <p className="text-red-500 text-xs mt-1">{errors.acquisitionDate.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="entryWeight" className={labelClass}>
                Entry weight ({weightUnit}) <span className="text-red-500">*</span>
              </label>
              <input
                id="entryWeight"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                {...register('entryWeight')}
                className={inputClass}
              />
              {errors.entryWeight && (
                <p className="text-red-500 text-xs mt-1">{errors.entryWeight.message}</p>
              )}
            </div>
            <div>
              <label htmlFor="penId" className={labelClass}>
                Pen
              </label>
              <select
                id="penId"
                {...register('penId')}
                disabled={pensLoading}
                className={`${inputClass} disabled:opacity-60`}
              >
                <option value="">No pen assigned</option>
                {pens.map((pen) => (
                  <option key={pen.id} value={pen.id}>
                    {pen.name}
                  </option>
                ))}
              </select>
              {errors.penId && <p className="text-red-500 text-xs mt-1">{errors.penId.message}</p>}
            </div>

            <div>
              <label htmlFor="status" className={labelClass}>
                Status
              </label>
              <select id="status" {...register('status')} className={inputClass}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
              {errors.status && <p className="text-red-500 text-xs mt-1">{errors.status.message}</p>}
            </div>
            <div>
              <label htmlFor="healthStatus" className={labelClass}>
                Health status
              </label>
              <select id="healthStatus" {...register('healthStatus')} className={inputClass}>
                {HEALTH.map((h) => (
                  <option key={h} value={h}>
                    {HEALTH_LABELS[h]}
                  </option>
                ))}
              </select>
              {errors.healthStatus && (
                <p className="text-red-500 text-xs mt-1">{errors.healthStatus.message}</p>
              )}
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="flex items-center gap-3">
              <input
                id="serviced"
                type="checkbox"
                {...register('serviced')}
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <label htmlFor="serviced" className="text-sm font-medium text-gray-700">
                Serviced (mated)
              </label>
            </div>
            <div>
              <label htmlFor="servicedDate" className={labelClass}>
                Serviced date
              </label>
              <input id="servicedDate" type="date" {...register('servicedDate')} className={inputClass} />
            </div>
            {WEANED_DATE_STAGES.includes(watchedStage) && (
              <div className="sm:col-span-2">
                <label htmlFor="weanedDate" className={labelClass}>
                  Weaned date
                </label>
                <input id="weanedDate" type="date" {...register('weanedDate')} className={inputClass} />
                <p className="mt-1 text-xs text-gray-500">
                  Used to estimate the return-to-heat window (typically ~4–18 days after weaning).
                </p>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="notes" className={labelClass}>
              Notes
            </label>
            <textarea
              id="notes"
              rows={4}
              {...register('notes')}
              className={`${inputClass} resize-y min-h-[100px]`}
              placeholder="Medical notes, temperament, feed notes…"
            />
            {errors.notes && <p className="text-red-500 text-xs mt-1">{errors.notes.message}</p>}
          </div>

          <div className="flex flex-wrap gap-3 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => navigate(-1)}
              disabled={busy}
              className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-700 transition disabled:opacity-60"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEdit ? 'Save changes' : 'Create pig'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
