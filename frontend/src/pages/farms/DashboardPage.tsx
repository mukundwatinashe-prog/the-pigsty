import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  PiggyBank, Warehouse, Scale, Activity, TrendingUp,
  AlertTriangle, Heart, Skull, ShieldAlert, ArrowRight, Baby,
  Upload, Users, FileText, Clock, Stethoscope,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  type PieLabelRenderProps,
} from 'recharts';
import { useFarm } from '../../context/FarmContext';
import { farmService } from '../../services/farm.service';
import { pigService } from '../../services/pig.service';
import type { AuditLog, PigObservation, PigStatus } from '../../types';
import { pigObservationLabel } from '../../lib/pigObservations';

type StatusAggRow = { status: string; _count: number };
type StatusChartRow = { name: string; value: number };

const STATUS_COLORS: Record<PigStatus, string> = {
  ACTIVE: '#22c55e',
  SOLD: '#5bc0eb',
  DECEASED: '#6b7280',
  QUARANTINE: '#ef4444',
};

export default function DashboardPage() {
  const { currentFarm } = useFarm();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ['farm-dashboard', currentFarm?.id],
    queryFn: () => farmService.getById(currentFarm!.id),
    enabled: !!currentFarm,
  });

  const { data: servicedData } = useQuery({
    queryKey: ['serviced-sows', currentFarm?.id],
    queryFn: () => pigService.getServicedSows(currentFarm!.id),
    enabled: !!currentFarm,
  });

  if (!currentFarm) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <PiggyBank className="text-gray-300 mb-4" size={64} />
        <h2 className="text-xl font-semibold text-gray-700 mb-2">No farm selected</h2>
        <p className="text-gray-500 mb-4">Select or create a farm to see your dashboard</p>
        <button onClick={() => navigate('/farms')} className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition">
          Go to Farms
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 rounded w-64 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-6 border border-gray-100 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-20 mb-3" />
              <div className="h-8 bg-gray-200 rounded w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <AlertTriangle className="text-red-500 mx-auto mb-2" size={32} />
        <p className="text-red-700">Failed to load dashboard data</p>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { farm, stats } = data;
  const statusData: StatusChartRow[] = (stats.byStatus || []).map((s: StatusAggRow) => ({
    name: s.status,
    value: s._count,
  }));

  const totalAllStatuses = statusData.reduce((sum, s) => sum + s.value, 0);
  const pigsOnHand = statusData
    .filter((s) => s.name !== 'SOLD' && s.name !== 'DECEASED')
    .reduce((sum, s) => sum + s.value, 0);
  const activePigs = statusData.find((s) => s.name === 'ACTIVE')?.value || 0;
  const deceased = statusData.find((s) => s.name === 'DECEASED')?.value || 0;
  const quarantined = statusData.find((s) => s.name === 'QUARANTINE')?.value || 0;
  const mortalityRate =
    totalAllStatuses > 0 ? ((deceased / totalAllStatuses) * 100).toFixed(1) : '0';

  const soldCount = statusData.find((s) => s.name === 'SOLD')?.value || 0;

  const kpis = [
    { label: 'Pigs on hand', value: pigsOnHand, icon: PiggyBank, color: 'text-primary-600', bg: 'bg-primary-50' },
    { label: 'Active Pigs', value: activePigs, icon: Heart, color: 'text-accent-600', bg: 'bg-accent-50' },
    { label: 'Avg Weight', value: `${Number(stats.avgWeight).toFixed(1)} ${farm.weightUnit}`, icon: Scale, color: 'text-primary-600', bg: 'bg-primary-50' },
    { label: 'Mortality Rate', value: `${mortalityRate}%`, icon: Skull, color: 'text-gray-600', bg: 'bg-gray-50' },
    { label: 'Total Pens', value: farm._count?.pens || 0, icon: Warehouse, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Team Members', value: farm._count?.members || 0, icon: Activity, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Quarantined', value: quarantined, icon: ShieldAlert, color: quarantined > 0 ? 'text-red-600' : 'text-green-600', bg: quarantined > 0 ? 'bg-red-50' : 'bg-green-50' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{farm.name} Dashboard</h1>
        <p className="text-gray-500">{farm.location}, {farm.country} &middot; {farm.currency}</p>
      </div>

      {pigsOnHand === 0 && (
        <div className="rounded-2xl border border-primary-200 bg-gradient-to-br from-primary-50 to-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Get started with your herd</h2>
          <p className="mt-1 text-sm text-gray-600">
            A quick path that works well for small herds: add or import pigs, log a weight, then pull a report for your records or buyer.
          </p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {[
              { to: '/pigs/new', label: 'Add your first pig', icon: PiggyBank },
              { to: '/import', label: 'Or import from our Excel template', icon: Upload },
              { to: '/pens', label: 'Name your pens or sheds', icon: Warehouse },
              { to: '/weights', label: 'Log a weight (even one pig)', icon: Scale },
              { to: '/reports', label: 'Download a PDF or Excel report', icon: FileText },
              { to: '/settings', label: 'Invite family or workers', icon: Users },
            ].map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <Link
                  to={to}
                  className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 text-sm font-medium text-gray-800 shadow-sm transition hover:border-primary-200 hover:bg-primary-50/50"
                >
                  <span className="flex size-9 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  {label}
                  <ArrowRight className="ml-auto size-4 text-gray-400" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-gray-500">
            Tip: use <Link to="/import" className="text-primary-600 hover:underline">Import</Link> if you already keep records in a spreadsheet.
            {' · '}
            <Link to="/billing" className="text-primary-600 hover:underline">Billing</Link>
            {' '}
            if you need more than the Free pig limit.
          </p>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-500">{label}</span>
              <div className={`w-9 h-9 ${bg} rounded-lg flex items-center justify-center`}>
                <Icon size={18} className={color} />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
          </div>
        ))}

        <Link
          to="/pigs?status=SOLD"
          className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition cursor-pointer block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
          aria-label="View sold pigs in inventory"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-500">Sold</span>
            <div className="w-9 h-9 bg-primary-50 rounded-lg flex items-center justify-center">
              <TrendingUp size={18} className="text-primary-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{soldCount}</p>
          <p className="text-xs text-primary-600 mt-1 font-medium">Open inventory →</p>
        </Link>

        {/* Serviced Sows KPI */}
        <div
          onClick={() => navigate('/serviced-sows')}
          className="bg-white rounded-xl p-5 border border-primary-100 shadow-sm hover:shadow-md transition cursor-pointer"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-500">Serviced Sows</span>
            <div className="w-9 h-9 bg-primary-50 rounded-lg flex items-center justify-center">
              <Baby size={18} className="text-primary-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{servicedData?.totalServiced ?? 0}</p>
          {servicedData?.nearestBirth ? (
            <p className="text-xs text-primary-600 mt-1 truncate">
              Next birth: {new Date(servicedData.nearestBirth.expectedBirthDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
              {' '}({servicedData.nearestBirth.daysUntilBirth}d)
            </p>
          ) : (
            <p className="text-xs text-gray-400 mt-1">No upcoming births</p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Stethoscope className="size-4 text-primary-600 shrink-0" aria-hidden />
            Pig health observations
          </h3>
          <Link
            to="/pigs"
            className="text-xs font-medium text-primary-600 hover:underline"
          >
            Log from inventory
          </Link>
        </div>
        {(() => {
          const obsList: PigObservation[] = stats.recentPigObservations ?? [];
          if (obsList.length === 0) {
            return (
              <p className="text-sm text-gray-500 py-6 text-center">
                No observations yet. Open{' '}
                <Link to="/pigs" className="font-medium text-primary-600 hover:underline">
                  Pig inventory
                </Link>
                , use the observation action on a row, and choose a category (plus optional notes).
              </p>
            );
          }
          return (
            <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100 max-h-[min(24rem,50vh)] overflow-y-auto">
              {obsList.map((o) => (
                <li key={o.id} className="px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        to={`/pigs/${o.pig?.id ?? o.pigId}`}
                        className="font-mono font-semibold text-primary-700 hover:underline"
                      >
                        {o.pig?.tagNumber ?? o.pigId.slice(0, 8)}
                      </Link>
                      <span className="text-gray-400 mx-1.5">·</span>
                      <span className="font-medium text-gray-800">{pigObservationLabel(o.category)}</span>
                    </div>
                    <time className="text-xs text-gray-400 shrink-0 tabular-nums" dateTime={o.createdAt}>
                      {new Date(o.createdAt).toLocaleString()}
                    </time>
                  </div>
                  {o.notes ? (
                    <p className="mt-1.5 text-gray-600 text-xs sm:text-sm whitespace-pre-wrap break-words">
                      {o.notes}
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-gray-400">
                    Logged by {o.user?.name ?? '—'}
                  </p>
                </li>
              ))}
            </ul>
          );
        })()}
      </div>

      {(() => {
        const reminderSows =
          servicedData?.sows?.filter((s) => s.needsHeatCheck || s.needsPreFarrowPrep) ?? [];
        if (reminderSows.length === 0) return null;
        return (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-amber-950 flex items-center gap-2 mb-3">
              <Clock className="size-4 shrink-0" aria-hidden />
              Breeding reminders (gilts & serviced sows)
            </h3>
            <ul className="divide-y divide-amber-200/80 rounded-xl border border-amber-200/60 bg-white/80">
              {reminderSows.slice(0, 12).map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-sm">
                  <Link to={`/pigs/${s.id}`} className="font-mono font-semibold text-primary-700 hover:underline">
                    {s.tagNumber}
                  </Link>
                  {s.needsHeatCheck && (
                    <span className="rounded-md bg-primary-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary-800">
                      Day 21 heat check
                    </span>
                  )}
                  {s.needsPreFarrowPrep && (
                    <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-900">
                      Day 100 / pre-farrow
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {reminderSows.length > 12 && (
              <p className="mt-2 text-xs text-amber-900/80">
                +{reminderSows.length - 12} more — open{' '}
                <Link to="/serviced-sows" className="font-medium underline hover:no-underline">
                  Serviced sows
                </Link>
              </p>
            )}
          </div>
        );
      })()}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution Pie Chart */}
        <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Herd Status Distribution</h3>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  label={(props: PieLabelRenderProps) =>
                    `${props.name ?? ''}: ${Number(props.value ?? 0)}`
                  }
                >
                  {statusData.map((entry, index) => (
                    <Cell key={index} fill={STATUS_COLORS[entry.name as PigStatus] ?? '#9ca3af'} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-gray-400">
              <p>No pig data yet</p>
            </div>
          )}
        </div>

        {/* Status Bar Chart */}
        <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Pigs by Status</h3>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={statusData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {statusData.map((entry, index) => (
                    <Cell key={index} fill={STATUS_COLORS[entry.name as PigStatus] ?? '#9ca3af'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-gray-400">
              <p>No pig data yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Quick Actions</h3>
          <div className="space-y-2">
            {[
              { label: 'Add a Pig', to: '/pigs/new' },
              { label: 'Log Weights', to: '/weights' },
              { label: 'Import Pigs', to: '/import' },
              { label: 'View Reports', to: '/reports' },
              { label: 'Manage Pens', to: '/pens' },
            ].map(({ label, to }) => (
              <button
                key={to}
                onClick={() => navigate(to)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition"
              >
                {label}
                <ArrowRight size={16} className="text-gray-400" />
              </button>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Recent Activity</h3>
          {stats.recentActivity?.length > 0 ? (
            <div className="space-y-3 max-h-[320px] overflow-y-auto">
              {stats.recentActivity.map((activity: AuditLog) => (
                <div key={activity.id} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-xs font-medium text-gray-600 shrink-0">
                    {activity.user?.name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-gray-800">
                      <span className="font-medium">{activity.user?.name}</span>{' '}
                      <span className="text-gray-500">{activity.action.toLowerCase()}</span>{' '}
                      <span className="font-medium">{activity.entity}</span>
                    </p>
                    {activity.details && (
                      <p className="text-xs text-gray-400 truncate">{activity.details}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(activity.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center text-gray-400 text-sm">
              No activity recorded yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
