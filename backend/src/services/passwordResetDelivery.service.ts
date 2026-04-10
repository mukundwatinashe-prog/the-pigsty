const FRONTEND = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');

export async function sendPasswordResetCodeEmail(toEmail: string, code: string): Promise<void> {
  const subject = 'Your password reset code';
  const text = [
    'You requested a password reset for The Pigsty.',
    '',
    `Your verification code is: ${code}`,
    '',
    'It expires in 15 minutes. If you did not request this, ignore this email.',
    '',
    `You can also enter this code on: ${FRONTEND}/reset-password`,
  ].join('\n');

  const host = process.env.SMTP_HOST?.trim();
  if (!host) {
    console.info(`[password-reset-email] SMTP_HOST not set — to=${toEmail} code=${code}`);
    return;
  }

  const from = process.env.SMTP_FROM?.trim();
  if (!from) {
    console.warn('[password-reset-email] SMTP_FROM not set — skipping send.');
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
    await transporter.sendMail({ from, to: toEmail, subject, text });
  } catch (e) {
    console.error('[password-reset-email] send failed:', e);
  }
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
