import api, { withBase } from './api';
import { siteConfig } from '../lib/siteConfig';

export type ContactFormPayload = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  subject?: string;
  message?: string;
};

/** Delivers landing-page contact submissions to the support inbox from the browser (no SMTP required). */
async function deliverPublicContactEmail(payload: ContactFormPayload): Promise<void> {
  const firstName = payload.firstName.trim();
  const lastName = payload.lastName.trim();
  const res = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(siteConfig.supportEmail)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      name: `${firstName} ${lastName}`.trim(),
      email: payload.email.trim(),
      phone: payload.phone?.trim() || undefined,
      subject: payload.subject?.trim() || 'Contact',
      message: payload.message?.trim() || '(no message)',
      _subject: `[The Pigsty] ${payload.subject?.trim() || 'Contact'} — ${firstName} ${lastName}`,
      _template: 'table',
      _captcha: 'false',
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { success?: string | boolean; message?: string };
  const ok = res.ok && (data.success === true || data.success === 'true');
  if (!ok) throw new Error(data.message || 'Could not send message');
}

export async function submitPublicContact(payload: ContactFormPayload): Promise<void> {
  const storePromise = fetch(withBase('/public/contact'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      firstName: payload.firstName.trim(),
      lastName: payload.lastName.trim(),
      email: payload.email.trim(),
      phone: payload.phone?.trim() || undefined,
      subject: payload.subject?.trim() || undefined,
      message: payload.message?.trim() || undefined,
      source: 'landing',
    }),
  });

  const [storeResult, emailResult] = await Promise.allSettled([
    storePromise,
    deliverPublicContactEmail(payload),
  ]);

  const stored =
    storeResult.status === 'fulfilled' && storeResult.value.ok;
  const emailed = emailResult.status === 'fulfilled';

  if (emailed) return;

  if (stored) {
    throw emailResult.status === 'rejected'
      ? emailResult.reason
      : new Error('Could not send message');
  }

  if (storeResult.status === 'fulfilled' && !storeResult.value.ok) {
    const data = (await storeResult.value.json().catch(() => ({}))) as { message?: string };
    throw new Error(data.message || 'Could not send message');
  }

  throw emailResult.status === 'rejected'
    ? emailResult.reason
    : new Error('Could not send message');
}

export async function submitAuthedContact(
  farmId: string,
  payload: ContactFormPayload,
): Promise<void> {
  await api.post('/contact', {
    farmId,
    firstName: payload.firstName.trim(),
    lastName: payload.lastName.trim(),
    email: payload.email.trim(),
    phone: payload.phone?.trim() || undefined,
    subject: payload.subject?.trim() || undefined,
    message: payload.message?.trim() || undefined,
  });
}
