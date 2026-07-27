// Regression guard for the duplicate/null Router-context navigation crash
// ("Cannot destructure property 'basename' of useContext(...) as it is null").
//
// Root cause: react-router's context module ending up in MORE THAN ONE output
// chunk. When that happens, <BrowserRouter> registers one context instance while
// a lazily-loaded route's hook reads a different one → null context → crash on
// navigation. (An earlier guard wrongly required an isolated `router-*` chunk;
// that arrangement ALSO duplicated the module and crashed.)
//
// The real invariant: react-router must appear in EXACTLY ONE chunk. Run after
// `vite build` (wired into CI).
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const assetsDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'assets');
// Stable react-router internal string that survives minification.
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

if (hits.length > 1) {
  console.error(
    `✗ bundle check: react-router is duplicated across ${hits.length} chunks: ${hits.join(', ')}.\n` +
      '  Two Router-context instances cause the null-context navigation crash.\n' +
      '  Bundle react-router in a single chunk (see the manualChunks note in vite.config.ts).',
  );
  process.exit(1);
}

console.log(`✓ bundle check: react-router in exactly one chunk (${hits[0]}).`);
