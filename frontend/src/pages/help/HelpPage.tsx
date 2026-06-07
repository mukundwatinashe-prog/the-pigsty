import { Link } from 'react-router-dom';
import {
  PiggyBank,
  CreditCard,
  Users,
  FileSpreadsheet,
  Mail,
  HelpCircle,
} from 'lucide-react';
import { mailtoSupport, siteConfig } from '../../lib/siteConfig';

const faqs = [
  {
    q: 'How do I add pigs?',
    a: 'Open Pigs → Add pig, or use Import from Excel (Grower and Enterprise plans) to bulk-load up to 5,000 rows.',
  },
  {
    q: 'What is included on the Free plan?',
    a: 'Up to 50 pigs, one user, full pig/pen/weight tracking, feed logging, and activity log export. Reports, financials, bulk import, and team invites require Grower or Enterprise.',
  },
  {
    q: 'How do I upgrade?',
    a: 'Billing in the sidebar → choose Grower or Enterprise → complete checkout with Stripe. Your farm unlocks paid features as soon as payment succeeds.',
  },
  {
    q: 'How do I invite my team?',
    a: 'On Grower or Enterprise, go to Settings → Team members → Invite. The person receives an email with a link to join your farm.',
  },
  {
    q: 'I forgot my password',
    a: 'On the login page, choose Forgot password and enter your email. You will receive a 6-digit code (valid 15 minutes) to set a new password.',
  },
  {
    q: 'Where is my data stored?',
    a: 'Your farm data is stored securely to run the service. You can export PDF and Excel reports anytime. We do not sell your herd lists.',
  },
];

const quickLinks = [
  { to: '/pigs', label: 'Pigs', icon: PiggyBank },
  { to: '/billing', label: 'Billing & plans', icon: CreditCard },
  { to: '/settings', label: 'Farm settings & team', icon: Users },
  { to: '/reports', label: 'Reports', icon: FileSpreadsheet },
];

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="rounded-2xl border border-primary-200 bg-primary-50/50 p-6">
        <div className="flex items-start gap-3">
          <HelpCircle className="size-8 shrink-0 text-primary-600" aria-hidden />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Help &amp; FAQ</h1>
            <p className="mt-2 text-sm text-gray-700">
              Quick answers for using The Pigsty. Still stuck? Email us — we are happy to help.
            </p>
          </div>
        </div>
      </header>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Quick links</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {quickLinks.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-800 shadow-sm hover:border-primary-200 hover:bg-primary-50/40"
            >
              <Icon className="size-5 text-primary-600" aria-hidden />
              {label}
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-8 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Common questions</h2>
        {faqs.map(({ q, a }) => (
          <article key={q} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-gray-900">{q}</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-700">{a}</p>
          </article>
        ))}
      </section>

      <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <Mail className="size-6 shrink-0 text-primary-600" aria-hidden />
          <div>
            <h2 className="font-semibold text-gray-900">Contact support</h2>
            <p className="mt-2 text-sm text-gray-700">
              Email{' '}
              <a href={`mailto:${siteConfig.supportEmail}`} className="font-medium text-primary-700 hover:underline">
                {siteConfig.supportEmail}
              </a>{' '}
              or use the contact form on the{' '}
              <Link to="/" className="font-medium text-primary-700 hover:underline">
                home page
              </Link>
              .
            </p>
            <a
              href={mailtoSupport('The Pigsty support request')}
              className="mt-4 inline-flex min-h-[44px] items-center rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700"
            >
              Email support
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
