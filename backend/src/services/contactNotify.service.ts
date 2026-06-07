/**
 * Contact form deliveries go to CONTACT_INBOX_EMAIL (default pigfarm@the-pigsty.org)
 * via the Cloudflare email Worker → Resend.
 */
import { sendUserEmail } from './email/emailSender';
import { contactInboxEmail } from './email/templates';

const DEFAULT_INBOX = 'pigfarm@the-pigsty.org';

export function contactInboxAddress(): string {
  return (process.env.CONTACT_INBOX_EMAIL || DEFAULT_INBOX).trim();
}

export type ContactPayload = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string | null;
  source: string;
  userId: string | null;
  farmId: string | null;
};

export function formatContactEmailBody(p: ContactPayload): string {
  const lines = [
    'New message from The Pigsty contact form',
    '',
    `Name: ${p.firstName} ${p.lastName}`,
    `Email: ${p.email}`,
    p.phone ? `Phone: ${p.phone}` : null,
    `Source: ${p.source}`,
    p.userId ? `User ID: ${p.userId}` : null,
    p.farmId ? `Farm ID: ${p.farmId}` : null,
    p.subject ? `Subject: ${p.subject}` : null,
    '',
    p.message || '(no message)',
  ];
  return lines.filter((x) => x != null).join('\n');
}

export async function notifyContactInbox(p: ContactPayload): Promise<void> {
  const to = contactInboxAddress();
  const tmpl = contactInboxEmail({
    firstName: p.firstName,
    lastName: p.lastName,
    email: p.email,
    phone: p.phone,
    subject: p.subject,
    message: p.message,
    source: p.source,
  });
  await sendUserEmail({ to, ...tmpl, replyTo: p.email.trim() });
}
