import { env } from '../../config/env';
import { contactInboxAddress } from '../contactNotify.service';

export interface OutboundEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

/**
 * Sends user-facing transactional email via the Cloudflare email Worker
 * (see email-worker/), which relays to Resend.
 *
 * If CLOUDFLARE_EMAIL_WORKER_URL is not configured, the email is logged to the
 * console instead of sent — keeps local development friction-free. Always
 * resolves; failures are swallowed so callers can fire-and-forget.
 */
export async function sendUserEmail(email: OutboundEmail): Promise<void> {
  const workerUrl = env.CLOUDFLARE_EMAIL_WORKER_URL.trim();

  if (!workerUrl) {
    console.info(
      `[email] CLOUDFLARE_EMAIL_WORKER_URL not set — would send to=${email.to} subject="${email.subject}"`,
    );
    return;
  }

  if (!env.EMAIL_WORKER_TOKEN) {
    console.warn('[email] EMAIL_WORKER_TOKEN is not set — skipping email send.');
    return;
  }

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
    }
  } catch (err) {
    console.error('[email] Failed to reach email Worker:', err);
  }
}
