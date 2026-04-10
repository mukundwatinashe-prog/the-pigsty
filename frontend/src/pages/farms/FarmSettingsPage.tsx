import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  AlertCircle,
  Building2,
  Hash,
  ImagePlus,
  Loader2,
  Mail,
  Save,
  Shield,
  Trash2,
  UserPlus,
  Users,
  X,
  Wheat,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useFarm } from '../../context/FarmContext';
import { FARM_CURRENCY_OPTIONS, isFarmCurrency, type FarmCurrencyCode } from '../../constants/farmCurrencies';
import { farmService } from '../../services/farm.service';
import type { Farm, FarmMember, FeedType, Role } from '../../types';
import { FEED_TYPE_LABELS } from '../../lib/feedUnits';

function parseDefaultBucketsFromFarm(farm: Farm | undefined) {
  const d = farm?.feedDefaultDailyBuckets;
  const n = (k: FeedType) => {
    const v = d?.[k];
    if (typeof v === 'number' && !Number.isNaN(v)) return v;
    return 0;
  };
  return {
    defaultMaizeBuckets: n('MAIZE_CRECHE'),
    defaultSoyaBuckets: n('SOYA'),
    defaultPremixBuckets: n('PREMIX'),
    defaultConcentrateBuckets: n('CONCENTRATE'),
    defaultLactatingBuckets: n('LACTATING'),
    defaultWeanerBuckets: n('WEANER'),
  };
}

function parseFeedPurchasePricesFromFarm(farm: Farm | undefined) {
  const d = farm?.feedPurchasePrices;
  const n = (k: FeedType) => {
    const v = d?.[k];
    if (typeof v === 'number' && !Number.isNaN(v)) return v;
    return 0;
  };
  return {
    feedPriceMaize: n('MAIZE_CRECHE'),
    feedPriceSoya: n('SOYA'),
    feedPricePremix: n('PREMIX'),
    feedPriceConcentrate: n('CONCENTRATE'),
    feedPriceLactating: n('LACTATING'),
    feedPriceWeaner: n('WEANER'),
  };
}

const INVITE_ROLES: Role[] = ['FARM_MANAGER', 'WORKER'];

const settingsSchema = z.object({
  name: z.string().min(2).max(100),
  location: z.string().min(2),
  country: z.string().min(2),
  currency: z.custom<FarmCurrencyCode>((val) => typeof val === 'string' && isFarmCurrency(val), {
    message: 'Select a supported currency',
  }),
  timezone: z.string().min(1),
  weightUnit: z.enum(['kg', 'lb']),
  pricePerKg: z.number().min(0, 'Must be 0 or more'),
  /** Alert when any feed type stock (kg) falls at or below this level */
  feedLowStockThresholdKg: z.number().min(0, 'Must be 0 or more'),
  defaultMaizeBuckets: z.number().min(0, 'Must be 0 or more'),
  defaultSoyaBuckets: z.number().min(0, 'Must be 0 or more'),
  defaultPremixBuckets: z.number().min(0, 'Must be 0 or more'),
  defaultConcentrateBuckets: z.number().min(0, 'Must be 0 or more'),
  defaultLactatingBuckets: z.number().min(0, 'Must be 0 or more'),
  defaultWeanerBuckets: z.number().min(0, 'Must be 0 or more'),
  feedPurchasePriceUnit: z.enum(['KG', 'TONNE']),
  feedPriceMaize: z.number().min(0, 'Must be 0 or more'),
  feedPriceSoya: z.number().min(0, 'Must be 0 or more'),
  feedPricePremix: z.number().min(0, 'Must be 0 or more'),
  feedPriceConcentrate: z.number().min(0, 'Must be 0 or more'),
  feedPriceLactating: z.number().min(0, 'Must be 0 or more'),
  feedPriceWeaner: z.number().min(0, 'Must be 0 or more'),
});

type SettingsForm = z.infer<typeof settingsSchema>;

const inviteSchema = z.object({
  email: z.string().email('Valid email required'),
  role: z.enum(['FARM_MANAGER', 'WORKER']),
});

type InviteForm = z.infer<typeof inviteSchema>;

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

