import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { siteConfig } from '../../lib/siteConfig';

export default function PrivacyPage() {
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
          <h1 className="text-2xl font-bold text-gray-900">Privacy policy</h1>
          <p className="mt-2 text-sm text-gray-500">Last updated: {new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          <p className="mt-6 text-gray-700">
            The Pigsty (“we”, “us”) respects your privacy. This policy describes how we handle information when you use our farm management software.
          </p>
          <h2 className="mt-8 text-lg font-semibold text-gray-900">Your farm data belongs to you</h2>
          <p className="mt-2 text-gray-700">
            You can generate <strong className="font-medium text-gray-900">PDF and Excel reports</strong> from the app to keep copies on your device or share with buyers, vets, or lenders. We do not sell your herd lists. Account and farm data are stored to run The Pigsty — not for unrelated marketing.
          </p>
          <h2 className="mt-8 text-lg font-semibold text-gray-900">Information you provide</h2>
          <p className="mt-2 text-gray-700">
            We store account details (such as name and email), farm and livestock data you enter, and files you upload (for example import spreadsheets). This data is used to provide the service and support your account.
          </p>
          <h2 className="mt-8 text-lg font-semibold text-gray-900">Analytics</h2>
          <p className="mt-2 text-gray-700">
            We may use privacy-friendly analytics to understand how the product is used (for example page views and feature usage). We do not use analytics to sell your farm data.
          </p>
          <h2 className="mt-8 text-lg font-semibold text-gray-900">Payments</h2>
          <p className="mt-2 text-gray-700">
            Subscriptions are processed by Stripe. We do not store full card numbers on our servers. Stripe’s privacy policy applies to payment data.
          </p>
          <h2 className="mt-8 text-lg font-semibold text-gray-900">Contact</h2>
          <p className="mt-2 text-gray-700">
            For privacy requests, contact us at{' '}
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
