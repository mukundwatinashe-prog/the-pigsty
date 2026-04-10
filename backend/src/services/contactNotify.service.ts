/**
 * Contact form deliveries go to CONTACT_INBOX_EMAIL (default agape@magnaagape.com).
 * If SMTP_HOST is set, sends email via nodemailer; otherwise logs the payload (DB still stores the row).
 */
const DEFAULT_INBOX = 'agape@magnaagape.com';

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

/** Shared SMTP path for contact + signup alerts (same inbox as CONTACT_INBOX_EMAIL). */
export async function deliverInboxEmail(opts: {
  subject: string;
  text: string;
  logTag: string;
}): Promise<void> {
  const to = contactInboxAddress();
  const { subject, text, logTag } = opts;

  const host = process.env.SMTP_HOST?.trim();
  if (!host) {
    console.info(`[${logTag}] SMTP_HOST not set — inbox=${to}`, text.replace(/\n/g, ' | '));
    return;
  }

  const from = process.env.SMTP_FROM?.trim();
  if (!from) {
    console.warn(`[${logTag}] SMTP_FROM is not set — skipping email send.`);
    return;
  }

  try {
    const nodemailer = await import('nodemailer');
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASS
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
    });
    await transporter.sendMail({ from, to, subject, text });
  } catch (e) {
    console.error(`[${logTag}] Failed to send email:`, e);
  }
}

export async function notifyContactInbox(p: ContactPayload): Promise<void> {
  const subject = `[The Pigsty] ${p.subject?.trim() || 'Contact'} — ${p.firstName} ${p.lastName}`;
  const text = formatContactEmailBody(p);
  await deliverInboxEmail({ subject, text, logTag: 'contact' });
}
