/**
 * Smoke-test the main user journey against production (read-only + one contact submit).
 * Usage: node scripts/go-live-journey.mjs
 */
const API = 'https://api.the-pigsty.org/api';
const jar = { cookie: '' };

async function req(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(jar.cookie ? { cookie: jar.cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const set = res.headers.getSetCookie?.() ?? [];
  if (set.length) jar.cookie = set.map((c) => c.split(';')[0]).join('; ');
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, json };
}

const steps = [];

async function step(name, fn) {
  try {
    await fn();
    steps.push({ name, ok: true });
    console.log(`✓ ${name}`);
  } catch (e) {
    steps.push({ name, ok: false, err: e.message });
    console.log(`✗ ${name} — ${e.message}`);
  }
}

await step('Health', async () => {
  const r = await req('GET', '/health');
  if (r.status !== 200) throw new Error(String(r.status));
});

await step('Login test account', async () => {
  const r = await req('POST', '/auth/login', {
    email: 'payment-e2e-20260606@mailinator.com',
    password: 'TestPayment123!@',
  });
  if (r.status !== 200) throw new Error(JSON.stringify(r.json));
});

const farmId = '3300fd5a-ac6a-49e7-8ac0-b83a18aa7591';

await step('Farm dashboard', async () => {
  const r = await req('GET', `/farms/${farmId}`);
  if (r.status !== 200) throw new Error(String(r.status));
  if (r.json.billing?.plan !== 'FREE') throw new Error(`unexpected plan ${r.json.billing?.plan}`);
});

await step('Financials gated (402)', async () => {
  const r = await req('GET', `/farms/${farmId}/financials`);
  if (r.status !== 402) throw new Error(`expected 402, got ${r.status}`);
});

await step('Activity log export allowed', async () => {
  const r = await fetch(`${API}/farms/${farmId}/reports/activity-log?format=json`, {
    headers: { cookie: jar.cookie },
  });
  if (r.status !== 200) throw new Error(String(r.status));
});

await step('Team invite gated (402)', async () => {
  const r = await req('POST', `/farms/${farmId}/invitations`, {
    email: 'journey-invite@mailinator.com',
    role: 'WORKER',
  });
  if (r.status !== 402) throw new Error(`expected 402, got ${r.status}`);
});

await step('Logout', async () => {
  const r = await req('POST', '/auth/logout');
  if (r.status !== 200 && r.status !== 204) throw new Error(String(r.status));
  const me = await req('GET', '/auth/me');
  if (me.status !== 401) throw new Error(`expected 401 after logout, got ${me.status}`);
});

const failed = steps.filter((s) => !s.ok);
console.log(`\n${steps.length - failed.length}/${steps.length} journey steps passed`);
process.exit(failed.length ? 1 : 0);
