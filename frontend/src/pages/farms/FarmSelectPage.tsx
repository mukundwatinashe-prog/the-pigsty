import { useState } from 'react';
import { flushSync } from 'react-dom';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  AlertCircle,
  Building2,
  ChevronRight,
  LayoutGrid,
  Loader2,
  MapPin,
  PiggyBank,
  Plus,
  Sprout,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useFarm } from '../../context/FarmContext';
import { FARM_CURRENCY_OPTIONS, isFarmCurrency, type FarmCurrencyCode } from '../../constants/farmCurrencies';
import { farmService } from '../../services/farm.service';
import { BrandLogo } from '../../components/BrandLogo';
import { track } from '../../lib/analytics';
import type { Farm } from '../../types';

const createFarmSchema = z.object({
  name: z.string().min(2, 'At least 2 characters').max(100),
  location: z.string().min(2, 'Location required'),
  country: z.string().min(2, 'Country required'),
  currency: z.custom<FarmCurrencyCode>((val) => typeof val === 'string' && isFarmCurrency(val), {
    message: 'Select a supported currency',
  }),
  timezone: z.string().min(1, 'Select a timezone'),
  weightUnit: z.enum(['kg', 'lb']),
});

type CreateFarmForm = z.infer<typeof createFarmSchema>;

const TIMEZONES = [
  'UTC',
  'Africa/Johannesburg',
  'Africa/Harare',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Dubai',
  'Asia/Tokyo',
  'Australia/Sydney',
];

type FarmWithRole = Farm & { role: string };

function StatPill({ icon: Icon, value, label }: { icon: typeof Users; value: number; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-gray-600">
      <Icon className="size-3.5 shrink-0 text-primary-500" aria-hidden />
      <span className="font-semibold text-gray-900 tabular-nums">{value}</span>
      <span>{label}</span>
    </div>
  );
}

