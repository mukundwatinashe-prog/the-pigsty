import api from './api';

export type ContactFormPayload = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  subject?: string;
  message?: string;
};

export async function submitPublicContact(payload: ContactFormPayload): Promise<void> {
  const res = await fetch('/api/public/contact', {
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
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(data.message || 'Could not send message');
  }
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
