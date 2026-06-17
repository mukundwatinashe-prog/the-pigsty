import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Download,
  Loader2,
  LogOut,
  RefreshCw,
  Search,
  Trash2,
  Unlock,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  adminService,
  type AdminPlanFilter,
  type AdminUser,
  type FarmPlan,
} from '../../services/admin.service';
import { apiErrorMessage } from '../../services/api';

const PLAN_FILTERS: { id: AdminPlanFilter; label: string }[] = [
  { id: 'ALL', label: 'All users' },
  { id: 'FREE', label: 'Smallholder (free)' },
  { id: 'GROWER', label: 'Grower' },
  { id: 'ENTERPRISE', label: 'Enterprise' },
];

function planLabel(plan: FarmPlan): string {
  if (plan === 'FREE') return 'Smallholder';
  if (plan === 'GROWER') return 'Grower';
  return 'Enterprise';
}

function planBadgeClass(plan: FarmPlan): string {
  if (plan === 'ENTERPRISE') return 'bg-purple-100 text-purple-800 border-purple-200';
  if (plan === 'GROWER') return 'bg-blue-100 text-blue-800 border-blue-200';
  return 'bg-gray-100 text-gray-700 border-gray-200';
}

function isLocked(user: AdminUser): boolean {
  const now = Date.now();
  return (
    (user.loginLockedUntil != null && new Date(user.loginLockedUntil).getTime() > now) ||
    (user.passwordResetLockedUntil != null && new Date(user.passwordResetLockedUntil).getTime() > now)
  );
}

