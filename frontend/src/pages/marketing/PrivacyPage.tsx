import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="mx-auto max-w-2xl">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700">
          <ArrowLeft className="size-4" /> Back to home
        </Link>
        <article className="mt-8 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm prose prose-gray max-w-none">
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
            We may use privacy-friendly or first-party analytics to understand product usage. You can configure Google Analytics by setting <code className="rounded bg-gray-100 px-1">VITE_GA_MEASUREMENT_ID</code> in your deployment.
          </p>
          <h2 className="mt-8 text-lg font-semibold text-gray-900">Payments</h2>
          <p className="mt-2 text-gray-700">
            Subscriptions are processed by Stripe. We do not store full card numbers on our servers. Stripe’s privacy policy applies to payment data.
          </p>
          <h2 className="mt-8 text-lg font-semibold text-gray-900">Contact</h2>
          <p className="mt-2 text-gray-700">
            For privacy requests, contact your farm administrator or the operator of this Pigsty deployment. Replace this section with your legal entity and contact email before production.
          </p>
        </article>
      </div>
    </div>
  );
}
