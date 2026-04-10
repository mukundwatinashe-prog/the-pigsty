import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Wheat,
  ShoppingCart,
  CalendarClock,
  History,
  Receipt,
  BarChart3,
  AlertTriangle,
  Download,
  FileText,
  Loader2,
  CircleCheck,
} from 'lucide-react';
import { useFarm } from '../../context/FarmContext';
import { feedService } from '../../services/feed.service';
import { FEED_TYPE_LABELS, FEED_TYPES_ORDER } from '../../lib/feedUnits';

/** General reference amounts per pig per day (typical commercial practice). */
const FEEDING_SCHEDULE_ROWS: {
  type: string;
  stage: string;
  timesPerDay: string;
  amountKg: string;
  rowClass: string;
}[] = [
  { type: 'Piglets', stage: '2–8 weeks', timesPerDay: '4–5 times', amountKg: '0.1 – 0.5 kg', rowClass: 'bg-sky-50/80' },
  { type: 'Weaners', stage: '8–12 weeks', timesPerDay: '3–4 times', amountKg: '0.5 – 1.0 kg', rowClass: 'bg-emerald-50/80' },
  { type: 'Growers', stage: '12–20 weeks', timesPerDay: '2–3 times', amountKg: '1.5 – 2.5 kg', rowClass: 'bg-green-100/70' },
  { type: 'Finishers', stage: '20 weeks to market', timesPerDay: '2 times', amountKg: '2.5 – 3.5 kg', rowClass: 'bg-orange-50/80' },
  { type: 'Pregnant sows', stage: 'Gestation', timesPerDay: '2 times', amountKg: '2.0 – 2.5 kg', rowClass: 'bg-purple-50/80' },
  { type: 'Lactating sows', stage: 'After farrowing', timesPerDay: '2–3 times', amountKg: '3.0 – 6.0 kg (or more)', rowClass: 'bg-pink-50/80' },
  { type: 'Boars', stage: 'Mature boars', timesPerDay: '2 times', amountKg: '2.0 – 3.0 kg', rowClass: 'bg-amber-100/70' },
];

const FEEDING_SCHEDULE_NOTES = [
  'Feed at the same time every day',
  'Always provide clean water at all times',
  'Change feed gradually (within 5–7 days)',
  'Clean feeding equipment regularly',
  'Avoid overfeeding or underfeeding',
];

const links = [
  { to: '/feed/purchase', icon: ShoppingCart, label: 'Log purchase', desc: 'Record feed bought (receipt required)' },
  { to: '/feed/daily', icon: CalendarClock, label: "Log today's feed", desc: 'Buckets used per feed type' },
  { to: '/feed/usage-history', icon: History, label: 'Usage history', desc: 'Past daily logs' },
  { to: '/feed/purchases', icon: Receipt, label: 'Purchase history', desc: 'Receipts, who logged each buy, PDF/Excel export' },
  { to: '/feed/reports', icon: BarChart3, label: 'Reports & export', desc: 'Usage charts, period totals, purchases — PDF & Excel' },
];

type ExportKey = 'usage-xlsx' | 'usage-pdf' | 'purch-xlsx' | 'purch-pdf';

