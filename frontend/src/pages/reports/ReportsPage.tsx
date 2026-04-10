import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ClipboardList,
  TrendingUp,
  ScrollText,
  CalendarDays,
  FileJson,
  FileSpreadsheet,
  FileDown,
  Loader2,
  CheckCircle2,
  DollarSign,
  Wheat,
} from 'lucide-react';
import { useFarm } from '../../context/FarmContext';
import { track } from '../../lib/analytics';
import { reportService } from '../../services/report.service';
import { feedService } from '../../services/feed.service';
import type { Pig } from '../../types';

type ReportId = 'herd_inventory' | 'weight_gain' | 'sales' | 'activity_log' | 'daily_summary';
type FormatId = 'json' | 'pdf' | 'xlsx';

const REPORTS: {
  id: ReportId;
  title: string;
  description: string;
  icon: typeof ClipboardList;
  dateFilter: boolean;
  formats: FormatId[];
}[] = [
  {
    id: 'herd_inventory',
    title: 'Herd inventory',
    description: 'Full list of pigs with breed, stage, weight, status, and pen assignment.',
    icon: ClipboardList,
    dateFilter: false,
    formats: ['json', 'pdf', 'xlsx'],
  },
  {
    id: 'weight_gain',
    title: 'Weight gain',
    description:
      'Per-pig entry vs current weight, ADG vs stage target (green on target, red below), and measurement count.',
    icon: TrendingUp,
    dateFilter: true,
    formats: ['json', 'pdf', 'xlsx'],
  },
  {
    id: 'sales',
    title: 'Sales report',
    description: 'Sales and slaughter history with weights, prices, revenue totals, and buyer details.',
    icon: DollarSign,
    dateFilter: true,
    formats: ['json', 'pdf', 'xlsx'],
  },
  {
    id: 'activity_log',
    title: 'Activity log',
    description: 'Audit trail of actions on the farm (same data as the dedicated audit page).',
    icon: ScrollText,
    dateFilter: false,
    formats: ['json', 'xlsx'],
  },
  {
    id: 'daily_summary',
    title: 'Daily summary',
    description: 'Snapshot for today: pig counts by status, average weight, and activity counts.',
    icon: CalendarDays,
    dateFilter: false,
    formats: ['json', 'pdf'],
  },
];

function isHerdInventoryJson(d: unknown): d is { farm: string; total: number; pigs: Pig[] } {
  return (
    typeof d === 'object' &&
    d !== null &&
    'pigs' in d &&
    Array.isArray((d as { pigs: unknown }).pigs)
  );
}

type WeightGainReportRow = {
  tagNumber: string;
  stage: string;
  entryWeight: number;
  currentWeight: number;
  totalGain: number;
  adg: number;
  targetAdg: number;
  vsTarget: 'on_track' | 'below' | 'n_a';
  measurements: number;
};

function isWeightGainReportArray(d: unknown): d is WeightGainReportRow[] {
  if (!Array.isArray(d) || d.length === 0) return false;
  const r = d[0] as Record<string, unknown>;
  return typeof r === 'object' && r !== null && 'vsTarget' in r && 'tagNumber' in r;
}

