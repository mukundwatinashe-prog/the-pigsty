import { env } from '../config/env';
import { sendUserEmail } from './email/emailSender';
import { passwordResetEmail } from './email/templates';

const FRONTEND = env.FRONTEND_URL.replace(/\/$/, '');

export async function sendPasswordResetCodeEmail(toEmail: string, code: string): Promise<void> {
  const resetUrl = `${FRONTEND}/reset-password`;
  const tmpl = passwordResetEmail(code, resetUrl);
  await sendUserEmail({ to: toEmail, ...tmpl, replyTo: undefined });
}

/**
 * Twilio SMS when TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_FROM_NUMBER are set.
 * `toDigits` should be numeric only; + prefix added for Twilio if missing.
 */
export async function sendPasswordResetCodeSms(toDigits: string, code: string): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  const fromNum = process.env.TWILIO_FROM_NUMBER?.trim();

  const body = `The Pigsty password reset code: ${code}. Expires in 15 minutes.`;

  if (!sid || !token || !fromNum) {
    console.info(`[password-reset-sms] Twilio not configured — to=${toDigits} code=${code}`);
    return;
  }

  const to = toDigits.startsWith('+') ? toDigits : `+${toDigits}`;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const auth = Buffer.from(`${sid}:${token}`).toString('base64');

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ From: fromNum, To: to, Body: body }),
    });
    if (!res.ok) {
      const t = await res.text();
      console.error('[password-reset-sms] Twilio error:', res.status, t);
    }
  } catch (e) {
    console.error('[password-reset-sms] request failed:', e);
  }
}
