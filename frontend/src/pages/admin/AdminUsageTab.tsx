import { Activity, Coins, Cpu, Loader2 } from 'lucide-react';
import type { AdminUsage } from '../../services/admin.service';

const fmtNum = (n: number) => n.toLocaleString();
const fmtCost = (n: number) => `$${n.toFixed(n > 0 && n < 1 ? 4 : 2)}`;

const PERIODS: { key: 'last7d' | 'last30d' | 'allTime'; label: string }[] = [
  { key: 'last7d', label: 'Last 7 days' },
  { key: 'last30d', label: 'Last 30 days' },
  { key: 'allTime', label: 'All time' },
];

/** Admin AI-usage monitoring: requests, tokens and cost (the metered/billable resource). */
export default function AdminUsageTab({ usage, loading }: { usage?: AdminUsage; loading: boolean }) {
  if (loading || !usage) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-gray-500">
        <Loader2 className="size-5 animate-spin" /> Loading usage…
      </div>
    );
  }

  const { ai } = usage;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">AI assistant usage</h2>
        <p className="mt-1 text-sm text-gray-600">
          Token and cost consumption for the Claude-powered assistant — the metered resource you pay
          for. Use this to watch spend and spot heavy users.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {PERIODS.map((p) => {
          const b = ai[p.key];
          return (
            <div key={p.key} className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{p.label}</p>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="flex items-center gap-1.5 text-gray-500"><Activity className="size-4" /> Requests</dt>
                  <dd className="font-semibold text-gray-900">{fmtNum(b.requests)}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="flex items-center gap-1.5 text-gray-500"><Cpu className="size-4" /> Tokens</dt>
                  <dd className="font-semibold text-gray-900">{fmtNum(b.tokens)}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="flex items-center gap-1.5 text-gray-500"><Coins className="size-4" /> Cost</dt>
                  <dd className="font-semibold text-gray-900">{fmtCost(b.cost)}</dd>
                </div>
              </dl>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">Top consumers (all time)</h3>
        {ai.topUsers.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-500">No AI usage recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="py-2 pr-4 font-medium">User</th>
                  <th className="py-2 pr-4 text-right font-medium">Requests</th>
                  <th className="py-2 pr-4 text-right font-medium">Tokens</th>
                  <th className="py-2 text-right font-medium">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {ai.topUsers.map((u) => (
                  <tr key={u.userId}>
                    <td className="py-2 pr-4">
                      <div className="font-medium text-gray-900">{u.name}</div>
                      <div className="text-xs text-gray-500">{u.email}</div>
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums text-gray-700">{fmtNum(u.requests)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-gray-900">{fmtNum(u.tokens)}</td>
                    <td className="py-2 text-right tabular-nums text-gray-900">{fmtCost(u.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">Recent AI activity</h3>
        {ai.recent.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-500">No recent AI requests.</p>
        ) : (
          <ul className="divide-y divide-gray-50 text-sm">
            {ai.recent.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <span className="font-medium text-gray-900">{r.userName}</span>
                  <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-600">
                    {r.endpoint}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span className="tabular-nums">{fmtNum(r.tokens)} tok</span>
                  <span className="tabular-nums">{fmtCost(r.cost)}</span>
                  <span>{new Date(r.createdAt).toLocaleString()}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
