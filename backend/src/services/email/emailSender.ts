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

/**
 * Sends user-facing transactional email via the Cloudflare email Worker, then Resend.
 * Returns true when a provider accepted the message.
 */
export async function sendUserEmail(email: OutboundEmail): Promise<boolean> {
  if (await sendViaWorker(email)) return true;
  if (await sendViaResend(email)) return true;

  console.error(
    `[email] All delivery paths failed for to=${email.to} subject="${email.subject}". ` +
      'Configure CLOUDFLARE_EMAIL_WORKER_URL or RESEND_API_KEY.',
  );
  return false;
}
