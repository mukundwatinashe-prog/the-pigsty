import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  PiggyBank,
  Scale,
  Wallet,
  TrendingUp,
  Loader2,
  Info,
  Settings,
  Download,
  FileText,
  Calendar,
} from 'lucide-react';
import { useFarm } from '../../context/FarmContext';
import { farmService } from '../../services/farm.service';
import { reportService } from '../../services/report.service';

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function stageLabel(stage: string) {
  return stage.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function defaultCustomFrom(): string {
  const d = new Date();
  d.setDate(d.getDate() - 29);
  return toYMD(d);
}

type DatePreset = 'all' | 'ytd' | 'month' | '30d' | '7d' | 'custom';

function computePresetRange(preset: Exclude<DatePreset, 'custom'>): { from?: string; to?: string } {
  const today = new Date();
  const todayStr = toYMD(today);
  switch (preset) {
    case 'all':
      return {};
    case 'ytd':
      return { from: `${today.getFullYear()}-01-01`, to: todayStr };
    case 'month':
      return {
        from: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`,
        to: todayStr,
      };
    case '30d': {
      const s = new Date(today);
      s.setDate(s.getDate() - 29);
      return { from: toYMD(s), to: todayStr };
    }
    case '7d': {
      const s = new Date(today);
      s.setDate(s.getDate() - 6);
      return { from: toYMD(s), to: todayStr };
    }
    default:
      return {};
  }
}

function periodLabel(period: { from: string | null; to: string | null }): string {
  if (period.from && period.to) return `${period.from} – ${period.to}`;
  if (period.from) return `From ${period.from}`;
  if (period.to) return `Until ${period.to}`;
  return 'All dates';
}

const PRESETS: { id: DatePreset; label: string }[] = [
  { id: 'all', label: 'All time' },
  { id: 'ytd', label: 'Year to date' },
  { id: 'month', label: 'This month' },
  { id: '30d', label: 'Last 30 days' },
  { id: '7d', label: 'Last 7 days' },
  { id: 'custom', label: 'Custom' },
];

export default function FinancialsPage() {
  const { currentFarm } = useFarm();
  const [exporting, setExporting] = useState<'pdf' | 'xlsx' | null>(null);
  const [preset, setPreset] = useState<DatePreset>('all');
  const [customFrom, setCustomFrom] = useState(defaultCustomFrom);
  const [customTo, setCustomTo] = useState(() => toYMD(new Date()));

  const queryRange = useMemo((): { from?: string; to?: string } | 'INVALID' => {
    if (preset === 'custom') {
      if (!customFrom || !customTo || customFrom > customTo) return 'INVALID';
      return { from: customFrom, to: customTo };
    }
    return computePresetRange(preset);
  }, [preset, customFrom, customTo]);

  const financialsParams = useMemo(() => {
    if (queryRange === 'INVALID') return undefined;
    const p: { from?: string; to?: string } = {};
    if (queryRange.from) p.from = queryRange.from;
    if (queryRange.to) p.to = queryRange.to;
    return Object.keys(p).length ? p : {};
  }, [queryRange]);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['farm-financials', currentFarm?.id, financialsParams?.from ?? '', financialsParams?.to ?? ''],
    queryFn: () => farmService.getFinancials(currentFarm!.id, financialsParams),
    enabled: !!currentFarm?.id && queryRange !== 'INVALID',
  });

  if (!currentFarm) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center text-gray-600">
        <PiggyBank className="mx-auto size-14 text-primary-300" />
        <h2 className="mt-4 text-lg font-semibold text-gray-900">Select a farm</h2>
        <p className="mt-2 text-sm">Choose a farm to view financials.</p>
        <Link to="/farms" className="mt-6 inline-block rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">
          Your farms
        </Link>
      </div>
    );
  }

  const handleExport = async (format: 'pdf' | 'xlsx') => {
    if (!currentFarm || queryRange === 'INVALID') return;
    setExporting(format);
    try {
      await reportService.financials(currentFarm.id, format, financialsParams);
      toast.success(format === 'pdf' ? 'PDF downloaded' : 'Excel downloaded');
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(null);
    }
  };

  const customInvalid = preset === 'custom' && queryRange === 'INVALID';

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financials</h1>
          <p className="mt-1 text-sm text-gray-600">
            Herd value from <strong className="font-medium text-gray-800">current live weights</strong> × your farm’s{' '}
            <strong className="font-medium text-gray-800">price per weight unit</strong>, plus recorded sales.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!!exporting || customInvalid}
              onClick={() => handleExport('xlsx')}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
            >
              {exporting === 'xlsx' ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}
              Export Excel
            </button>
            <button
              type="button"
              disabled={!!exporting || customInvalid}
              onClick={() => handleExport('pdf')}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
            >
              {exporting === 'pdf' ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FileText className="size-4" aria-hidden />}
              Export PDF
            </button>
          </div>
          <Link
            to="/settings"
            className="inline-flex items-center gap-2 self-start sm:self-end rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            <Settings className="size-4" aria-hidden />
            Currency &amp; price in settings
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Calendar className="size-4 text-gray-500 shrink-0" aria-hidden />
          <span className="text-sm font-medium text-gray-800">Sales period</span>
          <span className="text-xs text-gray-500">(herd value is always current inventory)</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {PRESETS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setPreset(id)}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                preset === id
                  ? 'border-primary-600 bg-primary-50 text-primary-900'
                  : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {preset === 'custom' && (
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="fin-from" className="block text-xs font-medium text-gray-600">
                From
              </label>
              <input
                id="fin-from"
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
              />
            </div>
            <div>
              <label htmlFor="fin-to" className="block text-xs font-medium text-gray-600">
                To
              </label>
              <input
                id="fin-to"
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
              />
            </div>
            {customInvalid && <p className="text-sm text-red-600">Choose a valid start and end date.</p>}
          </div>
        )}
      </div>

      {customInvalid ? null : isLoading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="size-10 animate-spin text-primary-600" aria-label="Loading" />
        </div>
      ) : isError || !data ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-800">
          {(error as Error)?.message || 'Could not load financials.'}
        </div>
      ) : (
        <FinancialsBody data={data} periodDescription={periodLabel(data.period)} />
      )}
    </div>
  );
}

function FinancialsBody({
  data,
  periodDescription,
}: {
  data: NonNullable<Awaited<ReturnType<typeof farmService.getFinancials>>>;
  periodDescription: string;
}) {
  const { farm, herd, breakdownByStage, breakdownByPen, salesInPeriod, recentSales } = data;
  const cur = farm.currency;

  return (
    <>
      <div
        className="flex gap-3 rounded-xl border border-primary-100 bg-primary-50/60 px-4 py-3 text-sm text-primary-900"
        role="note"
      >
        <Info className="size-5 shrink-0 text-primary-600" aria-hidden />
        <p>
          <strong className="font-semibold">Herd value:</strong> each pig still on the farm (Active or Quarantine) uses its{' '}
          <strong>current weight</strong>. Value = weight × {formatMoney(farm.pricePerKg, cur)} per {farm.weightUnit}.{' '}
          <strong className="font-semibold">Sales</strong> below use the period you selected above. Change display currency in{' '}
          <Link to="/settings" className="font-medium underline">
            settings
          </Link>
          .
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
            <Wallet className="size-4 text-primary-600" aria-hidden />
            Estimated herd value
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900">{formatMoney(herd.estimatedValueAtFarmPrice, cur)}</p>
          <p className="mt-1 text-xs text-gray-500">Current inventory · farm reference price</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
            <Scale className="size-4 text-primary-600" aria-hidden />
            Total live weight
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900">
            {herd.totalCurrentWeight.toLocaleString(undefined, { maximumFractionDigits: 1 })} {farm.weightUnit}
          </p>
          <p className="mt-1 text-xs text-gray-500">{herd.inventoryHeadcount} head in inventory</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
            <PiggyBank className="size-4 text-primary-600" aria-hidden />
            Avg weight (inventory)
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900">
            {herd.inventoryHeadcount ? herd.avgWeight.toFixed(1) : '—'} {farm.weightUnit}
          </p>
          <p className="mt-1 text-xs text-gray-500">Per pig on farm</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
            <TrendingUp className="size-4 text-primary-600" aria-hidden />
            Reference price
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900">{formatMoney(farm.pricePerKg, cur)}</p>
          <p className="mt-1 text-xs text-gray-500">Per {farm.weightUnit}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-gray-100 bg-gray-50/80 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">Value by stage</h2>
            <p className="text-xs text-gray-500">Current weights × reference price</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-2">Stage</th>
                  <th className="px-4 py-2 text-right">Head</th>
                  <th className="px-4 py-2 text-right">Weight ({farm.weightUnit})</th>
                  <th className="px-4 py-2 text-right">Est. value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {breakdownByStage.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                      No pigs in inventory.{' '}
                      <Link to="/pigs/new" className="font-medium text-primary-600 hover:underline">
                        Add a pig
                      </Link>
                    </td>
                  </tr>
                ) : (
                  breakdownByStage.map((row) => (
                    <tr key={row.stage} className="hover:bg-gray-50/80">
                      <td className="px-4 py-2.5 font-medium text-gray-900">{stageLabel(row.stage)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">{row.count}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">
                        {row.totalWeight.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium text-gray-900">
                        {formatMoney(row.estimatedValue, cur)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-gray-100 bg-gray-50/80 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">Value by pen</h2>
            <p className="text-xs text-gray-500">Current weights × reference price</p>
          </div>
          <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-gray-50 z-10">
                <tr className="border-b border-gray-100 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-2">Pen</th>
                  <th className="px-4 py-2 text-right">Head</th>
                  <th className="px-4 py-2 text-right">Weight</th>
                  <th className="px-4 py-2 text-right">Est. value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {breakdownByPen.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                      No inventory pigs assigned to pens.
                    </td>
                  </tr>
                ) : (
                  breakdownByPen.map((row) => (
                    <tr key={row.penId ?? row.penName} className="hover:bg-gray-50/80">
                      <td className="px-4 py-2.5 font-medium text-gray-900">{row.penName}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">{row.count}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">
                        {row.totalWeight.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium text-gray-900">{formatMoney(row.value, cur)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-gray-100 bg-gray-50/80 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">Sales in selected period</h2>
          <p className="text-xs text-gray-600 mt-0.5">{periodDescription}</p>
        </div>
        <div className="grid gap-4 p-4 sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Revenue</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-gray-900">{formatMoney(salesInPeriod.revenue, cur)}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Sales count</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-gray-900">{salesInPeriod.transactionCount}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Weight sold</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-gray-900">
              {salesInPeriod.totalWeightSold.toLocaleString(undefined, { maximumFractionDigits: 0 })} {farm.weightUnit}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-gray-100 bg-gray-50/80 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">Sales in this period</h2>
          <p className="text-xs text-gray-500">Newest first (up to 40 rows)</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Tag</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2 text-right">Weight</th>
                <th className="px-4 py-2 text-right">Price / {farm.weightUnit}</th>
                <th className="px-4 py-2 text-right">Total</th>
                <th className="px-4 py-2">Buyer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recentSales.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    No sales in this period.
                  </td>
                </tr>
              ) : (
                recentSales.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50/80">
                    <td className="px-4 py-2.5 whitespace-nowrap text-gray-700">
                      {new Date(s.saleDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-gray-900">{s.tagNumber}</td>
                    <td className="px-4 py-2.5 text-gray-600">{s.saleType === 'SLAUGHTER' ? 'Slaughter' : 'Live sale'}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">{s.weightAtSale}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">{formatMoney(s.pricePerKg, cur)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium text-gray-900">{formatMoney(s.totalPrice, cur)}</td>
                    <td className="px-4 py-2.5 text-gray-600">{s.buyer || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
