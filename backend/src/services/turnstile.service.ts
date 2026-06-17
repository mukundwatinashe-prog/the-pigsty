import { env, turnstileConfigured } from '../config/env';
import { AppError } from '../middleware/error.middleware';

type TurnstileVerifyResponse = {
  success: boolean;
  'error-codes'?: string[];
};

export async function verifyTurnstileToken(token: string, remoteIp?: string): Promise<void> {
  const form = new URLSearchParams();
  form.set('secret', env.TURNSTILE_SECRET_KEY);
  form.set('response', token);
  if (remoteIp) form.set('remoteip', remoteIp);

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });

  if (!response.ok) {
    throw new AppError('Human verification is temporarily unavailable. Please try again.', 503);
  }

  const data = (await response.json()) as TurnstileVerifyResponse;
  if (!data.success) {
    throw new AppError('Human verification failed. Please refresh and try again.', 403);
  }
}

/** Reject bots (honeypot) and verify Cloudflare Turnstile when configured. */
export async function assertHumanRequest(opts: {
  turnstileToken?: string;
  honeypot?: string | null;
  ip?: string;
}): Promise<void> {
  if (opts.honeypot?.trim()) {
    throw new AppError('Request blocked', 403);
  }

  if (!turnstileConfigured) {
    if (env.NODE_ENV === 'production') {
      throw new AppError('Human verification is not configured on the server', 503);
    }
    return;
  }

  const token = opts.turnstileToken?.trim();
  if (!token) {
    throw new AppError('Human verification required', 403);
  }

  await verifyTurnstileToken(token, opts.ip);
}
