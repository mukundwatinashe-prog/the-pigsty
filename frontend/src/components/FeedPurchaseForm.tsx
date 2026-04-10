import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import { feedService } from '../services/feed.service';
import { farmService } from '../services/farm.service';
import { apiErrorMessage } from '../services/api';
import type { FeedType } from '../types';
import { FEED_TYPE_LABELS, FEED_TYPES_ORDER } from '../lib/feedUnits';
import { feedPriceUnitLabel, previewFeedPurchaseCost, type FeedPurchasePriceUnit } from '../lib/feedPurchasePricing';
import { Link } from 'react-router-dom';

type Props = {
  farmId: string;
  currency: string;
  /** Called after a successful save (after shared cache invalidation). */
  onSaved?: () => void;
  /** Tighter layout when embedded on Financials, etc. */
  variant?: 'page' | 'embedded';
};

export function FeedPurchaseForm({ farmId, currency, onSaved, variant = 'page' }: Props) {
  const qc = useQueryClient();
  const [feedType, setFeedType] = useState<FeedType>('MAIZE_CRECHE');
  const [quantityKg, setQuantityKg] = useState('');
  const [supplier, setSupplier] = useState('');
  const [purchasedAt, setPurchasedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [file, setFile] = useState<File | null>(null);

  const { data: farmDetail, isLoading: farmLoading } = useQuery({
    queryKey: ['farm', farmId],
    queryFn: () => farmService.getById(farmId),
    enabled: !!farmId,
  });

  const farm = farmDetail?.farm;
  const priceUnit: FeedPurchasePriceUnit = farm?.feedPurchasePriceUnit === 'TONNE' ? 'TONNE' : 'KG';
  const prices = farm?.feedPurchasePrices;

  const previewCost = useMemo(() => {
    const q = parseFloat(quantityKg);
    return previewFeedPurchaseCost(q, feedType, priceUnit, prices);
  }, [quantityKg, feedType, priceUnit, prices]);

  const mutation = useMutation({
    mutationFn: async () => {
      const q = parseFloat(quantityKg);
      if (!Number.isFinite(q) || q <= 0) throw new Error('Enter a valid quantity (kg)');
      if (!file) throw new Error('Receipt is required');
      if (previewCost === null) {
        throw new Error(
          `Set a ${feedPriceUnitLabel(priceUnit)} price for ${FEED_TYPE_LABELS[feedType]} in Farm settings.`,
        );
      }
      return feedService.createPurchase(
        farmId,
        {
          feedType,
          quantityKg: q,
          supplier: supplier.trim() || null,
          purchasedAt: new Date(purchasedAt + 'T12:00:00.000Z').toISOString(),
        },
        file,
      );
    },
    onSuccess: () => {
      toast.success('Purchase saved');
      qc.invalidateQueries({ queryKey: ['feed-summary', farmId] });
      qc.invalidateQueries({ queryKey: ['feed-purchases', farmId] });
      qc.invalidateQueries({ queryKey: ['feed-costs', farmId] });
      qc.invalidateQueries({ queryKey: ['farm-financials', farmId] });
      setQuantityKg('');
      setSupplier('');
      setFile(null);
      onSaved?.();
    },
    onError: (e: unknown) => toast.error(apiErrorMessage(e, 'Could not save purchase')),
  });

  const formClass =
    variant === 'embedded'
      ? 'space-y-4 rounded-xl border border-gray-200 bg-gray-50/50 p-4'
      : 'space-y-4 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm';

  if (farmLoading) {
    return (
      <div className={formClass}>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="size-4 animate-spin" />
          Loading farm pricing…
        </div>
      </div>
    );
  }

  return (
    <form
      className={formClass}
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <p className="rounded-lg border border-primary-100 bg-primary-50/80 px-3 py-2 text-xs text-primary-900">
        Total cost is calculated from{' '}
        <Link to="/settings" className="font-medium underline hover:no-underline">
          Farm settings → Feed purchase prices
        </Link>{' '}
        ({feedPriceUnitLabel(priceUnit)}). You only enter quantity (kg) and upload the receipt.
      </p>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Feed type</label>
        <select
          value={feedType}
          onChange={(e) => setFeedType(e.target.value as FeedType)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
        >
          {FEED_TYPES_ORDER.map((t) => (
            <option key={t} value={t}>
              {FEED_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Quantity (kg)</label>
        <input
          type="number"
          step="0.001"
          min="0"
          value={quantityKg}
          onChange={(e) => setQuantityKg(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
          required
        />
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
        <p className="text-xs font-medium text-gray-500">Calculated total</p>
        <p className="text-lg font-semibold text-gray-900">
          {previewCost !== null ? (
            <>
              {currency} {previewCost.toFixed(2)}
            </>
          ) : (
            <span className="text-amber-800">Set a price for this feed type in settings</span>
          )}
        </p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Supplier (optional)</label>
        <input
          type="text"
          value={supplier}
          onChange={(e) => setSupplier(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Purchase date</label>
        <input
          type="date"
          value={purchasedAt}
          onChange={(e) => setPurchasedAt(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
          required
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Receipt (required)</label>
        <input
          type="file"
          accept="image/*,application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-primary-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-700"
          required
        />
      </div>

      <button
        type="submit"
        disabled={mutation.isPending || previewCost === null}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 py-2.5 font-medium text-white hover:bg-primary-700 disabled:opacity-50"
      >
        {mutation.isPending ? <Loader2 className="animate-spin" size={18} /> : null}
        Save purchase
      </button>
    </form>
  );
}
