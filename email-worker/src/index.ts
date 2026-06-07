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

    const result = (await resendResponse.json().catch(() => ({}))) as { id?: string };
    return json({ ok: true, id: result.id ?? null });
  },
};
