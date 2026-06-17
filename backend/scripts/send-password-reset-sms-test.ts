/** Send one password-reset test SMS via Twilio. */
import { sendPasswordResetCodeSms } from '../src/services/passwordResetDelivery.service.js';
import { twilioConfigured } from '../src/config/env.js';

const to = process.argv[2]?.trim();
if (!to) {
  console.error('Usage: npx tsx scripts/send-password-reset-sms-test.ts <phone>');
  console.error('Example: npx tsx scripts/send-password-reset-sms-test.ts 263771234567');
  process.exit(1);
}

if (!twilioConfigured) {
  console.error('Twilio is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER in backend/.env');
  process.exit(1);
}

sendPasswordResetCodeSms(to.replace(/\D/g, ''), '84729301')
  .then((ok) => {
    if (ok) console.log('Password reset SMS dispatched to', to);
    else {
      console.error('SMS send failed — check backend logs for Twilio error details');
      process.exit(1);
    }
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