function WeightGainReportTable({
  rows,
  weightUnit,
}: {
  rows: WeightGainReportRow[];
  weightUnit: string;
}) {
  return (
    <table className="w-full min-w-[800px] text-left text-sm">
      <thead>
        <tr className="border-b border-gray-200">
          <th className="px-3 py-2 font-semibold text-gray-700">Tag</th>
          <th className="px-3 py-2 font-semibold text-gray-700">Stage</th>
          <th className="px-3 py-2 font-semibold text-gray-700">Entry ({weightUnit})</th>
          <th className="px-3 py-2 font-semibold text-gray-700">Current ({weightUnit})</th>
          <th className="px-3 py-2 font-semibold text-gray-700">Gain</th>
          <th className="px-3 py-2 font-semibold text-gray-700">ADG</th>
          <th className="px-3 py-2 font-semibold text-gray-700">Target ADG</th>
          <th className="px-3 py-2 font-semibold text-gray-700">Vs target</th>
          <th className="px-3 py-2 font-semibold text-gray-700">#</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => {
          const vs = row.vsTarget;
          const vsLabel =
            vs === 'on_track' ? 'On target' : vs === 'below' ? 'Below target' : 'N/A';
          const rowBg =
            vs === 'on_track'
              ? 'bg-emerald-50/70'
              : vs === 'below'
                ? 'bg-red-50/70'
                : '';
          return (
            <tr key={`${row.tagNumber}-${i}`} className={`border-b border-gray-100 hover:bg-gray-50/80 ${rowBg}`}>
              <td className="px-3 py-2 font-medium text-gray-900">{row.tagNumber}</td>
              <td className="px-3 py-2 text-gray-600">{row.stage}</td>
              <td className="px-3 py-2 tabular-nums text-gray-800">{row.entryWeight}</td>
              <td className="px-3 py-2 tabular-nums text-gray-800">{row.currentWeight}</td>
              <td className="px-3 py-2 tabular-nums text-gray-800">{row.totalGain}</td>
              <td className="px-3 py-2 tabular-nums text-gray-800">{row.adg}</td>
              <td className="px-3 py-2 tabular-nums text-gray-600">{row.targetAdg}</td>
              <td
                className={`px-3 py-2 font-medium tabular-nums ${
                  vs === 'on_track' ? 'text-emerald-800' : vs === 'below' ? 'text-red-700' : 'text-gray-500'
                }`}
              >
                {vsLabel}
              </td>
              <td className="px-3 py-2 tabular-nums text-gray-600">{row.measurements}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function isDailySummaryJson(d: unknown): d is {
  date: string;
  totalPigs: number;
  statusBreakdown: Record<string, number>;
  avgWeight: string;
  todayWeightLogs: number;
  todayActivities: number;
} {
  return typeof d === 'object' && d !== null && 'totalPigs' in d && 'statusBreakdown' in d;
}

function isSalesJson(d: unknown): d is {
  currency: string;
  totalSales: number;
  liveSales: number;
  slaughters: number;
  totalRevenue: number;
  totalWeight: number;
  sales: Array<{
    tag: string; breed: string; stage: string; type: string;
    date: string; weight: number; pricePerKg: number; totalPrice: number; buyer: string;
  }>;
} {
  return typeof d === 'object' && d !== null && 'totalSales' in d && 'sales' in d;
}

function isActivityJson(d: unknown): d is {
  data: Array<{
    id: string;
    action: string;
    entity: string;
    entityId: string;
    details?: string | null;
    createdAt: string;
    user?: { name: string };
  }>;
} {
  return typeof d === 'object' && d !== null && 'data' in d && Array.isArray((d as { data: unknown }).data);
}

type FeedExportKey = 'usage-xlsx' | 'usage-pdf' | 'purch-xlsx' | 'purch-pdf';

export default function ReportsPage() {
  const { currentFarm } = useFarm();
  const farmId = currentFarm?.id;

  const [feedExportRange, setFeedExportRange] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [feedExportAnchor, setFeedExportAnchor] = useState(() => new Date().toISOString().slice(0, 10));
  const [feedExporting, setFeedExporting] = useState<FeedExportKey | null>(null);

  const [selectedId, setSelectedId] = useState<ReportId>('herd_inventory');
  const selected = REPORTS.find((r) => r.id === selectedId)!;

  const [format, setFormat] = useState<FormatId>('json');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [jsonResult, setJsonResult] = useState<unknown>(null);

  const params: Record<string, string> = {};
  if (selected.dateFilter) {
    if (dateFrom) params.from = dateFrom;
    if (dateTo) params.to = dateTo;
  }

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!farmId) throw new Error('No farm');
      const fmt = format;
      const reportId = selectedId;
      let data: unknown;
      switch (reportId) {
        case 'herd_inventory':
          data = await reportService.herdInventory(farmId, fmt, params);
          break;
        case 'weight_gain':
          data = await reportService.weightGain(farmId, fmt, params);
          break;
        case 'sales':
          data = await reportService.salesReport(farmId, fmt, params);
          break;
        case 'activity_log':
          data = await reportService.activityLog(farmId, fmt, params);
          break;
        case 'daily_summary':
          data = await reportService.dailySummary(farmId, fmt);
          break;
        default:
          throw new Error('Unknown report');
      }
      return { data, fmt, reportId };
    },
    onSuccess: ({ data, fmt, reportId }) => {
      if (fmt === 'json') {
        setJsonResult(data);
        toast.success('Report loaded');
        track('report_view_json', { report_id: reportId });
      } else {
        setJsonResult(null);
        toast.success('Download started');
        track('report_export', { report_id: reportId, format: fmt });
      }
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error(msg || (err instanceof Error ? err.message : 'Could not generate report'));
    },
  });

  const handleSelectReport = (id: ReportId) => {
    setSelectedId(id);
    const def = REPORTS.find((r) => r.id === id)!;
    if (!def.formats.includes(format)) {
      setFormat(def.formats[0]);
    }
    setJsonResult(null);
  };

  const downloadMutation = useMutation({
    mutationFn: async ({ fmt, reportId }: { fmt: 'pdf' | 'xlsx'; reportId: ReportId }) => {
      if (!farmId) throw new Error('No farm');
      switch (reportId) {
        case 'herd_inventory':
          return reportService.herdInventory(farmId, fmt, params);
        case 'weight_gain':
          return reportService.weightGain(farmId, fmt, params);
        case 'sales':
          return reportService.salesReport(farmId, fmt, params);
        case 'activity_log':
          if (fmt === 'pdf') throw new Error('PDF is not available for activity log');
          return reportService.activityLog(farmId, 'xlsx', params);
        case 'daily_summary':
          if (fmt === 'xlsx') throw new Error('Excel is not available for daily summary');
          return reportService.dailySummary(farmId, 'pdf');
        default:
          throw new Error('Unknown report');
      }
    },
    onSuccess: (_, { fmt, reportId }) => {
      toast.success('Download started');
      track('report_export', { report_id: reportId, format: fmt });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Download failed';
      toast.error(msg);
    },
  });

  const runFeedExport = async (key: FeedExportKey) => {
    if (!farmId) return;
    setFeedExporting(key);
    try {
      if (key === 'usage-xlsx' || key === 'usage-pdf') {
        await feedService.exportReports(farmId, key === 'usage-xlsx' ? 'xlsx' : 'pdf', feedExportRange, feedExportAnchor);
        track('report_export', { report_id: 'feed_usage', format: key === 'usage-xlsx' ? 'xlsx' : 'pdf' });
      } else {
        await feedService.exportPurchaseHistory(farmId, key === 'purch-xlsx' ? 'xlsx' : 'pdf');
        track('report_export', { report_id: 'feed_purchases', format: key === 'purch-xlsx' ? 'xlsx' : 'pdf' });
      }
      toast.success(key.endsWith('xlsx') ? 'Excel downloaded' : 'PDF downloaded');
    } catch {
      toast.error('Feed export failed');
    } finally {
      setFeedExporting(null);
    }
  };

  if (!farmId) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center">
        <ClipboardList className="mx-auto mb-4 size-12 text-gray-300" />
        <h1 className="text-lg font-semibold text-gray-800">Reports</h1>
        <p className="mt-2 text-gray-600">Select a farm to generate reports.</p>
      </div>
    );
  }

  const feedExportBtn =
    'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition disabled:opacity-55';

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Reports</h1>
        <p className="mt-1 text-sm text-gray-600">
          Choose a report, set filters and format, then generate or download · {currentFarm?.name}
        </p>
      </div>

      <div className="mb-8 rounded-2xl border-2 border-emerald-300 bg-emerald-50/40 p-5 shadow-sm ring-1 ring-emerald-100">
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
            <Wheat className="size-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-gray-900">Feed — PDF &amp; Excel</h2>
            <p className="mt-1 text-sm text-gray-700">
              <strong className="font-medium text-gray-900">Period report</strong>: one table — usage and purchases merged, one header row, no duplicate columns.{' '}
              <strong className="font-medium text-gray-900">Purchases</strong> downloads every recorded buy (up to 500) in the same column layout.
            </p>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <div>
                <label htmlFor="reports-feed-range" className="mb-1 block text-xs font-medium text-gray-600">
                  Usage period
                </label>
                <select
                  id="reports-feed-range"
                  value={feedExportRange}
                  onChange={(e) => setFeedExportRange(e.target.value as typeof feedExportRange)}
                  className="rounded-xl border border-emerald-200/80 bg-white px-3 py-2 text-sm"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly (7 days)</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div>
                <label htmlFor="reports-feed-anchor" className="mb-1 block text-xs font-medium text-gray-600">
                  Anchor date
                </label>
                <input
                  id="reports-feed-anchor"
                  type="date"
                  value={feedExportAnchor}
                  onChange={(e) => setFeedExportAnchor(e.target.value)}
                  className="rounded-xl border border-emerald-200/80 bg-white px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={!!feedExporting}
                onClick={() => runFeedExport('usage-xlsx')}
                className={`${feedExportBtn} border border-gray-300 bg-white text-gray-900 hover:bg-gray-50`}
              >
                {feedExporting === 'usage-xlsx' ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FileSpreadsheet className="size-4" aria-hidden />}
                Period · Excel
              </button>
              <button
                type="button"
                disabled={!!feedExporting}
                onClick={() => runFeedExport('usage-pdf')}
                className={`${feedExportBtn} border border-gray-300 bg-white text-gray-900 hover:bg-gray-50`}
              >
                {feedExporting === 'usage-pdf' ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FileDown className="size-4" aria-hidden />}
                Period · PDF
              </button>
              <button
                type="button"
                disabled={!!feedExporting}
                onClick={() => runFeedExport('purch-xlsx')}
                className={`${feedExportBtn} bg-emerald-600 text-white hover:bg-emerald-700`}
              >
                {feedExporting === 'purch-xlsx' ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FileSpreadsheet className="size-4" aria-hidden />}
                Purchases · Excel
              </button>
              <button
                type="button"
                disabled={!!feedExporting}
                onClick={() => runFeedExport('purch-pdf')}
                className={`${feedExportBtn} bg-emerald-600 text-white hover:bg-emerald-700`}
              >
                {feedExporting === 'purch-pdf' ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FileDown className="size-4" aria-hidden />}
                Purchases · PDF
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-600">
              <Link to="/feed/reports" className="font-medium text-emerald-800 underline hover:no-underline">
                Open feed charts page
              </Link>{' '}
              for the same exports with chart view.
            </p>
          </div>
        </div>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {REPORTS.map((r) => {
          const Icon = r.icon;
          const active = selectedId === r.id;
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => handleSelectReport(r.id)}
              className={`flex flex-col rounded-2xl border p-5 text-left transition ${
                active
                  ? 'border-primary-500 bg-primary-50/60 ring-2 ring-primary-200'
                  : 'border-gray-200 bg-white hover:border-primary-200 hover:shadow-sm'
              }`}
            >
              <div
                className={`mb-3 flex size-11 items-center justify-center rounded-xl ${
                  active ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                <Icon className="size-5" />
              </div>
              <h2 className="font-semibold text-gray-900">{r.title}</h2>
              <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-gray-600">{r.description}</p>
              {active && (
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary-700">
                  <CheckCircle2 className="size-3.5" />
                  Selected
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Options</h3>

        {selected.dateFilter && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="rep-from" className="mb-1.5 block text-sm font-medium text-gray-700">
                From
              </label>
              <input
                id="rep-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
              />
            </div>
            <div>
              <label htmlFor="rep-to" className="mb-1.5 block text-sm font-medium text-gray-700">
                To
              </label>
              <input
                id="rep-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
              />
            </div>
          </div>
        )}

        <div className="mt-6">
          <span className="mb-3 block text-sm font-medium text-gray-700">Format</span>
          <div className="flex flex-wrap gap-2">
            {(['json', 'pdf', 'xlsx'] as const).map((f) => {
              const allowed = selected.formats.includes(f);
              const labels = { json: 'JSON (view)', pdf: 'PDF (download)', xlsx: 'Excel (download)' };
              const icons = { json: FileJson, pdf: FileDown, xlsx: FileSpreadsheet };
              const Icon = icons[f];
              return (
                <button
                  key={f}
                  type="button"
                  disabled={!allowed}
                  onClick={() => allowed && setFormat(f)}
                  title={!allowed ? 'Not available for this report' : undefined}
                  className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition ${
                    !allowed
                      ? 'cursor-not-allowed border-gray-100 bg-gray-50 text-gray-400'
                      : format === f
                        ? 'border-primary-500 bg-primary-50 text-primary-900'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-primary-200'
                  }`}
                >
                  <Icon className="size-4" />
                  {labels[f]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={generateMutation.isPending}
            onClick={() => generateMutation.mutate()}
            className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-60"
          >
            {generateMutation.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Generating…
              </>
            ) : (
              'Generate report'
            )}
          </button>

          {format === 'json' && jsonResult != null && selected.formats.includes('pdf') ? (
            <button
              type="button"
              disabled={downloadMutation.isPending}
              onClick={() => downloadMutation.mutate({ fmt: 'pdf', reportId: selectedId })}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50"
            >
              <FileDown className="size-4" />
              Download PDF
            </button>
          ) : null}
          {format === 'json' && jsonResult != null && selected.formats.includes('xlsx') ? (
            <button
              type="button"
              disabled={downloadMutation.isPending}
              onClick={() => downloadMutation.mutate({ fmt: 'xlsx', reportId: selectedId })}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50"
            >
              <FileSpreadsheet className="size-4" />
              Download Excel
            </button>
          ) : null}
        </div>
      </div>

      {format === 'json' && jsonResult !== null && (
        <div className="mt-8 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 bg-gray-50/80 px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-800">Results</h3>
          </div>
          <div className="overflow-x-auto p-4">
            <ReportJsonTable reportId={selectedId} data={jsonResult} weightUnit={currentFarm?.weightUnit ?? 'kg'} />
          </div>
        </div>
      )}
    </div>
  );
}

