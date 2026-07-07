/**
 * Marketing / support contact. Override with `.env`:
 * VITE_SUPPORT_EMAIL=you@example.com
 * VITE_WHATSAPP_E164=263771234567   (country code + number, no + or spaces)
 */
function trimEnv(v: string | undefined): string {
  return (v ?? '').trim();
}

const DEFAULT_SUPPORT_EMAIL = 'pigfarm@the-pigsty.org';

function resolveSupportEmail(): string {
  const fromEnv = trimEnv(import.meta.env.VITE_SUPPORT_EMAIL);
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'the-pigsty.org' || host === 'www.the-pigsty.org') {
      return DEFAULT_SUPPORT_EMAIL;
    }
  }
  return fromEnv || DEFAULT_SUPPORT_EMAIL;
}

/** Served from `frontend/public` — used for favicon, tab icon, BrandLogo, and sidebar mark. */
export const appLogoUrl = '/logo.png';

export const siteConfig = {
  /** Shown in mailto links and billing help; contact form submissions are delivered to this inbox on the server (see CONTACT_INBOX_EMAIL). */
  supportEmail: resolveSupportEmail(),
  /** E.164 without leading + e.g. 263771234567 */
  whatsappE164: trimEnv(import.meta.env.VITE_WHATSAPP_E164).replace(/\D/g, ''),
};

/** Public plan prices and default farm currency for the UK-facing site. */
export const sitePricing = {
  currencyCode: 'GBP',
  symbol: '£',
  smallholder: '£0',
  growerMonthly: '£19',
  enterpriseMonthly: '£49',
  growerTrialDays: 7,
} as const;

export const DEFAULT_FARM_CURRENCY = sitePricing.currencyCode;

export function whatsappHelpUrl(): string | null {
  return siteConfig.whatsappE164 ? `https://wa.me/${siteConfig.whatsappE164}` : null;
}

export function mailtoSupport(subject: string, body?: string): string {
  const q = new URLSearchParams({ subject });
  if (body) q.set('body', body);
  return `mailto:${siteConfig.supportEmail}?${q.toString()}`;
}

/** Public Contact page emails the same support address users see everywhere else. */
const CONTACT_PAGE_EMAIL = siteConfig.supportEmail;

/** Mailto for the public Contact page. */
export function mailtoContactPage(subject: string, body?: string): string {
  const q = new URLSearchParams({ subject });
  if (body) q.set('body', body);
  return `mailto:${CONTACT_PAGE_EMAIL}?${q.toString()}`;
}
