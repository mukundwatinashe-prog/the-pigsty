import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="mx-auto max-w-2xl">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700">
          <ArrowLeft className="size-4" /> Back to home
        </Link>
        <article className="mt-8 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm prose prose-gray max-w-none">
          <h1 className="text-2xl font-bold text-gray-900">Terms of service</h1>
          <p className="mt-2 text-sm text-gray-500">Last updated: {new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          <p className="mt-6 text-gray-700">
            By using The Pigsty you agree to these terms. Replace this document with terms reviewed by your counsel before offering the product to paying customers.
          </p>
          <h2 className="mt-8 text-lg font-semibold text-gray-900">The service</h2>
          <p className="mt-2 text-gray-700">
            The Pigsty is provided “as is”. We strive for reliability but do not guarantee uninterrupted access. Features and limits (including Free vs Pro) may change with notice where reasonable.
          </p>
          <h2 className="mt-8 text-lg font-semibold text-gray-900">Your data</h2>
          <p className="mt-2 text-gray-700">
            You retain ownership of your farm data. You are responsible for the accuracy of records and for complying with local animal welfare and data regulations.
          </p>
          <h2 className="mt-8 text-lg font-semibold text-gray-900">Subscriptions</h2>
          <p className="mt-2 text-gray-700">
            Pro subscriptions are billed through Stripe according to the plan you select. Cancellations and refunds follow Stripe and the policies you publish at checkout.
          </p>
          <h2 className="mt-8 text-lg font-semibold text-gray-900">Limitation of liability</h2>
          <p className="mt-2 text-gray-700">
            To the maximum extent permitted by law, The Pigsty and its operators are not liable for indirect or consequential losses arising from use of the software. Farming decisions remain your responsibility.
          </p>
        </article>
      </div>
    </div>
  );
}