export default function FeedDashboardPage() {
  const { currentFarm } = useFarm();
  const navigate = useNavigate();
  const [exportRange, setExportRange] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [exportAnchor, setExportAnchor] = useState(() => new Date().toISOString().slice(0, 10));
  const [exporting, setExporting] = useState<ExportKey | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['feed-summary', currentFarm?.id],
    queryFn: () => feedService.getSummary(currentFarm!.id),
    enabled: !!currentFarm,
  });

  if (!currentFarm) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
        <Wheat className="mb-4 text-gray-300" size={56} />
        <h2 className="mb-2 text-xl font-semibold text-gray-700">No farm selected</h2>
        <button
          type="button"
          onClick={() => navigate('/farms')}
          className="rounded-lg bg-primary-600 px-6 py-2 text-white hover:bg-primary-700"
        >
          Choose a farm
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl border border-gray-100 bg-white" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <p className="text-red-600">Could not load feed data. Try again later.</p>
    );
  }

  const runExport = async (key: ExportKey) => {
    if (!currentFarm) return;
    setExporting(key);
    try {
      if (key === 'usage-xlsx' || key === 'usage-pdf') {
        await feedService.exportReports(currentFarm.id, key === 'usage-xlsx' ? 'xlsx' : 'pdf', exportRange, exportAnchor);
        toast.success(key === 'usage-xlsx' ? 'Excel downloaded' : 'PDF downloaded');
      } else {
        await feedService.exportPurchaseHistory(currentFarm.id, key === 'purch-xlsx' ? 'xlsx' : 'pdf');
        toast.success(key === 'purch-xlsx' ? 'Excel downloaded' : 'PDF downloaded');
      }
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(null);
    }
  };

  const exportBtnClass =
    'inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition disabled:opacity-55';

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Feed</h1>
        <p className="mt-1 text-gray-600">
          Track purchases, stock (50 kg = 3 buckets), daily usage, and costs for this farm. Purchase costs are the same data shown on Financials for matching dates.
        </p>
      </div>

      {data.lowStockFeedTypes.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <AlertTriangle className="mt-0.5 shrink-0" size={22} />
          <div>
            <p className="font-medium">Low stock alert</p>
            <p className="text-sm">
              Below {data.lowStockThresholdKg} kg threshold:{' '}
              {data.lowStockFeedTypes.map((t) => FEED_TYPE_LABELS[t] ?? t).join(', ')}
            </p>
          </div>
        </div>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Live stock</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEED_TYPES_ORDER.map((ft) => {
            const s = data.stock.find((x) => x.feedType === ft);
            if (!s) return null;
            return (
              <div
                key={s.feedType}
                className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm"
              >
                <p className="text-sm font-medium text-gray-500">{FEED_TYPE_LABELS[s.feedType] ?? s.feedType}</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{s.stockKg.toFixed(2)} kg</p>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Spend this month</h2>
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-3xl font-bold text-primary-700">
            {data.currency} {data.monthSpendTotal.toFixed(2)}
          </p>
          <ul className="mt-3 space-y-1 text-sm text-gray-600">
            {data.monthSpendByType.map((row) => (
              <li key={row.feedType} className="flex justify-between gap-4">
                <span>{FEED_TYPE_LABELS[row.feedType] ?? row.feedType}</span>
                <span>
                  {data.currency} {row.spend.toFixed(2)} ({row.kgPurchased.toFixed(1)} kg bought)
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section
        className="rounded-2xl border-2 border-primary-300 bg-gradient-to-br from-primary-50 to-white p-5 shadow-sm ring-1 ring-primary-100"
        aria-labelledby="feed-export-heading"
      >
        <h2 id="feed-export-heading" className="text-lg font-bold text-gray-900">
          Export PDF &amp; Excel
        </h2>
        <p className="mt-1 text-sm text-gray-700">
          <strong className="font-medium text-gray-900">Period feed report</strong> (Excel/PDF): one table — daily usage rows and purchase rows in date order, single set of
          columns (shared Date and Logged by). <strong className="font-medium text-gray-900">All purchases</strong> is a separate file of every buy (up to 500), same column layout.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="feed-dash-export-range" className="mb-1 block text-xs font-medium text-gray-600">
              Usage report period
            </label>
            <select
              id="feed-dash-export-range"
              value={exportRange}
              onChange={(e) => setExportRange(e.target.value as typeof exportRange)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly (7 days)</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <div>
            <label htmlFor="feed-dash-export-anchor" className="mb-1 block text-xs font-medium text-gray-600">
              End / anchor date
            </label>
            <input
              id="feed-dash-export-anchor"
              type="date"
              value={exportAnchor}
              onChange={(e) => setExportAnchor(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={!!exporting}
            onClick={() => runExport('usage-xlsx')}
            className={`${exportBtnClass} bg-white text-gray-900 ring-1 ring-gray-300 hover:bg-gray-50`}
          >
            {exporting === 'usage-xlsx' ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}
            Period report · Excel
          </button>
          <button
            type="button"
            disabled={!!exporting}
            onClick={() => runExport('usage-pdf')}
            className={`${exportBtnClass} bg-white text-gray-900 ring-1 ring-gray-300 hover:bg-gray-50`}
          >
            {exporting === 'usage-pdf' ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FileText className="size-4" aria-hidden />}
            Period report · PDF
          </button>
          <button
            type="button"
            disabled={!!exporting}
            onClick={() => runExport('purch-xlsx')}
            className={`${exportBtnClass} bg-primary-600 text-white hover:bg-primary-700`}
          >
            {exporting === 'purch-xlsx' ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}
            All purchases · Excel
          </button>
          <button
            type="button"
            disabled={!!exporting}
            onClick={() => runExport('purch-pdf')}
            className={`${exportBtnClass} bg-primary-600 text-white hover:bg-primary-700`}
          >
            {exporting === 'purch-pdf' ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FileText className="size-4" aria-hidden />}
            All purchases · PDF
          </button>
        </div>
        <p className="mt-3 text-xs text-gray-600">
          Charts and full-page view:{' '}
          <Link to="/feed/reports" className="font-medium text-primary-700 underline hover:no-underline">
            Feed reports &amp; export
          </Link>
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Quick actions</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {links.map(({ to, icon: Icon, label, desc }) => (
            <Link
              key={to}
              to={to}
              className="flex gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition hover:border-primary-200 hover:bg-primary-50/40"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
                <Icon size={22} />
              </div>
              <div>
                <p className="font-medium text-gray-900">{label}</p>
                <p className="text-sm text-gray-500">{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm" aria-labelledby="feeding-schedule-heading">
        <h2 id="feeding-schedule-heading" className="text-lg font-semibold text-gray-900">
          Pig feeding schedule
        </h2>
        <p className="mt-1 text-sm text-gray-600">Per day (for one pig). General reference — adjust with your vet and genetics.</p>
        <div className="mt-4 overflow-x-auto rounded-xl border border-gray-100">
          <table className="min-w-[36rem] w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th scope="col" className="px-3 py-2.5 font-semibold text-gray-900 sm:px-4">
                  Type of pig
                </th>
                <th scope="col" className="px-3 py-2.5 font-semibold text-gray-900 sm:px-4">
                  Age / stage
                </th>
                <th scope="col" className="px-3 py-2.5 font-semibold text-gray-900 sm:px-4">
                  Feeding times per day
                </th>
                <th scope="col" className="px-3 py-2.5 font-semibold text-gray-900 sm:px-4">
                  Feed per pig (per day)
                </th>
              </tr>
            </thead>
            <tbody>
              {FEEDING_SCHEDULE_ROWS.map((row) => (
                <tr key={row.type} className={`border-b border-gray-100 last:border-0 ${row.rowClass}`}>
                  <th scope="row" className="px-3 py-2.5 font-medium text-gray-900 sm:px-4">
                    {row.type}
                  </th>
                  <td className="px-3 py-2.5 text-gray-700 sm:px-4">{row.stage}</td>
                  <td className="px-3 py-2.5 text-gray-700 sm:px-4">{row.timesPerDay}</td>
                  <td className="px-3 py-2.5 text-gray-700 sm:px-4">{row.amountKg}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 border-t border-gray-100 pt-6">
          <h3 id="feeding-important-notes" className="text-base font-semibold text-gray-900">
            Important notes
          </h3>
          <ul className="mt-3 space-y-2.5 text-sm text-gray-700" aria-labelledby="feeding-important-notes">
            {FEEDING_SCHEDULE_NOTES.map((note) => (
              <li key={note} className="flex gap-2.5">
                <CircleCheck className="mt-0.5 size-4 shrink-0 text-primary-600" aria-hidden />
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