function UserDetailPanel({
  user,
  onClose,
  onDeleted,
}: {
  user: AdminUser;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone ?? '');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [showDelete, setShowDelete] = useState(false);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['admin-users'] });
    void qc.invalidateQueries({ queryKey: ['admin-summary'] });
  };

  const unlock = useMutation({
    mutationFn: () => adminService.unlockUser(user.id),
    onSuccess: () => { invalidate(); toast.success('Account unlocked'); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const logout = useMutation({
    mutationFn: () => adminService.forceLogout(user.id),
    onSuccess: () => { toast.success('User signed out on all devices'); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const resetTrial = useMutation({
    mutationFn: () => adminService.resetGrowerTrial(user.id),
    onSuccess: () => { invalidate(); toast.success('Grower trial reset'); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const saveProfile = useMutation({
    mutationFn: () => adminService.updateUser(user.id, { name, phone: phone || null }),
    onSuccess: () => { invalidate(); toast.success('Profile updated'); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const setPlan = useMutation({
    mutationFn: ({ farmId, plan }: { farmId: string; plan: FarmPlan }) =>
      adminService.setFarmPlan(farmId, plan),
    onSuccess: () => { invalidate(); toast.success('Farm plan updated'); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const deleteUser = useMutation({
    mutationFn: () => adminService.deleteUser(user.id, confirmEmail),
    onSuccess: () => {
      invalidate();
      toast.success('Account deleted');
      onDeleted();
      onClose();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{user.name}</h2>
            <p className="text-sm text-gray-500">{user.email}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm">
              <p className="text-xs text-gray-500">Joined</p>
              <p className="font-medium text-gray-900">{new Date(user.createdAt).toLocaleString()}</p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm">
              <p className="text-xs text-gray-500">Highest owned plan</p>
              <span className={`mt-0.5 inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${planBadgeClass(user.highestOwnedPlan)}`}>
                {planLabel(user.highestOwnedPlan)}
              </span>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm">
              <p className="text-xs text-gray-500">MFA</p>
              <p className="font-medium text-gray-900">{user.mfaEnabled ? 'Enabled' : 'Off'}</p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm">
              <p className="text-xs text-gray-500">Auth</p>
              <p className="font-medium text-gray-900">
                {user.hasGoogleAuth ? 'Google + email' : 'Email/password'}
              </p>
            </div>
          </div>

          {isLocked(user) && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              This account is locked
              {user.loginLockedUntil && ` (login until ${new Date(user.loginLockedUntil).toLocaleString()})`}
              {user.passwordResetLockedUntil && ` (reset until ${new Date(user.passwordResetLockedUntil).toLocaleString()})`}
            </div>
          )}

          <div>
            <h3 className="mb-2 text-sm font-semibold text-gray-900">Edit profile</h3>
            <div className="space-y-3">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                placeholder="Name"
              />
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                placeholder="Phone"
              />
              <button
                type="button"
                disabled={saveProfile.isPending || !name.trim()}
                onClick={() => saveProfile.mutate()}
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                Save profile
              </button>
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-gray-900">Farms ({user.farms.length})</h3>
            {user.farms.length === 0 ? (
              <p className="text-sm text-gray-500">No farms</p>
            ) : (
              <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100">
                {user.farms.map((farm) => (
                  <li key={farm.farmId} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{farm.farmName}</p>
                      <p className="text-xs text-gray-500">
                        {farm.role} · {farm.pigCount} pigs · {farm.memberCount} members
                        {farm.hasStripe && ' · Stripe'}
                      </p>
                    </div>
                    {farm.role === 'OWNER' && (
                      <select
                        value={farm.plan}
                        disabled={setPlan.isPending}
                        onChange={(e) => setPlan.mutate({ farmId: farm.farmId, plan: e.target.value as FarmPlan })}
                        className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                      >
                        <option value="FREE">Smallholder</option>
                        <option value="GROWER">Grower</option>
                        <option value="ENTERPRISE">Enterprise</option>
                      </select>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {isLocked(user) && (
              <button
                type="button"
                disabled={unlock.isPending}
                onClick={() => unlock.mutate()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Unlock className="size-4" />
                Unlock
              </button>
            )}
            <button
              type="button"
              disabled={logout.isPending}
              onClick={() => logout.mutate()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <LogOut className="size-4" />
              Force sign out
            </button>
            {user.growerTrialUsedAt && (
              <button
                type="button"
                disabled={resetTrial.isPending}
                onClick={() => resetTrial.mutate()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <RefreshCw className="size-4" />
                Reset Grower trial
              </button>
            )}
          </div>

          <div className="rounded-lg border border-red-200 bg-red-50/50 p-4">
            <h3 className="text-sm font-semibold text-red-900">Danger zone</h3>
            <p className="mt-1 text-xs text-red-800">
              Permanently deletes this account. Sole-owned farms are archived. Cannot delete if the user owns a farm with other members.
            </p>
            {!showDelete ? (
              <button
                type="button"
                onClick={() => setShowDelete(true)}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
              >
                <Trash2 className="size-4" />
                Delete account
              </button>
            ) : (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-red-800">
                  Type <span className="font-mono font-semibold">{user.email}</span> to confirm:
                </p>
                <input
                  type="email"
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  className="w-full rounded-lg border border-red-200 px-3 py-2 text-sm"
                  placeholder={user.email}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={deleteUser.isPending || confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()}
                    onClick={() => deleteUser.mutate()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    <Trash2 className="size-4" />
                    Permanently delete
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowDelete(false); setConfirmEmail(''); }}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  const [planFilter, setPlanFilter] = useState<AdminPlanFilter>('ALL');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [exporting, setExporting] = useState(false);
  const pageSize = 25;

  const { data: summary, isLoading: summaryLoading, error: summaryError } = useQuery({
    queryKey: ['admin-summary'],
    queryFn: () => adminService.getSummary(),
    retry: false,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-users', page, pageSize, planFilter, search],
    queryFn: () => adminService.listUsers({ page, pageSize, plan: planFilter, search: search || undefined }),
    enabled: !!summary,
  });

  if (summaryLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (summaryError) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <AlertTriangle className="mx-auto size-8 text-red-600" />
        <p className="mt-2 font-medium text-red-900">Access denied</p>
        <p className="mt-1 text-sm text-red-700">
          {apiErrorMessage(summaryError, 'Only platform admins can view this page.')}
        </p>
      </div>
    );
  }

  const users = data?.users ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <Users className="size-7 text-primary-600" />
          Platform users
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          View and manage all accounts across The Pigsty. Only visible to platform admins.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Total users</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{summary?.totalUsers ?? 0}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Paying owners</p>
          <p className="mt-1 flex items-center gap-2 text-3xl font-bold text-gray-900">
            <CreditCard className="size-6 text-green-600" />
            {summary?.payingOwners ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Smallholder farms</p>
          <p className="mt-1 text-3xl font-bold text-gray-700">{summary?.farmsByPlan.FREE ?? 0}</p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-blue-600">Grower farms</p>
          <p className="mt-1 text-3xl font-bold text-blue-800">{summary?.farmsByPlan.GROWER ?? 0}</p>
        </div>
        <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-purple-600">Enterprise farms</p>
          <p className="mt-1 text-3xl font-bold text-purple-800">{summary?.farmsByPlan.ENTERPRISE ?? 0}</p>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {PLAN_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => { setPlanFilter(f.id); setPage(1); }}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                planFilter === f.id
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
        <form
          className="relative w-full sm:max-w-xs"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(searchInput.trim());
            setPage(1);
          }}
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search name or email…"
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm"
          />
        </form>
        <button
          type="button"
          disabled={exporting}
          onClick={async () => {
            setExporting(true);
            try {
              await adminService.exportCsv({ plan: planFilter, search: search || undefined });
              toast.success('CSV downloaded');
            } catch (e) {
              toast.error(apiErrorMessage(e, 'Export failed'));
            } finally {
              setExporting(false);
            }
          }}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          Export CSV
        </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2">User</th>
                <th className="px-4 py-2">Plan</th>
                <th className="px-4 py-2">Farms</th>
                <th className="px-4 py-2">Joined</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    <Loader2 className="mx-auto size-5 animate-spin" />
                  </td>
                </tr>
              )}
              {error && !isLoading && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-red-600">
                    {apiErrorMessage(error)}
                  </td>
                </tr>
              )}
              {!isLoading && !error && users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50/80">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{user.name}</p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${planBadgeClass(user.highestOwnedPlan)}`}>
                      {planLabel(user.highestOwnedPlan)}
                    </span>
                    {user.isPaying && (
                      <span className="ml-1.5 inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                        Paying
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {user.ownedFarmCount} owned · {user.farms.length} total
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {isLocked(user) && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                          Locked
                        </span>
                      )}
                      {user.mfaEnabled && (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                          MFA
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setSelectedUser(user)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700"
                    >
                      <UserCog className="size-3.5" />
                      Manage
                    </button>
                  </td>
                </tr>
              ))}
              {!isLoading && !error && users.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    No users match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
            <p className="text-sm text-gray-500">
              Page {data.page} of {data.totalPages} · {data.total} users
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-lg border border-gray-200 p-2 disabled:opacity-40"
                aria-label="Previous page"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-gray-200 p-2 disabled:opacity-40"
                aria-label="Next page"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedUser && (
        <UserDetailPanel
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onDeleted={() => setSelectedUser(null)}
        />
      )}
    </div>
  );
}
