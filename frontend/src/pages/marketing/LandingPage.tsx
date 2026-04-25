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
  MessageCircle,
  HeartHandshake,
  Globe,
  Menu,
  X,
  Heart,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { BrandLogo } from '../../components/BrandLogo';
import { track } from '../../lib/analytics';
import { mailtoSupport, siteConfig, whatsappHelpUrl } from '../../lib/siteConfig';
import { ContactForm } from '../../components/ContactForm';

const benefits = [
  {
    icon: PiggyBank,
    title: 'Know every pig',
    text: 'Tags, breed, stage, and health in one place — no scattered notebooks.',
  },
  {
    icon: Upload,
    title: 'Import from Excel',
    text: 'Bring pigs in from a spreadsheet when you are ready — straight from the app.',
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
      'Up to 50 pigs per farm',
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
    cta: 'Contact us',
    href: '#contact',
    highlight: false,
    external: false,
  },
];

export default function LandingPage() {
  const { user, loading } = useAuth();
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50/80 via-white to-accent-50/40 pb-safe text-gray-900">
      <header className="sticky top-0 z-20 border-b border-gray-200/80 bg-white/90 pt-[env(safe-area-inset-top,0px)] backdrop-blur-sm">
        <div className="relative mx-auto max-w-6xl px-safe">
          <div className="flex items-center justify-between gap-3 py-3 sm:py-4">
            <Link to="/" className="flex min-w-0 items-center gap-0 font-bold text-gray-900">
              <BrandLogo size="md" className="-mr-3 shrink-0 sm:-mr-4" />
              <span className="truncate leading-none">The Pigsty</span>
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
                <a href="#about" className="text-gray-600 hover:text-primary-700">
                  About
                </a>
                <a href="#pricing" className="text-gray-600 hover:text-primary-700">
                  Pricing
                </a>
                <a href="#contact" className="text-gray-600 hover:text-primary-700">
                  Contact
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
                href="#about"
                className="min-h-[44px] rounded-lg px-3 py-3 text-sm font-medium text-gray-700 hover:bg-primary-50 hover:text-primary-800"
                onClick={() => setMobileMenuOpen(false)}
              >
                About
              </a>
              <a
                href="#pricing"
                className="min-h-[44px] rounded-lg px-3 py-3 text-sm font-medium text-gray-700 hover:bg-primary-50 hover:text-primary-800"
                onClick={() => setMobileMenuOpen(false)}
              >
                Pricing
              </a>
              <a
                href="#contact"
                className="min-h-[44px] rounded-lg px-3 py-3 text-sm font-medium text-gray-700 hover:bg-primary-50 hover:text-primary-800"
                onClick={() => setMobileMenuOpen(false)}
              >
                Contact
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
              Track every pig. Protect every profit.
            </h1>
            <p className="mt-5 text-lg text-gray-600 sm:text-xl">
              The Pigsty helps smallholder and family pig farmers replace scattered notebooks with one clear source of truth. Track health,
              breeding, weights, and sales in minutes so you can make faster, smarter farm decisions with confidence.
            </p>
            <ul className="mx-auto mt-6 flex max-w-lg flex-col gap-2 text-left text-sm text-gray-600 sm:text-base">
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary-600" aria-hidden />
                <span>
                  <strong className="text-gray-800">Catch health risks earlier</strong> with complete histories by pig, pen, and date.
                </span>
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary-600" aria-hidden />
                <span>
                  <strong className="text-gray-800">Stop revenue leaks</strong> by tying feed, growth, and sales into one workflow.
                </span>
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary-600" aria-hidden />
                <span>
                  <strong className="text-gray-800">Coordinate teams anywhere</strong> with shared records for on-farm and diaspora owners.
                </span>
              </li>
            </ul>
            <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
              <Link
                to="/register"
                className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-primary-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg hover:bg-primary-700 sm:w-auto"
                onClick={() => track('cta_register_click', { placement: 'hero' })}
              >
                Start Free Trial
              </Link>
            </div>
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

        <section
          id="about"
          className="scroll-mt-24 border-y border-primary-100/80 bg-gradient-to-b from-primary-50/50 via-white to-primary-50/30 py-14 sm:py-18"
          aria-labelledby="about-heading"
        >
          <div className="mx-auto max-w-3xl px-safe">
            <div className="flex flex-col items-center text-center sm:items-start sm:text-left">
              <span className="inline-flex items-center gap-2 rounded-full bg-primary-100/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary-800">
                <Heart className="size-3.5" aria-hidden />
                Why we built this
              </span>
              <h2 id="about-heading" className="mt-4 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
                About The Pigsty
              </h2>
            </div>
            <div className="mt-8 space-y-6 text-base leading-relaxed text-gray-700 sm:text-lg">
              <p>
                Starting this pig farming app wasn&apos;t just a business decision — it was born out of love, necessity, and the quiet ache of
                distance. Being in the diaspora means carrying your roots in your chest while your hands are tied by miles and time zones,
                always wondering if things back home are running smoothly without you there to see it yourself. I built this because I refused
                to let distance mean disconnection. I needed a way to stay close to what matters, to keep my finger on the pulse of the farm
                even from afar — to know that the animals are fed, the records are kept, and nothing falls through the cracks just because
                I&apos;m not physically there. This app is my bridge between two worlds, a testament to the fact that you can hold onto home
                with both hands, no matter how far away you are.
              </p>
              <p className="border-t border-gray-200/80 pt-6 text-gray-800">
                I want to thank you for deciding to join the growing members. Whether it is for a free or paid. Each one of you is very
                important to us at The Pigsty.
              </p>
            </div>
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
                ) : t.href.startsWith('#') ? (
                  <a
                    href={t.href}
                    className="mt-6 block w-full min-h-[44px] rounded-xl border-2 border-gray-200 py-3 text-center text-sm font-semibold text-gray-800 hover:bg-gray-50"
                    onClick={() => track('cta_contact_click', { placement: `pricing_${t.name}` })}
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

        <section
          id="contact"
          className="scroll-mt-24 border-t border-gray-100 bg-primary-600 py-14 text-white"
          aria-labelledby="contact-heading"
        >
          <div className="mx-auto max-w-xl px-4">
            <h2 id="contact-heading" className="text-center text-2xl font-bold">
              Contact us
            </h2>
            <p className="mt-2 text-center text-primary-100">
              First name, last name, and email are required. Everything else is optional. Messages go to our team at{' '}
              <span className="font-medium text-white">{siteConfig.supportEmail}</span>.
            </p>
            <div className="mt-6 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
              {waUrl && (
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 font-semibold text-emerald-700 hover:bg-emerald-50 sm:w-auto"
                  onClick={() => track('whatsapp_click', { placement: 'contact_section' })}
                >
                  <MessageCircle className="size-5" aria-hidden />
                  Chat on WhatsApp
                </a>
              )}
              <a
                href={mailtoSupport('The Pigsty — question from website', '')}
                className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl border border-white/40 px-6 py-3 font-semibold text-white hover:bg-white/10 sm:w-auto"
              >
                Open email
              </a>
            </div>
            <div className="mt-8">
              <ContactForm variant="landing" onSubmitted={() => track('contact_submit', { source: 'landing' })} />
            </div>
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
            <Link to="/#contact" className="hover:text-primary-700">
              Contact
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
