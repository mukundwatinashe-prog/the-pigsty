import { env, twilioConfigured } from '../config/env';
import { toSmsE164 } from '../lib/phone';

/** Send a short farm alert SMS via Twilio (Enterprise alerts). */
export async function sendFarmAlertSms(toDigits: string, body: string): Promise<boolean> {
  const sid = env.TWILIO_ACCOUNT_SID.trim();
  const token = env.TWILIO_AUTH_TOKEN.trim();
  const fromNum = env.TWILIO_FROM_NUMBER.trim();

  if (!twilioConfigured) {
    console.warn(`[farm-alert-sms] Twilio not configured — cannot SMS ${toDigits}`);
    return false;
  }

  const to = toDigits.startsWith('+') ? toDigits : toSmsE164(toDigits);
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const auth = Buffer.from(`${sid}:${token}`).toString('base64');

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ From: fromNum, To: to, Body: body.slice(0, 320) }),
    });
    if (!res.ok) {
      const t = await res.text();
      console.error('[farm-alert-sms] Twilio error:', res.status, t);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[farm-alert-sms] request failed:', e);
    return false;
  }
}
