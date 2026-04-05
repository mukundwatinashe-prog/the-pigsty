/**
 * Marketing / support contact (optional). Set in `.env`:
 * VITE_SUPPORT_EMAIL=you@example.com
 * VITE_WHATSAPP_E164=263771234567   (country code + number, no + or spaces)
 */
function trimEnv(v: string | undefined): string {
  return (v ?? '').trim();
}

export const siteConfig = {
  supportEmail: trimEnv(import.meta.env.VITE_SUPPORT_EMAIL),
  /** E.164 without leading + e.g. 263771234567 */
  whatsappE164: trimEnv(import.meta.env.VITE_WHATSAPP_E164).replace(/\D/g, ''),
};

export function whatsappHelpUrl(): string | null {
  return siteConfig.whatsappE164 ? `https://wa.me/${siteConfig.whatsappE164}` : null;
}

export function mailtoSupport(subject: string, body?: string): string | null {
  if (!siteConfig.supportEmail) return null;
  const q = new URLSearchParams({ subject });
  if (body) q.set('body', body);
  return `mailto:${siteConfig.supportEmail}?${q.toString()}`;
}
