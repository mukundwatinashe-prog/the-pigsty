import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useFarm } from '../../context/FarmContext';
import { farmService } from '../../services/farm.service';
import { feedService } from '../../services/feed.service';
import { apiErrorMessage } from '../../services/api';
import { bucketsToKg, FEED_TYPE_LABELS } from '../../lib/feedUnits';
import type { FeedType } from '../../types';

const BUCKET_FIELDS: { key: keyof DailyPayload; feedType: FeedType }[] = [
  { key: 'maizeBuckets', feedType: 'MAIZE_CRECHE' },
  { key: 'soyaBuckets', feedType: 'SOYA' },
  { key: 'premixBuckets', feedType: 'PREMIX' },
  { key: 'concentrateBuckets', feedType: 'CONCENTRATE' },
  { key: 'lactatingBuckets', feedType: 'LACTATING' },
  { key: 'weanerBuckets', feedType: 'WEANER' },
];

type DailyPayload = {
  maizeBuckets: number;
  soyaBuckets: number;
  premixBuckets: number;
  concentrateBuckets: number;
  lactatingBuckets: number;
  weanerBuckets: number;
};

function emptyForm(): Record<keyof DailyPayload, string> {
  return {
    maizeBuckets: '0',
    soyaBuckets: '0',
    premixBuckets: '0',
    concentrateBuckets: '0',
    lactatingBuckets: '0',
    weanerBuckets: '0',
  };
}

function formFromEntry(e: {
  maizeBuckets: number;
  soyaBuckets: number;
  premixBuckets: number;
  concentrateBuckets: number;
  lactatingBuckets?: number;
  weanerBuckets?: number;
}): Record<keyof DailyPayload, string> {
  return {
    maizeBuckets: String(e.maizeBuckets),
    soyaBuckets: String(e.soyaBuckets),
    premixBuckets: String(e.premixBuckets),
    concentrateBuckets: String(e.concentrateBuckets),
    lactatingBuckets: String(e.lactatingBuckets ?? 0),
    weanerBuckets: String(e.weanerBuckets ?? 0),
  };
}

function formFromFarmDefaults(d: Partial<Record<FeedType, number>> | null | undefined): Record<keyof DailyPayload, string> {
  const out = emptyForm();
  if (!d || typeof d !== 'object') return out;
  for (const { key, feedType } of BUCKET_FIELDS) {
    const v = d[feedType];
    out[key] = String(typeof v === 'number' && !Number.isNaN(v) ? v : 0);
  }
  return out;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function isEditableUntil(editableUntil?: string) {
  if (!editableUntil) return true;
  return new Date(editableUntil).getTime() > Date.now();
}

export default function FeedDailyUsagePage() {
  const { currentFarm } = useFarm();
  const qc = useQueryClient();
  const [usageDate, setUsageDate] = useState(todayStr);
  const [form, setForm] = useState(emptyForm);
  const [notes, setNotes] = useState('');

  const { data: farmDetail } = useQuery({
    queryKey: ['farm', currentFarm?.id],
    queryFn: () => farmService.getById(currentFarm!.id),
    enabled: !!currentFarm,
  });

  const { data: existing, isLoading } = useQuery({
    queryKey: ['feed-daily', currentFarm?.id, usageDate],
    queryFn: () => feedService.getDailyByDate(currentFarm!.id, usageDate),
    enabled: !!currentFarm && !!usageDate,
  });

  useEffect(() => {
    const e = existing?.entry;
    if (e) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm(formFromEntry(e));
      setNotes(e.notes ?? '');
      return;
    }
    setForm(formFromFarmDefaults(farmDetail?.farm.feedDefaultDailyBuckets));
    setNotes('');
  }, [existing?.entry, usageDate, farmDetail?.farm.feedDefaultDailyBuckets]);

  const mutation = useMutation({
    mutationFn: () => {
      if (!currentFarm) throw new Error('No farm');
      const body: DailyPayload = {
        maizeBuckets: parseFloat(form.maizeBuckets) || 0,
        soyaBuckets: parseFloat(form.soyaBuckets) || 0,
        premixBuckets: parseFloat(form.premixBuckets) || 0,
        concentrateBuckets: parseFloat(form.concentrateBuckets) || 0,
        lactatingBuckets: parseFloat(form.lactatingBuckets) || 0,
        weanerBuckets: parseFloat(form.weanerBuckets) || 0,
      };
      return feedService.upsertDailyUsage(currentFarm.id, usageDate, {
        ...body,
        notes: notes.trim() || null,
      });
    },
    onSuccess: () => {
      toast.success('Daily usage saved');
      qc.invalidateQueries({ queryKey: ['feed-summary', currentFarm?.id] });
      qc.invalidateQueries({ queryKey: ['feed-daily', currentFarm?.id] });
      qc.invalidateQueries({ queryKey: ['feed-daily-list', currentFarm?.id] });
    },
    onError: (e: unknown) => toast.error(apiErrorMessage(e, 'Could not save')),
  });

  if (!currentFarm) {
    return <p className="text-gray-600">Select a farm first.</p>;
  }

  const editable = !existing?.entry || isEditableUntil(existing.entry.editableUntil);

  const setField = (key: keyof DailyPayload, val: string) => {
    setForm((prev) => ({ ...prev, [key]: val }));
  };

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Link to="/feed" className="inline-flex items-center gap-1 text-sm font-medium text-primary-700 hover:underline">
        <ArrowLeft size={16} /> Back to feed
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Log daily feed usage</h1>
        <p className="mt-1 text-sm text-gray-600">
          50 kg = 3 buckets. Defaults come from Farm settings; you can backdate if you missed a day.
        </p>
      </div>

      {isLoading ? (
        <div className="h-40 animate-pulse rounded-xl bg-gray-100" />
      ) : (
        <form
          className="space-y-4 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
          onSubmit={(e) => {
            e.preventDefault();
            if (!editable) {
              toast.error('This entry can only be edited within 24 hours of submission.');
              return;
            }
            mutation.mutate();
          }}
        >
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Date</label>
            <input
              type="date"
              value={usageDate}
              onChange={(e) => setUsageDate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
            />
          </div>

          {existing?.entry && !editable && (
            <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">
              This log was submitted {new Date(existing.entry.submittedAt).toLocaleString()} and is no longer editable (24-hour window).
            </p>
          )}

          <div className="space-y-3">
            {BUCKET_FIELDS.map(({ key, feedType }) => {
              const b = parseFloat(form[key]) || 0;
              return (
                <div key={key} className="flex flex-wrap items-end gap-2">
                  <div className="min-w-[160px] flex-1">
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      {FEED_TYPE_LABELS[feedType]}
                    </label>
                    <input
                      type="number"
                      step="0.0001"
                      min="0"
                      value={form[key]}
                      onChange={(e) => setField(key, e.target.value)}
                      disabled={!editable}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200 disabled:bg-gray-50"
                    />
                  </div>
                  <p className="pb-2 text-sm text-gray-500">→ {bucketsToKg(b).toFixed(2)} kg</p>
                </div>
              );
            })}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={!editable}
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200 disabled:bg-gray-50"
            />
          </div>

          <button
            type="submit"
            disabled={mutation.isPending || !editable}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 py-2.5 font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {mutation.isPending ? <Loader2 className="animate-spin" size={18} /> : null}
            Submit daily usage
          </button>
        </form>
      )}
    </div>
  );
}
