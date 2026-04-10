import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useFarm } from '../../context/FarmContext';
import { feedService } from '../../services/feed.service';
export default function FeedUsageHistoryPage() {
  const { currentFarm } = useFarm();

  const { data, isLoading } = useQuery({
    queryKey: ['feed-daily-list', currentFarm?.id],
    queryFn: () => feedService.listDailyUsage(currentFarm!.id),
    enabled: !!currentFarm,
  });

  if (!currentFarm) {
    return <p className="text-gray-600">Select a farm first.</p>;
  }

  return (
    <div className="space-y-6">
      <Link to="/feed" className="inline-flex items-center gap-1 text-sm font-medium text-primary-700 hover:underline">
        <ArrowLeft size={16} /> Back to feed
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Usage history</h1>
        <p className="text-sm text-gray-600">Daily bucket usage per feed type.</p>
      </div>

      {isLoading ? (
        <div className="h-40 animate-pulse rounded-xl bg-gray-100" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-700">Date</th>
                <th className="px-4 py-3 font-medium text-gray-700">Maize</th>
                <th className="px-4 py-3 font-medium text-gray-700">Soya</th>
                <th className="px-4 py-3 font-medium text-gray-700">Premix</th>
                <th className="px-4 py-3 font-medium text-gray-700">Conc.</th>
                <th className="px-4 py-3 font-medium text-gray-700">Lact.</th>
                <th className="px-4 py-3 font-medium text-gray-700">Wean.</th>
                <th className="px-4 py-3 font-medium text-gray-700">Logged by</th>
              </tr>
            </thead>
            <tbody>
              {data?.entries.map((e) => (
                <tr key={e.id} className="border-b border-gray-50">
                  <td className="px-4 py-3">{e.usageDate}</td>
                  <td className="px-4 py-3">{e.maizeBuckets}</td>
                  <td className="px-4 py-3">{e.soyaBuckets}</td>
                  <td className="px-4 py-3">{e.premixBuckets}</td>
                  <td className="px-4 py-3">{e.concentrateBuckets}</td>
                  <td className="px-4 py-3">{e.lactatingBuckets}</td>
                  <td className="px-4 py-3">{e.weanerBuckets}</td>
                  <td className="px-4 py-3 text-gray-600">{e.user.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data?.entries.length === 0 && (
            <p className="px-4 py-8 text-center text-gray-500">No usage logs yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