function formatRole(role: string) {
  return role.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function roleLabel(role: Role) {
  const map: Partial<Record<Role, string>> = {
    OWNER: 'Farm Owner',
    FARM_MANAGER: 'Farm Manager',
    WORKER: 'Worker',
  };
  return map[role] ?? formatRole(role);
}

export default function FarmSettingsPage() {
  const { user } = useAuth();
  const { currentFarm, setCurrentFarm } = useFarm();
  const queryClient = useQueryClient();
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [logoDragging, setLogoDragging] = useState(false);

  const farmId = currentFarm?.id;

  const {
    data: detail,
    isLoading: detailLoading,
    isError: detailError,
    error: detailErr,
    refetch,
  } = useQuery({
    queryKey: ['farm', farmId],
    queryFn: () => farmService.getById(farmId!),
    enabled: !!farmId,
  });

  const farm = detail?.farm;

  const settingsForm = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      name: '',
      location: '',
      country: '',
      currency: 'USD',
      timezone: 'UTC',
      weightUnit: 'kg',
      pricePerKg: 3.3,
      feedLowStockThresholdKg: 50,
      defaultMaizeBuckets: 0,
      defaultSoyaBuckets: 0,
      defaultPremixBuckets: 0,
      defaultConcentrateBuckets: 0,
      defaultLactatingBuckets: 0,
      defaultWeanerBuckets: 0,
      feedPurchasePriceUnit: 'KG',
      feedPriceMaize: 0,
      feedPriceSoya: 0,
      feedPricePremix: 0,
      feedPriceConcentrate: 0,
      feedPriceLactating: 0,
      feedPriceWeaner: 0,
    },
  });
  const { reset: resetSettings, control: settingsControl } = settingsForm;
  const weightUnitWatch = useWatch({ control: settingsControl, name: 'weightUnit' });
  const currencyWatch = useWatch({ control: settingsControl, name: 'currency' });
  const feedPurchaseUnitWatch = useWatch({ control: settingsControl, name: 'feedPurchasePriceUnit' });

  /* Reset editor state when the farm query result updates (e.g. after save or refetch). */
  useEffect(() => {
    if (!farm) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional sync from server record
    setLogoDataUrl(farm.logoUrl ?? null);
    resetSettings({
      name: farm.name,
      location: farm.location,
      country: farm.country,
      currency: isFarmCurrency(farm.currency) ? farm.currency : 'USD',
      timezone: farm.timezone,
      weightUnit: farm.weightUnit as SettingsForm['weightUnit'],
      pricePerKg: Number(farm.pricePerKg) || 3.3,
      feedLowStockThresholdKg:
        farm.feedLowStockThresholdKg != null && !Number.isNaN(Number(farm.feedLowStockThresholdKg))
          ? Number(farm.feedLowStockThresholdKg)
          : 50,
      ...parseDefaultBucketsFromFarm(farm),
      feedPurchasePriceUnit: farm.feedPurchasePriceUnit === 'TONNE' ? 'TONNE' : 'KG',
      ...parseFeedPurchasePricesFromFarm(farm),
    });
  }, [farm, resetSettings]);

  const inviteForm = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: '', role: 'WORKER' },
  });

  const updateMutation = useMutation({
    mutationFn: (data: SettingsForm) => {
      const {
        defaultMaizeBuckets,
        defaultSoyaBuckets,
        defaultPremixBuckets,
        defaultConcentrateBuckets,
        defaultLactatingBuckets,
        defaultWeanerBuckets,
        feedPriceMaize,
        feedPriceSoya,
        feedPricePremix,
        feedPriceConcentrate,
        feedPriceLactating,
        feedPriceWeaner,
        ...rest
      } = data;
      return farmService.update(farmId!, {
        ...rest,
        feedDefaultDailyBuckets: {
          MAIZE_CRECHE: defaultMaizeBuckets,
          SOYA: defaultSoyaBuckets,
          PREMIX: defaultPremixBuckets,
          CONCENTRATE: defaultConcentrateBuckets,
          LACTATING: defaultLactatingBuckets,
          WEANER: defaultWeanerBuckets,
        },
        feedPurchasePrices: {
          MAIZE_CRECHE: feedPriceMaize,
          SOYA: feedPriceSoya,
          PREMIX: feedPricePremix,
          CONCENTRATE: feedPriceConcentrate,
          LACTATING: feedPriceLactating,
          WEANER: feedPriceWeaner,
        },
        logoUrl: logoDataUrl,
      });
    },
    onSuccess: updated => {
      queryClient.invalidateQueries({ queryKey: ['farm', farmId] });
      queryClient.invalidateQueries({ queryKey: ['farm-dashboard', farmId] });
      queryClient.invalidateQueries({ queryKey: ['farm-billing', farmId] });
      queryClient.invalidateQueries({ queryKey: ['farms'] });
      queryClient.invalidateQueries({ queryKey: ['feed-summary', farmId] });
      queryClient.invalidateQueries({ queryKey: ['feed-daily', farmId] });
      queryClient.invalidateQueries({ queryKey: ['farm-financials', farmId] });
      setCurrentFarm((prev: Farm | null) => {
        if (!prev || prev.id !== updated.id) return prev;
        return {
          ...prev,
          ...updated,
          pricePerKg: Number(updated.pricePerKg),
          feedLowStockThresholdKg:
            updated.feedLowStockThresholdKg != null && !Number.isNaN(Number(updated.feedLowStockThresholdKg))
              ? Number(updated.feedLowStockThresholdKg)
              : undefined,
          feedDefaultDailyBuckets:
            updated.feedDefaultDailyBuckets != null && typeof updated.feedDefaultDailyBuckets === 'object'
              ? (updated.feedDefaultDailyBuckets as Farm['feedDefaultDailyBuckets'])
              : undefined,
          feedPurchasePriceUnit: updated.feedPurchasePriceUnit === 'TONNE' ? 'TONNE' : 'KG',
          feedPurchasePrices:
            updated.feedPurchasePrices != null && typeof updated.feedPurchasePrices === 'object'
              ? (updated.feedPurchasePrices as Farm['feedPurchasePrices'])
              : undefined,
        };
      });
      toast.success('Farm settings saved');
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'Could not save settings');
    },
  });

  const inviteMutation = useMutation({
    mutationFn: (data: InviteForm) => farmService.invite(farmId!, data.email, data.role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['farm', farmId] });
      queryClient.invalidateQueries({ queryKey: ['farm-dashboard', farmId] });
      queryClient.invalidateQueries({ queryKey: ['farms'] });
      inviteForm.reset({ email: '', role: inviteForm.getValues('role') });
      toast.success('Member invited');
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'Invite failed');
    },
  });

  const removeMutation = useMutation({
    mutationFn: (memberId: string) => farmService.removeMember(farmId!, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['farm', farmId] });
      queryClient.invalidateQueries({ queryKey: ['farm-dashboard', farmId] });
      queryClient.invalidateQueries({ queryKey: ['farms'] });
      toast.success('Member removed');
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'Could not remove member');
    },
  });

  const applyLogoFile = (file: File | undefined) => {
    if (!file) return;
    const okTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!okTypes.includes(file.type)) {
      toast.error('Use a PNG, JPG, or WebP image');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo must be 2MB or smaller');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : null;
      if (!result) return toast.error('Could not read selected image');
      setLogoDataUrl(result);
      void settingsForm.trigger();
      toast.success('Logo loaded — click Save changes below to apply it to this farm.');
    };
    reader.onerror = () => toast.error('Could not read selected image');
    reader.readAsDataURL(file);
  };

  if (!currentFarm) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-dashed border-amber-200 bg-amber-50/80 p-10 text-center">
        <Building2 className="mx-auto size-12 text-amber-600" />
        <h1 className="mt-4 text-lg font-semibold text-gray-900">No farm selected</h1>
        <p className="mt-2 text-sm text-gray-600">Select a farm to manage settings and members.</p>
        <Link
          to="/farms"
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-primary-700"
        >
          Choose a farm
        </Link>
      </div>
    );
  }

  if (detailLoading) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-gray-500">
        <Loader2 className="size-10 animate-spin text-primary-600" />
        <p className="text-sm">Loading farm settings…</p>
      </div>
    );
  }

  if (detailError || !farm) {
    return (
      <div
        role="alert"
        className="flex flex-col gap-4 rounded-2xl border border-red-100 bg-red-50/90 p-6 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex gap-3">
          <AlertCircle className="size-5 shrink-0 text-red-600" />
          <div>
            <p className="font-semibold text-red-900">Could not load farm</p>
            <p className="mt-1 text-sm text-red-800/90">
              {(detailErr as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                'Check your connection and try again.'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-red-800 shadow-sm ring-1 ring-red-200 hover:bg-red-50"
        >
          Retry
        </button>
      </div>
    );
  }

  const members: FarmMember[] = farm.members ?? [];
  const logoChanged = logoDataUrl !== (farm.logoUrl ?? null);
  const canSave =
    settingsForm.formState.isDirty || logoChanged;

  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Farm settings</h1>
        <p className="mt-1 text-gray-600">
          Manage <span className="font-medium text-gray-900">{farm.name}</span> — logo, name, location, and preferences (one page, scroll as needed).
        </p>
      </div>

      <form
        className="w-full max-w-full"
        onSubmit={settingsForm.handleSubmit(data => updateMutation.mutate(data))}
      >
        <section className="rounded-2xl border-2 border-gray-200 bg-white p-6 shadow-sm space-y-10">
          {/* Logo first: avoid display:contents on <form> (breaks in some browsers) and keep this impossible to miss */}
          <div
            className="rounded-xl border-2 border-amber-400 bg-amber-50 p-5 ring-1 ring-amber-200/80"
            role="region"
            aria-labelledby="farm-logo-heading"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 id="farm-logo-heading" className="text-lg font-bold tracking-tight text-gray-900">
                  Farm logo
                </h2>
                <p className="mt-1 text-sm text-gray-700">
                  Shown beside your farm name in the sidebar and on PDF/Excel reports. Upload or drop an image, then press <strong>Save changes</strong> at the bottom.
                </p>
                {logoChanged && (
                  <p className="mt-2 inline-flex rounded-full bg-amber-200/80 px-3 py-1 text-xs font-semibold text-amber-950">
                    Logo not saved yet — use Save changes
                  </p>
                )}
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
              <div
                className={`flex size-24 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed bg-white transition-colors ${
                  logoDragging ? 'border-amber-700 bg-amber-50' : 'border-amber-500'
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setLogoDragging(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setLogoDragging(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setLogoDragging(false);
                  const f = e.dataTransfer.files?.[0];
                  applyLogoFile(f);
                }}
                onClick={() => document.getElementById('farm-logo-file')?.click()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    document.getElementById('farm-logo-file')?.click();
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label="Drop logo image here or click to choose file"
              >
                {logoDataUrl ? (
                  <img src={logoDataUrl} alt="" className="size-full object-cover" />
                ) : (
                  <ImagePlus className="size-10 text-amber-600" aria-hidden />
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <label
                  htmlFor="farm-logo-file"
                  className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-amber-600 px-5 py-3 text-sm font-bold text-white shadow-md hover:bg-amber-700"
                >
                  <ImagePlus className="size-5" />
                  Choose logo file
                </label>
                <input
                  id="farm-logo-file"
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  className="sr-only"
                  aria-label="Choose farm logo image file"
                  onChange={(e) => {
                    applyLogoFile(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
                {logoDataUrl && (
                  <button
                    type="button"
                    onClick={() => setLogoDataUrl(null)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-50"
                  >
                    <X className="size-4" />
                    Remove logo
                  </button>
                )}
              </div>
            </div>
            <p className="mt-3 text-xs font-medium text-gray-600">
              PNG, JPG, or WEBP · maximum 2MB · you can also drag and drop onto the preview square
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <h2 className="text-base font-semibold text-gray-900">Farm name</h2>
              <p className="mt-0.5 text-sm text-gray-500">Displayed across the app and on exports</p>
              <label htmlFor="settings-name" className="sr-only">
                Farm name
              </label>
              <input
                id="settings-name"
                {...settingsForm.register('name')}
                className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
              />
              {settingsForm.formState.errors.name && (
                <p className="mt-1 text-xs text-red-600">{settingsForm.formState.errors.name.message}</p>
              )}
            </div>
          </div>

          <div className="border-t border-gray-200 pt-8">
            <div className="mb-5 flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
                <Building2 className="size-5" />
              </span>
              <div>
                <h2 className="font-semibold text-gray-900">Location &amp; preferences</h2>
                <p className="text-sm text-gray-500">Where you operate and how weights and currency work</p>
              </div>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="settings-location" className="block text-sm font-medium text-gray-700">
              Location
            </label>
            <input
              id="settings-location"
              {...settingsForm.register('location')}
              className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
            />
            {settingsForm.formState.errors.location && (
              <p className="mt-1 text-xs text-red-600">{settingsForm.formState.errors.location.message}</p>
            )}
          </div>
          <div>
            <label htmlFor="settings-country" className="block text-sm font-medium text-gray-700">
              Country
            </label>
            <input
              id="settings-country"
              {...settingsForm.register('country')}
              className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
            />
            {settingsForm.formState.errors.country && (
              <p className="mt-1 text-xs text-red-600">{settingsForm.formState.errors.country.message}</p>
            )}
          </div>
          <div>
            <label htmlFor="settings-currency" className="block text-sm font-medium text-gray-700">
              Currency
            </label>
            <select
              id="settings-currency"
              {...settingsForm.register('currency')}
              className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
            >
              {FARM_CURRENCY_OPTIONS.map(({ code, label }) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="settings-weight" className="block text-sm font-medium text-gray-700">
              Weight unit
            </label>
            <select
              id="settings-weight"
              {...settingsForm.register('weightUnit')}
              className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
            >
              <option value="kg">Kilograms (kg)</option>
              <option value="lb">Pounds (lb)</option>
            </select>
          </div>
          <div>
            <label htmlFor="settings-ppkg" className="block text-sm font-medium text-gray-700">
              Sale price per {weightUnitWatch || 'kg'}
            </label>
            <div className="relative mt-1.5">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-500 tabular-nums">
                {currencyWatch || 'USD'}
              </span>
              <input
                id="settings-ppkg"
                type="number"
                step="0.01"
                min="0"
                {...settingsForm.register('pricePerKg', { valueAsNumber: true })}
                className="w-full rounded-lg border border-gray-300 py-2.5 pl-16 pr-3 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
              />
            </div>
            {settingsForm.formState.errors.pricePerKg && (
              <p className="mt-1 text-xs text-red-600">{settingsForm.formState.errors.pricePerKg.message}</p>
            )}
            <p className="mt-1 text-xs text-gray-400">Used to auto-calculate sale prices</p>
          </div>
          <div className="sm:col-span-2 rounded-xl border border-amber-200/80 bg-amber-50/90 p-4">
            <div className="flex flex-wrap items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
                <Wheat className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <label htmlFor="settings-feed-low" className="block text-sm font-medium text-gray-900">
                  Low feed stock threshold (kg)
                </label>
                <p className="mt-0.5 text-xs text-gray-600">
                  When any feed type&apos;s on-hand stock falls to or below this amount, you&apos;ll see an in-app alert (once per browser session per farm).
                </p>
                <input
                  id="settings-feed-low"
                  type="number"
                  step="0.1"
                  min="0"
                  {...settingsForm.register('feedLowStockThresholdKg', { valueAsNumber: true })}
                  className="mt-2 w-full max-w-xs rounded-lg border border-amber-200/80 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                />
                {settingsForm.formState.errors.feedLowStockThresholdKg && (
                  <p className="mt-1 text-xs text-red-600">
                    {settingsForm.formState.errors.feedLowStockThresholdKg.message}
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="sm:col-span-2 rounded-xl border border-sky-200/80 bg-sky-50/80 p-4">
            <div className="mb-3 flex flex-wrap items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-800">
                <Wheat className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-gray-900">Feed purchase prices</h3>
                <p className="mt-0.5 text-xs text-gray-600">
                  When someone logs a feed purchase, the app multiplies <strong className="font-medium text-gray-800">quantity (kg)</strong> by these
                  rates to set the cost (same figures flow into Financials). This is separate from the pig <strong>sale</strong> price per kg above.
                </p>
                <fieldset className="mt-3 space-y-2">
                  <legend className="sr-only">Price unit</legend>
                  <p className="text-xs font-medium text-gray-700">Your prices are entered as:</p>
                  <div className="flex flex-wrap gap-4">
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-800">
                      <input
                        type="radio"
                        value="KG"
                        {...settingsForm.register('feedPurchasePriceUnit')}
                        className="text-primary-600 focus:ring-primary-500"
                      />
                      Per kg
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-800">
                      <input
                        type="radio"
                        value="TONNE"
                        {...settingsForm.register('feedPurchasePriceUnit')}
                        className="text-primary-600 focus:ring-primary-500"
                      />
                      Per metric tonne (1000 kg)
                    </label>
                  </div>
                </fieldset>
                <p className="mt-2 text-xs text-gray-500">
                  All amounts below are in <span className="font-medium text-gray-700">{currencyWatch || 'USD'}</span>,{' '}
                  {feedPurchaseUnitWatch === 'TONNE' ? 'per tonne' : 'per kilogram'}.
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {(
                    [
                      ['feedPriceMaize', 'MAIZE_CRECHE'],
                      ['feedPriceSoya', 'SOYA'],
                      ['feedPricePremix', 'PREMIX'],
                      ['feedPriceConcentrate', 'CONCENTRATE'],
                      ['feedPriceLactating', 'LACTATING'],
                      ['feedPriceWeaner', 'WEANER'],
                    ] as const
                  ).map(([field, ft]) => (
                    <div key={field}>
                      <label className="block text-xs font-medium text-gray-700">{FEED_TYPE_LABELS[ft]}</label>
                      <div className="relative mt-1">
                        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-medium text-gray-500">
                          {currencyWatch || 'USD'}
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          {...settingsForm.register(field, { valueAsNumber: true })}
                          className="w-full rounded-lg border border-sky-200/80 bg-white py-2 pl-12 pr-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                        />
                      </div>
                      {settingsForm.formState.errors[field] && (
                        <p className="mt-0.5 text-xs text-red-600">
                          {(settingsForm.formState.errors[field] as { message?: string })?.message}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="sm:col-span-2 rounded-xl border border-emerald-200/80 bg-emerald-50/80 p-4">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Default daily feed usage (buckets)</h3>
              <p className="mt-0.5 text-xs text-gray-600">
                50 kg = 3 buckets. These values pre-fill <strong className="font-medium text-gray-800">Feed → Log daily feed</strong> when there is
                no entry yet for that date.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(
                [
                  ['defaultMaizeBuckets', 'MAIZE_CRECHE'],
                  ['defaultSoyaBuckets', 'SOYA'],
                  ['defaultPremixBuckets', 'PREMIX'],
                  ['defaultConcentrateBuckets', 'CONCENTRATE'],
                  ['defaultLactatingBuckets', 'LACTATING'],
                  ['defaultWeanerBuckets', 'WEANER'],
                ] as const
              ).map(([field, ft]) => (
                <div key={field}>
                  <label className="block text-xs font-medium text-gray-700">{FEED_TYPE_LABELS[ft]}</label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    {...settingsForm.register(field, { valueAsNumber: true })}
                    className="mt-1 w-full rounded-lg border border-emerald-200/80 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="settings-tz" className="block text-sm font-medium text-gray-700">
              Timezone
            </label>
            <select
              id="settings-tz"
              {...settingsForm.register('timezone')}
              className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
            >
              {TIMEZONES.map(tz => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
            {settingsForm.formState.errors.timezone && (
              <p className="mt-1 text-xs text-red-600">{settingsForm.formState.errors.timezone.message}</p>
            )}
          </div>
          <div className="sm:col-span-2 flex justify-end border-t border-gray-50 pt-5">
            <button
              type="submit"
              disabled={updateMutation.isPending || !canSave}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {updateMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Save changes
            </button>
          </div>
            </div>
          </div>
        </section>
      </form>

      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-accent-100 text-accent-700">
              <Users className="size-5" />
            </span>
            <div>
              <h2 className="font-semibold text-gray-900">Team members</h2>
              <p className="text-sm text-gray-500">Roles and access for this farm</p>
            </div>
          </div>
        </div>

        <div className="mb-8 overflow-hidden rounded-xl border border-gray-100">
          {members.length === 0 ? (
            <p className="p-6 text-center text-sm text-gray-500">No members loaded.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {members.map(m => {
                const isSelf = user?.id === m.userId;
                const isOwner = m.role === 'OWNER';
                const canRemove = !isOwner && !removeMutation.isPending;
                return (
                  <li
                    key={m.id}
                    className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-600">
                        {m.user.name?.charAt(0)?.toUpperCase() ?? '?'}
                      </div>
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 font-medium text-gray-900">
                          <span className="truncate">{m.user.name}</span>
                          {isSelf && (
                            <span className="shrink-0 rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-800">
                              You
                            </span>
                          )}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-gray-500">
                          <Mail className="size-3.5 shrink-0" />
                          {m.user.email}
                        </p>
                        <p className="mt-2 flex items-center gap-1.5 text-xs text-gray-600">
                          <Shield className="size-3.5 text-gray-400" />
                          <span className="rounded-md bg-gray-100 px-2 py-0.5 font-medium text-gray-800">
                            {roleLabel(m.role)}
                          </span>
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={!canRemove}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Remove ${m.user.name || m.user.email} from this farm? They will lose access immediately.`,
                          )
                        ) {
                          removeMutation.mutate(m.id);
                        }
                      }}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-100 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                      title={isOwner ? 'The owner cannot be removed' : 'Remove member'}
                    >
                      <Trash2 className="size-4" />
                      Remove
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-dashed border-primary-200 bg-primary-50/40 p-5">
          <div className="mb-4 flex items-center gap-2 text-primary-900">
            <UserPlus className="size-5" />
            <h3 className="font-semibold">Invite someone</h3>
          </div>
          <p className="mb-3 text-sm text-gray-600">
            The person must already have a Pigsty account. They will be added with the role you choose.
          </p>
          <div className="mb-4 rounded-lg bg-white/70 border border-primary-100 p-3 text-xs text-gray-600 space-y-1">
            <p><span className="font-semibold text-gray-800">Farm Manager</span> — Full access: view, add, edit, delete, manage users & settings</p>
            <p><span className="font-semibold text-gray-800">Worker</span> — Can view, add data, upload & download files. Cannot edit, delete, or manage users</p>
          </div>
          <form
            onSubmit={inviteForm.handleSubmit(data => inviteMutation.mutate(data))}
            className="flex flex-col gap-4 sm:flex-row sm:items-end"
          >
            <div className="flex-1">
              <label htmlFor="invite-email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="invite-email"
                type="email"
                {...inviteForm.register('email')}
                className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                placeholder="colleague@example.com"
              />
              {inviteForm.formState.errors.email && (
                <p className="mt-1 text-xs text-red-600">{inviteForm.formState.errors.email.message}</p>
              )}
            </div>
            <div className="sm:w-48">
              <label htmlFor="invite-role" className="block text-sm font-medium text-gray-700">
                Role
              </label>
              <select
                id="invite-role"
                {...inviteForm.register('role')}
                className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
              >
                {INVITE_ROLES.map(r => (
                  <option key={r} value={r}>
                    {roleLabel(r)}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={inviteMutation.isPending}
              className="inline-flex h-[42px] shrink-0 items-center justify-center gap-2 rounded-lg bg-primary-600 px-5 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50 sm:mb-0.5"
            >
              {inviteMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
              Send invite
            </button>
          </form>
        </div>
      </section>

      <div className="flex items-start gap-2 rounded-xl bg-gray-100/80 px-4 py-3 text-sm text-gray-600">
        <Hash className="mt-0.5 size-4 shrink-0 text-gray-400" />
        <p>
          Farm ID: <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs text-gray-800">{farm.id}</code>
        </p>
      </div>
    </div>
  );
}
