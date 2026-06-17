#!/usr/bin/env node
/**
 * Push Turnstile keys to Vercel (and optionally create the widget via API).
 *
 * Mode A — widget already created in Cloudflare dashboard:
 *   TURNSTILE_SITE_KEY=0x... TURNSTILE_SECRET_KEY=0x... node scripts/setup-turnstile.cjs
 *
 * Mode B — create widget via API:
 *   CLOUDFLARE_API_TOKEN=xxx node scripts/setup-turnstile.cjs
 *   (Token needs "Turnstile Sites Write" at dash.cloudflare.com/profile/api-tokens)
 */
const { execSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BACKEND = path.join(ROOT, 'backend');
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || 'f780d3182770535630bc7425cbb56ee6';
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const SITE_KEY = process.env.TURNSTILE_SITE_KEY?.trim();
const SECRET_KEY = process.env.TURNSTILE_SECRET_KEY?.trim();

function run(cmd, cwd) {
  execSync(cmd, { cwd, stdio: 'inherit' });
}

function setVercelEnv(projectDir, projectName, name, value, environments) {
  run(`npx vercel link --project ${projectName} --yes`, projectDir);
  for (const env of environments) {
    run(`npx vercel env rm ${name} ${env} --yes 2>/dev/null || true`, projectDir);
    run(`npx vercel env add ${name} ${env} --value "${value}" --yes`, projectDir);
  }
}

async function createWidget() {
  if (!API_TOKEN) {
    console.error(
      'Provide TURNSTILE_SITE_KEY + TURNSTILE_SECRET_KEY (from the dashboard),\n' +
        'or CLOUDFLARE_API_TOKEN to create the widget via API.',
    );
    process.exit(1);
  }

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/challenges/widgets`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'The Pigsty Chat',
        mode: 'invisible',
        domains: ['the-pigsty.org', 'www.the-pigsty.org', 'localhost', '127.0.0.1'],
      }),
    },
  );

  const data = await res.json();
  if (!data.success) {
    console.error('Cloudflare API error:', JSON.stringify(data.errors || data, null, 2));
    process.exit(1);
  }

  return { sitekey: data.result.sitekey, secret: data.result.secret };
}

async function main() {
  let sitekey = SITE_KEY;
  let secret = SECRET_KEY;

  if (!sitekey || !secret) {
    console.log('Creating Turnstile widget via Cloudflare API…');
    const created = await createWidget();
    sitekey = created.sitekey;
    secret = created.secret;
    console.log('Widget created. Site key:', sitekey);
  } else {
    console.log('Using provided Turnstile keys.');
  }

  console.log('Updating Vercel env (the-pigsty-ctcf + the-pigsty)…');
  setVercelEnv(BACKEND, 'the-pigsty-ctcf', 'TURNSTILE_SECRET_KEY', secret, ['production', 'preview']);
  setVercelEnv(ROOT, 'the-pigsty', 'VITE_TURNSTILE_SITE_KEY', sitekey, ['production', 'preview']);

  console.log('\nRedeploying API + frontend…');
  run('npx vercel --prod --yes', BACKEND);
  run('npx vercel --prod --yes', ROOT);

  console.log('\nDone. Turnstile human verification is live for Piggy + in-app chat.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
