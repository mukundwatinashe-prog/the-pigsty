// Regression guard for the duplicate/null Router-context navigation crash.
//
// The bug: when react-router is bundled into the shared `vendor` chunk (instead
// of its own `router` chunk), lazily-loaded routes read a null Router context
// and crash on client-side navigation ("Cannot destructure property 'basename'
// of useContext(...) as it is null"). The fix keeps react-router isolated in a
// dedicated `router-*` chunk (see the manualChunks note in vite.config.ts).
//
// This asserts react-router lives ONLY in a `router-*` chunk. Run after
// `vite build` (wired into CI). Confirmed to fail on the buggy config and pass
// on the fix.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const assetsDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'assets');
// Stable react-router error string that survives minification.
const MARKER = 'may be used only in the context of a <Router>';

let files;
try {
  files = readdirSync(assetsDir).filter((f) => f.endsWith('.js'));
} catch {
  console.error(`✗ bundle check: ${assetsDir} not found — run \`npm run build\` first.`);
  process.exit(1);
}

const hits = files.filter((f) => readFileSync(resolve(assetsDir, f), 'utf8').includes(MARKER));

if (hits.length === 0) {
  console.error(
    '✗ bundle check: react-router marker not found in any chunk.\n' +
      '  The marker string likely changed in a react-router upgrade — update MARKER in this script.',
  );
  process.exit(1);
}

const leaked = hits.filter((f) => !f.startsWith('router-'));
if (leaked.length > 0) {
  console.error(
    `✗ bundle check: react-router is bundled outside its dedicated chunk: ${hits.join(', ')}.\n` +
      '  This regresses the duplicate/null Router-context navigation crash.\n' +
      "  Keep react-router in its own 'router' chunk (see the manualChunks note in vite.config.ts).",
  );
  process.exit(1);
}

console.log(`✓ bundle check: react-router isolated in its own chunk (${hits.join(', ')}).`);
