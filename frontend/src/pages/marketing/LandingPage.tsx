import { useState, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  Check,
  Globe2,
  Heart,
  Loader2,
  Menu,
  MessageCircle,
  Minus,
  PiggyBank,
  Scale,
  Shield,
  Smartphone,
  Sparkles,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { HomeBrandLink } from '../../components/HomeBrandLink';
import { track } from '../../lib/analytics';
import { sitePricing, whatsappHelpUrl } from '../../lib/siteConfig';

const features = [
  {
    icon: PiggyBank,
    title: 'Every pig, one record',
    text: 'Tag numbers, breeds, stages, health, and pen assignments — no more lost notebooks.',
    className: 'lg:col-span-2',
  },
  {
    icon: Scale,
    title: 'Weights & growth',
    text: 'Log weights, track ADG, and spot slow growers before they cost you.',
    className: '',
  },
  {
    icon: Upload,
    title: 'Excel import',
    text: 'Bring hundreds of pigs in from a spreadsheet when you upgrade.',
    className: '',
  },
  {
    icon: Users,
    title: 'Team roles',
    text: 'Owners, managers, and workers see what they need — nothing more.',
    className: '',
  },
  {
    icon: BarChart3,
    title: 'Reports & financials',
    text: 'Herd inventory, sales, feed costs, and exports to PDF or Excel.',
    className: 'lg:col-span-2',
  },
  {
    icon: Globe2,
    title: 'Farm here, manage anywhere',
    text: 'Built for on-farm teams and diaspora owners who need the same live picture.',
    className: 'lg:col-span-3',
  },
];

const steps = [
  { n: '01', title: 'Create your farm', text: 'Set location, currency, and weight units in under a minute.' },
  { n: '02', title: 'Add your herd', text: 'Enter pigs one by one or import from Excel on Grower and above.' },
  { n: '03', title: 'Run with clarity', text: 'Log feed, weights, sales, and breeding — then export when you need proof.' },
];

const tiers = [
  {
    name: 'Smallholder',
    price: sitePricing.smallholder,
    period: 'free forever',
    desc: 'Organize a small herd before you scale.',
    includes: ['Core pig, pen & weight records', 'Dashboard overview', 'No credit card required'],
    limits: ['Up to 50 pigs', '1 user', 'No reports or Excel import'],
    cta: 'Create free account',
    href: '/register',
    highlight: false,
  },
  {
    name: 'Grower',
    price: sitePricing.growerMonthly,
    period: '/ month',
    trial: '14-day free trial available',
    desc: 'Reports, imports, and a small team for active commercial farms.',
    includes: ['Everything in Smallholder', 'All reports & exports', 'Mass Excel import', 'Up to 5 team members'],
    limits: ['Up to 500 pigs', 'Billed per farm'],
    cta: 'Get started',
    href: '/register',
    highlight: true,
  },
  {
    name: 'Enterprise',
    price: sitePricing.enterpriseMonthly,
    period: '/ month',
    desc: 'Unlimited scale for co-ops and large operations.',
    includes: ['Everything in Grower', 'Unlimited pigs & users', 'Priority support'],
    limits: ['Billed per farm', 'Group deals on request'],
    cta: 'Get started',
    href: '/register',
    highlight: false,
  },
];

function AppPreview() {
  return (
    <div className="relative mx-auto w-full max-w-lg lg:max-w-none">
      <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-primary-500/30 to-farm-400/20 blur-2xl" aria-hidden />
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-primary-900/90 shadow-2xl ring-1 ring-white/10 backdrop-blur-sm">
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
          <span className="size-2.5 rounded-full bg-red-400/80" />
          <span className="size-2.5 rounded-full bg-amber-400/80" />
          <span className="size-2.5 rounded-full bg-emerald-400/80" />
          <span className="ml-2 text-xs font-medium text-white/50">The Pigsty · Dashboard</span>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
          {[
            { label: 'On hand', value: '142', sub: 'pigs tracked' },
            { label: 'Avg weight', value: '68 kg', sub: 'herd average' },
            { label: 'Low stock', value: 'Soya', sub: 'feed alert' },
            { label: 'Due soon', value: '3 sows', sub: 'farrowing window' },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-primary-300">{stat.label}</p>
              <p className="mt-1 text-2xl font-bold text-white">{stat.value}</p>
              <p className="mt-0.5 text-xs text-white/50">{stat.sub}</p>
            </div>
          ))}
        </div>
        <div className="border-t border-white/10 px-4 py-3 sm:px-5">
          <div className="flex items-center justify-between text-xs text-white/60">
            <span>Recent activity</span>
            <span className="text-emerald-300">Live sync</span>
          </div>
          <ul className="mt-2 space-y-2">
            {['Weight logged · Pen B2', 'Sale recorded · Tag #1042', 'Feed purchase · Maize 500 kg'].map((line) => (
              <li key={line} className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm text-white/80">
                <span className="size-1.5 shrink-0 rounded-full bg-primary-400" />
                {line}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const { user, loading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const waUrl = whatsappHelpUrl();

  useEffect(() => {
    if (!loading && !user) track('landing_view');
  }, [loading, user]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-primary-900">
        <Loader2 className="size-10 animate-spin text-primary-300" aria-label="Loading" />
      </div>
    );
  }
  if (user) {
    return <Navigate to="/farms" replace />;
  }

  return (
    <div className="min-h-screen bg-[#f7f6f2] text-gray-900">
      {/* Hero shell */}
      <div className="relative overflow-hidden bg-primary-900 text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, rgba(170,174,127,0.35) 0%, transparent 45%), radial-gradient(circle at 80% 0%, rgba(208,214,179,0.2) 0%, transparent 40%)',
          }}
          aria-hidden
        />
        <div className="pointer-events-none absolute -right-24 top-32 size-96 rounded-full bg-primary-700/30 blur-3xl" aria-hidden />

        <header className="relative z-20 border-b border-white/10 pt-[env(safe-area-inset-top,0px)]">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-safe py-4">
            <HomeBrandLink
              size="md"
              className="text-white"
              nameClassName="text-white"
              logoClassName="drop-shadow-md"
            />
            <button
              type="button"
              className="inline-flex size-11 items-center justify-center rounded-xl border border-white/15 text-white hover:bg-white/10 lg:hidden"
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setMobileMenuOpen((o) => !o)}
            >
              {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
            <nav className="hidden items-center gap-1 text-sm font-medium lg:flex">
              <a href="#features" className="rounded-lg px-3 py-2 text-white/80 hover:bg-white/10 hover:text-white">
                Features
              </a>
              <a href="#about" className="rounded-lg px-3 py-2 text-white/80 hover:bg-white/10 hover:text-white">
                Our story
              </a>
              <a href="#pricing" className="rounded-lg px-3 py-2 text-white/80 hover:bg-white/10 hover:text-white">
                Pricing
              </a>
              <Link to="/contact" className="rounded-lg px-3 py-2 text-white/80 hover:bg-white/10 hover:text-white">
                Contact
              </Link>
              {waUrl ? (
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-emerald-300 hover:bg-white/10"
                  onClick={() => track('whatsapp_click', { placement: 'header' })}
                >
                  <MessageCircle className="size-4" aria-hidden />
                  WhatsApp
                </a>
              ) : null}
              <Link to="/login" className="ml-2 rounded-lg px-3 py-2 text-white/90 hover:bg-white/10">
                Sign in
              </Link>
              <Link
                to="/register"
                className="ml-1 rounded-xl bg-white px-4 py-2.5 font-semibold text-primary-800 shadow-lg hover:bg-primary-50"
                onClick={() => track('cta_register_click', { placement: 'header' })}
              >
                Get started free
              </Link>
            </nav>
          </div>
          {mobileMenuOpen ? (
            <nav className="border-t border-white/10 px-safe py-3 lg:hidden" aria-label="Mobile">
              {[
                { href: '#features', label: 'Features' },
                { href: '#about', label: 'Our story' },
                { href: '#pricing', label: 'Pricing' },
              ].map(({ href, label }) => (
                <a
                  key={href}
                  href={href}
                  className="flex min-h-[44px] items-center rounded-lg px-3 text-sm font-medium text-white/90 hover:bg-white/10"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {label}
                </a>
              ))}
              <Link
                to="/contact"
                className="flex min-h-[44px] items-center rounded-lg px-3 text-sm font-medium text-white/90 hover:bg-white/10"
                onClick={() => setMobileMenuOpen(false)}
              >
                Contact
              </Link>
              {waUrl ? (
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-[44px] items-center gap-2 rounded-lg px-3 text-sm font-medium text-emerald-300 hover:bg-white/10"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    track('whatsapp_click', { placement: 'header_mobile' });
                  }}
                >
                  <MessageCircle className="size-4" aria-hidden />
                  WhatsApp
                </a>
              ) : null}
              <div className="mt-2 flex gap-2 border-t border-white/10 pt-3">
                <Link to="/login" className="flex-1 rounded-xl border border-white/20 py-2.5 text-center text-sm font-semibold">
                  Sign in
                </Link>
                <Link
                  to="/register"
                  className="flex-1 rounded-xl bg-white py-2.5 text-center text-sm font-semibold text-primary-800"
                  onClick={() => track('cta_register_click', { placement: 'header_mobile' })}
                >
                  Get started
                </Link>
              </div>
            </nav>
          ) : null}
        </header>

        <section className="relative mx-auto grid max-w-6xl gap-12 px-safe pb-16 pt-10 sm:pb-20 sm:pt-14 lg:grid-cols-2 lg:items-center lg:gap-16 lg:pb-24 lg:pt-16">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary-200">
              <Sparkles className="size-3.5" aria-hidden />
              Pig farm management, simplified
            </p>
            <h1 className="mt-6 text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.25rem]">
              Know every pig.
              <span className="mt-1 block text-primary-300">Protect every profit.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/75">
              The Pigsty replaces scattered notebooks with one clear source of truth — health, breeding, weights,
              feed, and sales in minutes, whether you&apos;re on the farm or supporting it from abroad.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                to="/register"
                className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-white px-7 py-3.5 text-base font-bold text-primary-800 shadow-xl hover:bg-primary-50"
                onClick={() => track('cta_register_click', { placement: 'hero' })}
              >
                Create free account
                <ArrowRight className="size-5" aria-hidden />
              </Link>
              <a
                href="#pricing"
                className="inline-flex min-h-[52px] items-center justify-center rounded-xl border border-white/25 px-7 py-3.5 text-base font-semibold text-white hover:bg-white/10"
              >
                Compare plans
              </a>
            </div>
            <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm text-white/60">
              <li className="inline-flex items-center gap-2">
                <Shield className="size-4 text-primary-400" aria-hidden />
                Free tier, no card
              </li>
              <li className="inline-flex items-center gap-2">
                <Smartphone className="size-4 text-primary-400" aria-hidden />
                Works on phone & desktop
              </li>
              <li className="inline-flex items-center gap-2">
                <Globe2 className="size-4 text-primary-400" aria-hidden />
                Built for diaspora owners
              </li>
            </ul>
          </div>
          <AppPreview />
        </section>
      </div>

      <main>
        {/* Features bento */}
        <section id="features" className="scroll-mt-20 mx-auto max-w-6xl px-safe py-16 sm:py-20">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-wider text-primary-700">Everything in one place</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Less admin. More time with your animals.
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Practical tools shaped by real farm work — not generic farm software bolted onto pigs.
            </p>
          </div>
          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, text, className }) => (
              <li
                key={title}
                className={`group rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm transition hover:border-primary-300 hover:shadow-md ${className}`}
              >
                <div className="flex size-11 items-center justify-center rounded-xl bg-primary-100 text-primary-700 transition group-hover:bg-primary-700 group-hover:text-white">
                  <Icon className="size-5" aria-hidden />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-gray-900">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{text}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* How it works */}
        <section className="border-y border-gray-200/80 bg-white py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-safe">
            <h2 className="text-center text-3xl font-bold tracking-tight text-gray-900">Up and running in three steps</h2>
            <ol className="mt-12 grid gap-8 md:grid-cols-3">
              {steps.map(({ n, title, text }) => (
                <li key={n} className="relative text-center md:text-left">
                  <span className="text-5xl font-black text-primary-200">{n}</span>
                  <h3 className="mt-2 text-lg font-semibold text-gray-900">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-600">{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Founder story */}
        <section id="about" className="scroll-mt-20 py-16 sm:py-20" aria-labelledby="about-heading">
          <div className="mx-auto grid max-w-6xl gap-10 px-safe lg:grid-cols-5 lg:gap-16">
            <div className="lg:col-span-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-primary-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary-800">
                <Heart className="size-3.5" aria-hidden />
                Why we built this
              </span>
              <h2 id="about-heading" className="mt-4 text-3xl font-bold tracking-tight text-gray-900">
                Built from distance — and from the pen
              </h2>
              <p className="mt-4 text-gray-600">
                A bridge between two worlds: the farm back home and the life you live abroad.
              </p>
            </div>
            <div className="space-y-5 text-base leading-relaxed text-gray-700 lg:col-span-3">
              <blockquote className="border-l-4 border-primary-600 pl-5 text-lg font-medium text-gray-900">
                &ldquo;I refused to let distance mean disconnection. I needed to know the animals are fed, records are kept,
                and nothing falls through the cracks — even when I&apos;m not physically there.&rdquo;
              </blockquote>
              <p>
                Starting The Pigsty wasn&apos;t just a business decision — it was born out of love, necessity, and the quiet
                ache of distance. Being in the diaspora means carrying your roots while your hands are tied by miles and
                time zones, always wondering if things back home are running smoothly.
              </p>
              <p>
                I&apos;m also a pig farmer myself, so every feature comes from lived experience — late nights, health scares,
                and the constant juggling of feed, breeding, weights, and finances.
              </p>
              <p className="rounded-xl bg-primary-50 px-5 py-4 text-gray-800">
                Thank you for joining — whether on the free plan or a paid one. Each member matters to us at The Pigsty.
              </p>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="scroll-mt-20 border-t border-gray-200/80 bg-white py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-safe">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-semibold uppercase tracking-wider text-primary-700">Pricing</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                Start free. Scale when your herd grows.
              </h2>
              <p className="mt-4 text-gray-600">
                Every plan includes core herd records. Paid plans unlock reports, imports, and team access.
              </p>
            </div>
            <div className="mt-12 grid gap-6 lg:grid-cols-3">
              {tiers.map((t) => (
                <article
                  key={t.name}
                  className={`flex flex-col rounded-2xl p-6 ${
                    t.highlight
                      ? 'relative border-2 border-primary-600 bg-primary-900 text-white shadow-xl lg:-translate-y-2'
                      : 'border border-gray-200 bg-[#f7f6f2] shadow-sm'
                  }`}
                >
                  {t.highlight ? (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary-500 px-3 py-0.5 text-xs font-bold uppercase tracking-wide text-primary-900">
                      Most popular
                    </span>
                  ) : null}
                  <h3 className={`text-lg font-bold ${t.highlight ? 'text-white' : 'text-gray-900'}`}>{t.name}</h3>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className={`text-4xl font-extrabold ${t.highlight ? 'text-white' : 'text-gray-900'}`}>
                      {t.price}
                    </span>
                    <span className={`text-sm ${t.highlight ? 'text-white/60' : 'text-gray-500'}`}>{t.period}</span>
                  </div>
                  {'trial' in t && t.trial ? (
                    <p className={`mt-2 text-sm font-medium ${t.highlight ? 'text-primary-300' : 'text-primary-700'}`}>
                      {t.trial}
                    </p>
                  ) : null}
                  <p className={`mt-3 text-sm ${t.highlight ? 'text-white/70' : 'text-gray-600'}`}>{t.desc}</p>
                  <div className="mt-6 flex-1 space-y-4">
                    <ul className="space-y-2">
                      {t.includes.map((f) => (
                        <li key={f} className={`flex gap-2 text-sm ${t.highlight ? 'text-white/90' : 'text-gray-700'}`}>
                          <Check className={`size-4 shrink-0 ${t.highlight ? 'text-primary-300' : 'text-primary-600'}`} />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <ul className="space-y-2 border-t border-dashed pt-4 border-white/15">
                      {t.limits.map((f) => (
                        <li
                          key={f}
                          className={`flex gap-2 text-sm ${t.highlight ? 'text-white/50' : 'text-gray-500'}`}
                        >
                          <Minus className="size-4 shrink-0 opacity-60" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <Link
                    to={t.href}
                    className={`mt-6 block min-h-[44px] rounded-xl py-3 text-center text-sm font-bold transition ${
                      t.highlight
                        ? 'bg-white text-primary-800 hover:bg-primary-50'
                        : 'border border-gray-300 bg-white text-gray-800 hover:border-primary-400 hover:text-primary-800'
                    }`}
                    onClick={() => track('cta_register_click', { placement: `pricing_${t.name}` })}
                  >
                    {t.cta}
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Contact CTA */}
        <section className="bg-primary-900 py-16 text-white sm:py-20" aria-labelledby="contact-heading">
          <div className="mx-auto max-w-3xl px-safe text-center">
            <h2 id="contact-heading" className="text-3xl font-bold tracking-tight">
              Questions before you start?
            </h2>
            <p className="mt-3 text-lg text-white/70">
              Email us or chat with Piggy — our assistant knows The Pigsty inside out.
            </p>
            <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
              <Link
                to="/contact"
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 font-semibold text-primary-800 hover:bg-primary-50"
                onClick={() => track('cta_contact_click', { placement: 'contact_section' })}
              >
                <MessageCircle className="size-5" aria-hidden />
                Contact us
              </Link>
              {waUrl ? (
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-white/30 px-6 py-3 font-semibold hover:bg-white/10"
                  onClick={() => track('whatsapp_click', { placement: 'contact_section' })}
                >
                  Chat on WhatsApp
                </a>
              ) : null}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-200 bg-[#f7f6f2] py-10 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-safe sm:flex-row">
          <div className="flex flex-col items-center gap-3 sm:items-start">
            <HomeBrandLink size="sm" />
            <p className="text-sm text-gray-500">© {new Date().getFullYear()} The Pigsty · Farmer-focused herd software</p>
          </div>
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
            <Link to="/contact" className="hover:text-primary-700">
              Contact
            </Link>
            {waUrl ? (
              <a href={waUrl} target="_blank" rel="noopener noreferrer" className="hover:text-primary-700">
                WhatsApp
              </a>
            ) : null}
          </div>
        </div>
      </footer>
    </div>
  );
}
