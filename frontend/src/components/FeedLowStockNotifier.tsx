import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useFarm } from '../context/FarmContext';
import { feedService } from '../services/feed.service';
import { FEED_TYPE_LABELS } from '../lib/feedUnits';

const storageKey = (farmId: string) => `pigsty-feed-low-stock-toast:${farmId}`;

/**
 * One low-stock notification per farm per browser session when inventory is at or below the threshold.
 */
export function FeedLowStockNotifier() {
  const { currentFarm } = useFarm();
  const farmId = currentFarm?.id;

  const { data } = useQuery({
    queryKey: ['feed-summary', farmId],
    queryFn: () => feedService.getSummary(farmId!),
    enabled: !!farmId,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!farmId || !data) return;
    if (data.lowStockFeedTypes.length === 0) {
      sessionStorage.removeItem(storageKey(farmId));
    }
  }, [farmId, data]);

  useEffect(() => {
    if (!farmId || !data?.lowStockFeedTypes?.length) return;
    if (sessionStorage.getItem(storageKey(farmId))) return;

    const names = data.lowStockFeedTypes.map((t) => FEED_TYPE_LABELS[t] ?? t).join(', ');
    sessionStorage.setItem(storageKey(farmId), '1');

    toast.custom(
      () => (
        <div className="pointer-events-auto max-w-sm rounded-xl border border-amber-200 bg-white p-4 shadow-lg">
          <p className="font-semibold text-gray-900">Low feed stock</p>
          <p className="mt-1 text-sm text-gray-700">
            {names} — at or below {data.lowStockThresholdKg.toFixed(1)} kg (your threshold).
          </p>
          <Link
            to="/feed"
            className="mt-2 inline-block text-sm font-medium text-primary-700 hover:underline"
          >
            Open Feed →
          </Link>
        </div>
      ),
      { duration: 12_000, id: `feed-low-${farmId}` },
    );
  }, [farmId, data]);

  return null;
}
