/** Send one password-reset test email via the email Worker. */
import { sendPasswordResetCodeEmail } from '../src/services/passwordResetDelivery.service.js';

const to = process.argv[2]?.trim();
if (!to) {
  console.error('Usage: npx tsx scripts/send-password-reset-test.ts <email>');
  process.exit(1);
}

sendPasswordResetCodeEmail(to, '847293')
  .then(() => console.log('Password reset email dispatched to', to))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
