import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CreditCard, ExternalLink, Loader2, Sparkles, MessageCircle } from 'lucide-react';
import { siteConfig, sitePricing, whatsappHelpUrl } from '../../lib/siteConfig';
import toast from 'react-hot-toast';
import { useFarm } from '../../context/FarmContext';
import { farmService } from '../../services/farm.service';
import { track } from '../../lib/analytics';
import { isNativeApp } from '../../lib/native';

function canManageSubscription(role: string) {
  return role === 'OWNER' || role === 'FARM_MANAGER';
}

type CheckoutTarget = { plan: 'GROWER' | 'ENTERPRISE'; startTrial?: boolean } | null;

export default function BillingPage() {
  const { currentFarm } = useFarm();
  const farmId = currentFarm?.id;
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [checkoutTarget, setCheckoutTarget] = useState<CheckoutTarget>(null);

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
    mutationFn: (target: NonNullable<CheckoutTarget>) =>
      farmService.billingCheckout(farmId!, target.plan, { startTrial: target.startTrial }),
    onSuccess: ({ url }) => {
      track('checkout_started');
      setCheckoutTarget(null);
      if (url) window.location.href = url;
      else toast.error('No checkout URL returned');
    },
    onError: (err: { response?: { data?: { message?: string }; status?: number } }) => {
      setCheckoutTarget(null);
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

  function startCheckout(target: NonNullable<CheckoutTarget>) {
    setCheckoutTarget(target);
    checkoutMutation.mutate(target);
  }

  function isCheckingOut(target: NonNullable<CheckoutTarget>) {
    if (!checkoutMutation.isPending || !checkoutTarget) return false;
    return (
      checkoutTarget.plan === target.plan && Boolean(checkoutTarget.startTrial) === Boolean(target.startTrial)
    );
  }

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
  // Apple/Google require their own in-app purchase system for digital subscriptions
  // bought inside the app. We keep subscriptions web-only, so on native we hide all
  // purchase/checkout UI and show an informational notice instead.
  const purchasingEnabled = !isNativeApp();
  const limitLabel = data.pigLimit == null ? 'Unlimited' : String(data.pigLimit);
  const isGrower = data.plan === 'GROWER';
  const isEnterprise = data.plan === 'ENTERPRISE';
  const isFree = data.plan === 'FREE';
  const currentPlanLabel =
    data.planLabel ?? (isFree ? 'Smallholder' : isGrower ? 'Grower' : 'Enterprise');

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Billing & plan</h1>
        <p className="mt-1 text-gray-600">
          {currentFarm?.name} · {currentPlanLabel} plan
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
                  (limit <span className="font-medium">{limitLabel}</span> on Smallholder)
                </>
              ) : (
                ' with no plan limit.'
              )}
            </p>
            {isFree && data.nearLimit && !data.atLimit && (
              <p className="mt-2 text-sm text-amber-700">
                You are approaching the Smallholder tier limit. Upgrade to continue scaling.
              </p>
            )}
            {data.atLimit && (
              <p className="mt-2 text-sm text-red-700">
                Plan limit reached. Upgrade to continue adding or importing pigs.
              </p>
            )}
          </div>
        </div>
      </div>

      {!purchasingEnabled && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-gray-900">Manage your subscription</h2>
          <p className="mt-1 text-sm text-gray-600">
            Plans and payments are managed on our website. To start a trial, upgrade, or change your
            plan, sign in at <span className="font-medium text-gray-900">the-pigsty.org</span> from a
            web browser. Any changes will appear here automatically.
          </p>
        </div>
      )}

      {isFree && purchasingEnabled && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Upgrade this farm</h2>
            <p className="mt-1 text-sm text-gray-600">
              Choose a free trial, subscribe to Grower at {sitePricing.growerMonthly}/month, or go straight to
              Enterprise at {sitePricing.enterpriseMonthly}/month.
            </p>
          </div>

          <div className="rounded-2xl border border-primary-200 bg-primary-50/80 p-6">
            <div className="flex items-start gap-3">
              <Sparkles className="size-6 shrink-0 text-primary-600" aria-hidden />
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-gray-900">{sitePricing.growerTrialDays}-day Grower free trial</h3>
                <p className="mt-1 text-sm text-gray-700">
                  Try Grower features free for {sitePricing.growerTrialDays} days — reports, imports, and up to 5 users. A card is required;
                  after the trial it becomes {sitePricing.growerMonthly}/month unless you cancel.
                </p>
                {data.growerTrialUsed ? (
                  <p className="mt-3 text-sm text-amber-800">
                    Your account email has already used its one free trial. Subscribe to Grower or Enterprise below.
                  </p>
                ) : (
                  <p className="mt-3 text-sm text-gray-600">One free trial per account email address.</p>
                )}
                {manage && data.stripeConfigured && data.canStartGrowerTrial && (
                  <button
                    type="button"
                    disabled={checkoutMutation.isPending}
                    onClick={() => startCheckout({ plan: 'GROWER', startTrial: true })}
                    className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                  >
                    {isCheckingOut({ plan: 'GROWER', startTrial: true }) ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <ExternalLink className="size-4" />
                    )}
                    Start {sitePricing.growerTrialDays}-day free trial
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="font-semibold text-gray-900">Grower — {sitePricing.growerMonthly}/month</h3>
            <p className="mt-1 text-sm text-gray-600">
              Up to 500 pigs, all reports, mass import, and up to 5 users. Billed monthly from day one — no trial.
            </p>
            {manage && data.stripeConfigured && (
              <button
                type="button"
                disabled={checkoutMutation.isPending}
                onClick={() => startCheckout({ plan: 'GROWER', startTrial: false })}
                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-primary-300 bg-white px-4 py-2.5 text-sm font-medium text-primary-800 hover:bg-primary-50 disabled:opacity-50"
              >
                {isCheckingOut({ plan: 'GROWER', startTrial: false }) ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ExternalLink className="size-4" />
                )}
                Subscribe to Grower
              </button>
            )}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="font-semibold text-gray-900">Enterprise — {sitePricing.enterpriseMonthly}/month</h3>
            <p className="mt-1 text-sm text-gray-600">
              Unlimited pigs, unlimited users, and priority support for larger operations.
            </p>
            {manage && data.stripeConfigured && (
              <button
                type="button"
                disabled={checkoutMutation.isPending}
                onClick={() => startCheckout({ plan: 'ENTERPRISE' })}
                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
              >
                {isCheckingOut({ plan: 'ENTERPRISE' }) ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ExternalLink className="size-4" />
                )}
                Subscribe to Enterprise
              </button>
            )}
          </div>

          {!manage && (
            <p className="text-sm text-gray-600">Ask a farm owner or manager to upgrade this farm.</p>
          )}
          {manage && !data.stripeConfigured && (
            <p className="text-sm text-gray-600">
              Online checkout is not configured on this server. Contact your administrator to enable Stripe.
            </p>
          )}
          {manage && (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-600">
              <MessageCircle className="size-4 shrink-0 text-emerald-600" aria-hidden />
              <span>
                No card or Stripe in your country? Contact us for{' '}
                <strong className="font-medium text-gray-800">bank transfer, mobile money, or group billing</strong>{' '}
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
      )}

      {isGrower && purchasingEnabled && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-gray-900">Upgrade to Enterprise — {sitePricing.enterpriseMonthly}/month</h2>
          <p className="mt-1 text-sm text-gray-600">
            Unlimited pigs and users. Your existing subscription will be upgraded with prorated billing.
          </p>
          {manage && data.stripeConfigured && (
            <button
              type="button"
              disabled={checkoutMutation.isPending}
              onClick={() => startCheckout({ plan: 'ENTERPRISE' })}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {isCheckingOut({ plan: 'ENTERPRISE' }) ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ExternalLink className="size-4" />
              )}
              Upgrade to Enterprise
            </button>
          )}
          {!manage && (
            <p className="mt-3 text-sm text-gray-600">Ask a farm owner or manager to upgrade this farm.</p>
          )}
        </div>
      )}

      {(isGrower || isEnterprise) && manage && data.stripeConfigured && data.hasStripeCustomer && purchasingEnabled && (
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

      {(isGrower || isEnterprise) && manage && data.stripeConfigured && !data.hasStripeCustomer && purchasingEnabled && (
        <p className="text-sm text-gray-600">
          Paid plan is active. Customer portal becomes available after the first successful Stripe checkout for this farm.
        </p>
      )}
    </div>
  );
}
