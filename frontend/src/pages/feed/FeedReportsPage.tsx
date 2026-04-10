import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Download, FileText, Loader2 } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useFarm } from '../../context/FarmContext';
import { feedService } from '../../services/feed.service';
import { FEED_TYPE_LABELS } from '../../lib/feedUnits';
import type { FeedType } from '../../types';

type ReportSeries = {
  range: string;
  series: { date: string; byType: Record<FeedType, number> }[];
  totalsKg: { feedType: FeedType; kg: number }[];
};

const COLORS: Record<FeedType, string> = {
  MAIZE_CRECHE: '#16a34a',
  SOYA: '#ca8a04',
  PREMIX: '#2563eb',
  CONCENTRATE: '#9333ea',
  LACTATING: '#db2777',
  WEANER: '#0d9488',
};

const KEYS: FeedType[] = ['MAIZE_CRECHE', 'SOYA', 'PREMIX', 'CONCENTRATE', 'LACTATING', 'WEANER'];

export default function FeedReportsPage() {
  const { currentFarm } = useFarm();
  const [range, setRange] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [anchor, setAnchor] = useState(() => new Date().toISOString().slice(0, 10));
  const [filterType, setFilterType] = useState<FeedType | 'ALL'>('ALL');
  const [exporting, setExporting] = useState<'pdf' | 'xlsx' | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['feed-reports', currentFarm?.id, range, anchor],
    queryFn: () => feedService.getReports(currentFarm!.id, range, anchor) as Promise<ReportSeries>,
    enabled: !!currentFarm,
  });

  const chartData = useMemo(() => {
    if (!data?.series) return [];
    return data.series.map((row) => {
      const out: Record<string, string | number> = { date: row.date };
      for (const k of KEYS) {
        if (filterType === 'ALL' || filterType === k) {
          out[FEED_TYPE_LABELS[k]] = row.byType[k];
        }
      }
      return out;
    });
  }, [data?.series, filterType]);

  const barKeys =
    filterType === 'ALL'
      ? KEYS.map((k) => FEED_TYPE_LABELS[k])
      : [FEED_TYPE_LABELS[filterType]];

  const { data: costData } = useQuery({
    queryKey: ['feed-costs', currentFarm?.id],
    queryFn: () => feedService.getCosts(currentFarm!.id) as Promise<{
      totalSpend: number;
      byType: { feedType: FeedType; totalSpend: number; totalKg: number; avgCostPerKg: number }[];
    }>,
    enabled: !!currentFarm,
  });

  const handleExport = async (format: 'pdf' | 'xlsx') => {
    if (!currentFarm) return;
    setExporting(format);
    try {
      await feedService.exportReports(currentFarm.id, format, range, anchor);
      toast.success(format === 'pdf' ? 'PDF downloaded' : 'Excel downloaded');
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(null);
    }
  };

  if (!currentFarm) {
    return <p className="text-gray-600">Select a farm first.</p>;
  }

  return (
    <div className="space-y-8">
      <Link to="/feed" className="inline-flex items-center gap-1 text-sm font-medium text-primary-700 hover:underline">
        <ArrowLeft size={16} /> Back to feed
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Feed reports & export</h1>
        <p className="text-sm text-gray-600">
          Usage (kg) from daily logs (50 kg = 3 buckets). PDF and Excel use one combined table: daily usage and purchases in the period, sorted by date, with a single header (shared Date and Logged by columns).
        </p>
      </div>

      <div className="rounded-xl border border-primary-200 bg-primary-50/50 p-4">
        <p className="mb-3 text-sm font-medium text-gray-900">Download one combined report for this period (usage + purchases, one table)</p>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={range}
            onChange={(e) => setRange(e.target.value as typeof range)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly (7 days)</option>
            <option value="monthly">Monthly</option>
          </select>
          <input
            type="date"
            value={anchor}
            onChange={(e) => setAnchor(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
          />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as typeof filterType)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
          >
            <option value="ALL">All feed types</option>
            {KEYS.map((k) => (
              <option key={k} value={k}>
                {FEED_TYPE_LABELS[k]}
              </option>
            ))}
          </select>
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
        </div>
        <p className="mt-2 text-xs text-gray-600">
          Chart filter above only affects the graph. Exports include all feed-type columns for the period; purchase rows use Purchase feed / qty / cost columns only.
        </p>
      </div>

      {isLoading ? (
        <div className="h-72 animate-pulse rounded-xl bg-gray-100" />
      ) : (
        <>
          <div className="h-80 w-full rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} label={{ value: 'kg', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                {filterType === 'ALL' ? <Legend /> : null}
                {barKeys.map((name) => {
                  const k = KEYS.find((x) => FEED_TYPE_LABELS[x] === name);
                  return (
                    <Bar
                      key={name}
                      dataKey={name}
                      fill={k ? COLORS[k] : '#888'}
                      stackId={filterType === 'ALL' ? 'a' : undefined}
                    />
                  );
                })}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {data && (
            <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <h2 className="mb-2 font-semibold text-gray-900">Period totals (kg)</h2>
              <ul className="space-y-1 text-sm">
                {data.totalsKg.map((t) => (
                  <li key={t.feedType} className="flex justify-between gap-4">
                    <span>{FEED_TYPE_LABELS[t.feedType]}</span>
                    <span>{t.kg.toFixed(3)} kg</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {costData && (
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <h2 className="mb-2 font-semibold text-gray-900">Cost tracker (all time)</h2>
          <p className="mb-2 text-lg font-bold text-primary-700">
            {currentFarm.currency} {costData.totalSpend.toFixed(2)} total spend
          </p>
          <ul className="space-y-1 text-sm text-gray-700">
            {costData.byType.map((row) => (
              <li key={row.feedType} className="flex flex-wrap justify-between gap-2 border-b border-gray-50 py-1">
                <span>{FEED_TYPE_LABELS[row.feedType]}</span>
                <span>
                  {currentFarm.currency} {row.totalSpend.toFixed(2)} · {row.totalKg.toFixed(1)} kg ·{' '}
                  {currentFarm.currency} {row.avgCostPerKg.toFixed(2)}/kg avg
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
