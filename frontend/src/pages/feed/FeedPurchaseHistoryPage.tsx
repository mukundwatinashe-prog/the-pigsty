import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Download, ExternalLink, FileText, Loader2 } from 'lucide-react';
import { useFarm } from '../../context/FarmContext';
import { feedService } from '../../services/feed.service';
import { FEED_TYPE_LABELS } from '../../lib/feedUnits';

export default function FeedPurchaseHistoryPage() {
  const { currentFarm } = useFarm();
  const [exporting, setExporting] = useState<'pdf' | 'xlsx' | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['feed-purchases', currentFarm?.id],
    queryFn: () => feedService.listPurchases(currentFarm!.id),
    enabled: !!currentFarm,
  });

  if (!currentFarm) {
    return <p className="text-gray-600">Select a farm first.</p>;
  }

  const handleExport = async (format: 'pdf' | 'xlsx') => {
    setExporting(format);
    try {
      await feedService.exportPurchaseHistory(currentFarm.id, format);
      toast.success(format === 'pdf' ? 'PDF downloaded' : 'Excel downloaded');
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-6">
      <Link to="/feed" className="inline-flex items-center gap-1 text-sm font-medium text-primary-700 hover:underline">
        <ArrowLeft size={16} /> Back to feed
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Purchase history</h1>
        <p className="text-sm text-gray-600">
          All feed purchases with receipt access. The same records appear under Financials → Feed purchases when the purchase date falls in your selected sales period.
        </p>
      </div>

      <div className="rounded-xl border border-primary-200 bg-primary-50/50 p-4">
        <p className="mb-3 text-sm font-medium text-gray-900">Export purchase list (PDF or Excel)</p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={!!exporting || isLoading}
            onClick={() => handleExport('xlsx')}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-50"
          >
            {exporting === 'xlsx' ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}
            Export Excel
          </button>
          <button
            type="button"
            disabled={!!exporting || isLoading}
            onClick={() => handleExport('pdf')}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border-2 border-primary-600 bg-white px-4 py-2.5 text-sm font-semibold text-primary-800 shadow-sm hover:bg-primary-50 disabled:opacity-50"
          >
            {exporting === 'pdf' ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FileText className="size-4" aria-hidden />}
            Export PDF
          </button>
          <Link
            to="/feed/reports"
            className="inline-flex min-h-[44px] items-center rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50"
          >
            Usage report + charts
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="h-40 animate-pulse rounded-xl bg-gray-100" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-700">Date</th>
                <th className="px-4 py-3 font-medium text-gray-700">Type</th>
                <th className="px-4 py-3 font-medium text-gray-700">Kg</th>
                <th className="px-4 py-3 font-medium text-gray-700">Cost</th>
                <th className="px-4 py-3 font-medium text-gray-700">Supplier</th>
                <th className="px-4 py-3 font-medium text-gray-700">Logged by</th>
                <th className="px-4 py-3 font-medium text-gray-700">Receipt</th>
              </tr>
            </thead>
            <tbody>
              {data?.purchases.map((p) => (
                <tr key={p.id} className="border-b border-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap">{new Date(p.purchasedAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">{FEED_TYPE_LABELS[p.feedType] ?? p.feedType}</td>
                  <td className="px-4 py-3">{p.quantityKg.toFixed(3)}</td>
                  <td className="px-4 py-3">
                    {currentFarm.currency} {p.totalCost.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{p.supplier ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-700">{p.createdBy?.name?.trim() || '—'}</td>
                  <td className="px-4 py-3">
                    <a
                      href={feedService.receiptUrl(currentFarm.id, p.id)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-primary-600 hover:underline"
                    >
                      View <ExternalLink size={14} />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data?.purchases.length === 0 && (
            <p className="px-4 py-8 text-center text-gray-500">No purchases yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
