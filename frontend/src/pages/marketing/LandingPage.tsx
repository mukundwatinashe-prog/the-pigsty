import { useState, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  PiggyBank,
  Scale,
  FileText,
  Users,
  Shield,
  Upload,
  CheckCircle2,
  Loader2,
  Smartphone,
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
    text: 'Tag numbers, breed, stage, and health in one place — no more guessing from memory or loose notebooks.',
  },
  {
    icon: Smartphone,
    title: 'Works on your phone',
    text: 'Use The Pigsty in the browser on Android or iPhone. Add it to your home screen for quick access in the pen.',
  },
  {
    icon: Upload,
    title: 'Start from Excel',
    text: 'Download our free import template, fill it offline, then upload when you have signal. Up to thousands of rows.',
  },
  {
    icon: Scale,
    title: 'Weights that matter',
    text: 'Log weights, see growth, and make better feeding and sale decisions with simple charts and reports.',
  },
  {
    icon: FileText,
    title: 'PDF & Excel for buyers & banks',
    text: 'Herd lists and summaries you can show to buyers, vets, or lenders — with clear tables and your farm name.',
  },
  {
    icon: Users,
    title: 'Family & workers',
    text: 'Invite people you trust with roles, so everyone sees what they need without changing each other’s settings.',
  },
  {
    icon: Globe,
    title: 'Comfort for the diaspora',
    text: 'If you live abroad but still run or support a farm back home, see the herd, weights, sales, and who did what — in one place — so you can manage with confidence and account for everything without relying on scattered calls and messages.',
  },
  {
    icon: Shield,
    title: 'Your records, your export',
    text: 'We’re building for farmers who want control: export reports anytime. No credit card to try the free tier.',
  },
];

const tiers = [
  {
    name: 'Free',
    price: '$0',
    period: 'per farm',
    desc: 'Ideal for smallholders and backyard-to-market growers getting organised.',
    features: [
      'Up to 100 pigs per farm',
      'Pens, weights, import from Excel',
      'PDF & Excel reports',
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
    desc: 'Extension programmes, co-ops, or aggregators rolling out to many farms.',
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
        <section className="mx-auto max-w-6xl px-safe py-12 sm:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-primary-700">
              Pig records for smallholders
            </p>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
              Clear herd records — from a few pigs to a growing herd.
            </h1>
            <p className="mt-5 text-lg text-gray-600 sm:text-xl">
              The Pigsty is built for <strong className="font-semibold text-gray-800">smallholder and family pig keepers</strong> across
              Africa and beyond. We’re starting strong in <strong className="font-semibold text-gray-800">Zimbabwe</strong> and welcome
              farmers everywhere who want simple, honest software — not complexity you’ll never use.
            </p>
            <p className="mt-4 text-base text-gray-600 sm:text-lg">
              <strong className="font-semibold text-gray-800">In the diaspora?</strong> Stay close to your operation: check inventory,
              weights, sales, and team activity from anywhere, with reports you can trust — so you support those on the ground and keep a
              clear account of the whole farm.
            </p>
            <ul className="mx-auto mt-6 flex max-w-xl flex-col gap-2 text-left text-sm text-gray-600 sm:text-base">
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary-600" aria-hidden />
                <span>
                  <strong className="text-gray-800">Free for smaller herds</strong> — organise up to 100 pigs per farm without paying.
                </span>
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary-600" aria-hidden />
                <span>
                  <strong className="text-gray-800">Works on your phone</strong> — use it in the yard; add to home screen like an app.
                </span>
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary-600" aria-hidden />
                <span>
                  <strong className="text-gray-800">Your data</strong> — export PDF and Excel reports; upgrade only when you need more
                  pigs.
                </span>
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary-600" aria-hidden />
                <span>
                  <strong className="text-gray-800">Diaspora-friendly</strong> — manage and oversee your home farm remotely with the same
                  records your family or workers use on-site.
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
            <p className="mt-4 text-sm text-gray-500">
              No credit card for Free · Same template works after you sign up
            </p>
            <div className="mx-auto mt-8 flex max-w-2xl flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-gray-100 pt-8 text-xs font-medium text-gray-500 sm:text-sm">
              <span className="inline-flex items-center gap-1.5">
                <Smartphone className="size-4 text-primary-600" aria-hidden />
                Phone-friendly
              </span>
              <span className="inline-flex items-center gap-1.5">
                <FileText className="size-4 text-primary-600" aria-hidden />
                PDF & Excel exports
              </span>
              <span className="inline-flex items-center gap-1.5">
                <HeartHandshake className="size-4 text-primary-600" aria-hidden />
                Made with farmers in mind
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Globe className="size-4 text-primary-600" aria-hidden />
                Diaspora & on-farm
              </span>
            </div>
          </div>
        </section>

        <section id="template" className="border-y border-primary-100 bg-primary-50/50 py-14 scroll-mt-24">
          <div className="mx-auto max-w-6xl px-4 sm:flex sm:items-center sm:justify-between sm:gap-8">
            <div className="max-w-xl">
              <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">Start with a spreadsheet — even before you register</h2>
              <p className="mt-3 text-gray-600">
                Download the same import template our app uses. Fill it on your laptop or phone (where Excel or Sheets works offline), then
                sign up and upload when you’re ready. No account needed to get the file.
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
                Then create a free account →
              </Link>
            </div>
          </div>
        </section>

        <section className="border-y border-gray-100 bg-white py-16">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-center text-2xl font-bold text-gray-900 sm:text-3xl">Why smallholders use The Pigsty</h2>
            <p className="mx-auto mt-2 max-w-2xl text-center text-gray-600">
              Practical tools — not corporate farm software. Built so you can spend less time on paperwork and more time with your animals.
            </p>
            <ul className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
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

        <section id="pricing" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-16 sm:py-20">
          <h2 className="text-center text-2xl font-bold text-gray-900 sm:text-3xl">Simple, honest pricing</h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-gray-600">
            Start free. When your herd grows past 100 pigs, Pro unlocks unlimited animals. If you don’t use cards, we’ll work with you on
            other ways to pay where we can.
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

        <section id="lead" className="border-t border-gray-100 bg-primary-600 py-16 text-white scroll-mt-24">
          <div className="mx-auto max-w-xl px-4 text-center">
            <h2 className="text-2xl font-bold">Questions or not ready yet?</h2>
            <p className="mt-2 text-primary-100">
              Leave your email for updates, or tell us your country and herd size. We read every message.
            </p>
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
