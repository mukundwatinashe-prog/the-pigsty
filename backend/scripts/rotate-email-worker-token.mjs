/**
 * Generate a new EMAIL_WORKER_TOKEN and update backend/.env.
 * After running, also update:
 *   cd email-worker && npx wrangler secret put EMAIL_WORKER_TOKEN
 *   Vercel → the-pigsty-ctcf → EMAIL_WORKER_TOKEN → redeploy
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '../.env');
const token = crypto.randomBytes(32).toString('base64url');

let content = fs.readFileSync(envPath, 'utf8');
if (/^EMAIL_WORKER_TOKEN=/m.test(content)) {
  content = content.replace(/^EMAIL_WORKER_TOKEN=.*$/m, `EMAIL_WORKER_TOKEN="${token}"`);
} else {
  content += `\nEMAIL_WORKER_TOKEN="${token}"\n`;
}
fs.writeFileSync(envPath, content);

console.log('Updated backend/.env EMAIL_WORKER_TOKEN');
console.log('\nNext steps:');
console.log('1. cd email-worker && npx wrangler secret put EMAIL_WORKER_TOKEN');
console.log('   (paste the new token when prompted)');
console.log('2. Vercel → the-pigsty-ctcf → Environment Variables → EMAIL_WORKER_TOKEN');
console.log('3. Redeploy backend Worker + API');
