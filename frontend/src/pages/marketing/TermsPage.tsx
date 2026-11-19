import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { siteConfig, sitePricing } from '../../lib/siteConfig';

/**
 * Date these terms last changed in substance. Hard-coded on purpose: rendering
 * `new Date()` here would silently re-date the document every single day, which
 * is misleading for a legal page. Bump it by hand when the wording changes.
 */
const LAST_UPDATED = '19 November 2026';

/** Sole trader operating the service. Shown to satisfy UK trader-identity rules, */
/** which require a trading name and a geographic address, not just an email. */
const TRADER_NAME = 'Tinashe Mukundwa';
const TRADER_ADDRESS = '16 Shawfield Crescent, ML8 5JH, Scotland, United Kingdom';

export default function TermsPage() {
  return (
    <div className="min-h-dvh bg-gray-50 px-safe pb-safe pt-safe">
      <div className="mx-auto max-w-2xl py-8 sm:py-12">
        <Link
          to="/"
          className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-medium text-primary-600 hover:text-primary-700"
        >
          <ArrowLeft className="size-4" aria-hidden /> Back to home
        </Link>
        <article className="prose prose-gray mt-6 max-w-none rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:mt-8 sm:p-8">
          <h1 className="text-2xl font-bold text-gray-900">Terms of service</h1>
          <p className="mt-2 text-sm text-gray-500">Last updated: {LAST_UPDATED}</p>
          <p className="mt-6 text-gray-700">
            These terms govern your use of The Pigsty. By creating an account or using the service you
            agree to them. Please read the sections on subscriptions, cancellation, and refunds
            carefully — they explain what you pay and how to stop paying.
          </p>

          <h2 className="mt-8 text-lg font-semibold text-gray-900">Who we are</h2>
          <p className="mt-2 text-gray-700">
            The Pigsty is operated by {TRADER_NAME}, a sole trader based in Scotland, United Kingdom.
            Our registered trading address is {TRADER_ADDRESS}. You can reach us at{' '}
            <a href={`mailto:${siteConfig.supportEmail}`} className="font-medium text-primary-700 hover:underline">
              {siteConfig.supportEmail}
            </a>
            .
          </p>

          <h2 className="mt-8 text-lg font-semibold text-gray-900">The service</h2>
          <p className="mt-2 text-gray-700">
            The Pigsty is record-keeping software for pig farms. It is provided “as is”. We work to
            keep it reliable but do not guarantee uninterrupted access. Features and plan limits
            (Smallholder, Grower, and Enterprise) may change with reasonable notice.
          </p>

          <h2 className="mt-8 text-lg font-semibold text-gray-900">Your data</h2>
          <p className="mt-2 text-gray-700">
            You retain ownership of your farm data. You are responsible for the accuracy of your
            records and for complying with animal welfare and data protection rules that apply to
            you. You can export your records at any time. See our{' '}
            <Link to="/privacy" className="font-medium text-primary-700 hover:underline">
              privacy policy
            </Link>{' '}
            for how we handle personal data.
          </p>

          <h2 className="mt-8 text-lg font-semibold text-gray-900">Plans and payment</h2>
          <p className="mt-2 text-gray-700">
            Smallholder is free. Grower costs {sitePricing.growerMonthly} per month and Enterprise
            costs {sitePricing.enterpriseMonthly} per month. Paid plans are billed monthly in advance
            through Stripe, our payment processor, and renew automatically until cancelled. Prices
            include any applicable taxes unless stated otherwise at checkout.
          </p>
          <p className="mt-2 text-gray-700">
            We offer a {sitePricing.growerTrialDays}-day free trial of Grower, limited to one trial
            per account email address. A payment card is required to start it. Unless you cancel
            before the trial ends, it converts to a paid monthly subscription at{' '}
            {sitePricing.growerMonthly} per month. The free Smallholder plan is also there to let you
            try the product before committing to a paid plan.
          </p>

          <h2 className="mt-8 text-lg font-semibold text-gray-900">Cancelling your subscription</h2>
          <p className="mt-2 text-gray-700">
            You can cancel at any time from <strong>Billing → Cancel subscription</strong>, in the app
            or on the website. No phone call or email is required. Your paid features stay active
            until the end of the billing period you have already paid for, after which the farm
            returns to the free Smallholder plan. You can reverse a pending cancellation before it
            takes effect using <strong>Keep my subscription</strong>. Cancelling never deletes your
            data — your pigs and records remain available on the free plan.
          </p>

          <h2 className="mt-8 text-lg font-semibold text-gray-900">Refunds</h2>
          <p className="mt-2 text-gray-700">
            If you are a consumer in the UK or EEA, you have a statutory right to cancel a new
            subscription within 14 days of starting it and receive a refund, subject to a deduction
            for service already supplied where you asked us to start immediately.
          </p>
          <p className="mt-2 text-gray-700">
            In addition to that right, if you subscribe by accident we will refund a single payment —
            email us and we will put it right. Beyond that one payment, subscriptions already used are
            not generally refunded; the free Smallholder plan and the{' '}
            {sitePricing.growerTrialDays}-day Grower trial exist so you can evaluate the product
            before you commit. We will always consider genuine billing errors on our side. Nothing in
            this section affects your statutory rights.
          </p>

          <h2 className="mt-8 text-lg font-semibold text-gray-900">Acceptable use</h2>
          <p className="mt-2 text-gray-700">
            Do not use The Pigsty to break the law, to attempt to access other farms' data, or to
            disrupt the service for others. We may suspend accounts that do.
          </p>

          <h2 className="mt-8 text-lg font-semibold text-gray-900">Limitation of liability</h2>
          <p className="mt-2 text-gray-700">
            Nothing in these terms excludes or limits our liability where it would be unlawful to do
            so, including liability for death or personal injury caused by negligence, or for fraud.
            Subject to that, and to the maximum extent permitted by law, we are not liable for
            indirect or consequential losses arising from use of the software. Farming decisions
            remain your responsibility.
          </p>

          <h2 className="mt-8 text-lg font-semibold text-gray-900">Changes to these terms</h2>
          <p className="mt-2 text-gray-700">
            We may update these terms from time to time. If a change materially affects you we will
            give reasonable notice, and the “last updated” date above will change.
          </p>

          <h2 className="mt-8 text-lg font-semibold text-gray-900">Governing law</h2>
          <p className="mt-2 text-gray-700">
            These terms are governed by the law of Scotland, and disputes fall to the Scottish courts.
            If you are a consumer resident elsewhere in the UK or the EEA, you keep the benefit of any
            mandatory consumer protections of the country you live in.
          </p>

          <h2 className="mt-8 text-lg font-semibold text-gray-900">Contact</h2>
          <p className="mt-2 text-gray-700">
            Questions about these terms? Email us at{' '}
            <a href={`mailto:${siteConfig.supportEmail}`} className="font-medium text-primary-700 hover:underline">
              {siteConfig.supportEmail}
            </a>
            .
          </p>
        </article>
      </div>
    </div>
  );
}