function ReportJsonTable({
  reportId,
  data,
  weightUnit,
}: {
  reportId: ReportId;
  data: unknown;
  weightUnit: string;
}) {
  if (reportId === 'herd_inventory' && isHerdInventoryJson(data)) {
    return (
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="px-3 py-2 font-semibold text-gray-700">Tag</th>
            <th className="px-3 py-2 font-semibold text-gray-700">Breed</th>
            <th className="px-3 py-2 font-semibold text-gray-700">Stage</th>
            <th className="px-3 py-2 font-semibold text-gray-700">Weight ({weightUnit})</th>
            <th className="px-3 py-2 font-semibold text-gray-700">Status</th>
            <th className="px-3 py-2 font-semibold text-gray-700">Health</th>
            <th className="px-3 py-2 font-semibold text-gray-700">Pen</th>
          </tr>
        </thead>
        <tbody>
          {data.pigs.map((pig) => (
            <tr key={pig.id} className="border-b border-gray-100 hover:bg-gray-50/80">
              <td className="px-3 py-2 font-medium">{pig.tagNumber}</td>
              <td className="px-3 py-2 text-gray-600">{pig.breed}</td>
              <td className="px-3 py-2 text-gray-600">{pig.stage}</td>
              <td className="px-3 py-2 tabular-nums">{Number(pig.currentWeight).toFixed(2)}</td>
              <td className="px-3 py-2">{pig.status}</td>
              <td className="px-3 py-2 text-gray-600">{pig.healthStatus}</td>
              <td className="px-3 py-2 text-gray-600">{pig.pen?.name ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (reportId === 'weight_gain' && Array.isArray(data) && data.length === 0) {
    return <p className="py-8 text-center text-sm text-gray-500">No weight gain rows in this range.</p>;
  }

  if (reportId === 'weight_gain' && isWeightGainReportArray(data)) {
    return <WeightGainReportTable rows={data} weightUnit={weightUnit} />;
  }

  if (reportId === 'activity_log' && isActivityJson(data)) {
    return (
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="px-3 py-2 font-semibold text-gray-700">Date</th>
            <th className="px-3 py-2 font-semibold text-gray-700">User</th>
            <th className="px-3 py-2 font-semibold text-gray-700">Action</th>
            <th className="px-3 py-2 font-semibold text-gray-700">Entity</th>
            <th className="px-3 py-2 font-semibold text-gray-700">Details</th>
          </tr>
        </thead>
        <tbody>
          {data.data.map((row) => (
            <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50/80">
              <td className="px-3 py-2 text-gray-700">
                {new Date(row.createdAt).toLocaleString()}
              </td>
              <td className="px-3 py-2">{row.user?.name ?? '—'}</td>
              <td className="px-3 py-2">{row.action}</td>
              <td className="px-3 py-2">
                {row.entity}
                <span className="ml-1 text-xs text-gray-400">({row.entityId.slice(0, 8)}…)</span>
              </td>
              <td className="max-w-xs truncate px-3 py-2 text-gray-600" title={row.details ?? ''}>
                {row.details ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (reportId === 'sales' && isSalesJson(data)) {
    return (
      <div>
        <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl bg-gray-50 p-3 text-center">
            <p className="text-lg font-bold text-gray-900">{data.totalSales}</p>
            <p className="text-xs text-gray-500">Total Sales</p>
          </div>
          <div className="rounded-xl bg-accent-50 p-3 text-center">
            <p className="text-lg font-bold text-accent-700">{data.liveSales}</p>
            <p className="text-xs text-gray-500">Live Sales</p>
          </div>
          <div className="rounded-xl bg-amber-50 p-3 text-center">
            <p className="text-lg font-bold text-amber-700">{data.slaughters}</p>
            <p className="text-xs text-gray-500">Slaughters</p>
          </div>
          <div className="rounded-xl bg-primary-50 p-3 text-center">
            <p className="text-lg font-bold text-primary-700">{data.currency} {data.totalRevenue.toFixed(2)}</p>
            <p className="text-xs text-gray-500">Total Revenue</p>
          </div>
        </div>
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="px-3 py-2 font-semibold text-gray-700">Tag</th>
              <th className="px-3 py-2 font-semibold text-gray-700">Breed</th>
              <th className="px-3 py-2 font-semibold text-gray-700">Type</th>
              <th className="px-3 py-2 font-semibold text-gray-700">Date</th>
              <th className="px-3 py-2 font-semibold text-gray-700">Weight</th>
              <th className="px-3 py-2 font-semibold text-gray-700">Per kg</th>
              <th className="px-3 py-2 font-semibold text-gray-700">Total</th>
              <th className="px-3 py-2 font-semibold text-gray-700">Buyer</th>
            </tr>
          </thead>
          <tbody>
            {data.sales.map((s, i) => (
              <tr key={i} className="border-b border-gray-100 hover:bg-gray-50/80">
                <td className="px-3 py-2 font-medium">{s.tag}</td>
                <td className="px-3 py-2 text-gray-600">{s.breed}</td>
                <td className="px-3 py-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.type === 'Live Sale' ? 'bg-accent-100 text-accent-800' : 'bg-amber-100 text-amber-800'}`}>
                    {s.type}
                  </span>
                </td>
                <td className="px-3 py-2 text-gray-700">{s.date}</td>
                <td className="px-3 py-2 tabular-nums">{s.weight} {weightUnit}</td>
                <td className="px-3 py-2 tabular-nums">{data.currency} {s.pricePerKg}</td>
                <td className="px-3 py-2 tabular-nums font-medium">{data.currency} {s.totalPrice.toFixed(2)}</td>
                <td className="px-3 py-2 text-gray-600">{s.buyer}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (reportId === 'daily_summary' && isDailySummaryJson(data)) {
    return (
      <table className="w-full max-w-lg text-left text-sm">
        <tbody>
          <tr className="border-b border-gray-100">
            <th className="py-2 pr-4 font-medium text-gray-600">Date</th>
            <td className="py-2">{data.date}</td>
          </tr>
          <tr className="border-b border-gray-100">
            <th className="py-2 pr-4 font-medium text-gray-600">Total pigs</th>
            <td className="py-2 tabular-nums">{data.totalPigs}</td>
          </tr>
          <tr className="border-b border-gray-100">
            <th className="py-2 pr-4 align-top font-medium text-gray-600">By status</th>
            <td className="py-2">
              <ul className="space-y-1">
                {Object.entries(data.statusBreakdown).map(([k, v]) => (
                  <li key={k}>
                    <span className="font-medium">{k}</span>: {v}
                  </li>
                ))}
              </ul>
            </td>
          </tr>
          <tr className="border-b border-gray-100">
            <th className="py-2 pr-4 font-medium text-gray-600">Avg weight ({weightUnit})</th>
            <td className="py-2">{data.avgWeight}</td>
          </tr>
          <tr className="border-b border-gray-100">
            <th className="py-2 pr-4 font-medium text-gray-600">Weight logs today</th>
            <td className="py-2 tabular-nums">{data.todayWeightLogs}</td>
          </tr>
          <tr>
            <th className="py-2 pr-4 font-medium text-gray-600">Activities today</th>
            <td className="py-2 tabular-nums">{data.todayActivities}</td>
          </tr>
        </tbody>
      </table>
    );
  }

  return (
    <pre className="max-h-[480px] overflow-auto rounded-lg bg-gray-900 p-4 text-xs text-gray-100">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}
