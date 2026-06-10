/**
 * Pigsty email Worker.
 *
 * A thin, authenticated proxy in front of Resend so the application backend can
 * send transactional email "through Cloudflare" without holding the Resend key
 * itself. The backend POSTs JSON `{ to, subject, html, text }` with a shared
 * bearer token; the Worker validates the token and relays to the Resend API.
 */

export interface Env {
  /** Resend API key (re_...). Set via `wrangler secret put RESEND_API_KEY`. */
  RESEND_API_KEY: string;
  /** Shared secret that must match the backend's EMAIL_WORKER_TOKEN. */
  EMAIL_WORKER_TOKEN: string;
  /** Verified sender, e.g. "The Pigsty <noreply@the-pigsty.org>". */
  EMAIL_FROM: string;
}

interface EmailPayload {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  /** Optional reply-to override. */
  replyTo?: string;
}

/** In-memory sliding window rate limits (per isolate; sufficient for abuse deterrence). */
const globalSendLog: number[] = [];
const recipientLog = new Map<string, number[]>();

const GLOBAL_MAX_PER_HOUR = 120;
const RECIPIENT_MAX_PER_HOUR = 8;
const HOUR_MS = 60 * 60 * 1000;

function pruneOld(log: number[], now: number): number[] {
  return log.filter((t) => now - t < HOUR_MS);
}

function isRateLimited(to: string): boolean {
  const now = Date.now();
  const trimmed = globalSendLog.length;
  for (let i = trimmed - 1; i >= 0; i--) {
    if (now - globalSendLog[i] >= HOUR_MS) globalSendLog.splice(i, 1);
  }
  if (globalSendLog.length >= GLOBAL_MAX_PER_HOUR) return true;

  const key = to.trim().toLowerCase();
  const prev = recipientLog.get(key) ?? [];
  const fresh = pruneOld(prev, now);
  recipientLog.set(key, fresh);
  return fresh.length >= RECIPIENT_MAX_PER_HOUR;
}

function recordSend(to: string): void {
  const now = Date.now();
  globalSendLog.push(now);
  const key = to.trim().toLowerCase();
  const prev = recipientLog.get(key) ?? [];
  recipientLog.set(key, pruneOld([...prev, now], now));
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    const authHeader = request.headers.get('authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!env.EMAIL_WORKER_TOKEN || token !== env.EMAIL_WORKER_TOKEN) {
      return json({ error: 'Unauthorized' }, 401);
    }

    let body: EmailPayload;
    try {
      body = (await request.json()) as EmailPayload;
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    if (!body.to || !body.subject || (!body.html && !body.text)) {
      return json({ error: 'Missing required fields: to, subject, and html or text' }, 400);
    }

    if (isRateLimited(body.to)) {
      return json({ error: 'Rate limit exceeded for email sending' }, 429);
    }

    if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
      return json({ error: 'Email sending is not configured on the Worker' }, 500);
    }

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [body.to],
        subject: body.subject,
        ...(body.html ? { html: body.html } : {}),
        ...(body.text ? { text: body.text } : {}),
        ...(body.replyTo ? { reply_to: body.replyTo } : {}),
      }),
    });

    if (!resendResponse.ok) {
      const detail = await resendResponse.text();
      return json({ error: 'Email provider rejected the message', detail }, 502);
    }

    recordSend(body.to);
    const result = (await resendResponse.json().catch(() => ({}))) as { id?: string };
    return json({ ok: true, id: result.id ?? null });
  },
};
