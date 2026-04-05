import { useState, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  PiggyBank,
  Scale,
  Users,
  Shield,
  Upload,
  CheckCircle2,
  Loader2,
  Download,
  MessageCircle,
  HeartHandshake,
  Globe,
  Menu,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { BrandLogo } from '../../components/BrandLogo';
import { track } from '../../lib/analytics';
import { mailtoSupport, siteConfig, whatsappHelpUrl } from '../../lib/siteConfig';

const benefits = [
  {
    icon: PiggyBank,
    title: 'Know every pig',
    text: 'Tags, breed, stage, and health in one place — no scattered notebooks.',
  },
  {
    icon: Upload,
    title: 'Import from Excel',
    text: 'Use our free template, fill it offline, then upload when you are ready.',
  },
  {
    icon: Scale,
    title: 'Track growth',
    text: 'Log weights and see progress so feeding and sales decisions are clearer.',
  },
  {
    icon: Users,
    title: 'Team roles',
    text: 'Invite people you trust; everyone sees what they need.',
  },
  {
    icon: Globe,
    title: 'Home or abroad',
    text: 'Run or support a farm back home with the same records your team uses on the ground.',
  },
  {
    icon: Shield,
    title: 'Start free',
    text: 'No credit card to try the free tier. Upgrade when your herd outgrows it.',
  },
];

const tiers = [
  {
    name: 'Free',
    price: '$0',
    period: 'per farm',
    desc: 'For smallholders getting organised.',
    features: [
      'Up to 100 pigs per farm',
      'Pens, weights, import from Excel',
      '2 team members',
      'No credit card required',
    ],
    cta: 'Create free account',
    href: '/register',
    highlight: false,
  },
  {
    name: 'Pro',
    price: 'Subscription',
    period: 'card or contact us',
    desc: 'Unlimited pigs when you outgrow the free herd size.',
    features: [
      'Unlimited pigs',
      'Everything in Free',
      'Stripe checkout where cards work',
      'Ask us about bank transfer or mobile money in your country',
    ],
    cta: 'Start free — upgrade in app',
    href: '/register',
    highlight: true,
  },
  {
    name: 'Groups & co-ops',
    price: 'Let’s talk',
    period: 'custom',
    desc: 'Programmes or co-ops rolling out to many farms.',
    features: ['Training & onboarding', 'Reporting for supervisors', 'Custom arrangements'],
    cta: siteConfig.supportEmail ? 'Email us' : 'Get updates below',
    href: siteConfig.supportEmail
      ? `mailto:${encodeURIComponent(siteConfig.supportEmail)}?subject=${encodeURIComponent('The Pigsty — groups / co-ops')}`
      : '#lead',
    highlight: false,
    external: true,
  },
];

export default function LandingPage() {
  const { user, loading } = useAuth();
  const [leadEmail, setLeadEmail] = useState('');
  const [leadMsg, setLeadMsg] = useState('');
  const [leadStatus, setLeadStatus] = useState<'idle' | 'sending' | 'ok' | 'err'>('idle');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const waUrl = whatsappHelpUrl();

  useEffect(() => {
    if (!loading && !user) track('landing_view');
  }, [loading, user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="size-10 animate-spin text-primary-600" aria-label="Loading" />
      </div>
    );
  }
  if (user) {
    return <Navigate to="/farms" replace />;
  }

  const submitLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadEmail.trim()) return;
    setLeadStatus('sending');
    try {
      const res = await fetch('/api/public/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: leadEmail.trim(), message: leadMsg.trim() || undefined, source: 'landing' }),
      });
      if (!res.ok) throw new Error('failed');
      setLeadStatus('ok');
      track('lead_captured', { source: 'landing' });
      setLeadEmail('');
      setLeadMsg('');
    } catch {
      setLeadStatus('err');
    }
  };

  const onDownloadTemplate = () => {
    track('template_download', { source: 'landing' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50/80 via-white to-accent-50/40 pb-safe text-gray-900">
      <header className="sticky top-0 z-20 border-b border-gray-200/80 bg-white/90 pt-[env(safe-area-inset-top,0px)] backdrop-blur-sm">
        <div className="relative mx-auto max-w-6xl px-safe">
          <div className="flex items-center justify-between gap-3 py-3 sm:py-4">
            <Link to="/" className="flex min-w-0 items-center gap-2 font-bold text-gray-900">
              <BrandLogo size="md" />
              <span className="truncate">The Pigsty</span>
            </Link>
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <button
                type="button"
                className="inline-flex h-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 sm:hidden"
                aria-expanded={mobileMenuOpen}
                aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                onClick={() => setMobileMenuOpen((o) => !o)}
              >
                {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
              </button>
              <nav className="hidden items-center gap-2 text-sm font-medium sm:flex sm:gap-3">
                <a href="#template" className="text-gray-600 hover:text-primary-700">
                  Free template
                </a>
                <a href="#pricing" className="text-gray-600 hover:text-primary-700">
                  Pricing
                </a>
                {waUrl && (
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-emerald-700 hover:bg-emerald-50"
                    onClick={() => track('whatsapp_click', { placement: 'header' })}
                  >
                    <MessageCircle className="size-4" aria-hidden />
                    WhatsApp
                  </a>
                )}
                <Link to="/login" className="rounded-lg px-3 py-2 text-gray-700 hover:bg-gray-100">
                  Sign in
                </Link>
                <Link
                  to="/register"
                  className="rounded-xl bg-primary-600 px-4 py-2.5 text-white shadow-sm hover:bg-primary-700"
                  onClick={() => track('cta_register_click', { placement: 'header' })}
                >
                  Get started
                </Link>
              </nav>
              <div className="flex items-center gap-2 sm:hidden">
                <Link
                  to="/login"
                  className="min-h-[44px] rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  Sign in
                </Link>
                <Link
                  to="/register"
                  className="min-h-[44px] rounded-xl bg-primary-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700"
                  onClick={() => track('cta_register_click', { placement: 'header' })}
                >
                  Get started
                </Link>
              </div>
            </div>
          </div>
          {mobileMenuOpen && (
            <nav
              className="flex flex-col gap-1 border-t border-gray-100 py-3 sm:hidden"
              aria-label="Page sections"
            >
              <a
                href="#template"
                className="min-h-[44px] rounded-lg px-3 py-3 text-sm font-medium text-gray-700 hover:bg-primary-50 hover:text-primary-800"
                onClick={() => setMobileMenuOpen(false)}
              >
                Free template
              </a>
              <a
                href="#pricing"
                className="min-h-[44px] rounded-lg px-3 py-3 text-sm font-medium text-gray-700 hover:bg-primary-50 hover:text-primary-800"
                onClick={() => setMobileMenuOpen(false)}
              >
                Pricing
              </a>
              {waUrl && (
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-lg px-3 py-3 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    track('whatsapp_click', { placement: 'header_mobile' });
                  }}
                >
                  <MessageCircle className="size-4" aria-hidden />
                  WhatsApp
                </a>
              )}
            </nav>
          )}
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-safe py-12 sm:py-16">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-primary-700">
              Pig records for smallholders
            </p>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
              Herd records that stay clear as you grow.
            </h1>
            <p className="mt-5 text-lg text-gray-600 sm:text-xl">
              Simple software for <strong className="font-semibold text-gray-800">smallholder and family pig farms</strong> — starting in{' '}
              <strong className="font-semibold text-gray-800">Zimbabwe</strong>, open to farmers anywhere who want honest tools, not bloat.
            </p>
            <ul className="mx-auto mt-6 flex max-w-lg flex-col gap-2 text-left text-sm text-gray-600 sm:text-base">
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary-600" aria-hidden />
                <span>
                  <strong className="text-gray-800">Free up to 100 pigs</strong> per farm — no card required.
                </span>
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary-600" aria-hidden />
                <span>
                  <strong className="text-gray-800">Diaspora-friendly</strong> — same records for you and your team on the ground.
                </span>
              </li>
            </ul>
            <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
              <Link
                to="/register"
                className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-primary-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg hover:bg-primary-700 sm:w-auto"
                onClick={() => track('cta_register_click', { placement: 'hero' })}
              >
                Create your free account
              </Link>
              <a
                href="/api/public/import-template"
                download
                onClick={onDownloadTemplate}
                className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border-2 border-gray-200 bg-white px-8 py-3.5 text-base font-semibold text-gray-800 hover:border-primary-200 sm:w-auto"
              >
                <Download className="size-5 shrink-0" aria-hidden />
                Download free Excel template
              </a>
            </div>
            <p className="mt-4 text-sm text-gray-500">Same template works after you sign up.</p>
            <div className="mx-auto mt-8 flex max-w-xl flex-wrap items-center justify-center gap-x-8 gap-y-2 border-t border-gray-100 pt-8 text-xs font-medium text-gray-500 sm:text-sm">
              <span className="inline-flex items-center gap-1.5">
                <HeartHandshake className="size-4 text-primary-600" aria-hidden />
                Built with farmers in mind
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Globe className="size-4 text-primary-600" aria-hidden />
                On-farm & abroad
              </span>
            </div>
          </div>
        </section>

        <section id="template" className="border-y border-primary-100 bg-primary-50/50 py-12 scroll-mt-24">
          <div className="mx-auto max-w-6xl px-4 sm:flex sm:items-center sm:justify-between sm:gap-8">
            <div className="max-w-xl">
              <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">Start with our import template</h2>
              <p className="mt-2 text-gray-600">
                Download the file our app uses, fill it when it suits you, then upload after you register. No account needed to download.
              </p>
            </div>
            <div className="mt-6 flex shrink-0 flex-col gap-3 sm:mt-0">
              <a
                href="/api/public/import-template"
                download
                onClick={onDownloadTemplate}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-primary-600 px-6 py-3.5 font-semibold text-white shadow-md hover:bg-primary-700"
              >
                <Download className="size-5" aria-hidden />
                Get the template (.xlsx)
              </a>
              <Link
                to="/register"
                className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-gray-200 bg-white px-6 py-3.5 font-semibold text-gray-800 hover:bg-gray-50"
                onClick={() => track('cta_register_click', { placement: 'template_section' })}
              >
                Create free account →
              </Link>
            </div>
          </div>
        </section>

        <section className="border-y border-gray-100 bg-white py-12">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-center text-2xl font-bold text-gray-900 sm:text-3xl">Why The Pigsty</h2>
            <p className="mx-auto mt-2 max-w-xl text-center text-gray-600">
              Practical tools for real farms — less admin, more time with your animals.
            </p>
            <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {benefits.map(({ icon: Icon, title, text }) => (
                <li key={title} className="rounded-2xl border border-gray-100 bg-gray-50/50 p-6 shadow-sm">
                  <div className="flex size-11 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
                    <Icon className="size-5" />
                  </div>
                  <h3 className="mt-4 font-semibold text-gray-900">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-600">{text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="pricing" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-14 sm:py-16">
          <h2 className="text-center text-2xl font-bold text-gray-900 sm:text-3xl">Pricing</h2>
          <p className="mx-auto mt-2 max-w-lg text-center text-gray-600">
            Start free. Pro adds unlimited pigs. No card? We can discuss other payment options where possible.
          </p>
          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {tiers.map((t) => (
              <div
                key={t.name}
                className={`flex flex-col rounded-2xl border-2 p-6 shadow-sm ${
                  t.highlight ? 'border-primary-400 bg-primary-50/40 ring-2 ring-primary-200' : 'border-gray-100 bg-white'
                }`}
              >
                <h3 className="text-lg font-bold text-gray-900">{t.name}</h3>
                <p className="mt-1 text-3xl font-extrabold text-gray-900">{t.price}</p>
                <p className="text-sm text-gray-500">{t.period}</p>
                <p className="mt-3 text-sm text-gray-600">{t.desc}</p>
                <ul className="mt-4 flex-1 space-y-2">
                  {t.features.map((f) => (
                    <li key={f} className="flex gap-2 text-sm text-gray-700">
                      <CheckCircle2 className="size-4 shrink-0 text-primary-600" />
                      {f}
                    </li>
                  ))}
                </ul>
                {t.external ? (
                  <a
                    href={t.href}
                    className="mt-6 block w-full min-h-[44px] rounded-xl border-2 border-gray-200 py-3 text-center text-sm font-semibold text-gray-800 hover:bg-gray-50"
                  >
                    {t.cta}
                  </a>
                ) : (
                  <Link
                    to={t.href}
                    className={`mt-6 block w-full min-h-[44px] rounded-xl py-3 text-center text-sm font-semibold ${
                      t.highlight ? 'bg-primary-600 text-white hover:bg-primary-700' : 'border-2 border-gray-200 text-gray-800 hover:bg-gray-50'
                    }`}
                    onClick={() => track('cta_register_click', { placement: `pricing_${t.name}` })}
                  >
                    {t.cta}
                  </Link>
                )}
              </div>
            ))}
          </div>
        </section>

        <section id="lead" className="border-t border-gray-100 bg-primary-600 py-14 text-white scroll-mt-24">
          <div className="mx-auto max-w-xl px-4 text-center">
            <h2 className="text-2xl font-bold">Questions?</h2>
            <p className="mt-2 text-primary-100">Leave your email for updates, or say where you farm and herd size.</p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              {waUrl && (
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 font-semibold text-emerald-700 hover:bg-emerald-50 sm:w-auto"
                  onClick={() => track('whatsapp_click', { placement: 'lead_section' })}
                >
                  <MessageCircle className="size-5" aria-hidden />
                  Chat on WhatsApp
                </a>
              )}
              {siteConfig.supportEmail && (
                <a
                  href={mailtoSupport('The Pigsty — question from website', '') ?? '#'}
                  className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl border border-white/40 px-6 py-3 font-semibold text-white hover:bg-white/10 sm:w-auto"
                >
                  Email {siteConfig.supportEmail}
                </a>
              )}
            </div>
            <form onSubmit={submitLead} className="mt-8 space-y-3 text-left">
              <input
                type="email"
                required
                value={leadEmail}
                onChange={(e) => setLeadEmail(e.target.value)}
                placeholder="your.email@example.com"
                className="w-full rounded-xl border border-white/30 bg-white/10 px-4 py-3 text-white placeholder:text-primary-200 outline-none focus:ring-2 focus:ring-white"
              />
              <textarea
                value={leadMsg}
                onChange={(e) => setLeadMsg(e.target.value)}
                placeholder="Optional: country, herd size, or how you keep pigs today"
                rows={3}
                className="w-full rounded-xl border border-white/30 bg-white/10 px-4 py-3 text-white placeholder:text-primary-200 outline-none focus:ring-2 focus:ring-white"
              />
              <button
                type="submit"
                disabled={leadStatus === 'sending'}
                className="w-full min-h-[48px] rounded-xl bg-white py-3 font-semibold text-primary-700 hover:bg-primary-50 disabled:opacity-60"
              >
                {leadStatus === 'sending' ? 'Sending…' : 'Send'}
              </button>
              {leadStatus === 'ok' && <p className="text-center text-sm text-primary-100">Thank you — we’ll be in touch.</p>}
              {leadStatus === 'err' && (
                <p className="text-center text-sm text-amber-200">Something went wrong. Try again or use WhatsApp / email above.</p>
              )}
            </form>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-200 bg-accent-50/80 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-safe sm:flex-row">
          <p className="text-sm text-gray-500">© {new Date().getFullYear()} The Pigsty · Farmer-focused herd software</p>
          <div className="flex flex-wrap justify-center gap-4 text-sm font-medium text-gray-600 sm:gap-6">
            <Link to="/privacy" className="hover:text-primary-700">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-primary-700">
              Terms
            </Link>
            <Link to="/login" className="hover:text-primary-700">
              Sign in
            </Link>
            {waUrl && (
              <a href={waUrl} target="_blank" rel="noopener noreferrer" className="hover:text-primary-700">
                WhatsApp
              </a>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