function formatRole(role: string) {
  return role.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

export default function FarmSelectPage() {
  const { user, loading: authLoading } = useAuth();
  const { setCurrentFarm } = useFarm();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [switchingFarmId, setSwitchingFarmId] = useState<string | null>(null);

  const {
    data: farms,
    isLoading: farmsLoading,
    isError: farmsError,
    error: farmsErr,
    refetch,
  } = useQuery({
    queryKey: ['farms'],
    queryFn: () => farmService.list(),
    enabled: !!user,
  });

  const createForm = useForm<CreateFarmForm>({
    resolver: zodResolver(createFarmSchema),
    defaultValues: {
      name: '',
      location: '',
      country: '',
      currency: 'USD',
      timezone: 'Africa/Harare',
      weightUnit: 'kg',
    },
  });

  const createMutation = useMutation({
    mutationFn: (body: CreateFarmForm) => farmService.create(body),
    onSuccess: farm => {
      queryClient.invalidateQueries({ queryKey: ['farms'] });
      flushSync(() => {
        setCurrentFarm(farm);
      });
      void queryClient.prefetchQuery({
        queryKey: ['farm-dashboard', farm.id],
        queryFn: () => farmService.getById(farm.id),
      });
      track('farm_created', { farm_id: farm.id });
      toast.success('Farm created successfully');
      setCreateOpen(false);
      createForm.reset();
      navigate('/dashboard');
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'Could not create farm');
    },
  });

  const onSelectFarm = async (farm: Farm) => {
    try {
      setSwitchingFarmId(farm.id);
      const freshFarm = await farmService.getById(farm.id);
      flushSync(() => {
        setCurrentFarm(freshFarm.farm);
      });
      await queryClient.prefetchQuery({
        queryKey: ['farm-dashboard', farm.id],
        queryFn: () => farmService.getById(farm.id),
      });
      toast.success(`Switched to ${farm.name}`);
      navigate('/dashboard');
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Could not open farm');
    } finally {
      setSwitchingFarmId(null);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-accent-50">
        <Loader2 className="size-10 animate-spin text-primary-600" aria-label="Loading" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!user.phone?.trim()) {
    return <Navigate to="/complete-profile" replace />;
  }

  const list: FarmWithRole[] = farms ?? [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-50">
      <div className="mx-auto max-w-5xl px-4 pb-28 pt-8 sm:py-14">
        <header className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-0">
              <BrandLogo size="lg" className="-mr-3 shrink-0 sm:-mr-4" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-primary-700">The Pigsty</p>
                <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">Your farms</h1>
              </div>
            </div>
            <p className="max-w-xl text-gray-600">
              Choose a farm to open the dashboard, or create a new one to get started.
            </p>
            <p className="mt-2 text-sm text-gray-500">
              Signed in as <span className="font-medium text-gray-700">{user.email}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="hidden min-h-[44px] items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-primary-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary-200 sm:inline-flex"
          >
            <Plus className="size-4" />
            Create farm
          </button>
        </header>

        {farmsLoading && (
          <div className="grid gap-4 sm:grid-cols-2">
            {[1, 2, 3].map(i => (
              <div
                key={i}
                className="h-40 animate-pulse rounded-2xl border border-gray-100 bg-white/80 shadow-sm"
              />
            ))}
          </div>
        )}

        {farmsError && (
          <div
            role="alert"
            className="flex flex-col items-start gap-4 rounded-2xl border border-red-100 bg-red-50/90 p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex gap-3">
              <AlertCircle className="size-5 shrink-0 text-red-600" />
              <div>
                <p className="font-semibold text-red-900">Could not load farms</p>
                <p className="mt-1 text-sm text-red-800/90">
                  {(farmsErr as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                    'Something went wrong. Try again.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => refetch()}
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-red-800 shadow-sm ring-1 ring-red-200 transition hover:bg-red-50"
            >
              Retry
            </button>
          </div>
        )}

        {!farmsLoading && !farmsError && list.length === 0 && (
          <div className="rounded-3xl border border-dashed border-primary-200 bg-white/70 px-8 py-16 text-center shadow-sm backdrop-blur-sm">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-primary-100 text-primary-600">
              <Sprout className="size-8" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">No farms yet</h2>
            <p className="mx-auto mt-2 max-w-md text-gray-600">
              Create your first farm to track pigs, pens, and team members in one place.
            </p>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary-600 px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-primary-700 focus-visible:ring-4 focus-visible:ring-primary-200"
            >
              <Plus className="size-4" />
              Create your first farm
            </button>
          </div>
        )}

        {!farmsLoading && !farmsError && list.length > 0 && (
          <ul className="grid gap-4 sm:grid-cols-2">
            {list.map(farm => {
              const pigs = farm._count?.pigs ?? 0;
              const pens = farm._count?.pens ?? 0;
              const members = farm._count?.members ?? 0;
              return (
                <li key={farm.id}>
                  <button
                    type="button"
                    onClick={() => void onSelectFarm(farm)}
                    disabled={switchingFarmId !== null}
                    className="group flex min-h-[140px] w-full flex-col rounded-2xl border border-gray-100 bg-white p-5 text-left shadow-sm ring-primary-200 transition hover:border-primary-200 hover:shadow-md focus:outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-white shadow-inner">
                          <Building2 className="size-5" />
                        </span>
                        <div className="min-w-0">
                          <h2 className="truncate font-semibold text-gray-900 group-hover:text-primary-800">
                            {farm.name}
                          </h2>
                          <p className="mt-0.5 flex items-center gap-1 text-sm text-gray-500">
                            <MapPin className="size-3.5 shrink-0" />
                            <span className="truncate">
                              {farm.location}, {farm.country}
                            </span>
                          </p>
                          <span className="mt-2 inline-block rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary-800">
                            {formatRole(farm.role)}
                          </span>
                        </div>
                      </div>
                      {switchingFarmId === farm.id ? (
                        <Loader2 className="size-5 shrink-0 animate-spin text-primary-500" />
                      ) : (
                        <ChevronRight className="size-5 shrink-0 text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-primary-500" />
                      )}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-gray-50 pt-4">
                      <StatPill icon={PiggyBank} value={pigs} label="pigs" />
                      <StatPill icon={LayoutGrid} value={pens} label="pens" />
                      <StatPill icon={Users} value={members} label="members" />
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <p className="mt-10 text-center text-sm text-gray-500">
          Wrong account?{' '}
          <Link to="/login" className="font-medium text-primary-600 hover:text-primary-700">
            Back to sign in
          </Link>
        </p>
      </div>

      <div className="fixed inset-x-0 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 px-4 sm:hidden">
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-primary-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary-200"
        >
          <Plus className="size-4" />
          Create farm
        </button>
      </div>

      {createOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-gray-900/50 p-4 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-farm-title"
        >
          <div className="max-h-[100dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-gray-100 bg-white px-6 py-4">
              <h2 id="create-farm-title" className="text-lg font-semibold text-gray-900">
                Create farm
              </h2>
              <button
                type="button"
                onClick={() => {
                  setCreateOpen(false);
                  createForm.reset();
                }}
                className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                aria-label="Close"
              >
                <X className="size-5" />
              </button>
            </div>
            <form
              onSubmit={createForm.handleSubmit(data => createMutation.mutate(data))}
              className="space-y-4 px-6 py-5"
            >
              <div>
                <label htmlFor="farm-name" className="block text-sm font-medium text-gray-700">
                  Farm name
                </label>
                <input
                  id="farm-name"
                  {...createForm.register('name')}
                  className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                  placeholder="e.g. Green Valley Piggery"
                />
                {createForm.formState.errors.name && (
                  <p className="mt-1 text-xs text-red-600">{createForm.formState.errors.name.message}</p>
                )}
              </div>
              <div>
                <label htmlFor="farm-location" className="block text-sm font-medium text-gray-700">
                  Location
                </label>
                <input
                  id="farm-location"
                  {...createForm.register('location')}
                  className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                  placeholder="City or region"
                />
                {createForm.formState.errors.location && (
                  <p className="mt-1 text-xs text-red-600">{createForm.formState.errors.location.message}</p>
                )}
              </div>
              <div>
                <label htmlFor="farm-country" className="block text-sm font-medium text-gray-700">
                  Country
                </label>
                <input
                  id="farm-country"
                  {...createForm.register('country')}
                  className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                  placeholder="e.g. Zimbabwe"
                />
                {createForm.formState.errors.country && (
                  <p className="mt-1 text-xs text-red-600">{createForm.formState.errors.country.message}</p>
                )}
                <p className="mt-2 text-xs text-gray-500">Quick presets (you can edit after):</p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      createForm.setValue('country', 'Zimbabwe');
                      createForm.setValue('currency', 'USD');
                      createForm.setValue('timezone', 'Africa/Harare');
                    }}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-primary-300 hover:bg-primary-50"
                  >
                    Zimbabwe
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      createForm.setValue('country', 'South Africa');
                      createForm.setValue('currency', 'ZAR');
                      createForm.setValue('timezone', 'Africa/Johannesburg');
                    }}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-primary-300 hover:bg-primary-50"
                  >
                    South Africa
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      createForm.setValue('country', 'Zambia');
                      createForm.setValue('currency', 'ZMW');
                      createForm.setValue('timezone', 'Africa/Lusaka');
                    }}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-primary-300 hover:bg-primary-50"
                  >
                    Zambia
                  </button>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="farm-currency" className="block text-sm font-medium text-gray-700">
                    Currency
                  </label>
                  <select
                    id="farm-currency"
                    {...createForm.register('currency')}
                    className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                  >
                    {FARM_CURRENCY_OPTIONS.map(({ code, label }) => (
                      <option key={code} value={code}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="farm-weight" className="block text-sm font-medium text-gray-700">
                    Weight unit
                  </label>
                  <select
                    id="farm-weight"
                    {...createForm.register('weightUnit')}
                    className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                  >
                    <option value="kg">Kilograms (kg)</option>
                    <option value="lb">Pounds (lb)</option>
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="farm-tz" className="block text-sm font-medium text-gray-700">
                  Timezone
                </label>
                <select
                  id="farm-tz"
                  {...createForm.register('timezone')}
                  className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                >
                  {TIMEZONES.map(tz => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
                {createForm.formState.errors.timezone && (
                  <p className="mt-1 text-xs text-red-600">{createForm.formState.errors.timezone.message}</p>
                )}
              </div>
              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setCreateOpen(false);
                    createForm.reset();
                  }}
                  className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50"
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Creating…
                    </>
                  ) : (
                    'Create farm'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
