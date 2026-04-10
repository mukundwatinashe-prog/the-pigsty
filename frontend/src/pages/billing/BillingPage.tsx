import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CreditCard, ExternalLink, Loader2, Sparkles, MessageCircle } from 'lucide-react';
import { siteConfig, whatsappHelpUrl } from '../../lib/siteConfig';
import toast from 'react-hot-toast';
import { useFarm } from '../../context/FarmContext';
import { farmService } from '../../services/farm.service';
import { track } from '../../lib/analytics';

function canManageSubscription(role: string) {
  return role === 'OWNER' || role === 'FARM_MANAGER';
}

export default function BillingPage() {
  const { currentFarm } = useFarm();
  const farmId = currentFarm?.id;
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const { data, isLoading, error } = useQuery({
    queryKey: ['farm-billing', farmId],
    queryFn: () => farmService.getBilling(farmId!),
    enabled: !!farmId,
  });

  useEffect(() => {
    if (farmId) track('billing_page_view', { farm_id: farmId });
  }, [farmId]);

  useEffect(() => {
    const checkout = searchParams.get('checkout');
    if (checkout === 'success') {
      track('checkout_success');
      toast.success('Subscription updated. It may take a moment to reflect.');
      queryClient.invalidateQueries({ queryKey: ['farm-billing', farmId] });
      queryClient.invalidateQueries({ queryKey: ['farm-dashboard', farmId] });
      queryClient.invalidateQueries({ queryKey: ['farms'] });
      setSearchParams({}, { replace: true });
    } else if (checkout === 'canceled') {
      toast('Checkout canceled', { icon: 'ℹ️' });
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, queryClient, farmId]);

  const checkoutMutation = useMutation({
    mutationFn: () => farmService.billingCheckout(farmId!),
    onSuccess: ({ url }) => {
      track('checkout_started');
      if (url) window.location.href = url;
      else toast.error('No checkout URL returned');
    },
    onError: (err: { response?: { data?: { message?: string }; status?: number } }) => {
      toast.error(err.response?.data?.message ?? 'Could not start checkout');
    },
  });

  const portalMutation = useMutation({
    mutationFn: () => farmService.billingPortal(farmId!),
    onSuccess: ({ url }) => {
      if (url) window.location.href = url;
      else toast.error('No portal URL returned');
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message ?? 'Could not open billing portal');
    },
  });

  if (!farmId) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center text-gray-600">
        Select a farm from <span className="font-medium text-gray-900">Your farms</span> to view billing.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="size-10 animate-spin text-primary-600" aria-label="Loading" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-800">
        Could not load billing information.
      </div>
    );
  }

  const manage = canManageSubscription(data.myRole);
  const limitLabel = data.pigLimit == null ? 'Unlimited' : String(data.pigLimit);
  const isPro = data.plan === 'PRO';

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Billing & plan</h1>
        <p className="mt-1 text-gray-600">
          {currentFarm?.name} · {isPro ? 'Pro' : 'Free'} plan
        </p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
            <CreditCard className="size-6" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-gray-900">Pig capacity</h2>
            <p className="mt-1 text-sm text-gray-600">
              You are tracking <span className="font-medium text-gray-900">{data.pigCount}</span> pigs
              {data.pigLimit != null ? (
                <>
                  {' '}
                  (limit <span className="font-medium">{limitLabel}</span> on Free)
                </>
              ) : (
                ' with no plan limit.'
              )}
            </p>
            {data.plan === 'FREE' && data.nearLimit && !data.atLimit && (
              <p className="mt-2 text-sm text-amber-700">
                You are approaching the Free tier limit. Upgrade to add more pigs without interruption.
              </p>
            )}
            {data.atLimit && (
              <p className="mt-2 text-sm text-red-700">
                Free tier limit reached. Upgrade to Pro to add or import more pigs.
              </p>
            )}
          </div>
        </div>
      </div>

      {!isPro && (
        <div className="rounded-2xl border border-primary-200 bg-primary-50/80 p-6">
          <div className="flex items-start gap-3">
            <Sparkles className="size-6 shrink-0 text-primary-600" aria-hidden />
            <div>
              <h2 className="font-semibold text-gray-900">Pro</h2>
              <p className="mt-1 text-sm text-gray-700">
                Unlimited pigs, priority for future features, and self-serve billing when Stripe is configured.
              </p>
              {!manage && (
                <p className="mt-3 text-sm text-gray-600">Ask a farm owner or manager to upgrade this farm.</p>
              )}
              {manage && !data.stripeConfigured && (
                <p className="mt-3 text-sm text-gray-600">
                  Online checkout is not configured on this server. Contact your administrator to enable Stripe
                  (see backend environment variables).
                </p>
              )}
              {manage && data.stripeConfigured && (
                <button
                  type="button"
                  disabled={checkoutMutation.isPending}
                  onClick={() => checkoutMutation.mutate()}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {checkoutMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ExternalLink className="size-4" />
                  )}
                  Upgrade with Stripe
                </button>
              )}
              {manage && (
                <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-600">
                  <MessageCircle className="size-4 shrink-0 text-emerald-600" aria-hidden />
                  <span>
                    No card or Stripe in your country? Contact us for{' '}
                    <strong className="font-medium text-gray-800">bank transfer, mobile money, or group billing</strong>
                    {' '}
                    at{' '}
                    <a href={`mailto:${siteConfig.supportEmail}`} className="font-medium text-primary-700 hover:underline">
                      {siteConfig.supportEmail}
                    </a>
                    {whatsappHelpUrl() ? (
                      <>
                        {' '}
                        or{' '}
                        <a
                          href={whatsappHelpUrl()!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-primary-700 hover:underline"
                        >
                          WhatsApp
                        </a>
                      </>
                    ) : null}
                    .
                  </span>
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {isPro && manage && data.stripeConfigured && data.hasStripeCustomer && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-gray-900">Manage subscription</h2>
          <p className="mt-1 text-sm text-gray-600">Update payment method or cancel in the Stripe customer portal.</p>
          <button
            type="button"
            disabled={portalMutation.isPending}
            onClick={() => portalMutation.mutate()}
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
          >
            {portalMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <ExternalLink className="size-4" />}
            Open billing portal
          </button>
        </div>
      )}

      {isPro && manage && data.stripeConfigured && !data.hasStripeCustomer && (
        <p className="text-sm text-gray-600">
          Pro is active. Customer portal becomes available after the first successful Stripe checkout for this farm.
        </p>
      )}
    </div>
  );
}
