/**
 * Marketing / support contact. Override with `.env`:
 * VITE_SUPPORT_EMAIL=you@example.com
 * VITE_WHATSAPP_E164=263771234567   (country code + number, no + or spaces)
 */
function trimEnv(v: string | undefined): string {
  return (v ?? '').trim();
}

const DEFAULT_SUPPORT_EMAIL = 'agape@magnaagape.com';

/** Served from `frontend/public` — used for favicon, tab icon, BrandLogo, and sidebar mark. */
export const appLogoUrl = '/logo.png';

export const siteConfig = {
  /** Shown in mailto links and billing help; contact form submissions are delivered to this inbox on the server (see CONTACT_INBOX_EMAIL). */
  supportEmail: trimEnv(import.meta.env.VITE_SUPPORT_EMAIL) || DEFAULT_SUPPORT_EMAIL,
  /** E.164 without leading + e.g. 263771234567 */
  whatsappE164: trimEnv(import.meta.env.VITE_WHATSAPP_E164).replace(/\D/g, ''),
};

export function whatsappHelpUrl(): string | null {
  return siteConfig.whatsappE164 ? `https://wa.me/${siteConfig.whatsappE164}` : null;
}

export function mailtoSupport(subject: string, body?: string): string {
  const q = new URLSearchParams({ subject });
  if (body) q.set('body', body);
  return `mailto:${siteConfig.supportEmail}?${q.toString()}`;
}
