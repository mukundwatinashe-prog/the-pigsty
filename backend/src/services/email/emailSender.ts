import { env } from '../../config/env';
import { contactInboxAddress } from '../contactNotify.service';

export interface OutboundEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

async function sendViaWorker(email: OutboundEmail): Promise<boolean> {
  const workerUrl = env.CLOUDFLARE_EMAIL_WORKER_URL.trim();
  if (!workerUrl || !env.EMAIL_WORKER_TOKEN) return false;

  try {
    const response = await fetch(workerUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${env.EMAIL_WORKER_TOKEN}`,
      },
      body: JSON.stringify({
        to: email.to,
        subject: email.subject,
        html: email.html,
        text: email.text,
        replyTo: email.replyTo ?? contactInboxAddress(),
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      console.error(`[email] Worker responded ${response.status}: ${detail}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[email] Failed to reach email Worker:', err);
    return false;
  }
}

async function sendViaResend(email: OutboundEmail): Promise<boolean> {
  const apiKey = env.RESEND_API_KEY.trim();
  const from = env.EMAIL_FROM.trim();
  if (!apiKey || !from) return false;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [email.to],
        subject: email.subject,
        html: email.html,
        text: email.text,
        ...(email.replyTo ? { reply_to: email.replyTo } : {}),
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      console.error(`[email] Resend responded ${response.status}: ${detail}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[email] Failed to reach Resend:', err);
    return false;
  }
}

async function sendViaSmtp(email: OutboundEmail): Promise<boolean> {
  const host = process.env.SMTP_HOST?.trim();
  const from = env.EMAIL_FROM.trim();
  if (!host || !from) return false;

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
    await transporter.sendMail({
      from,
      to: email.to,
      subject: email.subject,
      html: email.html,
      text: email.text,
      ...(email.replyTo ? { replyTo: email.replyTo } : {}),
    });
    return true;
  } catch (err) {
    console.error('[email] SMTP send failed:', err);
    return false;
  }
}

/**
 * Sends user-facing transactional email via Cloudflare email Worker, Resend, or SMTP
 * (in that order). Returns true when a provider accepted the message.
 */
export async function sendUserEmail(email: OutboundEmail): Promise<boolean> {
  if (await sendViaWorker(email)) return true;
  if (await sendViaResend(email)) return true;
  if (await sendViaSmtp(email)) return true;

  console.error(
    `[email] All delivery paths failed for to=${email.to} subject="${email.subject}". ` +
      'Configure CLOUDFLARE_EMAIL_WORKER_URL, RESEND_API_KEY, or SMTP_HOST.',
  );
  return false;
}
