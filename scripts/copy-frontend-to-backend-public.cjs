'use strict';

/**
 * Copy frontend/dist → backend/public for Vercel to serve the SPA from the API project.
 * Run after `npm run build --prefix frontend` (see backend `build:deploy`).
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = path.join(root, 'frontend/dist');
const dest = path.join(root, 'backend/public');

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const srcPath = path.join(from, entry.name);
    const destPath = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(srcPath, destPath);
    else fs.copyFileSync(srcPath, destPath);
  }
}

if (!fs.existsSync(src)) {
  console.error('[copy-frontend] frontend/dist not found — build the frontend first.');
  process.exit(1);
}

if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
copyDir(src, dest);
console.log('[copy-frontend] backend/public ← frontend/dist');
